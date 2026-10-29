// Gera as imagens 1080x1350 (JPEG) a partir do posts.json.
// Uso: node render.mjs            -> renderiza todos os posts
//      node render.mjs post9      -> renderiza só o post com esse id
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { postHtml } from "./template.js";

const require = createRequire(import.meta.url);
const config = JSON.parse(readFileSync("posts.json", "utf8"));
const { marca, posts } = config;

// Fonte Inter embutida (não depende de internet)
const fonte = (peso) => {
  const p = require.resolve(`@fontsource/inter/files/inter-latin-${peso}-normal.woff2`);
  return `@font-face{font-family:'Inter';font-weight:${peso};src:url(data:font/woff2;base64,${readFileSync(p).toString("base64")}) format('woff2');}`;
};
const FONTES = [500, 600, 700, 800, 900].map(fonte).join("");

const alvo = process.argv[2];
const lista = alvo ? posts.filter((p) => p.id === alvo) : posts;
if (!lista.length) {
  console.error("Nenhum post encontrado", alvo || "");
  process.exit(1);
}

mkdirSync("out", { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const p of lista) {
  await page.setContent(postHtml(p, marca, FONTES), { waitUntil: "load" });
  const zoom = await page.evaluate(() => window.__fitDone);
  if (zoom < 1) console.log("  ajuste de tamanho:", zoom);
  const buf = await page.screenshot({ type: "jpeg", quality: 92 });
  writeFileSync(`out/${p.id}.jpg`, buf);
  console.log("ok", `out/${p.id}.jpg`);
}
await browser.close();
