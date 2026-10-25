import { useSyncExternalStore } from "react";

export const MOBILE_QUERY = "(max-width: 767px)";

/** Tracks a CSS media query; false where matchMedia is unavailable. */
export function useMediaQuery(query: string) {
	return useSyncExternalStore(
		(notify) => {
			const mql = window.matchMedia?.(query);
			mql?.addEventListener("change", notify);
			return () => mql?.removeEventListener("change", notify);
		},
		() => window.matchMedia?.(query).matches ?? false,
		() => false,
	);
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
