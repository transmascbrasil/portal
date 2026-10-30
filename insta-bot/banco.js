// Banco de conteúdo (ideias.json): de onde saem os rascunhos, sem IA e sem chave.
// Usado pelo painel (navegador) e pelo robô (rascunhos.mjs). Não importe nada de Node aqui.
//
// ideias.json:
//   "posts":   ideias = posts prontos (cada uma vira rascunho uma vez, com o mesmo id)
//   "frases":  frases soltas que viram post "Frase em destaque"
//   "datas":   datas comemorativas; viram rascunho alguns dias antes, já com a data marcada
//   "legenda": modelos para escrever a legenda das frases e datas (ideias já têm legenda própria)
//   "regras":  { "frasesACada": 5, "diasAntecedencia": 21 }

export const REGRAS_PADRAO = { frasesACada: 5, diasAntecedencia: 21 };
const TEMAS_RODIZIO = ["escuro", "claro", "rosa", "azul"];
const TZ = "-03:00"; // Brasília

export function regrasDe(banco) {
  const r = (banco && banco.regras) || {};
  const num = (v, pad, min, max) => (v === "" || v == null || isNaN(Number(v)) ? pad : Math.max(min, Math.min(max, Number(v))));
  return {
    frasesACada: num(r.frasesACada, REGRAS_PADRAO.frasesACada, 0, 20),
    diasAntecedencia: num(r.diasAntecedencia, REGRAS_PADRAO.diasAntecedencia, 0, 90),
  };
}

// troca {marca}, {arroba} e {titulo}/{resumo}/{cta}/{hashtags} nos textos
export function preencher(valor, vars) {
  if (typeof valor === "string") return valor.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  if (Array.isArray(valor)) return valor.map((v) => preencher(v, vars));
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, preencher(v, vars)]));
  return valor;
}

// sorteio previsível: o mesmo post sempre ganha a mesma legenda
function sorteador(semente) {
  let h = 2166136261;
  for (const c of String(semente)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return (h >>> 0) / 4294967296;
  };
  const sortear = (lista) => lista[Math.floor(rnd() * lista.length)];
  sortear.embaralhar = (lista) => {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  return sortear;
}

export const LEGENDA_PADRAO = {
  modelos: ["{titulo}\n\n{resumo}\n\n{cta}\n\n🔗 Link na bio\n\n{hashtags}"],
  ctas: ["Compartilha com quem precisa ver 💙"],
  hashtags: { fixas: [], rotativas: [], quantidade: 3 },
};

export function montarLegenda(post, banco, marca = {}, semente = "") {
  const L = { ...LEGENDA_PADRAO, ...((banco && banco.legenda) || {}) };
  const sortear = sorteador(semente || JSON.stringify(post.titulo));
  const vars = { marca: marca.nome || "", arroba: marca.rodape || "" };
  const titulo = (post.titulo || []).join(" ");
  const resumo = post.subtitulo || (post.itens || []).map((it) => `${it.emoji || "•"} ${it.titulo}`).join("\n");
  const H = { ...LEGENDA_PADRAO.hashtags, ...(L.hashtags || {}) };
  const rot = sortear.embaralhar(H.rotativas || []).slice(0, Number(H.quantidade) || 0);
  const hashtags = [...(H.fixas || []), ...rot].filter(Boolean).map((t) => (t.startsWith("#") ? t : "#" + t)).join(" ");
  const cta = (L.ctas || []).length ? preencher(sortear(L.ctas), vars) : "";
  const modelos = (L.modelos || []).filter((m) => m && m.trim());
  const texto = preencher(modelos.length ? sortear(modelos) : LEGENDA_PADRAO.modelos[0], { ...vars, titulo, resumo, cta, hashtags });
  return texto.replace(/\n{3,}/g, "\n\n").trim();
}

const d2 = (n) => String(n).padStart(2, "0");
// dia de hoje em Brasília (AAAA-MM-DD)
function hojeBRT(agora) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(agora);
}

