import { afterEach, describe, expect, it } from "vitest";
import { consumeBoardPrefetch } from "./boardPrefetch";

const board = { project: { id: 1 }, columns: [] };

function setPrefetch(
	projectId: number,
	response: Promise<Response>,
	at = 1000,
) {
	window.__irisBoardPrefetch = { projectId, startedAt: at, promise: response };
}

afterEach(() => {
	window.__irisBoardPrefetch = undefined;
});

describe("consumeBoardPrefetch", () => {
	it("returns nothing without a prefetch", async () => {
		expect(await consumeBoardPrefetch(1, 1000)).toBeNull();
	});

	it("returns the board once for a matching fresh prefetch", async () => {
		setPrefetch(1, Promise.resolve(Response.json(board)));
		expect(await consumeBoardPrefetch(1, 5000)).toEqual(board);
		expect(await consumeBoardPrefetch(1, 5000)).toBeNull();
	});

	it("ignores a prefetch for another project, and discards it", async () => {
		setPrefetch(2, Promise.resolve(Response.json(board)));
		expect(await consumeBoardPrefetch(1, 1500)).toBeNull();
		expect(window.__irisBoardPrefetch).toBeUndefined();
	});

	it("ignores a stale prefetch", async () => {
		setPrefetch(1, Promise.resolve(Response.json(board)), 1000);
		expect(await consumeBoardPrefetch(1, 11_001)).toBeNull();
	});

	it("falls back on errors and non-ok responses", async () => {
		setPrefetch(1, Promise.reject(new Error("offline")));
		expect(await consumeBoardPrefetch(1, 1500)).toBeNull();
		setPrefetch(1, Promise.resolve(new Response("nope", { status: 500 })));
		expect(await consumeBoardPrefetch(1, 1500)).toBeNull();
	});
});
