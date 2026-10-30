// Cria a pasta de uma nova empresa a partir do modelo (empresas/_modelo).
// Uso: node nova-empresa.mjs <pasta> "Nome da Empresa" [@arroba]
//   ex.: node nova-empresa.mjs padaria-sol "Padaria Sol" @padariasol
// (No painel também dá: seletor de empresa → "+ Nova empresa…")
import { criarEmpresa } from "./lib/dados.mjs";

const [slug, nome, arroba] = process.argv.slice(2);
if (!slug || slug.startsWith("_")) {
  console.error('Uso: node nova-empresa.mjs <pasta> "Nome da Empresa" [@arroba]\n  <pasta>: letras minúsculas, números e hífen (ex.: padaria-sol)');
  process.exit(2);
}
try {
  const destino = criarEmpresa(slug, nome, arroba);
  console.log(`Empresa criada em ${destino}
Próximos passos:
  1. No painel, ajuste cores, fonte e logo em "Marca".
  2. Troque as pautas de exemplo em "Banco de conteúdo" pelas da empresa.
  3. Clique em "Gerar rascunhos".`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
