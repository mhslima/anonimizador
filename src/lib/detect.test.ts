import { describe, it, expect } from "vitest";
import { detectAll, isValidCpf, redactText } from "./detect";

const types = (t: string) => detectAll(t).map((m) => `${m.type}:${m.text}`);

describe("detectores", () => {
  it("valida CPF pelos dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
  it("detecta CPF formatado", () => {
    expect(types("CPF: 529.982.247-25")).toContain("CPF:529.982.247-25");
  });
  it("detecta nome do paciente pelo rótulo", () => {
    expect(types("Paciente: Maria da Silva Souza   Idade: 45 anos")).toContain("PACIENTE:Maria da Silva Souza");
  });
  it("detecta médico e CRM", () => {
    const r = types("Médico solicitante: Dr. João Pereira CRM-SP 123456");
    expect(r.some((x) => x.startsWith("MEDICO:João Pereira"))).toBe(true);
    expect(r.some((x) => x.startsWith("CRM:CRM-SP 123456"))).toBe(true);
  });
  it("detecta telefone e e-mail", () => {
    const r = types("Tel: (11) 98765-4321 email: maria@exemplo.com.br");
    expect(r).toContain("TELEFONE:(11) 98765-4321");
    expect(r).toContain("EMAIL:maria@exemplo.com.br");
  });
  it("substitui o nome em todas as ocorrências", () => {
    const t = "Paciente: Ana Lima Costa\nA paciente Ana Lima Costa refere dor.";
    expect(redactText(t, detectAll(t))).toBe("Paciente: [PACIENTE]\nA paciente [PACIENTE] refere dor.");
  });
  it("não oculta dados clínicos", () => {
    expect(detectAll("Hemoglobina: 13,5 g/dL  Leucócitos: 7.200 /mm3")).toHaveLength(0);
  });
});
