import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Board, Run, Task } from "@/api/types";
import { syncFromTask } from "./useTask";

const POLL_MS = 5000;

/** Run history, newest first. Polls while a run is active, as a fallback for the live stream. */
export function useRuns(taskId: number) {
	return useQuery({
		queryKey: queryKeys.tasks.runs(taskId),
		queryFn: async () =>
			(
				await api.GET("/api/tasks/{id}/runs", {
					params: { path: { id: taskId } },
				})
			).data as Run[],
		refetchInterval: (query) =>
			query.state.data?.some((r) => r.state === "running") ? POLL_MS : false,
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
	const boardKey = queryKeys.projects.board(task.projectId);
	const detailKey = queryKeys.tasks.detail(task.id);

	const setRunning = (running: boolean) => {
		queryClient.setQueryData<Board>(
			boardKey,
			(board) =>
				board && {
					...board,
					columns: board.columns.map((c) => ({
						...c,
						tasks: c.tasks.map((t) =>
							t.id === task.id ? { ...t, running } : t,
						),
					})),
				},
		);
		queryClient.setQueryData<Task>(detailKey, (t) => t && { ...t, running });
	};

	/** Moves the card to the column the server put the task in. */
	const placeCard = (status: Task["status"]) =>
		queryClient.setQueryData<Board>(boardKey, (board) => {
			const card = board?.columns
				.flatMap((c) => c.tasks)
				.find((t) => t.id === task.id);
			if (!board || !card || card.status === status) return board;
			const moved = { ...card, status };
			return {
				...board,
				columns: board.columns.map((c) => {
					const rest = c.tasks.filter((t) => t.id !== task.id);
					return { ...c, tasks: c.status === status ? [...rest, moved] : rest };
				}),
			};
		});

	return useMutation({
		mutationFn: async (runId: number) =>
			(
				await api.POST("/api/runs/{id}/cancel", {
					params: { path: { id: runId } },
				})
			).data as Run,
		onMutate: async (runId) => {
			await queryClient.cancelQueries({ queryKey: runsKey });
			const runs = queryClient.getQueryData<Run[]>(runsKey);
			const board = queryClient.getQueryData<Board>(boardKey);
			const detail = queryClient.getQueryData<Task>(detailKey);
			queryClient.setQueryData<Run[]>(runsKey, (list) =>
				list?.map((r) =>
					r.id === runId
						? { ...r, state: "cancelled", endedAt: new Date().toISOString() }
						: r,
				),
			);
			setRunning(false);
			return { runs, board, detail };
		},
		onError: (_e, _id, ctx) => {
			if (!ctx) return;
			queryClient.setQueryData(runsKey, ctx.runs);
			queryClient.setQueryData(boardKey, ctx.board);
			queryClient.setQueryData(detailKey, ctx.detail);
		},
		onSuccess: async (run) => {
			queryClient.setQueryData<Run[]>(runsKey, (list) =>
				list?.map((r) => (r.id === run.id ? run : r)),
			);
			// The server moves the card out of In Progress: refetch just this task and patch its card.
			const { data } = await api.GET("/api/tasks/{id}", {
				params: { path: { id: task.id } },
			});
			if (data) {
				syncFromTask(queryClient, data as Task);
				placeCard((data as Task).status);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: runsKey });
			queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.status });
		},
	});
}
