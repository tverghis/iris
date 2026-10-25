import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

declare const __APP_BUILD__: string | undefined;

export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
/** Persisted queries must stay in memory at least this long to be dehydrated. */
export const PERSIST_GC_TIME = 24 * 60 * 60 * 1000;

const PERSISTED_ROOTS = new Set([
	"users",
	"projects",
	"tasks",
	"approvals",
	"questions",
]);
// Live or high-churn data that is not worth restoring.
const SKIPPED_PARTS = new Set(["events", "runs"]);

/** Only successful board, project, task and inbox queries go to IndexedDB. */
export function shouldDehydrateQuery(
	query: Pick<Query, "queryKey" | "state">,
): boolean {
	if (query.state.status !== "success") return false;
	const [root, ...rest] = query.queryKey;
	if (typeof root !== "string" || !PERSISTED_ROOTS.has(root)) return false;
	return !rest.some(
		(part) => typeof part === "string" && SKIPPED_PARTS.has(part),
	);
}

// Tied to the build so a new deploy never restores an old cache shape.
const BUSTER = typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : "dev";

// IndexedDB can be missing or throw (private mode, quota); run without a cache.
const idbStorage = {
	getItem: async (key: string) => {
		try {
			return (await get<string>(key)) ?? null;
		} catch {
			return null;
		}
	},
	setItem: async (key: string, value: string) => {
		try {
			await set(key, value);
		} catch {
			// ignore
		}
	},
	removeItem: async (key: string) => {
		try {
			await del(key);
		} catch {
			// ignore
		}
	},
};

export function createPersistOptions(): PersistQueryClientProviderProps["persistOptions"] {
	return {
		persister: createAsyncStoragePersister({
			storage: idbStorage,
			key: "iris-query-cache",
			throttleTime: 1000,
		}),
		maxAge: PERSIST_MAX_AGE,
		buster: BUSTER,
		dehydrateOptions: { shouldDehydrateQuery },
	};
}
