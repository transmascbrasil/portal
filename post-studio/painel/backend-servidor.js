// Painel rodando com o server.mjs: tudo passa pela API local, e o botão "Gerar" executa o script.
async function api(caminho, opcoes = {}) {
  const r = await fetch(caminho, { ...opcoes, headers: { "Content-Type": "application/json", ...(opcoes.headers || {}) } });
  const tipo = r.headers.get("content-type") || "";
  const dados = tipo.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw Object.assign(new Error((dados && dados.erro) || `Erro ${r.status}`), { dados, status: r.status });
  return dados;
}

// Responde só se o painel foi aberto pelo server.mjs
export async function servidorDisponivel() {
  try {
    const r = await fetch("/api/empresas", { cache: "no-store" });
    return r.ok && (r.headers.get("content-type") || "").includes("json");
  } catch (e) { return false; }
}

export function criarBackendServidor() {
  const rota = (slug, resto = "") => `/api/e/${encodeURIComponent(slug)}${resto}`;
  const corpo = (dados) => ({ body: JSON.stringify(dados) });
  return {
    tipo: "servidor",
    podeGravar: () => true,
    descricao: () => "servidor local",
    listarEmpresas: () => api("/api/empresas"),
    estado: (slug) => api(rota(slug)),
    async gerar(slug, quantidade) {
      try { return await api(rota(slug, "/gerar"), { method: "POST", ...corpo({ quantidade }) }); }
      catch (e) { if (e.dados && e.dados.estado) return { ...e.dados, ok: false }; throw e; }
    },
    salvarPost: (slug, post) => api(rota(slug, `/posts/${post.id}`), { method: "PUT", ...corpo(post) }),
    status: (slug, id, status) => api(rota(slug, `/posts/${id}/status`), { method: "POST", ...corpo({ status }) }),
    excluir: (slug, id) => api(rota(slug, `/posts/${id}`), { method: "DELETE" }),
    lerBanco: (slug) => api(rota(slug, "/banco")),
    salvarBanco: (slug, banco) => api(rota(slug, "/banco"), { method: "PUT", ...corpo(banco) }),
    salvarEmpresa: (slug, empresa) => api(rota(slug, "/empresa"), { method: "PUT", ...corpo(empresa) }),
    criarEmpresa: (slug, nome, arroba) => api("/api/empresas", { method: "POST", ...corpo({ slug, nome, arroba }) }),
    // JPG feito no servidor (Playwright). Se não estiver instalado, o painel faz no navegador.
    async jpgServidor(slug, id) {
      const r = await fetch(rota(slug, `/posts/${id}.jpg`));
      if (!r.ok) throw Object.assign(new Error((await r.json().catch(() => ({}))).erro || `Erro ${r.status}`), { status: r.status });
      return r.blob();
    },
  };
}
