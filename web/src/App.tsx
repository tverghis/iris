import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createQueryClient } from "@/api/queryClient";
import { AppShell } from "@/components/AppShell";

function App() {
	const [queryClient] = useState(createQueryClient);
	return (
		<QueryClientProvider client={queryClient}>
			<AppShell />
		</QueryClientProvider>
	);
}

export default App;
