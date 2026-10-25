import { useEffect, useId, useState } from "react";
import type { Project } from "@/api/types";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSaveBrief } from "./hooks";

export function BriefEditor({ project }: { project: Project }) {
	const [draft, setDraft] = useState(project.briefMd);
	const [tab, setTab] = useState<"edit" | "preview">("edit");
	const save = useSaveBrief(project.id);
	const dirty = draft !== project.briefMd;
	const panelId = useId();

	useEffect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const submit = () => {
		if (dirty && !save.isPending) save.mutate(draft);
	};

	return (
		<section aria-labelledby={`${panelId}-h`} className="min-w-0">
			<div className="flex items-center justify-between gap-2">
				<h2 id={`${panelId}-h`} className="text-base font-semibold">
					Brief
				</h2>
				<div role="tablist" aria-label="Brief view" className="flex gap-1">
					{(["edit", "preview"] as const).map((t) => (
						<button
							key={t}
							type="button"
							role="tab"
							aria-selected={tab === t}
							aria-controls={panelId}
							onClick={() => setTab(t)}
							className={cn(
								"rounded-md px-3 py-1 text-sm capitalize",
								tab === t
									? "bg-accent font-medium"
									: "text-muted-foreground hover:bg-accent/50",
							)}
						>
							{t}
						</button>
					))}
				</div>
			</div>
			<div id={panelId} role="tabpanel" className="mt-2">
				{tab === "edit" ? (
					<Textarea
						aria-label="Brief (Markdown)"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								submit();
							}
						}}
						placeholder="Goal, key dates, budget, people, preferences, dealbreakers"
						className="min-h-64 font-mono"
					/>
				) : (
					<div className="min-h-64 rounded-md border p-3">
						{draft.trim() ? (
							<Markdown>{draft}</Markdown>
						) : (
							<p className="text-sm text-muted-foreground">
								Nothing to preview.
							</p>
						)}
					</div>
				)}
			</div>
			<div className="mt-2 flex items-center gap-3">
				<Button onClick={submit} disabled={!dirty || save.isPending} size="sm">
					{save.isPending ? "Saving…" : "Save"}
				</Button>
				<span className="text-sm text-muted-foreground" aria-live="polite">
					{dirty ? "Unsaved changes" : "Saved"}
				</span>
				<span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
					Ctrl/Cmd+Enter to save
				</span>
			</div>
		</section>
	);
}
