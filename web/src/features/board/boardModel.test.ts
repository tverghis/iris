import { describe, expect, test } from "vitest";
import type { BoardColumn, TaskCard, TaskStatus } from "@/api/types";
import {
	columnDropId,
	moveTaskInColumns,
	replaceCard,
	resolveDrop,
} from "./boardModel";

const card = (id: number, status: TaskStatus): TaskCard => ({
	id,
	projectId: 1,
	title: `Task ${id}`,
	status,
	position: id,
	assigneeKind: "none",
	assigneeUserId: null,
	waitingOn: 0,
	pendingApproval: null,
	running: false,
	requireSignOff: false,
	doneAt: status === "done" ? "2026-01-01T00:00:00Z" : null,
	updatedAt: "2026-01-01T00:00:00Z",
});

const STATUSES: TaskStatus[] = [
	"backlog",
	"ready",
	"in_progress",
	"needs_approval",
	"blocked",
	"done",
];

function board(layout: Partial<Record<TaskStatus, number[]>>): BoardColumn[] {
	return STATUSES.map((status) => ({
		status,
		tasks: (layout[status] ?? []).map((id) => card(id, status)),
	}));
}

const ids = (columns: BoardColumn[], status: TaskStatus) =>
	columns.find((c) => c.status === status)?.tasks.map((t) => t.id);

describe("resolveDrop", () => {
	const columns = board({ backlog: [1, 2, 3], ready: [4, 5], done: [9] });

	test("a drop on a bare column goes to the end, or the top for collapsed ones", () => {
		const over = columnDropId("ready");
		expect(resolveDrop(columns, 1, over)).toEqual({
			status: "ready",
			afterTaskId: 5,
		});
		expect(resolveDrop(columns, 1, over, "top")).toEqual({
			status: "ready",
			afterTaskId: null,
		});
	});

	test("reordering down lands after the card dropped on", () => {
		expect(resolveDrop(columns, 1, 3)).toEqual({
			status: "backlog",
			afterTaskId: 3,
		});
		expect(resolveDrop(columns, 1, 2)).toEqual({
			status: "backlog",
			afterTaskId: 2,
		});
	});

	test("reordering up lands after the card above the one dropped on", () => {
		expect(resolveDrop(columns, 3, 2)).toEqual({
			status: "backlog",
			afterTaskId: 1,
		});
		expect(resolveDrop(columns, 3, 1)).toEqual({
			status: "backlog",
			afterTaskId: null,
		});
	});

	test("dropping a card on itself keeps its place", () => {
		expect(resolveDrop(columns, 2, 2)).toEqual({
			status: "backlog",
			afterTaskId: 1,
		});
		expect(resolveDrop(columns, 1, 1)?.afterTaskId).toBeNull();
	});

	test("across columns the card goes above the card dropped on", () => {
		expect(resolveDrop(columns, 1, 5)).toEqual({
			status: "ready",
			afterTaskId: 4,
		});
		expect(resolveDrop(columns, 1, 4)).toEqual({
			status: "ready",
			afterTaskId: null,
		});
	});

	test("dropping on a column puts the card at the bottom; empty means top", () => {
		expect(resolveDrop(columns, 1, columnDropId("ready"))).toEqual({
			status: "ready",
			afterTaskId: 5,
		});
		expect(resolveDrop(columns, 1, columnDropId("blocked"))).toEqual({
			status: "blocked",
			afterTaskId: null,
		});
	});

	test("done is time ordered: moves in go on top, reordering inside is a no-op", () => {
		expect(resolveDrop(columns, 1, columnDropId("done"))).toEqual({
			status: "done",
			afterTaskId: null,
		});
		expect(resolveDrop(columns, 1, 9)).toEqual({
			status: "done",
			afterTaskId: null,
		});
		expect(resolveDrop(board({ done: [8, 9] }), 8, 9)).toBeNull();
	});

	test("follows the previewed position once the card is in the target column", () => {
		const preview = moveTaskInColumns(columns, 1, "ready", 4);
		expect(ids(preview, "ready")).toEqual([4, 1, 5]);
		expect(resolveDrop(preview, 1, 5)).toEqual({
			status: "ready",
			afterTaskId: 5,
		});
		expect(resolveDrop(preview, 1, 4)).toEqual({
			status: "ready",
			afterTaskId: null,
		});
	});

	test("unknown ids resolve to nothing", () => {
		expect(resolveDrop(columns, 1, 99)).toBeNull();
		expect(resolveDrop(columns, 99, 2)).toBeNull();
	});
});

describe("moveTaskInColumns", () => {
	const columns = board({ backlog: [1, 2, 3], ready: [4] });

	test("reorders within a column", () => {
		expect(ids(moveTaskInColumns(columns, 1, "backlog", 2), "backlog")).toEqual(
			[2, 1, 3],
		);
		expect(
			ids(moveTaskInColumns(columns, 3, "backlog", null), "backlog"),
		).toEqual([3, 1, 2]);
	});

	test("moves across columns and updates the status", () => {
		const next = moveTaskInColumns(columns, 2, "ready", 4);
		expect(ids(next, "backlog")).toEqual([1, 3]);
		expect(ids(next, "ready")).toEqual([4, 2]);
		expect(next[1].tasks[1].status).toBe("ready");
		expect(columns[0].tasks).toHaveLength(3);
	});

	test("moving into an empty column and into done", () => {
		expect(
			ids(moveTaskInColumns(columns, 1, "blocked", null), "blocked"),
		).toEqual([1]);
		const done = moveTaskInColumns(columns, 1, "done", null).at(-1);
		expect(done?.tasks[0].doneAt).not.toBeNull();
	});

	test("places a card against a filtered (subset) column", () => {
		const visible = board({ backlog: [1, 3] });
		expect(ids(moveTaskInColumns(visible, 3, "backlog", 1), "backlog")).toEqual(
			[1, 3],
		);
	});
});

test("replaceCard swaps in the server card without reordering", () => {
	const columns = moveTaskInColumns(
		board({ backlog: [1, 2] }),
		1,
		"ready",
		null,
	);
	const server = { ...card(1, "ready"), position: 500, title: "From server" };
	expect(replaceCard(columns, server)[1].tasks).toEqual([server]);
});
