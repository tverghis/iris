import { describe, expect, it } from "vitest";
import { PERSIST_GC_TIME, shouldDehydrateQuery } from "./persistence";
import { queryKeys } from "./queryKeys";

const q = (queryKey: readonly unknown[], status = "success") =>
	shouldDehydrateQuery({ queryKey, state: { status } } as never);

describe("shouldDehydrateQuery", () => {
	it("keeps successful board, project, task and inbox queries", () => {
		expect(q(queryKeys.projects.board(1))).toBe(true);
		expect(q(queryKeys.projects.list())).toBe(true);
		expect(q(queryKeys.tasks.detail(3))).toBe(true);
		expect(q(queryKeys.tasks.comments(3))).toBe(true);
		expect(q(queryKeys.approvals.list())).toBe(true);
		expect(q(queryKeys.questions.list())).toBe(true);
		expect(q(queryKeys.users)).toBe(true);
	});

	it("drops queries that are not successful", () => {
		expect(q(queryKeys.projects.board(1), "pending")).toBe(false);
		expect(q(queryKeys.projects.board(1), "error")).toBe(false);
	});

	it("drops live and unknown data", () => {
		expect(q(queryKeys.projects.events(1))).toBe(false);
		expect(q(queryKeys.tasks.runs(3))).toBe(false);
		expect(q(queryKeys.runs.detail(3))).toBe(false);
		expect(q(queryKeys.dispatch.status)).toBe(false);
	});

	it("keeps persisted queries in memory for at least 24 hours", () => {
		expect(PERSIST_GC_TIME).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
	});
});
