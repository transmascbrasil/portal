// IA compartilhada pelo painel (navegador) e pelo robô (Node). Não importe nada de Node aqui.
import { TIPOS, TIPOS_SEM_ITENS, TIPOS_COM_EMOJI } from './template.js';

export const SYSTEM_IA = [
  'Você escreve posts de Instagram (imagem única 1080x1350) para o Portal Transmasc Brasil (@transmascbrasil), um guia gratuito, comunitário e sem fins lucrativos, feito por e para homens trans e pessoas transmasculinas no Brasil. O público são pessoas no começo ou no meio da transição, e também familiares e amigos.',
  '',
  'TOM: direto, acolhedor e de comunidade ("a gente", "galera"), sem formalidade. Frases curtas. Português do Brasil. Use "homens trans" e "pessoas transmasculinas". Emojis com moderação (💙 🏳️‍⚧️ 🤝 🏥).',
  '',
  'REGRAS DE CONTEÚDO (obrigatórias):',
  '- Saúde: nunca dê orientação médica individual. Em temas como binder, colete e meias compressoras, pós-operatório e hormônios, informe de forma geral e lembre de seguir a equipe de saúde. Não invente doses, prazos, tempos ou números clínicos.',
  '- Direito: a retificação de nome e gênero se baseia na decisão do STF de 2018 (ADI 4275) e no Provimento 73 do CNJ: direto no cartório, por autodeclaração, sem cirurgia, sem laudo e sem processo judicial, a partir dos 18 anos. Avise que as exigências de documentos podem variar por cartório. Não dê aconselhamento jurídico individual.',
  '- Indicações de profissionais vêm da comunidade e são moderadas. Não prometa qualidade ou resultado de nenhum profissional. Contatos e convênios podem mudar.',
  '- Não afirme números que o portal não sustente. Pode dizer "mais de 40 ambulatórios" e que o portal tem o maior acervo de cirurgiões de mastectomia masculinizadora do Brasil. Não cite outros números ou estatísticas.',
  '- Não identifique nem exponha pessoas. Não cite nomes de profissionais nem de pessoas reais.',
  '- Não invente fatos, leis, estudos ou estatísticas. Se não tiver certeza, escreva em termos gerais e liste o ponto em "avisos".',
  '- Não escreva o endereço do site. Diga "Link na bio".',
  '- Lojinha: links de afiliado do Mercado Livre (a pessoa não paga a mais). Se citar o Apoia.se, diga "contribua com qualquer valor" e inclua em "avisos": "Confirmar se o Apoia.se aceita contribuição única".',
  '- Sem imagens de corpos. Nada sensacionalista.',
  '',
  'FORMATO: responda SOMENTE com JSON válido, sem markdown e sem texto fora do JSON. Para um post, um objeto; quando o pedido for de vários posts, um array de objetos. Cada objeto tem este formato:',
  '{',
  '  "tipo": um de "passos" | "lista" | "checklist" | "mito" | "comparativo" | "citacao" | "capa",',
  '     // passos = sequência numerada; lista = dicas com emoji; checklist = o que levar/conferir; mito = cada item tem "titulo" (o mito) e "texto" (a verdade), 2 a 3 itens;',
  '     // comparativo = EXATAMENTE 2 itens, cada um com "titulo" (nome da coluna, até 14 caracteres) e "texto" (de 3 a 4 pontos curtos separados por |, até 28 caracteres cada);',
  '     // citacao = frase grande no "titulo" (1 a 3 linhas de até 26 caracteres), autoria opcional no "subtitulo", itens vazios; capa = aviso ou novidade, só título, itens vazios',
  '  "kicker": "chamada curta, até 24 caracteres",',
  '  "titulo": ["linha 1", "linha 2"],       // 1 ou 2 linhas, até 22 caracteres cada; a última linha fica rosa',
  '  "subtitulo": "opcional, até 60 caracteres",',
  '  "itens": [ { "emoji": "só nos tipos lista e comparativo", "titulo": "até 38 caracteres", "texto": "opcional, até 60 caracteres" } ],   // de 3 a 5 itens (veja as regras de cada tipo)',
  '  "destaque": { "forte": "até 50 caracteres", "texto": "até 60 caracteres" },   // caixa rosa; use para o aviso importante',
  '  "legenda": "legenda completa do Instagram",',
  '  "avisos": ["pontos que a pessoa deve conferir antes de aprovar"]',
  '}',
  '',
  'LEGENDA: comece com um gancho, use de 2 a 4 parágrafos curtos, feche pedindo para seguir ("Me segue aí, galera"), compartilhar e, quando fizer sentido, indicar um profissional. Termine com "🔗 Link na bio", uma linha em branco e as hashtags #transmasc #homemtrans #transmasculino #transbrasil (mais uma específica do tema). No máximo 1500 caracteres.',
  'Em temas de saúde e direito, inclua na legenda e na caixa rosa que é informação geral, não orientação individual.'
].join('\n');

