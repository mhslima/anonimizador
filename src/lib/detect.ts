// Pure, browser-safe detection of identifying data in Brazilian medical documents.

export type PiiType =
  | "PACIENTE"
  | "MEDICO"
  | "NOME"
  | "CPF"
  | "RG"
  | "CNS"
  | "CRM"
  | "REGISTRO"
  | "ENDERECO"
  | "CEP"
  | "TELEFONE"
  | "EMAIL"
  | "INSTITUICAO"
  | "ASSINATURA"
  | "LOGO"
  | "OUTRO";

export const PII_LABELS: Record<PiiType, string> = {
  PACIENTE: "[PACIENTE]",
  MEDICO: "[MÉDICO]",
  NOME: "[NOME]",
  CPF: "[CPF]",
  RG: "[RG]",
  CNS: "[CNS]",
  CRM: "[CRM]",
  REGISTRO: "[REGISTRO]",
  ENDERECO: "[ENDEREÇO]",
  CEP: "[CEP]",
  TELEFONE: "[TELEFONE]",
  EMAIL: "[E-MAIL]",
  INSTITUICAO: "[INSTITUIÇÃO]",
  ASSINATURA: "[ASSINATURA]",
  LOGO: "[LOGO]",
  OUTRO: "[OCULTO]",
};

export const PII_NAMES: Record<PiiType, string> = {
  PACIENTE: "Paciente",
  MEDICO: "Médico(a)",
  NOME: "Outro nome",
  CPF: "CPF",
  RG: "RG",
  CNS: "Cartão SUS",
  CRM: "CRM / Conselho",
  REGISTRO: "Prontuário / Convênio",
  ENDERECO: "Endereço",
  CEP: "CEP",
  TELEFONE: "Telefone",
  EMAIL: "E-mail",
  INSTITUICAO: "Instituição",
  ASSINATURA: "Assinatura",
  LOGO: "Logo",
  OUTRO: "Outro",
};

export interface Match {
  start: number;
  end: number;
  type: PiiType;
  text: string;
}

export function isValidCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

const NAME_WORD = "[A-ZÀ-Ý][A-Za-zÀ-ÿ'´`-]+";
const CONNECTOR = "(?:d[aeo]s?|e)";
// A person name: 1-7 capitalized words, allowing "da/de/do/dos/e" connectors. Case-insensitive variants handled by caller.
const NAME_SEQ = `${NAME_WORD}(?:\\s+(?:${CONNECTOR}\\s+)?${NAME_WORD}){0,6}`;
const NAME_SEQ_UPPER = `[A-ZÀ-Ý][A-ZÀ-Ý'-]+(?:\\s+(?:D[AEO]S?\\s+|E\\s+)?[A-ZÀ-Ý][A-ZÀ-Ý'-]+){0,6}`;

const STOP_WORDS = new Set(
  "idade sexo data nasc nascimento cpf rg crm convênio convenio prontuário prontuario registro telefone tel fone médico medico solicitante exame atendimento masculino feminino anos leito quarto unidade setor material resultado coleta laudo".split(
    " ",
  ),
);

function trimName(value: string): string {
  const words = value.split(/\s+/);
  const out: string[] = [];
  for (const w of words) {
    const lw = w.toLowerCase();
    if (STOP_WORDS.has(lw.replace(/[^a-zà-ÿ]/g, "")) || STOP_WORDS.has(lw.split(/[-/.:]/)[0] ?? ""))
      break;
    out.push(w);
  }
  while (out.length && /^(d[aeo]s?|e)$/i.test(out[out.length - 1]!)) out.pop();
  return out.join(" ");
}

interface LabelRule {
  type: PiiType;
  label: RegExp; // must end right before the value
}

const NAME_LABELS: LabelRule[] = [
  {
    type: "PACIENTE",
    label:
      /\b(?:nome\s+do\s+paciente|nome\s+da\s+paciente|paciente|pac\.|cliente|nome\s+social|nome)\s*[:\-–]?\s*/gi,
  },
  {
    type: "NOME",
    label:
      /\b(?:nome\s+da\s+m[ãa]e|m[ãa]e|nome\s+do\s+pai|pai|respons[áa]vel|acompanhante)\s*[:\-–]\s*/gi,
  },
  {
    type: "MEDICO",
    label:
      /\b(?:m[ée]dic[oa](?:\s+(?:solicitante|respons[áa]vel|assistente))?|solicitante|requisitante|resp(?:ons[áa]vel)?\.?\s*t[ée]cnic[oa]|assinado\s+(?:digitalmente\s+)?por|profissional|dra\.?|dr\.?)\s*[:\-–]?\s*/gi,
  },
];

