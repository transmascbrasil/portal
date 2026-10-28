// Publica no Instagram o próximo post com "aprovado": true e "postado": false.
// Variáveis de ambiente (GitHub Secrets):
//   IG_USER_ID       id da conta profissional do Instagram
//   IG_ACCESS_TOKEN  token de longa duração
//   IMAGE_BASE_URL   URL pública da pasta out/ (ex.: https://raw.githubusercontent.com/USUARIO/REPO/main/insta-bot/out)
//   IG_API_HOST      opcional: graph.facebook.com (padrão) ou graph.instagram.com (login do Instagram, sem Página)
//   DRY_RUN=1        só mostra o que faria
import { readFileSync, writeFileSync } from "node:fs";

const { IG_USER_ID, IG_ACCESS_TOKEN, IMAGE_BASE_URL, DRY_RUN } = process.env;
const HOST = process.env.IG_API_HOST || "graph.facebook.com";
const V = process.env.IG_API_VERSION || "v26.0";

// Teste de conexão (só no modo DRY_RUN): confirma que o token e o ID funcionam,
// sem mostrar o token nos logs.
if (DRY_RUN && IG_USER_ID && IG_ACCESS_TOKEN) {
  const r = await fetch(
    `https://${HOST}/${V}/${IG_USER_ID}?fields=username&access_token=${IG_ACCESS_TOKEN}`
  );
  const j = await r.json();
  if (j.error) console.log("CONEXÃO FALHOU:", j.error.message);
  else if (j.username) console.log("CONEXÃO OK. Conta do Instagram:", j.username);
  else
    console.log(
      "ATENÇÃO: o ID respondeu, mas SEM nome de usuário do Instagram. " +
        "Provavelmente IG_USER_ID é o ID da Página do Facebook, e não o de instagram_business_account."
    );
}

const config = JSON.parse(readFileSync("posts.json", "utf8"));
const post = config.posts.find((p) => p.aprovado && !p.postado);

if (!post) {
  console.log("Fila vazia: nenhum post aprovado e pendente. Nada a publicar.");
  process.exit(0);
}

const imageUrl = `${IMAGE_BASE_URL}/${post.id}.jpg`;
console.log("Próximo post:", post.id, imageUrl);
if (DRY_RUN) {
  console.log("DRY_RUN: não publicado.\n" + post.legenda);
  process.exit(0);
}
for (const [k, v] of Object.entries({ IG_USER_ID, IG_ACCESS_TOKEN, IMAGE_BASE_URL })) {
  if (!v) throw new Error(`Falta a variável ${k}`);
}

async function api(path, params) {
  const res = await fetch(`https://${HOST}/${V}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: IG_ACCESS_TOKEN }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`Erro da API (${path}): ${JSON.stringify(json)}`);
  return json;
}

// 1) cria o container de mídia
const { id: creationId } = await api(`${IG_USER_ID}/media`, {
  image_url: imageUrl,
  caption: post.legenda,
});

// 2) espera o processamento terminar
for (let i = 0; i < 12; i++) {
  const r = await fetch(
    `https://${HOST}/${V}/${creationId}?fields=status_code&access_token=${IG_ACCESS_TOKEN}`
  );
  const { status_code } = await r.json();
  if (status_code === "FINISHED") break;
  if (status_code === "ERROR") throw new Error("O Instagram rejeitou a imagem (status ERROR).");
  await new Promise((r) => setTimeout(r, 5000));
}

// 3) publica
const { id: mediaId } = await api(`${IG_USER_ID}/media_publish`, { creation_id: creationId });
console.log("Publicado! media id:", mediaId);

// 4) marca como postado (o workflow faz o commit)
post.postado = true;
post.publicadoEm = new Date().toISOString();
writeFileSync("posts.json", JSON.stringify(config, null, 2) + "\n");
