/* Código compartilhado da comunidade: comunidade.html, perfil.html e comunidade-admin.html.
   Estrutura no Firestore (regras em firestore-comunidade.rules):
   membros/{uid}                         perfil público (nome, foto, cidade, tempo em T…)
   bloqueados/{uid}                      contas suspensas pela moderação
   forum_pendentes/{id}                  publicações esperando moderação (status pendente/recusado)
   forum_posts/{id}                      publicações aprovadas; reações em reacoes.{uid}; enquete em opcoes + contagem
   forum_posts/{id}/comentarios/{id}     comentários e respostas (campo pai)
   forum_posts/{id}/votos/{uid}          voto secreto (só a própria pessoa lê)
   forum_autoria/{id}                    quem escreveu cada post/comentário (só a pessoa e a moderação leem)
   privado/{uid} (+ aplicacoes, exames)  hormonização e jornada: só a própria pessoa lê e escreve */

const firebaseConfig = {
  apiKey: "AIzaSyCqz9jXdJy4z3GN0IQ30qeJOErQxAOkx7o",
  authDomain: "portal-d40f5.firebaseapp.com",
  projectId: "portal-d40f5",
  storageBucket: "portal-d40f5.firebasestorage.app",
  messagingSenderId: "138269570866",
  appId: "1:138269570866:web:64b9698327654988d8c92b"
};
export const EMAIL_CONTATO = 'transmascbrasil@gmail.com';
export const REACOES = {
  curtir:['👍','Curtir','#1877F2'], amei:['❤️','Amei','#E0245E'], forca:['🤗','Força','#C98A00'],
  haha:['😂','Haha','#C98A00'], uau:['😮','Uau','#C98A00'], triste:['😢','Triste','#C98A00'], grr:['😡','Grr','#D9480F']
};
export const TIPOS = { post:'Publicação', pergunta:'Pergunta', enquete:'Enquete' };

/* ---------- Firebase ---------- */
export let fb = null, auth = null, db = null;
export async function carregarFirebase(){
  const base = "https://www.gstatic.com/firebasejs/11.6.1/";
  const [a, au, fs] = await Promise.all([import(base+"firebase-app.js"), import(base+"firebase-auth.js"), import(base+"firebase-firestore.js")]);
  fb = { ...au, ...fs };
  const app = a.initializeApp(firebaseConfig);
  auth = au.getAuth(app); db = fs.getFirestore(app);
  /* Testes locais: abra localhost/<página>?emulador com os emuladores do Firebase rodando */
  if (location.hostname === 'localhost' && new URLSearchParams(location.search).has('emulador')) {
    au.connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    fs.connectFirestoreEmulator(db, 'localhost', 8085);
  }
  return { fb, auth, db };
}
/* É da moderação? Quem pode ler a lista de admins (a conta dona ou quem está em "admins") é moderação.
   Ler em vez de procurar o próprio documento inclui a conta dona, que não precisa estar na lista. */
export function ehModeracao(){
  return fb.getDocs(fb.query(fb.collection(db, 'admins'), fb.limit(1))).then(() => true).catch(() => false);
}
/* Mantém o ?emulador nos links entre as páginas durante os testes locais */
export function url(pagina){ return location.search.includes('emulador') ? pagina + (pagina.includes('?') ? '&' : '?') + 'emulador' : pagina; }

