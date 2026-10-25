import { useEffect } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { toasterMounted } from "@/lib/toast";

function Toaster(props: ToasterProps) {
	useEffect(toasterMounted, []);
	return (
		<Sonner
			theme="system"
			className="toaster group"
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
}

export { Toaster };
