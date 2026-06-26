import React, { useState, useEffect } from "react";
import { DocPage } from "../types";

interface ContentAreaProps {
  doc: DocPage;
  productName: string;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import mermaid from "mermaid";

// Initialise mermaid once for the whole app.
mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  fontFamily: "JetBrains Mono, monospace",
});

/**
 * Renders a ```mermaid fenced block as an SVG diagram. Falls back to showing the
 * raw diagram source if mermaid fails to parse it.
 */
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const id = "mermaid-" + Math.random().toString(36).slice(2, 11);
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (failed) {
    return (
      <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl overflow-x-auto text-sm font-mono my-6">
        {chart}
      </pre>
    );
  }

  return (
    <div
      className="my-8 flex justify-center overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// Include markdown files in the build so production can load them.
// Use new Vite options: `query: '?raw'` and `import: 'default'`.
// @ts-ignore - Vite-specific API
const MARKDOWN_FILES: Record<string, () => Promise<string>> = import.meta.glob(
  "/docs/**/*.md",
  { query: "?raw", import: "default" },
);

const ContentArea: React.FC<ContentAreaProps> = ({
  doc,
  productName,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}) => {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Try to load from bundled markdown files first (works in Vite build)
        const candidates = [
          doc.contentPath,
          `.${doc.contentPath}`,
          doc.contentPath.replace(/^\//, ""),
          `./${doc.contentPath.replace(/^\//, "")}`,
        ];

        let loader: (() => Promise<string>) | undefined;
        for (const key of candidates) {
          if ((MARKDOWN_FILES as any)[key]) {
            loader = (MARKDOWN_FILES as any)[key];
            break;
          }
        }

        if (loader) {
          const text = await loader();
          setContent(text);
        } else {
          // Fallback to network fetch (useful in dev or alternate deployments)
          const response = await fetch(doc.contentPath);
          if (!response.ok)
            throw new Error(`Failed to load ${doc.contentPath}`);
          const text = await response.text();
          setContent(text);
        }
      } catch (err) {
        console.error(err);
        setError(
          `Could not load the documentation file: ${doc.contentPath}. Ensure the file exists in the repository and is included in the build.`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoc();
  }, [doc]);

  // Reset scroll to the top on every doc change. The scroll container is the
  // <main className="overflow-y-auto"> wrapper in App.tsx, not window — and
  // in-app link clicks navigate via popstate, so resetting here covers every
  // navigation path (sidebar, cross-links, next/prev, back/forward).
  useEffect(() => {
    const scroller = document.querySelector("main");
    if (scroller) scroller.scrollTo({ top: 0, left: 0 });
    else window.scrollTo(0, 0);
  }, [doc]);

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const MarkdownComponents = {
    a({ node, href, children, ...props }: any) {
      // Internal doc links (/docs/:productId/:slug) navigate in-app without a full
      // page reload. App.tsx listens for `popstate` and re-parses the URL.
      const isInternal = typeof href === "string" && href.startsWith("/docs/");
      if (isInternal) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, "", href);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            {...props}
          >
            {children}
          </a>
        );
      }
      const isHash = typeof href === "string" && href.startsWith("#");
      return (
        <a
          href={href}
          {...(isHash ? {} : { target: "_blank", rel: "noreferrer noopener" })}
          {...props}
        >
          {children}
        </a>
      );
    },
    // Strip the default <pre> wrapper; block rendering is handled in `code`.
    pre({ children }: any) {
      return <>{children}</>;
    },
    code({ node, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      // A fenced block either has a language or spans multiple lines. Anything
      // else is inline code. (react-markdown v10 no longer passes `inline`.)
      const isBlock = !!match || codeString.includes("\n");

      // Mermaid diagrams render as SVG.
      if (match && match[1] === "mermaid") {
        return <MermaidDiagram chart={codeString} />;
      }

      // Inline code.
      if (!isBlock) {
        return (
          <code
            className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200 font-medium"
            {...props}
          >
            {children}
          </code>
        );
      }

      // Block code: syntax-highlighted when a language is given, otherwise a
      // clean monospace block (preserves whitespace for ASCII diagrams).
      const id = Math.floor(Math.random() * 10000);
      return (
        <div className="group relative my-6">
          <button
            onClick={() => copyToClipboard(codeString, id)}
            className="absolute right-4 top-4 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 text-xs font-bold"
          >
            {copiedId === id ? "COPIED!" : "COPY"}
          </button>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match ? match[1] : "text"}
            PreTag="div"
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    },
  };

  return (
    <article className="mx-auto max-w-6xl px-4 sm:px-8 py-8 sm:py-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <nav className="flex items-center text-xs font-bold tracking-widest uppercase text-slate-400 mb-8 space-x-2">
        <span className="hover:text-indigo-600 transition-colors cursor-pointer">
          {productName}
        </span>
        <span>/</span>
        <span className="text-indigo-600">{doc.category}</span>
      </nav>

      <div className="flex flex-col sm:flex-row justify-between items-start mb-12 border-b border-slate-100 pb-10 gap-6">
        <div className="flex-1">
          <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tighter leading-tight">
            {doc.title}
          </h1>
          <div className="flex items-center space-x-6 text-sm text-slate-400">
            <span className="flex items-center bg-slate-100 px-3 py-1 rounded-full text-slate-600 font-medium">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Updated {doc.lastUpdated}
            </span>
            <span className="font-bold text-indigo-500 uppercase tracking-widest text-xs">
              {doc.category}
            </span>
          </div>
        </div>
      </div>

      <div className="prose prose-slate prose-lg max-w-none">
        {isLoading ? (
          <div className="space-y-6">
            <div className="h-12 bg-slate-100 animate-pulse rounded-xl w-3/4"></div>
            <div className="h-4 bg-slate-100 animate-pulse rounded w-full"></div>
            <div className="h-4 bg-slate-100 animate-pulse rounded w-11/12"></div>
            <div className="h-4 bg-slate-100 animate-pulse rounded w-full"></div>
            <div className="h-64 bg-slate-100 animate-pulse rounded-2xl w-full"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-8 rounded-2xl shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="font-black">ERROR LOADING CONTENT</p>
            </div>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        ) : (
          <>
            <ReactMarkdown
              components={MarkdownComponents}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw as any]}
            >
              {content}
            </ReactMarkdown>

            <div className="mt-20 pt-10 border-t border-slate-100 grid grid-cols-2 gap-4">
              {hasPrev ? (
                <button
                  onClick={onPrev}
                  className="flex flex-col items-start p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                >
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-indigo-400">
                    Previous
                  </span>
                  <span className="text-lg font-bold text-slate-700 group-hover:text-indigo-700">
                    Back Article
                  </span>
                </button>
              ) : (
                <div></div>
              )}

              {hasNext ? (
                <button
                  onClick={onNext}
                  className="flex flex-col items-end p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-right"
                >
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-indigo-400">
                    Next
                  </span>
                  <span className="text-lg font-bold text-slate-700 group-hover:text-indigo-700">
                    Continue Reading
                  </span>
                </button>
              ) : (
                <div></div>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="mt-32 pt-12 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-slate-400 gap-6">
          <p className="font-medium">© 2026 Reptile docs • Engineering Team</p>
        </div>
      </footer>
    </article>
  );
};

export default ContentArea;
