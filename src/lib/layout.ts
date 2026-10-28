// Pure document model: words with boxes per page, text building, mapping detections to page regions.
import { PII_LABELS, detectAll, type Match, type PiiType } from "./detect";

/** Box in page-relative units (0..1 of page width/height). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Word extends Box {
  text: string;
}

export interface PageData {
  /** Rendered page bitmap (PNG/JPEG data URL). */
  image: string;
  /** Bitmap size in pixels. */
  pxWidth: number;
  pxHeight: number;
  /** Output size in PDF points. */
  ptWidth: number;
  ptHeight: number;
  words: Word[];
  /** How the text was obtained. */
  source: "pdf-text" | "ocr" | "typed";
}

export interface Region extends Box {
  id: string;
  page: number;
  type: PiiType;
  text: string;
  origin: "auto" | "manual";
  enabled: boolean;
}

interface WordRef {
  page: number;
  word: number;
  start: number;
  end: number;
}

export interface DocText {
  text: string;
  refs: WordRef[];
}

/** Group words of a page into reading-order lines. */
export function toLines(words: Word[]): Word[][] {
  const sorted = words
    .map((w, i) => ({ w, i }))
    .sort((a, b) => a.w.y + a.w.h / 2 - (b.w.y + b.w.h / 2) || a.w.x - b.w.x);
  const lines: { cy: number; h: number; items: { w: Word; i: number }[] }[] = [];
  for (const it of sorted) {
    const cy = it.w.y + it.w.h / 2;
    const line = lines.find((l) => Math.abs(l.cy - cy) < Math.max(l.h, it.w.h) * 0.5);
    if (line) line.items.push(it);
    else lines.push({ cy, h: it.w.h, items: [it] });
  }
  lines.sort((a, b) => a.cy - b.cy);
  return lines.map((l) => l.items.sort((a, b) => a.w.x - b.w.x).map((it) => it.w));
}

/**
 * Build the document text (pages separated by blank lines) and remember where each word sits.
 * Words on a line are joined by one space, or three when there is a wide gap (so field labels in
 * tabular layouts stay apart — the detector treats 3+ spaces as a field boundary).
 */
export function buildText(pages: PageData[]): DocText {
  let text = "";
  const refs: WordRef[] = [];
  pages.forEach((p, pi) => {
    if (pi > 0) text += "\n\n";
    const lines = toLines(p.words);
    lines.forEach((line, li) => {
      if (li > 0) text += "\n";
      line.forEach((w, wi) => {
        if (wi > 0) {
          const prev = line[wi - 1]!;
          const gap = w.x - (prev.x + prev.w);
          text += gap > Math.max(prev.h, w.h) * 1.5 ? "   " : " ";
        }
        const start = text.length;
        text += w.text;
        refs.push({ page: pi, word: p.words.indexOf(w), start, end: text.length });
      });
    });
  });
  return { text, refs };
}

