import type { ApprovalDecision, ApprovalKind, TaskStatus } from "@/api/types";

export type Decision = ApprovalDecision["decision"];

/** Where a task goes after a decision (spec: Approvals). */
export function statusAfterDecision(
	kind: ApprovalKind,
	decision: Decision,
): TaskStatus {
	if (decision === "approved") return kind === "sign_off" ? "done" : "ready";
	return decision === "changes_requested" ? "ready" : "backlog";
}

export const KIND_LABELS: Record<ApprovalKind, string> = {
	sign_off: "Sign-off",
	proceed: "Proceed",
};

export const STATE_LABELS = {
	pending: "Pending",
	approved: "Approved",
	changes_requested: "Changes requested",
	rejected: "Rejected",
	cancelled: "Cancelled",
} as const;
