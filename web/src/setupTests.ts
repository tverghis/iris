import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetDb } from "@/mocks/db";
import { server } from "@/mocks/server";

// Lazy routes and MSW are slow when the whole suite runs in parallel.
configure({ asyncUtilTimeout: 10_000 });

// jsdom has no matchMedia (used by sonner's system theme).
window.matchMedia ??= ((query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addEventListener: () => {},
	removeEventListener: () => {},
	addListener: () => {},
	removeListener: () => {},
	dispatchEvent: () => false,
})) as typeof window.matchMedia;

// jsdom has no ResizeObserver (used by Radix checkbox).
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	server.resetHandlers();
	resetDb();
	localStorage.clear();
});

afterAll(() => server.close());
