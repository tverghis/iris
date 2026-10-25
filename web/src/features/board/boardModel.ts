import type { BoardColumn, TaskCard, TaskStatus } from "@/api/types";

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

export const columnDropId = (status: TaskStatus) => `column:${status}`;

export type DragId = number | string;

export interface DropPlan {
	status: TaskStatus;
	/** Task directly above the drop point in the target column; null = top. */
	afterTaskId: number | null;
}

function statusOfDroppable(id: DragId) {
	return typeof id === "string" && id.startsWith("column:")
		? (id.slice("column:".length) as TaskStatus)
		: null;
}

/**
 * Where a dragged task lands when dropped on `overId` (a task id or a column
 * drop id), computed against the given (visible) columns. The active task may
 * already sit in the target column, in which case this follows array-move
 * semantics. Returns null when there is nothing to do.
 */
export function resolveDrop(
	columns: BoardColumn[],
	activeId: number,
	overId: DragId,
): DropPlan | null {
	const overStatus = statusOfDroppable(overId);
	const target = overStatus
		? columns.find((c) => c.status === overStatus)
		: columns.find((c) => c.tasks.some((t) => t.id === overId));
	const source = columns.find((c) => c.tasks.some((t) => t.id === activeId));
	if (!target || !source) return null;
	const status = target.status;
	if (status === "done") {
		// Done is ordered by completion time; a dropped card goes to the top.
		return source.status === "done" ? null : { status, afterTaskId: null };
	}
	const others = target.tasks.filter((t) => t.id !== activeId);
	if (overStatus) return { status, afterTaskId: others.at(-1)?.id ?? null };

	const activeIndex = target.tasks.findIndex((t) => t.id === activeId);
	if (overId === activeId) {
		return { status, afterTaskId: target.tasks[activeIndex - 1]?.id ?? null };
	}
	const overIndex = target.tasks.findIndex((t) => t.id === overId);
	if (activeIndex !== -1 && activeIndex < overIndex) {
		return { status, afterTaskId: overId as number };
	}
	const above = others.findIndex((t) => t.id === overId) - 1;
	return { status, afterTaskId: others[above]?.id ?? null };
}

/** Moves a task to `status`, directly after `afterTaskId` (null = top). */
export function moveTaskInColumns(
	columns: BoardColumn[],
	taskId: number,
	status: TaskStatus,
	afterTaskId: number | null,
): BoardColumn[] {
	const task = columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
	if (!task) return columns;
	let doneAt = task.doneAt;
	if (status !== task.status) {
		doneAt = status === "done" ? new Date().toISOString() : null;
	}
	const moved: TaskCard = { ...task, status, doneAt };
	return columns.map((c) => {
		const rest = c.tasks.filter((t) => t.id !== taskId);
		if (c.status !== status) {
			return rest.length === c.tasks.length ? c : { ...c, tasks: rest };
		}
		const index =
			afterTaskId === null
				? 0
				: rest.findIndex((t) => t.id === afterTaskId) + 1;
		return { ...c, tasks: rest.toSpliced(index, 0, moved) };
	});
}

/** Swaps the server's version of a card in, keeping the optimistic position. */
export function replaceCard(
	columns: BoardColumn[],
	card: TaskCard,
): BoardColumn[] {
	const home = columns.find((c) => c.status === card.status);
	const placed = home?.tasks.some((t) => t.id === card.id)
		? columns
		: moveTaskInColumns(columns, card.id, card.status, null);
	return placed.map((c) =>
		c.status === card.status
			? { ...c, tasks: c.tasks.map((t) => (t.id === card.id ? card : t)) }
			: c,
	);
}

export const columnIds = (columns: BoardColumn[]) =>
	columns.map((c) => c.tasks.map((t) => t.id));
