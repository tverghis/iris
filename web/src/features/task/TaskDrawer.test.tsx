import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import { queryKeys } from "@/api/queryKeys";
import type { Board, Task } from "@/api/types";
import { handleStreamEvent } from "@/features/live/handleEvent";
import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/testUtils";

const idOf = (title: string) =>
	db.tasks.find((t) => t.title === title)?.id as number;

async function getTask(id: number) {
	const res = await fetch(`${location.origin}/api/tasks/${id}`);
	return (await res.json()) as Task;
}

const card = (title: string) =>
	screen.getByRole("button", { name: new RegExp(`^${title}`), hidden: true });

describe("task drawer", () => {
	test("edits round-trip through the API and update the card", async () => {
		const user = userEvent.setup();
		const id = idOf("Draft packing list");
		renderApp(`/projects/1?task=${id}`);

		const title = await screen.findByRole(
			"textbox",
			{ name: "Title" },
			{ timeout: 10_000 },
		);
		await user.clear(title);
		await user.type(title, "Packing list v2{Enter}");
		await waitFor(async () =>
			expect((await getTask(id)).title).toBe("Packing list v2"),
		);
		expect(card("Packing list v2")).toBeInTheDocument();

		const desc = screen.getByRole("textbox", { name: "Description" });
		await user.type(desc, "Bring **sunscreen**");
		await user.click(screen.getByRole("button", { name: "Preview" }));
		await waitFor(async () =>
			expect((await getTask(id)).descriptionMd).toBe("Bring **sunscreen**"),
		);
		expect(await screen.findByText("sunscreen")).toBeInTheDocument();

		expect(screen.queryByLabelText("Require sign-off")).not.toBeInTheDocument();
		await user.selectOptions(screen.getByLabelText("Assignee"), "Agent");
		const signOff = await screen.findByRole("checkbox", {
			name: "Require sign-off",
		});
		await waitFor(async () =>
			expect((await getTask(id)).assigneeKind).toBe("agent"),
		);
		const before = (await getTask(id)).requireSignOff;
		await user.click(signOff);
		await waitFor(async () =>
			expect((await getTask(id)).requireSignOff).toBe(!before),
		);

		await user.selectOptions(screen.getByLabelText("Assignee"), "Partner");
		await waitFor(async () => {
			const t = await getTask(id);
			expect(t.assigneeKind).toBe("human");
			expect(t.assigneeUserId).toBe(2);
		});
		expect(screen.queryByLabelText("Require sign-off")).not.toBeInTheDocument();
	});

	test("adding a dependency updates the waiting badge; cycles show the error", async () => {
		const user = userEvent.setup();
		const id = idOf("Draft packing list");
		const other = idOf("Rent a car");
		renderApp(`/projects/1?task=${id}`);

		await screen.findByRole("textbox", { name: "Title" }, { timeout: 10_000 });
		expect(
			within(card("Draft packing list")).queryByText(/Waiting on/),
		).toBeNull();
		await user.type(screen.getByLabelText("Add dependency"), "rent a");
		await user.click(await screen.findByRole("button", { name: /Rent a car/ }));
		await waitFor(() =>
			expect(
				within(card("Draft packing list")).getByText("Waiting on 1"),
			).toBeInTheDocument(),
		);
		expect(
			screen.getByRole("button", { name: "Remove dependency Rent a car" }),
		).toBeInTheDocument();
		expect((await getTask(id)).dependencies.map((d) => d.id)).toEqual([other]);

		await user.click(
			screen.getByRole("button", { name: "Remove dependency Rent a car" }),
		);
		await waitFor(() =>
			expect(
				within(card("Draft packing list")).queryByText(/Waiting on/),
			).toBeNull(),
		);

		// Cycle: make Rent a car depend on the packing list, then reverse it.
		await user.type(screen.getByLabelText("Add dependency"), "rent a");
		await user.click(await screen.findByRole("button", { name: /Rent a car/ }));
		await waitFor(() =>
			expect(
				within(card("Draft packing list")).getByText(/Waiting on/),
			).toBeInTheDocument(),
		);
		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await user.click(card("Rent a car"));
		await waitFor(() =>
			expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
				"Rent a car",
			),
		);
		await user.type(screen.getByLabelText("Add dependency"), "packing");
		await user.click(
			await screen.findByRole("button", { name: /Draft packing list/ }),
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(/cycle/i);
	});

	test("delete asks for confirmation, closes the drawer and removes the card", async () => {
		const user = userEvent.setup();
		const id = idOf("Draft packing list");
		renderApp(`/projects/1?task=${id}`);
		await screen.findByRole("textbox", { name: "Title" }, { timeout: 10_000 });
		await user.click(screen.getByRole("button", { name: "Delete task" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Delete this task?",
		});
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		expect(screen.queryByText("Draft packing list")).not.toBeInTheDocument();
		expect(db.tasks.some((t) => t.id === id)).toBe(false);
	});

	test("shows output and an empty state", async () => {
		const id = idOf("Draft packing list");
		renderApp(`/projects/1?task=${id}`);
		expect(await screen.findByText("No output yet")).toBeInTheDocument();
	});

	test("unknown task id shows Task not found", async () => {
		renderApp("/projects/1?task=99999");
		expect(await screen.findByText("Task not found")).toBeInTheDocument();
	});

	test("Escape closes the drawer", async () => {
		const user = userEvent.setup();
		const id = idOf("Draft packing list");
		renderApp(`/projects/1?task=${id}`);
		await screen.findByRole("textbox", { name: "Title" }, { timeout: 10_000 });
		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});

	test("a failed edit puts back only its own fields, not newer data from the stream", async () => {
		const user = userEvent.setup();
		const id = idOf("Draft packing list");
		server.use(
			http.patch("/api/tasks/:id", async () => {
				await delay(300);
				return HttpResponse.json({ message: "No edits" }, { status: 500 });
			}),
		);
		const { queryClient } = renderApp(`/projects/1?task=${id}`);
		const title = await screen.findByRole(
			"textbox",
			{ name: "Title" },
			{ timeout: 10_000 },
		);
		await waitFor(() => expect(card("Draft packing list")).toBeInTheDocument());
		const original = db.tasks.find((t) => t.id === id)?.title as string;

		await user.clear(title);
		await user.type(title, "Renamed{Enter}");
		expect(card("Renamed")).toBeInTheDocument();

		// Meanwhile the server reports a newer state of the same card.
		const board = queryClient.getQueryData<Board>(queryKeys.projects.board(1));
		const current = board?.columns
			.flatMap((c) => c.tasks)
			.find((t) => t.id === id);
		if (!current) throw new Error("card missing");
		act(() =>
			handleStreamEvent(queryClient, 1, {
				type: "task.updated",
				taskId: id,
				task: {
					...current,
					waitingOn: 5,
					updatedAt: new Date(Date.now() + 60_000).toISOString(),
				},
			}),
		);

		expect(await screen.findByText("No edits")).toBeInTheDocument();
		expect(card(original)).toBeInTheDocument();
		const after = queryClient
			.getQueryData<Board>(queryKeys.projects.board(1))
			?.columns.flatMap((c) => c.tasks)
			.find((t) => t.id === id);
		expect(after?.waitingOn).toBe(5);
		expect(after?.title).toBe(original);
	});

	test("deleting the open task elsewhere shows Task not found", async () => {
		const id = idOf("Draft packing list");
		const { queryClient } = renderApp(`/projects/1?task=${id}`);
		await screen.findByRole("textbox", { name: "Title" }, { timeout: 10_000 });
		const index = db.tasks.findIndex((t) => t.id === id);
		db.tasks.splice(index, 1);
		act(() =>
			handleStreamEvent(queryClient, 1, { type: "task.deleted", taskId: id }),
		);
		expect(await screen.findByText("Task not found")).toBeInTheDocument();
	});
});
