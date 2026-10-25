import React, { useEffect, useState } from "react";
import MermaidDiagram from "./MermaidDiagram";
import { DbmlDatabase, toMermaidErDiagram } from "./dbmlToMermaid";

// Include DBML files in the build so production can load them, like the markdown docs.
// @ts-ignore - Vite-specific API
const DBML_FILES: Record<string, () => Promise<string>> = import.meta.glob(
  "/docs/**/*.dbml",
  { query: "?raw", import: "default" },
);

interface DiagramSpec {
  path: string;
  group?: string;
}

/**
 * Reads a ```dbml-diagram block body: the first line is the DBML file path, and an optional
 * `group: <name>` line limits the diagram to one TableGroup.
 */
const parseSpec = (source: string): DiagramSpec => {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const group = lines
    .find((line) => line.startsWith("group:"))
    ?.slice("group:".length)
    .trim();
  return { path: lines[0] ?? "", group: group || undefined };
};

const loadDbml = async (path: string): Promise<string> => {
  const loader = DBML_FILES[path];
  if (loader) return loader();
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.text();
};

/**
 * Compiles DBML source with @dbml/parse, which is loaded on first use to keep it out of the
 * main bundle.
 *
 * @param text DBML source.
 * @returns The compiled raw database model.
 * @throws Error listing every compile error with its line and column.
 */
const compileDbml = async (text: string): Promise<DbmlDatabase> => {
  const { Compiler, DEFAULT_ENTRY, MemoryProjectLayout } = await import(
    "@dbml/parse"
  );
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, text);
  const compiler = new Compiler(layout);
  const errors = compiler.parse.errors(DEFAULT_ENTRY);
  if (errors.length > 0) {
    throw new Error(
      errors
        .map((e: any) => {
          const pos = e.nodeOrToken?.startPos;
          const where = pos ? `line ${pos.line + 1}, column ${pos.column + 1}: ` : "";
          return `${where}${e.diagnostic}`;
        })
        .join("\n"),
    );
  }
  return compiler.parse.rawDb(DEFAULT_ENTRY) as unknown as DbmlDatabase;
};

/**
 * Renders an ER diagram from a DBML file referenced by a ```dbml-diagram fenced block.
 *
 * @param source The fenced block body, e.g. "/docs/backend/database/rgs-schema.dbml\ngroup: cart".
 */
const DbmlDiagram: React.FC<{ source: string }> = ({ source }) => {
  const [chart, setChart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { path, group } = parseSpec(source);

  useEffect(() => {
    let cancelled = false;
    setChart(null);
    setError(null);
    (async () => {
      try {
        const database = await compileDbml(await loadDbml(path));
        if (!cancelled) setChart(toMermaidErDiagram(database, group));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, group]);

  if (error) {
    return (
      <div className="my-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <p className="font-bold">Could not render diagram from {path}</p>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{error}</pre>
      </div>
    );
  }

  if (!chart) {
    return <div className="my-8 h-64 w-full animate-pulse rounded-2xl bg-slate-100" />;
  }

  const fileName = path.split("/").pop();
  return (
    <MermaidDiagram
      chart={chart}
      title={group ? `${fileName} · ${group}` : fileName}
    />
  );
};

export default DbmlDiagram;
