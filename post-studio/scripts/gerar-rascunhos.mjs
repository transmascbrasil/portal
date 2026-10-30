// Gera rascunhos de posts a partir do banco de conteúdo. Sem IA, sem chave, sem internet.
// É este script que o botão "Gerar rascunhos" do painel executa.
//
// Uso: node scripts/gerar-rascunhos.mjs --empresa transmasc [--qtd 3] [--json] [--teste]
//   --json   imprime o resultado em JSON na última linha (usado pelo painel)
//   --teste  só mostra o que seria criado, não grava
import { carregar, gravarPosts } from "../lib/dados.mjs";
import { gerarRascunhos } from "../lib/gerador.js";

const args = process.argv.slice(2);
const arg = (nome, padrao = "") => { const i = args.indexOf("--" + nome); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : padrao; };
const flag = (nome) => args.includes("--" + nome);

const slug = arg("empresa", process.env.EMPRESA || "");
if (!slug) {
  console.error("Informe a empresa: node scripts/gerar-rascunhos.mjs --empresa <pasta>");
  process.exit(2);
}

try {
  const { empresa, banco, posts } = carregar(slug);
  const { novos, avisos } = gerarRascunhos({ empresa, banco, posts, quantidade: arg("qtd") });
  if (novos.length && !flag("teste")) gravarPosts(slug, [...posts, ...novos]);

  for (const p of novos) console.log(`+ ${p.id}  [${p.tipo}/${p.tema}]  ${(p.titulo || []).join(" ")}  (${p.motivo})`);
  for (const a of avisos) console.log("! " + a);
  console.log(novos.length ? `${novos.length} rascunho(s) ${flag("teste") ? "seriam criados (teste)" : "criado(s)"}.` : "Nenhum rascunho criado.");
  if (flag("json")) console.log(JSON.stringify({ ok: true, criados: novos.map((p) => p.id), avisos }));
} catch (e) {
  console.error("Erro: " + e.message);
  if (flag("json")) console.log(JSON.stringify({ ok: false, erro: e.message }));
  process.exit(1);
}
