import { useInbox } from "./useInbox";

const POLL_MS = 30_000;

/** Number of items that need the signed-in user, for the nav badge. */
export function useInboxCount() {
	const { entries } = useInbox({ mine: true }, POLL_MS);
	return entries.length;
}
