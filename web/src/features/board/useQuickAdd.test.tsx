import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import { queryKeys } from "@/api/queryKeys";
import type { Board, StreamEvent, Task } from "@/api/types";
import { handleStreamEvent } from "@/features/live/handleEvent";
import { server } from "@/mocks/server";
import { renderWithProviders } from "@/testUtils";
import { useBoard, useQuickAdd } from "./useBoard";

function Harness() {
	const { columns } = useBoard(1);
	const add = useQuickAdd(1, "backlog");
	return (
		<>
			<button type="button" onClick={() => add.mutate("Streamed task")}>
				add
			</button>
			<output data-testid="ids">
				{columns
					?.flatMap((c) => c.tasks)
					.map((t) => t.id)
					.join(",")}
			</output>
		</>
	);
}

test("quick add after the stream already delivered the card keeps one copy", async () => {
	const user = userEvent.setup();
	const view = renderWithProviders(<Harness />);
	await waitFor(() =>
		expect(screen.getByTestId("ids").textContent).not.toBe(""),
	);
	const board = view.queryClient.getQueryData<Board>(
		queryKeys.projects.board(1),
	);
	const template = board?.columns.flatMap((c) => c.tasks)[0];
	if (!template) throw new Error("no seed task");
	const task = {
		...template,
		id: 9001,
		title: "Streamed task",
		status: "backlog",
		position: 99999,
		updatedAt: new Date().toISOString(),
	} as Task;
	server.use(
		http.post("/api/projects/:id/tasks", () => {
			// The SSE event wins the race against the POST response.
			handleStreamEvent(view.queryClient, 1, {
				type: "task.created",
				taskId: task.id,
				task,
			} as StreamEvent);
			return HttpResponse.json(task, { status: 201 });
		}),
	);
	await user.click(screen.getByRole("button", { name: "add" }));
	await waitFor(() =>
		expect(screen.getByTestId("ids").textContent).toContain("9001"),
	);
	const ids = screen.getByTestId("ids").textContent?.split(",") ?? [];
	expect(ids.filter((id) => id === "9001")).toHaveLength(1);
});
