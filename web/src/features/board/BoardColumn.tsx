import { useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type {
	BoardColumn as BoardColumnData,
	TaskCard as TaskCardData,
} from "@/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	COLUMN_TITLES,
	columnDropId,
	DONE_PAGE_SIZE,
	sortDone,
} from "./boardModel";
import { QuickAdd } from "./QuickAdd";
import { TaskCard } from "./TaskCard";

interface Props {
	projectId: number;
	column: BoardColumnData;
	userNames: ReadonlyMap<number, string>;
	onOpenTask: (taskId: number) => void;
	onMenuTask?: (task: TaskCardData) => void;
	/** Stacked mobile layout: the header becomes a toggle for the section. */
	collapsible?: boolean;
	collapsed?: boolean;
	onToggleCollapsed?: (status: BoardColumnData["status"]) => void;
}

export function BoardColumn({
	projectId,
	column,
	userNames,
	onOpenTask,
	onMenuTask,
	collapsible = false,
	collapsed = false,
	onToggleCollapsed,
}: Props) {
	const { status } = column;
	const title = COLUMN_TITLES[status];
	const [limit, setLimit] = useState(DONE_PAGE_SIZE);
	const isDone = status === "done";
	const tasks = isDone ? sortDone(column.tasks) : column.tasks;
	const visible = isDone ? tasks.slice(0, limit) : tasks;
	const { setNodeRef, isOver } = useDroppable({ id: columnDropId(status) });
	const isCollapsed = collapsible && collapsed;

	return (
		<section
			ref={setNodeRef}
			aria-label={title}
			data-status={status}
			className={cn(
				"flex w-full flex-col rounded-lg bg-muted/50 md:max-h-full md:min-w-[13rem] md:flex-1",
				isOver && isCollapsed && "ring-2 ring-ring",
			)}
		>
			<h2 className="text-sm font-semibold">
				{collapsible ? (
					<button
						type="button"
						aria-expanded={!isCollapsed}
						onClick={() => onToggleCollapsed?.(status)}
						className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<span className="flex items-center gap-1.5">
							<ChevronDown
								aria-hidden
								className={cn("size-4", isCollapsed && "-rotate-90")}
							/>
							{title}
						</span>
						<span className="text-xs font-normal text-muted-foreground">
							{tasks.length}
						</span>
					</button>
				) : (
					<div className="flex items-center justify-between px-3 pt-3 pb-2">
						{title}
						<span className="text-xs font-normal text-muted-foreground">
							{tasks.length}
						</span>
					</div>
				)}
			</h2>
			{!isCollapsed && (status === "backlog" || status === "ready") && (
				<div className="px-2 pb-2">
					<QuickAdd projectId={projectId} status={status} label={title} />
				</div>
			)}
			<div
				data-column-scroll
				hidden={isCollapsed}
				className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 md:overflow-y-auto md:overscroll-contain"
			>
				<SortableContext
					items={visible.map((t) => t.id)}
					strategy={verticalListSortingStrategy}
				>
					{visible.map((task) => (
						<TaskCard
							key={task.id}
							task={task}
							userName={
								task.assigneeUserId === null
									? undefined
									: userNames.get(task.assigneeUserId)
							}
							onOpen={onOpenTask}
							onMenu={onMenuTask}
						/>
					))}
				</SortableContext>
				{isDone && tasks.length > limit && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setLimit((n) => n + DONE_PAGE_SIZE)}
					>
						Show more
					</Button>
				)}
			</div>
		</section>
	);
}
