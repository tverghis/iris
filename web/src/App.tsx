import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { createPersistOptions } from "@/api/persistence";
import { createQueryClient } from "@/api/queryClient";
import { AppShell } from "@/components/AppShell";

// The mock API resets on every load, so restoring its data would only mislead.
const persist =
	import.meta.env.VITE_MOCK_API !== "true" && import.meta.env.MODE !== "test";

function App() {
	const [queryClient] = useState(() =>
		createQueryClient({ persisted: persist }),
	);
	const [persistOptions] = useState(() =>
		persist ? createPersistOptions(queryClient) : null,
	);
	if (!persistOptions) {
		return (
			<QueryClientProvider client={queryClient}>
				<AppShell />
			</QueryClientProvider>
		);
	}
	return (
		<PersistQueryClientProvider
			client={queryClient}
			persistOptions={persistOptions}
		>
			<AppShell />
		</PersistQueryClientProvider>
	);
}

export default App;
