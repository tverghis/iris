import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
	formatElapsed,
	formatNextTick,
	useDispatchStatus,
	useNow,
	useRunNow,
} from "@/features/dispatch/useDispatch";

export function DispatcherStatus() {
	const { data: status, isError } = useDispatchStatus();
	const runNow = useRunNow();
	const now = useNow();
	const reasonId = useId();
	const [requested, setRequested] = useState(false);

	useEffect(() => {
		if (!requested) return;
		const id = setTimeout(() => setRequested(false), 3000);
		return () => clearTimeout(id);
	}, [requested]);

	const run = status?.currentRun ?? null;

	let text: ReactNode = "Dispatcher: unknown";
	if (requested) text = "Tick requested";
	else if (run)
		text = (
			<>
				<Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
				<Link
					href={`/projects/${run.projectId}?task=${run.taskId}`}
					className="min-w-0 truncate font-medium text-foreground hover:underline"
				>
					{run.taskTitle}
				</Link>
				<span className="shrink-0">{formatElapsed(run.startedAt, now)}</span>
			</>
		);
	else if (status?.nextTickAt) text = formatNextTick(status.nextTickAt, now);
	else if (status) text = "Dispatcher: idle";
	else if (!isError) text = "Dispatcher…";

	let disabledReason: string | null = null;
	if (run) disabledReason = "An agent run is already in progress";
	else if (!status) disabledReason = "Dispatcher status unavailable";
	else if (runNow.isPending) disabledReason = "A tick is being requested";

	return (
		<div
			className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
			aria-live="polite"
		>
			<span className="flex min-w-0 items-center gap-1.5">{text}</span>
			<span title={disabledReason ?? undefined} className="shrink-0">
				<Button
					type="button"
					size="sm"
					variant="outline"
					aria-describedby={disabledReason ? reasonId : undefined}
					disabled={disabledReason !== null}
					onClick={() =>
						runNow.mutate(undefined, { onSuccess: () => setRequested(true) })
					}
				>
					Run now
				</Button>
				{disabledReason && (
					<span id={reasonId} className="sr-only">
						{disabledReason}
					</span>
				)}
			</span>
		</div>
	);
}