let seq = 0;
const newId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Turn text matches into page boxes (one per line fragment), covering only the matched characters. */
export function matchesToRegions(pages: PageData[], doc: DocText, matches: Match[]): Region[] {
  const regions: Region[] = [];
  for (const m of matches) {
    const parts = new Map<string, Box & { page: number }>();
    for (const r of doc.refs) {
      if (r.end <= m.start || r.start >= m.end) continue;
      const w = pages[r.page]!.words[r.word]!;
      const len = Math.max(1, r.end - r.start);
      const a = Math.max(0, m.start - r.start) / len;
      const b = Math.min(len, m.end - r.start) / len;
      const x0 = w.x + w.w * a;
      const x1 = w.x + w.w * b;
      // same visual line = same page and vertical centers closer than half the taller box
      const cy = w.y + w.h / 2;
      const cur = [...parts.values()].find(
        (p) => p.page === r.page && Math.abs(p.y + p.h / 2 - cy) < Math.max(p.h, w.h) / 2,
      );
      if (!cur) parts.set(`${parts.size}`, { page: r.page, x: x0, y: w.y, w: x1 - x0, h: w.h });
      else {
        const nx0 = Math.min(cur.x, x0);
        const nx1 = Math.max(cur.x + cur.w, x1);
        const ny0 = Math.min(cur.y, w.y);
        const ny1 = Math.max(cur.y + cur.h, w.y + w.h);
        Object.assign(cur, { x: nx0, y: ny0, w: nx1 - nx0, h: ny1 - ny0 });
      }
    }
    for (const p of parts.values()) {
      // small padding so glyph edges are fully covered
      const padX = p.h * 0.15;
      const padY = p.h * 0.12;
      regions.push({
        id: newId(),
        page: p.page,
        x: Math.max(0, p.x - padX),
        y: Math.max(0, p.y - padY),
        w: Math.min(1, p.w + padX * 2),
        h: Math.min(1, p.h + padY * 2),
        type: m.type,
        text: m.text.trim(),
        origin: "auto",
        enabled: true,
      });
    }
  }
  return dedupeRegions(regions);
}

/** Drop regions that are (nearly) contained in another region of the same page. */
function dedupeRegions(regions: Region[]): Region[] {
  const area = (r: Box) => r.w * r.h;
  const sorted = [...regions].sort((a, b) => area(b) - area(a));
  const out: Region[] = [];
  for (const r of sorted) {
    const inside = out.some(
      (o) =>
        o.page === r.page &&
        r.x >= o.x - 1e-4 &&
        r.y >= o.y - 1e-4 &&
        r.x + r.w <= o.x + o.w + 1e-4 &&
        r.y + r.h <= o.y + o.h + 1e-4,
    );
    if (!inside) out.push(r);
  }
  return out.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

export function newManualRegion(page: number, box: Box, type: PiiType): Region {
  return { id: newId(), page, ...box, type, text: "", origin: "manual", enabled: true };
}

/** Full automatic pass over a loaded document. */
export function detectRegions(pages: PageData[]): Region[] {
  const doc = buildText(pages);
  return matchesToRegions(pages, doc, detectAll(doc.text));
}

const overlaps = (a: Box, b: Box) => {
  const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ix > 0 && iy > 0 ? (ix * iy) / Math.max(1e-9, a.w * a.h) : 0;
};

/**
 * Anonymized plain text: every word (or the covered part of it) under an enabled region is replaced by
 * that region's label; consecutive identical labels collapse into one.
 */
export function redactedText(pages: PageData[], regions: Region[]): string {
  const doc = buildText(pages);
  const active = regions.filter((r) => r.enabled);
  const cuts: { start: number; end: number; label: string }[] = [];
  for (const ref of doc.refs) {
    const w = pages[ref.page]!.words[ref.word]!;
    const hit = active.find((r) => r.page === ref.page && overlaps(w, r) > 0);
    if (!hit) continue;
    // character span of the word that falls inside the region horizontally
    const len = ref.end - ref.start;
    const a = Math.max(0, Math.floor(((hit.x - w.x) / w.w) * len + 0.25));
    const b = Math.min(len, Math.ceil(((hit.x + hit.w - w.x) / w.w) * len - 0.25));
    if (b <= a) continue;
    cuts.push({ start: ref.start + a, end: ref.start + b, label: PII_LABELS[hit.type] });
  }
  cuts.sort((x, y) => x.start - y.start);
  let out = "";
  let pos = 0;
  let last: { label: string; endOut: number } | null = null;
  for (const c of cuts) {
    if (c.start < pos) continue;
    const between = doc.text.slice(pos, c.start);
    if (last && last.label === c.label && last.endOut === out.length && /^[ \t]*$/.test(between)) {
      pos = c.end;
      continue;
    }
    out += between + c.label;
    last = { label: c.label, endOut: out.length };
    pos = c.end;
  }
  return out + doc.text.slice(pos);
}
