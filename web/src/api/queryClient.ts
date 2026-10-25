import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "./errors";

declare module "@tanstack/react-query" {
	interface Register {
		mutationMeta: { silent?: boolean };
		queryMeta: { silent?: boolean };
	}
}

function notify(error: Error, silent?: boolean) {
	if (silent) return;
	toast.error(error.message || "Something went wrong", { id: error.message });
}

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => notify(error, query.meta?.silent),
		}),
		mutationCache: new MutationCache({
			onError: (error, _vars, _ctx, mutation) =>
				notify(error, mutation.meta?.silent),
		}),
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				retry: (count, error) =>
					count < 1 && !(error instanceof ApiError && error.status < 500),
				refetchOnWindowFocus: true,
			},
		},
	});
}
