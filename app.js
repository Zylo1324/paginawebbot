/* ====== CONFIG Supabase ====== */
const SUPABASE_URL = 'https://dlumywskboedejmeejvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsdW15d3NrYm9lZGVqbWVlanZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0Nzk0ODMsImV4cCI6MjA3NDA1NTQ4M30.Ty7b0T6qVneREsH8vKObhpXm5d6wbfXRkA2cFeMzphA';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ===== helpers y refs ===== */
const $=s=>document.querySelector(s);
const tbody=$('#tabla tbody');
const f={nombre:$('#nombre'),email:$('#email'),telefono:$('#telefono'),
servicio:$('#servicio'),inicio:$('#inicio'),vence:$('#vence'),notas:$('#notas'),
categoria:$('#categoria'), pin:$('#pin')};
const q=$('#q'), filterEstado=$('#filterEstado'), msg=$('#msg');
const sidebar=document.getElementById('sidebar');
const sidebarLauncher=document.getElementById('sidebarLauncher');

const themeButton=document.getElementById('btnTheme');
const themeLabel=document.getElementById('themeLabel');
const themeMenu=document.getElementById('themeMenu');
const themeOptions=Array.from(themeMenu?.querySelectorAll('[data-theme-option]')||[]);
const THEME_STORAGE_KEY='ui_theme_mode_v1';

let editId=null;

/* ===== Dropdown EMAIL (form principal) ===== */
const emailSuggestionDropdown = document.getElementById('emailSuggestionDropdown');
const emailDropdownToggle = document.getElementById('emailDropdownToggle');
let emailSuggestionCache=[];
let filteredEmailSuggestions=[];
let activeEmailSuggestionIndex=-1;
let hideEmailSuggestionTimeout=null;

/* ===== Dropdown EMAIL (modal enlazados) ===== */
const linkedModal = document.getElementById('linkedModal');
const btnLinkedOpen = document.getElementById('btnLinkedOpen');
const btnLinkedHeaderClose = document.getElementById('btnLinkedHeaderClose');
const btnLinkedSave = document.getElementById('btnLinkedSave');
const btnLinkedDelete = document.getElementById('btnLinkedDelete');
const linkedServiceEl = document.getElementById('linkedService');
const linkedEmailEl = document.getElementById('linkedEmail');
const linkedPasswordEl = document.getElementById('linkedPassword');
const toggleLinkedPassword = document.getElementById('toggleLinkedPassword');
const linkedErrorEl = document.getElementById('linkedError');
const linkedEmailDropdown = document.getElementById('linkedEmailDropdown');
const linkedEmailDropdownToggle = document.getElementById('linkedEmailDropdownToggle');

let linkedFilteredSuggestions=[];
let linkedActiveIndex=-1;
let linkedHideTimeout=null;

