import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import type { Board, StreamEvent, Task } from "@/api/types";
import { isOlder, removeCard, upsertCard } from "./applyEvent";

/** Applies one stream event to the cache. Task events patch a single card; nothing refetches the board. */
export function handleStreamEvent(
	queryClient: QueryClient,
	projectId: number,
	event: StreamEvent,
) {
	const { task, taskId } = event;
	const boardKey = queryKeys.projects.board(projectId);

	switch (event.type) {
		case "task.created":
		case "task.updated": {
			if (!task) return;
			queryClient.setQueryData<Board>(
				boardKey,
				(board) => board && upsertCard(board, task),
			);
			const detailKey = queryKeys.tasks.detail(task.id);
			queryClient.setQueryData<Task>(detailKey, (old) =>
				old && !isOlder(task.updatedAt, old.updatedAt)
					? { ...old, ...task }
					: old,
			);
			// The card lacks description and dependencies; refetch only this task, and only if it is in use.
			queryClient.invalidateQueries({ queryKey: detailKey, exact: true });
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists });
			return;
		}
		case "task.deleted": {
			if (taskId === undefined) return;
			queryClient.setQueryData<Board>(
				boardKey,
				(board) => board && removeCard(board, taskId),
			);
			// An open drawer refetches and shows "not found"; unused entries just go.
			const detailKey = queryKeys.tasks.detail(taskId);
			queryClient.removeQueries({ queryKey: detailKey, type: "inactive" });
			queryClient.invalidateQueries({ queryKey: detailKey, exact: true });
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists });
			return;
		}
		case "project.updated": {
			if (!event.project) return;
			const project = event.project;
			queryClient.setQueryData<Board>(
				boardKey,
				(board) => board && { ...board, project },
			);
			queryClient.setQueryData(queryKeys.projects.detail(projectId), project);
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists });
			return;
		}
		case "comment.created":
			if (taskId !== undefined) {
				queryClient.invalidateQueries({
					queryKey: queryKeys.tasks.comments(taskId),
				});
			}
			queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
			return;
		case "approval.changed":
			if (taskId !== undefined) {
				queryClient.invalidateQueries({
					queryKey: queryKeys.tasks.approvals(taskId),
				});
			}
			queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
			return;
		case "question.changed":
			queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
			return;
		case "note.changed":
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.notes(projectId),
			});
			return;
		case "run.changed":
			if (taskId !== undefined) {
				queryClient.invalidateQueries({
					queryKey: queryKeys.tasks.runs(taskId),
				});
			}
			queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.status });
			return;
	}
}
