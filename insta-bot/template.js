// Template do post (1080x1350). Usado pelo render.mjs (Node) e pelo painel (navegador).
// Não importe nada de Node aqui: este arquivo precisa rodar nos dois lugares.

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ICONE = `<svg width="56" height="56" viewBox="0 0 56 56"><defs><clipPath id="c"><rect width="56" height="56" rx="14"/></clipPath></defs><g clip-path="url(#c)"><rect width="56" height="11.2" fill="#5BCEFA"/><rect y="11.2" width="56" height="11.2" fill="#F5A9B8"/><rect y="22.4" width="56" height="11.2" fill="#fff"/><rect y="33.6" width="56" height="11.2" fill="#F5A9B8"/><rect y="44.8" width="56" height="11.2" fill="#5BCEFA"/></g></svg>`;

// fontCss: CSS com @font-face (Node) ou @import do Google Fonts (painel)
export function postHtml(p, marca, fontCss = "") {
  const linhas = p.titulo || [];
  const titulo = linhas
    .map((l, i) => `<span class="${i === linhas.length - 1 && linhas.length > 1 ? "rosa" : ""}">${esc(l)}</span>`)
    .join("<br>");

  let corpo = "";
  if (p.tipo === "passos") {
    corpo = (p.itens || [])
      .map(
        (it, i) => `<div class="passo"><div class="num">${i + 1}</div><div><div class="pt">${esc(it.titulo)}</div>${
          it.texto ? `<div class="ps">${esc(it.texto)}</div>` : ""
        }</div></div>`
      )
      .join("");
  } else {
    corpo = (p.itens || [])
      .map(
        (it) => `<div class="pilula"><span class="emoji">${esc(it.emoji || "")}</span><div><div class="lt">${esc(it.titulo)}</div>${
          it.texto ? `<div class="ls">${esc(it.texto)}</div>` : ""
        }</div></div>`
      )
      .join("");
  }

  const destaque = p.destaque && (p.destaque.forte || p.destaque.texto)
    ? `<div class="destaque"><b>${esc(p.destaque.forte || "")}</b>${p.destaque.texto ? `<span>${esc(p.destaque.texto)}</span>` : ""}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:#14254F;font-family:'Inter',sans-serif;color:#fff;position:relative;overflow:hidden}
.faixa{position:absolute;top:0;left:0;width:1080px;height:14px;display:flex;z-index:5}
.faixa i{flex:1}.faixa i:nth-child(1),.faixa i:nth-child(5){background:#5BCEFA}.faixa i:nth-child(2),.faixa i:nth-child(4){background:#F5A9B8}.faixa i:nth-child(3){background:#fff}
.c1{position:absolute;right:-400px;top:-320px;width:800px;height:800px;border-radius:50%;background:#1a3a63;opacity:.7}
.c2{position:absolute;left:-300px;bottom:-420px;width:660px;height:660px;border-radius:50%;background:#243566;opacity:.8}
.wrap{position:absolute;inset:0;padding:108px 80px 0 80px}
.kicker{font-size:34px;font-weight:800;letter-spacing:.22em;color:#5BCEFA;text-transform:uppercase;margin-bottom:14px}
h1{font-size:${Number(p.tamanhoTitulo) || 84}px;line-height:1.06;font-weight:900;letter-spacing:-.02em}
h1 .rosa{color:#F5A9B8}
.sub{margin-top:22px;font-size:36px;line-height:1.25;font-weight:700;color:#fff}
.corpo{margin-top:${p.tipo === "passos" ? 52 : 46}px;display:flex;flex-direction:column;gap:${p.tipo === "passos" ? 36 : 18}px}
.passo{display:flex;gap:28px;align-items:flex-start}
.num{flex:none;width:80px;height:80px;border-radius:50%;background:#5BCEFA;color:#14254F;font-size:44px;font-weight:900;display:flex;align-items:center;justify-content:center}
.pt{font-size:40px;font-weight:800;line-height:1.15}
.ps{font-size:30px;font-weight:500;color:#c3cdea;margin-top:6px;line-height:1.25}
.pilula{display:flex;gap:22px;align-items:center;background:#25376a;border-radius:22px;padding:22px 30px}
.emoji{font-size:40px;flex:none}
.lt{font-size:36px;font-weight:700;line-height:1.2}
.ls{font-size:28px;font-weight:500;color:#c3cdea;margin-top:4px;line-height:1.25}
.destaque{position:absolute;left:80px;right:80px;bottom:200px;background:#F5A9B8;color:#14254F;border-radius:26px;padding:28px 36px}
.destaque b{display:block;font-size:38px;font-weight:900;line-height:1.2}
.destaque span{display:block;font-size:29px;font-weight:700;margin-top:8px;line-height:1.25}
.rodape{position:absolute;left:80px;bottom:56px;display:flex;align-items:center;gap:22px}
.rodape .n{font-size:30px;font-weight:800}
.rodape .u{font-size:28px;font-weight:600;color:#5BCEFA;margin-top:2px}
</style></head><body>
<div class="faixa"><i></i><i></i><i></i><i></i><i></i></div><div class="c1"></div><div class="c2"></div>
<div class="wrap"><div class="inner">
  ${p.kicker ? `<div class="kicker">${esc(p.kicker)}</div>` : ""}
  <h1>${titulo}</h1>
  ${p.subtitulo ? `<div class="sub">${esc(p.subtitulo)}</div>` : ""}
  <div class="corpo">${corpo}</div>
</div></div>
${destaque}
<div class="rodape">${ICONE}<div><div class="n">${esc(marca.nome)}</div><div class="u">${esc(marca.rodape)}</div></div></div>
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
