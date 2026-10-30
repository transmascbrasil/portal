// Rascunhos automáticos: se estiver ligado e na hora, transforma o próximo conteúdo do banco
// (ideias.json: datas comemorativas, ideias e frases) em rascunhos.
// Não usa IA nem chave. As regras ficam em banco.js (criarDoBanco) e fila.js (criarRascunhosAuto).
import { readFileSync, writeFileSync } from "node:fs";
import { criarRascunhosAuto } from "./fila.js";

const config = JSON.parse(readFileSync("posts.json", "utf8"));
let banco = { posts: [] };
try { banco = JSON.parse(readFileSync("ideias.json", "utf8")); } catch (e) {}

const r = criarRascunhosAuto(config, banco);
if (r.motivo === "desligado" || r.motivo === "ainda não está na hora") {
  console.log("Rascunhos automáticos:", r.motivo + ".");
  process.exit(0);
}
writeFileSync("posts.json", JSON.stringify(config, null, 2) + "\n");
console.log(
  r.criados.length
    ? `Rascunhos automáticos: criei ${r.criados.length} (${r.criados.map((p) => p.id).join(", ")})${r.criados[0].aprovado ? ", já aprovados na fila" : ""}.`
    : "Rascunhos automáticos: o banco de conteúdo está vazio, nada criado."
);
