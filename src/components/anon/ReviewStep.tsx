import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MousePointer2,
  SquareDashedMousePointer,
  Trash2,
} from "lucide-react";

import { PII_LABELS, PII_NAMES, type PiiType } from "@/lib/detect";
import { newManualRegion, type Box, type PageData, type Region } from "@/lib/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TYPE_COLORS } from "./common";

const TYPES = Object.keys(PII_NAMES) as PiiType[];

interface Props {
  fileName: string;
  pages: PageData[];
  regions: Region[];
  onChange: (regions: Region[]) => void;
  onGenerate: () => void;
  onCancel: () => void;
}

export function ReviewStep({ fileName, pages, regions, onChange, onGenerate, onCancel }: Props) {
  const [pageIdx, setPageIdx] = useState(0);
  const [mode, setMode] = useState<"select" | "draw">("select");
  const [drawType, setDrawType] = useState<PiiType>("PACIENTE");
  const [draft, setDraft] = useState<Box | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  const page = pages[pageIdx]!;
  const pageRegions = regions.filter((r) => r.page === pageIdx);
  const enabledCount = regions.filter((r) => r.enabled).length;
  const ocrPages = pages.filter((p) => p.source === "ocr").length;

  const grouped = useMemo(() => {
    const g = new Map<PiiType, Region[]>();
    for (const r of regions) g.set(r.type, [...(g.get(r.type) ?? []), r]);
    return TYPES.filter((t) => g.has(t)).map((t) => [t, g.get(t)!] as const);
  }, [regions]);

  const update = (id: string, patch: Partial<Region>) =>
    onChange(regions.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(regions.filter((r) => r.id !== id));

  const rel = (e: React.PointerEvent) => {
    const b = surface.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (mode !== "draw") return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = rel(e);
    setDraft({ ...start.current, w: 0, h: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const p = rel(e);
    const s = start.current;
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const p = rel(e);
    const box = draft;
    start.current = null;
    setDraft(null);
    if (box && box.w > 0.004 && box.h > 0.003) {
      onChange([
        ...regions,
        { ...newManualRegion(pageIdx, box, drawType), text: wordsIn(page, box) },
      ]);
      return;
    }
    // A plain click marks the word under the pointer.
    const word = page.words.find(
      (w) => p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h,
    );
    if (word) {
      const pad = word.h * 0.15;
      const box2 = { x: word.x - pad, y: word.y - pad, w: word.w + pad * 2, h: word.h + pad * 2 };
      onChange([...regions, { ...newManualRegion(pageIdx, box2, drawType), text: word.text }]);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Revise as áreas ocultadas</h2>
          <p className="text-sm text-muted-foreground">
            {fileName} · {pages.length} página(s) · {enabledCount} área(s) serão ocultadas
            {ocrPages > 0 && " · texto lido por OCR: confira com atenção"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Novo documento
          </Button>
          <Button onClick={onGenerate}>Gerar PDF anonimizado</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <div className="flex rounded-md border p-0.5">
          <Button
            size="sm"
            variant={mode === "select" ? "secondary" : "ghost"}
            onClick={() => setMode("select")}
          >
            <MousePointer2 className="mr-1 h-4 w-4" /> Selecionar
          </Button>
          <Button
            size="sm"
            variant={mode === "draw" ? "secondary" : "ghost"}
            onClick={() => setMode("draw")}
          >
            <SquareDashedMousePointer className="mr-1 h-4 w-4" /> Marcar área
          </Button>
        </div>
        {mode === "draw" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Tipo:</span>
            <TypeSelect value={drawType} onChange={setDrawType} />
            <span className="hidden text-xs text-muted-foreground md:inline">
              Arraste para desenhar ou clique numa palavra
            </span>
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowLabels((v) => !v)}
          className="ml-auto"
        >
          {showLabels ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
          {showLabels ? "Ver original" : "Prévia das etiquetas"}
        </Button>
        {pages.length > 1 && (
          <div className="flex items-center gap-1 text-sm">
            <Button
              size="icon"
              variant="ghost"
              disabled={pageIdx === 0}
              onClick={() => setPageIdx(pageIdx - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {pageIdx + 1} / {pages.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              disabled={pageIdx === pages.length - 1}
              onClick={() => setPageIdx(pageIdx + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="overflow-auto rounded-lg border bg-muted/40 p-3">
          <div
            ref={surface}
            className={`relative mx-auto w-full max-w-[900px] select-none bg-white shadow ${mode === "draw" ? "cursor-crosshair touch-none" : ""}`}
            style={{ aspectRatio: `${page.pxWidth} / ${page.pxHeight}` }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            <img
              src={page.image}
              alt={`Página ${pageIdx + 1}`}
              className="absolute inset-0 h-full w-full"
              draggable={false}
            />
            {pageRegions.map((r) => (
              <RegionBox
                key={r.id}
                r={r}
                preview={showLabels}
                interactive={mode === "select"}
                onToggle={() => update(r.id, { enabled: !r.enabled })}
              />
            ))}
            {draft && (
              <div
                className="pointer-events-none absolute border-2 border-dashed"
                style={{
                  ...pct(draft),
                  borderColor: TYPE_COLORS[drawType],
                  background: `${TYPE_COLORS[drawType]}22`,
                }}
              />
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Clique numa área para ativar/desativar. Áreas tracejadas não serão ocultadas.
          </p>
        </div>

        <aside className="rounded-lg border bg-card">
          <div className="border-b p-3 text-sm font-medium">
            Dados encontrados ({regions.length})
          </div>
          <div className="h-[60vh] overflow-y-auto lg:h-[calc(100vh-280px)]">
            <div className="space-y-4 p-3">
              {grouped.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum dado identificável foi encontrado automaticamente. Use “Marcar área” para
                  ocultar o que for preciso.
                </p>
              )}
              {grouped.map(([type, list]) => (
                <div key={type} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: TYPE_COLORS[type] }}
                      />
                      {PII_NAMES[type]}{" "}
                      <span className="text-muted-foreground">({list.length})</span>
                    </span>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        const all = list.every((r) => r.enabled);
                        const ids = new Set(list.map((r) => r.id));
                        onChange(regions.map((r) => (ids.has(r.id) ? { ...r, enabled: !all } : r)));
                      }}
                    >
                      {list.every((r) => r.enabled) ? "desmarcar todos" : "marcar todos"}
                    </button>
                  </div>
                  {list.map((r) => (
                    <div
                      key={r.id}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${r.page === pageIdx ? "" : "opacity-80"}`}
                    >
                      <Checkbox
                        checked={r.enabled}
                        onCheckedChange={(v) => update(r.id, { enabled: v === true })}
                      />
                      <button
                        className="min-w-0 flex-1 truncate text-left hover:underline"
                        title={r.text || "Área marcada manualmente"}
                        onClick={() => setPageIdx(r.page)}
                      >
                        {r.text || <em className="text-muted-foreground">área manual</em>}
                        {pages.length > 1 && (
                          <span className="ml-1 text-xs text-muted-foreground">p.{r.page + 1}</span>
                        )}
                      </button>
                      <TypeSelect
                        value={r.type}
                        onChange={(t) => update(r.id, { type: t })}
                        compact
                      />
                      {r.origin === "manual" && (
                        <button
                          onClick={() => remove(r.id)}
                          title="Excluir"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const pct = (b: Box) => ({
  left: `${b.x * 100}%`,
  top: `${b.y * 100}%`,
  width: `${b.w * 100}%`,
  height: `${b.h * 100}%`,
});

function wordsIn(page: PageData, box: Box) {
  return page.words
    .filter((w) => {
      const cx = w.x + w.w / 2;
      const cy = w.y + w.h / 2;
      return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h;
    })
    .map((w) => w.text)
    .join(" ")
    .slice(0, 80);
}

function RegionBox({
  r,
  preview,
  interactive,
  onToggle,
}: {
  r: Region;
  preview: boolean;
  interactive: boolean;
  onToggle: () => void;
}) {
  const color = TYPE_COLORS[r.type];
  const showLabel = preview && r.enabled;
  return (
    <button
      type="button"
      title={`${PII_NAMES[r.type]}${r.text ? `: ${r.text}` : ""} — clique para ${r.enabled ? "não ocultar" : "ocultar"}`}
      onClick={interactive ? onToggle : undefined}
      onPointerDown={(e) => interactive && e.stopPropagation()}
      className={`absolute flex items-center justify-center overflow-hidden rounded-[2px] ${interactive ? "cursor-pointer" : "pointer-events-none"}`}
      style={{
        ...pct(r),
        border: `${r.enabled ? 2 : 1.5}px ${r.enabled ? "solid" : "dashed"} ${color}`,
        background: showLabel ? "#fff" : r.enabled ? `${color}33` : "transparent",
        containerType: "size",
      }}
    >
      {showLabel && (
        <span
          className="whitespace-nowrap font-bold text-gray-800"
          style={{ fontSize: "min(70cqh, 9cqw)" }}
        >
          {PII_LABELS[r.type]}
        </span>
      )}
    </button>
  );
}

function TypeSelect({
  value,
  onChange,
  compact,
}: {
  value: PiiType;
  onChange: (t: PiiType) => void;
  compact?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PiiType)}>
      <SelectTrigger className={compact ? "h-7 w-[110px] px-2 text-xs" : "h-8 w-[170px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TYPES.map((t) => (
          <SelectItem key={t} value={t}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
              {PII_NAMES[t]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
