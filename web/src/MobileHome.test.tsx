import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { renderApp } from "./testUtils";

function stubMatchMedia(matches: boolean) {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
	}));
}

describe("mobile home", () => {
	test("on a phone, / opens Needs you", async () => {
		stubMatchMedia(true);
		renderApp("/");
		expect(
			await screen.findByRole("heading", { name: "Needs you" }),
		).toBeInTheDocument();
	});

	test("on a phone, Projects stays reachable from the nav", async () => {
		stubMatchMedia(true);
		const user = userEvent.setup();
		renderApp("/");
		await screen.findByRole("heading", { name: "Needs you" });
		await user.click(screen.getByRole("link", { name: /Projects/ }));
		expect(
			await screen.findByRole("heading", { name: "Projects" }),
		).toBeInTheDocument();
	});

	test("on a phone, other routes are untouched", async () => {
		stubMatchMedia(true);
		renderApp("/projects/1");
		expect(
			await screen.findByRole("heading", { name: "Summer trip" }),
		).toBeInTheDocument();
	});

	test("on a wide screen, / stays on Projects", async () => {
		stubMatchMedia(false);
		renderApp("/");
		expect(
			await screen.findByRole("heading", { name: "Projects" }),
		).toBeInTheDocument();
	});
});
