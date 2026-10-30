// Painel no GitHub Pages: lê e grava os JSON da empresa direto no repositório pela API do GitHub
// (igual ao painel do insta-bot). A geração dos rascunhos roda aqui no navegador, com a mesma
// regra do scripts/gerar-rascunhos.mjs (lib/gerador.js). Ler é público; gravar precisa de token.
import { gerarRascunhos, resumoBanco } from "../lib/gerador.js";
import { atualizarPost, mudarStatus, excluirPost, descreverGeracao, paraInstaBot } from "../lib/operacoes.js";

const CFG_KEY = "estudio:github";

// Descobre dono/repositório pelo endereço do GitHub Pages (dono.github.io/repo/.../painel/)
function padrao() {
  const host = location.hostname, partes = location.pathname.split("/").filter(Boolean);
  const iPainel = partes.lastIndexOf("painel");
  const ehPages = host.endsWith(".github.io");
  const repo = ehPages ? partes[0] || "" : "";
  const antes = iPainel >= 0 ? partes.slice(ehPages ? 1 : 0, iPainel) : [];
  return {
    owner: ehPages ? host.split(".")[0] : "",
    repo,
    branch: "main",
    pasta: [...antes, "empresas"].join("/"),
    token: "",
  };
}

export function lerConfig() {
  let salvo = {};
  try { salvo = JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); } catch (e) {}
  return { ...padrao(), ...salvo };
}
export function salvarConfig(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
}

const b64 = {
  de: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0))),
  para: (s) => { const bytes = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); },
};

