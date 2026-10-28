# Automação de posts do Instagram (@transmascbrasil)

Gera a imagem de cada post (1080x1350, identidade do portal) a partir do `posts.json` e publica sozinho no Instagram, em dias e horários fixos, usando o GitHub Actions.

## Como funciona
1. Você escreve/revisa os posts no `posts.json` e troca `"aprovado": false` por `true`.
2. Nos dias agendados, o workflow gera as imagens, sobe para o repositório (URL pública) e publica o **primeiro post aprovado que ainda não foi postado**.
3. O post é marcado com `"postado": true` e a fila anda. Fila vazia = nada é publicado.

Agenda padrão: terça, quinta e sábado às 12h (Brasília). Para mudar, edite o `cron` em `.github/workflows/instagram.yml` (o horário é em UTC; Brasília = UTC-3).

## Estrutura
- `posts.json`: marca, textos, legendas e status de cada post
- `render.mjs`: gera `out/<id>.jpg`
- `publish.mjs`: publica via Instagram Graph API
- `.github/workflows/instagram.yml`: agendamento
  (precisa ficar na **raiz do repositório**, em `.github/workflows/`. Este projeto assume que a pasta `insta-bot/` fica dentro do repositório do portal.)

## Tipos de post
- `"tipo": "passos"`: lista numerada (título + texto curto por passo)
- `"tipo": "lista"`: pílulas com emoji
- Campos: `kicker`, `titulo` (array de linhas; a última fica rosa), `subtitulo`, `itens`, `destaque` (caixa rosa), `legenda`

Testar localmente: `npm install && npx playwright install chromium && node render.mjs`

## Configurar a Meta (uma vez)
1. Instagram profissional (já está) e, se for pelo fluxo clássico, ligado a uma Página do Facebook.
2. Em developers.facebook.com, criar um app e adicionar o produto de API do Instagram com a permissão `instagram_content_publish`.
3. Gerar um token de longa duração (dura ~60 dias) e anotar o ID da conta do Instagram.
4. No GitHub, em *Settings → Secrets and variables → Actions*:
   - Secrets: `IG_USER_ID` e `IG_ACCESS_TOKEN`
   - Variable (opcional): `IG_API_HOST` = `graph.instagram.com` se usar o login do Instagram (sem Página); sem ela, usa `graph.facebook.com`
5. Teste: *Actions → Postar no Instagram → Run workflow* com "dry_run" ligado.

## Cuidados
- **Token vence a cada ~60 dias.** Renove antes (ponha um lembrete). Se falhar, o GitHub manda e-mail de workflow com erro.
- Nunca coloque o token no código; só em Secrets.
- Só marque `aprovado: true` depois de revisar o texto (saúde e direito exigem cuidado).
- O repositório precisa ser público para a URL das imagens funcionar sem login.