export function extrairJson(texto) {
  const ini = texto.search(/[\[{]/);
  if (ini < 0) throw new Error('A IA não devolveu um post válido. Tente de novo.');
  const fim = texto.lastIndexOf(texto[ini] === '[' ? ']' : '}');
  if (fim <= ini) throw new Error('A resposta da IA veio cortada. Tente de novo (ou peça menos posts de uma vez).');
  return JSON.parse(texto.slice(ini, fim + 1));
}
export const NOME_PROV = { anthropic: 'Claude', gemini: 'Google Gemini', compat: 'a IA configurada' };
export function temChave(cfg) {
  const p = cfg.provider || 'anthropic';
  return p === 'gemini' ? !!cfg.geminiKey : p === 'compat' ? !!(cfg.compatKey && cfg.compatUrl && cfg.compatModel) : !!cfg.apiKey;
}
// Chama a IA escolhida e devolve só o texto da resposta.
export async function chamarIA(cfg, system, usuario, maxTokens = 6000) {
  const prov = cfg.provider || 'anthropic';
  let url, headers, body;
  if (prov === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel || 'gemini-2.5-flash')}:generateContent`;
    headers = { 'content-type': 'application/json', 'x-goog-api-key': cfg.geminiKey };
    body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: usuario }] }], generationConfig: { maxOutputTokens: maxTokens + 4000, responseMimeType: 'application/json' } };
  } else if (prov === 'compat') {
    url = cfg.compatUrl.replace(/\/+$/, '') + '/chat/completions';
    headers = { 'content-type': 'application/json', Authorization: 'Bearer ' + cfg.compatKey };
    body = { model: cfg.compatModel, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: usuario }] };
  } else {
    url = 'https://api.anthropic.com/v1/messages';
    headers = { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    body = { model: cfg.model || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: usuario }] };
  }
  let r;
  try { r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }); }
  catch (e) { throw new Error('Não consegui falar com a IA (sem internet, ou o serviço não aceita chamadas direto do navegador).'); }
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) {
    const e = j.error; const m = typeof e === 'string' ? e : (e && e.message) || `Erro ${r.status}`;
    if (r.status === 401 || r.status === 403) throw new Error('Chave da API inválida ou sem permissão. Confira em Configurações. ' + m);
    if (r.status === 429) throw new Error('Limite de uso da IA atingido (planos gratuitos têm limite por minuto e por dia). Espere um pouco e tente de novo. ' + m);
    throw new Error(m);
  }
  let texto = '';
  if (prov === 'gemini') texto = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).filter(p => !p.thought).map(p => p.text || '').join('');
  else if (prov === 'compat') texto = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  else texto = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!texto.trim()) throw new Error('A IA não devolveu texto (pode ter sido bloqueada). Tente de novo.');
  return texto;
}
export function normalizarPost(o) {
  const tipo = TIPOS[o.tipo] ? o.tipo : 'passos';
  const titulo = (Array.isArray(o.titulo) ? o.titulo : [o.titulo || '']).map(s => String(s).trim()).filter(Boolean).slice(0, 3);
  const itens = (Array.isArray(o.itens) ? o.itens : []).slice(0, 6).map(i => ({
    ...(TIPOS_COM_EMOJI.includes(tipo) && i.emoji ? { emoji: String(i.emoji).trim() } : {}),
    titulo: String(i.titulo || '').trim(),
    ...(i.texto ? { texto: String(i.texto).trim() } : {})
  })).filter(i => i.titulo);
  const d = o.destaque || {};
  const post = {
    tipo, kicker: String(o.kicker || '').trim(), titulo, subtitulo: String(o.subtitulo || '').trim(), itens,
    destaque: { forte: String(d.forte || '').trim(), texto: String(d.texto || '').trim() },
    legenda: String(o.legenda || '').trim()
  };
  const avisos = (Array.isArray(o.avisos) ? o.avisos : []).map(String).filter(Boolean);
  // conferências automáticas (a IA às vezes passa do tamanho)
  if (tipo === 'comparativo' && itens.length !== 2) avisos.push('Comparativo precisa de exatamente 2 itens: ajuste no editor.');
  if (post.kicker.length > 28) avisos.push('Chamada pequena (kicker) muito longa.');
  if (titulo.some(l => l.length > 30) && tipo !== 'citacao') avisos.push('Alguma linha do título está longa: confira a prévia.');
  if (itens.some(i => i.titulo.length > 46 || (i.texto || '').length > 90)) avisos.push('Algum item está longo: confira a prévia.');
  if (post.legenda.length > 2000) avisos.push('Legenda longa (o Instagram aceita até 2200 caracteres).');
  if (!/link na bio/i.test(post.legenda)) avisos.push('A legenda não tem "Link na bio".');
  return { post, avisos };
}
export const postCompleto = p => p.titulo.length && (TIPOS_SEM_ITENS.includes(p.tipo) || p.itens.length) && p.legenda;
// pede à IA e tenta de novo uma vez se a resposta não vier em JSON válido
export async function pedirJson(cfg, usuario, maxTokens) {
  let ultimo;
  for (let t = 0; t < 2; t++) {
    try { return extrairJson(await chamarIA(cfg, SYSTEM_IA, usuario, maxTokens)); }
    catch (e) { ultimo = e; if (!(e instanceof SyntaxError) && !/não devolveu um post|veio cortada/.test(e.message)) throw e; }
  }
  throw ultimo instanceof SyntaxError ? new Error('A IA devolveu uma resposta fora do formato. Tente de novo.') : ultimo;
}

// Pedido para gerar vários posts novos sem repetir os existentes (usado pelo robô)
export function pedidoDeIdeias(qtd, existentes, tema = "") {
  return `Crie ${qtd} post(s) DIFERENTES entre si, em formatos (tipo) variados. ` +
    (tema ? `Direção do pedido: ${tema}. ` : "Varie os temas dentro do escopo do portal (barba, binder, retificação de nome, nome social, saúde em termos gerais, saúde mental, estilo e roupas, direitos, comunidade, indicar profissionais, apoio a familiares). ") +
    `NÃO repita estes temas que já existem: ${existentes.join(" | ") || "(nenhum)"}. Responda SOMENTE com um array JSON com ${qtd} objeto(s), cada um no formato descrito.`;
}
