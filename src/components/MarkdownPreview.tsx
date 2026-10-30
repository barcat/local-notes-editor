import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { MARKDOWN_LIMITS, type MarkdownRequest, type MarkdownResponse } from "../markdown/protocol";
import { renderMarkdownTokens } from "./renderMarkdownTokens";

interface PreviewState {
  content: string;
  noteId?: string;
  status: "loading" | "ready" | "fallback";
  rendered?: ComponentChildren;
}

export function MarkdownPreview({ content, noteId }: { content: string; noteId?: string }) {
  const [state, setState] = useState<PreviewState>({ content, noteId, status: "loading" });
  const jobId = useRef(0);

  useLayoutEffect(() => {
    const id = ++jobId.current;
    let active = true;
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { clearTimeout(timer); worker?.terminate(); };
    const finish = (status: "ready" | "fallback", rendered?: ComponentChildren) => {
      if (!active) return;
      active = false;
      stop();
      setState({ content, noteId, status, rendered });
    };
    setState({ content, noteId, status: "loading" });
    if (content.length > MARKDOWN_LIMITS.contentLength || typeof Worker === "undefined") {
      finish("fallback");
    } else {
      // The deadline includes worker startup. There is no synchronous retry.
      const deadline = performance.now() + MARKDOWN_LIMITS.timeoutMs;
      timer = setTimeout(() => finish("fallback"), MARKDOWN_LIMITS.timeoutMs);
      try {
        worker = new Worker(new URL("../markdown/markdown.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = ({ data }: MessageEvent<MarkdownResponse>) => {
          if (!active || data?.id !== id) return;
          if (performance.now() > deadline) { finish("fallback"); return; }
          try {
            if (data.ok === true) finish("ready", renderMarkdownTokens(data.tokens));
            else finish("fallback");
          } catch { finish("fallback"); }
        };
        worker.onerror = () => finish("fallback");
        worker.onmessageerror = () => finish("fallback");
        worker.postMessage({ id, content } satisfies MarkdownRequest);
      } catch { finish("fallback"); }
    }
    return () => { active = false; stop(); };
  }, [content, noteId]);

  // Never show a previous note or version, even before the layout effect runs.
  const current = state.content === content && state.noteId === noteId ? state : { status: "loading" };
  return <>
    <div class="markdown-status" role="status" aria-live="polite" aria-atomic="true">
      {current.status === "loading" ? "Przygotowuję podgląd…" : current.status === "fallback"
        ? "Dostępny jest tylko zwykły podgląd tekstu." : null}
    </div>
    {current.status === "ready" ? state.rendered : <div class="markdown-plain">{content}</div>}
  </>;
}
