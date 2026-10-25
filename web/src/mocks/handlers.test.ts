import { describe, expect, test } from "vitest";
import { ApiError, api } from "@/api/client";
import type { Board, TaskStatus } from "@/api/types";

async function board(projectId = 1): Promise<Board> {
	return (
		await api.GET("/api/projects/{id}/board", {
			params: { path: { id: projectId } },
		})
	).data as Board;
}

async function taskIn(status: TaskStatus, agent: boolean) {
	const column = (await board()).columns.find((c) => c.status === status);
	const task = column?.tasks.find(
		(t) => (t.assigneeKind === "agent") === agent,
	);
	if (!task) throw new Error("seed task missing");
	return task;
}

const move = (
	id: number,
	status: TaskStatus,
	afterTaskId: number | null = null,
) =>
	api.POST("/api/tasks/{id}/move", {
		params: { path: { id } },
		body: { status, afterTaskId },
	});

describe("mock lifecycle rules", () => {
	test("rejects moving an agent task into In Progress", async () => {
		const task = await taskIn("ready", true);

		const error = await move(task.id, "in_progress").catch((e) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error.status).toBe(409);
		expect(error.message).toBe(
			"Only the dispatcher can move an agent task into In Progress",
		);
	});

	test("lets a human move their own task and orders by afterTaskId", async () => {
		const task = await taskIn("ready", false);
		const top = (await board()).columns.find((c) => c.status === "backlog");
		const first = top?.tasks[0];
		if (!first) throw new Error("seed task missing");

		await move(task.id, "backlog", first.id);

		const backlog = (await board()).columns.find((c) => c.status === "backlog");
		expect(backlog?.tasks.map((t) => t.id).slice(0, 2)).toEqual([
			first.id,
			task.id,
		]);
	});

	test("answering a question unblocks the task", async () => {
		const questions =
			(
				await api.GET("/api/questions", {
					params: { query: { state: "open" } },
				})
			).data ?? [];
		expect(questions).toHaveLength(1);
		const { question, task } = questions[0];
		expect(task.status).toBe("blocked");

		await api.POST("/api/tasks/{id}/comments", {
			params: { path: { id: task.id } },
			body: { kind: "answer", bodyMd: "City airport", replyToId: question.id },
		});

		const updated = (
			await api.GET("/api/tasks/{id}", { params: { path: { id: task.id } } })
		).data;
		expect(updated?.status).toBe("ready");
		expect(
			(
				await api.GET("/api/questions", {
					params: { query: { state: "open" } },
				})
			).data,
		).toHaveLength(0);
	});

	test("rejecting an approval needs a comment and sends the task to backlog", async () => {
		const [{ approval, task }] =
			(
				await api.GET("/api/approvals", {
					params: { query: { state: "pending" } },
				})
			).data ?? [];

		const missing = await api
			.POST("/api/approvals/{id}/decide", {
				params: { path: { id: approval.id } },
				body: { decision: "rejected" },
			})
			.catch((e) => e);
		expect(missing.status).toBe(400);

		await api.POST("/api/approvals/{id}/decide", {
			params: { path: { id: approval.id } },
			body: { decision: "rejected", comment: "Not these" },
		});
		const updated = (
			await api.GET("/api/tasks/{id}", { params: { path: { id: task.id } } })
		).data;
		expect(updated?.status).toBe("backlog");
		expect(updated?.pendingApproval).toBeNull();
	});

	test("rejects self dependencies and cycles", async () => {
		const dependent = (await board()).columns
			.flatMap((c) => c.tasks)
			.find((t) => t.waitingOn > 0);
		if (!dependent) throw new Error("seed task missing");
		const detail = (
			await api.GET("/api/tasks/{id}", {
				params: { path: { id: dependent.id } },
			})
		).data;
		const dep = detail?.dependencies[0];
		if (!dep) throw new Error("seed dependency missing");

		const self = await api
			.POST("/api/tasks/{id}/deps", {
				params: { path: { id: dep.id } },
				body: { dependsOnId: dep.id },
			})
			.catch((e) => e);
		const cycle = await api
			.POST("/api/tasks/{id}/deps", {
				params: { path: { id: dep.id } },
				body: { dependsOnId: dependent.id },
			})
			.catch((e) => e);

		expect(self.status).toBe(400);
		expect(cycle.status).toBe(409);
	});
});
