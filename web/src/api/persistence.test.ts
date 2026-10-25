import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { setCurrentUserId } from "@/lib/currentUser";

const store = vi.hoisted(() => new Map<string, string>());
vi.mock("idb-keyval", () => ({
	get: async (key: string) => store.get(key),
	set: async (key: string, value: string) => void store.set(key, value),
	del: async (key: string) => void store.delete(key),
}));

import {
	createPersistOptions,
	PERSIST_GC_TIME,
	shouldDehydrateQuery,
} from "./persistence";
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

describe("createPersistOptions", () => {
	it("does not persist while a mutation (and its optimistic data) is pending", () => {
		const queryClient = new QueryClient();
		const query = {
			queryKey: queryKeys.tasks.comments(3),
			state: { status: "success" },
		} as never;
		const { shouldDehydrateQuery: should } =
			createPersistOptions(queryClient).dehydrateOptions ?? {};
		expect(should?.(query)).toBe(true);

		new MutationObserver(queryClient, {
			mutationFn: () => new Promise(() => {}),
		}).mutate();
		expect(should?.(query)).toBe(false);
	});
});

describe("per-user cache", () => {
	it("stores each user's cache under its own key", async () => {
		const { persister } = createPersistOptions(new QueryClient());
		const client = (n: number) =>
			({
				timestamp: n,
				buster: "",
				clientState: { mutations: [], queries: [] },
			}) as never;
		setCurrentUserId(1);
		await persister.persistClient(client(1));
		setCurrentUserId(2);
		expect(await persister.restoreClient()).toBeUndefined();
		await persister.persistClient(client(2));
		setCurrentUserId(1);
		expect((await persister.restoreClient())?.timestamp).toBe(1);
	});
});
