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
} from "@/api/types";
import { moveTaskInColumns } from "@/features/board/boardModel";
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

interface Snapshot {
	board?: Board;
	task?: Task;
	history?: Approval[];
}

async function snapshot(queryClient: QueryClient, task: Task) {
	const keys = [
		queryKeys.projects.board(task.projectId),
		queryKeys.tasks.detail(task.id),
		queryKeys.tasks.approvals(task.id),
	];
	await Promise.all(
		keys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
	);
	return {
		board: queryClient.getQueryData<Board>(keys[0]),
		task: queryClient.getQueryData<Task>(keys[1]),
		history: queryClient.getQueryData<Approval[]>(keys[2]),
	} satisfies Snapshot;
}

function restore(queryClient: QueryClient, task: Task, saved?: Snapshot) {
	if (!saved) return;
	queryClient.setQueryData(
		queryKeys.projects.board(task.projectId),
		saved.board,
	);
	queryClient.setQueryData(queryKeys.tasks.detail(task.id), saved.task);
	queryClient.setQueryData(queryKeys.tasks.approvals(task.id), saved.history);
}

/** Moves the card to the bottom of `status` and patches card and detail fields. */
function placeTask(
	queryClient: QueryClient,
	task: Task,
	status: TaskStatus,
	patch: Partial<Task>,
) {
	const now = new Date().toISOString();
	queryClient.setQueryData<Board>(
		queryKeys.projects.board(task.projectId),
		(board) => {
			if (!board) return board;
			const target = board.columns.find((c) => c.status === status);
			const last = target?.tasks.filter((t) => t.id !== task.id).at(-1);
			const columns = moveTaskInColumns(
				board.columns,
				task.id,
				status,
				last?.id ?? null,
			).map((c) => ({
				...c,
				tasks: c.tasks.map((t) =>
					t.id === task.id
						? {
								...t,
								pendingApproval:
									patch.pendingApproval === undefined
										? t.pendingApproval
										: patch.pendingApproval,
								updatedAt: now,
							}
						: t,
				),
			}));
			return { ...board, columns };
		},
	);
	queryClient.setQueryData<Task>(
		queryKeys.tasks.detail(task.id),
		(t) =>
			t && {
				...t,
				...patch,
				status,
				doneAt: status === "done" ? now : null,
				updatedAt: now,
			},
	);
}

/** Reconciles with the server: one task and one board, not every project cache. */
function reconcile(queryClient: QueryClient, task: Task) {
	for (const queryKey of [
		queryKeys.tasks.detail(task.id),
		queryKeys.projects.board(task.projectId),
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
			const saved = await snapshot(queryClient, task);
			const status = statusAfterDecision(approval.kind, decision);
			placeTask(queryClient, task, status, {
				pendingApproval: null,
				...(decision === "approved" && approval.kind === "sign_off"
					? { outputMd: approval.payloadMd }
					: {}),
			});
			queryClient.setQueryData<Approval[]>(
				queryKeys.tasks.approvals(task.id),
				(list) =>
					list?.map((a) =>
						a.id === approval.id
							? {
									...a,
									state: decision,
									decisionComment: comment.trim() || null,
									decidedAt: new Date().toISOString(),
								}
							: a,
					),
			);
			return saved;
		},
		onError: (error, _vars, saved) => {
			restore(queryClient, task, saved);
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
			const saved = await snapshot(queryClient, task);
			placeTask(queryClient, task, "needs_approval", {
				pendingApproval: {
					id: -1,
					kind: body.kind,
					approverUserId: body.approverUserId ?? null,
				},
			});
			return saved;
		},
		onError: (error, _vars, saved) => {
			restore(queryClient, task, saved);
			toastError(error.message || "Could not request approval");
		},
		onSettled: () => reconcile(queryClient, task),
	});
}
