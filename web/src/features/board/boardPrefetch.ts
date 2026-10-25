import type { Board } from "@/api/types";

/** Set by the inline script in index.html (production builds only). */
export interface BoardPrefetch {
	projectId: number;
	startedAt: number;
	promise: Promise<Response>;
}

declare global {
	interface Window {
		__irisBoardPrefetch?: BoardPrefetch;
	}
}

export const PREFETCH_MAX_AGE_MS = 10_000;

/**
 * Takes the board response the page started before the JS loaded. It is used
 * at most once, only for the same project and only while fresh; any failure
 * returns null so the caller fetches normally.
 */
export async function consumeBoardPrefetch(
	projectId: number,
	now = Date.now(),
): Promise<Board | null> {
	if (typeof window === "undefined") return null;
	const prefetch = window.__irisBoardPrefetch;
	if (!prefetch) return null;
	window.__irisBoardPrefetch = undefined;
	if (
		prefetch.projectId !== projectId ||
		now - prefetch.startedAt > PREFETCH_MAX_AGE_MS
	) {
		return null;
	}
	try {
		const response = await prefetch.promise;
		if (!response.ok) return null;
		return (await response.json()) as Board;
	} catch {
		return null;
	}
}
