import { delay, HttpResponse, http } from "msw";
import type {
	Actor,
	Approval,
	ApprovalCreate,
	ApprovalDecision,
	CommentCreate,
	DispatchStatus,
	MoveTask,
	NoteCreate,
	NotePatch,
	ProjectCreate,
	ProjectPatch,
	TaskCreate,
	TaskPatch,
	TaskStatus,
} from "@/api/types";
import { TASK_STATUSES } from "@/api/types";
import {
	db,
	logEvent,
	nextId,
	now,
	pendingApprovalFor,
	runningRunFor,
	type StoredProject,
	type StoredTask,
	taskById,
	toCard,
	toProject,
	toTask,
	userActor,
} from "./db";

const fail = (status: number, message: string) =>
	HttpResponse.json({ message }, { status });
const notFound = (what: string) => fail(404, `${what} not found`);

function actorFrom(request: Request): Actor {
	const header = Number(request.headers.get("X-Iris-User"));
	const user = db.users.find((u) => u.id === header) ?? db.users[0];
	return userActor(user.id);
}

const idOf = (params: Record<string, unknown>, key = "id") =>
	Number(params[key]);

function touch(task: StoredTask) {
	task.updatedAt = now();
	const project = db.projects.find((p) => p.id === task.projectId);
	if (project) project.updatedAt = task.updatedAt;
}

function columnTasks(projectId: number, status: TaskStatus) {
	return db.tasks
		.filter((t) => t.projectId === projectId && t.status === status)
		.sort((a, b) => a.position - b.position);
}

function bottomPosition(projectId: number, status: TaskStatus) {
	const last = columnTasks(projectId, status).at(-1);
	return last ? last.position + 1000 : 1000;
}

function cancelRun(taskId: number) {
	const run = runningRunFor(taskId);
	if (run) {
		run.state = "cancelled";
		run.endedAt = now();
	}
}

function cancelPendingApproval(taskId: number) {
	const approval = pendingApprovalFor(taskId);
	if (approval) {
		approval.state = "cancelled";
		approval.decidedAt = now();
	}
}

/** Sets status and keeps the derived fields (doneAt, run, approval) consistent. */
function setStatus(task: StoredTask, status: TaskStatus) {
	if (task.status === status) return;
	if (task.status === "in_progress" && task.assigneeKind === "agent") {
		cancelRun(task.id);
	}
	if (task.status === "needs_approval") cancelPendingApproval(task.id);
	task.doneAt = status === "done" ? now() : null;
	task.status = status;
	touch(task);
}

function wouldCreateCycle(taskId: number, dependsOnId: number) {
	const seen = new Set<number>();
	const stack = [dependsOnId];
	while (stack.length) {
		const current = stack.pop() as number;
		if (current === taskId) return true;
		if (seen.has(current)) continue;
		seen.add(current);
		for (const d of db.deps)
			if (d.taskId === current) stack.push(d.dependsOnId);
	}
	return false;
}

function dispatchStatus(): DispatchStatus {
	const run = db.runs.find((r) => r.state === "running");
	const task = run ? taskById(run.taskId) : undefined;
	return {
		currentRun:
			run && task
				? {
						runId: run.id,
						taskId: task.id,
						taskTitle: task.title,
						projectId: task.projectId,
						startedAt: run.startedAt,
					}
				: null,
		nextTickAt: run ? null : new Date(Date.now() + 60_000).toISOString(),
	};
}

function taskRef(taskId: number) {
	const task = taskById(taskId) as StoredTask;
	return { id: task.id, title: task.title, status: task.status };
}

function projectRef(projectId: number) {
	const project = db.projects.find((p) => p.id === projectId) as StoredProject;
	return { id: project.id, name: project.name };
}

function addComment(
	taskId: number,
	author: Actor,
	bodyMd: string,
	kind: "comment" | "question" | "answer" = "comment",
	replyToId: number | null = null,
) {
	const comment = {
		id: nextId("comments"),
		taskId,
		author,
		bodyMd,
		kind,
		replyToId,
		resolvedAt: null,
		createdAt: now(),
	};
	db.comments.push(comment);
	return comment;
}

