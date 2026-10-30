// Cria a pasta de uma nova empresa a partir do modelo (empresas/_modelo).
// Uso: node nova-empresa.mjs <pasta> "Nome da Empresa" [@arroba]
//   ex.: node nova-empresa.mjs padaria-sol "Padaria Sol" @padariasol
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EMPRESAS_DIR, RAIZ, slugValido, lerJson, gravarJson } from "./lib/dados.mjs";

const [slug, nome, arroba] = process.argv.slice(2);
if (!slugValido(slug) || slug.startsWith("_")) {
  console.error('Uso: node nova-empresa.mjs <pasta> "Nome da Empresa" [@arroba]\n  <pasta>: letras minúsculas, números e hífen (ex.: padaria-sol)');
  process.exit(2);
}
const destino = join(EMPRESAS_DIR, slug);
if (existsSync(destino)) {
  console.error(`Já existe: ${destino}`);
  process.exit(1);
}
const modelo = existsSync(join(EMPRESAS_DIR, "_modelo")) ? join(EMPRESAS_DIR, "_modelo") : join(RAIZ, "empresas", "_modelo");
cpSync(modelo, destino, { recursive: true });

const arq = join(destino, "empresa.json");
const e = lerJson(arq);
e.marca.nome = nome || slug;
if (arroba) e.marca.rodape = arroba.startsWith("@") ? arroba : "@" + arroba;
gravarJson(arq, e);
gravarJson(join(destino, "posts.json"), { posts: [] });

console.log(`Empresa criada em ${destino}
Próximos passos:
  1. Abra o painel (node server.mjs) e ajuste cores, fonte e logo em "Marca".
  2. Troque as pautas de exemplo em "Banco de conteúdo" pelas da empresa.
  3. Clique em "Gerar rascunhos".`);
