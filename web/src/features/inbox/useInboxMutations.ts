import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type {
	ApprovalDecision,
	ApprovalInboxItem,
	QuestionInboxItem,
} from "@/api/types";
import { saveNoteAfterAnswer } from "@/features/context/hooks";
import { openQuestionsQuery, pendingApprovalsQuery } from "./useInbox";

const MUTATION_KEY = ["inbox"] as const;

/** Drops one item from a cached list and returns the old list for rollback. */
async function removeFromList<T>(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	isTarget: (item: T) => boolean,
) {
	await queryClient.cancelQueries({ queryKey });
	const previous = queryClient.getQueryData<T[]>(queryKey);
	queryClient.setQueryData<T[]>(queryKey, (list) =>
		list?.filter((item) => !isTarget(item)),
	);
	return { previous };
}

function refresh(queryClient: QueryClient) {
	// Refetch once the last in-flight inbox action settles, so an earlier
	// response cannot briefly bring back an item that is still being removed.
	if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) > 1) return;
	for (const queryKey of [
		queryKeys.approvals.all,
		queryKeys.questions.all,
		queryKeys.projects.all, // list counts, boards, notes
		queryKeys.tasks.all, // details, comments and approvals of every touched task
	]) {
		queryClient.invalidateQueries({ queryKey });
	}
}

export function useDecideApproval() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...MUTATION_KEY, "decide"],
		mutationFn: (vars: {
			item: ApprovalInboxItem;
			decision: ApprovalDecision["decision"];
			comment?: string;
		}) =>
			api.POST("/api/approvals/{id}/decide", {
				params: { path: { id: vars.item.approval.id } },
				body: {
					decision: vars.decision,
					comment: vars.comment?.trim() || undefined,
				},
			}),
		onMutate: ({ item }) =>
			removeFromList<ApprovalInboxItem>(
				queryClient,
				pendingApprovalsQuery.queryKey,
				(i) => i.approval.id === item.approval.id,
			),
		onError: (_error, _vars, context) =>
			queryClient.setQueryData(
				pendingApprovalsQuery.queryKey,
				context?.previous,
			),
		onSettled: () => refresh(queryClient),
	});
}

export function useAnswerQuestion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...MUTATION_KEY, "answer"],
		mutationFn: async (vars: {
			item: QuestionInboxItem;
			bodyMd: string;
			saveAsNote: boolean;
		}) => {
			const { item, bodyMd } = vars;
			await api.POST("/api/tasks/{id}/comments", {
				params: { path: { id: item.task.id } },
				body: { kind: "answer", replyToId: item.question.id, bodyMd },
			});
			if (vars.saveAsNote) await saveNoteAfterAnswer(item.project.id, bodyMd);
		},
		onMutate: ({ item }) =>
			removeFromList<QuestionInboxItem>(
				queryClient,
				openQuestionsQuery.queryKey,
				(i) => i.question.id === item.question.id,
			),
		onError: (_error, _vars, context) =>
			queryClient.setQueryData(openQuestionsQuery.queryKey, context?.previous),
		onSettled: () => refresh(queryClient),
	});
}
