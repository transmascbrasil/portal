// Rascunhos automáticos: se estiver ligado e na hora, transforma as próximas ideias do banco em rascunhos.
// Não usa IA nem chave. As regras ficam em fila.js (criarRascunhosAuto).
import { readFileSync, writeFileSync } from "node:fs";
import { criarRascunhosAuto } from "./fila.js";

const config = JSON.parse(readFileSync("posts.json", "utf8"));
let ideias = [];
try { ideias = JSON.parse(readFileSync("ideias.json", "utf8")).posts || []; } catch (e) {}

const r = criarRascunhosAuto(config, ideias);
if (r.motivo === "desligado" || r.motivo === "ainda não está na hora") {
  console.log("Rascunhos automáticos:", r.motivo + ".");
  process.exit(0);
}
writeFileSync("posts.json", JSON.stringify(config, null, 2) + "\n");
console.log(
  r.criados.length
    ? `Rascunhos automáticos: criei ${r.criados.length} (${r.criados.map((p) => p.id).join(", ")})${r.criados[0].aprovado ? ", já aprovados na fila" : ""}.`
    : "Rascunhos automáticos: o banco de ideias está vazio, nada criado."
);
