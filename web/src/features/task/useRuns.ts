import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Run } from "@/api/types";
import {
	changeCard,
	combine,
	patchTaskDetail,
} from "@/features/board/optimisticCard";
import { refreshTask } from "./useTask";

const POLL_MS = 5000;
/** Stop polling a run that has shown no change for this long (the stream and focus refetch still apply). */
const POLL_GIVE_UP_MS = 10 * 60_000;

/** Run history, newest first. Polls while a run is active, as a fallback for the live stream. */
export function useRuns(taskId: number) {
	const lastChange = useRef<{ data: Run[] | undefined; at: number }>({
		data: undefined,
		at: Date.now(),
	});
	return useQuery({
		queryKey: queryKeys.tasks.runs(taskId),
		queryFn: async () =>
			(
				await api.GET("/api/tasks/{id}/runs", {
					params: { path: { id: taskId } },
				})
			).data as Run[],
		refetchInterval: (query) => {
			const { data } = query.state;
			// Structural sharing keeps the same array while the server data is unchanged.
			if (lastChange.current.data !== data) {
				lastChange.current = { data, at: Date.now() };
			}
			const stuck = Date.now() - lastChange.current.at > POLL_GIVE_UP_MS;
			return !stuck && data?.some((r) => r.state === "running")
				? POLL_MS
				: false;
		},
		meta: { silent: true },
	});
}

/** The exact context served to the run; fetched only once enabled (on demand). */
export function useRunContext(runId: number, enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.runs.context(runId),
		enabled,
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async () =>
			(
				await api.GET("/api/runs/{id}/context", {
					params: { path: { id: runId } },
				})
			).data,
	});
}

export function useCancelRun(task: { id: number; projectId: number }) {
	const queryClient = useQueryClient();
	const runsKey = queryKeys.tasks.runs(task.id);

	return useMutation({
		mutationFn: async (runId: number) =>
			(
				await api.POST("/api/runs/{id}/cancel", {
					params: { path: { id: runId } },
				})
			).data as Run,
		onMutate: async (runId) => {
			await queryClient.cancelQueries({ queryKey: runsKey });
			const before = queryClient
				.getQueryData<Run[]>(runsKey)
				?.find((r) => r.id === runId);
			queryClient.setQueryData<Run[]>(runsKey, (list) =>
				list?.map((r) =>
					r.id === runId
						? { ...r, state: "cancelled", endedAt: new Date().toISOString() }
						: r,
				),
			);
			const undoRun = () =>
				queryClient.setQueryData<Run[]>(runsKey, (list) =>
					list?.map((r) => (r.id === runId && before ? before : r)),
				);
			return {
				undo: combine(
					undoRun,
					patchTaskDetail(queryClient, task.id, { running: false }),
					changeCard(queryClient, task.projectId, task.id, {
						fields: { running: false },
					}),
				),
			};
		},
		onError: (_e, _id, ctx) => ctx?.undo(),
		onSuccess: (run) => {
			queryClient.setQueryData<Run[]>(runsKey, (list) =>
				list?.map((r) => (r.id === run.id ? run : r)),
			);
			// The server moves the card out of In Progress.
			void refreshTask(queryClient, task.projectId, task.id);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: runsKey });
			queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.status });
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists });
		},
	});
}
