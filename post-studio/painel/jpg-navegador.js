// Gera o JPG 1080x1350 aqui no navegador (sem servidor), com a biblioteca html-to-image.
import { postHtml } from "../lib/template.js";

const LIB = "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js";
let carregando = null;
function carregarLib() {
  if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
  carregando = carregando || new Promise((ok, falha) => {
    const s = Object.assign(document.createElement("script"), { src: LIB, crossOrigin: "anonymous" });
    s.onload = () => ok(window.htmlToImage);
    s.onerror = () => { carregando = null; falha(new Error("Não consegui carregar o gerador de imagem. Confira a internet e tente de novo.")); };
    document.head.appendChild(s);
  });
  return carregando;
}

export async function jpgNoNavegador(post, marca, fontCss) {
  const lib = await carregarLib();
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;left:-20000px;top:0;width:1080px;height:1350px;border:0;";
  f.setAttribute("aria-hidden", "true");
  document.body.appendChild(f);
  try {
    await new Promise((ok) => { f.onload = ok; f.srcdoc = postHtml(post, marca, fontCss); });
    const doc = f.contentDocument;
    await f.contentWindow.__fitDone;
    try { await doc.fonts.ready; } catch (e) {}
    const url = await lib.toJpeg(doc.body, {
      width: 1080, height: 1350, pixelRatio: 1, quality: 0.92, backgroundColor: getComputedStyle(doc.body).backgroundColor,
    });
    return await (await fetch(url)).blob();
  } finally {
    f.remove();
  }
}
