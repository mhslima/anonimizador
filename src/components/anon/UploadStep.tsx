import { useRef, useState } from "react";
import { FileText, ShieldCheck, TriangleAlert, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DisclaimerList } from "./common";

interface Props {
  onFile: (file: File) => void;
  onText: (text: string) => void;
}

export function UploadStep({ onFile, onText }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10">
      <section className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Anonimize exames e prontuários
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Envie um PDF, uma foto de exame ou cole o texto do prontuário. O app encontra nome, CPF,
          RG, CRM, endereço, telefone e outros dados que identificam paciente ou médico, você
          revisa, e ele gera um novo PDF com etiquetas como{" "}
          <code className="rounded bg-muted px-1">[PACIENTE]</code> no lugar.
        </p>
        <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <ShieldCheck className="h-4 w-4" /> Nada sai do seu computador: tudo é processado no
          navegador.
        </p>
      </section>

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => input.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card p-10 text-center transition-colors ${
          drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
        }`}
      >
        <Upload className="h-10 w-10 text-primary" />
        <div>
          <p className="font-medium">Arraste o arquivo aqui ou clique para escolher</p>
          <p className="text-sm text-muted-foreground">
            PDF (com texto ou digitalizado), JPG ou PNG
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/*,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4 text-primary" /> Ou cole o texto do prontuário / resumo
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Paciente: ...\nCPF: ...\nEvolução: ..."}
          className="min-h-40 font-mono text-sm"
        />
        <div className="flex justify-end">
          <Button disabled={!text.trim()} onClick={() => onText(text)}>
            Analisar texto
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <p className="mb-2 flex items-center gap-2 font-semibold">
          <TriangleAlert className="h-4 w-4" /> Aviso de responsabilidade
        </p>
        <DisclaimerList />
      </section>
    </div>
  );
}
