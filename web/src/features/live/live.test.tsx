import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	type MockInstance,
	test,
	vi,
} from "vitest";
import { queryKeys } from "@/api/queryKeys";
import type { Board, StreamEvent, Task, TaskCard } from "@/api/types";
import { TASK_STATUSES } from "@/api/types";
import { removeCard, upsertCard } from "./applyEvent";
import { handleStreamEvent } from "./handleEvent";
import { BACKOFF_MAX_MS, POLL_MS, useProjectStream } from "./useProjectStream";

const card = (id: number, over: Partial<TaskCard> = {}): TaskCard => ({
	id,
	projectId: 1,
	title: `Task ${id}`,
	status: "backlog",
	position: id * 1000,
	assigneeKind: "none",
	assigneeUserId: null,
	waitingOn: 0,
	pendingApproval: null,
	running: false,
	requireSignOff: false,
	doneAt: null,
	updatedAt: "2026-01-01T00:00:00.000Z",
	...over,
});

function makeBoard(): Board {
	const tasks = [
		card(1),
		card(2),
		card(3),
		card(4, { status: "ready" }),
		card(5, { status: "done" }),
	];
	return {
		project: {
			id: 1,
			name: "P",
			briefMd: "",
			archivedAt: null,
			createdAt: "",
			updatedAt: "",
		} as Board["project"],
		columns: TASK_STATUSES.map((status) => ({
			status,
			tasks: tasks.filter((t) => t.status === status),
		})),
	};
}

const col = (board: Board, status: string) =>
	board.columns.find((c) => c.status === status)?.tasks.map((t) => t.id);

describe("upsertCard / removeCard", () => {
	test("update in place keeps every other card and column identical", () => {
		const board = makeBoard();
		const next = upsertCard(
			board,
			card(2, { title: "Renamed", updatedAt: "2026-02-01T00:00:00.000Z" }),
		);
		expect(next).not.toBe(board);
		expect(next.columns[0].tasks[1].title).toBe("Renamed");
		expect(next.columns[0].tasks[0]).toBe(board.columns[0].tasks[0]);
		expect(next.columns[0].tasks[2]).toBe(board.columns[0].tasks[2]);
		for (const i of [1, 2, 3, 4, 5])
			expect(next.columns[i]).toBe(board.columns[i]);
	});

	test("a move between columns touches only those two columns and keeps order", () => {
		const board = makeBoard();
		const moved = card(1, {
			status: "ready",
			position: 2500,
			updatedAt: "2026-02-01T00:00:00.000Z",
		});
		const next = upsertCard(board, moved);
		expect(col(next, "backlog")).toEqual([2, 3]);
		expect(col(next, "ready")).toEqual([1, 4]);
		expect(next.columns[0].tasks[0]).toBe(board.columns[0].tasks[1]);
		expect(next.columns[1].tasks[1]).toBe(board.columns[1].tasks[0]);
		expect(next.columns[2]).toBe(board.columns[2]);
		expect(next.columns[5]).toBe(board.columns[5]);
	});

	test("reordering inside a column keeps untouched card objects", () => {
		const board = makeBoard();
		const next = upsertCard(
			board,
			card(1, { position: 2500, updatedAt: "2026-02-01T00:00:00.000Z" }),
		);
		expect(col(next, "backlog")).toEqual([2, 1, 3]);
		expect(next.columns[0].tasks[0]).toBe(board.columns[0].tasks[1]);
		expect(next.columns[0].tasks[2]).toBe(board.columns[0].tasks[2]);
	});

	test("a new card is inserted sorted by position", () => {
		const board = makeBoard();
		const next = upsertCard(board, card(9, { position: 1500 }));
		expect(col(next, "backlog")).toEqual([1, 9, 2, 3]);
		expect(next.columns[0].tasks[0]).toBe(board.columns[0].tasks[0]);
	});

	test("an identical card or a stale event returns the same board", () => {
		const board = makeBoard();
		expect(upsertCard(board, { ...board.columns[0].tasks[0] })).toBe(board);
		const stale = card(1, {
			title: "Old",
			updatedAt: "2025-01-01T00:00:00.000Z",
		});
		expect(upsertCard(board, stale)).toBe(board);
	});

	test("ignores cards from another project", () => {
		const board = makeBoard();
		expect(upsertCard(board, card(9, { projectId: 2 }))).toBe(board);
	});

	test("remove drops only the affected column's array", () => {
		const board = makeBoard();
		const next = removeCard(board, 4);
		expect(col(next, "ready")).toEqual([]);
		expect(next.columns[0]).toBe(board.columns[0]);
		expect(removeCard(board, 999)).toBe(board);
	});
});

function client() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
		},
	});
}

