import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Download, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DisclaimerList } from "./common";

interface Props {
  fileName: string;
  pdf: Blob;
  previews: string[];
  text: string;
  onBack: () => void;
  onNew: () => void;
}

export function ResultStep({ fileName, pdf, previews, text, onBack, onNew }: Props) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  // Create the link inside the effect so a re-run (e.g. React strict mode) never leaves a revoked URL.
  useEffect(() => {
    const u = URL.createObjectURL(pdf);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [pdf]);
  const outName = `${fileName.replace(/\.[^.]+$/, "") || "documento"}-anonimizado.pdf`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Documento anonimizado</h2>
          <p className="text-sm text-muted-foreground">{outName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar à revisão
          </Button>
          <Button variant="outline" onClick={onNew}>
            Novo documento
          </Button>
          <Button asChild>
            <a href={url} download={outName}>
              <Download className="mr-1 h-4 w-4" /> Baixar PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <p className="mb-2 flex items-center gap-2 font-semibold">
          <TriangleAlert className="h-4 w-4" /> Confira este documento com o original antes de usar
        </p>
        <DisclaimerList />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4 rounded-lg border bg-muted/40 p-3">
          {previews.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Página ${i + 1} anonimizada`}
              className="mx-auto w-full max-w-[820px] bg-white shadow"
            />
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium">Texto anonimizado</p>
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? "Copiado" : "Copiar texto"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Útil para colar direto numa IA. Em fotos e documentos digitalizados o texto vem do OCR e
            pode ter erros de leitura.
          </p>
          <Textarea readOnly value={text} className="h-[60vh] font-mono text-xs" />
        </div>
      </div>
    </div>
  );
}
