import React, { useEffect, useState } from "react";
import mermaid from "mermaid";
import DiagramViewer from "./DiagramViewer";

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
 *
 * @param chart Mermaid diagram source.
 * @param title Optional heading shown in the full-screen view.
 */
const MermaidDiagram: React.FC<{ chart: string; title?: string }> = ({
  chart,
  title,
}) => {
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

  if (!svg) {
    return <div className="my-8 h-64 w-full animate-pulse rounded-2xl bg-slate-100" />;
  }

  return <DiagramViewer svg={svg} title={title} />;
};

export default MermaidDiagram;