export function detectInText(text: string): Match[] {
  const found: Match[] = [];
  const push = (start: number, end: number, type: PiiType) => {
    if (end > start) found.push({ start, end, type, text: text.slice(start, end) });
  };
  const each = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      fn(m);
      if (m[0].length === 0) re.lastIndex++;
    }
  };

  // E-mail
  each(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => push(m.index, m.index + m[0].length, "EMAIL"));

  // CPF (formatted or labelled raw digits, check digits validated)
  each(/\b\d{3}\.?\d{3}\.?\d{3}\s?[-–]?\s?\d{2}\b/g, (m) => {
    if (isValidCpf(m[0])) push(m.index, m.index + m[0].length, "CPF");
  });
  each(/\bCPF\s*[:nº°.]*\s*([\d.\-\s]{11,16})/gi, (m) => {
    const v = m[1]!.trimEnd();
    const s = m.index + m[0].indexOf(m[1]!);
    push(s, s + v.length, "CPF");
  });

  // CNS (cartão SUS) – 15 digits
  each(
    /\b(?:CNS|cart[ãa]o\s+(?:nacional\s+de\s+)?sa[úu]de|cart[ãa]o\s+sus)\s*[:nº°.]*\s*(\d[\d\s.]{13,20}\d)/gi,
    (m) => {
      const s = m.index + m[0].indexOf(m[1]!);
      push(s, s + m[1]!.length, "CNS");
    },
  );
  each(/\b\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, (m) => {
    if (m[0].replace(/\D/g, "").length === 15 && /^[1-9]/.test(m[0]))
      push(m.index, m.index + m[0].length, "CNS");
  });

  // RG
  each(
    /\b(?:RG|R\.G\.|identidade|doc(?:umento)?\.?\s+de\s+identidade)\s*[:nº°.]*\s*([\dXx][\dXx.\-/\s]{4,15}[\dXx])(?:\s*[-/]?\s*(?:SSP|DETRAN|IFP|SDS|PC)\s*[-/]?\s*[A-Z]{2})?/gi,
    (m) => {
      const s = m.index + m[0].indexOf(m[1]!);
      push(s, m.index + m[0].length, "RG");
    },
  );

  // CRM / other councils
  each(
    /\b(?:CRM|COREN|CRF|CRO|CRN|CREFITO|CRP|CRBM|RQE)\s*[-/]?\s*(?:[A-Z]{2})?\s*[:nº°.\-/]*\s*\d[\d.\-]{2,9}(?:\s*[-/]\s*[A-Z]{2}\b)?/g,
    (m) => push(m.index, m.index + m[0].length, "CRM"),
  );

  // Record numbers: prontuário, convênio, carteirinha, matrícula, atendimento, pedido, OS
  each(
    /\b(?:prontu[áa]rio|carteir(?:inha|a)|matr[íi]cula|n[ºo°]?\s*(?:do\s+)?conv[êe]nio|conv[êe]nio|atendimento|pedido|protocolo|registro|requisi[çc][ãa]o|O\.?S\.?|c[óo]d(?:igo)?\.?\s+(?:do\s+)?paciente)\s*[:nº°#.]*\s*([A-Z]{0,3}\d[\w.\-/]{2,24})/gi,
    (m) => {
      const s = m.index + m[0].indexOf(m[1]!);
      push(s, s + m[1]!.length, "REGISTRO");
    },
  );

  // CEP
  each(/\b\d{5}-\d{3}\b/g, (m) => push(m.index, m.index + m[0].length, "CEP"));

  // Phones
  each(/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\s?\d{4}[-\s]?\d{4}\b/g, (m) => {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13 && !isValidCpf(digits))
      push(m.index, m.index + m[0].length, "TELEFONE");
  });

  // Address: from street keyword to end of line
  each(
    /\b(?:Rua|R\.|Avenida|Av\.?|Travessa|Tv\.|Alameda|Al\.|Rodovia|Rod\.|Pra[çc]a|Estrada|Largo|Quadra|Q[ND]\s|SQS|SHIS|Setor)\s+[^\n]{3,}/g,
    (m) => {
      const cut = m[0].search(/\s{3,}|\b(?:tel|fone|telefone|e-?mail|cpf|crm)\b/i);
      const len = cut > 0 ? cut : m[0].length;
      push(m.index, m.index + len, "ENDERECO");
    },
  );
  each(/\b(?:endere[çc]o|resid[êe]ncia|bairro)\s*[:\-–]\s*([^\n]{3,})/gi, (m) => {
    const s = m.index + m[0].indexOf(m[1]!);
    const cut = m[1]!.search(/\s{3,}|\b(?:tel|fone|telefone|e-?mail|cpf)\b/i);
    push(s, s + (cut > 0 ? cut : m[1]!.length), "ENDERECO");
  });

  // Institutions
  each(
    /\b(?:Hospital|Cl[íi]nica|Laborat[óo]rio|Instituto|Centro\s+(?:M[ée]dico|de\s+Diagn[óo]stico|Cl[íi]nico)|Policl[íi]nica|Santa\s+Casa|Maternidade|UPA|UBS|Diagn[óo]sticos?|Medicina\s+Diagn[óo]stica|Imagem)\b[^\n]{0,60}/gi,
    (m) => {
      // keep only the name-like part: stop at punctuation that starts a sentence
      const cut = m[0].search(/\s{3,}|[,;]|\s-\s|\b(?:tel|fone|cnpj|crm|rua|av\.?)\b/i);
      const raw = cut > 0 ? m[0].slice(0, cut) : m[0];
      // must contain at least one capitalized word after the keyword or be all-caps
      if (/^[A-ZÀ-Ý]/.test(raw)) push(m.index, m.index + raw.trimEnd().length, "INSTITUICAO");
    },
  );
  each(/\bCNPJ\s*[:nº°.]*\s*[\d./\-]{14,18}/gi, (m) =>
    push(m.index, m.index + m[0].length, "INSTITUICAO"),
  );

  // Labelled names
  for (const rule of NAME_LABELS) {
    each(rule.label, (m) => {
      let s = m.index + m[0].length;
      // Skip a title between the label and the name ("Médico: Dra. Fernanda …").
      const title = /^(?:dra?|doutora?|prof(?:a|essora?)?)\.?\s+/i.exec(text.slice(s));
      if (title) s += title[0].length;
      const after = text.slice(s);
      const nm = new RegExp(`^(?:${NAME_SEQ_UPPER}|${NAME_SEQ})`).exec(after);
      if (!nm) return;
      const name = trimName(nm[0]);
      if (name.length < 3) return;
      // "Nome" alone requires at least two words to avoid false positives like "Nome: Exame"
      if (name.split(/\s+/).length < 2 && /nome|dr|dra|pac/i.test(m[0])) return;
      push(s, s + name.length, rule.type);
    });
  }

  return found;
}

