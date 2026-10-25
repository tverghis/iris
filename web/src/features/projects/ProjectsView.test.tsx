import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import { db } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/testUtils";

function stat(card: HTMLElement, label: string) {
	return within(card).getByText(label).previousElementSibling?.textContent;
}

describe("projects screen", () => {
	test("shows counts that match the mock task store", async () => {
		renderApp("/");

		for (const project of db.projects.filter((p) => !p.archivedAt)) {
			const tasks = db.tasks.filter((t) => t.projectId === project.id);
			const card = await screen.findByRole("listitem", { name: project.name });
			expect(stat(card, "Needs approval")).toBe(
				String(tasks.filter((t) => t.status === "needs_approval").length),
			);
			expect(stat(card, "Blocked")).toBe(
				String(tasks.filter((t) => t.status === "blocked").length),
			);
		}
		const trip = await screen.findByRole("listitem", { name: "Summer trip" });
		expect(stat(trip, "Needs approval")).toBe("1");
		expect(within(trip).getByText("Agent running")).toBeInTheDocument();
		const kitchen = screen.getByRole("listitem", { name: "Kitchen refresh" });
		expect(within(kitchen).queryByText("Agent running")).toBeNull();
	});

	test("counts follow changes to the task store", async () => {
		const task = db.tasks.find(
			(t) => t.status === "ready" && t.projectId === 1,
		);
		if (!task) throw new Error("seed task missing");
		task.status = "blocked";

		renderApp("/");

		const card = await screen.findByRole("listitem", { name: "Summer trip" });
		expect(stat(card, "Blocked")).toBe("2");
	});

	test("cards link to the board", async () => {
		renderApp("/");

		const link = await screen.findByRole("link", { name: "Summer trip" });
		expect(link).toHaveAttribute("href", "/projects/1");
	});

	test("creating a project opens its empty board", async () => {
		const user = userEvent.setup();
		renderApp("/");

		await user.type(await screen.findByLabelText("Project name"), "Garden");
		await user.click(screen.getByRole("button", { name: "Create project" }));

		expect(
			await screen.findByRole("heading", { name: "Garden" }),
		).toBeInTheDocument();
		const created = db.projects.find((p) => p.name === "Garden");
		expect(created).toBeDefined();
		expect(db.tasks.filter((t) => t.projectId === created?.id)).toHaveLength(0);
	});

	test("archive asks for confirmation, then unarchive restores", async () => {
		const user = userEvent.setup();
		renderApp("/");

		const card = await screen.findByRole("listitem", {
			name: "Kitchen refresh",
		});
		await user.click(within(card).getByRole("button", { name: "Archive" }));
		await user.click(
			within(await screen.findByRole("dialog")).getByRole("button", {
				name: "Archive",
			}),
		);

		await screen.findByRole("listitem", { name: "Summer trip" });
		expect(
			screen.queryByRole("listitem", { name: "Kitchen refresh" }),
		).toBeNull();
		expect(db.projects.find((p) => p.id === 2)?.archivedAt).not.toBeNull();

		await user.click(screen.getByLabelText("Show archived"));
		const archived = await screen.findByRole("listitem", {
			name: "Kitchen refresh",
		});
		await user.click(
			within(archived).getByRole("button", { name: "Unarchive" }),
		);

		await user.click(screen.getByLabelText("Show archived"));
		expect(
			await screen.findByRole("listitem", { name: "Kitchen refresh" }),
		).toBeInTheDocument();
		expect(db.projects.find((p) => p.id === 2)?.archivedAt).toBeNull();
	});

	test("cancelling the confirm leaves the project alone", async () => {
		const user = userEvent.setup();
		renderApp("/");

		const card = await screen.findByRole("listitem", { name: "Summer trip" });
		await user.click(within(card).getByRole("button", { name: "Archive" }));
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(
			screen.getByRole("listitem", { name: "Summer trip" }),
		).toBeInTheDocument();
		expect(db.projects[0].archivedAt).toBeNull();
	});

	test("shows an empty state", async () => {
		db.projects = [];
		renderApp("/");

		expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
	});

	test("shows an error state with retry", async () => {
		server.use(
			http.get("/api/projects", () =>
				HttpResponse.json({ message: "boom" }, { status: 500 }),
			),
		);
		renderApp("/");

		expect(
			await screen.findByRole("alert", {}, { timeout: 4000 }),
		).toHaveTextContent("Could not load projects");
	});
});
