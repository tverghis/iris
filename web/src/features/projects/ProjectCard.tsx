import { Link } from "wouter";
import type { Project } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div
			className={cn("flex items-baseline gap-1.5", value === 0 && "opacity-60")}
		>
			<dd className="text-lg font-semibold tabular-nums">{value}</dd>
			<dt className="text-sm text-muted-foreground">{label}</dt>
		</div>
	);
}

interface Props {
	project: Project;
	onArchive: (project: Project) => void;
	onUnarchive: (project: Project) => void;
}

export function ProjectCard({ project, onArchive, onUnarchive }: Props) {
	const archived = project.archivedAt !== null;
	return (
		<li
			aria-label={project.name}
			className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground"
		>
			<div className="flex items-start justify-between gap-2">
				<Link
					href={`/projects/${project.id}`}
					className="min-w-0 break-words text-base font-medium hover:underline"
				>
					{project.name}
				</Link>
				{archived && <Badge variant="secondary">Archived</Badge>}
				{project.agentRunning && !archived && (
					<Badge variant="outline">
						<span
							aria-hidden
							className="size-2 shrink-0 rounded-full bg-green-500"
						/>
						Agent running
					</Badge>
				)}
			</div>
			<dl className="flex gap-6">
				<Stat label="Needs approval" value={project.needsApprovalCount} />
				<Stat label="Blocked" value={project.blockedCount} />
			</dl>
			<div className="flex justify-end">
				{archived ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onUnarchive(project)}
					>
						Unarchive
					</Button>
				) : (
					<Button variant="ghost" size="sm" onClick={() => onArchive(project)}>
						Archive
					</Button>
				)}
			</div>
		</li>
	);
}
