// Regras da fila e da repetição de posts. Usado pelo publish.mjs (Node) e pelo painel (navegador).
// Não importe nada de Node aqui.
//
// Modelo: cada publicação é um item de posts.json. Repostar = criar uma CÓPIA (id novo) com
// "origem" apontando para o post original. Assim cada publicação tem sua própria data.
import { criarDoBanco } from "./banco.js";

export const raizDe = (p) => p.origem || p.id;

export function proximoId(posts, extras = []) {
  const nums = [...posts, ...extras]
    .map((p) => parseInt(String(p.id).replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  return "post" + (Math.max(8, ...nums) + 1);
}

// Cópia pronta para entrar na fila (aprovada, ainda não postada)
export function copiaParaRepost(src, novoId) {
  const c = JSON.parse(JSON.stringify(src));
  c.id = novoId;
  c.aprovado = true;
  c.postado = false;
  c.origem = raizDe(src);
  delete c.publicadoEm;
  delete c.instagramMediaId;
  delete c.imagemDe;
  delete c.agendarPara;
  return c;
}

// Já existe uma cópia desse post esperando na fila?
export function jaNaFila(posts, p) {
  const r = raizDe(p);
  return posts.some((x) => raizDe(x) === r && x.aprovado && !x.postado);
}

// Histórico de publicações de um post (original + repostagens), da mais recente para a mais antiga
export function publicacoesDe(posts, p) {
  const r = raizDe(p);
  return posts
    .filter((x) => raizDe(x) === r && x.postado)
    .sort((a, b) => String(b.publicadoEm || "").localeCompare(String(a.publicadoEm || "")));
}

// Quando a fila acaba e a repetição automática está ligada, escolhe o post publicado há mais tempo,
// desde que já tenha passado "diasMinimos" desde a última publicação dele.
// Retorna o post-fonte (a publicação mais recente do grupo) ou null.
export function escolherRepeticao(config, agora = new Date()) {
  const rep = config.repeticao || {};
  if (!rep.ativa) return null;
  const dias = Number(rep.diasMinimos) > 0 ? Number(rep.diasMinimos) : 90;
  const limite = agora.getTime() - dias * 86400000;

  const grupos = new Map();
  for (const p of config.posts) {
    const k = raizDe(p);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }

  let melhor = null;
  for (const membros of grupos.values()) {
    if (membros.some((m) => m.repetir === false)) continue;            // marcado para não repetir
    if (membros.some((m) => m.aprovado && !m.postado)) continue;        // já tem cópia na fila
    const postados = membros.filter((m) => m.postado);
    if (!postados.length) continue;
    const ultimo = postados.reduce((a, b) => ((b.publicadoEm || "") > (a.publicadoEm || "") ? b : a));
    const quando = ultimo.publicadoEm ? Date.parse(ultimo.publicadoEm) : 0;
    if (quando > limite) continue;                                      // postado há pouco tempo
    if (!melhor || quando < melhor.quando) melhor = { fonte: ultimo, quando };
  }
  return melhor ? melhor.fonte : null;
}

// ---------- horários e decisão de "o que publicar agora" ----------
const TZ = "America/Sao_Paulo";
// Agenda regular (pode ser mudada no painel; fica em posts.json -> "agenda")
export const AGENDA_PADRAO = { dias: [2, 4, 6], hora: "12:00" }; // terça, quinta e sábado às 12h (Brasília)
export const JANELA_HORAS = 8; // depois do horário, o robô ainda tenta por até 8h (ou até 23h59)
export const NOMES_DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function agendaDe(config) {
  const a = (config && config.agenda) || {};
  let dias = Array.isArray(a.dias) ? [...new Set(a.dias.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : [];
  if (!dias.length) dias = AGENDA_PADRAO.dias;
  const [h, m] = String(a.hora || AGENDA_PADRAO.hora).split(":").map(Number);
  return { dias, hora: Number.isFinite(h) ? h : 12, minuto: Number.isFinite(m) ? m : 0 };
}
export function descreverAgenda(config) {
  const ag = agendaDe(config);
  const nomes = ag.dias.length === 7 ? "todos os dias" : ag.dias.map((d) => NOMES_DIAS[d]).join(", ").replace(/, ([^,]*)$/, " e $1");
  return `${nomes} às ${String(ag.hora).padStart(2, "0")}:${String(ag.minuto).padStart(2, "0")}`;
}

// Rascunhos automáticos: a cada N dias, o robô transforma as próximas ideias do banco em rascunhos
export function rascunhosAutoDe(config) {
  const r = (config && config.rascunhosAuto) || {};
  return {
    ativa: !!r.ativa,
    aCadaDias: Math.max(1, Math.min(60, Number(r.aCadaDias) || 7)),
    quantidade: Math.max(1, Math.min(10, Number(r.quantidade) || 1)),
    aprovar: !!r.aprovar,
    ultimaVez: r.ultimaVez || null,
  };
}
// Quando o robô cria os próximos (Date). Data no passado = na próxima rodada. null = desligado.
export function proximaCriacao(config) {
  const r = rascunhosAutoDe(config);
  if (!r.ativa) return null;
  return r.ultimaVez ? new Date(Date.parse(r.ultimaVez) + r.aCadaDias * 86400000) : new Date(0);
}
// banco: o ideias.json inteiro (ideias, frases, datas e modelos de legenda). Ver banco.js.
export function criarRascunhosAuto(config, banco, agora = new Date()) {
  const r = rascunhosAutoDe(config);
  if (!r.ativa) return { criados: [], motivo: "desligado" };
  const quando = proximaCriacao(config);
  if (quando > agora) return { criados: [], motivo: "ainda não está na hora" };
  if (Array.isArray(banco)) banco = { posts: banco };
  const ag = agendaDe(config);
  const criados = criarDoBanco(config, banco, r.quantidade, {
    agora, proximoId, hora: `${String(ag.hora).padStart(2, "0")}:${String(ag.minuto).padStart(2, "0")}`,
  }).map((c) => ({ ...c, aprovado: r.aprovar && !c.geradoPorIA })); // posts escritos pela IA nunca vão direto para a fila sem revisão
  config.posts.push(...criados);
  config.rascunhosAuto = { ...(config.rascunhosAuto || {}), ultimaVez: agora.toISOString() };
  return { criados, motivo: criados.length ? "" : "banco de conteúdo vazio" };
}

export function partesBRT(d) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  });
  const o = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return {
    dia: `${o.year}-${o.month}-${o.day}`,
    hora: Number(o.hour),
    minuto: Number(o.minute),
    sem: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday],
  };
}

