// Templates de post (1080x1350) com as cores da marca de cada empresa.
// Usado pelo servidor (gera o JPG) e pelo painel (pré-visualização ao vivo).
// Não importe nada de Node aqui: este arquivo roda nos dois lugares.

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const TIPOS = {
  passos: "Passos (lista numerada)",
  lista: "Lista (com emoji)",
  checklist: "Checklist (caixinhas)",
  mito: "Mito ou verdade",
  comparativo: "Comparativo (2 colunas)",
  citacao: "Frase em destaque",
  capa: "Capa / aviso (só título)",
};
export const TIPOS_SEM_ITENS = ["capa", "citacao"];
export const TIPOS_COM_EMOJI = ["lista", "comparativo"];
export const TEMAS = { escuro: "Escuro", claro: "Claro", primaria: "Cor primária", secundaria: "Cor secundária" };

export const CORES_PADRAO = { escura: "#14254F", clara: "#F7FAFF", primaria: "#5BCEFA", secundaria: "#F5A9B8" };

// ---------- cores ----------
const hex = (c) => {
  let h = String(c || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h, 16);
  return isNaN(n) || h.length !== 6 ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const paraHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
// mistura a cor a com b (t = quanto de b)
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return paraHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (c) => {
  const [r, g, b] = hex(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// texto que fica mais legível sobre o fundo bg: a cor escura da marca ou branco
const sobre = (bg, escura) => (contraste(bg, escura) >= contraste(bg, "#ffffff") ? escura : "#ffffff");

export function coresDe(marca = {}) {
  return { ...CORES_PADRAO, ...(marca.cores || {}) };
}

// Gera os 4 temas a partir das 4 cores da marca
export function temasDaMarca(marca) {
  const { escura, clara, primaria, secundaria } = coresDe(marca);
  const solido = (bg, outra) => {
    const t = sobre(bg, escura);
    const inv = t === "#ffffff" ? escura : "#ffffff";
    return {
      bg, txt: t, mut: mix(t, bg, 0.3), card: mix(bg, "#ffffff", 0.35), kick: t, acc2: t, hl: outra,
      num: t, numtxt: inv, c1: mix(bg, "#ffffff", 0.15), c2: mix(bg, escura, 0.08), dbg: t, dtxt: inv, user: t,
      tmb: t, tmt: inv, tvb: inv, tvt: t, h1b: t, h1t: inv, h2b: inv, h2t: t, hlTxt: sobre(outra, escura),
    };
  };
  return {
    escuro: {
      bg: escura, txt: "#ffffff", mut: mix("#ffffff", escura, 0.25), card: mix(escura, "#ffffff", 0.1), kick: primaria, acc2: secundaria, hl: "",
      num: primaria, numtxt: sobre(primaria, escura), c1: mix(escura, primaria, 0.15), c2: mix(escura, secundaria, 0.1),
      dbg: secundaria, dtxt: sobre(secundaria, escura), user: primaria,
      tmb: secundaria, tmt: sobre(secundaria, escura), tvb: primaria, tvt: sobre(primaria, escura),
      h1b: primaria, h1t: sobre(primaria, escura), h2b: secundaria, h2t: sobre(secundaria, escura),
    },
    claro: {
      bg: clara, txt: escura, mut: mix(escura, clara, 0.3), card: mix(clara, primaria, 0.16), kick: mix(primaria, escura, 0.35), acc2: mix(secundaria, escura, 0.3), hl: "",
      num: escura, numtxt: "#ffffff", c1: mix(clara, primaria, 0.2), c2: mix(clara, secundaria, 0.2),
      dbg: escura, dtxt: "#ffffff", user: mix(primaria, escura, 0.35),
      tmb: secundaria, tmt: sobre(secundaria, escura), tvb: primaria, tvt: sobre(primaria, escura),
      h1b: primaria, h1t: sobre(primaria, escura), h2b: secundaria, h2t: sobre(secundaria, escura),
    },
    primaria: solido(primaria, secundaria),
    secundaria: solido(secundaria, primaria),
  };
}

function icone(marca) {
  if (marca.logoSrc) return `<img class="logo" src="${esc(marca.logoSrc)}" alt="">`;
  const faixa = faixaDe(marca);
  const h = 56 / faixa.length;
  return `<svg width="56" height="56" viewBox="0 0 56 56"><defs><clipPath id="c"><rect width="56" height="56" rx="14"/></clipPath></defs><g clip-path="url(#c)">${faixa
    .map((c, i) => `<rect y="${(i * h).toFixed(2)}" width="56" height="${(h + 0.5).toFixed(2)}" fill="${esc(c)}"/>`)
    .join("")}</g></svg>`;
}
const faixaDe = (marca) => {
  const f = Array.isArray(marca.faixa) && marca.faixa.length ? marca.faixa : null;
  const c = coresDe(marca);
  return f || [c.primaria, c.secundaria];
};

// p: o post. marca: empresa.marca (+ logoSrc). fontCss: @font-face/@import com a fonte.
export function postHtml(p, marca = {}, fontCss = "") {
  const linhas = p.titulo || [];
  const titulo = linhas
    .map((l, i) => `<span class="${i === linhas.length - 1 && linhas.length > 1 ? "rosa" : ""}">${esc(l)}</span>`)
    .join("<br>");

  const temas = temasDaMarca(marca);
  const T = temas[p.tema] || temas.escuro;
  const tipo = TIPOS[p.tipo] ? p.tipo : "passos";
  const itens = p.itens || [];
  const centrado = tipo === "capa" || tipo === "citacao";
  const fonte = (marca.fonte || "Inter").replace(/['";]/g, "");
  const faixa = faixaDe(marca);

  let corpo = "";
  if (tipo === "passos") {
    corpo = itens
      .map((it, i) => `<div class="passo"><div class="num">${i + 1}</div><div><div class="pt">${esc(it.titulo)}</div>${it.texto ? `<div class="ps">${esc(it.texto)}</div>` : ""}</div></div>`)
      .join("");
  } else if (tipo === "checklist" || tipo === "lista") {
    corpo = itens
      .map((it) => `<div class="pilula">${tipo === "checklist" ? '<span class="box">✓</span>' : `<span class="emoji">${esc(it.emoji || "")}</span>`}<div><div class="lt">${esc(it.titulo)}</div>${it.texto ? `<div class="ls">${esc(it.texto)}</div>` : ""}</div></div>`)
      .join("");
  } else if (tipo === "mito") {
    corpo = itens
      .map((it) => `<div class="mv"><div class="mvl"><span class="tag m">MITO</span><span class="mvt">${esc(it.titulo)}</span></div>${it.texto ? `<div class="mvl"><span class="tag v">VERDADE</span><span class="mvt2">${esc(it.texto)}</span></div>` : ""}</div>`)
      .join("");
  } else if (tipo === "comparativo") {
    corpo = `<div class="cols">${itens
      .slice(0, 2)
      .map((it, k) => {
        const ls = String(it.texto || "").split("|").map((x) => x.trim()).filter(Boolean);
        return `<div class="col"><div class="ch h${k + 1}">${it.emoji ? esc(it.emoji) + " " : ""}${esc(it.titulo)}</div><div class="cb">${ls.map((l) => `<div>${esc(l)}</div>`).join("")}</div></div>`;
      })
      .join("")}</div>`;
  }
  const tituloHtml = tipo === "citacao" ? esc(linhas.join(" ")) : titulo;
  const tamPadrao = tipo === "capa" ? 118 : tipo === "citacao" ? 68 : 84;
  const destaque = p.destaque && (p.destaque.forte || p.destaque.texto)
    ? `<div class="destaque"><b>${esc(p.destaque.forte || "")}</b>${p.destaque.texto ? `<span>${esc(p.destaque.texto)}</span>` : ""}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:${T.bg};font-family:'${fonte}','Inter',system-ui,sans-serif;color:${T.txt};position:relative;overflow:hidden}
.faixa{position:absolute;top:0;left:0;width:1080px;height:14px;display:flex;z-index:5}
.faixa i{flex:1}
.c1{position:absolute;right:-400px;top:-320px;width:800px;height:800px;border-radius:50%;background:${T.c1};opacity:.7}
.c2{position:absolute;left:-300px;bottom:-420px;width:660px;height:660px;border-radius:50%;background:${T.c2};opacity:.8}
.wrap{position:absolute;inset:0;padding:108px 80px 0 80px;${centrado ? "padding-bottom:230px;display:flex;flex-direction:column;justify-content:center;" : ""}}
.kicker{font-size:34px;font-weight:800;letter-spacing:.22em;color:${T.kick};text-transform:uppercase;margin-bottom:14px}
h1{font-size:${Number(p.tamanhoTitulo) || tamPadrao}px;line-height:${tipo === "citacao" ? 1.16 : 1.06};font-weight:900;letter-spacing:-.02em}
h1 .rosa{color:${T.acc2};${T.hl ? `background:${T.hl};color:${T.hlTxt || T.txt};padding:0 .16em;border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone;` : ""}}
.aspas{font-size:300px;line-height:.6;font-weight:900;color:${T.hl || T.kick};height:150px;margin-left:-8px}
.sub{margin-top:22px;font-size:${tipo === "capa" ? 44 : 36}px;line-height:1.25;font-weight:700;color:${tipo === "citacao" ? T.kick : T.txt}}
.corpo{margin-top:${tipo === "passos" ? 52 : 46}px;display:flex;flex-direction:column;gap:${tipo === "passos" ? 36 : tipo === "mito" ? 22 : 18}px}
.passo{display:flex;gap:28px;align-items:flex-start}
.num{flex:none;width:80px;height:80px;border-radius:50%;background:${T.num};color:${T.numtxt};font-size:44px;font-weight:900;display:flex;align-items:center;justify-content:center}
.pt{font-size:40px;font-weight:800;line-height:1.15}
.ps{font-size:30px;font-weight:500;color:${T.mut};margin-top:6px;line-height:1.25}
.pilula{display:flex;gap:22px;align-items:center;background:${T.card};border-radius:22px;padding:22px 30px}
.emoji{font-size:40px;flex:none}
.box{flex:none;width:58px;height:58px;border-radius:15px;background:${T.num};color:${T.numtxt};font-size:40px;font-weight:900;display:flex;align-items:center;justify-content:center}
.lt{font-size:36px;font-weight:700;line-height:1.2}
.ls{font-size:28px;font-weight:500;color:${T.mut};margin-top:4px;line-height:1.25}
.mv{background:${T.card};border-radius:24px;padding:22px 28px;display:flex;flex-direction:column;gap:14px}
.mvl{display:flex;gap:18px;align-items:flex-start}
.tag{flex:none;min-width:150px;text-align:center;font-size:24px;font-weight:900;letter-spacing:.08em;border-radius:12px;padding:8px 14px;margin-top:3px}
.tag.m{background:${T.tmb};color:${T.tmt}}.tag.v{background:${T.tvb};color:${T.tvt}}
.mvt{font-size:34px;font-weight:800;line-height:1.2}
.mvt2{font-size:30px;font-weight:600;line-height:1.25;color:${T.mut}}
.cols{display:flex;gap:24px;align-items:stretch}
.col{flex:1;background:${T.card};border-radius:26px;overflow:hidden}
.ch{padding:22px 24px;font-size:36px;font-weight:900;line-height:1.15}
.ch.h1{background:${T.h1b};color:${T.h1t}}.ch.h2{background:${T.h2b};color:${T.h2t}}
.cb{padding:22px 24px;display:flex;flex-direction:column;gap:18px}
.cb div{font-size:30px;font-weight:600;line-height:1.25}
.destaque{position:absolute;left:80px;right:80px;bottom:200px;background:${T.dbg};color:${T.dtxt};border-radius:26px;padding:28px 36px}
.destaque b{display:block;font-size:38px;font-weight:900;line-height:1.2}
.destaque span{display:block;font-size:29px;font-weight:700;margin-top:8px;line-height:1.25}
.rodape{position:absolute;left:80px;bottom:56px;display:flex;align-items:center;gap:22px}
.rodape .logo{width:56px;height:56px;border-radius:14px;object-fit:cover}
.rodape .n{font-size:30px;font-weight:800}
.rodape .u{font-size:28px;font-weight:600;color:${T.user};margin-top:2px}
</style></head><body>
<div class="faixa">${faixa.map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</div><div class="c1"></div><div class="c2"></div>
<div class="wrap"><div class="inner">
  ${p.kicker ? `<div class="kicker">${esc(p.kicker)}</div>` : ""}
  ${tipo === "citacao" ? '<div class="aspas">“</div>' : ""}
  <h1>${tituloHtml}</h1>
  ${p.subtitulo ? `<div class="sub">${esc(p.subtitulo)}</div>` : ""}
  ${corpo ? `<div class="corpo">${corpo}</div>` : ""}
</div></div>
${destaque}
<div class="rodape">${icone(marca)}<div><div class="n">${esc(marca.nome || "")}</div><div class="u">${esc(marca.rodape || "")}</div></div></div>
<script>
// encolhe o conteúdo até caber acima da caixa de destaque / rodapé
window.__fitDone = (async () => {
  try { await document.fonts.ready; } catch (e) {}
  const inner = document.querySelector(".inner");
  const alvo = document.querySelector(".destaque") || document.querySelector(".rodape");
  const limite = alvo.getBoundingClientRect().top - 24;
  let z = 1;
  inner.style.zoom = z;
  while (inner.getBoundingClientRect().bottom > limite && z > 0.6) {
    z = Math.round((z - 0.02) * 100) / 100;
    inner.style.zoom = z;
  }
  return z;
})();
</script>
</body></html>`;
}
