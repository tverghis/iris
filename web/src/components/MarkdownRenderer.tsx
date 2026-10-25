import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];

// react-markdown ignores raw HTML and sanitizes URLs by default.
export default function MarkdownRenderer({ children }: { children: string }) {
	return (
		<ReactMarkdown
			remarkPlugins={plugins}
			components={{
				a: ({ node: _node, ...props }) => (
					<a {...props} target="_blank" rel="noopener noreferrer" />
				),
			}}
		>
			{children}
		</ReactMarkdown>
	);
}