/* ---------- utilidades ---------- */
export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function toast(msg){
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
}
export function mostrarErro(id, msg){ const el = $(id); el.textContent = msg; el.hidden = !msg; }
export function traduzErro(err, verificado = true){
  const c = (err && err.code) || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'E-mail ou senha incorretos.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (c.includes('email-already-in-use')) return 'Já existe uma conta com esse e-mail. Tente entrar ou use “Esqueci minha senha”.';
  if (c.includes('weak-password')) return 'Senha fraca. Use pelo menos 8 caracteres.';
  if (c.includes('invalid-email')) return 'E-mail inválido.';
  if (c.includes('operation-not-allowed')) return 'O login por e-mail e senha não está ativado no Firebase.';
  if (c.includes('network') || c.includes('unavailable')) return 'Sem conexão. Verifique a internet e tente de novo.';
  if (c.includes('permission-denied')) return verificado ? 'Você não tem permissão para fazer isso.' : 'Confirme seu e-mail para participar.';
  if (c.includes('invalid-argument') || c.includes('resource-exhausted')) return 'Ficou grande demais. Tente com menos fotos.';
  return 'Algo deu errado: ' + ((err && err.message) || err);
}
export function quando(ts){
  const d = ts && ts.toDate ? ts.toDate() : new Date();
  const s = (Date.now() - d) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s/60)} min`;
  if (s < 86400) return `há ${Math.floor(s/3600)} h`;
  if (s < 604800) { const n = Math.floor(s/86400); return `há ${n} dia${n > 1 ? 's' : ''}`; }
  return d.toLocaleDateString('pt-BR', { day:'numeric', month:'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

/* Datas "AAAA-MM-DD" sempre no fuso local (sem o deslocamento de new Date('AAAA-MM-DD'), que é UTC) */
export const dataLocal = iso => { const [a, m, d] = String(iso).split('-').map(Number); return new Date(a, (m || 1) - 1, d || 1); };
export const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hojeIso = () => isoDe(new Date());
export const diasEntre = (a, b) => Math.round((dataLocal(isoDe(b)) - dataLocal(isoDe(a))) / 86400000);
export const dataBonita = (iso, ano = true) => dataLocal(iso).toLocaleDateString('pt-BR', { weekday:'short', day:'numeric', month:'short', year: ano ? 'numeric' : undefined });
/* "2 anos e 3 meses" desde a data de início em T */
export function tempoEmT(iso){
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const ini = dataLocal(iso), hoje = new Date();
  if (ini > hoje) return null;
  let meses = (hoje.getFullYear() - ini.getFullYear()) * 12 + hoje.getMonth() - ini.getMonth();
  if (hoje.getDate() < ini.getDate()) meses--;
  const anos = Math.floor(meses / 12), m = meses % 12, dias = diasEntre(ini, hoje);
  const partes = [];
  if (anos) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
  if (m) partes.push(`${m} ${m > 1 ? 'meses' : 'mês'}`);
  const tversario = dias > 0 && hoje.getMonth() === ini.getMonth() && hoje.getDate() === ini.getDate();
  return { texto: partes.length ? partes.join(' e ') : `${dias} dia${dias === 1 ? '' : 's'}`, meses, dias, anos, tversario };
}

/* ---------- avatares e perfis ---------- */
const CORES = [['#5BCEFA','#14254F'],['#F5A9B8','#14254F'],['#1E3A8A','#fff'],['#7C5CBF','#fff'],['#1F8A5B','#fff'],['#C2552F','#fff'],['#2E7D96','#fff']];
export const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export function avatarDe(nome, uid, tam, anon){
  const cls = tam === true ? ' sm' : tam ? ' ' + tam : '';
  if (anon) return `<span class="av anon${cls}" aria-hidden="true">🎭</span>`;
  let h = 0; for (const c of (uid || nome || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = CORES[h % CORES.length];
  const ini = (nome || '?').split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase();
  return `<span class="av${cls}" ${uid ? `data-uid="${esc(uid)}"` : ''} style="background-color:${bg};color:${fg}" aria-hidden="true">${esc(ini)}</span>`;
}
export const avatar = (d, tam) => avatarDe(d.autorNome, d.autorUid, tam, d.anonimo);
export const nomeDe = d => d.anonimo ? 'Anônimo' : (d.autorNome || 'Membro');
/* Nome clicável que leva ao perfil (anônimo nunca vira link) */
export const nomeLink = d => d.anonimo || !d.autorUid ? esc(nomeDe(d)) : `<a class="nome" href="${url('perfil.html?u=' + encodeURIComponent(d.autorUid))}">${esc(nomeDe(d))}</a>`;

const perfis = new Map();
export function perfilDe(uid, recarregar){
  if (recarregar || !perfis.has(uid)) perfis.set(uid, fb.getDoc(fb.doc(db, 'membros', uid)).then(s => s.exists() ? s.data() : null).catch(() => null));
  return perfis.get(uid);
}
/* Troca as iniciais pela foto de perfil, quando a pessoa tem uma */
export function hidratarAvatares(raiz){
  raiz.querySelectorAll('.av[data-uid]:not([data-ok])').forEach(async el => {
    el.dataset.ok = 1;
    const p = await perfilDe(el.dataset.uid);
    if (p && p.foto && IMG_RE.test(p.foto)) { el.style.backgroundImage = `url("${p.foto}")`; el.classList.add('foto'); }
  });
}

/* ---------- texto, links e mídia ---------- */
const URL_RE = /https?:\/\/[^\s<]+/g;
const aparaUrl = u => u.replace(/(&quot;|&#39;|[.,!?;:)\]])+$/, '');
export function textoHtml(t){
  return esc(t).replace(URL_RE, m => {
    const u = aparaUrl(m);
    return `<a href="${u}" target="_blank" rel="noopener nofollow ugc">${u}</a>${m.slice(u.length)}`;
  }).replace(/\n/g, '<br>');
}
export const linksDe = t => (String(t || '').match(URL_RE) || []).map(u => u.replace(/[.,!?;:)\]"']+$/, ''));

/* Vídeo: YouTube, Vimeo ou arquivo direto */
export function video(link){
  if (!link) return null;
  let u; try { u = new URL(link); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const h = u.hostname.replace(/^(www|m)\./, '');
  let id = null;
  if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'music.youtube.com') id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/) || [])[1];
  if (id && /^[\w-]{6,20}$/.test(id)) return { tipo:'iframe', src:`https://www.youtube-nocookie.com/embed/${id}` };
  if (h === 'vimeo.com' || h === 'player.vimeo.com') { const v = u.pathname.match(/(\d{5,})/); if (v) return { tipo:'iframe', src:`https://player.vimeo.com/video/${v[1]}` }; }
  if (u.protocol === 'https:' && /\.(mp4|webm|ogg|mov)$/i.test(u.pathname)) return { tipo:'video', src:u.href };
  return null;
}
export function videoHtml(v){
  return v.tipo === 'iframe'
    ? `<div class="pvideo"><iframe src="${esc(v.src)}" title="Vídeo" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : `<div class="pvideo"><video src="${esc(v.src)}" controls preload="metadata" playsinline></video></div>`;
}
/* Texto + fotos + vídeo + cartão de link de uma publicação */
export function midiaHtml(d){
  const imgs = (d.imagens || []).filter(s => IMG_RE.test(s));
  const links = linksDe(d.texto);
  const v = video(d.video) || links.map(video).find(Boolean);
  const outro = d.video && !video(d.video) ? d.video : links.find(l => !video(l));
  const curto = d.texto && d.texto.length <= 140 && !imgs.length && !v && d.tipo !== 'enquete' && !links.length;
  let h = d.texto ? `<div class="ptexto${curto ? ' grande' : ''}${d.tipo === 'pergunta' && !curto ? ' perg' : ''}">${textoHtml(d.texto)}</div>` : '';
  if (imgs.length) h += `<div class="pimgs n${Math.min(imgs.length, 4)}">${imgs.map((s, i) => `<button class="pimg" aria-label="Ampliar imagem ${i+1}"><img src="${s}" alt="" data-zoom loading="lazy"></button>`).join('')}</div>`;
  if (v) h += videoHtml(v);
  if (outro && /^https?:\/\//.test(outro)) {
    let host = ''; try { host = new URL(outro).hostname.replace(/^www\./, ''); } catch {}
    if (host) h += `<a class="lcard" href="${esc(outro)}" target="_blank" rel="noopener nofollow ugc"><i>🔗</i><div><b>${esc(host)}</b><span>${esc(outro)}</span></div></a>`;
  }
  return h;
}

/* Fotos são reduzidas no navegador e guardadas no próprio documento (o Storage do Firebase exige plano pago) */
export async function comprimir(file, lado, alvo, quadrado){
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('formato')); i.src = src; });
    let q = .82, out = '';
    /* foto de perfil: corta o centro num quadrado */
    const lw = quadrado ? Math.min(img.naturalWidth, img.naturalHeight) : img.naturalWidth;
    const lh = quadrado ? lw : img.naturalHeight;
    const sx = (img.naturalWidth - lw) / 2, sy = (img.naturalHeight - lh) / 2;
    for (let t = 0; t < 10; t++) {
      const s = Math.min(1, lado / Math.max(lw, lh));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(lw * s)); c.height = Math.max(1, Math.round(lh * s));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, sx, sy, lw, lh, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      if (out.length <= alvo) return out;
      if (q > .56) q -= .1; else lado *= .8;
    }
    return out;
  } finally { URL.revokeObjectURL(src); }
}

/* ---------- modais ---------- */
let focoAntes = null;
export function abrirModal(id){ focoAntes = document.activeElement; $(id).hidden = false; document.body.style.overflow = 'hidden'; const f = $(id).querySelector('textarea,input:not([type=radio]):not([type=checkbox]):not([type=file]),select'); setTimeout(() => (f || $(id).querySelector('.x')).focus(), 30); }
export function fecharModal(id){ $(id).hidden = true; if (!document.querySelector('.overlay:not([hidden])')) document.body.style.overflow = ''; focoAntes && focoAntes.focus && focoAntes.focus(); }
export function abrirLightbox(src){
  const l = document.createElement('div'); l.className = 'lightbox'; l.setAttribute('role', 'dialog'); l.setAttribute('aria-label', 'Imagem ampliada');
  l.innerHTML = `<img src="${src}" alt="">`; l.onclick = () => l.remove(); document.body.appendChild(l);
}

/* ---------- lojinha (mesmos itens e ícones do portal; o painel admin pode substituir pela coleção "loja") ---------- */
export const LOJA_PADRAO = [
  { id:'barba',  cor:'azul',    icone:'barba',  tag:'Barba',      titulo:'Cuidados com a barba',     texto:'Pra ajudar a crescer e cuidar: óleo, balm, máquina e muito mais.', link:'https://meli.la/31ecZmk', ordem:1 },
  { id:'mastec', cor:'rosa',    icone:'mastec', tag:'Pós-mastec', titulo:'O que comprar pós-mastec', texto:'Colete compressor, curativos e itens pra recuperação tranquila.',   link:'https://meli.la/1VAS2qZ', ordem:2 },
  { id:'binder', cor:'branco',  icone:'binder', tag:'Binders',    titulo:'Binders',                  texto:'Modelos testados pela comunidade, com dica de tamanho.',            link:'https://meli.la/1G3mcbL', ordem:3 },
  { id:'estilo', cor:'amarelo', icone:'estilo', tag:'Estilo',     titulo:'Estilo pagando pouco',     texto:'Tênis, bermudas, cuecas e muito mais.',                              link:'https://meli.la/1zE2CVz', ordem:4 }
];
export const LOJA_ICON = {"barba": "<svg viewBox=\"0 0 200 200\" aria-hidden=\"true\"><circle cx=\"100\" cy=\"100\" r=\"92\" fill=\"#fff\"/><path d=\"M52 78c0 58 22 92 48 92s48-34 48-92\" fill=\"#14254F\"/><path d=\"M64 70c10-28 62-28 72 0\" fill=\"#F2C6A0\"/><rect x=\"64\" y=\"60\" width=\"72\" height=\"40\" rx=\"20\" fill=\"#F2C6A0\"/><path d=\"M78 118c8 7 36 7 44 0\" stroke=\"#F2C6A0\" stroke-width=\"7\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M80 108q20-12 40 0\" stroke=\"#14254F\" stroke-width=\"10\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"85\" cy=\"84\" r=\"5\" fill=\"#14254F\"/><circle cx=\"115\" cy=\"84\" r=\"5\" fill=\"#14254F\"/><path d=\"M58 52q42-32 84 0v14H58z\" fill=\"#14254F\"/></svg>", "mastec": "<svg viewBox=\"0 0 200 200\" aria-hidden=\"true\"><circle cx=\"100\" cy=\"100\" r=\"92\" fill=\"#fff\"/><path d=\"M50 62l26-14q24 16 48 0l26 14-8 100H58z\" fill=\"#E9D7C3\"/><path d=\"M76 48q24 16 48 0\" stroke=\"#C9B39B\" stroke-width=\"5\" fill=\"none\"/><g stroke=\"#C9B39B\" stroke-width=\"4\"><line x1=\"100\" y1=\"72\" x2=\"100\" y2=\"160\"/></g><g fill=\"#14254F\"><circle cx=\"100\" cy=\"84\" r=\"4\"/><circle cx=\"100\" cy=\"104\" r=\"4\"/><circle cx=\"100\" cy=\"124\" r=\"4\"/><circle cx=\"100\" cy=\"144\" r=\"4\"/></g><path d=\"M150 40l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z\" fill=\"#F5A9B8\"/></svg>", "binder": "<svg viewBox=\"0 0 200 200\" aria-hidden=\"true\"><circle cx=\"100\" cy=\"100\" r=\"92\" fill=\"#fff\"/><path d=\"M56 70h88v74q-44 14-88 0z\" fill=\"#14254F\"/><path d=\"M64 70l10-26h14l4 26M136 70l-10-26h-14l-4 26\" fill=\"#14254F\"/><g fill=\"#5BCEFA\"><rect x=\"56\" y=\"96\" width=\"88\" height=\"8\"/></g><g fill=\"#F5A9B8\"><rect x=\"56\" y=\"110\" width=\"88\" height=\"8\"/></g><rect x=\"56\" y=\"124\" width=\"88\" height=\"6\" fill=\"#fff\" opacity=\".9\"/></svg>", "estilo": "<svg viewBox=\"0 0 200 200\" aria-hidden=\"true\"><circle cx=\"100\" cy=\"100\" r=\"92\" fill=\"#fff\"/><path d=\"M34 124c4-18 18-26 34-26 10 0 16-8 24-8l18 18c16 6 40 8 54 10 6 1 8 6 8 12v6H34z\" fill=\"#14254F\"/><rect x=\"30\" y=\"134\" width=\"144\" height=\"14\" rx=\"7\" fill=\"#F5A9B8\"/><g stroke=\"#5BCEFA\" stroke-width=\"4\" stroke-linecap=\"round\"><line x1=\"94\" y1=\"100\" x2=\"104\" y2=\"108\"/><line x1=\"86\" y1=\"106\" x2=\"96\" y2=\"114\"/><line x1=\"78\" y1=\"110\" x2=\"88\" y2=\"118\"/></g><path d=\"M118 112q20 6 46 8\" stroke=\"#fff\" stroke-width=\"3\" opacity=\".6\" fill=\"none\"/></svg>"};
LOJA_ICON.sacola = '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="#fff"/><path d="M58 76h84l-8 84H66z" fill="#14254F"/><path d="M78 76v-8a22 22 0 0 1 44 0v8" stroke="#14254F" stroke-width="9" fill="none"/><rect x="58" y="104" width="84" height="8" fill="#5BCEFA"/><rect x="58" y="118" width="84" height="8" fill="#F5A9B8"/></svg>';
LOJA_ICON.coracao = '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="#fff"/><path d="M100 156s-50-30-50-66a26 26 0 0 1 50-10 26 26 0 0 1 50 10c0 36-50 66-50 66z" fill="#F5A9B8"/><path d="M100 80a26 26 0 0 1 50 10" stroke="#5BCEFA" stroke-width="10" fill="none"/></svg>';
export const LOJA_COR = {
  azul:   { slide:'linear-gradient(160deg,#E6F7FE 0%,#BFEAFD 100%)', card:'#BFEAFD' },
  rosa:   { slide:'linear-gradient(160deg,#FDEEF1 0%,#F8CBD5 100%)', card:'#F8CBD5' },
  branco: { slide:'linear-gradient(160deg,#FFFFFF 0%,#E6F7FE 55%,#FDEEF1 100%)', card:'#E6F7FE' },
  amarelo:{ slide:'linear-gradient(160deg,#FFF5D6 0%,#FBE3A6 100%)', card:'#FBE3A6' },
  verde:  { slide:'linear-gradient(160deg,#EAF8F0 0%,#BFE8D2 100%)', card:'#BFE8D2' },
  lilas:  { slide:'linear-gradient(160deg,#F3EEFD 0%,#D9CCF7 100%)', card:'#D9CCF7' }
};
export function lojaHtml(lista){
  const temLink = i => /^https:\/\//.test(i.link || '');
  return [...lista].sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999)).map(i => `
    <a class="scard${temLink(i) ? '' : ' off'}" ${temLink(i) ? `href="${esc(i.link)}" target="_blank" rel="noopener sponsored"` : ''}>
      <div class="top" style="background:${(LOJA_COR[i.cor] || LOJA_COR.azul).card}">${LOJA_ICON[i.icone] || LOJA_ICON.sacola}</div>
      <div class="bd"><h3>${esc(i.titulo)}</h3><p>${esc(i.texto)}</p><span class="go">${temLink(i) ? 'Ver produtos →' : 'Em breve'}</span></div>
    </a>`).join('');
}
