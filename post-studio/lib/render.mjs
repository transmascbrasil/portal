// Transforma o HTML do template em JPG 1080x1350 usando o Chromium do Playwright.
// Playwright é opcional: sem ele o painel continua funcionando (só não baixa o JPG pelo servidor).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { postHtml } from "./template.js";

const require = createRequire(import.meta.url);
let navegador = null;

// Fontes: Inter embutida (se @fontsource/inter estiver instalado) + a fonte da marca pelo Google Fonts
function fontCss(marca) {
  let css = "";
  if (marca.fonte && marca.fonte !== "Inter") {
    css += `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(marca.fonte)}:wght@500;600;700;800;900&display=swap');`;
  }
  try {
    css += [500, 600, 700, 800, 900].map((peso) => {
      const arq = require.resolve(`@fontsource/inter/files/inter-latin-${peso}-normal.woff2`);
      return `@font-face{font-family:'Inter';font-weight:${peso};src:url(data:font/woff2;base64,${readFileSync(arq).toString("base64")}) format('woff2');}`;
    }).join("");
  } catch (e) {
    css = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap');` + css;
  }
  return css;
}

async function abrir() {
  if (navegador && navegador.isConnected()) return navegador;
  let pw;
  try { pw = await import("playwright"); } catch (e) {
    try { pw = require("playwright"); } catch (e2) {
      throw Object.assign(new Error("Para baixar o JPG, instale o gerador de imagens no servidor: npm install && npx playwright install chromium"), { status: 501 });
    }
  }
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  navegador = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  return navegador;
}

export async function renderJpg(post, marca) {
  const b = await abrir();
  const page = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  try {
    await page.setContent(postHtml(post, marca, fontCss(marca)), { waitUntil: "load", timeout: 20000 });
    await page.evaluate(() => window.__fitDone);
    return await page.screenshot({ type: "jpeg", quality: 92 });
  } finally {
    await page.close();
  }
}

export async function fechar() {
  if (navegador) await navegador.close().catch(() => {});
  navegador = null;
}
