import { postHtml, TIPOS, TEMAS, TIPOS_SEM_ITENS, TIPOS_COM_EMOJI, coresDe } from "/lib/template.js";

const $ = (id) => document.getElementById(id);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const STATUS_ROTULO = { rascunho: "Rascunhos", aprovado: "Aprovados", publicado: "Publicados", rejeitado: "Rejeitados" };

let slug = "";
let st = null;          // estado da empresa vinda do servidor
let aba = "rascunho";
let recemCriados = new Set();
let editando = null;    // cópia do post aberto no editor

// ---------- utilidades ----------
function toast(msg, erro = false) {
  const t = $("toast");
  t.textContent = msg; t.className = "toast on" + (erro ? " erro" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), erro ? 6000 : 3000);
}
async function api(caminho, opcoes = {}) {
  const r = await fetch(caminho, { ...opcoes, headers: { "Content-Type": "application/json", ...(opcoes.headers || {}) } });
  const tipo = r.headers.get("content-type") || "";
  const dados = tipo.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw Object.assign(new Error((dados && dados.erro) || `Erro ${r.status}`), { dados });
  return dados;
}
const rotaEmpresa = (resto = "") => `/api/e/${encodeURIComponent(slug)}${resto}`;

function fontCss(marca) {
  const familias = ["Inter:wght@500;600;700;800;900"];
  if (marca.fonte && marca.fonte !== "Inter") familias.push(`${encodeURIComponent(marca.fonte)}:wght@500;600;700;800;900`);
  return `@import url('https://fonts.googleapis.com/css2?${familias.map((f) => "family=" + f).join("&")}&display=swap');`;
}
// iframe com o post em tamanho real, reduzido para caber no quadro
function quadro(el, post, marca) {
  el.innerHTML = "";
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", "allow-scripts");
  f.setAttribute("loading", "lazy");
  f.setAttribute("tabindex", "-1");
  f.setAttribute("aria-hidden", "true");
  f.srcdoc = postHtml(post, marca, fontCss(marca));
  el.appendChild(f);
  if (el.clientWidth) f.style.transform = `scale(${el.clientWidth / 1080})`;
  escalar.observe(el);
}
const escalar = new ResizeObserver((entradas) => {
  for (const e of entradas) {
    const f = e.target.querySelector("iframe");
    if (f) f.style.transform = `scale(${e.contentRect.width / 1080})`;
  }
});
const fmtData = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + (iso.includes("T") ? " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
};

// ---------- carregamento ----------
async function iniciar() {
  try {
    const empresas = await api("/api/empresas");
    if (!empresas.length) {
      $("erroGeral").hidden = false;
      $("erroGeral").textContent = 'Nenhuma empresa cadastrada. No terminal, rode: node nova-empresa.mjs minha-empresa "Minha Empresa"';
      return;
    }
    const salvo = (() => { try { return localStorage.getItem("estudio:empresa"); } catch (e) { return null; } })();
    slug = empresas.some((e) => e.slug === salvo) ? salvo : empresas[0].slug;
    $("empresa").innerHTML = empresas.map((e) => `<option value="${esc(e.slug)}">${esc(e.nome)}</option>`).join("");
    $("empresa").value = slug;
    await recarregar();
  } catch (e) {
    $("erroGeral").hidden = false;
    $("erroGeral").textContent = "Não consegui falar com o servidor: " + e.message;
  }
}
async function recarregar() {
  st = await api(rotaEmpresa());
  $("qtd").value = (st.empresa.geracao && st.empresa.geracao.quantidadePadrao) || 3;
  render();
}
$("empresa").onchange = async (e) => {
  slug = e.target.value;
  try { localStorage.setItem("estudio:empresa", slug); } catch (er) {}
  recemCriados = new Set(); $("log").hidden = true;
  await recarregar();
};

