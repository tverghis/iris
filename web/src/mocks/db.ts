import type {
	Actor,
	Approval,
	Comment,
	Note,
	Project,
	Run,
	Task,
	TaskCard,
	User,
} from "@/api/types";

export type StoredProject = Pick<
	Project,
	"id" | "name" | "briefMd" | "archivedAt" | "createdAt" | "updatedAt"
>;
export type StoredTask = Omit<
	Task,
	"waitingOn" | "pendingApproval" | "running" | "dependencies"
> & { assigneeKind: Task["assigneeKind"] };
export interface StoredEvent {
	id: number;
	projectId: number;
	taskId: number | null;
	actor: Actor;
	type: string;
	data: Record<string, unknown>;
	createdAt: string;
}

export interface Db {
	users: User[];
	projects: StoredProject[];
	tasks: StoredTask[];
	deps: { taskId: number; dependsOnId: number }[];
	comments: Comment[];
	notes: Note[];
	approvals: Approval[];
	runs: Run[];
	events: StoredEvent[];
	nextId: Record<string, number>;
}

export const db: Db = {
	users: [],
	projects: [],
	tasks: [],
	deps: [],
	comments: [],
	notes: [],
	approvals: [],
	runs: [],
	events: [],
	nextId: {},
};

export function nextId(table: keyof Db): number {
	const id = (db.nextId[table] ?? 0) + 1;
	db.nextId[table] = id;
	return id;
}

export const now = () => new Date().toISOString();
const ago = (minutes: number) =>
	new Date(Date.now() - minutes * 60_000).toISOString();

export const userActor = (userId: number): Actor => ({
	kind: "user",
	userId,
	name: db.users.find((u) => u.id === userId)?.name,
});
export const agentActor: Actor = { kind: "agent", name: "Agent" };

export function logEvent(
	projectId: number,
	taskId: number | null,
	actor: Actor,
	type: string,
	data: Record<string, unknown> = {},
) {
	db.events.push({
		id: nextId("events"),
		projectId,
		taskId,
		actor,
		type,
		data,
		createdAt: now(),
	});
}

export function taskById(id: number) {
	return db.tasks.find((t) => t.id === id);
}

export function pendingApprovalFor(taskId: number) {
	return db.approvals.find((a) => a.taskId === taskId && a.state === "pending");
}

export function runningRunFor(taskId: number) {
	return db.runs.find((r) => r.taskId === taskId && r.state === "running");
}

export function dependenciesOf(taskId: number) {
	return db.deps
		.filter((d) => d.taskId === taskId)
		.flatMap((d) => {
			const dep = taskById(d.dependsOnId);
			return dep ? [{ id: dep.id, title: dep.title, status: dep.status }] : [];
		});
}

export function toCard(task: StoredTask): TaskCard {
	const approval = pendingApprovalFor(task.id);
	return {
		id: task.id,
		projectId: task.projectId,
		title: task.title,
		status: task.status,
		position: task.position,
		assigneeKind: task.assigneeKind,
		assigneeUserId: task.assigneeUserId,
		waitingOn: dependenciesOf(task.id).filter((d) => d.status !== "done")
			.length,
		pendingApproval: approval
			? {
					id: approval.id,
					kind: approval.kind,
					approverUserId: approval.approverUserId,
				}
			: null,
		running: !!runningRunFor(task.id),
		requireSignOff: task.requireSignOff,
		doneAt: task.doneAt,
		updatedAt: task.updatedAt,
	};
}

export function toTask(task: StoredTask): Task {
	return { ...task, ...toCard(task), dependencies: dependenciesOf(task.id) };
}

export function toProject(project: StoredProject): Project {
	const tasks = db.tasks.filter((t) => t.projectId === project.id);
	return {
		...project,
		needsApprovalCount: tasks.filter((t) => t.status === "needs_approval")
			.length,
		blockedCount: tasks.filter((t) => t.status === "blocked").length,
		agentRunning: tasks.some((t) => runningRunFor(t.id)),
	};
}

interface SeedTask {
	title: string;
	status: StoredTask["status"];
	agent?: boolean;
	userId?: number;
	desc?: string;
	output?: string;
}

function seedTask(projectId: number, position: number, s: SeedTask) {
	const created = ago(60 * 24 * 3);
	const task: StoredTask = {
		id: nextId("tasks"),
		projectId,
		title: s.title,
		descriptionMd: s.desc ?? "",
		status: s.status,
		assigneeKind: s.agent ? "agent" : s.userId ? "human" : "none",
		assigneeUserId: s.userId ?? null,
		outputMd: s.output ?? "",
		position,
		attempts: 0,
		requireSignOff: !!s.agent,
		createdBy: userActor(1),
		createdAt: created,
		updatedAt: ago(30),
		doneAt: s.status === "done" ? ago(120) : null,
	};
	db.tasks.push(task);
	return task;
}

