import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/api/queryKeys";
import type { StreamEvent } from "@/api/types";
import { handleStreamEvent } from "./handleEvent";

export const POLL_MS = 15_000;
export const BACKOFF_START_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;
/** Consecutive failed connections before the board is polled instead. */
export const POLL_AFTER_FAILURES = 3;
/** A connection counts as healthy after its first message or this long open. */
export const STABLE_MS = 10_000;

/**
 * Keeps one project's board live over SSE. The stream is read-only and needs no
 * identity (EventSource cannot send the dev X-Iris-User header). Reconnects with
 * backoff, resyncs when the page becomes visible again (iOS suspends connections),
 * and polls the board every 15 s while SSE is unavailable.
 */
export function useProjectStream(projectId: number) {
	const queryClient = useQueryClient();

	useEffect(() => {
		let source: EventSource | null = null;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let stableTimer: ReturnType<typeof setTimeout> | undefined;
		let pollTimer: ReturnType<typeof setInterval> | undefined;
		let backoff = BACKOFF_START_MS;
		let failures = 0;
		let needsResync = false;
		let disposed = false;

		const visible = () => document.visibilityState === "visible";
		const refetchBoard = () => {
			needsResync = false;
			void queryClient.refetchQueries({
				queryKey: queryKeys.projects.board(projectId),
				exact: true,
			});
		};
		// Events may have been missed: refresh everything the stream keeps current.
		const resync = () => {
			refetchBoard();
			for (const queryKey of [
				queryKeys.tasks.all,
				queryKeys.questions.all,
				queryKeys.approvals.all,
				queryKeys.projects.lists,
			]) {
				void queryClient.invalidateQueries({ queryKey });
			}
		};

		const stopPolling = () => {
			clearInterval(pollTimer);
			pollTimer = undefined;
		};
		const startPolling = () => {
			if (pollTimer !== undefined) return;
			pollTimer = setInterval(() => {
				if (visible()) refetchBoard();
			}, POLL_MS);
		};

		const connect = () => {
			if (disposed || source) return;
			if (typeof EventSource === "undefined") {
				startPolling();
				return;
			}
			const es = new EventSource(`/api/projects/${projectId}/stream`);
			source = es;
			// An open that drops at once must keep backing off and fall back to polling.
			const markHealthy = () => {
				clearTimeout(stableTimer);
				failures = 0;
				backoff = BACKOFF_START_MS;
				stopPolling();
			};
			es.onopen = () => {
				clearTimeout(stableTimer);
				stableTimer = setTimeout(markHealthy, STABLE_MS);
				if (needsResync) resync();
			};
			es.onmessage = (message) => {
				markHealthy();
				let event: StreamEvent;
				try {
					event = JSON.parse(message.data) as StreamEvent;
				} catch {
					return;
				}
				handleStreamEvent(queryClient, projectId, event);
			};
			es.onerror = () => {
				clearTimeout(stableTimer);
				es.close();
				if (source === es) source = null;
				needsResync = true;
				failures += 1;
				if (failures >= POLL_AFTER_FAILURES) startPolling();
				clearTimeout(retryTimer);
				retryTimer = setTimeout(connect, backoff);
				backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
			};
		};

		const onVisibility = () => {
			if (!visible()) return;
			resync();
			if (!source) {
				clearTimeout(retryTimer);
				backoff = BACKOFF_START_MS;
				connect();
			}
		};

		connect();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			disposed = true;
			document.removeEventListener("visibilitychange", onVisibility);
			clearTimeout(retryTimer);
			clearTimeout(stableTimer);
			stopPolling();
			source?.close();
			source = null;
		};
	}, [projectId, queryClient]);
}
