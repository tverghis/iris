import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { getCurrentUserId } from "@/lib/currentUser";

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

// One cache per user, so switching users never shows or saves the wrong data.
const userKey = (key: string) => `${key}:${getCurrentUserId() ?? "anon"}`;

// IndexedDB can be missing or throw (private mode, quota); run without a cache.
const idbStorage = {
	getItem: async (key: string) => {
		try {
			return (await get<string>(userKey(key))) ?? null;
		} catch {
			return null;
		}
	},
	setItem: async (key: string, value: string) => {
		try {
			await set(userKey(key), value);
		} catch {
			// ignore
		}
	},
	removeItem: async (key: string) => {
		try {
			await del(userKey(key));
		} catch {
			// ignore
		}
	},
};

export function createPersistOptions(
	queryClient: QueryClient,
): PersistQueryClientProviderProps["persistOptions"] {
	return {
		persister: createAsyncStoragePersister({
			storage: idbStorage,
			key: "iris-query-cache",
			throttleTime: 1000,
		}),
		maxAge: PERSIST_MAX_AGE,
		buster: BUSTER,
		dehydrateOptions: {
			// Mid-mutation caches hold optimistic placeholders; the next event after
			// the mutation settles persists the real data.
			shouldDehydrateQuery: (query) =>
				queryClient.isMutating() === 0 && shouldDehydrateQuery(query),
		},
	};
}
