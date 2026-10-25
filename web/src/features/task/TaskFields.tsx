import { useState } from "react";
import type { Task, TaskPatch, User } from "@/api/types";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Local draft that resets whenever the saved value changes underneath it. */
function useDraft(value: string) {
	const [prev, setPrev] = useState(value);
	const [draft, setDraft] = useState(value);
	if (prev !== value) {
		setPrev(value);
		setDraft(value);
	}
	return [draft, setDraft] as const;
}

type Save = (patch: TaskPatch) => void;

export function TitleField({ task, save }: { task: Task; save: Save }) {
	const [draft, setDraft] = useDraft(task.title);
	const commit = () => {
		const title = draft.trim();
		if (!title) setDraft(task.title);
		else if (title !== task.title) save({ title });
	};
	return (
		<Input
			aria-label="Title"
			className="border-transparent px-2 text-base font-semibold shadow-none hover:border-input"
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter") e.currentTarget.blur();
			}}
		/>
	);
}

export function DescriptionField({ task, save }: { task: Task; save: Save }) {
	const [draft, setDraft] = useDraft(task.descriptionMd);
	const [preview, setPreview] = useState(false);
	return (
		<div className="flex flex-col gap-2">
			<div className="flex gap-1">
				<Button
					type="button"
					size="sm"
					variant={preview ? "outline" : "default"}
					aria-pressed={!preview}
					onClick={() => setPreview(false)}
				>
					Edit
				</Button>
				<Button
					type="button"
					size="sm"
					variant={preview ? "default" : "outline"}
					aria-pressed={preview}
					onClick={() => setPreview(true)}
				>
					Preview
				</Button>
			</div>
			{preview ? (
				draft.trim() ? (
					<Markdown>{draft}</Markdown>
				) : (
					<p className="text-sm text-muted-foreground">Nothing to preview.</p>
				)
			) : (
				<Textarea
					aria-label="Description"
					rows={6}
					placeholder="Describe the task (Markdown)"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={() => {
						if (draft !== task.descriptionMd) save({ descriptionMd: draft });
					}}
				/>
			)}
		</div>
	);
}

export function AssigneeFields({
	task,
	users,
	save,
}: {
	task: Task;
	users: User[];
	save: Save;
}) {
	const value =
		task.assigneeKind === "human" && task.assigneeUserId !== null
			? `user:${task.assigneeUserId}`
			: task.assigneeKind;
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="task-assignee">Assignee</Label>
				<select
					id="task-assignee"
					className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					value={value}
					onChange={(e) => {
						const v = e.target.value;
						if (v.startsWith("user:")) {
							save({
								assigneeKind: "human",
								assigneeUserId: Number(v.slice(5)),
							});
						} else {
							save({
								assigneeKind: v as "none" | "agent",
								assigneeUserId: null,
							});
						}
					}}
				>
					<option value="none">Nobody</option>
					{users.map((u) => (
						<option key={u.id} value={`user:${u.id}`}>
							{u.name}
						</option>
					))}
					<option value="agent">Agent</option>
				</select>
			</div>
			{task.assigneeKind === "agent" && (
				<div className="flex items-center gap-2">
					<Checkbox
						id="task-signoff"
						checked={task.requireSignOff}
						onCheckedChange={(checked) =>
							save({ requireSignOff: checked === true })
						}
					/>
					<Label htmlFor="task-signoff">Require sign-off</Label>
				</div>
			)}
		</div>
	);
}
