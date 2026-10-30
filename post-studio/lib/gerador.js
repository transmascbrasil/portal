// Gerador de rascunhos SEM IA e sem chamada de API.
// Monta posts a partir do banco de conteúdo da empresa (banco.json):
//   - datas:   datas comemorativas (têm prioridade quando estão chegando)
//   - pautas:  posts prontos (qualquer tipo de template)
//   - frases:  viram posts do tipo "citacao"
// e escreve a legenda a partir dos modelos de legenda, CTAs e hashtags do banco.
// Funções puras: quem lê/grava arquivos é o scripts/gerar-rascunhos.mjs.

import { TIPOS, TEMAS } from "./template.js";

export const GERACAO_PADRAO = {
  quantidadePadrao: 3,
  diasAntecedencia: 14, // datas comemorativas entram como rascunho com esta antecedência
  frasesACada: 4,       // 1 a cada N posts é uma frase (0 = nunca)
  reciclar: false,      // quando o banco acabar, reaproveita as pautas usadas há mais tempo
  temas: Object.keys(TEMAS),
  hora: "12:00",
};
export const geracaoDe = (empresa) => ({ ...GERACAO_PADRAO, ...((empresa && empresa.geracao) || {}) });

// troca {marca}, {arroba}, {site} e outras variáveis da empresa em todos os textos
export function preencher(valor, vars) {
  if (typeof valor === "string") return valor.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  if (Array.isArray(valor)) return valor.map((v) => preencher(v, vars));
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, preencher(v, vars)]));
  return valor;
}
export function variaveisDe(empresa) {
  const m = (empresa && empresa.marca) || {};
  return { marca: m.nome || "", arroba: m.rodape || "", site: m.site || "", ...((empresa && empresa.variaveis) || {}) };
}

