import { useRef, useState } from "react";
import type { Comment, Task } from "@/api/types";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUsers } from "@/features/board/useBoard";
import { useCurrentUserId } from "@/lib/currentUser";
import { relativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import { DrawerSection } from "./TaskDrawer";
import { useComments, usePostComment } from "./useComments";

function authorName(c: Comment) {
	if (c.author.kind === "agent") return "Agent";
	if (c.author.kind === "system") return "System";
	return c.author.name ?? "Someone";
}

function excerpt(text: string) {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat;
}

function CommentItem({
	comment,
	question,
	onAnswer,
}: {
	comment: Comment;
	question?: Comment;
	onAnswer: (q: Comment) => void;
}) {
	const isQuestion = comment.kind === "question";
	const isAnswer = comment.kind === "answer";
	const open = isQuestion && !comment.resolvedAt;
	return (
		<li
			className={cn(
				"flex flex-col gap-1 rounded-md border p-3",
				isQuestion &&
					(open
						? "border-amber-500 bg-amber-500/10"
						: "border-amber-500/40 bg-amber-500/5"),
				isAnswer && "ml-4 border-l-4 border-l-primary bg-muted/40",
			)}
		>
			<div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
				<span className="font-medium text-foreground">
					{authorName(comment)}
				</span>
				<span>{relativeTime(comment.createdAt)}</span>
				{isQuestion && (
					<span className="font-semibold text-amber-700 dark:text-amber-400">
						Question · {open ? "open" : "answered"}
					</span>
				)}
				{isAnswer && <span className="font-semibold text-primary">Answer</span>}
			</div>
			{isAnswer && question && (
				<p className="truncate text-xs text-muted-foreground">
					↳ replying to question: {excerpt(question.bodyMd)}
				</p>
			)}
			<Markdown>{comment.bodyMd}</Markdown>
			{open && comment.id > 0 && (
				<div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => onAnswer(comment)}
					>
						Answer
					</Button>
				</div>
			)}
		</li>
	);
}

export function CommentsSection({ task }: { task: Task }) {
	const { data: comments, isPending, isError } = useComments(task.id);
	const { data: users } = useUsers();
	const userId = useCurrentUserId();
	const me = users?.find((u) => u.id === userId)?.name;
	const post = usePostComment(task, me);
	const [text, setText] = useState("");
	const [replyTo, setReplyTo] = useState<Comment | null>(null);
	const [asNote, setAsNote] = useState(false);
	const composer = useRef<HTMLTextAreaElement>(null);

	const byId = new Map((comments ?? []).map((c) => [c.id, c]));
	const openQuestions = (comments ?? []).filter(
		(c) => c.kind === "question" && !c.resolvedAt,
	);
	const reply = replyTo && openQuestions.some((q) => q.id === replyTo.id);

	const submit = () => {
		const bodyMd = text.trim();
		if (!bodyMd || post.isPending) return;
		const answering = reply ? replyTo : null;
		post.mutate(
			answering
				? {
						kind: "answer",
						bodyMd,
						replyToId: answering.id,
						saveAsNote: asNote,
					}
				: { kind: "comment", bodyMd },
			{
				// Keep the text until the server has it, so a failure loses nothing.
				onSuccess: () => {
					setText("");
					setReplyTo(null);
					setAsNote(false);
				},
			},
		);
	};

	return (
		<DrawerSection title="Comments">
			{isPending ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : isError ? (
				<p className="text-sm text-muted-foreground">Could not load comments</p>
			) : comments.length === 0 ? (
				<p className="text-sm text-muted-foreground">No comments yet</p>
			) : (
				<ul className="flex flex-col gap-2">
					{comments.map((c) => (
						<CommentItem
							key={c.id}
							comment={c}
							question={
								c.replyToId === null ? undefined : byId.get(c.replyToId)
							}
							onAnswer={(q) => {
								setReplyTo(q);
								composer.current?.focus();
							}}
						/>
					))}
				</ul>
			)}
			<div className="flex flex-col gap-2">
				{reply && (
					<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
						<span className="min-w-0 truncate">
							Answering: {excerpt(replyTo.bodyMd)}
						</span>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => setReplyTo(null)}
						>
							Cancel
						</Button>
					</div>
				)}
				<Textarea
					ref={composer}
					aria-label={reply ? "Answer" : "New comment"}
					placeholder={reply ? "Write an answer…" : "Add a comment…"}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							submit();
						}
					}}
				/>
				<div className="flex flex-wrap items-center justify-between gap-2">
					{reply ? (
						<Label className="gap-2 font-normal">
							<Checkbox
								checked={asNote}
								onCheckedChange={(v) => setAsNote(v === true)}
							/>
							Also save as project note
						</Label>
					) : (
						<span />
					)}
					<Button
						type="button"
						disabled={!text.trim() || post.isPending}
						onClick={submit}
					>
						{reply ? "Answer question" : "Comment"}
					</Button>
				</div>
			</div>
		</DrawerSection>
	);
}
