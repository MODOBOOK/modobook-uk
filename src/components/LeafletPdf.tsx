import { useEffect, useRef, useState } from "react";

/** Browser-only PDF rendering avoids mobile browsers' single-page iframe viewers. */
export function LeafletPdf({ url, title }: { url: string; title: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setStatus("loading");
    host.replaceChildren();

    async function render() {
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      if (cancelled || !host) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const task = pdfjs.getDocument({ url });
      dispose = () => { void task.destroy(); };
      const pdf = await task.promise;
      for (let number = 1; number <= pdf.numPages; number++) {
        if (cancelled) return;
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const width = Math.max(host.clientWidth, 1);
        const scale = (width / viewport.width) * Math.min(window.devicePixelRatio || 1, 2);
        const fitted = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(fitted.width);
        canvas.height = Math.ceil(fitted.height);
        canvas.className = "block h-auto w-full rounded-sm border";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${title} — page ${number} of ${pdf.numPages}`);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("PDF rendering unavailable");
        await page.render({ canvasContext: context, canvas, viewport: fitted }).promise;
        if (cancelled) return;
        const section = document.createElement("div");
        section.className = "space-y-1";
        const label = document.createElement("p");
        label.className = "text-center text-xs text-muted-foreground";
        label.textContent = `Page ${number} of ${pdf.numPages}`;
        section.append(canvas, label);
        host.append(section);
        page.cleanup();
      }
      if (!cancelled) setStatus("ready");
    }
    void render().catch(() => { if (!cancelled) setStatus("error"); });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [url, title]);

  return (
    <div className="min-w-0 space-y-3" aria-busy={status === "loading"}>
      <div ref={container} className="min-w-0 space-y-4" />
      {status === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading leaflet…</p>}
      {status === "error" && <p role="alert" className="text-sm text-muted-foreground">The leaflet preview couldn’t load. You can still open the PDF below.</p>}
    </div>
  );
}