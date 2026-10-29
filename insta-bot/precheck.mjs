// Decide, sem instalar nada, se esta rodada tem algo a publicar. Evita gastar minutos do GitHub à toa.
import { readFileSync, appendFileSync } from "node:fs";
import { proximaPublicacao } from "./fila.js";

const config = JSON.parse(readFileSync("posts.json", "utf8"));
const d = proximaPublicacao(config, { modo: process.env.MODO || "manual", postId: (process.env.POST_ID || "").trim() });
const teste = !!process.env.DRY_RUN; // teste de conexão sempre roda tudo
const soIdeias = !!process.env.SO_IDEIAS; // rodada só para gerar ideias: não publica
const run = !soIdeias && (!!(d.post || d.repeticao) || teste);
console.log(run ? "Há o que fazer nesta rodada." : soIdeias ? "Rodada só para gerar ideias: não publico nada." : "Nada a fazer agora: " + d.motivo);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