// sorteio previsível (mesma entrada, mesmo resultado)
function sorteador(semente) {
  let h = 2166136261;
  for (const c of String(semente)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return (h >>> 0) / 4294967296;
  };
  const sortear = (lista) => lista[Math.floor(rnd() * lista.length)];
  sortear.rnd = rnd;
  return sortear;
}
function embaralhar(lista, sortear) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(sortear.rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function montarLegenda(post, banco, vars, semente) {
  const L = (banco && banco.legenda) || {};
  const sortear = sorteador(semente);
  const modelos = L.modelos && L.modelos.length ? L.modelos : ["{gancho}\n\n{resumo}\n\n{cta}\n\n{hashtags}"];
  const titulo = (post.titulo || []).join(" ");
  const resumo = post.subtitulo
    ? post.subtitulo
    : (post.itens || []).length
      ? post.itens.map((it) => `${it.emoji || "•"} ${it.titulo}`).join("\n")
      : "";
  const H = L.hashtags || {};
  const rot = embaralhar(H.rotativas || [], sortear).slice(0, Number(H.quantidade) || 5);
  const tags = [...(H.fixas || []), ...rot].map((t) => (t.startsWith("#") ? t : "#" + t)).join(" ");
  const cta = preencher((L.ctas && L.ctas.length) ? sortear(L.ctas) : "", vars);
  const gancho = preencher(L.ganchos && L.ganchos.length ? sortear(L.ganchos) : "{titulo}", { ...vars, titulo });
  const texto = preencher(sortear(modelos), { ...vars, gancho, titulo, resumo, cta, hashtags: tags });
  return texto.replace(/\n{3,}/g, "\n\n").trim();
}

const doisDig = (n) => String(n).padStart(2, "0");
const diaISO = (d) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;

// datas comemorativas que caem nos próximos N dias. data: "MM-DD" (todo ano) ou "AAAA-MM-DD" (uma vez)
export function datasProximas(banco, hoje, dias) {
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fim = new Date(ini.getTime() + dias * 86400000);
  const r = [];
  for (const d of (banco && banco.datas) || []) {
    const s = String(d.data || "");
    const cands = /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? [s]
      : /^\d{2}-\d{2}$/.test(s) ? [`${ini.getFullYear()}-${s}`, `${ini.getFullYear() + 1}-${s}`] : [];
    for (const c of cands) {
      const dt = new Date(c + "T00:00:00");
      if (dt >= ini && dt <= fim) r.push({ ...d, quando: c, chave: `data:${d.id || s}:${c.slice(0, 4)}` });
    }
  }
  return r.sort((a, b) => a.quando.localeCompare(b.quando));
}

export function proximoId(posts) {
  const nums = posts.map((p) => parseInt(String(p.id).replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  return Math.max(0, ...nums) + 1;
}

// Retorna { novos, avisos }. Não altera nada: quem chama decide gravar.
export function gerarRascunhos({ empresa, banco, posts = [], quantidade, hoje = new Date() }) {
  const g = geracaoDe(empresa);
  const vars = variaveisDe(empresa);
  const qtd = Math.max(1, Math.min(30, Number(quantidade) || g.quantidadePadrao));
  const usadas = new Set(posts.map((p) => p.fonte).filter(Boolean));
  const avisos = [];
  const novos = [];

  const datas = datasProximas(banco, hoje, g.diasAntecedencia).filter((d) => !usadas.has(d.chave));
  const pautas = ((banco && banco.pautas) || []).map((p, i) => ({ ...p, chave: `pauta:${p.id || i}` }));
  let livres = pautas.filter((p) => !usadas.has(p.chave));
  const frases = ((banco && banco.frases) || [])
    .map((f) => (typeof f === "string" ? { texto: f } : f))
    .map((f, i) => ({ ...f, chave: `frase:${f.id || i}` }))
    .filter((f) => !usadas.has(f.chave));

  if (!livres.length && g.reciclar && pautas.length) {
    // reaproveita as pautas usadas há mais tempo
    const ultimoUso = new Map();
    for (const p of posts) if (p.fonte) ultimoUso.set(p.fonte, p.criadoEm || "");
    livres = [...pautas].sort((a, b) => String(ultimoUso.get(a.chave) || "").localeCompare(String(ultimoUso.get(b.chave) || "")));
    avisos.push("O banco de pautas acabou: reaproveitei as pautas usadas há mais tempo.");
  }

  let num = proximoId(posts);
  let ultimoTipo = posts.length ? posts[posts.length - 1].tipo : "";
  const temas = (g.temas || []).filter((t) => TEMAS[t]);
  let temaIdx = posts.length;
  const usadasAgora = new Set();

  for (let n = 0; n < qtd; n++) {
    let base = null, extra = {};
    const data = datas.find((d) => !usadasAgora.has(d.chave));
    const frase = frases.find((f) => !usadasAgora.has(f.chave));
    const disp = livres.filter((p) => !usadasAgora.has(p.chave));
    const vezDaFrase = g.frasesACada > 0 && (posts.length + novos.length + 1) % g.frasesACada === 0;
    if (data) {
      base = data;
      extra = { agendarPara: `${data.quando}T${g.hora}:00`, motivo: `Data comemorativa (${data.quando.split("-").reverse().join("/")})` };
    } else if (frase && (vezDaFrase || !disp.length)) {
      base = { chave: frase.chave, tipo: "citacao", kicker: frase.kicker || "", titulo: [frase.texto], subtitulo: frase.autor ? `— ${frase.autor}` : "" };
      extra = { motivo: "Frase do banco" };
    } else if (disp.length) {
      // próxima pauta livre, evitando repetir o mesmo tipo de template em sequência
      base = disp.find((p) => p.tipo !== ultimoTipo) || disp[0];
      extra = { motivo: "Pauta do banco" };
    }
    if (!base) {
      avisos.push(novos.length ? `Só deu para criar ${novos.length}: o banco de conteúdo acabou.` : "O banco de conteúdo acabou. Adicione pautas, frases ou datas no banco (ou ligue \"reciclar\").");
      break;
    }
    usadasAgora.add(base.chave);

    const { chave, id: _id, data: _d, quando: _q, legenda, aprovado, postado, status, tema, avisos: _a, geradoPorIA, ...campos } = base;
    const post = preencher(campos, vars);
    post.tipo = TIPOS[post.tipo] ? post.tipo : "passos";
    post.id = "p" + num++;
    post.status = "rascunho";
    post.fonte = chave;
    post.tema = TEMAS[tema] ? tema : temas.length ? temas[temaIdx++ % temas.length] : "escuro";
    post.criadoEm = new Date(hoje.getTime() + n).toISOString();
    post.legenda = legenda ? preencher(legenda, vars) : montarLegenda(post, banco, vars, post.id + chave);
    Object.assign(post, extra);
    ultimoTipo = post.tipo;
    novos.push(post);
  }
  return { novos, avisos };
}

// resumo do banco para o painel
export function resumoBanco({ empresa, banco, posts = [], hoje = new Date() }) {
  const usadas = new Set(posts.map((p) => p.fonte).filter(Boolean));
  const g = geracaoDe(empresa);
  const pautas = (banco.pautas || []).map((p, i) => `pauta:${p.id || i}`);
  const frases = (banco.frases || []).map((f, i) => `frase:${(f && f.id) || i}`);
  return {
    pautas: { total: pautas.length, livres: pautas.filter((k) => !usadas.has(k)).length },
    frases: { total: frases.length, livres: frases.filter((k) => !usadas.has(k)).length },
    datas: { total: (banco.datas || []).length, proximas: datasProximas(banco, hoje, g.diasAntecedencia).filter((d) => !usadas.has(d.chave)).map((d) => ({ quando: d.quando, titulo: (d.titulo || []).join(" ") })) },
  };
}