describe("handleStreamEvent", () => {
	test("task.updated patches the board cache, leaving other cards identical", () => {
		const qc = client();
		const board = makeBoard();
		qc.setQueryData(queryKeys.projects.board(1), board);
		const boardInvalidate = vi.spyOn(qc, "invalidateQueries");
		handleStreamEvent(qc, 1, {
			type: "task.updated",
			taskId: 2,
			task: card(2, {
				title: "Renamed",
				updatedAt: "2026-02-01T00:00:00.000Z",
			}),
		});
		const next = qc.getQueryData<Board>(queryKeys.projects.board(1)) as Board;
		expect(next.columns[0].tasks[1].title).toBe("Renamed");
		expect(next.columns[0].tasks[0]).toBe(board.columns[0].tasks[0]);
		expect(next.columns[0].tasks[2]).toBe(board.columns[0].tasks[2]);
		expect(next.columns[4]).toBe(board.columns[4]);
		for (const [arg] of boardInvalidate.mock.calls) {
			expect(arg?.queryKey).not.toEqual(queryKeys.projects.board(1));
		}
	});

	test("task.updated merges into a cached task detail", () => {
		const qc = client();
		qc.setQueryData(queryKeys.projects.board(1), makeBoard());
		const detail = {
			...card(2),
			descriptionMd: "keep",
			dependencies: [],
		} as unknown as Task;
		qc.setQueryData(queryKeys.tasks.detail(2), detail);
		handleStreamEvent(qc, 1, {
			type: "task.updated",
			taskId: 2,
			task: card(2, {
				title: "Renamed",
				updatedAt: "2026-02-01T00:00:00.000Z",
			}),
		});
		const next = qc.getQueryData<Task>(queryKeys.tasks.detail(2));
		expect(next?.title).toBe("Renamed");
		expect(next?.descriptionMd).toBe("keep");
		expect(qc.getQueryState(queryKeys.tasks.detail(2))?.isInvalidated).toBe(
			true,
		);
		expect(qc.getQueryData(queryKeys.tasks.detail(3))).toBeUndefined();
	});

	test("task.deleted removes the card", () => {
		const qc = client();
		qc.setQueryData(queryKeys.projects.board(1), makeBoard());
		handleStreamEvent(qc, 1, { type: "task.deleted", taskId: 1 });
		const next = qc.getQueryData<Board>(queryKeys.projects.board(1)) as Board;
		expect(col(next, "backlog")).toEqual([2, 3]);
	});

	test("related events invalidate only narrow queries, never the board", () => {
		const qc = client();
		const board = makeBoard();
		qc.setQueryData(queryKeys.projects.board(1), board);
		qc.setQueryData(queryKeys.tasks.comments(7), []);
		qc.setQueryData(queryKeys.tasks.approvals(7), []);
		qc.setQueryData(queryKeys.projects.notes(1), []);
		qc.setQueryData(queryKeys.approvals.list("pending"), []);
		const events: StreamEvent[] = [
			{ type: "comment.created", taskId: 7 },
			{ type: "approval.changed", taskId: 7 },
			{ type: "note.changed" },
			{ type: "question.changed", taskId: 7 },
			{ type: "run.changed", taskId: 7 },
		];
		for (const e of events) handleStreamEvent(qc, 1, e);
		expect(qc.getQueryState(queryKeys.tasks.comments(7))?.isInvalidated).toBe(
			true,
		);
		expect(qc.getQueryState(queryKeys.tasks.approvals(7))?.isInvalidated).toBe(
			true,
		);
		expect(qc.getQueryState(queryKeys.projects.notes(1))?.isInvalidated).toBe(
			true,
		);
		expect(
			qc.getQueryState(queryKeys.approvals.list("pending"))?.isInvalidated,
		).toBe(true);
		expect(qc.getQueryState(queryKeys.projects.board(1))?.isInvalidated).toBe(
			false,
		);
	});
});

class FakeEventSource {
	static instances: FakeEventSource[] = [];
	onopen: (() => void) | null = null;
	onmessage: ((e: { data: string }) => void) | null = null;
	onerror: (() => void) | null = null;
	closed = false;
	url: string;
	constructor(url: string) {
		this.url = url;
		FakeEventSource.instances.push(this);
	}
	close() {
		this.closed = true;
	}
	open() {
		this.onopen?.();
	}
	send(event: StreamEvent) {
		this.onmessage?.({ data: JSON.stringify(event) });
	}
	fail() {
		this.onerror?.();
	}
}
const last = () =>
	FakeEventSource.instances[FakeEventSource.instances.length - 1];

function setVisibility(state: "visible" | "hidden") {
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		get: () => state,
	});
	document.dispatchEvent(new Event("visibilitychange"));
}

