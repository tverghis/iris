import type { Board, TaskCard } from "@/api/types";

const sameCard = (a: TaskCard, b: TaskCard) =>
	JSON.stringify(a) === JSON.stringify(b);

/**
 * Inserts or replaces one card. Only the affected columns get new arrays and
 * only the changed card gets a new object, so memoized cards elsewhere keep
 * their identity. Returns the same board when nothing changes.
 */
export function upsertCard(board: Board, card: TaskCard): Board {
	if (board.project.id !== card.projectId) return board;

	let fromStatus: TaskCard["status"] | null = null;
	let existing: TaskCard | undefined;
	for (const column of board.columns) {
		existing = column.tasks.find((t) => t.id === card.id);
		if (existing) {
			fromStatus = column.status;
			break;
		}
	}
	if (existing && fromStatus) {
		// An older event arriving late must not undo a newer cache entry.
		if (existing.updatedAt > card.updatedAt) return board;
		if (fromStatus === card.status && sameCard(existing, card)) return board;
	}

	return {
		...board,
		columns: board.columns.map((column) => {
			const inTarget = column.status === card.status;
			if (column.status === fromStatus && !inTarget) {
				return {
					...column,
					tasks: column.tasks.filter((t) => t.id !== card.id),
				};
			}
			if (!inTarget) return column;
			if (
				existing &&
				fromStatus === card.status &&
				existing.position === card.position
			) {
				return {
					...column,
					tasks: column.tasks.map((t) => (t.id === card.id ? card : t)),
				};
			}
			const rest = column.tasks.filter((t) => t.id !== card.id);
			const at = rest.findIndex((t) => t.position > card.position);
			rest.splice(at < 0 ? rest.length : at, 0, card);
			return { ...column, tasks: rest };
		}),
	};
}

export function removeCard(board: Board, taskId: number): Board {
	if (!board.columns.some((c) => c.tasks.some((t) => t.id === taskId))) {
		return board;
	}
	return {
		...board,
		columns: board.columns.map((column) =>
			column.tasks.some((t) => t.id === taskId)
				? { ...column, tasks: column.tasks.filter((t) => t.id !== taskId) }
				: column,
		),
	};
}
