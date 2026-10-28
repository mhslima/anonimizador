// Builds the offline version and inlines its script and stylesheet into a single HTML file that
// opens straight from disk: baixar/Prontuario-Sem-Identificacao.html
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist-offline");
const outDir = path.join(root, "baixar");
const outFile = path.join(outDir, "Prontuario-Sem-Identificacao.html");

execSync("vite build --config vite.offline.config.ts", { cwd: root, stdio: "inherit" });

let html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const read = (ref) => fs.readFileSync(path.join(dist, ref), "utf8");

html = html.replace(
  /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_, href) => `<style>${read(href)}</style>`,
);
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  // keep the HTML parser from closing the tag early on "</script" inside the bundle
  const js = read(src).replace(/<\/script/gi, "<\\/script");
  return `<script type="module">${js}</script>`;
});

const leftovers = [...html.matchAll(/(?:src|href)="\.\/assets\/[^"]+"/g)].map((m) => m[0]);
if (leftovers.length) throw new Error(`Referências externas restantes: ${leftovers.join(", ")}`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
fs.rmSync(dist, { recursive: true, force: true });
console.log(
  `Gerado ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(1)} MB)`,
);
