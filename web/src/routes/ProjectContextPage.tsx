import { Link, useParams } from "wouter";
import { BriefEditor } from "@/features/context/BriefEditor";
import { useProject } from "@/features/context/hooks";
import { NotesList } from "@/features/context/NotesList";

export function Component() {
	const projectId = Number(useParams<{ projectId: string }>().projectId);
	const { data: project, isPending } = useProject(projectId);

	return (
		<section className="space-y-4">
			<header>
				<h1 className="text-xl font-semibold">Project context</h1>
				{project && (
					<Link
						href={`/projects/${project.id}`}
						className="text-sm text-muted-foreground underline-offset-2 hover:underline"
					>
						{project.name} board
					</Link>
				)}
			</header>
			{isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
			{project && (
				<div className="grid gap-6 lg:grid-cols-2 lg:items-start">
					<BriefEditor key={project.id} project={project} />
					<NotesList projectId={project.id} />
				</div>
			)}
		</section>
	);
}
