import { useParams } from "wouter";
import { BoardView } from "@/features/board/BoardView";

export function Component() {
	const { projectId } = useParams<{ projectId: string }>();
	const id = Number(projectId);
	if (!Number.isInteger(id)) {
		return <p className="text-sm">Project not found.</p>;
	}
	return <BoardView key={id} projectId={id} />;
}
