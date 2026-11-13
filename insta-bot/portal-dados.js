// Ideias criadas com os dados públicos do portal (indicações aprovadas), sem IA e sem citar nomes.
// Funções puras: quem busca os dados e grava o banco é o abastecer-banco.mjs.

export const ESTADOS = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
// "no Rio de Janeiro", "na Bahia", "em São Paulo"
const NO = ["AC", "AP", "AM", "CE", "DF", "ES", "MA", "MT", "MS", "PA", "PR", "PI", "RJ", "RN", "RS", "TO"], NA = ["BA", "PB"];
export const noEstado = (uf) => `${NO.includes(uf) ? "no" : NA.includes(uf) ? "na" : "em"} ${ESTADOS[uf]}`;
const TAGS = "#transmasc #homemtrans #transmasculino #transbrasil";
const AVISO = { forte: "Indicações feitas pela comunidade.", texto: "Confirme o contato antes de ir." };

const emojiDe = (nome) =>
  /psic/i.test(nome) ? "🧠" : /cirurg/i.test(nome) ? "🩺" : /ambulat/i.test(nome) ? "🏥" : /endocr/i.test(nome) ? "💉" : /advog/i.test(nome) ? "⚖️" : "📌";
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const lista = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);
const contar = (arr, chave) => {
  const m = new Map();
  for (const x of arr) { const k = chave(x); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
};
// "santa maria" -> "Santa Maria" (de, da, do e e ficam minúsculas)
const capitalizar = (t) => t.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, sep, l) => sep + l.toUpperCase()).replace(/ (De|Da|Do|Das|Dos|E) /g, (m) => m.toLowerCase());
const cidadesDe = (arr, max = 3) => contar(arr, (i) => capitalizar((i.cidade || "").trim())).slice(0, max).map(([c]) => c);
const ehSUS = (i) => /\bsus\b/i.test(i.convenio || "");
const legenda = (corpo, extra) => `${corpo}\n\nContatos e convênios podem mudar: confirme direto com o serviço antes de ir.\n\nConhece um serviço que não está no portal? Indica lá 💙\n\n🔗 Link na bio\n\n${TAGS} ${extra}`.trim();

// Uma ideia por estado com pelo menos "minimo" indicações
export function ideiasPorEstado(ind, nomesCat, minimo = 2) {
  const out = [];
  for (const [uf, total] of contar(ind, (i) => i.estado)) {
    if (total < minimo || !ESTADOS[uf]) continue;
    const doUF = ind.filter((i) => i.estado === uf);
    const porCat = contar(doUF, (i) => i.categoria);
    const sus = doUF.filter(ehSUS).length;
    const itens = porCat.slice(0, 4).map(([cat, n]) => {
      const nome = nomesCat[cat] || cat;
      return { emoji: emojiDe(nome), titulo: `${nome}: ${n}`, texto: lista(cidadesDe(doUF.filter((i) => i.categoria === cat))) };
    });
    if (sus && itens.length < 5) itens.push({ emoji: "✅", titulo: plural(sus, "atende pelo SUS", "atendem pelo SUS"), texto: "Entre as indicações do estado" });
    const nomeUF = ESTADOS[uf];
    out.push({
      chave: `portal-uf-${uf}`,
      assinatura: JSON.stringify(porCat) + "|" + sus,
      post: {
        tipo: "lista", kicker: "No portal", titulo: ["Atendimento trans", noEstado(uf)],
        subtitulo: `${plural(total, "indicação da comunidade", "indicações da comunidade")} no estado`,
        itens, destaque: { ...AVISO },
        legenda: legenda(`Procurando atendimento trans ${noEstado(uf)}? 📍\n\nO portal reúne ${plural(total, "indicação", "indicações")} no estado, feitas pela própria comunidade:\n${itens.map((it) => `${it.emoji} ${it.titulo}`).join("\n")}`, "#ambulatoriotrans"),
      },
    });
  }
  return out;
}

// Uma ideia por categoria, com os estados que mais têm indicações
export function ideiasPorCategoria(ind, nomesCat, minimo = 3) {
  const out = [];
  for (const [cat, total] of contar(ind, (i) => i.categoria)) {
    if (total < minimo) continue;
    const nome = nomesCat[cat] || cat;
    const daCat = ind.filter((i) => i.categoria === cat);
    const porUF = contar(daCat, (i) => i.estado).filter(([uf]) => ESTADOS[uf]);
    const itens = porUF.slice(0, 4).map(([uf, n]) => ({ emoji: "📍", titulo: `${ESTADOS[uf]}: ${n}`, texto: lista(cidadesDe(daCat.filter((i) => i.estado === uf))) }));
    if (porUF.length > 4) itens.push({ emoji: "➕", titulo: `E mais ${plural(porUF.length - 4, "estado", "estados")}`, texto: "Veja todos no portal" });
    out.push({
      chave: `portal-cat-${cat}`,
      assinatura: JSON.stringify(porUF),
      post: {
        tipo: "lista", kicker: nome.slice(0, 24), titulo: ["Onde tem", "pelo Brasil"],
        subtitulo: `${plural(total, "indicação", "indicações")} em ${plural(porUF.length, "estado", "estados")}`,
        itens, destaque: { ...AVISO },
        legenda: legenda(`${emojiDe(nome)} ${nome}: o portal tem ${plural(total, "indicação", "indicações")} em ${plural(porUF.length, "estado", "estados")}, todas feitas pela comunidade.\n\nOnde tem mais:\n${itens.filter((it) => it.emoji === "📍").map((it) => `📍 ${it.titulo}`).join("\n")}`, "#comunidadetrans"),
      },
    });
  }
  return out;
}

// Indicações aprovadas desde a última vez (precisa de pelo menos "minimo")
export function ideiaNovidades(ind, nomesCat, desde, minimo = 3) {
  const novas = ind.filter((i) => String(i.timestamp || "") > String(desde || ""));
  if (novas.length < minimo) return null;
  const porUF = contar(novas, (i) => i.estado).filter(([uf]) => ESTADOS[uf]);
  const itens = porUF.slice(0, 4).map(([uf, n]) => {
    const cats = contar(novas.filter((i) => i.estado === uf), (i) => i.categoria).map(([c]) => (nomesCat[c] || c).toLowerCase());
    return { emoji: "📍", titulo: `${ESTADOS[uf]}: ${n}`, texto: lista(cats).slice(0, 60) };
  });
  const dia = String(desde || "").slice(0, 10).split("-").reverse().join("/");
  return {
    chave: `portal-novas-${new Date().toISOString().slice(0, 10)}`,
    assinatura: String(novas.length),
    ate: novas.map((i) => String(i.timestamp || "")).sort().pop(),
    post: {
      tipo: "lista", kicker: "Novidade no portal", titulo: ["Indicações novas", "no portal"],
      subtitulo: `${plural(novas.length, "indicação aprovada", "indicações aprovadas")}${dia ? ` desde ${dia}` : ""}`,
      itens, destaque: { forte: "Obrigado a quem indicou! 💙", texto: "Confirme o contato antes de ir." },
      legenda: legenda(`Chegaram ${plural(novas.length, "indicação nova", "indicações novas")} no portal${dia ? ` desde ${dia}` : ""} 🎉\n\n${itens.map((it) => `📍 ${it.titulo}`).join("\n")}\n\nObrigado a todo mundo que indicou. É assim que o portal cresce.`, "#comunidadetrans"),
    },
  };
}