export const handlers = [
	http.get("/api/users", () => HttpResponse.json(db.users)),

	http.get("/api/projects", ({ request }) => {
		const includeArchived =
			new URL(request.url).searchParams.get("includeArchived") === "true";
		const projects = db.projects
			.filter((p) => includeArchived || !p.archivedAt)
			.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
			.map(toProject);
		return HttpResponse.json(projects);
	}),

	http.post("/api/projects", async ({ request }) => {
		const body = (await request.json()) as ProjectCreate;
		if (!body.name?.trim()) return fail(400, "Project name is required");
		const project: StoredProject = {
			id: nextId("projects"),
			name: body.name.trim(),
			briefMd: body.briefMd ?? "",
			archivedAt: null,
			createdAt: now(),
			updatedAt: now(),
		};
		db.projects.push(project);
		return HttpResponse.json(toProject(project), { status: 201 });
	}),

	http.get("/api/projects/:id", ({ params }) => {
		const project = db.projects.find((p) => p.id === idOf(params));
		return project
			? HttpResponse.json(toProject(project))
			: notFound("Project");
	}),

	http.patch("/api/projects/:id", async ({ params, request }) => {
		const project = db.projects.find((p) => p.id === idOf(params));
		if (!project) return notFound("Project");
		const body = (await request.json()) as ProjectPatch;
		if (body.name !== undefined) {
			if (!body.name.trim()) return fail(400, "Project name is required");
			project.name = body.name.trim();
		}
		if (body.briefMd !== undefined) project.briefMd = body.briefMd;
		if (body.archived !== undefined) {
			project.archivedAt = body.archived ? now() : null;
		}
		project.updatedAt = now();
		logEvent(project.id, null, actorFrom(request), "project.updated");
		return HttpResponse.json(toProject(project));
	}),

	http.get("/api/projects/:id/board", ({ params }) => {
		const project = db.projects.find((p) => p.id === idOf(params));
		if (!project) return notFound("Project");
		return HttpResponse.json({
			project: toProject(project),
			columns: TASK_STATUSES.map((status) => ({
				status,
				tasks: columnTasks(project.id, status).map(toCard),
			})),
		});
	}),

	http.get("/api/projects/:id/stream", () => {
		// Keeps the connection open without sending events; the mock never pushes.
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(": connected\n\n"));
			},
		});
		return new HttpResponse(stream, {
			headers: { "Content-Type": "text/event-stream" },
		});
	}),

	http.post("/api/projects/:id/tasks", async ({ params, request }) => {
		const project = db.projects.find((p) => p.id === idOf(params));
		if (!project) return notFound("Project");
		const body = (await request.json()) as TaskCreate;
		if (!body.title?.trim()) return fail(400, "Title is required");
		const status = body.status ?? "backlog";
		if (status !== "backlog" && status !== "ready") {
			return fail(400, "New tasks start in Backlog or Ready");
		}
		const assigneeKind = body.assigneeKind ?? "none";
		const assigneeUserId =
			assigneeKind === "human" ? (body.assigneeUserId ?? null) : null;
		if (
			assigneeKind === "human" &&
			!db.users.some((u) => u.id === assigneeUserId)
		) {
			return fail(400, "A human assignee needs a valid user");
		}
		const actor = actorFrom(request);
		const task: StoredTask = {
			id: nextId("tasks"),
			projectId: project.id,
			title: body.title.trim(),
			descriptionMd: body.descriptionMd ?? "",
			status,
			assigneeKind,
			assigneeUserId,
			outputMd: "",
			position: bottomPosition(project.id, status),
			attempts: 0,
			requireSignOff: body.requireSignOff ?? assigneeKind === "agent",
			createdBy: actor,
			createdAt: now(),
			updatedAt: now(),
			doneAt: null,
		};
		db.tasks.push(task);
		project.updatedAt = task.updatedAt;
		logEvent(project.id, task.id, actor, "task.created");
		return HttpResponse.json(toTask(task), { status: 201 });
	}),

	http.get("/api/projects/:id/notes", ({ params }) => {
		const projectId = idOf(params);
		if (!db.projects.some((p) => p.id === projectId))
			return notFound("Project");
		const notes = db.notes
			.filter((n) => n.projectId === projectId)
			.toSorted(
				(a, b) =>
					Number(b.pinned) - Number(a.pinned) ||
					b.createdAt.localeCompare(a.createdAt),
			);
		return HttpResponse.json(notes);
	}),

	http.post("/api/projects/:id/notes", async ({ params, request }) => {
		const projectId = idOf(params);
		if (!db.projects.some((p) => p.id === projectId))
			return notFound("Project");
		const body = (await request.json()) as NoteCreate;
		if (!body.bodyMd?.trim()) return fail(400, "Note text is required");
		const actor = actorFrom(request);
		const note = {
			id: nextId("notes"),
			projectId,
			author: actor,
			bodyMd: body.bodyMd,
			pinned: body.pinned ?? false,
			createdAt: now(),
		};
		db.notes.push(note);
		logEvent(projectId, null, actor, "note.created", { noteId: note.id });
		return HttpResponse.json(note, { status: 201 });
	}),

	http.patch("/api/notes/:id", async ({ params, request }) => {
		const note = db.notes.find((n) => n.id === idOf(params));
		if (!note) return notFound("Note");
		const body = (await request.json()) as NotePatch;
		if (body.bodyMd !== undefined) {
			if (!body.bodyMd.trim()) return fail(400, "Note text is required");
			note.bodyMd = body.bodyMd;
		}
		if (body.pinned !== undefined) note.pinned = body.pinned;
		return HttpResponse.json(note);
	}),

	http.delete("/api/notes/:id", ({ params }) => {
		const index = db.notes.findIndex((n) => n.id === idOf(params));
		if (index < 0) return notFound("Note");
		db.notes.splice(index, 1);
		return new HttpResponse(null, { status: 204 });
	}),

	http.get("/api/tasks/:id", ({ params }) => {
		const task = taskById(idOf(params));
		return task ? HttpResponse.json(toTask(task)) : notFound("Task");
	}),

	http.patch("/api/tasks/:id", async ({ params, request }) => {
		const task = taskById(idOf(params));
		if (!task) return notFound("Task");
		const body = (await request.json()) as TaskPatch;
		if (body.title !== undefined) {
			if (!body.title.trim()) return fail(400, "Title is required");
			task.title = body.title.trim();
		}
		if (body.descriptionMd !== undefined)
			task.descriptionMd = body.descriptionMd;
		if (body.outputMd !== undefined) task.outputMd = body.outputMd;
		if (body.requireSignOff !== undefined)
			task.requireSignOff = body.requireSignOff;
		if (body.assigneeKind !== undefined) {
			task.assigneeKind = body.assigneeKind;
			task.assigneeUserId =
				body.assigneeKind === "human" ? (body.assigneeUserId ?? null) : null;
			if (
				body.assigneeKind === "human" &&
				!db.users.some((u) => u.id === task.assigneeUserId)
			) {
				return fail(400, "A human assignee needs a valid user");
			}
		}
		task.attempts = 0;
		touch(task);
		logEvent(task.projectId, task.id, actorFrom(request), "task.updated");
		return HttpResponse.json(toTask(task));
	}),

	http.delete("/api/tasks/:id", ({ params, request }) => {
		const task = taskById(idOf(params));
		if (!task) return notFound("Task");
		db.tasks = db.tasks.filter((t) => t.id !== task.id);
		db.deps = db.deps.filter(
			(d) => d.taskId !== task.id && d.dependsOnId !== task.id,
		);
		db.comments = db.comments.filter((c) => c.taskId !== task.id);
		db.approvals = db.approvals.filter((a) => a.taskId !== task.id);
		db.runs = db.runs.filter((r) => r.taskId !== task.id);
		logEvent(task.projectId, null, actorFrom(request), "task.deleted", {
			taskId: task.id,
			title: task.title,
		});
		return new HttpResponse(null, { status: 204 });
	}),

	http.post("/api/tasks/:id/move", async ({ params, request }) => {
		const task = taskById(idOf(params));
		if (!task) return notFound("Task");
		const body = (await request.json()) as MoveTask;
		if (!TASK_STATUSES.includes(body.status))
			return fail(400, "Unknown column");
		if (body.status !== task.status) {
			if (task.assigneeKind === "agent" && body.status === "in_progress") {
				return fail(
					409,
					"Only the dispatcher can move an agent task into In Progress",
				);
			}
			if (body.status === "needs_approval") {
				return fail(
					409,
					"Request an approval to move a task into Needs Approval",
				);
			}
		}
		const column = columnTasks(task.projectId, body.status).filter(
			(t) => t.id !== task.id,
		);
		let position: number;
		if (body.afterTaskId === null || body.afterTaskId === undefined) {
			position = column.length ? column[0].position - 1000 : 1000;
		} else {
			const index = column.findIndex((t) => t.id === body.afterTaskId);
			if (index < 0)
				return fail(400, "afterTaskId is not in the target column");
			const next = column[index + 1];
			position = next
				? (column[index].position + next.position) / 2
				: column[index].position + 1000;
		}
		const from = task.status;
		setStatus(task, body.status);
		task.position = position;
		touch(task);
		logEvent(task.projectId, task.id, actorFrom(request), "task.moved", {
			from,
			to: body.status,
		});
		return HttpResponse.json(toCard(task));
	}),

	http.post("/api/tasks/:id/deps", async ({ params, request }) => {
		const task = taskById(idOf(params));
		if (!task) return notFound("Task");
		const { dependsOnId } = (await request.json()) as { dependsOnId: number };
		const dep = taskById(dependsOnId);
		if (!dep) return notFound("Dependency task");
		if (dep.id === task.id) return fail(400, "A task cannot depend on itself");
		if (dep.projectId !== task.projectId) {
			return fail(400, "Dependencies must be in the same project");
		}
		if (wouldCreateCycle(task.id, dep.id)) {
			return fail(409, "That dependency would create a cycle");
		}
		if (
			!db.deps.some((d) => d.taskId === task.id && d.dependsOnId === dep.id)
		) {
			db.deps.push({ taskId: task.id, dependsOnId: dep.id });
			touch(task);
		}
		return HttpResponse.json(toTask(task));
	}),

	http.delete("/api/tasks/:id/deps/:dependsOnId", ({ params }) => {
		const task = taskById(idOf(params));
		if (!task) return notFound("Task");
		const dependsOnId = idOf(params, "dependsOnId");
		db.deps = db.deps.filter(
			(d) => !(d.taskId === task.id && d.dependsOnId === dependsOnId),
		);
		touch(task);
		return HttpResponse.json(toTask(task));
	}),

	http.get("/api/tasks/:id/comments", ({ params }) => {
		const taskId = idOf(params);
		if (!taskById(taskId)) return notFound("Task");
		return HttpResponse.json(
			db.comments
				.filter((c) => c.taskId === taskId)
				.toSorted(
					(a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
				),
		);
	}),

	http.post("/api/tasks/:id/comments", async ({ params, request }) => {
		const task = taskById(idOf(params));
		if (!task) return notFound("Task");
		const body = (await request.json()) as CommentCreate;
		if (!body.bodyMd?.trim()) return fail(400, "Comment text is required");
		const kind = body.kind ?? "comment";
		const actor = actorFrom(request);
		if (kind === "answer") {
			const question = db.comments.find(
				(c) =>
					c.id === body.replyToId &&
					c.taskId === task.id &&
					c.kind === "question" &&
					!c.resolvedAt,
			);
			if (!question)
				return fail(400, "An answer must reply to an open question");
			question.resolvedAt = now();
			if (task.status === "blocked") setStatus(task, "ready");
		} else if (kind === "question") {
			setStatus(task, "blocked");
		}
		const comment = addComment(
			task.id,
			actor,
			body.bodyMd,
			kind,
			body.replyToId ?? null,
		);
		touch(task);
		logEvent(task.projectId, task.id, actor, "comment.created", { kind });
		return HttpResponse.json(comment, { status: 201 });
	}),

	http.get("/api/tasks/:id/approvals", ({ params }) => {
		const taskId = idOf(params);
		if (!taskById(taskId)) return notFound("Task");
		return HttpResponse.json(
			db.approvals.filter((a) => a.taskId === taskId).toReversed(),
		);
	}),

	http.post("/api/tasks/:id/approvals", async ({ params, request }) => {
		const task = taskById(idOf(params));
		if (!task) return notFound("Task");
		const body = (await request.json()) as ApprovalCreate;
		if (!body.summary?.trim()) return fail(400, "A summary is required");
		if (pendingApprovalFor(task.id)) {
			return fail(409, "This task already has a pending approval");
		}
		if (task.status === "done") {
			return fail(409, "A done task cannot be sent for approval");
		}
		const actor = actorFrom(request);
		const approval: Approval = {
			id: nextId("approvals"),
			taskId: task.id,
			runId: null,
			kind: body.kind,
			requestedBy: actor,
			approverUserId: body.approverUserId ?? null,
			summary: body.summary,
			payloadMd: body.payloadMd ?? "",
			state: "pending",
			decidedBy: null,
			decisionComment: null,
			createdAt: now(),
			decidedAt: null,
		};
		db.approvals.push(approval);
		setStatus(task, "needs_approval");
		task.position = bottomPosition(task.projectId, "needs_approval");
		logEvent(task.projectId, task.id, actor, "approval.requested", {
			approvalId: approval.id,
		});
		return HttpResponse.json(approval, { status: 201 });
	}),

	http.get("/api/tasks/:id/runs", ({ params }) => {
		const taskId = idOf(params);
		if (!taskById(taskId)) return notFound("Task");
		return HttpResponse.json(
			db.runs.filter((r) => r.taskId === taskId).toReversed(),
		);
	}),

	http.get("/api/approvals", ({ request }) => {
		const url = new URL(request.url);
		const state = url.searchParams.get("state");
		const approver = url.searchParams.get("approverUserId");
		const items = db.approvals
			.filter((a) => !state || a.state === state)
			.filter(
				(a) =>
					!approver ||
					a.approverUserId === null ||
					a.approverUserId === Number(approver),
			)
			.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
			.map((approval) => {
				const task = taskById(approval.taskId) as StoredTask;
				return {
					approval,
					task: taskRef(task.id),
					project: projectRef(task.projectId),
				};
			});
		return HttpResponse.json(items);
	}),

	http.post("/api/approvals/:id/decide", async ({ params, request }) => {
		const approval = db.approvals.find((a) => a.id === idOf(params));
		if (!approval) return notFound("Approval");
		const body = (await request.json()) as ApprovalDecision;
		if (
			!["approved", "changes_requested", "rejected"].includes(body.decision)
		) {
			return fail(400, "Unknown decision");
		}
		const comment = body.comment?.trim();
		if (body.decision !== "approved" && !comment) {
			return fail(
				400,
				"A comment is required when requesting changes or rejecting",
			);
		}
		if (approval.state !== "pending") {
			return fail(409, "This approval has already been decided");
		}
		const task = taskById(approval.taskId) as StoredTask;
		const actor = actorFrom(request);
		approval.state = body.decision;
		approval.decidedBy = actor;
		approval.decisionComment = comment ?? null;
		approval.decidedAt = now();
		if (body.decision === "approved") {
			if (approval.kind === "sign_off") {
				task.outputMd = approval.payloadMd;
				setStatus(task, "done");
			} else {
				setStatus(task, "ready");
			}
		} else if (body.decision === "changes_requested") {
			setStatus(task, "ready");
		} else {
			setStatus(task, "backlog");
		}
		task.position = bottomPosition(task.projectId, task.status);
		if (comment) addComment(task.id, actor, comment);
		logEvent(task.projectId, task.id, actor, "approval.decided", {
			approvalId: approval.id,
			decision: body.decision,
		});
		return HttpResponse.json(approval);
	}),

	http.get("/api/questions", ({ request }) => {
		const state = new URL(request.url).searchParams.get("state");
		const items = db.comments
			.filter((c) => c.kind === "question")
			.filter(
				(c) => !state || (state === "open" ? !c.resolvedAt : !!c.resolvedAt),
			)
			.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
			.map((question) => {
				const task = taskById(question.taskId) as StoredTask;
				return {
					question,
					task: taskRef(task.id),
					project: projectRef(task.projectId),
				};
			});
		return HttpResponse.json(items);
	}),

	http.get("/api/runs/:id", ({ params }) => {
		const run = db.runs.find((r) => r.id === idOf(params));
		return run ? HttpResponse.json(run) : notFound("Run");
	}),

	http.get("/api/runs/:id/context", ({ params }) => {
		const run = db.runs.find((r) => r.id === idOf(params));
		const task = run ? taskById(run.taskId) : undefined;
		if (!run || !task) return notFound("Run");
		const project = db.projects.find((p) => p.id === task.projectId);
		const notes = db.notes
			.filter((n) => n.projectId === task.projectId)
			.map((n) => `- ${n.pinned ? "[pinned] " : ""}${n.bodyMd}`)
			.join("\n");
		const comments = db.comments
			.filter((c) => c.taskId === task.id)
			.map((c) => `- (${c.kind}) ${c.bodyMd}`)
			.join("\n");
		return HttpResponse.json({
			runId: run.id,
			contentMd: [
				"# Board rules",
				"End the run with exactly one terminal action.",
				"# Project brief",
				project?.briefMd ?? "",
				"# Notes",
				notes,
				`# Task: ${task.title}`,
				task.descriptionMd,
				"# Comments",
				comments,
			].join("\n\n"),
		});
	}),

	http.post("/api/runs/:id/cancel", ({ params }) => {
		const run = db.runs.find((r) => r.id === idOf(params));
		if (!run) return notFound("Run");
		if (run.state !== "running")
			return fail(409, "This run is no longer running");
		run.state = "cancelled";
		run.endedAt = now();
		const task = taskById(run.taskId);
		if (task?.status === "in_progress") setStatus(task, "blocked");
		return HttpResponse.json(run);
	}),

	http.post("/api/dispatch/run-now", async () => {
		await delay(100);
		const busy = db.runs.some((r) => r.state === "running");
		const next = busy
			? undefined
			: db.tasks
					.filter(
						(t) =>
							t.status === "ready" &&
							t.assigneeKind === "agent" &&
							toCard(t).waitingOn === 0,
					)
					.toSorted((a, b) => a.position - b.position)[0];
		if (next) {
			setStatus(next, "in_progress");
			next.position = bottomPosition(next.projectId, "in_progress");
			db.runs.push({
				id: nextId("runs"),
				taskId: next.id,
				executor: "hermes",
				model: "default",
				state: "running",
				summary: null,
				error: null,
				costUsd: null,
				logRef: null,
				sessionRef: null,
				startedAt: now(),
				endedAt: null,
			});
			logEvent(next.projectId, next.id, { kind: "system" }, "run.started");
		}
		return HttpResponse.json(dispatchStatus());
	}),

	http.get("/api/dispatch/status", () => HttpResponse.json(dispatchStatus())),

	http.get("/api/events", ({ request }) => {
		const url = new URL(request.url);
		const projectId = Number(url.searchParams.get("project_id"));
		const limit = Number(url.searchParams.get("limit") ?? 50);
		if (!Number.isInteger(projectId))
			return fail(400, "project_id is required");
		return HttpResponse.json(
			db.events
				.filter((e) => e.projectId === projectId)
				.toReversed()
				.slice(0, limit),
		);
	}),
];