describe("useProjectStream", () => {
	let qc: QueryClient;
	let refetch: MockInstance<QueryClient["refetchQueries"]>;
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);

	beforeEach(() => {
		vi.useFakeTimers();
		FakeEventSource.instances = [];
		vi.stubGlobal("EventSource", FakeEventSource);
		qc = client();
		qc.setQueryData(queryKeys.projects.board(1), makeBoard());
		refetch = vi.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
	});
	afterEach(() => {
		vi.useRealTimers();
		setVisibility("visible");
	});

	test("connects to the project stream and patches the cache from messages", () => {
		renderHook(() => useProjectStream(1), { wrapper });
		expect(last().url).toBe("/api/projects/1/stream");
		last().open();
		last().send({
			type: "task.created",
			taskId: 9,
			task: card(9, { position: 1500 }),
		});
		const board = qc.getQueryData<Board>(queryKeys.projects.board(1)) as Board;
		expect(col(board, "backlog")).toEqual([1, 9, 2, 3]);
		const boardRefetches = refetch.mock.calls.filter(
			(call) =>
				JSON.stringify(call[0]?.queryKey) ===
				JSON.stringify(queryKeys.projects.board(1)),
		);
		expect(boardRefetches).toHaveLength(0);
	});

	test("ignores malformed messages", () => {
		renderHook(() => useProjectStream(1), { wrapper });
		last().onmessage?.({ data: "not json" });
		expect(FakeEventSource.instances).toHaveLength(1);
	});

	test("reconnects with exponential backoff capped at 30s, then resets on open", () => {
		renderHook(() => useProjectStream(1), { wrapper });
		const delays = [
			1000,
			2000,
			4000,
			8000,
			16000,
			BACKOFF_MAX_MS,
			BACKOFF_MAX_MS,
		];
		for (const ms of delays) {
			last().fail();
			expect(last().closed).toBe(true);
			const count = FakeEventSource.instances.length;
			vi.advanceTimersByTime(ms - 1);
			expect(FakeEventSource.instances).toHaveLength(count);
			vi.advanceTimersByTime(1);
			expect(FakeEventSource.instances).toHaveLength(count + 1);
		}
		last().open();
		last().fail();
		const count = FakeEventSource.instances.length;
		vi.advanceTimersByTime(1000);
		expect(FakeEventSource.instances).toHaveLength(count + 1);
	});

	test("refetches the board once after a reconnect opens", () => {
		renderHook(() => useProjectStream(1), { wrapper });
		last().open();
		expect(refetch).not.toHaveBeenCalled();
		last().fail();
		vi.advanceTimersByTime(1000);
		last().open();
		expect(refetch).toHaveBeenCalledTimes(1);
		expect(refetch).toHaveBeenCalledWith({
			queryKey: queryKeys.projects.board(1),
			exact: true,
		});
	});

	test("on visibilitychange to visible: refetches and reconnects if closed", () => {
		renderHook(() => useProjectStream(1), { wrapper });
		last().open();
		last().fail();
		setVisibility("hidden");
		expect(refetch).not.toHaveBeenCalled();
		setVisibility("visible");
		expect(refetch).toHaveBeenCalledTimes(1);
		expect(FakeEventSource.instances).toHaveLength(2);
		// the pending backoff retry was cancelled, so no third connection
		vi.advanceTimersByTime(5000);
		expect(FakeEventSource.instances).toHaveLength(2);
		// an open connection is kept as is
		last().open();
		setVisibility("visible");
		expect(FakeEventSource.instances).toHaveLength(2);
		expect(refetch).toHaveBeenCalledTimes(2);
	});

	test("polls every 15s after 3 failures before opening, stops once connected", () => {
		renderHook(() => useProjectStream(1), { wrapper });
		last().fail();
		vi.advanceTimersByTime(1000);
		last().fail();
		vi.advanceTimersByTime(2000);
		vi.advanceTimersByTime(POLL_MS);
		expect(refetch).not.toHaveBeenCalled();
		last().fail();
		vi.advanceTimersByTime(POLL_MS);
		expect(refetch).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(POLL_MS);
		expect(refetch).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(5000);
		last().open();
		const calls = refetch.mock.calls.length;
		vi.advanceTimersByTime(POLL_MS * 3);
		expect(refetch).toHaveBeenCalledTimes(calls);
	});

	test("polling skips ticks while the page is hidden", () => {
		vi.stubGlobal("EventSource", undefined);
		renderHook(() => useProjectStream(1), { wrapper });
		setVisibility("hidden");
		vi.advanceTimersByTime(POLL_MS * 2);
		expect(refetch).not.toHaveBeenCalled();
		setVisibility("visible");
		expect(refetch).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(POLL_MS);
		expect(refetch).toHaveBeenCalledTimes(2);
	});

	test("polls when EventSource is unavailable", () => {
		vi.stubGlobal("EventSource", undefined);
		renderHook(() => useProjectStream(1), { wrapper });
		expect(FakeEventSource.instances).toHaveLength(0);
		vi.advanceTimersByTime(POLL_MS);
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	test("unmount closes the stream and stops timers", () => {
		const { unmount } = renderHook(() => useProjectStream(1), { wrapper });
		last().fail();
		unmount();
		vi.advanceTimersByTime(60_000);
		expect(FakeEventSource.instances).toHaveLength(1);
		const open = renderHook(() => useProjectStream(1), { wrapper });
		last().open();
		open.unmount();
		expect(last().closed).toBe(true);
	});
});
