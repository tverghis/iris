import type { RouteObject } from "react-router";
import { AppShell } from "@/components/AppShell";

export const routes: RouteObject[] = [
	{
		path: "/",
		element: <AppShell />,
		children: [
			{ index: true, lazy: () => import("./routes/ProjectsPage") },
			{ path: "projects/:projectId", lazy: () => import("./routes/BoardPage") },
			{
				path: "projects/:projectId/context",
				lazy: () => import("./routes/ProjectContextPage"),
			},
			{ path: "inbox", lazy: () => import("./routes/InboxPage") },
		],
	},
];
