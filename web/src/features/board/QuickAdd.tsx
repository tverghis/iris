import { useState } from "react";
import type { TaskStatus } from "@/api/types";
import { Input } from "@/components/ui/input";
import { useQuickAdd } from "./useBoard";

export function QuickAdd({
	projectId,
	status,
	label,
}: {
	projectId: number;
	status: TaskStatus;
	label: string;
}) {
	const [title, setTitle] = useState("");
	const add = useQuickAdd(projectId, status);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				const value = title.trim();
				if (!value || add.isPending) return;
				add.mutate(value, { onSuccess: () => setTitle("") });
			}}
		>
			<Input
				value={title}
				onChange={(event) => setTitle(event.target.value)}
				placeholder="Add a task…"
				aria-label={`Add task to ${label}`}
				readOnly={add.isPending}
			/>
		</form>
	);
}
