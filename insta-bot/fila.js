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
