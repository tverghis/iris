import { useCallback, useMemo, useState } from "react";
import type { TaskStatus } from "@/api/types";

type Stored = Partial<Record<TaskStatus, boolean>>;

const key = (projectId: number) => `iris:collapsed:${projectId}`;

function load(projectId: number): Stored {
	try {
		const parsed: unknown = JSON.parse(
			localStorage.getItem(key(projectId)) ?? "{}",
		);
		return parsed && typeof parsed === "object" ? (parsed as Stored) : {};
	} catch {
		return {};
	}
}

/**
 * Per-device, per-project collapsed state of the stacked mobile sections.
 * Done starts collapsed. `setExpandedOnly` lets a drag collapse every column
 * except the given ones without touching the saved state; pass null to restore.
 */
export function useColumnCollapse(projectId: number) {
	const [stored, setStored] = useState(() => load(projectId));
	const [override, setOverride] = useState<ReadonlySet<TaskStatus> | null>(
		null,
	);

	const isCollapsed = useCallback(
		(status: TaskStatus) =>
			override ? !override.has(status) : (stored[status] ?? status === "done"),
		[stored, override],
	);

	const toggle = useCallback(
		(status: TaskStatus) =>
			setStored((prev) => {
				const next = {
					...prev,
					[status]: !(prev[status] ?? status === "done"),
				};
				try {
					localStorage.setItem(key(projectId), JSON.stringify(next));
				} catch {
					// Storage unavailable: the state still works for this session.
				}
				return next;
			}),
		[projectId],
	);

	const setExpandedOnly = useCallback(
		(expanded: Iterable<TaskStatus> | null) =>
			setOverride(expanded ? new Set(expanded) : null),
		[],
	);

	return useMemo(
		() => ({ isCollapsed, toggle, setExpandedOnly }),
		[isCollapsed, toggle, setExpandedOnly],
	);
}
