/** "just now", "5m ago", "3h ago", "2d ago"; a plain date after a week. */
export function relativeTime(iso: string, nowMs = Date.now()): string {
	const seconds = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
	if (seconds < 45) return "just now";
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(iso).toLocaleDateString();
}