// datas comemorativas que caem nos próximos N dias. "data": "MM-DD" (todo ano) ou "AAAA-MM-DD" (uma vez só)
export function datasProximas(banco, agora = new Date(), dias = regrasDe(banco).diasAntecedencia) {
  const hoje = hojeBRT(agora);
  const ano = Number(hoje.slice(0, 4));
  const fim = new Date(Date.parse(hoje + "T00:00:00Z") + dias * 86400000).toISOString().slice(0, 10);
  const r = [];
  ((banco && banco.datas) || []).forEach((d, i) => {
    const s = String(d.data || "").trim();
    const cands = /^\d{4}-\d{2}-\d{2}$/.test(s) ? [s] : /^\d{2}-\d{2}$/.test(s) ? [`${ano}-${s}`, `${ano + 1}-${s}`] : [];
    for (const c of cands) if (c >= hoje && c <= fim) r.push({ ...d, quando: c, fonte: `data:${d.id || i}:${c.slice(0, 4)}` });
  });
  return r.sort((a, b) => a.quando.localeCompare(b.quando));
}

export const fonteDaFrase = (f, i) => `frase:${(f && f.id) || i}`;
const usadas = (config) => new Set((config.posts || []).map((p) => p.fonte).filter(Boolean));

// O que ainda pode virar rascunho
export function disponiveisNoBanco(config, banco, agora = new Date()) {
  const u = usadas(config);
  const ids = new Set((config.posts || []).map((p) => p.id));
  return {
    ideias: ((banco && banco.posts) || []).filter((i) => !ids.has(i.id)),
    frases: ((banco && banco.frases) || []).map((f, i) => ({ ...(typeof f === "string" ? { texto: f } : f), fonte: fonteDaFrase(f, i) })).filter((f) => f.texto && !u.has(f.fonte)),
    datas: datasProximas(banco, agora).filter((d) => !u.has(d.fonte)),
  };
}
export function totalDisponivel(config, banco, agora = new Date()) {
  const d = disponiveisNoBanco(config, banco, agora);
  return d.ideias.length + d.frases.length + d.datas.length;
}

// Monta os próximos rascunhos. Ordem: datas comemorativas que estão chegando, depois ideias,
// com uma frase a cada N rascunhos (e as frases que sobrarem quando as ideias acabarem).
// Não altera config: devolve os posts novos ({ ...post, aprovado:false, postado:false }).
export function criarDoBanco(config, banco, quantidade, { agora = new Date(), hora = "12:00", proximoId } = {}) {
  const disp = disponiveisNoBanco(config, banco, agora);
  const regras = regrasDe(banco);
  const marca = config.marca || {};
  const novos = [];
  const ids = [...(config.posts || []), ...((banco && banco.posts) || [])];
  const novoId = () => {
    const id = proximoId ? proximoId([...ids, ...novos]) : "post" + Date.now();
    return id;
  };
  let temaIdx = (config.posts || []).length;
  const tema = () => TEMAS_RODIZIO[temaIdx++ % TEMAS_RODIZIO.length];
  const qtd = Math.max(0, Number(quantidade) || 0);

  for (let n = 0; n < qtd; n++) {
    const contagem = (config.posts || []).length + novos.length + 1;
    const vezDaFrase = regras.frasesACada > 0 && contagem % regras.frasesACada === 0;
    let post = null;
    if (disp.datas.length) {
      const d = disp.datas.shift();
      const { id: _i, data: _d, quando, fonte, legenda, ...campos } = d;
      post = { ...preencher(campos, { marca: marca.nome || "", arroba: marca.rodape || "" }), id: novoId(), fonte, agendarPara: new Date(`${quando}T${hora}:00${TZ}`).toISOString() };
      if (!post.tema) post.tema = tema();
      post.legenda = legenda || montarLegenda(post, banco, marca, fonte);
    } else if (disp.frases.length && (vezDaFrase || !disp.ideias.length)) {
      const f = disp.frases.shift();
      post = {
        id: novoId(), fonte: f.fonte, tipo: "citacao", tema: f.tema || tema(),
        ...(f.kicker ? { kicker: f.kicker } : {}), titulo: [f.texto], ...(f.autor ? { subtitulo: "— " + f.autor } : {}),
      };
      post.legenda = f.legenda || montarLegenda(post, banco, marca, f.fonte);
    } else if (disp.ideias.length) {
      const i = disp.ideias.shift();
      post = JSON.parse(JSON.stringify(i));
      delete post.avisos;
      if (!post.legenda) post.legenda = montarLegenda(post, banco, marca, post.id);
    } else break;
    novos.push({ ...post, aprovado: false, postado: false, criadoEm: agora.toISOString() });
  }
  return novos;
}
