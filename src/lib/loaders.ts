// Browser-only loaders: turn a PDF, an image or pasted text into rendered pages with word boxes.
// Everything runs locally: the web app serves the OCR worker, engine and Portuguese data from
// /tesseract; the offline single-file build embeds them and calls configureEngines().
import type { PageData, Word } from "./layout";

export type Progress = (msg: string, fraction?: number) => void;

const PDF_SCALE = 2; // ~144 dpi: sharp enough to read, small enough to keep memory in check
const MAX_IMAGE_SIDE = 2600;

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

// ---------- Engine sources ----------

export interface EngineSources {
  /**
   * A worker script that already contains the OCR engine and answers requests for
   * `${langPath}/por.traineddata.gz` itself, so the worker never loads anything else.
   */
  tesseract?: { workerPath: string; langPath: string };
  /** Installs pdf.js' worker on the main thread (sets globalThis.pdfjsWorker). */
  pdfWorker?: () => Promise<void>;
}

let sources: EngineSources = {};

export function configureEngines(s: EngineSources) {
  sources = s;
}

// ---------- OCR ----------

type TessWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;
let workerPromise: Promise<TessWorker> | null = null;
let ocrListener: ((p: number) => void) | null = null;

async function getOcrWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const logger = (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text" && ocrListener) ocrListener(m.progress);
      };
      const embedded = sources.tesseract;
      if (embedded) {
        return createWorker("por", 1, {
          workerPath: embedded.workerPath,
          workerBlobURL: false,
          langPath: embedded.langPath,
          cacheMethod: "none",
          gzip: true,
          logger,
        });
      }
      const base = new URL("/tesseract/", window.location.href).href;
      return createWorker("por", 1, {
        workerPath: base + "worker.min.js",
        corePath: base,
        langPath: base.replace(/\/$/, ""),
        gzip: true,
        logger,
      });
    })();
    workerPromise.catch(() => (workerPromise = null));
  }
  return workerPromise;
}

async function ocrCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void,
): Promise<Word[]> {
  const worker = await getOcrWorker();
  ocrListener = onProgress ?? null;
  try {
    const { data } = await worker.recognize(canvas);
    const W = canvas.width;
    const H = canvas.height;
    return (data.words ?? [])
      .filter((w) => w.text.trim() && w.confidence > 20)
      .map((w) => ({
        text: w.text.trim(),
        x: w.bbox.x0 / W,
        y: w.bbox.y0 / H,
        w: (w.bbox.x1 - w.bbox.x0) / W,
        h: (w.bbox.y1 - w.bbox.y0) / H,
      }));
  } finally {
    ocrListener = null;
  }
}

// ---------- PDF ----------

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // Compile-time flag so the offline build does not also embed the worker as a separate URL asset.
  if (import.meta.env["VITE_PSI_OFFLINE"]) {
    await sources.pdfWorker?.();
    return pdfjs;
  }
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/**
 * Split a PDF text run into words. Word positions come from measuring the run with a similar font and
 * scaling to the run's real width, so boxes line up with proportional fonts.
 */
function splitRun(str: string, family: string, x: number, y: number, w: number, h: number): Word[] {
  measureCtx ??= canvasOf(1, 1).getContext("2d")!;
  measureCtx.font = `100px ${family || "sans-serif"}`;
  const width = (s: string) => measureCtx!.measureText(s).width;
  const total = width(str) || 1;
  const out: Word[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    const x0 = width(str.slice(0, m.index)) / total;
    const ww = width(m[0]) / total;
    out.push({ text: m[0], x: x + w * x0, y, w: w * ww, h });
  }
  return out;
}

