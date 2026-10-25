export const queryKeys = {
	users: ["users"] as const,
	projects: {
		all: ["projects"] as const,
		/** Prefix of every list variant (with and without archived). */
		lists: ["projects", "list"] as const,
		list: (includeArchived = false) =>
			["projects", "list", { includeArchived }] as const,
		detail: (id: number) => ["projects", "detail", id] as const,
		board: (id: number) => ["projects", id, "board"] as const,
		notes: (id: number) => ["projects", id, "notes"] as const,
		events: (id: number) => ["projects", id, "events"] as const,
	},
	tasks: {
		all: ["tasks"] as const,
		detail: (id: number) => ["tasks", id] as const,
		comments: (id: number) => ["tasks", id, "comments"] as const,
		approvals: (id: number) => ["tasks", id, "approvals"] as const,
		runs: (id: number) => ["tasks", id, "runs"] as const,
	},
	approvals: {
		all: ["approvals"] as const,
		list: (state: string = "pending", approverUserId?: number) =>
			["approvals", { state, approverUserId }] as const,
	},
	questions: {
		all: ["questions"] as const,
		list: (state: string = "open") => ["questions", { state }] as const,
	},
	runs: {
		detail: (id: number) => ["runs", id] as const,
		context: (id: number) => ["runs", id, "context"] as const,
	},
	dispatch: { status: ["dispatch", "status"] as const },
};
