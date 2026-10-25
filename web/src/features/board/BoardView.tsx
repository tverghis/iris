import { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "wouter";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { TaskDrawerMount } from "@/features/task/TaskDrawerMount";
import { useCurrentUserId } from "@/lib/currentUser";
import { BoardColumn } from "./BoardColumn";
import { type BoardFilter, filterColumns, parseFilter } from "./boardModel";
import { useBoard, useUsers } from "./useBoard";

const FILTERS: { value: BoardFilter; label: string }[] = [
	{ value: "mine", label: "Mine" },
	{ value: "agent", label: "Agent" },
	{ value: "all", label: "All" },
];

export function BoardView({ projectId }: { projectId: number }) {
	const { project, columns, isPending, error, refetch } = useBoard(projectId);
	const { data: users } = useUsers();
	const currentUserId = useCurrentUserId();
	const [params, setParams] = useSearchParams();
	const filter = parseFilter(params.get("filter"));

	const userNames = useMemo(
		() => new Map(users?.map((u) => [u.id, u.name]) ?? []),
		[users],
	);
	const visibleColumns = useMemo(
		() => (columns ? filterColumns(columns, filter, currentUserId) : []),
		[columns, filter, currentUserId],
	);

	const setFilter = (next: BoardFilter) =>
		setParams(
			(prev) => {
				if (next === "all") prev.delete("filter");
				else prev.set("filter", next);
				return prev;
			},
			{ replace: true },
		);

	const openTask = useCallback(
		(taskId: number) =>
			setParams((prev) => {
				prev.set("task", String(taskId));
				return prev;
			}),
		[setParams],
	);

	if (isPending) {
		return <p className="text-sm text-muted-foreground">Loading board…</p>;
	}
	if (error || !project) {
		if (error instanceof ApiError && error.status === 404) {
			return (
				<div>
					<h1 className="text-xl font-semibold">Project not found</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						This project does not exist or was removed.{" "}
						<Link to="/" className="underline">
							Back to projects
						</Link>
					</p>
				</div>
			);
		}
		return (
			<div role="alert">
				<p className="text-sm">Could not load the board.</p>
				<Button className="mt-2" variant="outline" onClick={() => refetch()}>
					Retry
				</Button>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-8rem)] min-h-96 flex-col gap-3">
			<header className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<h1 className="text-xl font-semibold">{project.name}</h1>
				<Link
					to={`/projects/${projectId}/context`}
					className="text-sm text-muted-foreground underline"
				>
					Project context
				</Link>
				<fieldset className="ml-auto flex min-w-0 gap-1 border-0 p-0">
					<legend className="sr-only">Filter</legend>
					{FILTERS.map((f) => (
						<Button
							key={f.value}
							size="sm"
							variant={filter === f.value ? "default" : "outline"}
							aria-pressed={filter === f.value}
							onClick={() => setFilter(f.value)}
						>
							{f.label}
						</Button>
					))}
				</fieldset>
			</header>
			<div
				data-board-scroll
				className="flex min-h-0 flex-1 gap-3 overflow-x-auto overscroll-x-contain pb-2"
			>
				{visibleColumns.map((column) => (
					<BoardColumn
						key={column.status}
						projectId={projectId}
						column={column}
						userNames={userNames}
						onOpenTask={openTask}
					/>
				))}
			</div>
			<TaskDrawerMount projectId={projectId} />
		</div>
	);
}
