import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";

export function useDispatchStatus() {
	return useQuery({
		queryKey: queryKeys.dispatch.status,
		queryFn: async () => (await api.GET("/api/dispatch/status")).data,
		refetchInterval: 10_000,
		refetchOnWindowFocus: true,
		meta: { silent: true },
	});
}

export function useRunNow() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => (await api.POST("/api/dispatch/run-now")).data,
		onSuccess: (status) => {
			if (status) queryClient.setQueryData(queryKeys.dispatch.status, status);
			return queryClient.invalidateQueries({
				queryKey: queryKeys.dispatch.status,
			});
		},
	});
}

/** Current time, re-rendered every `ms` (coarse on purpose). */
export function useNow(ms = 30_000) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), ms);
		return () => clearInterval(id);
	}, [ms]);
	return now;
}

export function formatElapsed(startedAt: string, now: number) {
	const minutes = Math.max(
		0,
		Math.floor((now - Date.parse(startedAt)) / 60_000),
	);
	if (minutes < 1) return "<1m";
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatNextTick(nextTickAt: string, now: number) {
	const minutes = Math.ceil((Date.parse(nextTickAt) - now) / 60_000);
	if (minutes <= 1) return "Next tick in <1m";
	if (minutes < 60) return `Next tick in ${minutes}m`;
	const time = new Date(nextTickAt).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
	return `Next tick at ${time}`;
}