/** Find every other occurrence of detected person names in the text. */
export function propagateNames(text: string, matches: Match[]): Match[] {
  const out = [...matches];
  const names = new Map<string, PiiType>();
  for (const m of matches) {
    if (m.type === "PACIENTE" || m.type === "MEDICO" || m.type === "NOME") {
      const n = m.text.trim();
      if (n.length >= 4) names.set(n, m.type);
    }
  }
  for (const [name, type] of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(`(?<![A-Za-zÀ-ÿ])${esc}(?![A-Za-zÀ-ÿ])`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)))
      out.push({ start: m.index, end: m.index + m[0].length, type, text: m[0] });
  }
  return out;
}

/** Full detection pipeline on a text; returns non-overlapping-ish matches (overlaps are allowed, they merge visually). */
export function detectAll(text: string): Match[] {
  const base = detectInText(text);
  const all = propagateNames(text, base);
  const seen = new Set<string>();
  return all.filter((m) => {
    const k = `${m.start}:${m.end}:${m.type}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Replace matched ranges with labels (longest-first, non-overlapping). */
export function redactText(text: string, matches: Match[]): string {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  let out = "";
  let pos = 0;
  for (const m of sorted) {
    if (m.start < pos) continue;
    out += text.slice(pos, m.start) + PII_LABELS[m.type];
    pos = m.end;
  }
  return out + text.slice(pos);
}
