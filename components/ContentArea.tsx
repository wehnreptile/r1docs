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
        const response = await fetch(doc.contentPath);
        if (!response.ok) throw new Error(`Failed to load ${doc.contentPath}`);
        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error(err);
        setError(
          `Could not load the documentation file: ${doc.contentPath}. Ensure the file exists in the repository.`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoc();
  }, [doc]);

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CodeBlock = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      const id = Math.floor(Math.random() * 10000);
      return !inline && match ? (
        <div className="group relative">
          <button
            onClick={() => copyToClipboard(codeString, id)}
            className="absolute right-4 top-4 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 text-xs font-bold"
          >
            {copiedId === id ? "COPIED!" : "COPY"}
          </button>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200 font-medium"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <article className="w-4/5 mx-auto px-6 sm:px-10 py-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
              components={CodeBlock}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
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