// ---------- gerar ----------
$("btnGerar").onclick = async () => {
  const b = $("btnGerar");
  b.disabled = true; b.textContent = "Gerando…";
  try {
    const r = await api(rotaEmpresa("/gerar"), { method: "POST", body: JSON.stringify({ quantidade: Number($("qtd").value) || undefined }) });
    st = r.estado;
    recemCriados = new Set(r.criados || []);
    mostrarLog(r);
    aba = "rascunho";
    render();
    toast(r.criados && r.criados.length ? `${r.criados.length} rascunho(s) criado(s).` : (r.avisos && r.avisos[0]) || "Nenhum rascunho criado.", !(r.criados && r.criados.length));
  } catch (e) {
    if (e.dados) mostrarLog(e.dados);
    toast("O script falhou: " + e.message, true);
  } finally {
    b.disabled = false; b.textContent = "⚡ Gerar rascunhos";
  }
};
function mostrarLog(r) {
  $("log").hidden = false;
  $("logTxt").textContent = `$ node ${r.script || "scripts/gerar-rascunhos.mjs"} --empresa ${slug}\n${r.saida || r.erro || ""}`;
}

// ---------- render ----------
function render() {
  const m = st.empresa.marca || {};
  $("nomeEmpresa").textContent = m.nome || slug;
  for (const s of Object.keys(STATUS_ROTULO)) $("n-" + s).textContent = st.posts.filter((p) => (p.status || "rascunho") === s).length;
  for (const b of $("abas").querySelectorAll("button")) b.setAttribute("aria-current", String(b.dataset.aba === aba));
  $("vPosts").hidden = !STATUS_ROTULO[aba];
  $("vBanco").hidden = aba !== "banco";
  $("vMarca").hidden = aba !== "marca";
  renderResumo();
  if (STATUS_ROTULO[aba]) renderPosts();
  if (aba === "banco") renderBanco();
  if (aba === "marca") renderMarca();
}
$("abas").onclick = (e) => {
  const b = e.target.closest("button[data-aba]");
  if (b) { aba = b.dataset.aba; render(); }
};

function renderResumo() {
  const b = st.banco;
  const livres = b.pautas.livres + b.frases.livres + b.datas.proximas.length;
  const partes = [
    `<span class="${livres < 3 ? "alerta" : ""}">Banco: ${b.pautas.livres} de ${b.pautas.total} pautas livres · ${b.frases.livres} frases</span>`,
    ...b.datas.proximas.map((d) => `<span class="alerta">📅 ${esc(d.quando.split("-").reverse().join("/"))}: ${esc(d.titulo)}</span>`),
  ];
  if (!livres) partes.push(`<span class="alerta">O banco acabou: adicione conteúdo em "Banco de conteúdo".</span>`);
  $("resumo").innerHTML = partes.join("");
}

function renderPosts() {
  const lista = st.posts.filter((p) => (p.status || "rascunho") === aba);
  const g = $("grade");
  g.innerHTML = "";
  $("vazio").hidden = !!lista.length;
  if (!lista.length) {
    $("vazio").innerHTML = aba === "rascunho"
      ? `Nenhum rascunho. Clique em <b>⚡ Gerar rascunhos</b> para o script criar posts a partir do banco de conteúdo.`
      : `Nada em ${STATUS_ROTULO[aba].toLowerCase()} ainda.`;
    return;
  }
  for (const p of lista) {
    const c = document.createElement("article");
    c.className = "card" + (recemCriados.has(p.id) ? " novo" : "");
    c.innerHTML = `<div class="quadro" title="Abrir editor"></div>
      <div class="card-info">
        <h3>${esc((p.titulo || []).join(" ") || "(sem título)")}</h3>
        <div class="chips">
          <span class="chip">${esc(TIPOS[p.tipo] || p.tipo)}</span>
          <span class="chip">${esc(TEMAS[p.tema] || "Escuro")}</span>
          ${p.agendarPara ? `<span class="chip data">📅 ${esc(fmtData(p.agendarPara))}</span>` : ""}
          ${p.publicadoEm ? `<span class="chip">publicado ${esc(fmtData(p.publicadoEm))}</span>` : ""}
          <span class="chip">${esc(p.id)}</span>
        </div>
      </div>
      <div class="card-acoes"></div>`;
    quadro(c.querySelector(".quadro"), p, st.marca);
    c.querySelector(".quadro").onclick = () => abrirEditor(p.id);
    const acoes = c.querySelector(".card-acoes");
    const botao = (txt, cls, fn) => { const b = document.createElement("button"); b.className = "btn peq " + cls; b.textContent = txt; b.onclick = fn; acoes.appendChild(b); };
    if (aba === "rascunho") { botao("✓ Aprovar", "ok", () => mudarStatus(p.id, "aprovado")); botao("Rejeitar", "", () => mudarStatus(p.id, "rejeitado")); }
    if (aba === "aprovado") { botao("Marcar publicado", "ok", () => mudarStatus(p.id, "publicado")); botao("Voltar p/ rascunho", "", () => mudarStatus(p.id, "rascunho")); }
    if (aba === "rejeitado" || aba === "publicado") botao("Voltar p/ rascunho", "", () => mudarStatus(p.id, "rascunho"));
    botao("Editar", "", () => abrirEditor(p.id));
    botao("⬇ JPG", "", () => baixarJpg(p.id));
    botao("Copiar legenda", "", () => copiar(p.legenda || ""));
    if (aba !== "publicado") botao("Excluir", "perigo", () => excluir(p.id));
    g.appendChild(c);
  }
}

