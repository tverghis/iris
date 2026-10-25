import { useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import type { BoardColumn as BoardColumnData } from "@/api/types";
import { Button } from "@/components/ui/button";
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
}

export function BoardColumn({
	projectId,
	column,
	userNames,
	onOpenTask,
}: Props) {
	const { status } = column;
	const title = COLUMN_TITLES[status];
	const [limit, setLimit] = useState(DONE_PAGE_SIZE);
	const isDone = status === "done";
	const tasks = isDone ? sortDone(column.tasks) : column.tasks;
	const visible = isDone ? tasks.slice(0, limit) : tasks;
	const { setNodeRef } = useDroppable({ id: columnDropId(status) });

	return (
		<section
			ref={setNodeRef}
			aria-label={title}
			data-status={status}
			className="flex max-h-full w-72 shrink-0 flex-col rounded-lg bg-muted/50 max-md:w-64"
		>
			<h2 className="flex items-center justify-between px-3 pt-3 pb-2 text-sm font-semibold">
				{title}
				<span className="text-xs font-normal text-muted-foreground">
					{tasks.length}
				</span>
			</h2>
			{(status === "backlog" || status === "ready") && (
				<div className="px-2 pb-2">
					<QuickAdd projectId={projectId} status={status} label={title} />
				</div>
			)}
			<div
				data-column-scroll
				className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-2"
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
