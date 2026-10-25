import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
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

	return (
		<div
			className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
			aria-live="polite"
		>
			<span className="flex min-w-0 items-center gap-1.5">{text}</span>
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="shrink-0"
				disabled={runNow.isPending || !status || run !== null}
				onClick={() =>
					runNow.mutate(undefined, { onSuccess: () => setRequested(true) })
				}
			>
				Run now
			</Button>
		</div>
	);
}