export function resetDb() {
	db.users = [
		{ id: 1, name: "Tarun", email: "tarun@example.com" },
		{ id: 2, name: "Partner", email: "partner@example.com" },
	];
	db.projects = [];
	db.tasks = [];
	db.deps = [];
	db.comments = [];
	db.notes = [];
	db.approvals = [];
	db.runs = [];
	db.events = [];
	db.nextId = {};

	const trip: StoredProject = {
		id: nextId("projects"),
		name: "Summer trip",
		briefMd:
			"# Goal\nA relaxed week by the sea in August.\n\n- Budget: 3000\n- Dealbreakers: long drives, no kitchen",
		archivedAt: null,
		createdAt: ago(60 * 24 * 7),
		updatedAt: ago(10),
	};
	const house: StoredProject = {
		id: nextId("projects"),
		name: "Kitchen refresh",
		briefMd: "Repaint cabinets and replace the lighting.",
		archivedAt: null,
		createdAt: ago(60 * 24 * 14),
		updatedAt: ago(60 * 5),
	};
	db.projects.push(trip, house);

	const p = trip.id;
	const t = (position: number, s: SeedTask) => seedTask(p, position * 1000, s);
	const t1 = t(1, { title: "Pick a destination", status: "done", userId: 1 });
	const t2 = t(2, {
		title: "Shortlist coastal towns",
		status: "needs_approval",
		agent: true,
		desc: "Find five towns with a train station and a kitchen rental.",
	});
	const t3 = t(1, {
		title: "Compare accommodation options",
		status: "ready",
		agent: true,
	});
	t(2, { title: "Check passport expiry", status: "ready", userId: 2 });
	const t5 = t(1, {
		title: "Research rail passes",
		status: "in_progress",
		agent: true,
	});
	const t6 = t(2, {
		title: "Book the flights",
		status: "in_progress",
		userId: 1,
	});
	const t7 = t(1, {
		title: "Which airport do you prefer?",
		status: "blocked",
		agent: true,
		desc: "Needs a decision before prices can be compared.",
	});
	t(1, { title: "Draft packing list", status: "backlog" });
	t(2, { title: "Travel insurance quotes", status: "backlog", agent: true });
	const t10 = t(3, { title: "Rent a car", status: "backlog", userId: 2 });
	t(2, { title: "Create shared photo album", status: "done", userId: 2 });
	const t12 = t(3, {
		title: "Reserve restaurants",
		status: "ready",
		agent: true,
	});
	seedTask(house.id, 1000, {
		title: "Choose paint colours",
		status: "ready",
		userId: 1,
	});
	seedTask(house.id, 1000, {
		title: "Get electrician quote",
		status: "backlog",
	});

	for (const [taskId, dependsOnId] of [
		[t3.id, t2.id],
		[t12.id, t2.id],
		[t3.id, t1.id],
		[t10.id, t6.id],
	]) {
		db.deps.push({ taskId, dependsOnId });
	}

	db.notes.push(
		{
			id: nextId("notes"),
			projectId: p,
			author: userActor(1),
			bodyMd: "We can only travel in the second half of August.",
			pinned: true,
			createdAt: ago(60 * 24 * 5),
		},
		{
			id: nextId("notes"),
			projectId: p,
			author: agentActor,
			bodyMd: "Trains in the region run hourly until 22:00.",
			pinned: false,
			createdAt: ago(60 * 24),
		},
	);

	db.approvals.push({
		id: nextId("approvals"),
		taskId: t2.id,
		runId: null,
		kind: "sign_off",
		requestedBy: agentActor,
		approverUserId: null,
		summary: "Five coastal towns that fit the brief",
		payloadMd: "1. Cadaques\n2. Collioure\n3. Camogli\n4. Piran\n5. Vis",
		state: "pending",
		decidedBy: null,
		decisionComment: null,
		createdAt: ago(45),
		decidedAt: null,
	});

	db.comments.push(
		{
			id: nextId("comments"),
			taskId: t7.id,
			author: agentActor,
			bodyMd:
				"Do you prefer flying from the city airport or the cheaper one 90 minutes away?",
			kind: "question",
			replyToId: null,
			resolvedAt: null,
			createdAt: ago(90),
		},
		{
			id: nextId("comments"),
			taskId: t2.id,
			author: userActor(2),
			bodyMd: "Please keep it under four hours of travel.",
			kind: "comment",
			replyToId: null,
			resolvedAt: null,
			createdAt: ago(60 * 20),
		},
	);

	db.runs.push(
		{
			id: nextId("runs"),
			taskId: t2.id,
			executor: "hermes",
			model: "default",
			state: "needs_human",
			summary: "Requested sign-off on the shortlist",
			error: null,
			costUsd: 0.12,
			logRef: null,
			sessionRef: "hermes-session-1",
			startedAt: ago(60),
			endedAt: ago(45),
		},
		{
			id: nextId("runs"),
			taskId: t5.id,
			executor: "hermes",
			model: "default",
			state: "running",
			summary: null,
			error: null,
			costUsd: null,
			logRef: null,
			sessionRef: "hermes-session-2",
			startedAt: ago(5),
			endedAt: null,
		},
	);

	logEvent(p, t1.id, userActor(1), "task.moved", { to: "done" });
	logEvent(p, t2.id, agentActor, "approval.requested", {});
}

resetDb();
