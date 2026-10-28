import { describe, expect, it } from "vitest";
import { buildText, detectRegions, redactedText, type PageData, type Word } from "./layout";

// Lay words out left-to-right on lines, 0.01 per character, like a monospaced page.
function page(lines: string[]): PageData {
  const words: Word[] = [];
  lines.forEach((line, li) => {
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      words.push({
        text: m[0],
        x: 0.05 + m.index * 0.01,
        y: 0.05 + li * 0.03,
        w: m[0].length * 0.01,
        h: 0.02,
      });
    }
  });
  return {
    image: "",
    pxWidth: 1000,
    pxHeight: 1400,
    ptWidth: 595,
    ptHeight: 842,
    words,
    source: "typed",
  };
}

describe("layout", () => {
  it("reconstrói o texto em ordem de leitura", () => {
    const p = page(["Paciente: Maria da Silva", "CPF: 529.982.247-25"]);
    p.words.reverse();
    expect(buildText([p]).text).toBe("Paciente: Maria da Silva\nCPF: 529.982.247-25");
  });

  it("gera uma área por dado, cobrindo só o valor", () => {
    const regions = detectRegions([page(["Paciente: Maria da Silva", "CPF: 529.982.247-25"])]);
    const pac = regions.find((r) => r.type === "PACIENTE")!;
    const cpf = regions.find((r) => r.type === "CPF")!;
    expect(pac.text).toBe("Maria da Silva");
    // "Paciente: " has 10 chars → the box starts near x = 0.05 + 0.10, not at the label
    expect(pac.x).toBeGreaterThan(0.14);
    expect(cpf.y).toBeGreaterThan(pac.y);
  });

  it("substitui no texto final, inclusive em outras páginas", () => {
    const pages = [
      page(["Paciente: Ana Lima Costa"]),
      page(["A paciente Ana Lima Costa refere dor."]),
    ];
    const regions = detectRegions(pages);
    expect(redactedText(pages, regions)).toBe(
      "Paciente: [PACIENTE]\n\nA paciente [PACIENTE] refere dor.",
    );
  });

  it("respeita áreas desativadas na revisão", () => {
    const pages = [page(["Paciente: Ana Lima Costa"])];
    const regions = detectRegions(pages).map((r) => ({ ...r, enabled: false }));
    expect(redactedText(pages, regions)).toBe("Paciente: Ana Lima Costa");
  });
});
