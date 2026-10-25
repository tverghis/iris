import { useId, useState } from "react";
import { Link } from "wouter";
import type { ApprovalInboxItem, QuestionInboxItem } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DecisionForm } from "@/features/approvals/DecisionForm";
import { KIND_LABELS } from "@/features/approvals/decisions";
import { relativeTime } from "@/lib/relativeTime";
import { actorName } from "./useInbox";
import { useAnswerQuestion, useDecideApproval } from "./useInboxMutations";

type Item = {
	task: { id: number; title: string };
	project: { id: number; name: string };
};

function ItemHeader({
	item,
	by,
	at,
	badge,
}: {
	item: Item;
	by: string;
	at: string;
	badge: string;
}) {
	return (
		<header className="space-y-1">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
				<Badge variant="secondary">{badge}</Badge>
				<span className="font-medium text-foreground">{item.project.name}</span>
				<span>
					{by} · <time dateTime={at}>{relativeTime(at)}</time>
				</span>
			</div>
			<Link
				to={`/projects/${item.project.id}?task=${item.task.id}`}
				className="block break-words font-medium hover:underline"
			>
				{item.task.title}
			</Link>
		</header>
	);
}

export function ApprovalCard({ item }: { item: ApprovalInboxItem }) {
	const { approval } = item;
	const decide = useDecideApproval();

	return (
		<article className="space-y-3 rounded-lg border p-4">
			<ItemHeader
				item={item}
				by={actorName(approval.requestedBy)}
				at={approval.createdAt}
				badge={KIND_LABELS[approval.kind]}
			/>
			<p className="break-words text-sm font-medium">{approval.summary}</p>
			{approval.payloadMd && (
				<pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm">
					{approval.payloadMd}
				</pre>
			)}
			<DecisionForm
				onDecide={(decision, comment) =>
					decide.mutate({ item, decision, comment })
				}
			/>
		</article>
	);
}

export function QuestionCard({ item }: { item: QuestionInboxItem }) {
	const { question } = item;
	const [answer, setAnswer] = useState("");
	const [saveAsNote, setSaveAsNote] = useState(false);
	const reply = useAnswerQuestion();
	const answerId = useId();
	const noteId = useId();
	const empty = answer.trim() === "";

	return (
		<article className="space-y-3 rounded-lg border p-4">
			<ItemHeader
				item={item}
				by={actorName(question.author)}
				at={question.createdAt}
				badge="Question"
			/>
			<p className="whitespace-pre-wrap break-words text-sm">
				{question.bodyMd}
			</p>
			<form
				className="space-y-3"
				onSubmit={(event) => {
					event.preventDefault();
					if (!empty) reply.mutate({ item, bodyMd: answer.trim(), saveAsNote });
				}}
			>
				<div className="space-y-1.5">
					<Label htmlFor={answerId}>Your answer</Label>
					<Textarea
						id={answerId}
						value={answer}
						onChange={(event) => setAnswer(event.target.value)}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						id={noteId}
						checked={saveAsNote}
						onCheckedChange={(value) => setSaveAsNote(value === true)}
					/>
					<Label htmlFor={noteId} className="font-normal">
						Also save as project note
					</Label>
				</div>
				<Button type="submit" disabled={empty}>
					Answer
				</Button>
			</form>
		</article>
	);
}
