import { Pin, PinOff } from "lucide-react";
import { useState } from "react";
import type { Note } from "@/api/types";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/lib/relativeTime";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "./hooks";

function AddNote({ projectId }: { projectId: number }) {
	const [text, setText] = useState("");
	const create = useCreateNote(projectId);
	const empty = !text.trim();

	const submit = () => {
		if (empty || create.isPending) return;
		create.mutate({ bodyMd: text }, { onSuccess: () => setText("") });
	};

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
			className="space-y-2"
		>
			<Textarea
				aria-label="New note"
				placeholder="Add a note, e.g. a fact worth remembering"
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						submit();
					}
				}}
			/>
			<Button type="submit" size="sm" disabled={empty || create.isPending}>
				Add note
			</Button>
		</form>
	);
}

function NoteItem({ note }: { note: Note }) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(note.bodyMd);
	const update = useUpdateNote(note.projectId);
	const remove = useDeleteNote(note.projectId);
	const author =
		note.author.kind === "agent"
			? "Agent"
			: (note.author.name ?? note.author.kind);

	const saveEdit = () => {
		if (!draft.trim()) return;
		if (draft !== note.bodyMd) update.mutate({ id: note.id, bodyMd: draft });
		setEditing(false);
	};

	return (
		<li className="rounded-md border p-3" data-pinned={note.pinned}>
			<div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
				{note.pinned && <Pin className="size-3" aria-label="Pinned" />}
				<span className="font-medium text-foreground">{author}</span>
				<time dateTime={note.createdAt} title={note.createdAt}>
					{relativeTime(note.createdAt)}
				</time>
			</div>
			<div className="mt-2">
				{editing ? (
					<div className="space-y-2">
						<Textarea
							aria-label="Edit note"
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							autoFocus
						/>
						<div className="flex gap-2">
							<Button size="sm" onClick={saveEdit} disabled={!draft.trim()}>
								Save note
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => {
									setDraft(note.bodyMd);
									setEditing(false);
								}}
							>
								Cancel
							</Button>
						</div>
					</div>
				) : (
					<Markdown>{note.bodyMd}</Markdown>
				)}
			</div>
			{!editing && (
				<div className="mt-2 flex gap-1">
					<Button
						size="sm"
						variant="ghost"
						onClick={() => update.mutate({ id: note.id, pinned: !note.pinned })}
					>
						{note.pinned ? (
							<PinOff aria-hidden className="size-4" />
						) : (
							<Pin aria-hidden className="size-4" />
						)}
						{note.pinned ? "Unpin" : "Pin"}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							setDraft(note.bodyMd);
							setEditing(true);
						}}
					>
						Edit
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							if (window.confirm("Delete this note?")) remove.mutate(note.id);
						}}
					>
						Delete
					</Button>
				</div>
			)}
		</li>
	);
}

export function NotesList({ projectId }: { projectId: number }) {
	const { data: notes, isPending } = useNotes(projectId);

	return (
		<section aria-labelledby="notes-h" className="min-w-0 space-y-3">
			<h2 id="notes-h" className="text-base font-semibold">
				Notes
			</h2>
			<AddNote projectId={projectId} />
			{isPending ? (
				<p className="text-sm text-muted-foreground">Loading notes…</p>
			) : notes?.length ? (
				<ul className="space-y-2">
					{notes.map((note) => (
						<NoteItem key={note.id} note={note} />
					))}
				</ul>
			) : (
				<p className="text-sm text-muted-foreground">No notes yet.</p>
			)}
		</section>
	);
}
