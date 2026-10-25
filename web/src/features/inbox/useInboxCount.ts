import { useInbox } from "./useInbox";

/** Number of items that need the signed-in user, for the nav badge. */
export function useInboxCount() {
	const { entries } = useInbox({ mine: true });
	return entries.length;
}
