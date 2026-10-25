import { lazy, Suspense } from "react";
import { useSearchParams } from "wouter";

const TaskDrawer = lazy(() => import("./TaskDrawer"));

/** Mounts the lazy task drawer while `?task=<id>` is in the URL. */
export function TaskDrawerMount({ projectId }: { projectId: number }) {
	const [params] = useSearchParams();
	const raw = params.get("task");
	if (raw === null) return null;
	return (
		<Suspense fallback={null}>
			<TaskDrawer projectId={projectId} rawId={raw} />
		</Suspense>
	);
}
