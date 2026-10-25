import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { setCurrentUserId, useCurrentUserId } from "@/lib/currentUser";

export function UserSwitcher() {
	const queryClient = useQueryClient();
	const currentId = useCurrentUserId();
	const { data: users } = useQuery({
		queryKey: queryKeys.users,
		queryFn: async () => (await api.GET("/api/users")).data ?? [],
		staleTime: Number.POSITIVE_INFINITY,
	});

	const known = users?.some((u) => u.id === currentId) ?? false;
	useEffect(() => {
		if (users?.length && !known) setCurrentUserId(users[0].id);
	}, [users, known]);

	function change(id: number) {
		setCurrentUserId(id);
		queryClient.invalidateQueries({
			predicate: (query) => query.queryKey[0] !== queryKeys.users[0],
		});
	}

	return (
		<select
			aria-label="Signed in as"
			className="h-9 max-w-32 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			value={known ? (currentId ?? "") : ""}
			disabled={!users?.length}
			onChange={(event) => change(Number(event.target.value))}
		>
			{!known && <option value="">User…</option>}
			{users?.map((user) => (
				<option key={user.id} value={user.id}>
					{user.name}
				</option>
			))}
		</select>
	);
}
