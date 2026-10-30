// Alterações nos posts. Usado pelo servidor (Node) e pelo painel no GitHub Pages (navegador).
// Não importe nada de Node aqui.

export const STATUS = ["rascunho", "aprovado", "publicado", "rejeitado"];

const indice = (posts, id) => {
  const i = posts.findIndex((x) => x.id === id);
  if (i < 0) throw Object.assign(new Error(`Post "${id}" não encontrado.`), { status: 404 });
  return i;
};

export function atualizarPost(posts, id, novo) {
  const i = indice(posts, id), p = posts[i];
  posts[i] = { ...novo, id: p.id, fonte: p.fonte, criadoEm: p.criadoEm, status: STATUS.includes(novo.status) ? novo.status : p.status };
  return posts;
}

export function mudarStatus(posts, id, status) {
  if (!STATUS.includes(status)) throw Object.assign(new Error("Status inválido."), { status: 400 });
  const p = posts[indice(posts, id)];
  p.status = status;
  if (status === "publicado") p.publicadoEm = new Date().toISOString();
  else delete p.publicadoEm;
  return posts;
}

export function excluirPost(posts, id) {
  posts.splice(indice(posts, id), 1);
  return posts;
}

// mesmo texto que o scripts/gerar-rascunhos.mjs imprime no terminal
export function descreverGeracao(novos, avisos, teste = false) {
  return [
    ...novos.map((p) => `+ ${p.id}  [${p.tipo}/${p.tema}]  ${(p.titulo || []).join(" ")}  (${p.motivo})`),
    ...avisos.map((a) => "! " + a),
    novos.length ? `${novos.length} rascunho(s) ${teste ? "seriam criados (teste)" : "criado(s)"}.` : "Nenhum rascunho criado.",
  ].join("\n");
}

// ---------- ponte com o insta-bot (publicação automática pelo GitHub Actions) ----------
const TEMA_INSTA_BOT = { escuro: "escuro", claro: "claro", primaria: "azul", secundaria: "rosa" };
const CAMPOS_POST = ["tipo", "kicker", "titulo", "tamanhoTitulo", "subtitulo", "itens", "destaque", "legenda"];

// Converte um post daqui no formato do insta-bot/posts.json (aprovado = entra na fila).
// Se o post veio de uma ideia do insta-bot (pauta "postNN"), reaproveita o id para o bot saber que a ideia já foi usada.
export function paraInstaBot(post, postsBot, ideiasBot = []) {
  const usados = new Set(postsBot.map((p) => p.id));
  const m = /^pauta:(post\d+)$/.exec(post.fonte || "");
  let id = m && !usados.has(m[1]) ? m[1] : "";
  if (!id) {
    const nums = [...postsBot, ...ideiasBot].map((p) => parseInt(String(p.id).replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    id = "post" + (Math.max(8, ...nums) + 1);
  }
  const novo = { id, aprovado: true, postado: false };
  for (const k of CAMPOS_POST) if (post[k] != null && post[k] !== "") novo[k] = post[k];
  novo.tema = TEMA_INSTA_BOT[post.tema] || "escuro";
  if (post.agendarPara) {
    const d = new Date(post.agendarPara);
    if (!isNaN(d) && d > new Date()) novo.agendarPara = d.toISOString();
  }
  return novo;
}
