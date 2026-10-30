// Leitura e gravação dos arquivos de cada empresa: empresas/<slug>/{empresa,banco,posts}.json
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, mkdirSync, cpSync } from "node:fs";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// EMPRESAS_DIR permite guardar os dados num disco persistente (ex.: volume do servidor)
export const EMPRESAS_DIR = resolve(process.env.EMPRESAS_DIR || join(RAIZ, "empresas"));

export const slugValido = (s) => /^[a-z0-9][a-z0-9-]{0,40}$/.test(String(s || ""));

export function pastaDe(slug) {
  if (!slugValido(slug)) throw new Error(`Empresa inválida: "${slug}"`);
  const p = join(EMPRESAS_DIR, slug);
  if (!existsSync(join(p, "empresa.json"))) throw new Error(`Empresa "${slug}" não encontrada em ${EMPRESAS_DIR}`);
  return p;
}

export function lerJson(arq, padrao) {
  try { return JSON.parse(readFileSync(arq, "utf8")); } catch (e) {
    if (e.code === "ENOENT" && padrao !== undefined) return padrao;
    throw new Error(`Não consegui ler ${arq}: ${e.message}`);
  }
}
// grava num arquivo temporário e renomeia (não corrompe se cair no meio)
export function gravarJson(arq, dados) {
  mkdirSync(dirname(arq), { recursive: true });
  const tmp = arq + ".tmp";
  writeFileSync(tmp, JSON.stringify(dados, null, 2) + "\n");
  renameSync(tmp, arq);
}

export function listarEmpresas() {
  if (!existsSync(EMPRESAS_DIR)) return [];
  return readdirSync(EMPRESAS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && slugValido(d.name) && existsSync(join(EMPRESAS_DIR, d.name, "empresa.json")))
    .map((d) => {
      const e = lerJson(join(EMPRESAS_DIR, d.name, "empresa.json"), {});
      return { slug: d.name, nome: (e.marca && e.marca.nome) || d.name };
    });
}

export function carregar(slug) {
  const p = pastaDe(slug);
  return {
    pasta: p,
    empresa: lerJson(join(p, "empresa.json")),
    banco: lerJson(join(p, "banco.json"), { pautas: [], frases: [], datas: [], legenda: {} }),
    posts: lerJson(join(p, "posts.json"), { posts: [] }).posts || [],
  };
}
export const gravarPosts = (slug, posts) => gravarJson(join(pastaDe(slug), "posts.json"), { posts });
export const gravarBanco = (slug, banco) => gravarJson(join(pastaDe(slug), "banco.json"), banco);
export const gravarEmpresa = (slug, empresa) => gravarJson(join(pastaDe(slug), "empresa.json"), empresa);

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };
// marca pronta para o template: logo local vira data URI (funciona no painel e no render)
export function marcaParaTemplate(slug, empresa) {
  const m = { ...(empresa.marca || {}) };
  if (m.logo) {
    if (/^(https?:|data:)/.test(m.logo)) m.logoSrc = m.logo;
    else {
      const arq = resolve(pastaDe(slug), m.logo);
      if (arq.startsWith(pastaDe(slug)) && existsSync(arq) && MIME[extname(arq).toLowerCase()]) {
        m.logoSrc = `data:${MIME[extname(arq).toLowerCase()]};base64,${readFileSync(arq).toString("base64")}`;
      }
    }
  }
  return m;
}

// Cria a pasta de uma empresa nova copiando empresas/_modelo
export function criarEmpresa(slug, nome, arroba) {
  if (!slugValido(slug)) throw Object.assign(new Error("Nome de pasta inválido: use letras minúsculas, números e hífen (ex.: padaria-sol)."), { status: 400 });
  const destino = join(EMPRESAS_DIR, slug);
  if (existsSync(destino)) throw Object.assign(new Error(`Já existe uma empresa "${slug}".`), { status: 409 });
  const modelo = existsSync(join(EMPRESAS_DIR, "_modelo")) ? join(EMPRESAS_DIR, "_modelo") : join(RAIZ, "empresas", "_modelo");
  cpSync(modelo, destino, { recursive: true });
  const e = lerJson(join(destino, "empresa.json"));
  e.marca.nome = nome || slug;
  if (arroba) e.marca.rodape = arroba.startsWith("@") ? arroba : "@" + arroba;
  gravarJson(join(destino, "empresa.json"), e);
  gravarJson(join(destino, "posts.json"), { posts: [] });
  return destino;
}
