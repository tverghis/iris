import { X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { Task } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COLUMN_TITLES } from "@/features/board/boardModel";
import { useBoard } from "@/features/board/useBoard";
import { useAddDependency, useRemoveDependency } from "./useTask";

export function DependencyPicker({ task }: { task: Task }) {
	const { columns } = useBoard(task.projectId);
	const add = useAddDependency(task);
	const remove = useRemoveDependency(task);
	const [query, setQuery] = useState("");
	const inputId = useId();

	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		const taken = new Set(task.dependencies.map((d) => d.id));
		return (columns ?? [])
			.flatMap((c) => c.tasks)
			.filter(
				(t) =>
					t.id !== task.id &&
					!taken.has(t.id) &&
					t.title.toLowerCase().includes(q),
			)
			.slice(0, 8);
	}, [columns, query, task.id, task.dependencies]);

	return (
		<div className="flex flex-col gap-2">
			{task.dependencies.length === 0 ? (
				<p className="text-sm text-muted-foreground">No dependencies.</p>
			) : (
				<ul className="flex flex-col gap-1">
					{task.dependencies.map((d) => (
						<li
							key={d.id}
							className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
						>
							<span className="min-w-0 flex-1 break-words">{d.title}</span>
							<span className="shrink-0 text-xs text-muted-foreground">
								{COLUMN_TITLES[d.status]}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-6"
								aria-label={`Remove dependency ${d.title}`}
								disabled={remove.isPending}
								onClick={() => remove.mutate(d.id)}
							>
								<X aria-hidden />
							</Button>
						</li>
					))}
				</ul>
			)}
			<label htmlFor={inputId} className="sr-only">
				Add dependency
			</label>
			<Input
				id={inputId}
				placeholder="Add dependency…"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					add.reset();
				}}
			/>
			{query.trim() && (
				<ul className="flex flex-col gap-1">
					{matches.length === 0 && (
						<li className="text-sm text-muted-foreground">
							No matching tasks.
						</li>
					)}
					{matches.map((t) => (
						<li key={t.id}>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-auto w-full justify-between whitespace-normal py-1.5 text-left"
								onClick={() =>
									add.mutate(t.id, { onSuccess: () => setQuery("") })
								}
							>
								<span className="break-words">{t.title}</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									{COLUMN_TITLES[t.status]}
								</span>
							</Button>
						</li>
					))}
				</ul>
			)}
			{add.isError && (
				<p role="alert" className="text-sm text-destructive">
					{add.error.message}
				</p>
			)}
		</div>
	);
}
