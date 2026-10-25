import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Board, Task, TaskCard, TaskPatch } from "@/api/types";
import { taskToCard } from "@/features/board/boardModel";
import {
	changeCard,
	combine,
	patchTaskDetail,
} from "@/features/board/optimisticCard";
import { upsertCard } from "@/features/live/applyEvent";

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

/** Stores a server task in the detail cache and on the board (moving the card if its column changed). */
export function syncFromTask(queryClient: QueryClient, task: Task) {
	queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
	queryClient.setQueryData<Board>(
		queryKeys.projects.board(task.projectId),
		(board) => board && upsertCard(board, taskToCard(task)),
	);
}

/**
 * Re-reads one task after a mutation that already succeeded. Fire and forget:
 * a failure here must never turn that success into an error.
 */
export async function refreshTask(
	queryClient: QueryClient,
	projectId: number,
	taskId: number,
) {
	try {
		const { data } = await api.GET("/api/tasks/{id}", {
			params: { path: { id: taskId } },
		});
		if (data && (data as Task).projectId === projectId) {
			syncFromTask(queryClient, data as Task);
		}
	} catch {
		// The next event or refetch catches up.
	}
}

export function useUpdateTask(task: Task) {
	const queryClient = useQueryClient();
	const detailKey = queryKeys.tasks.detail(task.id);
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
			const { descriptionMd: _d, outputMd: _o, ...cardPatch } = patch;
			const fields: Partial<TaskCard> = {
				...cardPatch,
				assigneeUserId: cardPatch.assigneeUserId ?? null,
			};
			if (patch.assigneeKind === undefined) {
				delete fields.assigneeUserId;
			}
			return {
				undo: combine(
					patchTaskDetail(queryClient, task.id, { ...patch, ...fields }),
					changeCard(queryClient, task.projectId, task.id, { fields }),
				),
			};
		},
		onError: (_e, _p, ctx) => {
			ctx?.undo();
			queryClient.invalidateQueries({ queryKey: detailKey, exact: true });
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
