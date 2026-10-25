import { useState } from "react";
import type { Project } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useProjects, useSetArchived } from "./api";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectCard } from "./ProjectCard";

export function ProjectsView() {
	const [showArchived, setShowArchived] = useState(false);
	const [confirming, setConfirming] = useState<Project | null>(null);
	const projects = useProjects(showArchived);
	const setArchived = useSetArchived();

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-xl font-semibold">Projects</h1>
				<div className="flex items-center gap-2">
					<Checkbox
						id="show-archived"
						checked={showArchived}
						onCheckedChange={(v) => setShowArchived(v === true)}
					/>
					<Label htmlFor="show-archived">Show archived</Label>
				</div>
			</div>
			<CreateProjectForm />

			{projects.isPending ? (
				<p role="status" className="text-sm text-muted-foreground">
					Loading projects...
				</p>
			) : projects.isError ? (
				<div role="alert" className="flex items-center gap-3 text-sm">
					<span>Could not load projects.</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => projects.refetch()}
					>
						Retry
					</Button>
				</div>
			) : projects.data.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{showArchived
						? "No projects yet."
						: "No projects yet. Create one above to get started."}
				</p>
			) : (
				<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{projects.data.map((project) => (
						<ProjectCard
							key={project.id}
							project={project}
							onArchive={setConfirming}
							onUnarchive={(p) =>
								setArchived.mutate({ id: p.id, archived: false })
							}
						/>
					))}
				</ul>
			)}

			<Dialog
				open={confirming !== null}
				onOpenChange={(open) => !open && setConfirming(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Archive project?</DialogTitle>
						<DialogDescription>
							{confirming?.name} will be hidden from the list. You can unarchive
							it later.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirming(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								if (confirming)
									setArchived.mutate({ id: confirming.id, archived: true });
								setConfirming(null);
							}}
						>
							Archive
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
