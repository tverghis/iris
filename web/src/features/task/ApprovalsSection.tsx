import { useId, useState } from "react";
import type { Approval, Task, User } from "@/api/types";
import { Markdown } from "@/components/Markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DecisionForm } from "@/features/approvals/DecisionForm";
import { KIND_LABELS, STATE_LABELS } from "@/features/approvals/decisions";
import {
	useDecideTaskApproval,
	useRequestApproval,
	useTaskApprovals,
} from "@/features/approvals/useTaskApprovals";
import { useUsers } from "@/features/board/useBoard";
import { actorName } from "@/features/inbox/useInbox";
import { relativeTime } from "@/lib/relativeTime";
import { DrawerSection } from "./TaskDrawer";

const addressee = (approval: Approval, users: User[]) =>
	approval.approverUserId === null
		? "any human"
		: (users.find((u) => u.id === approval.approverUserId)?.name ??
			"a specific person");

function Payload({ approval }: { approval: Approval }) {
	return approval.payloadMd.trim() ? (
		<Markdown>{approval.payloadMd}</Markdown>
	) : null;
}

function PendingPanel({
	task,
	approval,
	users,
}: {
	task: Task;
	approval: Approval;
	users: User[];
}) {
	const decide = useDecideTaskApproval(task);
	return (
		<div
			className="flex flex-col gap-3 rounded-lg border border-primary/40 p-3"
			data-testid="pending-approval"
		>
			<div className="flex flex-wrap items-center gap-2">
				<Badge>{KIND_LABELS[approval.kind]}</Badge>
				<span className="text-xs text-muted-foreground">
					requested by {actorName(approval.requestedBy)}{" "}
					{relativeTime(approval.createdAt)} · for {addressee(approval, users)}
				</span>
			</div>
			<p className="break-words text-sm font-medium">{approval.summary}</p>
			<Payload approval={approval} />
			<DecisionForm
				onDecide={(decision, comment) =>
					decide.mutate({ approval, decision, comment })
				}
			/>
		</div>
	);
}

function RequestForm({ task, users }: { task: Task; users: User[] }) {
	const [open, setOpen] = useState(false);
	const [kind, setKind] = useState<"sign_off" | "proceed">("sign_off");
	const [summary, setSummary] = useState("");
	const [payload, setPayload] = useState(task.outputMd);
	const [approver, setApprover] = useState("");
	const request = useRequestApproval(task);
	const ids = [useId(), useId(), useId(), useId()];
	const fieldClass =
		"h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

	if (!open) {
		return (
			<div>
				<Button type="button" variant="outline" onClick={() => setOpen(true)}>
					Request approval
				</Button>
			</div>
		);
	}

	return (
		<form
			className="flex flex-col gap-3 rounded-lg border p-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (!summary.trim()) return;
				request.mutate({
					kind,
					summary: summary.trim(),
					payloadMd: payload,
					approverUserId: approver ? Number(approver) : null,
				});
				setOpen(false);
				setSummary("");
			}}
		>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={ids[0]}>Kind</Label>
				<select
					id={ids[0]}
					className={fieldClass}
					value={kind}
					onChange={(e) => setKind(e.target.value as typeof kind)}
				>
					<option value="sign_off">
						Sign-off (result is done if approved)
					</option>
					<option value="proceed">Proceed (back to Ready if approved)</option>
				</select>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={ids[1]}>Summary</Label>
				<Textarea
					id={ids[1]}
					rows={2}
					value={summary}
					onChange={(e) => setSummary(e.target.value)}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={ids[2]}>Details (Markdown)</Label>
				<Textarea
					id={ids[2]}
					rows={5}
					value={payload}
					onChange={(e) => setPayload(e.target.value)}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={ids[3]}>Approver</Label>
				<select
					id={ids[3]}
					className={fieldClass}
					value={approver}
					onChange={(e) => setApprover(e.target.value)}
				>
					<option value="">Any human</option>
					{users.map((u) => (
						<option key={u.id} value={u.id}>
							{u.name}
						</option>
					))}
				</select>
			</div>
			<div className="flex gap-2">
				<Button type="submit" disabled={!summary.trim() || request.isPending}>
					Send for approval
				</Button>
				<Button type="button" variant="outline" onClick={() => setOpen(false)}>
					Cancel
				</Button>
			</div>
		</form>
	);
}

function HistoryItem({
	approval,
	users,
}: {
	approval: Approval;
	users: User[];
}) {
	return (
		<li className="flex flex-col gap-1 rounded-md border p-3 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary">{KIND_LABELS[approval.kind]}</Badge>
				<Badge variant="outline">{STATE_LABELS[approval.state]}</Badge>
			</div>
			<p className="break-words font-medium">{approval.summary}</p>
			<p className="text-xs text-muted-foreground">
				Requested by {actorName(approval.requestedBy)} for{" "}
				{addressee(approval, users)}{" "}
				<time dateTime={approval.createdAt}>
					{relativeTime(approval.createdAt)}
				</time>
				{approval.decidedAt && (
					<>
						{" "}
						· {STATE_LABELS[approval.state].toLowerCase()}
						{approval.decidedBy && ` by ${actorName(approval.decidedBy)}`}{" "}
						<time dateTime={approval.decidedAt}>
							{relativeTime(approval.decidedAt)}
						</time>
					</>
				)}
			</p>
			{approval.decisionComment && (
				<p className="whitespace-pre-wrap break-words">
					“{approval.decisionComment}”
				</p>
			)}
			{approval.payloadMd.trim() && (
				<details>
					<summary className="cursor-pointer text-xs text-muted-foreground">
						Show details
					</summary>
					<div className="mt-2">
						<Payload approval={approval} />
					</div>
				</details>
			)}
		</li>
	);
}

export function ApprovalsSection({ task }: { task: Task }) {
	const { data: users } = useUsers();
	const { data: history } = useTaskApprovals(task.id);
	const userList = users ?? [];
	const pending = task.pendingApproval
		? history?.find(
				(a) => a.id === task.pendingApproval?.id && a.state === "pending",
			)
		: undefined;
	const past = (history ?? []).filter((a) => a !== pending);

	return (
		<DrawerSection title="Approvals">
			{pending && (
				<PendingPanel task={task} approval={pending} users={userList} />
			)}
			{!task.pendingApproval && task.status !== "done" && (
				<RequestForm key={task.id} task={task} users={userList} />
			)}
			{past.length > 0 ? (
				<ul className="flex flex-col gap-2" aria-label="Approval history">
					{past.map((a) => (
						<HistoryItem key={a.id} approval={a} users={userList} />
					))}
				</ul>
			) : (
				!pending &&
				history && (
					<p className="text-sm text-muted-foreground">No approvals yet</p>
				)
			)}
		</DrawerSection>
	);
}
