import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Route, useSearch } from "wouter";
import { db, taskById } from "@/mocks/db";
import { server } from "@/mocks/server";
import { Component as BoardPage } from "@/routes/BoardPage";
import { renderWithProviders } from "@/testUtils";

function Search() {
	return <output data-testid="search">{useSearch()}</output>;
}

function renderBoard() {
	return renderWithProviders(
		<>
			<Route path="/projects/:projectId" component={BoardPage} />
			<Search />
		</>,
		"/projects/1",
	);
}

function stubMobile(matches = true) {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
	}));
}

const idOf = (title: string) =>
	db.tasks.find((t) => t.title === title)?.id ?? 0;
const cards = (name: string) =>
	[
		...screen.getByRole("region", { name }).querySelectorAll("[data-task-id]"),
	].map((b) => b.querySelector("span")?.textContent);

afterEach(() => vi.unstubAllGlobals());

describe("Move to… menu", () => {
	test("moves the card to the top of the chosen column", async () => {
		const user = userEvent.setup();
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });
		await user.click(screen.getByRole("button", { name: "Move Rent a car…" }));
		const sheet = await screen.findByRole("dialog");
		expect(
			within(sheet).getByRole("button", { name: /Backlog/ }),
		).toBeDisabled();
		await user.click(within(sheet).getByRole("button", { name: "Blocked" }));
		expect(cards("Blocked")[0]).toBe("Rent a car");
		expect(cards("Backlog")).not.toContain("Rent a car");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await waitFor(() =>
			expect(taskById(idOf("Rent a car"))?.status).toBe("blocked"),
		);
	});

	test("a rejected move rolls back and shows the reason", async () => {
		const reason =
			"Only the dispatcher can move an agent task into In Progress";
		server.use(
			http.post("/api/tasks/:id/move", () =>
				HttpResponse.json({ message: reason }, { status: 409 }),
			),
		);
		const user = userEvent.setup();
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });
		const before = cards("Backlog");
		await user.click(
			screen.getByRole("button", { name: "Move Travel insurance quotes…" }),
		);
		await user.click(
			within(await screen.findByRole("dialog")).getByRole("button", {
				name: "In Progress",
			}),
		);
		expect(await screen.findByText(reason)).toBeInTheDocument();
		await waitFor(() => expect(cards("Backlog")).toEqual(before));
		expect(cards("In Progress")).not.toContain("Travel insurance quotes");
	});

	test("the menu button does not open the drawer", async () => {
		const user = userEvent.setup();
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });
		await user.click(screen.getByRole("button", { name: "Move Rent a car…" }));
		await screen.findByRole("dialog");
		expect(screen.getByTestId("search").textContent).not.toContain("task=");
	});
});

describe("mobile drag collapses the other columns", () => {
	// jsdom has no layout: columns stacked, cards inside.
	function fakeLayout() {
		const rect = (y: number, h: number) =>
			({
				x: 0,
				y,
				left: 0,
				top: y,
				width: 300,
				height: h,
				right: 300,
				bottom: y + h,
				toJSON: () => {},
			}) as DOMRect;
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
			function (this: Element) {
				const section = this.closest("[data-status]");
				if (!section) return rect(0, 0);
				const col = [...document.querySelectorAll("[data-status]")].indexOf(
					section,
				);
				if (this === section) return rect(col * 300, 280);
				const row = [...section.querySelectorAll("[data-task-id]")].indexOf(
					this,
				);
				return rect(col * 300 + 40 + Math.max(row, 0) * 80, 70);
			},
		);
	}

	test("source stays open, others collapse, and all re-expand on cancel", async () => {
		stubMobile();
		fakeLayout();
		const user = userEvent.setup();
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });
		await user.click(screen.getByRole("button", { name: /^Done/ }));
		expect(screen.getByText("Shortlist coastal towns")).toBeVisible();
		expect(screen.getByText("Pick a destination")).toBeVisible();

		screen.getByRole("button", { name: /^Draft packing list/ }).focus();
		await user.keyboard(" ");
		await waitFor(() =>
			expect(screen.getByText("Shortlist coastal towns")).not.toBeVisible(),
		);
		expect(screen.getByText("Rent a car")).toBeVisible();
		expect(screen.getByText("Pick a destination")).not.toBeVisible();

		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.getByText("Shortlist coastal towns")).toBeVisible(),
		);
		expect(screen.getByText("Pick a destination")).toBeVisible();
	});

	test("columns re-expand after a drop", async () => {
		stubMobile();
		fakeLayout();
		const user = userEvent.setup();
		renderBoard();
		await screen.findByRole("heading", { name: "Summer trip" });
		const ready = cards("Ready")[0] ?? "";
		screen.getByRole("button", { name: /^Draft packing list/ }).focus();
		await user.keyboard(" ");
		await waitFor(() => expect(screen.getByText(ready)).not.toBeVisible());
		await user.keyboard(" ");
		await waitFor(() => expect(screen.getByText(ready)).toBeVisible());
	});
});
