import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Comment, Task } from "@/api/types";
import { saveNoteAfterAnswer } from "@/features/context/hooks";
import { getCurrentUserId } from "@/lib/currentUser";
import { toastError } from "@/lib/toast";
import { refreshTask } from "./useTask";

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
	/** Also keep the text as a project note (answers only). */
	saveAsNote?: boolean;
};

let tempId = 0;

export function usePostComment(task: Task, authorName: string | undefined) {
	const queryClient = useQueryClient();
	const key = queryKeys.tasks.comments(task.id);
	return useMutation({
		mutationFn: async (c: NewComment) => {
			const saved = (
				await api.POST("/api/tasks/{id}/comments", {
					params: { path: { id: task.id } },
					body: { kind: c.kind, bodyMd: c.bodyMd, replyToId: c.replyToId },
				})
			).data as Comment;
			if (c.saveAsNote) await saveNoteAfterAnswer(task.projectId, c.bodyMd);
			return saved;
		},
		meta: { silent: true },
		onMutate: async (c) => {
			await queryClient.cancelQueries({ queryKey: key });
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
			return { tempId: optimistic.id };
		},
		onError: (e, _c, ctx) => {
			// Drop only the placeholder; the list may have changed since.
			queryClient.setQueryData<Comment[]>(key, (old) =>
				old?.filter((x) => x.id !== ctx?.tempId),
			);
			toastError(e instanceof Error ? e.message : "Could not post the comment");
		},
		onSuccess: (saved, c, ctx) => {
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
				// The answer returns the task to Ready; the card follows.
				void refreshTask(queryClient, task.projectId, task.id);
			}
		},
		onSettled: (_data, _error, c) => {
			if (c.saveAsNote) {
				queryClient.invalidateQueries({
					queryKey: queryKeys.projects.notes(task.projectId),
				});
			}
		},
	});
}