// O horário regular está aberto (dia da agenda, depois do horário) e ainda não saiu nenhum post hoje?
export function slotAberto(config, agora = new Date()) {
  const ag = agendaDe(config), b = partesBRT(agora);
  const agoraMin = b.hora * 60 + b.minuto, ini = ag.hora * 60 + ag.minuto;
  const fim = Math.min(ini + JANELA_HORAS * 60, 24 * 60);
  if (!ag.dias.includes(b.sem) || agoraMin < ini || agoraMin >= fim) return false;
  return !config.posts.some((p) => p.postado && p.publicadoEm && partesBRT(new Date(p.publicadoEm)).dia === b.dia);
}

// Decide o que publicar nesta rodada.
//  modo "manual": botão "publicar agora" (ou workflow disparado à mão): publica já.
//  modo "agenda": rodada automática (a cada 30 min): só publica agendado vencido ou, no horário regular, o próximo da fila.
//  postId: publica exatamente esse post (botão "publicar agora" de um card).
// Retorna { post } | { repeticao: fonte } | { motivo }
export function proximaPublicacao(config, { agora = new Date(), modo = "manual", postId = "" } = {}) {
  const posts = config.posts;
  if (postId) {
    const p = posts.find((x) => x.id === postId);
    if (!p) return { motivo: `O post "${postId}" não existe no posts.json.` };
    if (p.postado) return { motivo: `O post "${postId}" já foi publicado.` };
    return { post: p };
  }
  if (modo === "agenda") {
    const vencidos = posts
      .filter((p) => p.aprovado && !p.postado && p.agendarPara && Date.parse(p.agendarPara) <= agora.getTime())
      .sort((a, b) => Date.parse(a.agendarPara) - Date.parse(b.agendarPara));
    if (vencidos.length) return { post: vencidos[0] };
    if (!slotAberto(config, agora)) return { motivo: "Sem post agendado vencido e fora do horário regular (ou já saiu um post hoje)." };
  }
  const fila = posts.find((p) => p.aprovado && !p.postado && !p.agendarPara);
  if (fila) return { post: fila };
  const fonte = escolherRepeticao(config, agora);
  if (fonte) return { repeticao: fonte };
  return {
    motivo: "Fila vazia: nenhum post aprovado e pendente" +
      (config.repeticao && config.repeticao.ativa ? ", e nenhum post elegível para repetir ainda." : " (repetição automática desligada)."),
  };
}

// Banco de ideias automático: quando sobram poucas ideias, o robô pede novas para a IA
export const MODELO_PADRAO = { anthropic: "claude-sonnet-5-5", gemini: "gemini-2.5-flash", compat: "llama-3.3-70b-versatile" };
export const SECRET_DA_IA = { anthropic: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY", compat: "IA_API_KEY" };
export function ideiasAutoDe(config) {
  const r = (config && config.ideiasAuto) || {};
  const provedor = ["anthropic", "gemini", "compat"].includes(r.provedor) ? r.provedor : "gemini";
  return {
    ativa: !!r.ativa,
    minimo: Math.max(0, Math.min(30, Number.isFinite(Number(r.minimo)) && r.minimo !== "" && r.minimo != null ? Number(r.minimo) : 5)),
    quantidade: Math.max(1, Math.min(10, Number(r.quantidade) || 5)),
    provedor,
    modelo: r.modelo || MODELO_PADRAO[provedor],
    compatUrl: r.compatUrl || "https://api.groq.com/openai/v1",
    ultimaTentativa: r.ultimaTentativa || null,
    ultimoResultado: r.ultimoResultado || "",
  };
}
export const ideiasDisponiveis = (config, ideias) => {
  const usados = new Set(config.posts.map((p) => p.id));
  return (ideias || []).filter((i) => !usados.has(i.id));
};