function toast(t){ msg.textContent=t; setTimeout(()=>msg.textContent='',2200); }
function esc(s){return (s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;' }[m]))}
function renderMarkdown(input){
  const safe = esc(input==null? '' : String(input));
  if(!safe) return '';
  const applyInline = (str)=>{
    if(!str) return '';
    let res = str;
    res = res.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    res = res.replace(/(^|[\s.,;:!?()"'¿¡-])_(.+?)_(?=[\s.,;:!?()"'¿¡-]|$)/g,(match,prefix,content)=>`${prefix}<em>${content}</em>`);
    return res;
  };
  const parseTableCells = (line,{allowEmpty=false}={})=>{
    if(!line) return null;
    const trimmed = line.trim();
    if(!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
    const parts = trimmed.slice(1,-1).split('|').map(cell=>cell.trim());
    if(!parts.length) return null;
    if(!allowEmpty && !parts.some(cell=>cell.length>0)) return null;
    return parts;
  };
  const parseSeparatorLine = (line)=>{
    const cells = parseTableCells(line,{allowEmpty:true});
    if(!cells) return null;
    const isValid = cells.every(cell=>{
      const normalized = cell.replace(/\s+/g,'');
      return /^:?-{3,}:?$/.test(normalized);
    });
    return isValid ? cells : null;
  };
  const lines = safe.split(/\r?\n/);
  const blocks = [];
  let paragraphLines=[];
  let listType=null;
  let listItems=[];
  const flushParagraph=()=>{
    if(!paragraphLines.length) return;
    const text = paragraphLines.join(' ');
    blocks.push(`<p>${text}</p>`);
    paragraphLines=[];
  };
  const flushList=()=>{
    if(!listType || !listItems.length){ listType=null; listItems=[]; return; }
    blocks.push(`<${listType}>${listItems.map(item=>`<li>${item}</li>`).join('')}</${listType}>`);
    listType=null;
    listItems=[];
  };
  for(let i=0;i<lines.length;i++){
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if(!trimmed){ flushParagraph(); flushList(); continue; }
    const headerCells = parseTableCells(trimmed);
    if(headerCells && !parseSeparatorLine(trimmed)){
      const separatorLine = lines[i+1]?.trim();
      const separatorCells = parseSeparatorLine(separatorLine);
      if(separatorCells && separatorCells.length === headerCells.length){
        flushParagraph();
        flushList();
        const bodyRows=[];
        let rowIndex=i+2;
        while(rowIndex<lines.length){
          const candidate = lines[rowIndex].trim();
          if(!candidate) break;
          const rowCells = parseTableCells(candidate,{allowEmpty:true});
          if(!rowCells || rowCells.length !== headerCells.length) break;
          bodyRows.push(rowCells);
          rowIndex++;
        }
        const headerHtml = headerCells.map(cell=>`<th>${applyInline(cell)}</th>`).join('');
        const bodyHtml = bodyRows.map(row=>`<tr>${row.map(cell=>`<td>${applyInline(cell)}</td>`).join('')}</tr>`).join('');
        blocks.push(`<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`);
        i = rowIndex-1;
        continue;
      }
    }
    const unordered = trimmed.match(/^([-*])\s+(.+)/);
    if(unordered){
      flushParagraph();
      const item = applyInline(unordered[2].trim());
      if(listType!=='ul'){ flushList(); listType='ul'; }
      listItems.push(item);
      continue;
    }
    const ordered = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if(ordered){
      flushParagraph();
      const item = applyInline(ordered[2].trim());
      if(listType!=='ol'){ flushList(); listType='ol'; }
      listItems.push(item);
      continue;
    }
    flushList();
    paragraphLines.push(applyInline(trimmed));
  }
  flushParagraph();
  flushList();
  return blocks.join('');
}
function fmt(iso){return iso? new Date(iso+'T00:00:00').toLocaleDateString(): '-'}
function fmtHora(ts){
  if(ts===undefined || ts===null || ts==='') return '-';
  let date;
  if(ts instanceof Date){ date = new Date(ts.getTime()); }
  else if(typeof ts==='number'){ date = new Date(ts); }
  else if(typeof ts==='string'){
    const num = Number(ts);
    if(!Number.isNaN(num)) date = new Date(num);
    else date = new Date(ts);
  }
  if(!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function cuentaRegresiva(iso){
  if(!iso) return 'Sin fecha de vencimiento';
  const target = new Date(iso);
  if(Number.isNaN(target.getTime())) return 'Fecha inválida';
  if(typeof iso==='string' && iso.length<=10){ target.setHours(23,59,59,999); }
  const diffMs = target.getTime() - Date.now();
  const absMinutes = Math.floor(Math.abs(diffMs) / 60000);
  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor((absMinutes % 1440) / 60);
  const minutes = absMinutes % 60;
  const parts = [`${days} d`, `${hours} h`, `${minutes} min`];
  return diffMs >= 0 ? `Faltan ${parts.join(' ')}` : `Vencido hace ${parts.join(' ')}`;
}

/* ===== Tema ===== */
function updateThemeControls(mode){
  if(themeLabel){ themeLabel.textContent = mode==='light' ? 'Claro' : 'Oscuro'; }
  themeOptions.forEach(btn=>{
    const isActive = btn.dataset.themeOption === mode;
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
}
function applyTheme(mode,{persist=true}={}){
  const normalized = mode==='light' ? 'light' : 'dark';
  document.body.classList.toggle('theme-light', normalized==='light');
  if(persist){ try{ localStorage.setItem(THEME_STORAGE_KEY, normalized); }catch{} }
  updateThemeControls(normalized);
  return normalized;
}
const storedTheme = (()=>{ try{ return localStorage.getItem(THEME_STORAGE_KEY); }catch{ return null; } })();
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(storedTheme==='light'?'light':(storedTheme==='dark'?'dark':(prefersDark?'dark':'light')),{persist:false});

/* ===== sidebar responsive ===== */
const sidebarMobileQuery=window.matchMedia? window.matchMedia('(max-width: 768px)') : { matches:false };
function isMobileSidebar(){ return sidebarMobileQuery.matches; }
function syncSidebarResponsiveState(){
  if(!sidebar) return;
  const pinned = sidebar.dataset.pinned === 'true';
  sidebar.classList.toggle('pinned', pinned);
  const isVisible = pinned || (!isMobileSidebar() && sidebar.classList.contains('peek'));
  sidebar.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
  sidebarLauncher?.setAttribute('aria-expanded', pinned ? 'true' : 'false');
  sidebarLauncher.textContent = pinned ? '✕' : '☰';
  sidebarLauncher.setAttribute('aria-label', pinned ? 'Cerrar navegación' : 'Abrir navegación');
  sidebarLauncher.classList.toggle('is-open', pinned);
  if(isMobileSidebar()){
    document.body.classList.remove('sidebar-expanded');
  }else{
    document.body.classList.toggle('sidebar-expanded', pinned);
  }
}
function setSidebarPinned(pinned){
  if(!sidebar) return;
  sidebar.dataset.pinned = String(pinned);
  if(!pinned){ sidebar.classList.remove('peek'); }
  syncSidebarResponsiveState();
}
function expandSidebarIfNeeded(){
  if(!sidebar || isMobileSidebar()) return;
  if(sidebar.dataset.pinned === 'true') return;
  sidebar.classList.add('peek'); sidebar.setAttribute('aria-hidden','false');
}
function collapseSidebarIfNeeded(){
  if(!sidebar) return;
  if(sidebar.dataset.pinned === 'true') return;
  sidebar.classList.remove('peek'); sidebar.setAttribute('aria-hidden','true');
}
syncSidebarResponsiveState();
sidebarLauncher?.addEventListener('click', ()=> setSidebarPinned(sidebar.dataset.pinned !== 'true'));
sidebar?.addEventListener('mouseenter', expandSidebarIfNeeded);
sidebar?.addEventListener('mouseleave', collapseSidebarIfNeeded);
sidebar?.addEventListener('focusin', expandSidebarIfNeeded);
sidebar?.addEventListener('focusout', (e)=>{ if(!sidebar.contains(e.relatedTarget)) collapseSidebarIfNeeded(); });
if(sidebarMobileQuery.addEventListener){ sidebarMobileQuery.addEventListener('change', ()=>{ syncSidebarResponsiveState(); collapseSidebarIfNeeded(); }); }

/* ===== fechas & estado ===== */
function diasRestantes(iso){
  if(!iso) return null; const h=new Date();h.setHours(0,0,0,0);
  const d=new Date(iso); d.setHours(0,0,0,0);
  return Math.round((d-h)/(1000*60*60*24));
}
function estadoDe(vence){
  if(!vence) return ''; const d=diasRestantes(vence);
  if(d<0) return 'vencida'; if(d<=7) return 'pronto'; return 'vigente';
}
function limpiar(){
  editId=null;
  for(const k in f){ if('value' in f[k]) f[k].value=''; }
  Promise.resolve(renderServicios()).then(()=>{
    rebuildEmailSuggestions();
    handleEmailSuggestionSelection();
  });
  msg.textContent='';
}

/* ===== Linked accounts base ===== */
function normalize(t){return (t||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}
function linkedServiceKey(servicio){ return normalize((servicio||'').toString().trim()); }
function linkedEmailKey(email){ return (email||'').toString().trim().toLowerCase(); }
function linkedCompositeKey(servicio,email){
  const s=linkedServiceKey(servicio), e=linkedEmailKey(email);
  return s&&e? `${s}::${e}`:'';
}
const LINKED_ACCOUNTS_KEY = 'linked_accounts_v1';
function loadStoredLinkedAccounts(){
  try{
    const raw=localStorage.getItem(LINKED_ACCOUNTS_KEY); if(!raw) return [];
    const arr=JSON.parse(raw)||[];
    const seen=new Set(); const out=[];
    arr.forEach(it=>{
      const rec={ servicio:String(it.servicio||'').trim(), email:String(it.email||'').trim(), password:String(it.password||'') };
      if(!rec.servicio||!rec.email||!rec.password) return;
      const key=linkedCompositeKey(rec.servicio,rec.email);
      if(seen.has(key)) return; seen.add(key); out.push(rec);
    });
    out.sort((a,b)=> a.servicio.localeCompare(b.servicio)||a.email.localeCompare(b.email));
    return out;
  }catch{ return []; }
}
function saveLinkedAccounts(arr){
  try{
    const seen=new Set(); const clean=(Array.isArray(arr)?arr:[]).map(it=>({servicio:String(it.servicio||'').trim(),email:String(it.email||'').trim(),password:String(it.password||'')}))
      .filter(it=>it.servicio&&it.email&&it.password)
      .filter(it=>{const k=linkedCompositeKey(it.servicio,it.email); if(seen.has(k)) return false; seen.add(k); return true;})
      .sort((a,b)=> a.servicio.localeCompare(b.servicio)||a.email.localeCompare(b.email));
    localStorage.setItem(LINKED_ACCOUNTS_KEY, JSON.stringify(clean));
    return clean.slice();
  }catch{ return loadStoredLinkedAccounts(); }
}
let linkedAccounts = loadStoredLinkedAccounts();

/* index por servicio/email para consultas rápidas */
let linkedAccountsIndex = new Map();
function linkedIndexFrom(records){
  const idx=new Map();
  (records||[]).forEach(rec=>{
    const s=linkedServiceKey(rec.servicio), e=linkedEmailKey(rec.email);
    if(!s||!e) return;
    if(!idx.has(s)) idx.set(s,new Map());
    idx.get(s).set(e,{ ...rec });
  });
  return idx;
}
function updateLinkedAccountsFrom(records){
  linkedAccountsIndex = linkedIndexFrom(records);
  rebuildEmailSuggestions(); // actualiza principal
}
updateLinkedAccountsFrom(linkedAccounts);

function getLinkedAccountsByService(servicio){
  const bucket = linkedAccountsIndex.get(linkedServiceKey(servicio||'')); if(!bucket) return [];
  return Array.from(bucket.values()).map(v=>({ ...v }));
}
function findLinkedAccount(servicio,email){
  const b=linkedAccountsIndex.get(linkedServiceKey(servicio||'')); if(!b) return null;
  const v=b.get(linkedEmailKey(email)); return v? { ...v }:null;
}

/* ====== Semillas / almacenamiento local de servicios (fallback si no hay sesión) ====== */
const defaultServices = ["ChatGPT","Gemini","YouTube","Disney"];
let localServices = JSON.parse(localStorage.getItem('services_local') || 'null');
if (!Array.isArray(localServices) || !localServices.length) {
  localServices = defaultServices.slice();
  localStorage.setItem('services_local', JSON.stringify(localServices));
}
function saveLocalServices() {
  localServices = Array.from(new Set(localServices)).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  localStorage.setItem('services_local', JSON.stringify(localServices));
}

/* ===== clientes locales ===== */
const LOCAL_CLIENTS_KEY = 'clients_local_v1';
function loadLocalClients(){
  try{
    const raw=localStorage.getItem(LOCAL_CLIENTS_KEY); if(!raw) return [];
    const arr=JSON.parse(raw)||[];
    arr.sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''));
    return arr;
  }catch{ return []; }
}
let localClients = loadLocalClients();
function saveLocalClients(){
  try{
    localStorage.setItem(LOCAL_CLIENTS_KEY, JSON.stringify(localClients.slice().sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||''))));
  }catch{}
}

/* ====== AUTH (Supabase) ====== */
let currentUser = null;
sb.auth.onAuthStateChange((_e, session)=>{
  currentUser = session?.user || null;
  authUpdateUI();
  syncLocalServicesToCloudIfEmpty().finally(()=>{
    renderServicios().then(renderTabla);
  });
});
function authUpdateUI(){
  const badge = document.getElementById('userInfo');
  const btnAuthOpen = document.getElementById('btnAuthOpen');
  const btnLogout = document.getElementById('btnLogout');
  if(currentUser){
    badge.style.display='inline-block';
    badge.textContent = currentUser.email;
    btnAuthOpen.style.display='none';
    btnLogout.style.display='inline-block';
  }else{
    badge.style.display='none';
    btnAuthOpen.style.display='inline-block';
    btnLogout.style.display='none';
  }
}
const authModal    = document.getElementById('authModal');
const btnAuthOpen  = document.getElementById('btnAuthOpen');
const btnAuthClose = document.getElementById('btnAuthClose');
const btnAuthSubmit= document.getElementById('btnAuthSubmit');
const authEmailEl  = document.getElementById('authEmail');
const authPassEl   = document.getElementById('authPass');
const authErrorEl  = document.getElementById('authError');
const toggleAuthPass = document.getElementById('toggleAuthPass');
const btnForgot    = document.getElementById('btnForgot');

function openAuth(){ authErrorEl.textContent=''; authErrorEl.style.color='var(--danger)'; authModal.classList.add('open'); authModal.setAttribute('aria-hidden','false'); setTimeout(()=>authEmailEl?.focus(), 0); }
function closeAuth(){ authModal.classList.remove('open'); authModal.setAttribute('aria-hidden','true'); }
btnAuthOpen?.addEventListener('click', openAuth);
btnAuthClose?.addEventListener('click', closeAuth);
authModal?.addEventListener('click', (e)=>{ if(e.target===authModal) closeAuth(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeAuth(); });

toggleAuthPass?.addEventListener('click', ()=>{
  const isPass = authPassEl.type==='password';
  authPassEl.type = isPass? 'text':'password';
  toggleAuthPass.textContent = isPass? '🙈':'👁';
});

// sign-in/up unificado
async function autoSignInOrUp(email, password) {
  let { error } = await sb.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  const { data, error: eUp } = await sb.auth.signUp({ email, password });
  if (eUp) return { ok: false, message: eUp.message };
  if (!data.session) {
    const { error: eIn2 } = await sb.auth.signInWithPassword({ email, password });
    if (eIn2) return { ok: false, message: eIn2.message };
  }
  return { ok: true };
}
btnAuthSubmit?.addEventListener('click', async () => {
  const email = (authEmailEl.value || '').trim();
  const pass  = (authPassEl.value || '').trim();
  authErrorEl.textContent = ''; authErrorEl.style.color = 'var(--danger)';
  if (!email || !pass) { authErrorEl.textContent = 'Completa correo y contraseña.'; return; }
  btnAuthSubmit.disabled = true; btnAuthSubmit.textContent = 'Procesando…';
  try{
    const r = await autoSignInOrUp(email, pass);
    if (!r.ok) authErrorEl.textContent = r.message || 'No se pudo acceder.';
    else { closeAuth(); toast('¡Bienvenido!'); }
  }catch(err){ authErrorEl.textContent = err.message || 'Error inesperado.'; }
  finally{ btnAuthSubmit.disabled = false; btnAuthSubmit.textContent = 'Continuar'; }
});
document.getElementById('btnLogout')?.addEventListener('click', async ()=>{ await sb.auth.signOut(); });

// reset pass
btnForgot?.addEventListener('click', async ()=>{
  const email = (authEmailEl.value||'').trim();
  authErrorEl.style.color = 'var(--danger)'; authErrorEl.textContent = '';
  if(!email){ authErrorEl.textContent = 'Escribe tu correo arriba para enviarte el enlace.'; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if(error){ authErrorEl.textContent = error.message || 'No se pudo enviar el correo de recuperación.'; return; }
  authErrorEl.style.color = 'var(--success)'; authErrorEl.textContent = 'Te enviamos un correo para restablecer tu contraseña.';
});

/* ====== DB en la nube (Supabase) ====== */
let cacheClientes = localClients.slice();
let cacheServicios = [];
const db = {
  getAll(){ return currentUser ? cacheClientes.slice() : localClients.slice(); },
  async fetchAll(){
    if(!currentUser){
      localClients = loadLocalClients();
      cacheClientes = localClients.slice();
      return cacheClientes.slice();
    }
    const { data, error } = await sb.from('clients').select('*').eq('user_id', currentUser.id).order('nombre', { ascending:true });
    if(error){ console.error(error); cacheClientes=[]; return cacheClientes; }
    cacheClientes = data||[]; return cacheClientes.slice();
  },
  async saveOne(rec){
    if(!currentUser){
      localClients = loadLocalClients();
      const recId = rec.id ?? crypto.randomUUID();
      const idx = localClients.findIndex(x=>x.id===recId);
      const payload = { ...(idx>=0? localClients[idx]:{}), ...rec, id: recId };
      if(idx>=0) localClients[idx] = payload; else localClients.push(payload);
      localClients.sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'')); saveLocalClients();
      cacheClientes = localClients.slice(); return payload;
    }
    const rowNoId = {
      user_id: currentUser.id,
      nombre:rec.nombre, email:rec.email, telefono:rec.telefono, servicio:rec.servicio,
      inicio:rec.inicio, vence:rec.vence, categoria:rec.categoria, notas:rec.notas, pin:rec.pin, ts:rec.ts
    };
    let data, error; const hasId = rec.id!==undefined && rec.id!==null && `${rec.id}`.trim()!=='';
    if (!hasId) ({ data, error } = await sb.from('clients').insert(rowNoId).select().single());
    else {
      ({ data, error } = await sb.from('clients').update(rowNoId).eq('id', rec.id).select().single());
      if (error) ({ data, error } = await sb.from('clients').upsert({ ...rowNoId, id: rec.id }, { onConflict: 'id' }).select().single());
    }
    if (error) throw error;
    const i = cacheClientes.findIndex(x=>x.id===data.id);
    if(i>=0) cacheClientes[i]=data; else cacheClientes.push(data);
    cacheClientes.sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'')); return data;
  },
  async deleteOne(id){
    if(!currentUser){
      localClients = loadLocalClients().filter(x=>x && x.id!==id); saveLocalClients(); cacheClientes = localClients.slice(); return;
    }
    const { error } = await sb.from('clients').delete().eq('id', id);
    if(error) throw error; cacheClientes = cacheClientes.filter(x=>x.id!==id);
  },
  async saveAll(arr){
    if(!currentUser){
      localClients = arr.map(x=>({ ...x })); localClients.sort((a,b)=> (a.nombre||'').localeCompare(b.nombre||'')); saveLocalClients(); cacheClientes = localClients.slice(); return;
    }
    const rows = arr.map(x=>({ ...x, user_id: currentUser.id }));
    const { error } = await sb.from('clients').upsert(rows, { onConflict:'id' });
    if(error) throw error; cacheClientes = arr.slice();
  },
  getServicios(){ return currentUser ? cacheServicios.slice() : localServices.slice(); },
  async fetchServicios(){
    if (!currentUser) return localServices.slice();
    const { data, error } = await sb.from('services').select('name').eq('user_id', currentUser.id).order('name');
    if(error){ console.error(error); cacheServicios = []; return []; }
    cacheServicios = (data||[]).map(x=>x.name); return cacheServicios.slice();
  },
  async replaceServicios(list){
    if (!currentUser) { localServices = list.slice(); saveLocalServices(); return; }
    const { data: curr } = await sb.from('services').select('name').eq('user_id', currentUser.id);
    const has = new Set((curr||[]).map(x=>x.name)); const want = new Set(list);
    const toDel = [...has].filter(n=>!want.has(n)); if (toDel.length) await sb.from('services').delete().in('name', toDel).eq('user_id', currentUser.id);
    const toIns = [...want].filter(n=>!has.has(n)).map(n=>({ user_id: currentUser.id, name:n })); if (toIns.length) await sb.from('services').insert(toIns);
    cacheServicios = list.slice();
  }
};
async function syncLocalServicesToCloudIfEmpty(){
  if (!currentUser) return;
  const cloud = await db.fetchServicios();
  if (cloud.length === 0 && localServices.length) { await db.replaceServicios(localServices); localStorage.removeItem('services_local'); }
}

/* ====== UI dinámica ====== */
async function renderServicios(sel){
  const list = await db.fetchServicios();
  const final = list.length ? list : defaultServices;
  f.servicio.innerHTML = final.map(s=>`<option value="${s}">${s}</option>`).join('');
  if(sel && final.includes(sel)) f.servicio.value=sel; else if(final.length) f.servicio.value=final[0]; else f.servicio.value='';
  rebuildEmailSuggestions();
  handleEmailSuggestionSelection();
}
async function renderTabla(){
  const arr = await db.fetchAll();
  const items=arr.filter(x=>coincide(x,q?.value)&&pasaEstado(x,filterEstado?.value))
                 .sort((a,b)=> (diasRestantes(a.vence)??1e9) - (diasRestantes(b.vence)??1e9));
  tbody.innerHTML=items.map(x=>{
    const d=diasRestantes(x.vence); const est=estadoDe(x.vence);
    const tag=est==='vigente'?'ok':est==='pronto'?'warn':'bad';
    const estTxt=est?est[0].toUpperCase()+est.slice(1):'-';
    const diasTxt= d==null?'-':(d<0?`Vencido ${Math.abs(d)} d`:`Faltan ${d} d`);
    const horaTxt=fmtHora(x.ts);
    const countdownTxt=cuentaRegresiva(x.vence);
    return `<tr class="has-row-menu" tabindex="0" aria-haspopup="menu" aria-expanded="false">
      <td data-label="Nombre">${esc(x.nombre)}</td>
      <td data-label="Email">${esc(x.email||'')}</td>
      <td data-label="Servicio">${esc(x.servicio||'')}</td>
      <td data-label="Inicio">${fmt(x.inicio)}</td>
      <td data-label="Vence">${fmt(x.vence)}</td>
      <td data-label="Estado">${est?`<span class="tag ${tag}">${estTxt}</span>`:'-'}</td>
      <td data-label="Días">${diasTxt}</td>
      <td data-label="Acciones" class="cell-actions">
        <div class="menu-wrap">
          <div class="row-menu-indicator" aria-hidden="true"><span class="dots">⋯</span></div>
          <div class="menu" role="menu" aria-hidden="true">
            <div class="menu-info">
              <div class="menu-info-row">
                <span class="menu-info-label">Registrado</span>
                <span class="menu-info-value">${esc(horaTxt)}</span>
              </div>
              <div class="menu-info-row">
                <span class="menu-info-label">Tiempo restante</span>
                <span class="menu-info-value">${esc(countdownTxt)}</span>
              </div>
            </div>
            <button class="menu-item" role="menuitem" data-action="edit" data-id="${x.id}">✎ Editar</button>
            <button class="menu-item" role="menuitem" data-action="label" data-id="${x.id}">🏷 Etiqueta</button>
            <button class="menu-item danger" role="menuitem" data-action="delete" data-id="${x.id}">🗑 Eliminar</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
}
function coincide(x,qq){
  qq=(qq||'').trim().toLowerCase(); if(!qq) return true;
  return [x.nombre,x.email,x.servicio,x.telefono,x.categoria,x.notas].some(v=>(v||'').toLowerCase().includes(qq));
}
function pasaEstado(x,f){ if(!f) return true; return estadoDe(x.vence)===f; }

$('#btnLimpiar').onclick=limpiar;

/* ===== EMAIL dropdown (principal) ===== */
function rebuildEmailSuggestions(){
  emailSuggestionCache = getLinkedAccountsByService(f.servicio?.value||'');
}
function isEmailSuggestionDropdownOpen(){ return emailSuggestionDropdown?.classList.contains('open'); }
function hideEmailSuggestionDropdown(){
  if(!emailSuggestionDropdown) return;
  emailSuggestionDropdown.classList.remove('open');
  emailSuggestionDropdown.setAttribute('aria-hidden','true');
  f.email?.setAttribute('aria-expanded','false');
  if(emailDropdownToggle) emailDropdownToggle.setAttribute('aria-expanded','false');
  emailSuggestionDropdown.innerHTML=''; filteredEmailSuggestions=[]; activeEmailSuggestionIndex=-1;
  if(hideEmailSuggestionTimeout){ clearTimeout(hideEmailSuggestionTimeout); hideEmailSuggestionTimeout=null; }
}
function updateEmailSuggestionDropdown(filterText){
  if(!emailSuggestionDropdown) return;
  const term = typeof filterText==='string'? filterText.trim().toLowerCase() : (f.email?.value||'').trim().toLowerCase();
  filteredEmailSuggestions = (emailSuggestionCache||[]).filter(item=> !term || item.email.toLowerCase().includes(term));

  if(!filteredEmailSuggestions.length){
    emailSuggestionDropdown.innerHTML=`<div class="suggestion-empty">${esc(term ? 'Sin coincidencias' : 'Sin correos enlazados')}</div>`;
  }else{
    emailSuggestionDropdown.innerHTML = filteredEmailSuggestions.map((item,idx)=>{
      const hint=item.password? '<span class="suggestion-hint">Contraseña guardada</span>':'';
      return `<button type="button" class="suggestion-item" data-index="${idx}" role="option" id="emailopt-${idx}">
                <span class="suggestion-email">${esc(item.email)}</span>${hint}
              </button>`;
    }).join('');
    Array.from(emailSuggestionDropdown.querySelectorAll('.suggestion-item')).forEach(btn=>{
      btn.addEventListener('mousedown',e=>e.preventDefault());
      btn.addEventListener('click',()=> selectEmailSuggestion(Number(btn.dataset.index)));
    });
  }
  emailSuggestionDropdown.classList.add('open');
  emailSuggestionDropdown.setAttribute('aria-hidden','false');
  f.email?.setAttribute('aria-expanded','true');
  if(emailDropdownToggle) emailDropdownToggle.setAttribute('aria-expanded','true');
  activeEmailSuggestionIndex=-1;
}
function highlightEmailSuggestion(idx){
  if(!emailSuggestionDropdown) return;
  const items=Array.from(emailSuggestionDropdown.querySelectorAll('.suggestion-item'));
  items.forEach((el,i)=>{ el.classList.toggle('is-active', i===idx); if(i===idx){ el.setAttribute('aria-selected','true'); f.email?.setAttribute('aria-activedescendant', el.id); } else { el.removeAttribute('aria-selected'); }});
  if(idx>=0 && items[idx]) items[idx].scrollIntoView({ block:'nearest' });
}
function moveEmailSuggestion(delta){
  if(!filteredEmailSuggestions.length){ updateEmailSuggestionDropdown(); if(!filteredEmailSuggestions.length) return; }
  if(!isEmailSuggestionDropdownOpen()) updateEmailSuggestionDropdown();
  activeEmailSuggestionIndex=(activeEmailSuggestionIndex+delta+filteredEmailSuggestions.length)%filteredEmailSuggestions.length;
  highlightEmailSuggestion(activeEmailSuggestionIndex);
}
function selectEmailSuggestion(idx){
  const account=filteredEmailSuggestions[idx]; if(!account) return;
  if(f.email) f.email.value=account.email;
  applyLinkedAccount(account);
  handleEmailSuggestionSelection();
  hideEmailSuggestionDropdown();
}
function showEmailSuggestions(){
  rebuildEmailSuggestions();
  updateEmailSuggestionDropdown(f.email.value);
}
function applyLinkedAccount(account){
  if(!account) return;
  if(account.password && f.pin && (!f.pin.value||f.pin.value.trim()==='')) f.pin.value=account.password;
}

/* eventos principal */
if(f.servicio){ ['change','input'].forEach(evt=> f.servicio.addEventListener(evt, ()=>{
  rebuildEmailSuggestions(); handleEmailSuggestionSelection();
  if(document.activeElement===f.email) showEmailSuggestions(); else hideEmailSuggestionDropdown();
}));}
if(f.email){
  f.email.addEventListener('focus',()=>{ showEmailSuggestions(); });
  f.email.addEventListener('click',()=>{ showEmailSuggestions(); });
  f.email.addEventListener('input',()=>{ updateEmailSuggestionDropdown(f.email.value); handleEmailSuggestionSelection(); });
  f.email.addEventListener('change',()=>{ handleEmailSuggestionSelection(); });
  f.email.addEventListener('keydown',(e)=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); moveEmailSuggestion(1); }
    else if(e.key==='ArrowUp'){ if(isEmailSuggestionDropdownOpen()){ e.preventDefault(); moveEmailSuggestion(-1); } }
    else if(e.key==='Enter'){ if(isEmailSuggestionDropdownOpen() && activeEmailSuggestionIndex>=0){ e.preventDefault(); selectEmailSuggestion(activeEmailSuggestionIndex); } }
    else if(e.key==='Escape'){ if(isEmailSuggestionDropdownOpen()){ e.preventDefault(); hideEmailSuggestionDropdown(); } }
  });
  f.email.addEventListener('blur',()=>{ hideEmailSuggestionTimeout=setTimeout(()=>hideEmailSuggestionDropdown(),120); });
}
emailSuggestionDropdown?.addEventListener('mouseenter',()=>{ if(hideEmailSuggestionTimeout){ clearTimeout(hideEmailSuggestionTimeout); hideEmailSuggestionTimeout=null; }});
emailSuggestionDropdown?.addEventListener('mouseleave',()=>{ hideEmailSuggestionTimeout=setTimeout(()=>hideEmailSuggestionDropdown(),120); });
emailDropdownToggle?.addEventListener('click', (e)=>{ e.preventDefault(); if(isEmailSuggestionDropdownOpen()) hideEmailSuggestionDropdown(); else showEmailSuggestions(); });

/* selección contextual */
function handleEmailSuggestionSelection(){
  if(!f.email||!f.servicio) return;
  const servicioActual=f.servicio.value;
  const emailActual=(f.email.value||'').trim();
  if(!servicioActual||!emailActual) return;
  const account=findLinkedAccount(servicioActual,emailActual);
  if(account) applyLinkedAccount(account);
}

/* ===== Modal Correos enlazados (dropdown similar) ===== */
function populateLinkedServices(){
  if(!linkedServiceEl) return;
  const previous = linkedServiceEl.value;
  let servicios = [];
  return db.fetchServicios().then(list=>{
    servicios = Array.from(new Set((Array.isArray(list)? list:[]).filter(Boolean).map(String)));
    linkedServiceEl.innerHTML = '';
    if(!servicios.length){
      const option = document.createElement('option'); option.value=''; option.textContent='No hay servicios disponibles'; option.disabled=true; option.selected=true;
      linkedServiceEl.appendChild(option); linkedServiceEl.disabled=true;
      linkedEmailEl.value=''; linkedEmailEl.disabled=true; linkedPasswordEl.value=''; linkedPasswordEl.disabled=true;
      btnLinkedSave.disabled = true; btnLinkedDelete.disabled = true; linkedErrorEl.textContent = 'Agrega servicios para enlazar correos.'; return;
    }
    linkedServiceEl.disabled=false; linkedEmailEl.disabled=false; linkedPasswordEl.disabled=false;
    btnLinkedSave.disabled=false; btnLinkedDelete.disabled=true; linkedErrorEl.textContent='';
    const placeholder = document.createElement('option'); placeholder.value=''; placeholder.textContent='Selecciona un servicio'; linkedServiceEl.appendChild(placeholder);
    servicios.forEach(s=>{ const opt=document.createElement('option'); opt.value=s; opt.textContent=s; linkedServiceEl.appendChild(opt); });
    let next = previous && servicios.includes(previous) ? previous : (linkedAccounts.find(it=>servicios.includes(it.servicio))?.servicio || servicios[0] || '');
    if(next) linkedServiceEl.value = next;
    applyLinkedAccountToForm(next);
    refreshLinkedEmailDropdown();
  });
}
function openLinkedModal(){
  if(!linkedModal) return;
  linkedErrorEl.textContent=''; linkedModal.classList.add('open'); linkedModal.setAttribute('aria-hidden','false');
  populateLinkedServices().finally(()=> setTimeout(()=> linkedServiceEl?.focus(),0));
}
function closeLinkedModal(){
  linkedModal.classList.remove('open'); linkedModal.setAttribute('aria-hidden','true');
  if(linkedPasswordEl) linkedPasswordEl.type='password';
}
btnLinkedOpen?.addEventListener('click', openLinkedModal);
btnLinkedHeaderClose?.addEventListener('click', closeLinkedModal);
linkedModal?.addEventListener('click', (e)=>{ if(e.target===linkedModal) closeLinkedModal(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeLinkedModal(); });

function applyLinkedAccountToForm(servicio){
  linkedEmailEl.value=''; linkedPasswordEl.value=''; linkedPasswordEl.type='password'; btnLinkedDelete.disabled=true; refreshLinkedEmailDropdown();
}
function syncLinkedEmailState({resetPassword=true}={}){
  const servicio=linkedServiceEl?.value||''; const email=(linkedEmailEl?.value||'').trim(); const account=servicio&&email? findLinkedAccount(servicio,email):null;
  if(linkedPasswordEl){
    if(account) linkedPasswordEl.value = account.password || ''; else if(resetPassword) linkedPasswordEl.value = '';
    linkedPasswordEl.type='password';
  }
  btnLinkedDelete.disabled = !account;
  return account;
}
toggleLinkedPassword?.addEventListener('click', ()=>{
  const isPass = linkedPasswordEl.type==='password';
  linkedPasswordEl.type = isPass? 'text':'password';
  toggleLinkedPassword.textContent = isPass? '🙈':'👁';
});
linkedServiceEl?.addEventListener('change', ()=>{ applyLinkedAccountToForm(linkedServiceEl.value); });

/* dropdown enlazados helpers */
function isLinkedDropdownOpen(){ return linkedEmailDropdown?.classList.contains('open'); }
function hideLinkedEmailDropdown(){
  if(!linkedEmailDropdown) return;
  linkedEmailDropdown.classList.remove('open');
  linkedEmailDropdown.setAttribute('aria-hidden','true');
  linkedEmailEl?.setAttribute('aria-expanded','false');
  linkedEmailDropdown.innerHTML=''; linkedFilteredSuggestions=[]; linkedActiveIndex=-1;
  if(linkedHideTimeout){ clearTimeout(linkedHideTimeout); linkedHideTimeout=null; }
}
function refreshLinkedEmailDropdown(){
  const servicioActual = linkedServiceEl?.value || '';
  const cache = getLinkedAccountsByService(servicioActual);
  const term = (linkedEmailEl?.value || '').trim().toLowerCase();
  linkedFilteredSuggestions = cache.filter(item=> !term || item.email.toLowerCase().includes(term));
  if(!linkedEmailDropdown) return;
  if(!linkedFilteredSuggestions.length){
    linkedEmailDropdown.innerHTML=`<div class="suggestion-empty">${esc(term?'Sin coincidencias':'Sin correos enlazados')}</div>`;
  }else{
    linkedEmailDropdown.innerHTML = linkedFilteredSuggestions.map((item,idx)=>{
      const hint=item.password? '<span class="suggestion-hint">Contraseña guardada</span>':'';
      return `<button type="button" class="suggestion-item" data-index="${idx}" role="option" id="linkedopt-${idx}">
                <span class="suggestion-email">${esc(item.email)}</span>${hint}
              </button>`;
    }).join('');
    Array.from(linkedEmailDropdown.querySelectorAll('.suggestion-item')).forEach(btn=>{
      btn.addEventListener('mousedown',e=>e.preventDefault());
      btn.addEventListener('click',()=> linkedSelectEmailSuggestion(Number(btn.dataset.index)));
    });
  }
}
function showLinkedEmailDropdown(){
  refreshLinkedEmailDropdown();
  linkedEmailDropdown.classList.add('open');
  linkedEmailDropdown.setAttribute('aria-hidden','false');
  linkedEmailEl?.setAttribute('aria-expanded','true');
  linkedActiveIndex=-1;
}
function linkedHighlight(idx){
  const items=Array.from(linkedEmailDropdown.querySelectorAll('.suggestion-item'));
  items.forEach((el,i)=>{ el.classList.toggle('is-active', i===idx); if(i===idx){ el.setAttribute('aria-selected','true'); linkedEmailEl?.setAttribute('aria-activedescendant', el.id); } else { el.removeAttribute('aria-selected'); } });
  if(idx>=0 && items[idx]) items[idx].scrollIntoView({ block:'nearest' });
}
function linkedMove(delta){
  if(!linkedFilteredSuggestions.length){ refreshLinkedEmailDropdown(); if(!linkedFilteredSuggestions.length) return; }
  if(!isLinkedDropdownOpen()) showLinkedEmailDropdown();
  linkedActiveIndex=(linkedActiveIndex+delta+linkedFilteredSuggestions.length)%linkedFilteredSuggestions.length;
  linkedHighlight(linkedActiveIndex);
}
function linkedSelectEmailSuggestion(idx){
  const account=linkedFilteredSuggestions[idx]; if(!account) return;
  linkedEmailEl.value=account.email;
  const acc = syncLinkedEmailState({ resetPassword:false });
  if(acc?.password && (!linkedPasswordEl.value || linkedPasswordEl.value.trim()==='')) linkedPasswordEl.value = acc.password;
  hideLinkedEmailDropdown();
}

/* eventos modal enlazados */
linkedEmailEl?.addEventListener('focus', showLinkedEmailDropdown);
linkedEmailEl?.addEventListener('click', showLinkedEmailDropdown);
linkedEmailEl?.addEventListener('input', ()=>{ refreshLinkedEmailDropdown(); syncLinkedEmailState({ resetPassword:true }); });
linkedEmailEl?.addEventListener('change', ()=>{ syncLinkedEmailState({ resetPassword:true }); });
linkedEmailEl?.addEventListener('keydown', (e)=>{
  if(e.key==='ArrowDown'){ e.preventDefault(); linkedMove(1); }
  else if(e.key==='ArrowUp'){ if(isLinkedDropdownOpen()){ e.preventDefault(); linkedMove(-1); } }
  else if(e.key==='Enter'){ if(isLinkedDropdownOpen() && linkedActiveIndex>=0){ e.preventDefault(); linkedSelectEmailSuggestion(linkedActiveIndex); } }
  else if(e.key==='Escape'){ if(isLinkedDropdownOpen()){ e.preventDefault(); hideLinkedEmailDropdown(); } }
});
linkedEmailEl?.addEventListener('blur', ()=>{ linkedHideTimeout=setTimeout(()=>hideLinkedEmailDropdown(),120); });
linkedEmailDropdown?.addEventListener('mouseenter', ()=>{ if(linkedHideTimeout){ clearTimeout(linkedHideTimeout); linkedHideTimeout=null; }});
linkedEmailDropdown?.addEventListener('mouseleave', ()=>{ linkedHideTimeout=setTimeout(()=>hideLinkedEmailDropdown(),120); });
linkedEmailDropdownToggle?.addEventListener('click', (e)=>{ e.preventDefault(); if(isLinkedDropdownOpen()) hideLinkedEmailDropdown(); else showLinkedEmailDropdown(); });

btnLinkedSave?.addEventListener('click', ()=>{
  const servicio = linkedServiceEl.value;
  const email = linkedEmailEl.value.trim();
  const password = linkedPasswordEl.value;
  linkedErrorEl.textContent='';
  if(!servicio){ linkedErrorEl.textContent='Selecciona un servicio.'; linkedServiceEl.focus(); return; }
  if(!email){ linkedErrorEl.textContent='Ingresa un correo válido.'; linkedEmailEl.focus(); return; }
  if(!password){ linkedErrorEl.textContent='Ingresa una contraseña.'; linkedPasswordEl.focus(); return; }
  const payload={ servicio, email, password };
  const idx = linkedAccounts.findIndex(it=>linkedCompositeKey(it.servicio,it.email)===linkedCompositeKey(servicio,email));
  if(idx>=0) linkedAccounts[idx]=payload; else linkedAccounts.push(payload);
  linkedAccounts = saveLinkedAccounts(linkedAccounts);
  updateLinkedAccountsFrom(linkedAccounts); // actualiza índice y principal
  toast('Correo enlazado guardado ✓'); closeLinkedModal();
});
btnLinkedDelete?.addEventListener('click', ()=>{
  const servicio=linkedServiceEl.value, email=linkedEmailEl.value.trim();
  linkedErrorEl.textContent=''; if(!servicio||!email){ linkedErrorEl.textContent='Selecciona un servicio y correo guardado.'; return; }
  const key=linkedCompositeKey(servicio,email);
  const idx=linkedAccounts.findIndex(it=>linkedCompositeKey(it.servicio,it.email)===key);
  if(idx<0){ toast('No hay correo enlazado para eliminar.'); return; }
  linkedAccounts.splice(idx,1);
  linkedAccounts = saveLinkedAccounts(linkedAccounts);
  updateLinkedAccountsFrom(linkedAccounts);
  linkedEmailEl.value=''; linkedPasswordEl.value=''; btnLinkedDelete.disabled=true;
  refreshLinkedEmailDropdown();
  toast('Correo enlazado eliminado ✓');
});

/* ===== Acciones tabla ===== */
$('#btnGuardar').onclick = async ()=>{
  const isEdit = editId!==null && editId!==undefined;
  const current = isEdit ? db.getAll().find(c=>c.id===editId) : null;
  const ts = isEdit ? current?.ts : Date.now();
  const data={
    nombre:f.nombre.value.trim(), email:f.email.value.trim(), telefono:f.telefono.value.trim(),
    servicio:f.servicio.value, inicio:f.inicio.value, vence:f.vence.value,
    categoria:f.categoria.value, notas:f.notas.value.trim(), pin:f.pin.value.trim(), ts
  };
  if(isEdit) data.id = editId;
  if(!data.nombre){ toast('Escribe un nombre'); return; }
  const wasGuest = !currentUser;
  try{
    await db.saveOne(data); await renderTabla(); limpiar();
    toast(wasGuest && !currentUser ? 'Guardado local ✓  Accede para sincronizar' : 'Guardado ✓');
  }catch(err){ toast(err?.message || 'No se pudo guardar.'); }
};
function editar(id){
  const x=db.getAll().find(c=>c.id===id); if(!x) return; editId=x.id;
  for(const k in f){ if(k in x) f[k].value=x[k]||''; }
  msg.textContent='Editando… guarda para aplicar cambios';
}
async function borrar(id){
  if(!confirm('¿Eliminar este cliente?')) return;
  await db.deleteOne(id); await renderTabla();
}

/* Menús (kebab + tema) + cierre fuera de la fila activa */
function getMenuController(menu){
  if(!menu) return null;
  const wrap=menu.closest('.menu-wrap');
  if(wrap){ const control=wrap.querySelector('[aria-haspopup="menu"]'); if(control) return control; }
  return menu.closest('tr.has-row-menu');
}
function setMenuState(menu,isOpen){
  if(!menu) return;
  if(isOpen){ menu.classList.add('open'); menu.setAttribute('aria-hidden','false'); }
  else{ menu.classList.remove('open'); menu.setAttribute('aria-hidden','true'); }
  const controller=getMenuController(menu);
  if(controller){ controller.setAttribute('aria-expanded',isOpen?'true':'false'); }
}
function closeAllMenus(except=null){
  document.querySelectorAll('.menu.open').forEach(menu=>{
    if(except && menu===except) return; setMenuState(menu,false);
  });
}
document.addEventListener('click',(e)=>{
  const wrap=e.target.closest('.menu-wrap');
  const toggle=e.target.closest('[data-menu-toggle]');
  const item=e.target.closest('.menu-item');
  const rowTrigger=e.target.closest('tr.has-row-menu');

  if(toggle){
    const menu=toggle.closest('.menu-wrap')?.querySelector('.menu'); if(!menu) return;
    const isOpen=menu.classList.contains('open');
    if(isOpen) setMenuState(menu,false); else { closeAllMenus(menu); setMenuState(menu,true); }
    return;
  }
  if(item){
    if(item.dataset.themeOption){ applyTheme(item.dataset.themeOption); }
    else{
      const id=item.dataset.id;
      if(item.dataset.action==='edit') editar(id);
      else if(item.dataset.action==='label') etiquetar(id);
      else if(item.dataset.action==='delete') borrar(id);
    }
    closeAllMenus(); return;
  }

  // Cierra si haces clic FUERA de la fila activa
  const openMenu = document.querySelector('.menu.open');
  if(openMenu){
    const openRow = openMenu.closest('tr.has-row-menu');
    if(!rowTrigger || rowTrigger !== openRow){ setMenuState(openMenu,false); }
  }

  // Si clicas completamente fuera de cualquier fila/menu, cierra todo
  if(!wrap && !rowTrigger){ closeAllMenus(); }
});
if(tbody){
  tbody.addEventListener('click',(e)=>{
    const row=e.target.closest('tr.has-row-menu'); if(!row || !tbody.contains(row)) return;
    if(e.target.closest('.menu')) return;
    const menu=row.querySelector('.menu'); if(!menu) return;
    const isOpen=menu.classList.contains('open');
    if(isOpen) setMenuState(menu,false); else { closeAllMenus(menu); setMenuState(menu,true); }
  });
  tbody.addEventListener('keydown',(e)=>{
    if(e.key!=='Enter' && e.key!==' ') return;
    const row=e.target.closest('tr.has-row-menu'); if(!row || !tbody.contains(row)) return;
    const menu=row.querySelector('.menu'); if(!menu) return;
    e.preventDefault();
    const isOpen=menu.classList.contains('open');
    if(isOpen){ setMenuState(menu,false); } else { closeAllMenus(menu); setMenuState(menu,true); const first=menu.querySelector('.menu-item'); first?.focus(); }
  });
}
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeAllMenus(); });

/* ===== Botones + y − de servicios ===== */
$('#btnAgregarServicio').onclick = async ()=>{
  const nombre = (prompt('Nombre del nuevo servicio:') || '').trim();
  if (!nombre) return;
  const actuales = await db.fetchServicios();
  if (!actuales.includes(nombre)) {
    actuales.push(nombre); actuales.sort((a,b)=>a.localeCompare(b)); await db.replaceServicios(actuales);
    toast(currentUser ? 'Servicio agregado ✓' : 'Servicio agregado (local) ✓  Accede para guardar en la nube');
    await renderServicios(nombre);
  } else { await renderServicios(nombre); toast('Ese servicio ya existe'); }
};
$('#btnEliminarServicio').onclick = async ()=>{
  const current = f.servicio.value; if (!current) { toast('No hay servicio seleccionado'); return; }
  const actuales = await db.fetchServicios(); if (!actuales.includes(current)) { toast('Ese servicio no está en la lista'); return; }
  if (!confirm(`¿Eliminar "${current}" de la lista de servicios?\n(No afecta a los clientes ya guardados).`)) return;
  const nueva = actuales.filter(s => s !== current); await db.replaceServicios(nueva);
  toast(currentUser ? 'Servicio eliminado ✓' : 'Servicio eliminado (local) ✓  Accede para guardar en la nube'); await renderServicios();
};

/* Mostrar/Ocultar PIN (form) */
document.getElementById('togglePin')?.addEventListener('click',()=>{ const el=f.pin; const isPass=el.type==='password'; el.type=isPass?'text':'password'; document.getElementById('togglePin').textContent=isPass?'🙈':'👁'; });

/* ===== Chat (Gemini) ===== */
const CHATGPT_API_KEY = 'sk-TESTKEY1234567890';
const CHATGPT_MODEL  = 'gpt-4o-mini';
const chatModal = document.getElementById('chatModal');
const btnChatOpen = document.getElementById('btnChatOpen');
const btnChatClose = document.getElementById('btnChatClose');
const chatLogEl = document.getElementById('chatLog');
const chatInputEl = document.getElementById('chatInput');
const CHAT_INPUT_MAX_HEIGHT = 220;
const chatInputMinHeight = chatInputEl ? (()=>{
  const styles = window.getComputedStyle(chatInputEl);
  return parseFloat(styles.minHeight) || parseFloat(styles.height) || 0;
})() : 0;

function adjustChatInputHeight(){
  if(!chatInputEl) return;
  chatInputEl.style.height = 'auto';
  const fullHeight = chatInputEl.scrollHeight;
  const height = Math.max(Math.min(fullHeight, CHAT_INPUT_MAX_HEIGHT), chatInputMinHeight);
  chatInputEl.style.height = `${height}px`;
  chatInputEl.style.overflowY = fullHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
}
if(chatInputEl){
  adjustChatInputHeight();
  chatInputEl.addEventListener('input', adjustChatInputHeight);
}
let chatHistory;
try{
  const stored = JSON.parse(localStorage.getItem('chat_v1')||'[]');
  const cleaned = Array.isArray(stored)? stored.filter(m=>!m?.pending) : [];
  if(Array.isArray(stored) && stored.length!==cleaned.length){
    localStorage.setItem('chat_v1', JSON.stringify(cleaned));
  }
  chatHistory = cleaned;
}catch(_){ chatHistory = []; }

function clearChatHistory(){
  chatHistory = [];
  localStorage.setItem('chat_v1', '[]');
  renderChat();
  toast('Historial del chat vaciado ✓');
  chatInputEl?.focus();
}
document.getElementById('btnChatClear')?.addEventListener('click', clearChatHistory);

function openChat(){
  chatModal.classList.add('open');
  chatModal.setAttribute('aria-hidden','false');
  setTimeout(()=>{ adjustChatInputHeight(); chatInputEl?.focus(); }, 0);
}
function closeChat(){ chatModal.classList.remove('open'); chatModal.setAttribute('aria-hidden','true'); }
btnChatOpen?.addEventListener('click', openChat);
btnChatClose?.addEventListener('click', closeChat);
chatModal?.addEventListener('click', (e)=>{ if(e.target===chatModal) closeChat(); });
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeChat(); });

function renderChat(){
  if(!chatLogEl) return;
  if(!Array.isArray(chatHistory) || chatHistory.length===0){
    chatLogEl.classList.add('is-empty');
    chatLogEl.innerHTML = `
      <div class="chat-empty">
        <span class="chat-empty-emoji" aria-hidden="true">🤖</span>
        <h3>¡Hola! Soy Zyl0</h3>
        <p>Estoy listo para ayudarte. Escribe tu consulta para iniciar la conversación.</p>
      </div>
    `;
    chatLogEl.scrollTop = 0;
    return;
  }
  chatLogEl.classList.remove('is-empty');
  const html = chatHistory.map(m=>{
    const role = m?.role || 'user';
    const isKnownRole = role==='user' || role==='ai';
    const roleClass = role==='user'?'user':'ai';
    if(m?.pending || !isKnownRole){
      return `<div class="chat-msg ${roleClass} loading"><div class="bubble"><span class="chat-spinner" aria-hidden="true"></span><span class="sr-only">Generando respuesta…</span></div></div>`;
    }
    let content;
    if(roleClass==='ai'){
      const formatted = renderMarkdown(m?.text);
      content = formatted || (m?.text ? `<p>${esc(m?.text)}</p>` : '');
    }else{
      content = esc(m?.text);
    }
    return `<div class="chat-msg ${roleClass}"><div class="bubble">${content}</div></div>`;
  }).join('');
  chatLogEl.innerHTML = html;
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}
renderChat();

function clientToSafe(rec, includeSecrets){
  const d = (function(iso){ if(!iso) return null; const h=new Date();h.setHours(0,0,0,0); const dd=new Date(iso); dd.setHours(0,0,0,0); return Math.round((dd-h)/(1000*60*60*24)); })(rec.vence);
  const est = rec.vence? (d<0?'vencida':(d<=7?'pronto':'vigente')) : '';
  const out = { id:rec.id, nombre:rec.nombre||'', email:rec.email||'', telefono:rec.telefono||'', servicio:rec.servicio||'', inicio:rec.inicio||'', vence:rec.vence||'', categoria:rec.categoria||'', estado:est, dias:d };
  if(includeSecrets){ if(rec.pin) out.pin = rec.pin; if(rec.notas) out.notas = rec.notas; }
  return out;
}
function buildPrompt(userMsg){
  const includeSecrets = document.getElementById('shareSecrets')?.checked || false;
  const textNorm = normalize(userMsg);
  const clientes = db.getAll();
  const enriched = clientes.map(r=>clientToSafe(r, includeSecrets));
  const matches = enriched.filter(r=>{
    const n=normalize(r.nombre), e=normalize(r.email), s=normalize(r.servicio);
    return (n && textNorm.includes(n)) || (e && textNorm.includes(e)) || (s && textNorm.includes(s));
  });
  const context = (matches.length? matches.slice(0,10) : enriched.slice(0,50));
  const guidance = [
    'Eres un asistente que habla español y ayuda a gestionar clientes.',
    'Usa SOLO los datos proporcionados. Si algo no está en DATOS, di: "no está en mis registros".',
    'Si el usuario pide PIN y no existe el campo "pin" en los DATOS, responde brevemente que por seguridad no lo compartes a menos que el usuario habilite Compartir datos sensibles.',
    'Formatea las respuestas de ficha con etiquetas: Nombre, Email, Teléfono, Servicio, Inicio, Vence, Estado, Días, Categoría, Notas.'
  ];
  const prompt = [...guidance,'DATOS(JSON):',JSON.stringify(context),`PREGUNTA: ${userMsg}`].join('\n');
  return prompt;
}
async function requestChatGPT(prompt){
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization': `Bearer ${CHATGPT_API_KEY}`
    },
    body: JSON.stringify({
      model: CHATGPT_MODEL,
      messages: [{ role:'user', content: prompt }]
    })
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '(sin respuesta)';
}
async function sendChat(){
  const text = (chatInputEl?.value||'').trim(); if(!text) return;
  chatHistory.push({ role:'user', text });
  chatInputEl.value='';
  adjustChatInputHeight();
  const pendingIndex = chatHistory.push({ role:'ai', pending:true })-1;
  renderChat();
  try{
    const reply = await requestChatGPT(buildPrompt(text));
    chatHistory[pendingIndex] = { role:'ai', text: reply };
    tryApplyToolFrom(reply, text);
  }
  catch(err){
    const message = err?.message || String(err);
    chatHistory[pendingIndex] = { role:'ai', text: `[Error al llamar a ChatGPT: ${message}]` };
  }
  chatHistory = chatHistory.filter(m=>!m?.pending);
  localStorage.setItem('chat_v1', JSON.stringify(chatHistory));
  renderChat();
}
document.getElementById('btnSend')?.addEventListener('click', sendChat);
chatInputEl?.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendChat(); }});

/* ==== Herramientas locales desde chat ==== */
function parseDateToISO(s){
  if(!s) return s; s=String(s).trim();
  if(s.indexOf('-')>0) return s;
  if(s.indexOf('/')>0){ const p=s.split('/'); if(p.length===3){ const d=p[0].padStart(2,'0'); const m=p[1].padStart(2,'0'); const y=p[2]; return `${y}-${m}-${d}`; } }
  return s;
}
function extractJson(text){
  const i = text.indexOf('```json'); if(i>=0){ const j = text.indexOf('```', i+7); if(j>i){ return text.slice(i+7, j).trim(); } }
  const a = text.indexOf('{'); const b = text.lastIndexOf('}');
  if(a>=0 && b>a) return text.slice(a,b+1);
  return null;
}
function tryApplyToolFrom(modelText,_userText){
  const raw = extractJson(modelText); if(!raw) return false;
  let cmd; try{ cmd = JSON.parse(raw); }catch{ return false; }
  if(!cmd || cmd.action !== 'update_client' || !cmd.set) return false;
  return applyUpdateCommand(cmd);
}
function findClientByMatch(match){
  const arr = db.getAll(); const t = m=>normalize(m||'');
  let filtered = arr.filter(c=>{
    const okNombre = match?.nombre? t(c.nombre).includes(t(match.nombre)) : true;
    const okEmail  = match?.email?  t(c.email) === t(match.email) || t(c.email).includes(t(match.email)) : true;
    const okServ   = match?.servicio? t(c.servicio).includes(t(match.servicio)) : true;
    return okNombre && okEmail && okServ;
  });
  return filtered;
}
async function applyUpdateCommand(cmd){
  const matches = findClientByMatch(cmd.match||{});
  if(matches.length !== 1){
    const msg = matches.length===0? 'No encontré un cliente con esos datos. Especifica nombre o email.' : `Hay ${matches.length} clientes que coinciden. Especifica email para continuar.`;
    chatHistory.push({role:'ai', text: msg}); renderChat(); return false;
  }
  const client = matches[0];
  const allowed = {nombre:1,email:1,telefono:1,servicio:1,inicio:1,vence:1,categoria:1,notas:1,pin:1};
  const set = Object.assign({}, cmd.set);
  if(set.inicio) set.inicio = parseDateToISO(set.inicio);
  if(set.vence)  set.vence  = parseDateToISO(set.vence);

  const arr = db.getAll();
  const idx = arr.findIndex(x=>x.id===client.id);
  if(idx<0){ chatHistory.push({role:'ai', text:'Error interno: no se pudo ubicar el registro.'}); renderChat(); return false; }
  const before = Object.assign({}, arr[idx]);
  Object.keys(set).forEach(k=>{ if(allowed[k]) arr[idx][k] = set[k]; });
  await db.saveAll(arr); await renderTabla();

  const changed = Object.keys(set).map(k=>`${k}: "${before[k]||''}" → "${arr[idx][k]}"`).join('\n');
  chatHistory.push({role:'ai', text:`Actualizado ✓\nCliente: ${arr[idx].nombre}\nCambios:\n${changed}`});
  renderChat(); return true;
}

/* ===== Etiquetas ===== */
function formatDM(iso){ if(!iso) return ''; const d=new Date(iso+'T00:00:00'); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }
function buildEtiqueta(c){
  const linkedAccount = findLinkedAccount(c.servicio, c.email);
  const svc = (c.servicio || '').toString().toUpperCase();
  const fv = formatDM(c.vence) || '--/--';
  const correo = c.email || '—';
  const perfil = c.nombre || '—';
  const pin = c.pin || '—';
  const password = linkedAccount?.password || c.password || c.contrasena || c.pass || c.clave || '—';
  return `✨ *${svc || 'SERVICIO'}* 
━━━━━━━━━━━━━━━
📅 *Vence:* ${fv}

👥 *Perfil & Acceso*
   • Nombre: ${perfil}
   • Correo: ${correo}
   • Contraseña: ${password}
   • PIN: ${pin}
━━━━━━━━━━━━━━━

💻📲  🌟 Gracias por tu compra`;
}
async function copyToClipboard(txt){
  try{ await navigator.clipboard.writeText(txt); return true; }
  catch(e){ try{ var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); return true; }catch(_){ return false; } }
}
function etiquetar(id){
  var c=db.getAll().find(x=>x.id===id); if(!c){ toast('Cliente no encontrado'); return; }
  var etiqueta = buildEtiqueta(c);
  copyToClipboard(etiqueta).then(ok=> toast(ok?'Etiqueta copiada ✓':'No se pudo copiar'));
}

/* ===== Búsqueda / filtro ===== */
q?.addEventListener('input', () => renderTabla());
filterEstado?.addEventListener('change', () => renderTabla());

/* ===== DEV TESTS (ligeros) ===== */
(function(){
  function runTests(){
    const backupGet = db.getAll, backupSaveAll = db.saveAll;
    let mem = [{id:'1',nombre:'Ana',servicio:'ChatGPT',vence:'2025-10-01',pin:'1234',notas:'vip',email:'ana@x.com'}];
    db.getAll = () => JSON.parse(JSON.stringify(mem));
    db.saveAll = (x) => { mem = JSON.parse(JSON.stringify(x)); };

    console.assert(parseDateToISO('20/10/2025') === '2025-10-20','parseDateToISO convierte dd/mm/aaaa');
    applyUpdateCommand({action:'update_client', match:{nombre:'Ana'}, set:{vence:'2025-11-01'}});
    console.assert(mem[0].vence==='2025-11-01','applyUpdateCommand actualiza vence');

    db.getAll = backupGet; db.saveAll = backupSaveAll;
    console.log('[tests] OK');
  }
  try{ runTests(); }catch(e){ console.warn('[tests] fallo:', e); }
})();

/* inicio */
if(document.readyState==='complete'){
  document.body.classList.add('page-loaded');
} else {
  window.addEventListener('load', () => document.body.classList.add('page-loaded'));
}
renderServicios().then(()=>renderTabla());
