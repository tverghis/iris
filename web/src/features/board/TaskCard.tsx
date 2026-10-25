import { Bot, Hourglass, Loader2, ShieldQuestion } from "lucide-react";
import { memo } from "react";
import type { TaskCard as TaskCardData } from "@/api/types";
import { Badge } from "@/components/ui/badge";

function initials(name: string | undefined) {
	const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
	if (!parts.length) return "?";
	return parts
		.slice(0, 2)
		.map((p) => p[0])
		.join("")
		.toUpperCase();
}

function Assignee({
	task,
	userName,
}: {
	task: TaskCardData;
	userName: string | undefined;
}) {
	if (task.assigneeKind === "agent") {
		return (
			<span
				role="img"
				aria-label="Assigned to agent"
				className="inline-flex size-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
			>
				<Bot className="size-3.5" aria-hidden />
			</span>
		);
	}
	if (task.assigneeKind === "human") {
		return (
			<span
				role="img"
				aria-label={`Assigned to ${userName ?? "a person"}`}
				className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
			>
				{initials(userName)}
			</span>
		);
	}
	return null;
}

interface Props {
	task: TaskCardData;
	/** Display name of the human assignee, if known. */
	userName?: string;
	onOpen: (taskId: number) => void;
}

export const TaskCard = memo(function TaskCard({
	task,
	userName,
	onOpen,
}: Props) {
	return (
		<button
			type="button"
			data-task-id={task.id}
			onClick={() => onOpen(task.id)}
			className="flex w-full flex-col gap-2 rounded-md border bg-card p-3 text-left text-sm shadow-xs outline-none [contain-intrinsic-size:auto_76px] [content-visibility:auto] hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<span className="break-words font-medium">{task.title}</span>
			<span className="flex flex-wrap items-center gap-1.5">
				<Assignee task={task} userName={userName} />
				{task.running && (
					<Badge variant="secondary">
						<Loader2 className="animate-spin" aria-hidden />
						Running
					</Badge>
				)}
				{task.waitingOn > 0 && (
					<Badge variant="outline">
						<Hourglass aria-hidden />
						Waiting on {task.waitingOn}
					</Badge>
				)}
				{task.pendingApproval && (
					<Badge variant="default">
						<ShieldQuestion aria-hidden />
						Approval
					</Badge>
				)}
			</span>
		</button>
	);
});
