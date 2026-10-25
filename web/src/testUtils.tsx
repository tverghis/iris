import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { createQueryClient } from "@/api/queryClient";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

function renderAt(ui: ReactElement, route: string) {
	const queryClient = createQueryClient();
	// Retrying a failed request (with backoff) would outlast test timeouts.
	queryClient.setDefaultOptions({
		queries: { ...queryClient.getDefaultOptions().queries, retry: false },
	});
	const [path, search = ""] = route.split("?");
	const { hook, searchHook } = memoryLocation({ path, searchPath: search });
	return {
		queryClient,
		...render(
			<QueryClientProvider client={queryClient}>
				<Router hook={hook} searchHook={searchHook}>
					{ui}
				</Router>
			</QueryClientProvider>,
		),
	};
}

export function renderWithProviders(ui: ReactElement, route = "/") {
	return renderAt(
		<>
			{ui}
			<Toaster />
		</>,
		route,
	);
}

/** Renders the real shell (which includes the Toaster) and routes at `route`. */
export function renderApp(route = "/") {
	return renderAt(<AppShell />, route);
}
