import { FolderKanban, Inbox } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { DispatcherStatus } from "./DispatcherStatus";
import { UserSwitcher } from "./UserSwitcher";

const navLink = ({ isActive }: { isActive: boolean }) =>
	cn(
		"inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-accent",
		isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
	);

export function AppShell() {
	return (
		<div className="flex min-h-dvh flex-col">
			<header className="border-b px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2">
					<NavLink to="/" className="text-lg font-semibold" end>
						Iris
					</NavLink>
					<nav aria-label="Main" className="flex items-center gap-1">
						<NavLink to="/" end className={navLink}>
							<FolderKanban className="size-4" aria-hidden />
							<span className="sr-only sm:not-sr-only">Projects</span>
						</NavLink>
						<NavLink to="/inbox" className={navLink}>
							<Inbox className="size-4" aria-hidden />
							<span className="sr-only sm:not-sr-only">Needs you</span>
						</NavLink>
					</nav>
					<div className="ml-auto">
						<UserSwitcher />
					</div>
					<div className="basis-full sm:order-last sm:basis-auto">
						<DispatcherStatus />
					</div>
				</div>
			</header>
			<main className="mx-auto w-full max-w-6xl flex-1 p-4">
				<Outlet />
			</main>
			<Toaster position="bottom-center" />
		</div>
	);
}
