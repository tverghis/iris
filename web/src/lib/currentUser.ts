import { useSyncExternalStore } from "react";

const KEY = "iris.userId";
const listeners = new Set<() => void>();

export function getCurrentUserId(): number | null {
	try {
		const raw = localStorage.getItem(KEY);
		const id = raw === null ? Number.NaN : Number(raw);
		return Number.isInteger(id) ? id : null;
	} catch {
		return null;
	}
}

export function setCurrentUserId(id: number) {
	try {
		localStorage.setItem(KEY, String(id));
	} catch {
		// storage unavailable; the choice just won't persist
	}
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useCurrentUserId() {
	return useSyncExternalStore(subscribe, getCurrentUserId, () => null);
}
