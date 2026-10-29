// Banco de ideias automático: quando sobram poucas ideias no ideias.json, pede posts novos para a IA.
// As chaves vêm dos Secrets do GitHub (ANTHROPIC_API_KEY, GEMINI_API_KEY ou IA_API_KEY).
// FORCAR=1 gera agora, sem olhar o mínimo nem o intervalo.
import { readFileSync, writeFileSync } from "node:fs";
import { ideiasAutoDe, ideiasDisponiveis, proximoId, SECRET_DA_IA } from "./fila.js";
import { pedirJson, normalizarPost, postCompleto, pedidoDeIdeias } from "./ia.js";

const FORCAR = !!process.env.FORCAR;
const config = JSON.parse(readFileSync("posts.json", "utf8"));
let arq = { posts: [] };
try { arq = JSON.parse(readFileSync("ideias.json", "utf8")); if (!arq.posts) arq.posts = []; } catch (e) {}

const ia = ideiasAutoDe(config);
const disp = ideiasDisponiveis(config, arq.posts).length;
const sair = (m) => { console.log("Banco de ideias automático:", m); process.exit(0); };
if (!ia.ativa && !FORCAR) sair("desligado.");
if (!FORCAR && disp >= ia.minimo) sair(`o banco ainda tem ${disp} ideia(s) (mínimo ${ia.minimo}).`);
if (!FORCAR && ia.ultimaTentativa && Date.now() - Date.parse(ia.ultimaTentativa) < 20 * 3600000) sair("já tentei nas últimas 20 horas.");

const chave = process.env[SECRET_DA_IA[ia.provedor]] || "";
const registrar = (resultado) => {
  config.ideiasAuto = { ...(config.ideiasAuto || {}), ultimaTentativa: new Date().toISOString(), ultimoResultado: resultado };
  writeFileSync("posts.json", JSON.stringify(config, null, 2) + "\n");
  console.log("Banco de ideias automático:", resultado);
};
if (!chave) { registrar(`falta o secret ${SECRET_DA_IA[ia.provedor]} no GitHub.`); process.exit(0); }

const cfg = {
  provider: ia.provedor,
  apiKey: chave, model: ia.modelo,
  geminiKey: chave, geminiModel: ia.modelo,
  compatKey: chave, compatModel: ia.modelo, compatUrl: ia.compatUrl,
};
const existentes = () => [...config.posts, ...arq.posts].map((p) => (p.titulo || []).join(" ")).filter(Boolean).slice(-80);
let criados = 0, erro = "";
try {
  for (let falta = ia.quantidade; falta > 0; ) {
    const lote = Math.min(5, falta);
    const bruto = await pedirJson(cfg, pedidoDeIdeias(lote, existentes()), Math.min(16000, 2500 * lote + 1500));
    let n = 0;
    for (const o of (Array.isArray(bruto) ? bruto : [bruto]).slice(0, lote)) {
      const { post, avisos } = normalizarPost(o);
      if (!postCompleto(post)) continue;
      arq.posts.push({ id: proximoId(config.posts, arq.posts), ...post, ...(avisos.length ? { avisos } : {}), geradoPorIA: true, criadoEm: new Date().toISOString() });
      n++;
    }
    if (!n) throw new Error("a IA não devolveu nenhum post completo");
    criados += n; falta -= lote;
  }
} catch (e) { erro = e.message || String(e); }

if (criados) writeFileSync("ideias.json", JSON.stringify(arq, null, 2) + "\n");
registrar(criados ? `criei ${criados} ideia(s) nova(s)${erro ? " (parei antes do fim: " + erro + ")" : ""}.` : "erro: " + erro);
