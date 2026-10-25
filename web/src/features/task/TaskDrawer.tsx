import { type ReactNode, useState } from "react";
import { useSearchParams } from "wouter";
import { ApiError } from "@/api/client";
import type { Task } from "@/api/types";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { COLUMN_TITLES } from "@/features/board/boardModel";
import { useUsers } from "@/features/board/useBoard";
import { relativeTime } from "@/features/inbox/relativeTime";
import { DependencyPicker } from "./DependencyPicker";
import { AssigneeFields, DescriptionField, TitleField } from "./TaskFields";
import { useDeleteTask, useTask, useUpdateTask } from "./useTask";

export function DrawerSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
			{children}
		</section>
	);
}

function TaskBody({ task, onClose }: { task: Task; onClose: () => void }) {
	const { data: users } = useUsers();
	const update = useUpdateTask(task);
	const del = useDeleteTask(task, onClose);
	const [confirming, setConfirming] = useState(false);
	const save = update.mutate;
	const creator =
		task.createdBy.kind === "user"
			? (task.createdBy.name ?? "a person")
			: task.createdBy.kind;

	return (
		<>
			<SheetHeader className="pr-10">
				<SheetTitle className="sr-only">Task</SheetTitle>
				<TitleField task={task} save={save} />
				<SheetDescription className="px-2">
					{COLUMN_TITLES[task.status]} · created by {creator}{" "}
					{relativeTime(task.createdAt)} · updated{" "}
					{relativeTime(task.updatedAt)}
				</SheetDescription>
			</SheetHeader>
			<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
				<DrawerSection title="Description">
					<DescriptionField task={task} save={save} />
				</DrawerSection>
				<DrawerSection title="Assignment">
					<AssigneeFields task={task} users={users ?? []} save={save} />
				</DrawerSection>
				<DrawerSection title="Dependencies">
					<DependencyPicker task={task} />
				</DrawerSection>
				<DrawerSection title="Output">
					{task.outputMd.trim() ? (
						<Markdown>{task.outputMd}</Markdown>
					) : (
						<p className="text-sm text-muted-foreground">No output yet</p>
					)}
				</DrawerSection>
				{/* Slots for later work: Comments (#18), Approvals (#20), Runs (#29). */}
				<div data-slot="task-drawer-sections" />
				<div>
					<Button
						type="button"
						variant="outline"
						onClick={() => setConfirming(true)}
					>
						Delete task
					</Button>
				</div>
			</div>
			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this task?</DialogTitle>
						<DialogDescription>
							“{task.title}” and its comments, approvals and runs will be
							removed. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirming(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={del.isPending}
							onClick={() =>
								del.mutate(undefined, {
									onSettled: () => setConfirming(false),
								})
							}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

export default function TaskDrawer({
	projectId,
	rawId,
}: {
	projectId: number;
	rawId: string;
}) {
	const [, setParams] = useSearchParams();
	const id = /^\d+$/.test(rawId) ? Number(rawId) : null;
	const { data: task, error, isPending } = useTask(id);
	const close = () =>
		setParams(
			(prev) => {
				prev.delete("task");
				return prev;
			},
			{ replace: true },
		);
	const missing =
		id === null ||
		(task && task.projectId !== projectId) ||
		(error instanceof ApiError && error.status === 404);

	return (
		<Sheet open onOpenChange={(open) => !open && close()}>
			<SheetContent className="w-full sm:w-[560px] sm:max-w-[560px]">
				{task && !missing ? (
					<TaskBody task={task} onClose={close} />
				) : (
					<SheetHeader>
						<SheetTitle>
							{missing
								? "Task not found"
								: error
									? "Could not load task"
									: "Loading…"}
						</SheetTitle>
						<SheetDescription>
							{missing
								? "It may have been deleted."
								: isPending
									? ""
									: "Try again in a moment."}
						</SheetDescription>
					</SheetHeader>
				)}
			</SheetContent>
		</Sheet>
	);
}
