import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { detectRegions, redactedText, type PageData, type Region } from "@/lib/layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AcceptDialog, APP_NAME, Footer, readAccepted } from "./common";
import { UploadStep } from "./UploadStep";
import { ReviewStep } from "./ReviewStep";
import { ResultStep } from "./ResultStep";

type Stage =
  | { kind: "upload" }
  | { kind: "busy"; message: string; fraction?: number | undefined }
  | { kind: "error"; message: string }
  | { kind: "review" }
  | { kind: "result"; pdf: Blob; previews: string[]; text: string };

export function App() {
  const [accepted, setAccepted] = useState(true);
  const [stage, setStage] = useState<Stage>({ kind: "upload" });
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<PageData[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  // Read the stored acceptance only in the browser (the page is also rendered on the server).
  useEffect(() => setAccepted(readAccepted()), []);

  const analyze = async (name: string, load: () => Promise<PageData[]>) => {
    setFileName(name);
    setStage({ kind: "busy", message: "Preparando…" });
    try {
      const loaded = await load();
      setStage({ kind: "busy", message: "Procurando dados identificáveis…" });
      setPages(loaded);
      setRegions(detectRegions(loaded));
      setStage({ kind: "review" });
    } catch (e) {
      console.error(e);
      setStage({
        kind: "error",
        message: e instanceof Error ? e.message : "Não foi possível ler o arquivo.",
      });
    }
  };

  const onFile = (file: File) =>
    analyze(file.name, async () => {
      const { loadFile } = await import("@/lib/loaders");
      return loadFile(file, (message, fraction) => setStage({ kind: "busy", message, fraction }));
    });

  const onText = (text: string) =>
    analyze("texto-colado.txt", async () => {
      const { loadText } = await import("@/lib/loaders");
      return loadText(text);
    });

  const generate = async () => {
    setStage({ kind: "busy", message: "Gerando PDF anonimizado…" });
    try {
      const { exportPdf } = await import("@/lib/exporter");
      const { pdf, previews } = await exportPdf(pages, regions, (message) =>
        setStage({ kind: "busy", message }),
      );
      setStage({ kind: "result", pdf, previews, text: redactedText(pages, regions) });
    } catch (e) {
      console.error(e);
      setStage({
        kind: "error",
        message: e instanceof Error ? e.message : "Falha ao gerar o PDF.",
      });
    }
  };

  const reset = () => {
    setPages([]);
    setRegions([]);
    setFileName("");
    setStage({ kind: "upload" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          <button onClick={reset} className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </span>
            {APP_NAME}
          </button>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            100% local · sem envio de dados
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {stage.kind === "upload" && <UploadStep onFile={onFile} onText={onText} />}
        {stage.kind === "busy" && (
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">{stage.message}</p>
            {stage.fraction !== undefined && (
              <Progress value={Math.round(stage.fraction * 100)} className="w-full" />
            )}
          </div>
        )}
        {stage.kind === "error" && (
          <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
            <p className="font-medium text-destructive">{stage.message}</p>
            <Button onClick={reset}>Tentar outro arquivo</Button>
          </div>
        )}
        {stage.kind === "review" && (
          <ReviewStep
            fileName={fileName}
            pages={pages}
            regions={regions}
            onChange={setRegions}
            onGenerate={generate}
            onCancel={reset}
          />
        )}
        {stage.kind === "result" && (
          <ResultStep
            fileName={fileName}
            pdf={stage.pdf}
            previews={stage.previews}
            text={stage.text}
            onBack={() => setStage({ kind: "review" })}
            onNew={reset}
          />
        )}
      </main>

      <Footer />
      <AcceptDialog open={!accepted} onAccept={() => setAccepted(true)} />
    </div>
  );
}
