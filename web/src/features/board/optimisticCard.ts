import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import type { Board, Task, TaskCard, TaskStatus } from "@/api/types";
import { findCard, moveTaskInColumns } from "./boardModel";

/** Reverts one optimistic change. */
export type Undo = () => void;

const noop: Undo = () => {};

const pick = <T extends object>(source: T, keys: (keyof T)[]) =>
	Object.fromEntries(keys.map((key) => [key, source[key]])) as Partial<T>;

export interface CardChange {
	/** Move the card to this column, directly after `afterTaskId` (null = top). */
	status?: TaskStatus;
	afterTaskId?: number | null;
	fields?: Partial<TaskCard>;
}

/**
 * Applies an optimistic change to one board card. The returned undo puts back
 * only that card (its place and the fields it changed), so newer data for
 * every other card, or from the server, is never overwritten by a stale snapshot.
 */
export function changeCard(
	queryClient: QueryClient,
	projectId: number,
	taskId: number,
	{ status, afterTaskId = null, fields }: CardChange,
): Undo {
	const key = queryKeys.projects.board(projectId);
	const board = queryClient.getQueryData<Board>(key);
	const before = board && findCard(board.columns, taskId);
	if (!board || !before) return noop;
	const column = board.columns.find((c) => c.status === before.status);
	const above =
		column?.tasks[column.tasks.findIndex((t) => t.id === taskId) - 1];

	const patch =
		(patchFields: Partial<TaskCard>) => (columns: Board["columns"]) =>
			columns.map((c) =>
				c.tasks.some((t) => t.id === taskId)
					? {
							...c,
							tasks: c.tasks.map((t) =>
								t.id === taskId ? { ...t, ...patchFields } : t,
							),
						}
					: c,
			);
	const update = (change: (columns: Board["columns"]) => Board["columns"]) =>
		queryClient.setQueryData<Board>(
			key,
			(current) => current && { ...current, columns: change(current.columns) },
		);

	update((columns) => {
		const moved = status
			? moveTaskInColumns(columns, taskId, status, afterTaskId)
			: columns;
		return fields ? patch(fields)(moved) : moved;
	});

	return () => {
		const restored: Partial<TaskCard> = {
			...pick(before, Object.keys(fields ?? {}) as (keyof TaskCard)[]),
			...(status && { doneAt: before.doneAt }),
		};
		update((columns) => {
			const back = status
				? moveTaskInColumns(columns, taskId, before.status, above?.id ?? null)
				: columns;
			return patch(restored)(back);
		});
	};
}

/** Applies an optimistic patch to the cached task detail; the undo restores only the patched fields. */
export function patchTaskDetail(
	queryClient: QueryClient,
	taskId: number,
	patch: Partial<Task>,
): Undo {
	const key = queryKeys.tasks.detail(taskId);
	const before = queryClient.getQueryData<Task>(key);
	if (!before) return noop;
	queryClient.setQueryData<Task>(key, (task) => task && { ...task, ...patch });
	const restored = pick(before, Object.keys(patch) as (keyof Task)[]);
	return () =>
		queryClient.setQueryData<Task>(
			key,
			(task) => task && { ...task, ...restored },
		);
}

export const combine =
	(...undos: Undo[]): Undo =>
	() => {
		for (const undo of undos) undo();
	};
