import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type {
	Approval,
	ApprovalCreate,
	Board,
	Task,
	TaskStatus,
	User,
} from "@/api/types";
import {
	changeCard,
	combine,
	patchTaskDetail,
	type Undo,
} from "@/features/board/optimisticCard";
import { getCurrentUserId } from "@/lib/currentUser";
import { toastError } from "@/lib/toast";
import { type Decision, statusAfterDecision } from "./decisions";

export function useTaskApprovals(taskId: number) {
	return useQuery({
		queryKey: queryKeys.tasks.approvals(taskId),
		queryFn: async () =>
			(
				await api.GET("/api/tasks/{id}/approvals", {
					params: { path: { id: taskId } },
				})
			).data ?? [],
	});
}

/** Id of the approval shown while the request is still on its way. */
export const PENDING_REQUEST_ID = -1;

async function cancelRelated(queryClient: QueryClient, task: Task) {
	await Promise.all(
		[
			queryKeys.projects.board(task.projectId),
			queryKeys.tasks.detail(task.id),
			queryKeys.tasks.approvals(task.id),
		].map((queryKey) => queryClient.cancelQueries({ queryKey })),
	);
}

/** Moves the card to the bottom of `status` and patches card and detail fields. */
function placeTask(
	queryClient: QueryClient,
	task: Task,
	status: TaskStatus,
	patch: Partial<Task>,
): Undo {
	const board = queryClient.getQueryData<Board>(
		queryKeys.projects.board(task.projectId),
	);
	const last = board?.columns
		.find((c) => c.status === status)
		?.tasks.filter((t) => t.id !== task.id)
		.at(-1);
	return combine(
		changeCard(queryClient, task.projectId, task.id, {
			status,
			afterTaskId: last?.id ?? null,
			fields:
				patch.pendingApproval === undefined
					? undefined
					: { pendingApproval: patch.pendingApproval },
		}),
		patchTaskDetail(queryClient, task.id, {
			...patch,
			status,
			doneAt: status === "done" ? new Date().toISOString() : null,
		}),
	);
}

/** Changes one entry of the task's approval history; the undo puts back only that entry. */
function patchApproval(
	queryClient: QueryClient,
	taskId: number,
	approvalId: number,
	change: (approval: Approval) => Approval,
): Undo {
	const key = queryKeys.tasks.approvals(taskId);
	const before = queryClient
		.getQueryData<Approval[]>(key)
		?.find((a) => a.id === approvalId);
	if (!before) return () => {};
	queryClient.setQueryData<Approval[]>(key, (list) =>
		list?.map((a) => (a.id === approvalId ? change(a) : a)),
	);
	return () =>
		queryClient.setQueryData<Approval[]>(key, (list) =>
			list?.map((a) => (a.id === approvalId ? before : a)),
		);
}

/** Reconciles with the server: one task, its board and the lists that count it. */
function reconcile(queryClient: QueryClient, task: Task) {
	for (const queryKey of [
		queryKeys.tasks.detail(task.id),
		queryKeys.projects.board(task.projectId),
		queryKeys.projects.lists,
		queryKeys.tasks.approvals(task.id),
		queryKeys.approvals.all,
	]) {
		queryClient.invalidateQueries({ queryKey });
	}
}

export function useDecideTaskApproval(task: Task) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (vars: {
			approval: Approval;
			decision: Decision;
			comment: string;
		}) =>
			api.POST("/api/approvals/{id}/decide", {
				params: { path: { id: vars.approval.id } },
				body: {
					decision: vars.decision,
					comment: vars.comment.trim() || undefined,
				},
			}),
		meta: { silent: true },
		onMutate: async ({ approval, decision, comment }) => {
			await cancelRelated(queryClient, task);
			const status = statusAfterDecision(approval.kind, decision);
			const undoTask = placeTask(queryClient, task, status, {
				pendingApproval: null,
				...(decision === "approved" && approval.kind === "sign_off"
					? { outputMd: approval.payloadMd }
					: {}),
			});
			const undoApproval = patchApproval(
				queryClient,
				task.id,
				approval.id,
				(a) => ({
					...a,
					state: decision,
					decisionComment: comment.trim() || null,
					decidedAt: new Date().toISOString(),
				}),
			);
			return { undo: combine(undoTask, undoApproval) };
		},
		onError: (error, _vars, ctx) => {
			ctx?.undo();
			toastError(error.message || "Could not record the decision");
		},
		onSettled: () => reconcile(queryClient, task),
	});
}

export function useRequestApproval(task: Task) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: ApprovalCreate) =>
			(
				await api.POST("/api/tasks/{id}/approvals", {
					params: { path: { id: task.id } },
					body,
				})
			).data as Approval,
		meta: { silent: true },
		onMutate: async (body) => {
			await cancelRelated(queryClient, task);
			const key = queryKeys.tasks.approvals(task.id);
			const requester = queryClient
				.getQueryData<User[]>(queryKeys.users)
				?.find((u) => u.id === getCurrentUserId());
			const placeholder: Approval = {
				id: PENDING_REQUEST_ID,
				taskId: task.id,
				runId: null,
				kind: body.kind,
				requestedBy: {
					kind: "user",
					name: requester?.name,
					userId: requester?.id,
				},
				approverUserId: body.approverUserId ?? null,
				summary: body.summary,
				payloadMd: body.payloadMd ?? "",
				state: "pending",
				decidedBy: null,
				decisionComment: null,
				createdAt: new Date().toISOString(),
				decidedAt: null,
			};
			queryClient.setQueryData<Approval[]>(
				key,
				(list) => list && [placeholder, ...list],
			);
			const undoTask = placeTask(queryClient, task, "needs_approval", {
				pendingApproval: {
					id: PENDING_REQUEST_ID,
					kind: body.kind,
					approverUserId: body.approverUserId ?? null,
				},
			});
			return {
				undo: combine(undoTask, () =>
					queryClient.setQueryData<Approval[]>(key, (list) =>
						list?.filter((a) => a.id !== PENDING_REQUEST_ID),
					),
				),
			};
		},
		onSuccess: (approval) => {
			// Swap the placeholder for the real approval so the panel never blinks.
			queryClient.setQueryData<Approval[]>(
				queryKeys.tasks.approvals(task.id),
				(list) =>
					list?.map((a) => (a.id === PENDING_REQUEST_ID ? approval : a)),
			);
			const ref = {
				id: approval.id,
				kind: approval.kind,
				approverUserId: approval.approverUserId,
			};
			patchTaskDetail(queryClient, task.id, { pendingApproval: ref });
			changeCard(queryClient, task.projectId, task.id, {
				fields: { pendingApproval: ref },
			});
		},
		onError: (error, _vars, ctx) => {
			ctx?.undo();
			toastError(error.message || "Could not request approval");
		},
		onSettled: () => reconcile(queryClient, task),
	});
}
