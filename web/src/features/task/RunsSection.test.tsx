import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/testUtils";

const idOf = (title: string) =>
	db.tasks.find((t) => t.title === title)?.id as number;

describe("runs section", () => {
	test("shows run history with fields and the served context", async () => {
		const user = userEvent.setup();
		const id = idOf("Shortlist coastal towns");
		const run = db.runs.find((r) => r.taskId === id);
		if (run) run.logRef = "https://hermes.example/logs/1";
		renderApp(`/projects/1?task=${id}`);

		expect(
			await screen.findByText(
				/Requested sign-off on the shortlist/,
				{},
				{ timeout: 10_000 },
			),
		).toBeInTheDocument();
		expect(screen.getByText("Needs human")).toBeInTheDocument();
		expect(screen.getByText(/hermes · default/)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "https://hermes.example/logs/1" }),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "View context" }));
		const dialog = await screen.findByRole("dialog", {
			name: /Context for run/,
		});
		expect(await within(dialog).findByText(/Board rules/)).toBeInTheDocument();
	});

	test("cancelling a running run moves the card out of In Progress", async () => {
		const user = userEvent.setup();
		const id = idOf("Research rail passes");
		renderApp(`/projects/1?task=${id}`);

		await user.click(
			await screen.findByRole(
				"button",
				{ name: "Cancel run" },
				{ timeout: 10_000 },
			),
		);
		const confirm = await screen.findByRole("dialog", {
			name: "Cancel this run?",
		});
		await user.click(
			within(confirm).getByRole("button", { name: "Cancel run" }),
		);

		await waitFor(() =>
			expect(screen.getByText("Cancelled")).toBeInTheDocument(),
		);
		await waitFor(() =>
			expect(db.tasks.find((t) => t.id === id)?.status).toBe("blocked"),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Cancel run" }),
			).not.toBeInTheDocument(),
		);
		const card = screen.getByRole("button", {
			name: /^Research rail passes/,
			hidden: true,
		});
		expect(within(card).queryByText("Running")).not.toBeInTheDocument();
		const column = (status: string) =>
			document.querySelector(`[data-status="${status}"]`) as HTMLElement;
		expect(
			within(column("in_progress")).queryByText(/Research rail passes/),
		).toBeNull();
		expect(
			within(column("blocked")).getByText(/Research rail passes/),
		).toBeInTheDocument();
	});

	test("a failing follow-up read after a successful cancel keeps the run cancelled", async () => {
		const user = userEvent.setup();
		const id = idOf("Research rail passes");
		renderApp(`/projects/1?task=${id}`);
		const cancel = await screen.findByRole(
			"button",
			{ name: "Cancel run" },
			{ timeout: 10_000 },
		);

		let taskReads = 0;
		server.use(
			http.get("/api/tasks/:id", () => {
				taskReads++;
				return HttpResponse.json({ message: "down" }, { status: 500 });
			}),
		);
		await user.click(cancel);
		const confirm = await screen.findByRole("dialog", {
			name: "Cancel this run?",
		});
		await user.click(
			within(confirm).getByRole("button", { name: "Cancel run" }),
		);

		await waitFor(() => expect(taskReads).toBeGreaterThan(0));
		expect(await screen.findByText("Cancelled")).toBeInTheDocument();
		await waitFor(() =>
			expect(db.runs.find((r) => r.taskId === id)?.state).toBe("cancelled"),
		);
		expect(screen.getByText("Cancelled")).toBeInTheDocument();
		expect(screen.queryByText("down")).not.toBeInTheDocument();
	});
});
