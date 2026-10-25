import { Check, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Run, RunState, Task } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { relativeTime } from "@/features/inbox/relativeTime";
import { cn } from "@/lib/utils";
import { useCancelRun, useRunContext, useRuns } from "./useRuns";

const STATE_LABEL: Record<RunState, string> = {
	running: "Running",
	succeeded: "Succeeded",
	needs_human: "Needs human",
	failed: "Failed",
	timed_out: "Timed out",
	cancelled: "Cancelled",
};

const STATE_STYLE: Record<RunState, string> = {
	running: "border-transparent bg-secondary text-secondary-foreground",
	succeeded:
		"border-transparent bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
	needs_human:
		"border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
	failed: "border-transparent bg-destructive/15 text-destructive",
	timed_out:
		"border-transparent bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
	cancelled: "border-dashed text-muted-foreground",
};

export function RunStateBadge({ state }: { state: RunState }) {
	return (
		<Badge className={STATE_STYLE[state]} data-state={state}>
			{state === "running" && <Loader2 className="animate-spin" aria-hidden />}
			{STATE_LABEL[state]}
		</Badge>
	);
}

export function formatDuration(startedAt: string, endedAt: string | null) {
	const end = endedAt ? Date.parse(endedAt) : Date.now();
	const s = Math.max(0, Math.round((end - Date.parse(startedAt)) / 1000));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

function LogRef({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard unavailable; the text stays selectable.
		}
	};
	return (
		<span className="flex min-w-0 items-center gap-1">
			{isUrl(value) ? (
				<a
					href={value}
					target="_blank"
					rel="noreferrer noopener"
					className="min-w-0 break-all text-primary underline underline-offset-2"
				>
					{value}
				</a>
			) : (
				<code className="min-w-0 break-all rounded bg-muted px-1 py-0.5 font-mono text-xs">
					{value}
				</code>
			)}
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-6 shrink-0"
				aria-label="Copy log reference"
				onClick={copy}
			>
				{copied ? <Check /> : <Copy />}
			</Button>
		</span>
	);
}

function ContextDialog({
	run,
	open,
	onOpenChange,
}: {
	run: Run;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { data, isPending, isError } = useRunContext(run.id, open);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Context for run #{run.id}</DialogTitle>
					<DialogDescription>
						Exactly what was served to the executor.
					</DialogDescription>
				</DialogHeader>
				{isPending && !isError ? (
					<p className="text-sm text-muted-foreground">Loading…</p>
				) : isError || !data ? (
					<p className="text-sm text-muted-foreground">
						Could not load the context.
					</p>
				) : (
					<pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">
						{data.contentMd}
					</pre>
				)}
			</DialogContent>
		</Dialog>
	);
}

function RunItem({ run, task }: { run: Run; task: Task }) {
	const [viewing, setViewing] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const cancel = useCancelRun(task);
	const executor = [run.executor, run.model].filter(Boolean).join(" · ");

	return (
		<li className="flex flex-col gap-2 rounded-md border p-3 text-sm">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<RunStateBadge state={run.state} />
				<span className="text-xs text-muted-foreground">{executor}</span>
				<span className="ml-auto text-xs text-muted-foreground">
					Run #{run.id}
				</span>
			</div>
			<p className="text-xs text-muted-foreground">
				Started{" "}
				<time dateTime={run.startedAt}>{relativeTime(run.startedAt)}</time>
				{run.endedAt ? (
					<>
						{" · ended "}
						<time dateTime={run.endedAt}>{relativeTime(run.endedAt)}</time>
					</>
				) : null}
				{" · "}
				{formatDuration(run.startedAt, run.endedAt)}
			</p>
			{run.summary && <p className="break-words">{run.summary}</p>}
			{run.error && (
				<p
					role="alert"
					className={cn(
						"whitespace-pre-wrap break-words rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive",
					)}
				>
					{run.error}
				</p>
			)}
			{run.logRef && (
				<div className="flex items-center gap-2 text-xs">
					<span className="shrink-0 text-muted-foreground">Log</span>
					<LogRef value={run.logRef} />
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setViewing(true)}
				>
					View context
				</Button>
				{run.state === "running" && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={cancel.isPending}
						onClick={() => setConfirming(true)}
					>
						Cancel run
					</Button>
				)}
			</div>
			{viewing && (
				<ContextDialog run={run} open={viewing} onOpenChange={setViewing} />
			)}
			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cancel this run?</DialogTitle>
						<DialogDescription>
							The executor is stopped and the card leaves In Progress.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirming(false)}>
							Keep running
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								setConfirming(false);
								cancel.mutate(run.id);
							}}
						>
							Cancel run
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</li>
	);
}

export function RunsSectionBody({ task }: { task: Task }) {
	const { data: runs, isPending, isError } = useRuns(task.id);
	if (isPending && !isError) {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}
	if (!runs?.length) {
		return <p className="text-sm text-muted-foreground">No runs yet</p>;
	}
	return (
		<ul className="flex flex-col gap-2">
			{runs.map((run) => (
				<RunItem key={run.id} run={run} task={task} />
			))}
		</ul>
	);
}
