import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, MemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { createQueryClient } from "@/api/queryClient";
import { Toaster } from "@/components/ui/sonner";
import { routes } from "./routes";

export function renderWithProviders(ui: ReactElement, route = "/") {
	const queryClient = createQueryClient();
	return {
		queryClient,
		...render(
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
				<Toaster />
			</QueryClientProvider>,
		),
	};
}

/** Renders the real route tree, including the shell, at `route`. */
export function renderApp(route = "/") {
	const queryClient = createQueryClient();
	const router = createMemoryRouter(routes, { initialEntries: [route] });
	return {
		queryClient,
		...render(
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		),
	};
}
