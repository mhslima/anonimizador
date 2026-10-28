// Builds the anonymized PDF. Pages are re-rasterized with the covered areas painted over, so no
// original text can survive underneath a label (unlike drawing boxes on top of a PDF text layer).
import { PII_LABELS } from "./detect";
import type { PageData, Region } from "./layout";

export const PDF_FOOTER =
  "Documento anonimizado automaticamente — confira sempre com o original. Prontuário Sem Identificação v1.0 · Marcio Lima · 2026";

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao preparar a página."));
    img.src = src;
  });
}

/** Paint the page with every enabled region covered by a white box carrying its label. */
export async function renderRedactedPage(
  page: PageData,
  regions: Region[],
): Promise<HTMLCanvasElement> {
  const img = await loadImg(page.image);
  const canvas = document.createElement("canvas");
  canvas.width = page.pxWidth;
  canvas.height = page.pxHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const r of regions) {
    if (!r.enabled) continue;
    const x = r.x * canvas.width;
    const y = r.y * canvas.height;
    const w = r.w * canvas.width;
    const h = r.h * canvas.height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = Math.max(1, canvas.width / 1200);
    ctx.strokeRect(x, y, w, h);
    const label = PII_LABELS[r.type];
    let size = Math.max(6, h * 0.72);
    ctx.font = `bold ${size}px Helvetica, Arial, sans-serif`;
    const tw = ctx.measureText(label).width;
    if (tw > w * 0.94) {
      size = Math.max(6, (size * w * 0.94) / tw);
      ctx.font = `bold ${size}px Helvetica, Arial, sans-serif`;
    }
    ctx.fillStyle = "#1f2937";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h / 2, w);
  }
  return canvas;
}

const toBytes = (canvas: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject)
          : reject(new Error("Falha ao gerar imagem.")),
      type,
      q,
    ),
  );

export interface ExportResult {
  pdf: Blob;
  previews: string[];
}

export async function exportPdf(
  pages: PageData[],
  regions: Region[],
  onProgress?: (msg: string) => void,
): Promise<ExportResult> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle("Documento anonimizado");
  pdf.setProducer("Prontuário Sem Identificação v1.0 — Marcio Lima, 2026");
  pdf.setCreator("Prontuário Sem Identificação");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const FOOT = 14;
  const previews: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(`Gerando página ${i + 1} de ${pages.length}…`);
    const p = pages[i]!;
    const canvas = await renderRedactedPage(
      p,
      regions.filter((r) => r.page === i),
    );
    previews.push(canvas.toDataURL("image/jpeg", 0.8));
    const typed = p.source === "typed";
    const bytes = await toBytes(canvas, typed ? "image/png" : "image/jpeg", 0.9);
    const image = typed ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([p.ptWidth, p.ptHeight + FOOT]);
    page.drawImage(image, { x: 0, y: FOOT, width: p.ptWidth, height: p.ptHeight });
    let size = 6.5;
    while (size > 4 && font.widthOfTextAtSize(PDF_FOOTER, size) > p.ptWidth - 16) size -= 0.25;
    page.drawText(PDF_FOOTER, { x: 8, y: 4.5, size, font, color: rgb(0.42, 0.45, 0.5) });
  }
  const bytes = await pdf.save();
  return { pdf: new Blob([bytes as BlobPart], { type: "application/pdf" }), previews };
}
