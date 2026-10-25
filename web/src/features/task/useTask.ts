import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Board, Task, TaskCard, TaskPatch } from "@/api/types";

export function useTask(id: number | null) {
	return useQuery({
		queryKey: queryKeys.tasks.detail(id ?? -1),
		enabled: id !== null,
		queryFn: async () =>
			(
				await api.GET("/api/tasks/{id}", {
					params: { path: { id: id as number } },
				})
			).data as Task,
		meta: { silent: true },
		retry: false,
	});
}

function mapCards(
	queryClient: QueryClient,
	projectId: number,
	fn: (cards: TaskCard[]) => TaskCard[],
) {
	queryClient.setQueryData<Board>(
		queryKeys.projects.board(projectId),
		(board) =>
			board && {
				...board,
				columns: board.columns.map((c) => ({ ...c, tasks: fn(c.tasks) })),
			},
	);
}

function patchCard(
	queryClient: QueryClient,
	projectId: number,
	id: number,
	patch: Partial<TaskCard>,
) {
	mapCards(queryClient, projectId, (cards) =>
		cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
	);
}

/** Copies the card-level fields of a full task onto its board card. */
export function syncFromTask(queryClient: QueryClient, task: Task) {
	patchCard(queryClient, task.projectId, task.id, {
		title: task.title,
		assigneeKind: task.assigneeKind,
		assigneeUserId: task.assigneeUserId,
		requireSignOff: task.requireSignOff,
		waitingOn: task.waitingOn,
		running: task.running,
		pendingApproval: task.pendingApproval,
		updatedAt: task.updatedAt,
	});
	queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
}

export function useUpdateTask(task: Task) {
	const queryClient = useQueryClient();
	const detailKey = queryKeys.tasks.detail(task.id);
	const boardKey = queryKeys.projects.board(task.projectId);
	return useMutation({
		mutationFn: async (patch: TaskPatch) =>
			(
				await api.PATCH("/api/tasks/{id}", {
					params: { path: { id: task.id } },
					body: patch,
				})
			).data as Task,
		onMutate: async (patch) => {
			await queryClient.cancelQueries({ queryKey: detailKey });
			const board = queryClient.getQueryData<Board>(boardKey);
			const previous = queryClient.getQueryData<Task>(detailKey);
			const { descriptionMd: _d, outputMd: _o, ...cardPatch } = patch;
			const optimistic: Partial<TaskCard> = {
				...cardPatch,
				assigneeUserId: cardPatch.assigneeUserId ?? null,
			};
			if (patch.assigneeKind === undefined) {
				delete optimistic.assigneeUserId;
			}
			queryClient.setQueryData<Task>(
				detailKey,
				(t) => t && { ...t, ...patch, ...optimistic },
			);
			patchCard(queryClient, task.projectId, task.id, optimistic);
			return { previous, board };
		},
		onError: (_e, _p, ctx) => {
			if (!ctx) return;
			queryClient.setQueryData(detailKey, ctx.previous);
			queryClient.setQueryData(boardKey, ctx.board);
		},
		onSuccess: (updated) => syncFromTask(queryClient, updated),
	});
}

export function useAddDependency(task: Task) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (dependsOnId: number) =>
			(
				await api.POST("/api/tasks/{id}/deps", {
					params: { path: { id: task.id } },
					body: { dependsOnId },
				})
			).data as Task,
		onSuccess: (updated) => syncFromTask(queryClient, updated),
		meta: { silent: true },
	});
}

export function useRemoveDependency(task: Task) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (dependsOnId: number) =>
			(
				await api.DELETE("/api/tasks/{id}/deps/{dependsOnId}", {
					params: { path: { id: task.id, dependsOnId } },
				})
			).data as Task,
		onSuccess: (updated) => syncFromTask(queryClient, updated),
	});
}

export function useDeleteTask(task: Task, onDeleted: () => void) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			await api.DELETE("/api/tasks/{id}", {
				params: { path: { id: task.id } },
			});
		},
		onSuccess: () => {
			onDeleted();
			mapCards(queryClient, task.projectId, (cards) =>
				cards.filter((c) => c.id !== task.id),
			);
			queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(task.id) });
			// Dependents of the deleted task may no longer be waiting.
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.board(task.projectId),
			});
		},
	});
}
