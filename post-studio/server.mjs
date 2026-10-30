// Servidor do painel. Zero dependências obrigatórias: só Node 18+.
//   node server.mjs              -> http://localhost:3333
// Variáveis de ambiente:
//   PORT=3333            porta
//   PAINEL_SENHA=xxxx    pede senha para abrir o painel (recomendado se ficar na internet)
//   EMPRESAS_DIR=...     onde ficam as pastas das empresas (padrão: ./empresas)
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, extname, sep } from "node:path";
import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { RAIZ, listarEmpresas, carregar, gravarPosts, gravarBanco, gravarEmpresa, marcaParaTemplate } from "./lib/dados.mjs";
import { resumoBanco, geracaoDe } from "./lib/gerador.js";
import { renderJpg, fechar } from "./lib/render.mjs";

const PORT = Number(process.env.PORT) || 3333;
const SENHA = process.env.PAINEL_SENHA || "";
const STATUS = ["rascunho", "aprovado", "publicado", "rejeitado"];
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

// uma operação por empresa de cada vez (evita duas gravações ao mesmo tempo no mesmo arquivo)
const filas = new Map();
function emSequencia(slug, fn) {
  const ant = filas.get(slug) || Promise.resolve();
  const prox = ant.then(fn, fn);
  filas.set(slug, prox.catch(() => {}));
  return prox;
}

class ErroHttp extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function enviar(res, status, corpo, tipo = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": tipo, "Cache-Control": "no-store" });
  res.end(typeof corpo === "string" || Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo));
}

async function lerCorpo(req) {
  let tam = 0; const partes = [];
  for await (const c of req) {
    tam += c.length;
    if (tam > 5e6) throw new ErroHttp(413, "Conteúdo grande demais.");
    partes.push(c);
  }
  if (!partes.length) return {};
  try { return JSON.parse(Buffer.concat(partes).toString("utf8")); } catch (e) { throw new ErroHttp(400, "JSON inválido: " + e.message); }
}