export async function loadPdf(file: File, progress: Progress): Promise<PageData[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PageData[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    progress(`Lendo página ${n} de ${doc.numPages}…`, (n - 1) / doc.numPages);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: PDF_SCALE });
    const canvas = canvasOf(vp.width, vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const content = await page.getTextContent();
    let words: Word[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const tx = pdfjs.Util.transform(vp.transform, item.transform);
      const fontH = Math.hypot(tx[2], tx[3]);
      const width = item.width * PDF_SCALE;
      words.push(
        ...splitRun(
          item.str,
          content.styles[item.fontName]?.fontFamily ?? "sans-serif",
          tx[4] / canvas.width,
          (tx[5] - fontH) / canvas.height,
          width / canvas.width,
          (fontH * 1.15) / canvas.height,
        ),
      );
    }
    let source: PageData["source"] = "pdf-text";
    // Scanned page (no real text layer): read it with OCR.
    if (words.map((w) => w.text).join("").length < 20) {
      progress(
        `Página ${n} é digitalizada — lendo o texto da imagem (OCR)…`,
        (n - 1) / doc.numPages,
      );
      words = await ocrCanvas(canvas, (p) =>
        progress(
          `OCR da página ${n} de ${doc.numPages}: ${Math.round(p * 100)}%`,
          (n - 1 + p) / doc.numPages,
        ),
      );
      source = "ocr";
    }
    pages.push({
      image: canvas.toDataURL("image/png"),
      pxWidth: canvas.width,
      pxHeight: canvas.height,
      ptWidth: base.width,
      ptHeight: base.height,
      words,
      source,
    });
    page.cleanup();
  }
  await doc.destroy();
  return pages;
}

// ---------- Image ----------

export async function loadImage(file: File, progress: Progress): Promise<PageData[]> {
  progress("Abrindo a imagem…", 0);
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_IMAGE_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = canvasOf(bmp.width * k, bmp.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  progress("Lendo o texto da imagem (OCR)… a primeira vez pode levar alguns segundos.", 0.05);
  const words = await ocrCanvas(canvas, (p) => progress(`OCR: ${Math.round(p * 100)}%`, p));
  // Fit to A4 width in points, keeping the aspect ratio.
  const ptWidth = 595;
  return [
    {
      image: canvas.toDataURL("image/jpeg", 0.92),
      pxWidth: canvas.width,
      pxHeight: canvas.height,
      ptWidth,
      ptHeight: (ptWidth * canvas.height) / canvas.width,
      words,
      source: "ocr",
    },
  ];
}

// ---------- Pasted text ----------

const A4 = { pt: [595, 842] as const, k: 2 };
const FONT_PX = 22;
const LINE_PX = 34;
const MARGIN_PX = 96;
const FONT = `${FONT_PX}px Helvetica, Arial, sans-serif`;

/** Lay pasted text out on A4 pages so it goes through the same review and export as any document. */
export function loadText(raw: string): PageData[] {
  const W = A4.pt[0] * A4.k;
  const H = A4.pt[1] * A4.k;
  const measure = canvasOf(1, 1).getContext("2d")!;
  measure.font = FONT;
  const space = measure.measureText(" ").width;
  const maxX = W - MARGIN_PX;

  type Placed = { text: string; x: number; y: number; w: number };
  const pagesWords: Placed[][] = [[]];
  let x = MARGIN_PX;
  let y = MARGIN_PX;
  const newLine = () => {
    x = MARGIN_PX;
    y += LINE_PX;
    if (y + LINE_PX > H - MARGIN_PX) {
      pagesWords.push([]);
      y = MARGIN_PX;
    }
  };
  const lines = raw.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  lines.forEach((line, li) => {
    if (li > 0) newLine();
    const re = /(\s*)(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const lead = m[1] ?? "";
      const word = m[2] ?? "";
      const gap = lead.length * space;
      const w = measure.measureText(word).width;
      if (x > MARGIN_PX && x + gap + w > maxX) newLine();
      else x += x > MARGIN_PX || lead ? gap : 0;
      pagesWords[pagesWords.length - 1]!.push({ text: word, x, y, w });
      x += w;
    }
  });

  return pagesWords.map((placed) => {
    const canvas = canvasOf(W, H);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#111";
    ctx.font = FONT;
    ctx.textBaseline = "top";
    for (const p of placed) ctx.fillText(p.text, p.x, p.y);
    return {
      image: canvas.toDataURL("image/png"),
      pxWidth: W,
      pxHeight: H,
      ptWidth: A4.pt[0],
      ptHeight: A4.pt[1],
      words: placed.map((p) => ({
        text: p.text,
        x: p.x / W,
        y: (p.y - 2) / H,
        w: p.w / W,
        h: (FONT_PX + 6) / H,
      })),
      source: "typed" as const,
    };
  });
}

export async function loadFile(file: File, progress: Progress): Promise<PageData[]> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return loadPdf(file, progress);
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|gif)$/.test(name))
    return loadImage(file, progress);
  if (file.type.startsWith("text/") || name.endsWith(".txt")) return loadText(await file.text());
  throw new Error(
    "Formato não suportado. Envie um PDF, uma imagem (JPG/PNG) ou um arquivo de texto.",
  );
}
