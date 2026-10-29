// Regras da fila e da repetição de posts. Usado pelo publish.mjs (Node) e pelo painel (navegador).
// Não importe nada de Node aqui.
//
// Modelo: cada publicação é um item de posts.json. Repostar = criar uma CÓPIA (id novo) com
// "origem" apontando para o post original. Assim cada publicação tem sua própria data.

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
export const DIAS_SLOT = [2, 4, 6]; // terça, quinta, sábado
export const HORA_SLOT = 12;        // a partir de 12h (Brasília)
export const HORA_FIM_SLOT = 20;    // o horário regular fecha às 20h

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

// O horário regular (ter/qui/sáb, a partir das 12h) está aberto e ainda não saiu nenhum post hoje?
export function slotAberto(posts, agora = new Date()) {
  const b = partesBRT(agora);
  if (!DIAS_SLOT.includes(b.sem) || b.hora < HORA_SLOT || b.hora >= HORA_FIM_SLOT) return false;
  return !posts.some((p) => p.postado && p.publicadoEm && partesBRT(new Date(p.publicadoEm)).dia === b.dia);
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
    if (!slotAberto(posts, agora)) return { motivo: "Sem post agendado vencido e fora do horário regular (ou já saiu um post hoje)." };
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
