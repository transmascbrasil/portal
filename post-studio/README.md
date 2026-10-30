# Estúdio de Posts

Painel para gerar **rascunhos de posts do Instagram** (imagem 1080x1350 + legenda) a partir de **templates prontos** e de um **banco de conteúdo** da empresa.

- Clicou em **⚡ Gerar rascunhos** → o servidor roda o script `scripts/gerar-rascunhos.mjs` na hora → os rascunhos aparecem no painel.
- **Sem IA e sem chamada de API externa.** Tudo sai dos arquivos JSON da empresa.
- **Várias empresas** no mesmo painel: cada uma tem a sua pasta em `empresas/` com marca, cores, banco de conteúdo e posts.

## Rodar

Precisa só do Node 18+.

```bash
cd post-studio
node server.mjs
```

Abra http://localhost:3333.

Para o botão **⬇ JPG** gerar a imagem final no servidor, instale uma vez:

```bash
npm install && npx playwright install chromium
```

Sem isso, o painel funciona igual (prévia, edição, aprovação e legendas); só o download do JPG fica desligado.

## Como funciona

```
empresas/<empresa>/
  empresa.json   marca (nome, @, cores, fonte, logo), variáveis e regras de geração
  banco.json     o conteúdo: pautas, frases, datas comemorativas e modelos de legenda
  posts.json     os posts gerados (rascunho → aprovado → publicado / rejeitado)
lib/template.js  os 7 templates visuais, coloridos com as cores da marca
lib/gerador.js   as regras que transformam o banco em rascunhos
scripts/gerar-rascunhos.mjs   o script que o botão executa
server.mjs       servidor do painel (sem dependências)
painel/          a interface
```

O script escolhe o conteúdo nesta ordem:

1. **Datas comemorativas** que estão chegando (`diasAntecedencia`). Elas já vêm com a data sugerida.
2. **Frases**, uma a cada N posts (`frasesACada`), no template "Frase em destaque".
3. **Pautas** (posts prontos), na ordem do banco, evitando repetir o mesmo template em sequência.

Cada item do banco vira post **uma vez só** (o post guarda de onde veio, em `fonte`). Com `reciclar: true`, quando as pautas acabam o script volta às que foram usadas há mais tempo. Os temas de cor (escuro, claro, primária, secundária) vão se alternando.

A legenda é a do próprio item, se ele tiver. Se não tiver, o script monta uma com `legenda.modelos`, `ganchos`, `ctas` e `hashtags` (fixas + algumas rotativas) do banco.

Também dá para rodar o script pelo terminal ou num agendamento (cron, GitHub Actions…):

```bash
node scripts/gerar-rascunhos.mjs --empresa transmasc --qtd 3
```

```bash
node scripts/gerar-rascunhos.mjs --empresa transmasc --qtd 3 --teste
```

O `--teste` mostra o que seria criado sem gravar nada.

## Replicar para outra empresa

```bash
node nova-empresa.mjs padaria-sol "Padaria Sol" @padariasol
```

Isso copia `empresas/_modelo` (com pautas de exemplo para pequenos negócios). Depois, no painel:

1. **Marca**: cores, fonte (qualquer uma do Google Fonts), logo (ponha `logo.png` na pasta da empresa e escreva `logo.png`) e variáveis como `whatsapp` e `cidade`.
2. **Banco de conteúdo**: troque as pautas de exemplo pelas da empresa. Os textos aceitam variáveis: `{marca}`, `{arroba}`, `{site}` e as que você criou.
3. **⚡ Gerar rascunhos**.

Para levar o sistema para outro repositório, copie a pasta `post-studio/` inteira. Ela não depende de nada fora dela.

### Script próprio por empresa

Se uma empresa precisar de outra lógica, crie outro script em `scripts/` e aponte em `empresa.json`:

```json
"geracao": { "script": "scripts/gerar-rascunhos-loja.mjs" }
```

O painel executa esse script com `--empresa <pasta> --qtd <n> --json`. O script grava em `posts.json` e imprime na última linha um JSON `{"ok": true, "criados": ["p12", ...], "avisos": []}`.

## Colocar na internet

Qualquer hospedagem que rode Node serve (VPS, Railway, Render, Fly…). Para usar com Docker:

```bash
docker build -t post-studio .
```

```bash
docker run -p 3333:3333 -e PAINEL_SENHA=uma-senha-forte -v "$(pwd)/empresas:/app/empresas" post-studio
```

- `PAINEL_SENHA`: com ela, o navegador pede usuário e senha (o usuário pode ser qualquer um). **Sempre defina** quando o painel estiver na internet.
- `EMPRESAS_DIR`: pasta dos dados. Em hospedagem com disco temporário, aponte para um volume persistente; senão os posts se perdem a cada deploy.
- `PORT`: porta (padrão 3333).

## Templates

| tipo | uso | itens |
|---|---|---|
| `passos` | passo a passo numerado | `titulo`, `texto` |
| `lista` | lista com emoji | `emoji`, `titulo`, `texto` |
| `checklist` | caixinhas ✓ | `titulo`, `texto` |
| `mito` | mito ou verdade | `titulo` = mito, `texto` = verdade |
| `comparativo` | 2 colunas | `emoji`, `titulo`, `texto` com linhas separadas por `\|` |
| `citacao` | frase em destaque | só `titulo` e `subtitulo` |
| `capa` | aviso / título grande | só `titulo` e `subtitulo` |

Campos opcionais em qualquer post: `kicker`, `subtitulo`, `destaque` (`forte` e `texto`), `tema`, `tamanhoTitulo` e `legenda`. O texto encolhe sozinho para caber.

## Relação com o `insta-bot`

O `insta-bot/` continua como está: ele publica no Instagram pelo GitHub Actions. O Estúdio de Posts cuida de **criar, revisar e aprovar** os posts. A empresa `transmasc` já vem com as ideias do `insta-bot/ideias.json` no banco. Os posts têm os mesmos campos nos dois sistemas, então dá para levar um post aprovado daqui para a fila do bot.
