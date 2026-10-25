import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateProject } from "./api";

export function CreateProjectForm() {
	const [name, setName] = useState("");
	const [, navigate] = useLocation();
	const create = useCreateProject();
	const trimmed = name.trim();

	return (
		<form
			className="flex gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				if (!trimmed || create.isPending) return;
				create.mutate(trimmed, {
					onSuccess: (project) => navigate(`/projects/${project.id}`),
				});
			}}
		>
			<Input
				aria-label="Project name"
				placeholder="New project name"
				value={name}
				onChange={(e) => setName(e.target.value)}
				maxLength={200}
			/>
			<Button type="submit" disabled={!trimmed || create.isPending}>
				Create project
			</Button>
		</form>
	);
}
