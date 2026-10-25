import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Decision } from "./decisions";

/** Comment box plus the three decision buttons; the comment is required for all but Approve. */
export function DecisionForm({
	onDecide,
	disabled,
}: {
	onDecide: (decision: Decision, comment: string) => void;
	disabled?: boolean;
}) {
	const [comment, setComment] = useState("");
	const commentId = useId();
	const hintId = useId();
	const needsComment = comment.trim() === "";

	return (
		<>
			<div className="space-y-1.5">
				<Label htmlFor={commentId}>Comment</Label>
				<Textarea
					id={commentId}
					value={comment}
					onChange={(event) => setComment(event.target.value)}
					aria-describedby={hintId}
					placeholder="Optional for approval"
				/>
				<p id={hintId} className="text-xs text-muted-foreground">
					{needsComment
						? "A comment is required to request changes or reject."
						: " "}
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					disabled={disabled}
					onClick={() => onDecide("approved", comment)}
				>
					Approve
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={disabled || needsComment}
					onClick={() => onDecide("changes_requested", comment)}
				>
					Request changes
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={disabled || needsComment}
					onClick={() => onDecide("rejected", comment)}
				>
					Reject
				</Button>
			</div>
		</>
	);
}
