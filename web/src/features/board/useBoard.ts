import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Board, Task, TaskStatus, User } from "@/api/types";

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
