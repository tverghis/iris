import type { BoardColumn, TaskCard } from "@/api/types";

export type BoardFilter = "all" | "mine" | "agent";

export const DONE_PAGE_SIZE = 20;

export const COLUMN_TITLES = {
	backlog: "Backlog",
	ready: "Ready",
	in_progress: "In Progress",
	needs_approval: "Needs Approval",
	blocked: "Blocked",
	done: "Done",
} as const;

export function parseFilter(value: string | null): BoardFilter {
	return value === "mine" || value === "agent" ? value : "all";
}

export function matchesFilter(
	task: TaskCard,
	filter: BoardFilter,
	userId: number | null,
) {
	if (filter === "mine") {
		return task.assigneeKind === "human" && task.assigneeUserId === userId;
	}
	if (filter === "agent") return task.assigneeKind === "agent";
	return true;
}

export function filterColumns(
	columns: BoardColumn[],
	filter: BoardFilter,
	userId: number | null,
): BoardColumn[] {
	if (filter === "all") return columns;
	return columns.map((c) => ({
		...c,
		tasks: c.tasks.filter((t) => matchesFilter(t, filter, userId)),
	}));
}

/** Done cards, newest first. */
export function sortDone(tasks: TaskCard[]) {
	return tasks.toSorted((a, b) =>
		(b.doneAt ?? b.updatedAt).localeCompare(a.doneAt ?? a.updatedAt),
	);
}
