import { HttpResponse } from "msw";
import type { StreamEvent } from "@/api/types";
import {
	db,
	logListeners,
	type StoredEvent,
	type StoredTask,
	taskById,
	toCard,
	toProject,
} from "./db";

type Subscriber = (event: StreamEvent) => void;
const subscribers = new Map<Subscriber, number>();

export function publish(projectId: number, event: StreamEvent) {
	for (const [subscriber, id] of subscribers) {
		if (id === projectId) subscriber(event);
	}
}

export function publishTask(
	task: StoredTask,
	type: "task.created" | "task.updated" = "task.updated",
) {
	publish(task.projectId, { type, task: toCard(task), taskId: task.id });
}

/** Maps the activity log onto the stream events the real backend sends. */
function fromLog(event: StoredEvent) {
	const { projectId, type } = event;
	const taskId =
		event.taskId ??
		(typeof event.data.taskId === "number" ? event.data.taskId : null);
	const task = taskId === null ? undefined : taskById(taskId);

	if (type === "task.deleted" && taskId !== null) {
		publish(projectId, { type: "task.deleted", taskId });
		return;
	}
	if (type === "project.updated") {
		const project = db.projects.find((p) => p.id === projectId);
		if (project) {
			publish(projectId, { type, project: toProject(project) });
		}
		return;
	}
	if (task) {
		publishTask(
			task,
			type === "task.created" ? "task.created" : "task.updated",
		);
	}
	if (taskId === null) {
		if (type.startsWith("note.")) publish(projectId, { type: "note.changed" });
		return;
	}
	if (type === "comment.created") {
		publish(projectId, { type, taskId });
		if (event.data.kind === "question" || event.data.kind === "answer") {
			publish(projectId, { type: "question.changed", taskId });
		}
	} else if (type.startsWith("approval.")) {
		publish(projectId, { type: "approval.changed", taskId });
	} else if (type.startsWith("run.")) {
		publish(projectId, { type: "run.changed", taskId });
	}
}

logListeners.add(fromLog);

export function streamResponse(projectId: number) {
	const encoder = new TextEncoder();
	let subscriber: Subscriber | undefined;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(": connected\n\n"));
			subscriber = (event) =>
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
				);
			subscribers.set(subscriber, projectId);
		},
		cancel() {
			if (subscriber) subscribers.delete(subscriber);
		},
	});
	return new HttpResponse(stream, {
		headers: { "Content-Type": "text/event-stream" },
	});
}
