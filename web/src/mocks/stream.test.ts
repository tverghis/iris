import { expect, test } from "vitest";
import { api } from "@/api/client";
import type { Board, StreamEvent } from "@/api/types";

async function readEvents(
	response: Response,
	until: (events: StreamEvent[]) => boolean,
) {
	const reader = (response.body as ReadableStream<Uint8Array>).getReader();
	const decoder = new TextDecoder();
	const events: StreamEvent[] = [];
	let buffer = "";
	while (!until(events)) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const messages = buffer.split("\n\n");
		buffer = messages.pop() ?? "";
		for (const m of messages) {
			if (m.startsWith("data: ")) events.push(JSON.parse(m.slice(6)));
		}
	}
	await reader.cancel();
	return events;
}

test("the mock stream emits events when the db mutates", async () => {
	const response = await fetch(`${location.origin}/api/projects/1/stream`);
	expect(response.headers.get("content-type")).toContain("text/event-stream");
	const board = (await api.GET("/api/projects/{id}/board", {
		params: { path: { id: 1 } },
	})) as { data: Board };
	const task = board.data.columns[0].tasks[0];

	await api.POST("/api/tasks/{id}/move", {
		params: { path: { id: task.id } },
		body: { status: "ready", afterTaskId: null },
	});
	await api.POST("/api/tasks/{id}/comments", {
		params: { path: { id: task.id } },
		body: { bodyMd: "hello", kind: "comment" },
	});
	await api.DELETE("/api/tasks/{id}", { params: { path: { id: task.id } } });

	const events = await readEvents(response, (e) =>
		e.some((x) => x.type === "task.deleted"),
	);
	const moved = events.find(
		(e) => e.type === "task.updated" && e.task?.status === "ready",
	);
	expect(moved?.taskId).toBe(task.id);
	expect(events.some((e) => e.type === "comment.created")).toBe(true);
	expect(events.at(-1)).toEqual({ type: "task.deleted", taskId: task.id });
});
