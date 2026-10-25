import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Actor, ApprovalInboxItem, QuestionInboxItem } from "@/api/types";
import { useCurrentUserId } from "@/lib/currentUser";

export const pendingApprovalsQuery = queryOptions({
	queryKey: queryKeys.approvals.list("pending"),
	queryFn: async () =>
		(
			await api.GET("/api/approvals", {
				params: { query: { state: "pending" } },
			})
		).data ?? [],
});

export const openQuestionsQuery = queryOptions({
	queryKey: queryKeys.questions.list("open"),
	queryFn: async () =>
		(await api.GET("/api/questions", { params: { query: { state: "open" } } }))
			.data ?? [],
});

export type InboxEntry =
	| { type: "approval"; key: string; at: string; item: ApprovalInboxItem }
	| { type: "question"; key: string; at: string; item: QuestionInboxItem };

export const actorName = (actor: Actor) =>
	actor.kind === "agent" ? "Agent" : (actor.name ?? "Someone");

/** Approvals addressed to this user or to anyone; questions go to both humans. */
function isAddressedTo(entry: InboxEntry, userId: number | null) {
	if (entry.type === "question") return true;
	const approver = entry.item.approval.approverUserId;
	return approver === null || approver === userId;
}

export function useInbox(
	{ mine }: { mine: boolean },
	refetchInterval?: number,
) {
	const userId = useCurrentUserId();
	const approvals = useQuery({ ...pendingApprovalsQuery, refetchInterval });
	const questions = useQuery({ ...openQuestionsQuery, refetchInterval });

	const entries: InboxEntry[] = [
		...(approvals.data ?? []).map((item) => ({
			type: "approval" as const,
			key: `a${item.approval.id}`,
			at: item.approval.createdAt,
			item,
		})),
		...(questions.data ?? []).map((item) => ({
			type: "question" as const,
			key: `q${item.question.id}`,
			at: item.question.createdAt,
			item,
		})),
	]
		.filter((entry) => !mine || isAddressedTo(entry, userId))
		.sort((a, b) => b.at.localeCompare(a.at));

	return {
		entries,
		isPending: approvals.isPending || questions.isPending,
		isError: approvals.isError || questions.isError,
		refetch: () => Promise.all([approvals.refetch(), questions.refetch()]),
	};
}