async function mudarStatus(id, status) {
  try { st = await api(rotaEmpresa(`/posts/${id}/status`), { method: "POST", body: JSON.stringify({ status }) }); render(); toast(`Movido para ${STATUS_ROTULO[status].toLowerCase()}.`); }
  catch (e) { toast(e.message, true); }
}
async function excluir(id) {
  if (!confirm(`Excluir o post ${id}? A pauta dele não volta para o banco.`)) return;
  try { st = await api(rotaEmpresa(`/posts/${id}`), { method: "DELETE" }); render(); toast("Post excluído."); }
  catch (e) { toast(e.message, true); }
}
async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); toast("Legenda copiada."); }
  catch (e) { toast("Não consegui copiar. Abra o editor e copie a legenda de lá.", true); }
}
async function baixarJpg(id) {
  toast("Gerando a imagem…");
  try {
    const r = await fetch(rotaEmpresa(`/posts/${id}.jpg`));
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `Erro ${r.status}`);
    const url = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: `${slug}-${id}.jpg` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast("Imagem baixada.");
  } catch (e) { toast(e.message, true); }
}

// ---------- editor ----------
$("eTipo").innerHTML = Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
$("eTema").innerHTML = Object.entries(TEMAS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
const F = $("fPost");

function abrirEditor(id) {
  const p = st.posts.find((x) => x.id === id);
  if (!p) return;
  editando = JSON.parse(JSON.stringify(p));
  F.tipo.value = TIPOS[p.tipo] ? p.tipo : "passos";
  F.tema.value = TEMAS[p.tema] ? p.tema : "escuro";
  F.kicker.value = p.kicker || "";
  F.titulo.value = (p.titulo || []).join("\n");
  F.subtitulo.value = p.subtitulo || "";
  F.tamanhoTitulo.value = p.tamanhoTitulo || "";
  F.dForte.value = (p.destaque && p.destaque.forte) || "";
  F.dTexto.value = (p.destaque && p.destaque.texto) || "";
  F.legenda.value = p.legenda || "";
  F.agendarPara.value = p.agendarPara ? String(p.agendarPara).slice(0, 16) : "";
  $("dlgTitulo").textContent = `Editar ${p.id}`;
  $("dlgInfo").textContent = p.fonte ? `Origem: ${p.fonte}` : "";
  desenharItens();
  $("dlg").showModal();
  prever();
}
function lerForm() {
  const p = { ...editando };
  p.tipo = F.tipo.value; p.tema = F.tema.value;
  p.kicker = F.kicker.value.trim();
  p.titulo = F.titulo.value.split("\n").map((l) => l.trim()).filter(Boolean);
  p.subtitulo = F.subtitulo.value.trim();
  p.tamanhoTitulo = Number(F.tamanhoTitulo.value) || undefined;
  p.destaque = F.dForte.value.trim() || F.dTexto.value.trim() ? { forte: F.dForte.value.trim(), texto: F.dTexto.value.trim() } : undefined;
  p.legenda = F.legenda.value;
  p.agendarPara = F.agendarPara.value || undefined;
  p.itens = [...$("eItens").querySelectorAll(".item")].map((row) => {
    const it = {};
    for (const inp of row.querySelectorAll("input")) if (inp.value.trim()) it[inp.dataset.campo] = inp.value.trim();
    return it;
  }).filter((it) => it.titulo || it.texto);
  for (const k of Object.keys(p)) if (p[k] === undefined || p[k] === "") delete p[k];
  return p;
}
function desenharItens() {
  const tipo = F.tipo.value;
  $("eItensBox").hidden = TIPOS_SEM_ITENS.includes(tipo);
  const comEmoji = TIPOS_COM_EMOJI.includes(tipo);
  $("eItensDica").textContent = {
    mito: "Título = o mito · Texto = a verdade",
    comparativo: "2 colunas · no texto, separe as linhas com |",
    checklist: "Texto é opcional",
  }[tipo] || "";
  const box = $("eItens");
  box.innerHTML = "";
  for (const it of editando.itens || []) box.appendChild(linhaItem(it, comEmoji));
}
function linhaItem(it = {}, comEmoji) {
  const row = document.createElement("div");
  row.className = "item" + (comEmoji ? "" : " sem-emoji");
  row.innerHTML = `${comEmoji ? `<input data-campo="emoji" placeholder="😀" aria-label="Emoji">` : ""}
    <input data-campo="titulo" placeholder="Título" aria-label="Título">
    <input data-campo="texto" placeholder="Texto (opcional)" aria-label="Texto">
    <div class="mini"><button type="button" class="btn peq fantasma" data-m="-1" aria-label="Subir">↑</button><button type="button" class="btn peq fantasma" data-m="1" aria-label="Descer">↓</button><button type="button" class="btn peq fantasma" data-x aria-label="Remover">✕</button></div>`;
  for (const inp of row.querySelectorAll("input")) inp.value = it[inp.dataset.campo] || "";
  row.querySelector("[data-x]").onclick = () => { row.remove(); prever(); };
  for (const b of row.querySelectorAll("[data-m]")) b.onclick = () => {
    const alvo = b.dataset.m < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (alvo) b.dataset.m < 0 ? alvo.before(row) : alvo.after(row);
    prever();
  };
  return row;
}
$("eAddItem").onclick = () => { $("eItens").appendChild(linhaItem({}, TIPOS_COM_EMOJI.includes(F.tipo.value))); };
let tPrev;
function prever() { clearTimeout(tPrev); tPrev = setTimeout(() => quadro($("ePrevia"), lerForm(), st.marca), 150); }
F.addEventListener("input", prever);
F.tipo.addEventListener("change", () => { editando.itens = lerForm().itens; desenharItens(); prever(); });
$("dlgFechar").onclick = $("dlgCancelar").onclick = () => $("dlg").close();
$("dlgSalvar").onclick = async () => {
  try {
    st = await api(rotaEmpresa(`/posts/${editando.id}`), { method: "PUT", body: JSON.stringify(lerForm()) });
    $("dlg").close(); render(); toast("Post salvo.");
  } catch (e) { toast(e.message, true); }
};

// ---------- banco ----------
let bancoCarregadoDe = "";
async function renderBanco() {
  if (bancoCarregadoDe === slug) return;
  try {
    const b = await api(rotaEmpresa("/banco"));
    $("bancoTxt").value = JSON.stringify(b, null, 2);
    bancoCarregadoDe = slug;
    $("bancoErro").hidden = true;
  } catch (e) { toast(e.message, true); }
}
$("empresa").addEventListener("change", () => { bancoCarregadoDe = ""; });
function editarBanco(fn) {
  let b;
  try { b = JSON.parse($("bancoTxt").value); } catch (e) { return mostrarErroBanco(e); }
  fn(b);
  $("bancoTxt").value = JSON.stringify(b, null, 2);
  toast("Adicionado no fim da lista. Edite os textos e clique em Salvar banco.");
}
function mostrarErroBanco(e) { $("bancoErro").hidden = false; $("bancoErro").textContent = "JSON inválido: " + e.message; }
$("bancoAddPauta").onclick = () => editarBanco((b) => (b.pautas = b.pautas || []).push({
  id: "pauta-" + Date.now().toString(36), tipo: "lista", kicker: "Chamada", titulo: ["Título do post", "segunda linha"],
  itens: [{ emoji: "✨", titulo: "Primeiro item", texto: "Detalhe" }, { emoji: "💡", titulo: "Segundo item", texto: "Detalhe" }],
}));
$("bancoAddFrase").onclick = () => editarBanco((b) => (b.frases = b.frases || []).push({ id: "frase-" + Date.now().toString(36), texto: "Sua frase aqui.", autor: "{marca}" }));
$("bancoAddData").onclick = () => editarBanco((b) => (b.datas = b.datas || []).push({ id: "data-" + Date.now().toString(36), data: "12-31", tipo: "capa", kicker: "Data", titulo: ["Título da", "data comemorativa"], subtitulo: "" }));
$("bancoSalvar").onclick = async () => {
  let b;
  try { b = JSON.parse($("bancoTxt").value); } catch (e) { return mostrarErroBanco(e); }
  try {
    st = await api(rotaEmpresa("/banco"), { method: "PUT", body: JSON.stringify(b) });
    $("bancoErro").hidden = true; renderResumo(); toast("Banco salvo.");
  } catch (e) { $("bancoErro").hidden = false; $("bancoErro").textContent = e.message; }
};

// ---------- marca ----------
const M = $("fMarca");
const AMOSTRA = {
  tipo: "lista", kicker: "Exemplo", titulo: ["Assim fica", "o seu post"],
  itens: [{ emoji: "🎨", titulo: "Cores da marca", texto: "Escura, clara, primária e secundária" }, { emoji: "🔤", titulo: "Fonte e logo", texto: "Mudam em todos os templates" }],
  destaque: { forte: "Caixa de destaque", texto: "Link na bio" },
};
function renderMarca() {
  const e = st.empresa, m = e.marca || {}, c = coresDe(m), g = e.geracao || {};
  for (const k of ["nome", "rodape", "site", "fonte", "logo"]) M[k].value = m[k] || "";
  for (const k of ["escura", "clara", "primaria", "secundaria"]) M[k].value = c[k];
  M.faixa.value = (m.faixa || []).join(", ");
  M.quantidadePadrao.value = g.quantidadePadrao || 3;
  M.diasAntecedencia.value = g.diasAntecedencia ?? 14;
  M.frasesACada.value = g.frasesACada ?? 4;
  M.hora.value = g.hora || "12:00";
  M.reciclar.checked = !!g.reciclar;
  M.variaveis.value = Object.entries(e.variaveis || {}).map(([k, v]) => `${k} = ${v}`).join("\n");
  previaMarca();
}
function marcaDoForm() {
  const m = { ...st.empresa.marca };
  for (const k of ["nome", "rodape", "site", "fonte", "logo"]) m[k] = M[k].value.trim();
  m.cores = { escura: M.escura.value, clara: M.clara.value, primaria: M.primaria.value, secundaria: M.secundaria.value };
  m.faixa = M.faixa.value.split(",").map((s) => s.trim()).filter((s) => /^#[0-9a-f]{3,6}$/i.test(s));
  return m;
}
function previaMarca() {
  const m = marcaDoForm();
  // logo local só aparece depois de salvar (o servidor converte o arquivo)
  m.logoSrc = /^(https?:|data:)/.test(m.logo) ? m.logo : m.logo === st.empresa.marca.logo ? st.marca.logoSrc : undefined;
  const box = $("previaTemas");
  box.innerHTML = "";
  for (const t of Object.keys(TEMAS)) {
    const q = document.createElement("div");
    q.className = "quadro"; q.title = TEMAS[t];
    box.appendChild(q);
    quadro(q, { ...AMOSTRA, tema: t }, m);
  }
}
let tMarca;
M.addEventListener("input", () => { clearTimeout(tMarca); tMarca = setTimeout(previaMarca, 250); });
M.onsubmit = async (ev) => {
  ev.preventDefault();
  const e = JSON.parse(JSON.stringify(st.empresa));
  e.marca = marcaDoForm();
  e.geracao = {
    ...(e.geracao || {}),
    quantidadePadrao: Number(M.quantidadePadrao.value) || 3,
    diasAntecedencia: Number(M.diasAntecedencia.value) || 0,
    frasesACada: Number(M.frasesACada.value) || 0,
    hora: M.hora.value || "12:00",
    reciclar: M.reciclar.checked,
  };
  e.variaveis = Object.fromEntries(M.variaveis.value.split("\n").map((l) => l.split("=")).filter((p) => p.length >= 2 && p[0].trim()).map(([k, ...v]) => [k.trim(), v.join("=").trim()]));
  try {
    st = await api(rotaEmpresa("/empresa"), { method: "PUT", body: JSON.stringify(e) });
    render(); toast("Marca salva. Os posts já usam as cores novas.");
  } catch (er) { toast(er.message, true); }
};

iniciar();
