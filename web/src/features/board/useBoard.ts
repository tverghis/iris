import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Board, Task, TaskCard, TaskStatus, User } from "@/api/types";
import { upsertCard } from "@/features/live/applyEvent";
import { toastError } from "@/lib/toast";
import { replaceCard, taskToCard } from "./boardModel";
import { consumeBoardPrefetch } from "./boardPrefetch";
import { changeCard, type Undo } from "./optimisticCard";

/** Loads the board; `columns` is the seam drag and drop will read and update. */
export function useBoard(projectId: number) {
	const query = useQuery({
		queryKey: queryKeys.projects.board(projectId),
		queryFn: async () =>
			(await consumeBoardPrefetch(projectId)) ??
			((
				await api.GET("/api/projects/{id}/board", {
					params: { path: { id: projectId } },
				})
			).data as Board),
		meta: { silent: true },
	});
	return {
		project: query.data?.project,
		columns: query.data?.columns,
		isPending: query.isPending,
		error: query.error,
		refetch: query.refetch,
	};
}

export function useUsers() {
	return useQuery({
		queryKey: queryKeys.users,
		queryFn: async () => (await api.GET("/api/users")).data ?? ([] as User[]),
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export function addTaskToBoard(
	queryClient: QueryClient,
	projectId: number,
	task: Task,
) {
	queryClient.setQueryData<Board>(
		queryKeys.projects.board(projectId),
		(board) => board && upsertCard(board, taskToCard(task)),
	);
}

export function useQuickAdd(projectId: number, status: TaskStatus) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (title: string) =>
			(
				await api.POST("/api/projects/{id}/tasks", {
					params: { path: { id: projectId } },
					body: { title, status },
				})
			).data as Task,
		onSuccess: (task) => addTaskToBoard(queryClient, projectId, task),
	});
}

export interface MoveVars {
	taskId: number;
	status: TaskStatus;
	afterTaskId: number | null;
}

interface Undoable {
	undo: Undo;
}

const MOVE_KEY = ["board", "move"] as const;

/** Optimistic move: reorder in the cache at once, put back only that card on rejection. */
export function useMoveTask(projectId: number) {
	const queryClient = useQueryClient();
	const key = queryKeys.projects.board(projectId);
	const { mutate } = useMutation({
		mutationKey: MOVE_KEY,
		mutationFn: async ({ taskId, status, afterTaskId }: MoveVars & Undoable) =>
			(
				await api.POST("/api/tasks/{id}/move", {
					params: { path: { id: taskId } },
					body: { status, afterTaskId },
				})
			).data as TaskCard,
		meta: { silent: true },
		onError: (error, { undo }) => {
			undo();
			toastError(error.message || "Could not move the task");
			// Resync once the last in-flight move is done, so it cannot undo another's optimism.
			if (queryClient.isMutating({ mutationKey: MOVE_KEY }) <= 1) {
				queryClient.invalidateQueries({ queryKey: key });
			}
		},
		onSuccess: (card) =>
			queryClient.setQueryData<Board>(
				key,
				(board) =>
					board && { ...board, columns: replaceCard(board.columns, card) },
			),
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists }),
	});

	// The cache is updated synchronously (not in onMutate) so the card never
	// flashes back to its old place between the drop and the optimistic render.
	const move = useCallback(
		(vars: MoveVars) => {
			void queryClient.cancelQueries({ queryKey: key });
			const undo = changeCard(queryClient, projectId, vars.taskId, {
				status: vars.status,
				afterTaskId: vars.afterTaskId,
			});
			mutate({ ...vars, undo });
		},
		[queryClient, projectId, key, mutate],
	);
	return { move };
}
