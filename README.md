# Prontuário Sem Identificação

Anonimizador de documentos médicos que roda 100% no navegador. Recebe um PDF (com texto ou
digitalizado), uma foto de exame ou o texto de um prontuário, encontra os dados que identificam
paciente e médico (nome, CPF, RG, cartão SUS, CRM, prontuário/convênio, endereço, CEP, telefone,
e-mail, instituição), deixa a pessoa revisar e gera um novo PDF com etiquetas como `[PACIENTE]`
no lugar — além do texto anonimizado para colar numa IA.

Desenvolvido por Marcio Lima · 2026 · Versão 1.0

- Nenhum arquivo sai do computador: OCR (tesseract.js, português) e leitura de PDF (pdf.js) são
  servidos de `public/` e executados no navegador.
- O PDF final é rasterizado com as áreas pintadas por cima, então o texto original não fica
  escondido por baixo das etiquetas.
- A detecção é por regras (`src/lib/detect.ts`) e pode falhar: o resultado deve sempre ser
  conferido com o documento original.

## Usar no computador, sem internet

Baixe o arquivo [`baixar/Prontuario-Sem-Identificacao.html`](baixar/Prontuario-Sem-Identificacao.html)
(botão "Download raw file" no GitHub) e abra com dois cliques no Chrome ou no Edge. É um único
arquivo (~10 MB) com tudo embutido — OCR, leitor de PDF e telas — e funciona sem internet.

Para gerar o arquivo de novo depois de mudar o código: `bun run build:offline`.

Código principal: `src/lib/detect.ts` (detecção), `src/lib/layout.ts` (texto ↔ áreas na página),
`src/lib/loaders.ts` (PDF, imagem, texto, OCR), `src/lib/exporter.ts` (PDF final),
`src/components/anon/` (telas). Testes: `bun run test`.

---

# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
