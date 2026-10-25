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
import { toastError } from "@/lib/toast";
import { moveTaskInColumns, replaceCard } from "./boardModel";

/** Loads the board; `columns` is the seam drag and drop will read and update. */
export function useBoard(projectId: number) {
	const query = useQuery({
		queryKey: queryKeys.projects.board(projectId),
		queryFn: async () =>
			(
				await api.GET("/api/projects/{id}/board", {
					params: { path: { id: projectId } },
				})
			).data as Board,
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
		(board) =>
			board && {
				...board,
				columns: board.columns.map((c) =>
					c.status === task.status ? { ...c, tasks: [...c.tasks, task] } : c,
				),
			},
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

interface Snapshot {
	snapshot?: Board;
}

/** Optimistic move: reorder in the cache at once, roll back on rejection. */
export function useMoveTask(projectId: number) {
	const queryClient = useQueryClient();
	const key = queryKeys.projects.board(projectId);
	const { mutate } = useMutation({
		mutationFn: async ({ taskId, status, afterTaskId }: MoveVars & Snapshot) =>
			(
				await api.POST("/api/tasks/{id}/move", {
					params: { path: { id: taskId } },
					body: { status, afterTaskId },
				})
			).data as TaskCard,
		meta: { silent: true },
		onError: (error, { snapshot }) => {
			if (snapshot) queryClient.setQueryData(key, snapshot);
			toastError(error.message || "Could not move the task");
		},
		onSuccess: (card) =>
			queryClient.setQueryData<Board>(
				key,
				(board) =>
					board && { ...board, columns: replaceCard(board.columns, card) },
			),
	});

	// The cache is updated synchronously (not in onMutate) so the card never
	// flashes back to its old place between the drop and the optimistic render.
	const move = useCallback(
		(vars: MoveVars) => {
			const snapshot = queryClient.getQueryData<Board>(key);
			void queryClient.cancelQueries({ queryKey: key });
			queryClient.setQueryData<Board>(
				key,
				(board) =>
					board && {
						...board,
						columns: moveTaskInColumns(
							board.columns,
							vars.taskId,
							vars.status,
							vars.afterTaskId,
						),
					},
			);
			mutate({ ...vars, snapshot });
		},
		[queryClient, key, mutate],
	);
	return { move };
}