function autorizado(req) {
  if (!SENHA) return true;
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const senha = Buffer.from(h.slice(6), "base64").toString().split(":").slice(1).join(":");
  const a = Buffer.from(senha), b = Buffer.from(SENHA);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Roda o script de geração da empresa (padrão: scripts/gerar-rascunhos.mjs) como processo separado
function rodarScript(slug, empresa, quantidade) {
  const rel = geracaoDe(empresa).script || "scripts/gerar-rascunhos.mjs";
  const arq = resolve(RAIZ, rel);
  if (!arq.startsWith(join(RAIZ, "scripts") + sep) || !/\.(m?js)$/.test(arq) || !existsSync(arq)) {
    throw new ErroHttp(400, `Script inválido em empresa.json (geracao.script): "${rel}". Ele precisa estar na pasta scripts/.`);
  }
  return new Promise((ok) => {
    execFile(process.execPath, [arq, "--empresa", slug, "--qtd", String(quantidade || ""), "--json"],
      { cwd: RAIZ, timeout: 120000, env: { ...process.env, EMPRESA: slug } },
      (err, stdout, stderr) => {
        const linhas = String(stdout).trim().split("\n");
        let resultado = {};
        try { resultado = JSON.parse(linhas[linhas.length - 1]); linhas.pop(); } catch (e) {}
        ok({ ok: !err && resultado.ok !== false, saida: [...linhas, ...String(stderr).trim().split("\n")].filter(Boolean).join("\n"), ...resultado, script: rel });
      });
  });
}

function estado(slug) {
  const { empresa, banco, posts } = carregar(slug);
  return { slug, empresa, marca: marcaParaTemplate(slug, empresa), posts, banco: resumoBanco({ empresa, banco, posts }) };
}

async function api(req, res, partes) {
  const [, , recurso, slug, sub, id, acao] = partes; // /api/e/<slug>/posts/<id>/<acao>
  if (recurso === "empresas") return enviar(res, 200, listarEmpresas());
  if (recurso !== "e" || !slug) throw new ErroHttp(404, "Rota não encontrada.");
  const m = req.method;

  if (!sub && m === "GET") return enviar(res, 200, estado(slug));

  if (sub === "gerar" && m === "POST") {
    const corpo = await lerCorpo(req);
    const r = await emSequencia(slug, () => rodarScript(slug, carregar(slug).empresa, corpo.quantidade));
    return enviar(res, r.ok ? 200 : 500, { ...r, estado: estado(slug) });
  }

  if (sub === "banco") {
    if (m === "GET") return enviar(res, 200, carregar(slug).banco);
    if (m === "PUT") {
      const b = await lerCorpo(req);
      for (const k of ["pautas", "frases", "datas"]) if (b[k] != null && !Array.isArray(b[k])) throw new ErroHttp(400, `"${k}" precisa ser uma lista [ ... ].`);
      await emSequencia(slug, () => gravarBanco(slug, b));
      return enviar(res, 200, estado(slug));
    }
  }

  if (sub === "empresa" && m === "PUT") {
    const e = await lerCorpo(req);
    if (!e.marca || typeof e.marca !== "object") throw new ErroHttp(400, "empresa.json precisa ter \"marca\".");
    await emSequencia(slug, () => gravarEmpresa(slug, e));
    return enviar(res, 200, estado(slug));
  }

  if (sub === "posts" && id) {
    const idLimpo = id.replace(/\.jpg$/, "");
    if (m === "GET" && id.endsWith(".jpg")) {
      const { empresa, posts } = carregar(slug);
      const p = posts.find((x) => x.id === idLimpo);
      if (!p) throw new ErroHttp(404, "Post não encontrado.");
      const jpg = await renderJpg(p, marcaParaTemplate(slug, empresa));
      res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Disposition": `attachment; filename="${slug}-${idLimpo}.jpg"`, "Cache-Control": "no-store" });
      return res.end(jpg);
    }
    return emSequencia(slug, async () => {
      const corpo = m === "GET" ? {} : await lerCorpo(req);
      const { posts } = carregar(slug);
      const i = posts.findIndex((x) => x.id === idLimpo);
      if (i < 0) throw new ErroHttp(404, "Post não encontrado.");
      if (m === "DELETE") posts.splice(i, 1);
      else if (m === "PUT" && !acao) posts[i] = { ...corpo, id: posts[i].id, fonte: posts[i].fonte, criadoEm: posts[i].criadoEm, status: STATUS.includes(corpo.status) ? corpo.status : posts[i].status };
      else if (m === "POST" && acao === "status") {
        if (!STATUS.includes(corpo.status)) throw new ErroHttp(400, "Status inválido.");
        posts[i].status = corpo.status;
        if (corpo.status === "publicado") posts[i].publicadoEm = new Date().toISOString();
        else delete posts[i].publicadoEm;
      } else if (m === "POST" && acao === "mover") {
        const j = Math.max(0, Math.min(posts.length - 1, i + (corpo.direcao < 0 ? -1 : 1)));
        [posts[i], posts[j]] = [posts[j], posts[i]];
      } else throw new ErroHttp(405, "Ação não suportada.");
      gravarPosts(slug, posts);
      return enviar(res, 200, estado(slug));
    });
  }
  throw new ErroHttp(404, "Rota não encontrada.");
}

function estatico(req, res, caminho) {
  if (caminho === "/" || caminho === "") caminho = "/painel/index.html";
  // só serve o painel e o template (o resto do projeto não fica exposto)
  const permitido = caminho.startsWith("/painel/") || caminho === "/lib/template.js";
  const arq = resolve(RAIZ, "." + caminho);
  if (!permitido || !arq.startsWith(RAIZ + sep) || !existsSync(arq)) return enviar(res, 404, "Não encontrado", "text/plain; charset=utf-8");
  enviar(res, 200, readFileSync(arq), MIME[extname(arq)] || "application/octet-stream");
}

const servidor = createServer(async (req, res) => {
  try {
    if (!autorizado(req)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Painel de posts", charset="UTF-8"' });
      return res.end("Senha necessária.");
    }
    const url = new URL(req.url, "http://x");
    const caminho = decodeURIComponent(url.pathname);
    if (caminho.startsWith("/api/")) return await api(req, res, caminho.split("/"));
    return estatico(req, res, caminho);
  } catch (e) {
    if (!res.headersSent) enviar(res, e.status || 500, { ok: false, erro: e.message });
    if (!e.status) console.error(e);
  }
});

servidor.listen(PORT, () => {
  console.log(`Painel rodando em http://localhost:${PORT}${SENHA ? " (com senha)" : ""}`);
  console.log(`Empresas: ${listarEmpresas().map((e) => e.slug).join(", ") || "nenhuma (crie com: node nova-empresa.mjs minha-empresa \"Minha Empresa\")"}`);
});
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, async () => { await fechar(); process.exit(0); });
