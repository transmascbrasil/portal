// Abastece o banco de conteúdo (ideias.json) sozinho, sem IA e sem chave. Roda nas rodadas do robô.
//  1) Reserva: libera as próximas pautas do reserva.json (padrão: 1 a cada 2 dias).
//  2) Dados do portal: cria ideias com as indicações aprovadas do site (por estado, por categoria e
//     "novidades"), no máximo uma vez por dia. Uma ideia só é refeita quando os números mudam,
//     e no mínimo 30 dias depois da anterior.
// Regras em ideias.json -> "abastecer". FORCAR=1 ignora os intervalos.
import { readFileSync, writeFileSync } from "node:fs";
import { proximoId } from "./fila.js";
import { ideiasPorEstado, ideiasPorCategoria, ideiaNovidades } from "./portal-dados.js";

const FORCAR = !!process.env.FORCAR;
const DIA = 86400000;
const agora = new Date();
const config = JSON.parse(readFileSync("posts.json", "utf8"));
const banco = JSON.parse(readFileSync("ideias.json", "utf8"));
if (!Array.isArray(banco.posts)) banco.posts = [];
const ab = (banco.abastecer = banco.abastecer || {});
const reserva = (ab.reserva = { ativa: true, aCadaDias: 2, quantidade: 1, ...(ab.reserva || {}) });
const portal = (ab.portal = { ativa: true, refazerAposDias: 30, ...(ab.portal || {}) });
const log = [];
let mudou = false;

const idsUsados = () => new Set([...config.posts.map((p) => p.id), ...banco.posts.map((p) => p.id)]);
const jaVirouPost = (id) => config.posts.some((p) => p.id === id);

// 1) reserva
if (reserva.ativa) {
  const prazo = reserva.ultimaVez ? Date.parse(reserva.ultimaVez) + reserva.aCadaDias * DIA : 0;
  if (FORCAR || agora.getTime() >= prazo) {
    let pautas = [];
    try { pautas = JSON.parse(readFileSync("reserva.json", "utf8")).posts || []; } catch (e) {}
    const usados = idsUsados();
    const proximas = pautas.filter((p) => !usados.has(p.id)).slice(0, Math.max(1, Number(reserva.quantidade) || 1));
    if (proximas.length) {
      banco.posts.push(...proximas.map((p) => ({ ...p, aprovado: false, postado: false, abastecidoEm: agora.toISOString() })));
      reserva.ultimaVez = agora.toISOString();
      mudou = true;
      log.push(`reserva: liberei ${proximas.map((p) => p.id).join(", ")} (${pautas.filter((p) => !idsUsados().has(p.id)).length} ainda guardadas)`);
    } else log.push("reserva: acabou (todas as pautas já foram liberadas)");
  } else log.push("reserva: ainda não está na hora");
}

// 2) dados do portal
async function buscarPortal() {
  const base = "https://firestore.googleapis.com/v1/projects/portal-d40f5/databases/(default)/documents";
  const valor = (v) => (v ? Object.values(v)[0] : undefined);
  const r = await fetch(`${base}/artifacts/portal-transmasc-app/public/data:runQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "profissionais" }], where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "aprovado" } } } } }),
  });
  if (!r.ok) throw new Error(`indicações: HTTP ${r.status}`);
  const ind = (await r.json()).filter((x) => x.document).map((x) => Object.fromEntries(Object.entries(x.document.fields || {}).map(([k, v]) => [k, valor(v)])));
  const nomesCat = {};
  try {
    const c = await fetch(`${base}/categorias`);
    if (c.ok) for (const d of (await c.json()).documents || []) nomesCat[d.name.split("/").pop()] = valor(d.fields.nome);
  } catch (e) {}
  return { ind, nomesCat };
}
if (portal.ativa) {
  const prazo = portal.ultimaVez ? Date.parse(portal.ultimaVez) + 20 * 3600000 : 0;
  if (FORCAR || agora.getTime() >= prazo) {
    try {
      const { ind, nomesCat } = await buscarPortal();
      const assin = (portal.assinaturas = portal.assinaturas || {});
      const candidatas = [...ideiasPorEstado(ind, nomesCat), ...ideiasPorCategoria(ind, nomesCat)];
      // novidades: só depois da primeira rodada (na primeira, só marca de onde começar a contar)
      if (portal.novidadesDesde) {
        const nov = ideiaNovidades(ind, nomesCat, portal.novidadesDesde);
        if (nov) { candidatas.push(nov); portal.novidadesDesde = nov.ate; }
      } else portal.novidadesDesde = ind.map((i) => String(i.timestamp || "")).sort().pop() || agora.toISOString();
      const criadas = [], atualizadas = [];
      for (const c of candidatas) {
        const ant = assin[c.chave];
        if (ant && ant.assinatura === c.assinatura) continue; // números iguais: nada novo
        const pendente = banco.posts.find((p) => p.portalChave === c.chave && !jaVirouPost(p.id));
        if (pendente) {
          // ainda não virou rascunho: só atualiza os números
          Object.keys(pendente).forEach((k) => { if (!["id", "portalChave", "abastecidoEm"].includes(k)) delete pendente[k]; });
          Object.assign(pendente, c.post, { aprovado: false, postado: false });
          assin[c.chave] = { ...ant, assinatura: c.assinatura };
          atualizadas.push(pendente.id);
          continue;
        }
        if (ant && agora.getTime() - Date.parse(ant.em) < portal.refazerAposDias * DIA) continue; // feita há pouco
        const id = proximoId(config.posts, banco.posts);
        banco.posts.push({ id, ...c.post, portalChave: c.chave, aprovado: false, postado: false, abastecidoEm: agora.toISOString() });
        assin[c.chave] = { assinatura: c.assinatura, em: agora.toISOString(), id };
        criadas.push(id);
      }
      portal.ultimaVez = agora.toISOString();
      portal.ultimoResultado = `${ind.length} indicações lidas; ${criadas.length} ideia(s) nova(s)${atualizadas.length ? `, ${atualizadas.length} atualizada(s)` : ""}.`;
      mudou = true;
      log.push("portal: " + portal.ultimoResultado + (criadas.length ? ` (${criadas.join(", ")})` : ""));
    } catch (e) {
      portal.ultimaVez = agora.toISOString();
      portal.ultimoResultado = "erro ao ler o portal: " + (e.message || e);
      mudou = true;
      log.push("portal: " + portal.ultimoResultado);
    }
  } else log.push("portal: já li os dados nas últimas 20 horas");
}

if (mudou) writeFileSync("ideias.json", JSON.stringify(banco, null, 2) + "\n");
console.log("Abastecer banco:\n  " + log.join("\n  "));
