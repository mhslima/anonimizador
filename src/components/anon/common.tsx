import { useState } from "react";
import { Info, ShieldCheck } from "lucide-react";

import type { PiiType } from "@/lib/detect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const APP_NAME = "Prontuário Sem Identificação";
export const APP_CREDIT = "Desenvolvido por Marcio Lima · 2026 · Versão 1.0";

/** Hue per data type, used for highlight boxes and list chips. */
export const TYPE_COLORS: Record<PiiType, string> = {
  PACIENTE: "#e11d48",
  MEDICO: "#7c3aed",
  NOME: "#db2777",
  CPF: "#ea580c",
  RG: "#d97706",
  CNS: "#ca8a04",
  CRM: "#4f46e5",
  REGISTRO: "#0891b2",
  ENDERECO: "#16a34a",
  CEP: "#15803d",
  TELEFONE: "#0d9488",
  EMAIL: "#2563eb",
  INSTITUICAO: "#9333ea",
  ASSINATURA: "#475569",
  LOGO: "#64748b",
  OUTRO: "#6b7280",
};

export const DISCLAIMER_POINTS = [
  "Esta ferramenta é automática e pode falhar: nomes, documentos ou outros dados podem não ser encontrados, e partes do conteúdo clínico podem ser ocultadas por engano.",
  "O documento gerado pode conter diferenças em relação ao original (por exemplo, por erro de leitura do texto em fotos e exames digitalizados), o que pode levar a interpretações errôneas.",
  "O desenvolvedor não se responsabiliza por erros, omissões, dados não removidos ou por qualquer uso que se faça do documento gerado.",
  "O resultado deve SEMPRE ser conferido e confrontado com o documento original antes de ser usado ou compartilhado.",
  "Esta ferramenta não substitui a avaliação de um profissional de saúde.",
];

export function DisclaimerList({ className = "" }: { className?: string }) {
  return (
    <ul className={`list-disc space-y-1.5 pl-5 text-sm leading-relaxed ${className}`}>
      {DISCLAIMER_POINTS.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  );
}

const ACCEPT_KEY = "psi-aceite-v1";

export function readAccepted(): boolean {
  try {
    return window.localStorage.getItem(ACCEPT_KEY) === "1";
  } catch {
    return false;
  }
}

function storeAccepted() {
  try {
    window.localStorage.setItem(ACCEPT_KEY, "1");
  } catch {
    /* private mode: acceptance lasts for this visit only */
  }
}

/** Mandatory "Li e concordo" gate shown before first use. */
export function AcceptDialog({ open, onAccept }: { open: boolean; onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-xl [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Aviso de responsabilidade</DialogTitle>
          <DialogDescription>Leia com atenção antes de usar.</DialogDescription>
        </DialogHeader>
        <DisclaimerList className="text-foreground" />
        <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-md border bg-muted/50 p-3 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            className="mt-0.5"
          />
          <span>
            <strong>Li e concordo.</strong> Entendo as limitações e que devo conferir o resultado
            com o documento original.
          </span>
        </label>
        <DialogFooter>
          <Button
            disabled={!checked}
            onClick={() => {
              storeAccepted();
              onAccept();
            }}
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
          <Info className="h-3.5 w-3.5" /> Sobre
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{APP_NAME}</DialogTitle>
          <DialogDescription>{APP_CREDIT}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            Remove dados que identificam paciente e médico em exames, laudos e prontuários (nome,
            CPF, RG, cartão SUS, CRM, endereço, telefone, e-mail, instituição) e gera um novo PDF
            com etiquetas no lugar, pronto para ser usado em ferramentas de IA.
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Todo o processamento acontece no seu navegador. Nenhum arquivo é enviado para
            servidores.
          </p>
          <div>
            <p className="mb-1 font-medium">Limitações</p>
            <DisclaimerList className="text-muted-foreground" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-card/60 py-4 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4">
        <span>{APP_CREDIT}</span>
        <AboutDialog />
      </div>
    </footer>
  );
}
