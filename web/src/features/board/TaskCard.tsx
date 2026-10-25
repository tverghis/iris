import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Bot,
	Ellipsis,
	Hourglass,
	Loader2,
	ShieldQuestion,
} from "lucide-react";
import { memo } from "react";
import type { TaskCard as TaskCardData } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
	/** Opens the "Move to…" sheet for this card. */
	onMenu?: (task: TaskCardData) => void;
}

type CardProps = Omit<Props, "onMenu"> & React.ComponentProps<"button">;

function CardButton({ task, userName, onOpen, className, ...rest }: CardProps) {
	return (
		<button
			type="button"
			data-task-id={task.id}
			onClick={() => onOpen(task.id)}
			{...rest}
			className={cn(
				"flex w-full touch-manipulation select-none flex-col gap-2 rounded-md border bg-card p-3 pr-10 text-left text-sm shadow-xs outline-none [-webkit-touch-callout:none] hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
				className,
			)}
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
}

/** A draggable card; must render inside a SortableContext. */
export const TaskCard = memo(function TaskCard({ onMenu, ...props }: Props) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: props.task.id });
	return (
		<div
			ref={setNodeRef}
			data-task-id={props.task.id}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				"relative [contain-intrinsic-size:auto_76px] [content-visibility:auto]",
				isDragging && "opacity-40",
			)}
		>
			<CardButton
				{...props}
				{...attributes}
				{...listeners}
				data-task-id={undefined}
				ref={setActivatorNodeRef}
				onContextMenu={isDragging ? (e) => e.preventDefault() : undefined}
			/>
			{onMenu && (
				<button
					type="button"
					aria-label={`Move ${props.task.title}…`}
					aria-haspopup="dialog"
					onClick={() => onMenu(props.task)}
					className="absolute top-0 right-0 flex size-10 items-center justify-center rounded-md text-muted-foreground/70 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:size-8"
				>
					<Ellipsis className="size-4" aria-hidden />
				</button>
			)}
		</div>
	);
});

/** The copy that follows the pointer inside the DragOverlay. */
export function TaskCardOverlay(props: Omit<Props, "onMenu">) {
	return (
		<CardButton
			{...props}
			tabIndex={-1}
			onContextMenu={(e) => e.preventDefault()}
			className="cursor-grabbing bg-card"
		/>
	);
}
