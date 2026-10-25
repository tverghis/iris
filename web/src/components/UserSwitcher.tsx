import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { setCurrentUserId, useCurrentUserId } from "@/lib/currentUser";

function useUserState() {
	const currentId = useCurrentUserId();
	const { data: users, isPending } = useQuery({
		queryKey: queryKeys.users,
		queryFn: async () => (await api.GET("/api/users")).data ?? [],
		staleTime: Number.POSITIVE_INFINITY,
	});
	const known = users?.some((u) => u.id === currentId) ?? false;
	return { currentId, users, isPending, known };
}

/**
 * Picks the default user on a fresh device. True once the user is settled, so
 * user-dependent queries never run without an X-Iris-User header (unless the
 * user list itself cannot be loaded).
 */
export function useUserReady() {
	const { users, isPending, known } = useUserState();
	useEffect(() => {
		if (users?.length && !known) setCurrentUserId(users[0].id);
	}, [users, known]);
	return !isPending && (known || !users?.length);
}

export function UserSwitcher() {
	const queryClient = useQueryClient();
	const { currentId, users, known } = useUserState();

	function change(id: number) {
		setCurrentUserId(id);
		// Another user's data must not linger in the cache (or in storage).
		queryClient.resetQueries({
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
