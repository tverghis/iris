import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Route } from "wouter";
import { Component as BoardPage } from "@/routes/BoardPage";
import { renderWithProviders } from "@/testUtils";

function stubMobile(matches = true) {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
	}));
}

function renderBoard() {
	return renderWithProviders(
		<Route path="/projects/:projectId" component={BoardPage} />,
		"/projects/1",
	);
}

const toggle = (name: string) =>
	within(screen.getByRole("region", { name })).getByRole("button", {
		name: new RegExp(`^${name}`),
	});

describe("mobile board sections", () => {
	test("Done starts collapsed, others expanded, headers show counts", async () => {
		stubMobile();
		renderBoard();
		const backlog = await screen.findByRole("button", { name: /^Backlog/ });
		expect(backlog).toHaveAttribute("aria-expanded", "true");
		expect(backlog).toHaveTextContent("3");
		expect(toggle("Done")).toHaveAttribute("aria-expanded", "false");
		expect(toggle("Done")).toHaveTextContent("2");
		expect(screen.getByText("Pick a destination")).not.toBeVisible();
		expect(screen.getByText("Rent a car")).toBeVisible();
		expect(
			screen.getByRole("textbox", { name: "Add task to Backlog" }),
		).toBeInTheDocument();
	});

	test("toggling expands and collapses, and is remembered per project", async () => {
		stubMobile();
		const user = userEvent.setup();
		const { unmount } = renderBoard();
		await screen.findByRole("button", { name: /^Backlog/ });
		await user.click(toggle("Done"));
		expect(toggle("Done")).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Pick a destination")).toBeVisible();
		await user.click(toggle("Backlog"));
		expect(screen.getByText("Rent a car")).not.toBeVisible();
		expect(
			screen.queryByRole("textbox", { name: "Add task to Backlog" }),
		).not.toBeInTheDocument();

		unmount();
		renderBoard();
		await screen.findByRole("button", { name: /^Backlog/ });
		expect(toggle("Done")).toHaveAttribute("aria-expanded", "true");
		expect(toggle("Backlog")).toHaveAttribute("aria-expanded", "false");
	});

	test("desktop columns are plain headings that never collapse", async () => {
		stubMobile(false);
		renderBoard();
		await screen.findByText("Pick a destination");
		expect(
			screen.queryByRole("button", { name: /^Backlog/ }),
		).not.toBeInTheDocument();
		expect(screen.getByText("Rent a car")).toBeVisible();
	});
});
