// Entry of the offline single-file build: the OCR worker, engine and Portuguese data and the pdf.js
// worker are embedded in the page, so it works opened straight from disk (file://) with no internet.
import { createRoot } from "react-dom/client";
import tesseractWorker from "tesseract.js/dist/worker.min.js?raw";
import tesseractCore from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?raw";
import porData from "~tesseract/por.traineddata.gz?inline";

import "../styles.css";
import { App } from "@/components/anon/App";
import { configureEngines } from "@/lib/loaders";

const LANG_PATH = "embutido";

// A worker started from a file:// page cannot load other scripts or blobs, so everything it needs
// goes into one script: the OCR engine (defines the global TesseractCore the worker looks for), a
// fetch shim that serves the Portuguese data from memory, then the tesseract.js worker itself.
const fetchShim = `;(() => {
  const b64 = ${JSON.stringify(porData.slice(porData.indexOf(",") + 1))};
  const original = self.fetch;
  self.fetch = (url, ...rest) =>
    String(url).endsWith(${JSON.stringify(`${LANG_PATH}/por.traineddata.gz`)})
      ? Promise.resolve(new Response(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))))
      : original(url, ...rest);
})();
`;

configureEngines({
  tesseract: {
    workerPath: URL.createObjectURL(
      new Blob([tesseractCore, "\n", fetchShim, tesseractWorker], {
        type: "application/javascript",
      }),
    ),
    langPath: LANG_PATH,
  },
  pdfWorker: async () => {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  },
});

createRoot(document.getElementById("root")!).render(<App />);