export function criarBackendGithub(cfg) {
  const caminho = (...p) => [cfg.pasta, ...p].filter(Boolean).join("/");
  const podeGravar = () => !!cfg.token;

  async function gh(rota, opcoes = {}) {
    const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/${rota}`, {
      ...opcoes,
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json", ...(cfg.token ? { Authorization: "Bearer " + cfg.token } : {}), ...(opcoes.headers || {}) },
    });
    if (r.ok) return r.json();
    let msg = "";
    try { msg = (await r.json()).message || ""; } catch (e) {}
    const erro = new Error(
      r.status === 401 ? "Token do GitHub inválido ou vencido. Troque em ⚙ Configurações." :
      r.status === 403 && /rate limit/i.test(msg) ? "Limite de leituras do GitHub atingido. Cole um token em ⚙ Configurações (ele aumenta o limite)." :
      r.status === 403 ? "O token não tem permissão de escrita (Contents: Read and write) neste repositório." :
      r.status === 404 ? `Não encontrei ${decodeURIComponent(rota.split("?")[0].replace(/^contents\//, ""))}. Confira repositório, branch e pasta em ⚙ Configurações (e, se o repositório for privado, o token).` :
      `GitHub respondeu ${r.status}: ${msg}`
    );
    erro.status = r.status;
    throw erro;
  }
  const lerArquivo = async (arq) => {
    const d = await gh(`contents/${encodeURI(arq)}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
    return { sha: d.sha, base64: d.content || "", texto: d.content ? b64.de(d.content) : "" };
  };
  async function lerJson(arq, padraoSeFaltar) {
    try {
      const a = await lerArquivo(arq);
      return { dados: JSON.parse(a.texto), sha: a.sha };
    } catch (e) {
      if (e.status === 404 && padraoSeFaltar !== undefined) return { dados: padraoSeFaltar, sha: undefined };
      if (e instanceof SyntaxError) throw new Error(`${arq} não é um JSON válido: ${e.message}`);
      throw e;
    }
  }
  async function gravarJson(arq, dados, sha, mensagem) {
    if (!podeGravar()) throw new Error("Para salvar, cole o token do GitHub em ⚙ Configurações.");
    await gh(`contents/${encodeURI(arq)}`, {
      method: "PUT",
      body: JSON.stringify({ message: mensagem, branch: cfg.branch, content: b64.para(JSON.stringify(dados, null, 2) + "\n"), ...(sha ? { sha } : {}) }),
    });
  }
  // lê a versão mais nova, aplica a mudança e grava; se alguém gravou no meio, tenta de novo
  async function mudarJson(arq, padraoSeFaltar, fn, mensagem) {
    for (let tentativa = 0; ; tentativa++) {
      const { dados, sha } = await lerJson(arq, padraoSeFaltar);
      const resultado = await fn(dados);
      try { await gravarJson(arq, dados, sha, mensagem); return resultado; } catch (e) {
        if ((e.status === 409 || e.status === 422) && tentativa < 2) continue;
        throw e;
      }
    }
  }
  const mudarPosts = (slug, fn, msg) => mudarJson(caminho(slug, "posts.json"), { posts: [] }, (d) => { d.posts = d.posts || []; return fn(d.posts); }, `estúdio de posts (${slug}): ${msg}`);

  const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp" };
  async function marcaParaTemplate(slug, empresa) {
    const m = { ...(empresa.marca || {}) };
    if (m.logo && /^(https?:|data:)/.test(m.logo)) m.logoSrc = m.logo;
    else if (m.logo && !m.logo.includes("..")) {
      const ext = m.logo.split(".").pop().toLowerCase();
      try {
        if (MIME[ext]) m.logoSrc = `data:${MIME[ext]};base64,${(await lerArquivo(caminho(slug, m.logo))).base64.replace(/\s/g, "")}`;
      } catch (e) { console.warn("Logo não encontrado:", m.logo); }
    }
    return m;
  }

  async function carregar(slug) {
    const [e, b, p] = await Promise.all([
      lerJson(caminho(slug, "empresa.json")),
      lerJson(caminho(slug, "banco.json"), { pautas: [], frases: [], datas: [], legenda: {} }),
      lerJson(caminho(slug, "posts.json"), { posts: [] }),
    ]);
    return { empresa: e.dados, banco: b.dados, posts: p.dados.posts || [] };
  }
  async function estado(slug) {
    const { empresa, banco, posts } = await carregar(slug);
    return { slug, empresa, marca: await marcaParaTemplate(slug, empresa), posts, banco: resumoBanco({ empresa, banco, posts }) };
  }

  return {
    tipo: "github",
    podeGravar,
    descricao: () => `${cfg.owner}/${cfg.repo} · ${cfg.branch}`,
    async listarEmpresas() {
      if (!cfg.owner || !cfg.repo) throw Object.assign(new Error("Informe o repositório em ⚙ Configurações."), { status: 0 });
      const itens = await gh(`contents/${encodeURI(cfg.pasta)}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
      const pastas = itens.filter((i) => i.type === "dir" && !i.name.startsWith("_"));
      const lista = await Promise.all(pastas.map(async (d) => {
        try { const e = (await lerJson(caminho(d.name, "empresa.json"))).dados; return { slug: d.name, nome: (e.marca && e.marca.nome) || d.name }; } catch (er) { return null; }
      }));
      return lista.filter(Boolean);
    },
    estado,
    async gerar(slug, quantidade) {
      let novos = [], avisos = [];
      await mudarPosts(slug, async (posts) => {
        const { empresa, banco } = await carregar(slug);
        ({ novos, avisos } = gerarRascunhos({ empresa, banco, posts, quantidade }));
        posts.push(...novos);
      }, `${quantidade || ""} rascunho(s) gerado(s)`.trim());
      return { ok: true, criados: novos.map((p) => p.id), avisos, saida: descreverGeracao(novos, avisos), script: "lib/gerador.js (no navegador)", estado: await estado(slug) };
    },
    async salvarPost(slug, post) { await mudarPosts(slug, (ps) => atualizarPost(ps, post.id, post), `edita ${post.id}`); return estado(slug); },
    async status(slug, id, st) { await mudarPosts(slug, (ps) => mudarStatus(ps, id, st), `${id} → ${st}`); return estado(slug); },
    async excluir(slug, id) { await mudarPosts(slug, (ps) => excluirPost(ps, id), `exclui ${id}`); return estado(slug); },
    async lerBanco(slug) { return (await lerJson(caminho(slug, "banco.json"), { pautas: [], frases: [], datas: [] })).dados; },
    async salvarBanco(slug, banco) {
      for (const k of ["pautas", "frases", "datas"]) if (banco[k] != null && !Array.isArray(banco[k])) throw new Error(`"${k}" precisa ser uma lista [ ... ].`);
      await mudarJson(caminho(slug, "banco.json"), {}, (d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, banco); }, `estúdio de posts (${slug}): banco de conteúdo`);
      return estado(slug);
    },
    async salvarEmpresa(slug, empresa) {
      await mudarJson(caminho(slug, "empresa.json"), {}, (d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, empresa); }, `estúdio de posts (${slug}): marca`);
      return estado(slug);
    },
    async criarEmpresa(slug, nome, arroba) {
      if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug)) throw new Error("Nome de pasta inválido: use letras minúsculas, números e hífen (ex.: padaria-sol).");
      const existe = await lerJson(caminho(slug, "empresa.json"), null);
      if (existe.dados) throw new Error(`Já existe uma empresa "${slug}".`);
      const empresa = (await lerJson(caminho("_modelo", "empresa.json"))).dados;
      const banco = (await lerJson(caminho("_modelo", "banco.json"))).dados;
      empresa.marca.nome = nome || slug;
      if (arroba) empresa.marca.rodape = arroba.startsWith("@") ? arroba : "@" + arroba;
      const msg = `estúdio de posts: nova empresa ${slug}`;
      await gravarJson(caminho(slug, "empresa.json"), empresa, undefined, msg);
      await gravarJson(caminho(slug, "banco.json"), banco, undefined, msg);
      await gravarJson(caminho(slug, "posts.json"), { posts: [] }, undefined, msg);
    },
    // empresa.json → "instaBot": { "posts": "insta-bot/posts.json", "ideias": "insta-bot/ideias.json" }
    async enviarInstaBot(slug, id) {
      const { empresa, posts } = await carregar(slug);
      const ib = empresa.instaBot;
      if (!ib || !ib.posts) throw new Error('Esta empresa não está ligada a um insta-bot (empresa.json → "instaBot").');
      const post = posts.find((p) => p.id === id);
      if (!post) throw new Error(`Post "${id}" não encontrado.`);
      const ideias = ib.ideias ? (await lerJson(ib.ideias, { posts: [] })).dados.posts || [] : [];
      const idBot = await mudarJson(ib.posts, null, (d) => {
        if (!d) throw new Error(`Não encontrei ${ib.posts} no repositório.`);
        const novo = paraInstaBot(post, d.posts || [], ideias);
        d.posts = [...(d.posts || []), novo];
        return novo.id;
      }, `painel: atualiza a fila de posts do Instagram (${id} do estúdio)`);
      await mudarPosts(slug, (ps) => { const p = ps.find((x) => x.id === id); if (p) p.filaInstaBot = idBot; }, `${id} enviado ao insta-bot (${idBot})`);
      return { idBot, estado: await estado(slug) };
    },
  };
}
