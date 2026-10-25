import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DiagramViewerProps {
  svg: string;
  title?: string;
}

interface Viewport {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;
const FIT_PADDING = 32;

const clampScale = (scale: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

const FALLBACK_SIZE = { width: 1200, height: 800 };

/** Reads the natural width and height of an SVG from the viewBox in its markup. */
const naturalSize = (svg: string): { width: number; height: number } => {
  const match = /viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/.exec(svg);
  if (!match) return FALLBACK_SIZE;
  const width = parseFloat(match[1]);
  const height = parseFloat(match[2]);
  return width > 0 && height > 0 ? { width, height } : FALLBACK_SIZE;
};

const ToolbarButton: React.FC<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
  >
    {children}
  </button>
);

/**
 * Shows a rendered diagram inline, with a button that opens it in a full-screen view that can be
 * zoomed (buttons, Ctrl/⌘ + scroll) and panned (drag or scroll).
 *
 * @param svg The rendered SVG markup to display.
 * @param title Optional heading shown in the full-screen toolbar.
 */
const DiagramViewer: React.FC<DiagramViewerProps> = ({ svg, title }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const size = useMemo(() => naturalSize(svg), [svg]);

  const fitToScreen = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = size;
    const scale = clampScale(
      Math.min(
        (canvas.clientWidth - FIT_PADDING * 2) / width,
        (canvas.clientHeight - FIT_PADDING * 2) / height,
      ),
    );
    setViewport({
      scale,
      x: (canvas.clientWidth - width * scale) / 2,
      y: (canvas.clientHeight - height * scale) / 2,
    });
  }, [size]);

  const zoomAt = useCallback((factor: number, originX: number, originY: number) => {
    setViewport((current) => {
      const scale = clampScale(current.scale * factor);
      const ratio = scale / current.scale;
      return {
        scale,
        x: originX - (originX - current.x) * ratio,
        y: originY - (originY - current.y) * ratio,
      };
    });
  }, []);

  const zoomFromCenter = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    zoomAt(factor, canvas.clientWidth / 2, canvas.clientHeight / 2);
  };

  const close = useCallback(() => {
    setIsFullScreen(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!isFullScreen) return;
    overlayRef.current?.requestFullscreen?.().catch(() => undefined);
    fitToScreen();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onFullScreenChange = () => {
      if (document.fullscreenElement) {
        fitToScreen();
      } else {
        setIsFullScreen(false);
      }
    };
    const onResize = () => fitToScreen();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, [isFullScreen, fitToScreen, close]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isFullScreen || !canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        zoomAt(
          Math.exp(-event.deltaY * 0.01),
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      } else {
        setViewport((current) => ({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [isFullScreen, zoomAt]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const last = dragRef.current;
    if (!last) return;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setViewport((current) => ({
      ...current,
      x: current.x + event.clientX - last.x,
      y: current.y + event.clientY - last.y,
    }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="group relative my-8">
      <button
        type="button"
        onClick={() => setIsFullScreen(true)}
        className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm hover:border-indigo-300 hover:text-indigo-600"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
          />
        </svg>
        Full screen
      </button>
      <div
        className="flex justify-center overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6 pt-14"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {isFullScreen &&
        createPortal(
          <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Diagram"}
            className="fixed inset-0 z-[100] flex flex-col bg-slate-50"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
              <span className="truncate text-sm font-bold text-slate-700">
                {title ?? "Diagram"}
              </span>
              <div className="flex items-center gap-2">
                <ToolbarButton label="Zoom out" onClick={() => zoomFromCenter(1 / ZOOM_STEP)}>
                  −
                </ToolbarButton>
                <span className="w-14 text-center text-xs font-bold tabular-nums text-slate-500">
                  {Math.round(viewport.scale * 100)}%
                </span>
                <ToolbarButton label="Zoom in" onClick={() => zoomFromCenter(ZOOM_STEP)}>
                  +
                </ToolbarButton>
                <ToolbarButton label="Fit to screen" onClick={fitToScreen}>
                  Fit
                </ToolbarButton>
                <ToolbarButton label="Close full screen (Esc)" onClick={close}>
                  ✕
                </ToolbarButton>
              </div>
            </div>
            <div
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative flex-1 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width: size.width,
                  height: size.height,
                  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
            <div className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-400">
              Drag or scroll to pan · Ctrl/⌘ + scroll to zoom · Esc to close
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default DiagramViewer;
