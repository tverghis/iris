import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Board, Comment, Task } from "@/api/types";
import { upsertCard } from "@/features/live/applyEvent";
import { getCurrentUserId } from "@/lib/currentUser";
import { toastError } from "@/lib/toast";

export function useComments(taskId: number) {
	return useQuery({
		queryKey: queryKeys.tasks.comments(taskId),
		queryFn: async () =>
			(
				await api.GET("/api/tasks/{id}/comments", {
					params: { path: { id: taskId } },
				})
			).data as Comment[],
	});
}

export type NewComment = {
	bodyMd: string;
	kind: "comment" | "answer";
	replyToId?: number;
};

let tempId = 0;

export function usePostComment(task: Task, authorName: string | undefined) {
	const queryClient = useQueryClient();
	const key = queryKeys.tasks.comments(task.id);
	return useMutation({
		mutationFn: async (c: NewComment) =>
			(
				await api.POST("/api/tasks/{id}/comments", {
					params: { path: { id: task.id } },
					body: { kind: c.kind, bodyMd: c.bodyMd, replyToId: c.replyToId },
				})
			).data as Comment,
		meta: { silent: true },
		onMutate: async (c) => {
			await queryClient.cancelQueries({ queryKey: key });
			const previous = queryClient.getQueryData<Comment[]>(key);
			const optimistic: Comment = {
				id: --tempId,
				taskId: task.id,
				author: {
					kind: "user",
					name: authorName,
					userId: getCurrentUserId() ?? undefined,
				},
				bodyMd: c.bodyMd,
				kind: c.kind,
				replyToId: c.replyToId ?? null,
				resolvedAt: null,
				createdAt: new Date().toISOString(),
			};
			queryClient.setQueryData<Comment[]>(key, (old) => [
				...(old ?? []),
				optimistic,
			]);
			return { previous, tempId: optimistic.id };
		},
		onError: (e, _c, ctx) => {
			queryClient.setQueryData(key, ctx?.previous);
			toastError(e instanceof Error ? e.message : "Could not post the comment");
		},
		onSuccess: async (saved, c, ctx) => {
			queryClient.setQueryData<Comment[]>(key, (old) =>
				old
					?.filter((x) => x.id !== saved.id)
					.map((x) => (x.id === ctx.tempId ? saved : x))
					.map((x) =>
						x.id === c.replyToId ? { ...x, resolvedAt: saved.createdAt } : x,
					),
			);
			if (c.kind === "answer") {
				queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
				// The answer returns the task to Ready: refetch just this task and patch its card.
				const fresh = (
					await api.GET("/api/tasks/{id}", {
						params: { path: { id: task.id } },
					})
				).data as Task;
				queryClient.setQueryData(queryKeys.tasks.detail(task.id), fresh);
				queryClient.setQueryData<Board>(
					queryKeys.projects.board(task.projectId),
					(board) => board && upsertCard(board, fresh),
				);
			}
		},
	});
}

export function useSaveNote(projectId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (bodyMd: string) => {
			await api.POST("/api/projects/{id}/notes", {
				params: { path: { id: projectId } },
				body: { bodyMd },
			});
		},
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.notes(projectId),
			}),
	});
}
