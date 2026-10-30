// Template do post (1080x1350). Usado pelo render.mjs (Node) e pelo painel (navegador).
// Não importe nada de Node aqui: este arquivo precisa rodar nos dois lugares.

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ICONE = `<svg width="56" height="56" viewBox="0 0 56 56"><defs><clipPath id="c"><rect width="56" height="56" rx="14"/></clipPath></defs><g clip-path="url(#c)"><rect width="56" height="11.2" fill="#5BCEFA"/><rect y="11.2" width="56" height="11.2" fill="#F5A9B8"/><rect y="22.4" width="56" height="11.2" fill="#fff"/><rect y="33.6" width="56" height="11.2" fill="#F5A9B8"/><rect y="44.8" width="56" height="11.2" fill="#5BCEFA"/></g></svg>`;

// Temas de cor. "escuro" é o padrão (identidade do portal).
export const TEMAS = {
  escuro: { nome: "Escuro (padrão)", bg: "#14254F", txt: "#fff", mut: "#c3cdea", card: "#25376a", kick: "#5BCEFA", acc2: "#F5A9B8", hl: "", num: "#5BCEFA", numtxt: "#14254F", c1: "#1a3a63", c2: "#243566", dbg: "#F5A9B8", dtxt: "#14254F", user: "#5BCEFA", tmb: "#F5A9B8", tmt: "#14254F", tvb: "#5BCEFA", tvt: "#14254F", h1b: "#5BCEFA", h1t: "#14254F", h2b: "#F5A9B8", h2t: "#14254F" },
  claro: { nome: "Claro", bg: "#F7FAFF", txt: "#14254F", mut: "#4a5a85", card: "#E3EDFB", kick: "#1b86b8", acc2: "#D6486F", hl: "", num: "#14254F", numtxt: "#fff", c1: "#e1f1fb", c2: "#fbe3ea", dbg: "#14254F", dtxt: "#fff", user: "#1b86b8", tmb: "#F5A9B8", tmt: "#14254F", tvb: "#5BCEFA", tvt: "#14254F", h1b: "#5BCEFA", h1t: "#14254F", h2b: "#F5A9B8", h2t: "#14254F" },
  rosa: { nome: "Rosa", bg: "#F5A9B8", txt: "#14254F", mut: "#3a3057", card: "#FBD2DB", kick: "#14254F", acc2: "#14254F", hl: "#5BCEFA", num: "#14254F", numtxt: "#fff", c1: "#f8bcc8", c2: "#f29db0", dbg: "#14254F", dtxt: "#fff", user: "#14254F", tmb: "#14254F", tmt: "#fff", tvb: "#fff", tvt: "#14254F", h1b: "#14254F", h1t: "#fff", h2b: "#fff", h2t: "#14254F" },
  azul: { nome: "Azul", bg: "#5BCEFA", txt: "#14254F", mut: "#1d3a66", card: "#A8E3FB", kick: "#14254F", acc2: "#14254F", hl: "#F5A9B8", num: "#14254F", numtxt: "#fff", c1: "#74d6fb", c2: "#42c0ee", dbg: "#14254F", dtxt: "#fff", user: "#14254F", tmb: "#14254F", tmt: "#fff", tvb: "#fff", tvt: "#14254F", h1b: "#14254F", h1t: "#fff", h2b: "#fff", h2t: "#14254F" },
};
// ---------- marca (cores, faixa, fonte e logo) ----------
// Sem "cores" no posts.json -> marca.cores, os temas acima são usados como estão.
export const CORES_PADRAO = { escura: "#14254F", clara: "#F7FAFF", primaria: "#5BCEFA", secundaria: "#F5A9B8" };
export const FAIXA_PADRAO = ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"];
const rgb = (c) => {
  let h = String(c || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h, 16);
  return isNaN(n) || h.length !== 6 ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (v) => "#" + v.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (c) => {
  const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const sobre = (bg, escura) => (contraste(bg, escura) >= contraste(bg, "#ffffff") ? escura : "#ffffff");

export const coresDe = (marca) => ({ ...CORES_PADRAO, ...((marca && marca.cores) || {}) });
const coresPadrao = (marca) => { const c = coresDe(marca); return Object.keys(CORES_PADRAO).every((k) => String(c[k]).toLowerCase() === CORES_PADRAO[k].toLowerCase()); };

// Os 4 temas com as cores da marca. "azul" = cor primária e "rosa" = cor secundária.
export function temasDe(marca) {
  if (coresPadrao(marca)) return TEMAS;
  const { escura, clara, primaria, secundaria } = coresDe(marca);
  const solido = (bg, outra, nome) => {
    const t = sobre(bg, escura), inv = t === "#ffffff" ? escura : "#ffffff";
    return {
      nome, bg, txt: t, mut: mix(t, bg, 0.3), card: mix(bg, "#ffffff", 0.35), kick: t, acc2: t, hl: outra, hlTxt: sobre(outra, escura),
      num: t, numtxt: inv, c1: mix(bg, "#ffffff", 0.15), c2: mix(bg, escura, 0.08), dbg: t, dtxt: inv, user: t,
      tmb: t, tmt: inv, tvb: inv, tvt: t, h1b: t, h1t: inv, h2b: inv, h2t: t,
    };
  };
  return {
    escuro: {
      nome: "Escuro (padrão)", bg: escura, txt: "#fff", mut: mix("#ffffff", escura, 0.25), card: mix(escura, "#ffffff", 0.1), kick: primaria, acc2: secundaria, hl: "",
      num: primaria, numtxt: sobre(primaria, escura), c1: mix(escura, primaria, 0.15), c2: mix(escura, secundaria, 0.1), dbg: secundaria, dtxt: sobre(secundaria, escura), user: primaria,
      tmb: secundaria, tmt: sobre(secundaria, escura), tvb: primaria, tvt: sobre(primaria, escura), h1b: primaria, h1t: sobre(primaria, escura), h2b: secundaria, h2t: sobre(secundaria, escura),
    },
    claro: {
      nome: "Claro", bg: clara, txt: escura, mut: mix(escura, clara, 0.3), card: mix(clara, primaria, 0.16), kick: mix(primaria, escura, 0.35), acc2: mix(secundaria, escura, 0.3), hl: "",
      num: escura, numtxt: "#fff", c1: mix(clara, primaria, 0.2), c2: mix(clara, secundaria, 0.2), dbg: escura, dtxt: "#fff", user: mix(primaria, escura, 0.35),
      tmb: secundaria, tmt: sobre(secundaria, escura), tvb: primaria, tvt: sobre(primaria, escura), h1b: primaria, h1t: sobre(primaria, escura), h2b: secundaria, h2t: sobre(secundaria, escura),
    },
    rosa: solido(secundaria, primaria, "Cor secundária"),
    azul: solido(primaria, secundaria, "Cor primária"),
  };
}
const faixaDe = (marca) => (marca && Array.isArray(marca.faixa) && marca.faixa.length ? marca.faixa : coresPadrao(marca) ? FAIXA_PADRAO : [coresDe(marca).primaria, coresDe(marca).secundaria]);
function iconeDe(marca) {
  if (marca && marca.logoSrc) return `<img class="logo" src="${esc(marca.logoSrc)}" alt="">`;
  const f = faixaDe(marca);
  if (f === FAIXA_PADRAO) return ICONE;
  const h = 56 / f.length;
  return `<svg width="56" height="56" viewBox="0 0 56 56"><defs><clipPath id="c"><rect width="56" height="56" rx="14"/></clipPath></defs><g clip-path="url(#c)">${f
    .map((c, i) => `<rect y="${(i * h).toFixed(2)}" width="56" height="${(h + 0.5).toFixed(2)}" fill="${esc(c)}"/>`).join("")}</g></svg>`;
}
// CSS da fonte da marca para o painel (Google Fonts)
export function fonteCssGoogle(marca) {
  const fams = ["Inter:wght@500;600;700;800;900"];
  const f = marca && marca.fonte && marca.fonte !== "Inter" ? marca.fonte : "";
  if (f) fams.push(`${encodeURIComponent(f)}:wght@500;600;700;800;900`);
  return `@import url('https://fonts.googleapis.com/css2?${fams.map((x) => "family=" + x).join("&")}&display=swap');`;
}

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

// fontCss: CSS com @font-face (Node) ou @import do Google Fonts (painel)
export function postHtml(p, marca, fontCss = "") {
  const linhas = p.titulo || [];
  const titulo = linhas
    .map((l, i) => `<span class="${i === linhas.length - 1 && linhas.length > 1 ? "rosa" : ""}">${esc(l)}</span>`)
    .join("<br>");

  marca = marca || {};
  const temas = temasDe(marca);
  const T = temas[p.tema] || temas.escuro;
  const fonte = String(marca.fonte || "Inter").replace(/['";]/g, "");
  const faixa = faixaDe(marca);
  const tipo = TIPOS[p.tipo] ? p.tipo : "passos";
  const itens = p.itens || [];
  const centrado = tipo === "capa" || tipo === "citacao";

  let corpo = "";
  if (tipo === "passos") {
    corpo = itens
      .map(
        (it, i) => `<div class="passo"><div class="num">${i + 1}</div><div><div class="pt">${esc(it.titulo)}</div>${
          it.texto ? `<div class="ps">${esc(it.texto)}</div>` : ""
        }</div></div>`
      )
      .join("");
  } else if (tipo === "checklist") {
    corpo = itens
      .map(
        (it) => `<div class="pilula"><span class="box">✓</span><div><div class="lt">${esc(it.titulo)}</div>${
          it.texto ? `<div class="ls">${esc(it.texto)}</div>` : ""
        }</div></div>`
      )
      .join("");
  } else if (tipo === "mito") {
    corpo = itens
      .map(
        (it) => `<div class="mv"><div class="mvl"><span class="tag m">MITO</span><span class="mvt">${esc(it.titulo)}</span></div>${
          it.texto ? `<div class="mvl"><span class="tag v">VERDADE</span><span class="mvt2">${esc(it.texto)}</span></div>` : ""
        }</div>`
      )
      .join("");
  } else if (tipo === "comparativo") {
    corpo = `<div class="cols">${itens
      .slice(0, 2)
      .map((it, k) => {
        const linhas = String(it.texto || "").split("|").map((x) => x.trim()).filter(Boolean);
        return `<div class="col"><div class="ch h${k + 1}">${it.emoji ? esc(it.emoji) + " " : ""}${esc(it.titulo)}</div><div class="cb">${linhas
          .map((l) => `<div>${esc(l)}</div>`)
          .join("")}</div></div>`;
      })
      .join("")}</div>`;
  } else if (tipo === "lista") {
    corpo = itens
      .map(
        (it) => `<div class="pilula"><span class="emoji">${esc(it.emoji || "")}</span><div><div class="lt">${esc(it.titulo)}</div>${
          it.texto ? `<div class="ls">${esc(it.texto)}</div>` : ""
        }</div></div>`
      )
      .join("");
  }
  const tituloHtml = tipo === "citacao"
    ? esc(linhas.join(" "))
    : titulo;
  const tamPadrao = tipo === "capa" ? 118 : tipo === "citacao" ? 68 : 84;

  const destaque = p.destaque && (p.destaque.forte || p.destaque.texto)
    ? `<div class="destaque"><b>${esc(p.destaque.forte || "")}</b>${p.destaque.texto ? `<span>${esc(p.destaque.texto)}</span>` : ""}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:${T.bg};font-family:'${fonte}','Inter',sans-serif;color:${T.txt};position:relative;overflow:hidden}
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
<div class="rodape">${iconeDe(marca)}<div><div class="n">${esc(marca.nome)}</div><div class="u">${esc(marca.rodape)}</div></div></div>
<script>
// encolhe o conteúdo até caber acima da caixa rosa / rodapé
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
