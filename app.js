(()=>{'use strict';
const byAllocationDate = (a,b) => a.date.localeCompare(b.date) || Number(b.amount > 0) - Number(a.amount > 0) || a.id.localeCompare(b.id);
const IOF_PERCENT = [0,96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3];
const Accounts=window.ReservaAccounts;
const ACCOUNT=Accounts.active(localStorage);
const STORE=ACCOUNT?Accounts.storeKey(ACCOUNT.id):'reserva-simples-v2';
const Engines=window.ReservaEngines;
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATS=['Água','Luz','Internet','Faculdade','Farmácia','Cartões','Telefone','Mercado','Comida / Marmita','Moradia','Transporte','Saúde','Lazer','Assinaturas','Pecuária','Outros'];
const CALENDAR_TASK_COLORS={blue:'#1762c4',green:'#17834c',teal:'#0f8b8d',purple:'#8064d8',red:'#c44747',orange:'#bb7516'};
const CALENDAR_TASK_COLOR_LABELS={blue:'Azul',green:'Verde',teal:'Turquesa',purple:'Roxo',red:'Vermelho',orange:'Laranja'};
const calendarTaskColor=color=>CALENDAR_TASK_COLORS[color]||CALENDAR_TASK_COLORS.blue;
const CAT_COLORS=['#3488f5','#f4a56c','#6d6ce8','#659ed4','#d98ba9','#879db5','#74bbdf','#e6a26d','#a3a6d7','#b392db','#d78f86','#5babc3','#c5b26b','#a8bbc9','#9b7b46','#8c9bab'];
const PAGES=[['home','Hoje','home'],['transactions','Lançamentos','wallet'],['budget','Orçamento','wallet'],['calendar','Calendário','calendar'],['goals','Metas','target'],['investments','Investimentos','piggy'],['analysis','Insights','chart'],['reports','Relatórios','report'],['settings','Ajustes','settings']];
const APP_VERSION='1.0.0-beta.1';
const APP_CACHE_NAME='reserva-simples-v'+APP_VERSION+'-pwa';
const TELEMETRY_SCHEMA='reserva.telemetry.event.v1';
const diagnosticFixtureStorages = new WeakSet();
const diagnostics = (() => {
  const key = 'reserva.diagnostics.v1';
  const sessionKey = key + '.active';
  const eventLimit = 1000;
  const retentionDays = 30;
  const retentionMs = retentionDays * 86400000;
  const trailLimit = 30;
  const trailKey = key + '.trail';
  const sessionId = (() => {
    try { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2); }
    catch { return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2); }
  })();
  function safeText(value, maxBytes = 240) {
    let text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
      .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
      .replace(/([?&](?:access_token|token|secret|password|api_key|authorization|cookie)=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/\b\d{3}[. -]?\d{3}[. -]?\d{3}[- .]?\d{2}\b/g, '[REDACTED_ID]')
      .replace(/\b\d{2}[. -]?\d{3}[. -]?\d{3}[/. -]?\d{4}[- .]?\d{2}\b/g, '[REDACTED_ID]')
      .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)9?\d{4}[-. ]?\d{4}\b/g, '[REDACTED_PHONE]')
      .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_NUMBER]');
    while (new TextEncoder().encode(text).length > maxBytes) text = text.slice(0, Math.max(0, text.length - 8));
    return text;
  }
  const severity = (code, status) => ['alerta','falha','erro'].includes(String(status).toLowerCase()) ? 'WARN' :
    /(?:\.failed|\.error|\.invalid|^javascript\.|^session\.interrupted)/i.test(code) ? 'ERROR' : 'INFO';
  let module;
  let trail = [];
  let events = [];
  let storageAvailable = true;
  let storageEstimate = { usedBytes: null, quotaBytes: null };
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) events = saved.slice(-eventLimit);
  } catch { storageAvailable = false; }
  function pruneEvents() {
    const cutoff=Date.now()-retentionMs;
    events=events.filter(event=>{const time=Date.parse(event.ts||event.at||'');return Number.isFinite(time)&&time>cutoff;}).slice(-eventLimit);
  }
  pruneEvents();

  try {
    const saved = JSON.parse(sessionStorage.getItem(trailKey) || '[]');
    if (Array.isArray(saved)) trail = saved.slice(-trailLimit);
  } catch {}

  function step(action, page = module) {
    if (PAGES.some(([id]) => id === page)) module = page;
    trail.push({ at: new Date().toISOString(), action, module });
    if (trail.length > trailLimit) trail.shift();
    try { sessionStorage.setItem(trailKey, JSON.stringify(trail)); } catch {}
  }

  function environment() {
    const nav = navigator;
    const brands = nav.userAgentData?.brands?.map(item => ({
      brand: item.brand.slice(0, 32), version: item.version.split('.')[0]
    })) || [];
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    const mem = performance.memory;
    const hints = nav.userAgentData;
    const cap = window.Capacitor;
    const perf = performance.getEntriesByType?.('navigation')?.[0];
    let native = null;
    try { if (cap?.isNativePlatform?.()) native = cap.getPlatform?.() || 'native'; } catch {}
    return {
      module, online: nav.onLine,
      mode: native || (location.protocol === 'file:' ? 'html' : window.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser'),
      browser: { userAgent: nav.userAgent || 'unknown', brands, platform: hints?.platform || nav.platform || 'unknown', platformVersion: hints?.platformVersion || null, model: hints?.model || null, architecture: hints?.architecture || null, bitness: hints?.bitness || null, mobile: hints?.mobile ?? null, language: nav.language || 'unknown' },
      device: { memoryGb: nav.deviceMemory || null, logicalCpuCores: nav.hardwareConcurrency || null, pixelRatio: window.devicePixelRatio || 1, screen: { width: screen.width, height: screen.height, availableWidth: screen.availWidth, availableHeight: screen.availHeight, colorDepth: screen.colorDepth, orientation: screen.orientation?.type || 'unknown' }, viewport: { width: window.innerWidth, height: window.innerHeight } },
      connection: conn ? { type: conn.type || 'unknown', effectiveType: conn.effectiveType || 'unknown', downlinkMbps: Number.isFinite(conn.downlink) ? conn.downlink : null, rttMs: Number.isFinite(conn.rtt) ? conn.rtt : null, saveData: Boolean(conn.saveData) } : null,
      memory: mem ? { jsHeapUsedBytes: mem.usedJSHeapSize, jsHeapTotalBytes: mem.totalJSHeapSize, jsHeapLimitBytes: mem.jsHeapSizeLimit } : null,
      storage: { ...storageEstimate, available: storageAvailable },
      runtime: { visibility: document.visibilityState || 'unknown', focused: document.hasFocus?.() ?? null, secureContext: window.isSecureContext, cookieEnabled: nav.cookieEnabled, serviceWorkerSupported: 'serviceWorker' in nav, serviceWorkerState: nav.serviceWorker?.controller?.state || 'uncontrolled', capacitorPlatform: native, pageLoadMs: Number.isFinite(perf?.loadEventEnd) ? Math.round(perf.loadEventEnd) : null, domReadyMs: Number.isFinite(perf?.domContentLoadedEventEnd) ? Math.round(perf.domContentLoadedEventEnd) : null }
    };
  }

  async function refreshStorageEstimate() {
    try {
      const estimate = await navigator.storage?.estimate?.();
      storageEstimate = {
        usedBytes: Number.isFinite(estimate?.usage) ? estimate.usage : null,
        quotaBytes: Number.isFinite(estimate?.quota) ? estimate.quota : null
      };
    } catch {}
  }
  refreshStorageEstimate();

  function record(code, error, context = {}) {
    if (diagnosticFixtureStorages.has(window.localStorage)) return;
    pruneEvents();
    const at = new Date().toISOString();
    const type = ['Error','TypeError','ReferenceError','SyntaxError','RangeError',
      'QuotaExceededError','SecurityError','NetworkError','AbortError','NotAllowedError']
      .includes(error?.name) ? error.name : undefined;
    const safeContext = {...context};
    if (safeContext.reason !== undefined) safeContext.reason = safeText(safeContext.reason);
    if (safeContext.error_message !== undefined) safeContext.error_message = safeText(safeContext.error_message);
    if (error?.message && safeContext.error_message === undefined) safeContext.error_message = safeText(error.message);
    const status = safeContext.status;
    events.push({ event_id: (() => { try { return crypto.randomUUID(); } catch { return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2); } })(),
      ts:at, level:severity(code,status), service:'reserva-simples-pwa', env:window.matchMedia?.('(display-mode: standalone)').matches?'standalone':'browser',
      schema_version:TELEMETRY_SCHEMA, session_id:sessionId, msg:safeText(code,96), at, version:APP_VERSION, code, type, module, online:navigator.onLine,
      ...safeContext, ...(code === 'session.started' ? {} : { trail: trail.slice(-10) }) });
    if (error?.stack && code.startsWith('javascript.')) {
      events[events.length - 1].stack = String(error.stack).split('\n').slice(1, 8)
        .map(line => line.replace(/https?:\/\/[^/\s)]+[^\s)]*/g, '[app]').replace(/file:\/\/[^\s)]*/g, '[local]'))
        .join('\n').slice(0, 1200);
    }
    if (events.length > eventLimit) events.shift();
    try {
      localStorage.setItem(key, JSON.stringify(events));
      storageAvailable = true;
    } catch { storageAvailable = false; }
  }
  addEventListener('error', event => {
    if (event.target !== window && !event.message) {
      record('resource.failed', undefined, { element: ['SCRIPT','LINK','IMG'].includes(event.target?.tagName) ? event.target.tagName : 'other' });
      return;
    }
    record('javascript.error', event.error, { line: event.lineno || undefined, column: event.colno || undefined });
  }, true);
  addEventListener('unhandledrejection', event => record('javascript.rejection', event.reason));
  function markActive() {
    try { sessionStorage.setItem(sessionKey, '1'); } catch {}
  }
  try {
    if (sessionStorage.getItem(sessionKey)) record('session.interrupted');
  } catch {}
  markActive();
  addEventListener('pageshow', markActive);
  addEventListener('pagehide', () => {
    try { sessionStorage.removeItem(sessionKey); } catch {}
  });
  record('session.started');
  return {
    record,
    step,
    report: () => ({
      format: 2,
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      storageAvailable,
      eventLimit,
      retentionDays,
      environment: environment(),
      recentActions: trail.slice(),
      events: events.slice()
    }),
    clear() {
      events = [];
      trail = [];
      try { sessionStorage.removeItem(trailKey); } catch {}
      try { localStorage.removeItem(key); storageAvailable = true; }
      catch { storageAvailable = false; }
    }
  };
})();
const updateInfo={lastCheck:localStorage.getItem('reserva.update.checkedAt')||'',latest:APP_VERSION,available:false,status:'Aguardando verificação',state:'waiting',notes:''};
try {
  const pendingVersion=localStorage.getItem('reserva.update.pendingVersion');
  if(pendingVersion===APP_VERSION){localStorage.removeItem('reserva.update.pendingVersion');diagnostics.record('update.applied',undefined,{status:'aprovada',target_version:pendingVersion,reason:'A nova versão iniciou após a ativação do Service Worker'});}
} catch {}
let updateRegistration=null;
const $=(q)=>document.querySelector(q);
const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
let hideValues = localStorage.getItem('reserva.hideValues') === 'true';
const money = n => hideValues ? '••••' : fmt.format((n || 0) / 100);
const percent=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const toCents=value=>{const n=Number(value),cents=Math.round(n*100);return Number.isFinite(n)&&cents>0&&n<=100000000?cents:NaN};
const icon=name=>`<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const sum=a=>a.reduce((v,n)=>v+n,0);
const empty=()=>({version:4,ownerId:null,profile:null,investments:[],records:[],jars:[],allocations:[],recurring:[],tasks:[],notes:[],institutions:[{id:'inter-default',name:'Banco Inter',type:'bank',cdiPercent:100,guaranteeFund:'fgc',conglomerate:'Banco Inter',otherCoveredBalance:0,isDefault:true}],prefs:{dark:!!window.matchMedia?.('(prefers-color-scheme: dark)').matches,balanceAnchorCents:null,balanceAnchorDate:'',emergencyMonths:6,categoryBudgets:{},billReminders:false,billReminderDays:1}});
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d}
function normalizeTags(value){const input=Array.isArray(value)?value:String(value||'').split(/[;,]/);return [...new Set(input.map(x=>String(x||'').trim().replace(/^#+/,'').slice(0,30)).filter(Boolean).map(x=>x.slice(0,30)))].slice(0,8)}
function verify(src){if(!src||![2,3,4].includes(src.version)||!Array.isArray(src.records)||!Array.isArray(src.jars)||!Array.isArray(src.allocations)||src.records.length>50000||src.jars.length>5000||src.allocations.length>50000||!Array.isArray(src.recurring||[])||(src.recurring||[]).length>5000||!Array.isArray(src.tasks||[])||(src.tasks||[]).length>10000||!Array.isArray(src.institutions??[])||(src.institutions??[]).length>5000)return null;
 const clean=empty();const ids=new Set();
 const goodId=id=>typeof id==='string'&&id.length>0&&id.length<=120&&!ids.has(id)&&(ids.add(id),true);
 for(const x of src.records){if(!x||!goodId(x.id)||!['income','expense'].includes(x.kind)||!Number.isSafeInteger(x.amount)||x.amount<=0||x.amount>10000000000||!validDate(x.date))return null;clean.records.push({id:x.id,kind:x.kind,amount:x.amount,date:x.date,source:x.source==='salary'?'salary':'complement',category:CATS.includes(x.category)?x.category:'Outros',subcategory:String(x.subcategory||'').trim().slice(0,50),tags:normalizeTags(x.tags),note:String(x.note||'').slice(0,140),recurringId:typeof x.recurringId==='string'&&x.recurringId.length<=120?x.recurringId:null,recurringMonth:/^\d{4}-\d{2}$/.test(x.recurringMonth||'')?x.recurringMonth:null,investmentId:typeof x.investmentId==='string'&&x.investmentId.length<=120?x.investmentId:null,investmentExpenseId:typeof x.investmentExpenseId==='string'&&x.investmentExpenseId.length<=120?x.investmentExpenseId:null})}
 clean.institutions=[];const institutionIds=new Set();for(const x of src.institutions||[]){const pct=Number(x?.cdiPercent??100),fund=['fgc','fgcoop','none'].includes(x?.guaranteeFund)?x.guaranteeFund:(x?.type==='cooperative'?'fgcoop':'fgc'),other=Number.isSafeInteger(x?.otherCoveredBalance)&&x.otherCoveredBalance>=0?x.otherCoveredBalance:0;if(!x||!goodId(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>70||!['bank','cooperative'].includes(x.type)||!Number.isFinite(pct)||pct<=0||pct>500)return null;clean.institutions.push({id:x.id,name:x.name.trim(),type:x.type,cdiPercent:pct,guaranteeFund:fund,conglomerate:String(x.conglomerate||x.name).trim().slice(0,100),otherCoveredBalance:other,isDefault:!!x.isDefault});institutionIds.add(x.id)}if(!institutionIds.has('inter-default')){clean.institutions.unshift({id:'inter-default',name:'Banco Inter',type:'bank',cdiPercent:100,guaranteeFund:'fgc',conglomerate:'Banco Inter',otherCoveredBalance:0,isDefault:true});institutionIds.add('inter-default')}
 for(const x of src.jars){if(!x||!goodId(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>70||!Number.isSafeInteger(x.target)||x.target<=0||x.target>10000000000||!validDate(x.dueDate))return null;const name=x.name.trim(),legacyChallenge=x.challengeType==='save-10000-2027'||name==='Desafio R$ 10.000 — 2027'||name==='Desafio R$ 10.000',institutionId=institutionIds.has(x.institutionId)?x.institutionId:'inter-default';clean.jars.push({id:x.id,name:legacyChallenge?'Meta de R$ 10.000 — 2027':name,target:x.target,dueDate:x.dueDate,institutionId,archived:!!x.archived,paused:!!x.paused})}
 for(const x of src.recurring||[]){const kind=x?.kind==='income'?'income':'expense',source=x?.source==='salary'?'salary':'complement';if(!x||!goodId(x.id)||(kind==='expense'&&!CATS.includes(x.category))||!Number.isSafeInteger(x.amount)||x.amount<=0||x.amount>10000000000||!Number.isInteger(x.day)||x.day<1||x.day>31||!/^\d{4}-\d{2}$/.test(x.startMonth||'')||!validDate(x.startMonth+'-01')||(x.endMonth&&(!/^\d{4}-\d{2}$/.test(x.endMonth)||!validDate(x.endMonth+'-01')||x.endMonth<x.startMonth)))return null;clean.recurring.push({id:x.id,kind,source,category:kind==='expense'?x.category:'Outros',amount:x.amount,day:x.day,note:String(x.note||'').slice(0,140),startMonth:x.startMonth,endMonth:x.endMonth||null,paused:!!x.paused})}
 for(const x of src.tasks||[]){if(!x||!goodId(x.id)||typeof x.title!=='string'||!x.title.trim()||x.title.length>90||!validDate(x.date)||x.time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x.time)||String(x.note||'').length>180)return null;clean.tasks.push({id:x.id,title:x.title.trim(),date:x.date,time:x.time||'',note:String(x.note||'').trim(),color:CALENDAR_TASK_COLORS[x.color]?x.color:'blue',done:!!x.done})}
 const jarIds=new Set(clean.jars.map(j=>j.id));
 for(const x of src.allocations){if(!x||!goodId(x.id)||!jarIds.has(x.jarId)||!Number.isSafeInteger(x.amount)||x.amount===0||Math.abs(x.amount)>10000000000||!validDate(x.date))return null;if(x.netReceived!=null&&(x.amount>=0||!Number.isSafeInteger(x.netReceived)||x.netReceived<=0))return null;
 clean.allocations.push({id:x.id,jarId:x.jarId,amount:x.amount,date:x.date,...(x.netReceived!=null?{netReceived:x.netReceived}:{}),note:/^desafio-2027-square-\d+$/.test(String(x.note||''))?'Depósito registrado na antiga cartela':String(x.note||'').slice(0,140)})}
 // Verifica os movimentos de cada cofrinho sem percorrer a base inteira para cada meta.
 const allocationGroups=new Map();
 for(const movement of clean.allocations){
   if(!allocationGroups.has(movement.jarId))allocationGroups.set(movement.jarId,[]);
   allocationGroups.get(movement.jarId).push(movement);
 }
 for(const movements of allocationGroups.values()){
   let balance=0;
   for(const movement of movements.sort(byAllocationDate)){
     balance+=movement.amount;
     if(balance<0)return null;
   }
 }
 clean.prefs.dark=!!src.prefs?.dark;clean.prefs.balanceAnchorCents=Number.isSafeInteger(src.prefs?.balanceAnchorCents)&&src.prefs.balanceAnchorCents>=0?src.prefs.balanceAnchorCents:null;clean.prefs.balanceAnchorDate=validDate(src.prefs?.balanceAnchorDate)?src.prefs.balanceAnchorDate:'';clean.prefs.emergencyMonths=Number.isInteger(src.prefs?.emergencyMonths)&&src.prefs.emergencyMonths>=3&&src.prefs.emergencyMonths<=12?src.prefs.emergencyMonths:6;if(!Array.isArray(src.investments??[])||(src.investments??[]).length>5000)return null;
 for(const x of src.investments??[]){
   if(!x||!goodId(x.id)||![x.name,x.institution,x.product].every(v=>typeof v==='string'&&v.trim()&&v.length<=80)||
      ![x.cost,x.balance].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=10000000000)||
      !validDate(x.date)||!validDate(x.checked)||x.checked<x.date)return null;
   const assetType=x.assetType==='livestock'?'livestock':'financial';
   const livestockKind=['Corte','Leiteiro','Matrizes','Reprodutores','Bezerros e garrotes','Outro'].includes(x.livestockKind)?x.livestockKind:'Corte';
   const status=assetType==='livestock'&&x.status==='sold'?'sold':'active';
   const initialHeadCount=Number.isSafeInteger(x.initialHeadCount)&&x.initialHeadCount>0&&x.initialHeadCount<=100000?x.initialHeadCount:(Number.isSafeInteger(x.headCount)&&x.headCount>0&&x.headCount<=100000?x.headCount:1);
   const headCount=status==='sold'?0:(Number.isSafeInteger(x.headCount)&&x.headCount>=1&&x.headCount<=100000?x.headCount:initialHeadCount);
   const extraCosts=Number.isSafeInteger(x.extraCosts)&&x.extraCosts>=0&&x.extraCosts<=10000000000?x.extraCosts:0;
   const expenses=x.expenses??[];
   if(!Array.isArray(expenses)||expenses.length>50000||expenses.some(e=>!e||!validDate(e.date)||e.date<x.date||!Number.isSafeInteger(e.amount)||e.amount<=0||e.amount>10000000000||!['Ração','Vacinas','Medicamentos','Transporte','Manejo','Outros'].includes(e.category)||String(e.note||'').length>140))return null;
   const redemptions=x.redemptions??[];
   if(!Array.isArray(redemptions)||redemptions.length>50000||redemptions.some(r=>!r||!validDate(r.date)||r.date<x.date||!Number.isSafeInteger(r.amount)||r.amount<=0||r.amount>10000000000||r.kind==='sale'&&(!Number.isSafeInteger(r.heads)||r.heads<=0||!Number.isSafeInteger(r.costBasisSold)||r.costBasisSold<0)))return null;
   const soldDate=status==='sold'?x.soldDate:null,saleAmount=status==='sold'?x.saleAmount:null;
   if(status==='sold'&&(!validDate(soldDate)||soldDate>isoToday()||!Number.isSafeInteger(saleAmount)||saleAmount<=0||saleAmount>10000000000||x.balance!==0))return null;
   const normalizedRedemptions=redemptions.map(r=>{
     const legacySale=status==='sold'&&assetType==='livestock'&&!r.kind&&r.date===soldDate&&r.amount===saleAmount;
     return {date:r.date,amount:r.amount,kind:r.kind==='sale'||legacySale?'sale':'redemption',heads:Number.isSafeInteger(r.heads)&&r.heads>0?r.heads:legacySale?initialHeadCount:null,costBasisSold:Number.isSafeInteger(r.costBasisSold)&&r.costBasisSold>=0?r.costBasisSold:legacySale?x.cost+extraCosts:null};
   });
   const remainingCostBasis=status==='sold'?0:(Number.isSafeInteger(x.remainingCostBasis)&&x.remainingCostBasis>=0&&x.remainingCostBasis<=10000000000?x.remainingCostBasis:x.cost+extraCosts+sum(expenses.map(e=>e.amount)));
   if(remainingCostBasis>10000000000||status==='sold'&&soldDate<x.date)return null;
   const cdiPercent=Number.isFinite(x.cdiPercent)&&x.cdiPercent>0&&x.cdiPercent<=500?Math.round(x.cdiPercent*100)/100:null;
   clean.investments.push({incomeRecordId:typeof x.incomeRecordId==='string'?x.incomeRecordId:null,id:x.id,name:x.name,institution:x.institution,product:x.product,cost:x.cost,balance:x.balance,date:x.date,checked:x.checked,cdiPercent,redemptions:normalizedRedemptions,existing:x.existing===true,goalId:clean.jars.some(j=>j.id===x.goalId)?x.goalId:null,assetType,livestockKind,headCount,initialHeadCount,extraCosts,expenses:expenses.map(e=>({id:String(e.id||uid()),date:e.date,category:e.category,amount:e.amount,note:String(e.note||'').slice(0,140),recordId:typeof e.recordId==='string'?e.recordId:null})),remainingCostBasis,status,soldDate,saleAmount});
 
 }
 const marketBudget=src.prefs?.marketBudget;
 clean.prefs.marketBudget=Number.isSafeInteger(marketBudget)&&marketBudget>0&&marketBudget<=10000000000?marketBudget:null;
 const categoryBudgets={};for(const [category,amount] of Object.entries(src.prefs?.categoryBudgets||{})){if(CATS.includes(category)&&category!=='Mercado'&&Number.isSafeInteger(amount)&&amount>0&&amount<=10000000000)categoryBudgets[category]=amount;else if(category==='Mercado'&&clean.prefs.marketBudget===null&&Number.isSafeInteger(amount)&&amount>0)clean.prefs.marketBudget=amount}clean.prefs.categoryBudgets=categoryBudgets;
 clean.prefs.palette=['blue','petrol','plum','emerald','graphite','carbon'].includes(src.prefs?.palette)?src.prefs.palette:'blue';
 clean.prefs.budgetSound=src.prefs?.budgetSound===true;
 clean.prefs.billReminders=src.prefs?.billReminders===true;clean.prefs.billReminderDays=[0,1,3,7].includes(src.prefs?.billReminderDays)?src.prefs.billReminderDays:1;
 clean.notes=validateCalendarNotes(src.notes);
 if(!clean.notes)return null;
 if(src.ownerId!=null){if(typeof src.ownerId!=='string'||!/^[a-f0-9-]{36}$/i.test(src.ownerId))return null;clean.ownerId=src.ownerId}
 if(src.profile!=null){try{if(!clean.ownerId)return null;clean.profile=Accounts.profile(src.profile,clean.ownerId)}catch{return null}}
 return clean;
}
let storageRecoveryRaw=null,recoveryArchived=false,loadedStoreRaw=null;
let folderKey = null, folderSalt = null, folderPasswordAction = null;
let pendingVaultImport = null;
let vault = null, vaultKey = null, vaultBusy = false, saving = false;
const bytesTo64 = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
const from64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const encoder = new TextEncoder();
async function deriveVaultKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:600000, hash:'SHA-256'}, material, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
}
async function sealVault(data, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, encoder.encode(JSON.stringify(data)));
  return {format:'reserva-vault-1', salt, iv:bytesTo64(iv), data:bytesTo64(new Uint8Array(encrypted))};
}
function validateVaultEnvelope(envelope) {
  if (!envelope || envelope.format !== 'reserva-vault-1' ||
      typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string' ||
      typeof envelope.data !== 'string') throw Error('Envelope do cofre inválido');
  const salt = from64(envelope.salt), iv = from64(envelope.iv), data = from64(envelope.data);
  if (salt.length !== 16 || iv.length !== 12 || data.length < 16 ||
      Object.keys(envelope).some(key => !['format','salt','iv','data'].includes(key)))
    throw Error('Estrutura do cofre inválida');
  return envelope;
}
async function openVault(envelope,key) {
  validateVaultEnvelope(envelope);
  const clear = await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(envelope.iv)},key,from64(envelope.data));
  const result = verify(JSON.parse(new TextDecoder().decode(clear)));
  if (!result) throw Error('Dados inválidos');
  return result;
}
function showVaultDialog(mode) {
  const dialog = $('#vaultDialog');
  dialog.dataset.mode = mode;
  $('#vaultTitle').textContent = mode==='setup'?'Criar cofre':mode==='import'?'Senha do backup':mode==='disable'?'Desativar cofre local':'Desbloquear cofre';
  $('#vaultPassword').value = '';
  $('#vaultConfirm').value = '';
  $('#vaultConfirmField').hidden = mode!=='setup';
  $('#vaultConfirm').required = mode==='setup';
  $('#vaultHelp').textContent = mode==='setup'?'Use pelo menos 12 caracteres e repita a senha no segundo campo.':mode==='disable'?'Digite a senha do cofre. Os registros ficarão salvos sem criptografia neste navegador.':'';
  $('#vaultError').textContent = '';
  if (!dialog.open) dialog.showModal();
  const biometric=$('#accountBioUnlock');
  if(biometric)biometric.hidden=!(mode==='unlock'&&ACCOUNT&&Accounts.biometricConfigured(localStorage,ACCOUNT.id));
}
function storeIsCurrent(){
  return localStorage.getItem(STORE)===loadedStoreRaw;
}
async function writeStore(candidate){
  const raw=JSON.stringify(candidate);
  const commit=()=>{
    if(!storeIsCurrent()){
      diagnostics.record('storage.conflict_prevented');
      integrityRecord('storage.conflict_prevented','alerta',{reason:'Outra aba gravou uma revisão diferente'});
      return false;
    }
    localStorage.setItem(STORE,raw);
    loadedStoreRaw=raw;
    return true;
  };
  if(navigator.locks?.request&&!diagnosticFixtureStorages.has(localStorage)){
    return navigator.locks.request(STORE,commit);
  }
  return commit();
}
const STORE_CHANGED_MESSAGE='Outra aba atualizou os dados. Feche e reabra esta aba antes de salvar.';
const STORE_ARCHIVE_MESSAGE='Exporte a cópia bruta da base em Ajustes antes de importar.';
async function vaultWriteStore(candidate, recovering=false){
  if(storageRecoveryRaw&&(!recovering||!recoveryArchived))throw new Error(STORE_ARCHIVE_MESSAGE);
  if(integrityContainmentLock&&!(recovering&&storageRecoveryRaw&&recoveryArchived)){
    throw new Error('Gravação bloqueada pela Central de Integridade.');
  }
  if(!await writeStore(candidate))throw new Error(STORE_CHANGED_MESSAGE);
}
async function submitVault(event) {
  event.preventDefault();
  if (vaultBusy || saving) return;
  vaultBusy = true;
  const dialog = $('#vaultDialog');
  const password = $('#vaultPassword').value;
  const setup = dialog.dataset.mode==='setup';
  try {
    if (dialog.dataset.mode === 'folder') {
      await folderPasswordAction(password, $('#vaultConfirm').value);
      folderPasswordAction = null;
      dialog.close();
      render();
      return;
    }
    if (setup && (password.length<12 || password!==$('#vaultConfirm').value)) {
      $('#vaultError').textContent='Use pelo menos 12 caracteres e confirme a senha.';
      return;
    }
    const importing = dialog.dataset.mode==='import';
    const envelope = setup ? null : importing ? pendingVaultImport : vault;
    const salt = setup ? bytesTo64(crypto.getRandomValues(new Uint8Array(16))) : envelope.salt;
    const key = await deriveVaultKey(password,from64(salt));
    if (setup) {
      const candidate = await sealVault(db,key,salt);
      await openVault(candidate,key);
      await vaultWriteStore(candidate);
      vault = candidate;
      dialog.close();
      vaultBusy = false;
      location.reload();
      return;
    }
    const restored = await openVault(envelope,key);
    if(ACCOUNT&&(restored.ownerId!==ACCOUNT.id||restored.profile?.id!==ACCOUNT.id))throw Error('Backup de outro perfil');
    if(dialog.dataset.mode==='disable'&&ACCOUNT)throw Error('Cofre obrigatório');
    if(dialog.dataset.mode==='disable'){
      await vaultWriteStore(restored);
      vault=null;
      vaultKey=null;
      db=restored;
      $('#vaultPassword').value='';
      dialog.close();
      render();
      notify('Cofre desativado. Seus registros foram mantidos.');
      return;
    }
    if (importing) {
      if (!confirm('Substituir os registros atuais pelo backup cifrado?')) return;
      if (!await preserveBeforeDestructiveAction('antes-de-importar')) throw Error('Não foi possível preservar a base atual');
      if(backupDirectory)backupConflict=true;
      if (vault) {
        const candidate = await sealVault(restored,vaultKey,vault.salt);
        await vaultWriteStore(candidate);
        vault = candidate;
        db = restored;
        pendingVaultImport = null;
        dialog.close();
        render();
      } else {
        await vaultWriteStore(envelope,true);
        dialog.close();
        vaultBusy = false;
        location.reload();
      }
      return;
    }
    if(!storeIsCurrent())throw new Error(STORE_CHANGED_MESSAGE);
    db = restored;
    vaultKey = key;
    dialog.close();
    render();
  } catch(error) {
    $('#vaultError').textContent = [STORE_CHANGED_MESSAGE,STORE_ARCHIVE_MESSAGE].includes(error?.message)?error.message:dialog.dataset.mode==='folder'?(error.userMessage || 'Não foi possível abrir ou gravar o backup. Verifique a senha e as permissões da pasta.'):setup?'Não foi possível ativar o cofre.':'Senha incorreta ou cofre inválido.';
  } finally { vaultBusy=false; }
}
function load(){let raw=null;try{raw=localStorage.getItem(STORE);loadedStoreRaw=raw;if(!raw){const fresh=empty();try{fresh.notes=validateCalendarNotes(JSON.parse(localStorage.getItem('reserva.calendarNotes')||'[]'))||[]}catch{}return fresh}const parsed=JSON.parse(raw);if(parsed&&parsed.notes===undefined&&parsed.format!=='reserva-vault-1'){try{parsed.notes=validateCalendarNotes(JSON.parse(localStorage.getItem('reserva.calendarNotes')||'[]'))||[]}catch{}}if(parsed?.format==='reserva-vault-1'){vault=parsed;return empty()}const clean=verify(parsed);if(clean)return clean;storageRecoveryRaw=raw}catch(e){try{raw=localStorage.getItem(STORE)}catch(ignore){}}if(raw){diagnostics.record('storage.recovery');storageRecoveryRaw=raw;try{recoveryArchived=false;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(`${STORE}-corrompido-`)&&localStorage.getItem(key)===raw){recoveryArchived=true;break}}if(!recoveryArchived){localStorage.setItem(`${STORE}-corrompido-${Date.now()}`,raw);recoveryArchived=true}}catch(e){recoveryArchived=false}}return empty()}
let db=load();diagnostics.step('app.initialized', 'home');const todayAtStart=new Date();let state={page:preferredStartPage(),year:todayAtStart.getFullYear(),month:todayAtStart.getMonth(),modal:'',editJarId:null,editRecordId:null,editInstitutionId:null,editAllocationId:null,simGoal:'',simAmount:'200',txFilter:'all',txSearch:'',txTag:'',txSubcategory:'',txCategorySet:null,copyCandidates:[],modalTrigger:null,calendarDate:''};let toastTimer;
let backupDirectory=null,backupConflict=false,backupTimer=null,persistenceStatus='Consultando a proteção de armazenamento…';const BACKUP_DB='reserva-simples-backup-handles'+(ACCOUNT?'-'+ACCOUNT.id:''),BACKUP_FILE='Reserva_Simples_backup.json';
const backupPayload=()=>({...db,appVersion:APP_VERSION,savedAt:new Date().toISOString()});const canonicalData=value=>JSON.stringify(verify(value)||value);const hasSavedData=value=>!!(value&&(value.investments?.length||value.records?.length||value.jars?.length||value.allocations?.length||value.recurring?.length||value.tasks?.length||(value.institutions||[]).some(x=>!x.isDefault)));
async function save({folderBackup=true,recover=false}={}){
  if(integrityContainmentLock&&!(recover&&storageRecoveryRaw&&recoveryArchived)){
    notify('Gravação bloqueada pela Central de Integridade. Revise o banco antes de continuar.');
    return false;
  }
  if(storageRecoveryRaw&&!recover){
    notify('Salvamento pausado para proteger dados inválidos. Exporte a cópia ou restaure um backup em Configurações.');
    return false;
  }
  try{
    if(vault&&!vaultKey)return false;
    if(ACCOUNT&&(db.ownerId!==ACCOUNT.id||db.profile?.id!==ACCOUNT.id)){notify('Base não pertence ao perfil ativo. Gravação bloqueada.');return false}
    const candidate=vault?await sealVault(db,vaultKey,vault.salt):db;
    if(integrityContainmentLock&&!(recover&&storageRecoveryRaw&&recoveryArchived))return false;
    if(!await writeStore(candidate)){notify(STORE_CHANGED_MESSAGE);return false}
    if(vault)vault=candidate;
    if(recover){storageRecoveryRaw=null;recoveryArchived=false;integrityContainmentLock=false}
    if(folderBackup&&folderKey)scheduleFolderBackup();
    return true;
  }catch(error){
    diagnostics.record('storage.save_failed',error);
    notify('Não foi possível salvar os dados neste navegador.');
    return false;
  }
}
let budgetAudio;
function unlockBudgetAudio(){
  try {
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    budgetAudio??=new Audio();
    if(budgetAudio.state==='suspended')budgetAudio.resume().catch(()=>{});
  }catch{}
}
function playBudgetSound(critical=false){
  if(budgetAudio?.state!=='running')return;
  const start=budgetAudio.currentTime;
  (critical?[520,440,370]:[620,780]).forEach((frequency,index)=>{
    const tone=budgetAudio.createOscillator(), volume=budgetAudio.createGain();
    const at=start+index*.16;
    tone.frequency.value=frequency;
    volume.gain.setValueAtTime(.0001,at);
    volume.gain.exponentialRampToValueAtTime(.09,at+.025);
    volume.gain.exponentialRampToValueAtTime(.0001,at+.14);
    tone.connect(volume).connect(budgetAudio.destination);
    tone.start(at);tone.stop(at+.15);
  });
}
function groceryAlertLevel(){
  const period=isoToday().slice(0,7);
  const spent=sum(db.records.filter(r=>r.kind==='expense'&&r.category==='Mercado'&&r.date.startsWith(period)).map(r=>r.amount));
  const cap=db.prefs.marketBudget;
  if(!cap)return 0;
  return spent>=cap?2:spent*4>=cap*3?1:0;
}
document.addEventListener('pointerdown',()=>{if(db.prefs.budgetSound)unlockBudgetAudio()});
document.addEventListener('keydown',()=>{if(db.prefs.budgetSound)unlockBudgetAudio()});
document.addEventListener('click',e=>{if(e.target.closest('#testBudgetSound')){unlockBudgetAudio();budgetAudio?.resume().then(()=>playBudgetSound(true)).catch(()=>{});}});
document.addEventListener('click',async e=>{const choice=e.target.closest('[data-palette-pick]');if(!choice)return;const palette=choice.dataset.palettePick;if(['blue','emerald','petrol','plum','graphite','carbon'].includes(palette))await mutate(()=>{db.prefs.palette=palette})});

document.addEventListener('change',async e=>{
  if(e.target.id==='budgetSound'){
    if(e.target.checked)unlockBudgetAudio();
    await mutate(()=>{db.prefs.budgetSound=e.target.checked});
  }
});
async function mutate(callback) {
  if (integrityContainmentLock) {notify('Edição bloqueada pela Central de Integridade até revisar o estado do banco.');return false}
  if (saving || vaultBusy || (vault && !vaultKey)) return false;
  saving = true;
  diagnostics.step('mutation.started', state.page);
  let previous, committed = false;
  try {
    previous = JSON.stringify(db);
    const oldAlert = groceryAlertLevel();
    const previousIncomeIds=new Set(db.records.filter(r=>r.kind==='income').map(r=>r.id));
    callback();
    const newIncome=db.records.filter(r=>r.kind==='income'&&!previousIncomeIds.has(r.id));
    if (!verify(db)) {
      db = JSON.parse(previous);
      diagnostics.record('mutation.invalid', undefined, { module: state.page });
      notify('Não foi possível validar os dados. Nenhuma alteração foi salva. Confira valores, datas e saldo do cofrinho.');
      return false;
    }
    if (!await save()) {
      db = JSON.parse(previous);
      return false;
    }
    committed = true;
    render();
    if(newIncome.length)setTimeout(()=>notify('Recebimento registrado. Confira a reserva de 10% em Metas.'),0);
    const alert = groceryAlertLevel();
    if (db.prefs.budgetSound && alert > oldAlert) playBudgetSound(alert === 2);
    return true;
  } catch (error) {
    if (!committed && previous) db = JSON.parse(previous);
    diagnostics.record(committed ? 'mutation.refresh_failed' : 'mutation.failed', error, { module: state.page });
    notify(committed ? 'Dados salvos. Não foi possível atualizar a tela.' : 'A alteração não foi salva.');
    return committed;
  } finally {
    saving = false;
  }
}
async function startFreshAfterCorrupt(){
  if(!storageRecoveryRaw||saving||vaultBusy)return;
  if(!recoveryArchived)return notify('Exporte primeiro os dados brutos; não consegui criar uma cópia local.');
  if(!confirm('A cópia bruta foi preservada. Criar uma base vazia neste navegador?'))return;
  const previous=db;
  db=empty();
  if(!await save({folderBackup:false,recover:true})){db=previous;return}
  render();
  notify('Base nova iniciada. A cópia bruta preservada continua disponível.');
}

function notify(msg){const t=$('#toast');t.textContent=msg;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),2900)}
function folderStatusText(){if(!('showDirectoryPicker' in window))return 'Acesso à pasta indisponível neste navegador. Você ainda pode baixar e restaurar arquivos de backup.';if(!backupDirectory)return 'Nenhuma pasta conectada. Escolha uma pasta para salvar o backup automático.';if(backupConflict)return 'Há um backup diferente na pasta. Escolha restaurar o arquivo ou salvar os dados deste aparelho para resolver.';return 'Pasta conectada. O backup será atualizado após as alterações.'}
function updateFolderStatus(message){const el=$('#folderBackupStatus');if(el)el.textContent=message||folderStatusText();const re=$('#reconnectBackupFolderBtn');if(re)re.hidden=!backupDirectory}
function openBackupDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(BACKUP_DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('handles');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function storeBackupHandle(handle){const d=await openBackupDb();await new Promise((resolve,reject)=>{const tx=d.transaction('handles','readwrite');tx.objectStore('handles').put(handle,'directory');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});d.close()}
async function getBackupHandle(){const d=await openBackupDb();const value=await new Promise((resolve,reject)=>{const req=d.transaction('handles').objectStore('handles').get('directory');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});d.close();return value}
async function removeBackupHandle(){const d=await openBackupDb();await new Promise((resolve,reject)=>{const tx=d.transaction('handles','readwrite');tx.objectStore('handles').delete('directory');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});d.close()}
async function hasFolderPermission(request=false){if(!backupDirectory)return false;try{let p=await backupDirectory.queryPermission({mode:'readwrite'});if(p!=='granted'&&request)p=await backupDirectory.requestPermission({mode:'readwrite'});return p==='granted'}catch(e){return false}}
async function folderFile(create=false){return backupDirectory.getFileHandle(BACKUP_FILE,{create})}
function scheduleFolderBackup(){if(!backupDirectory||backupConflict)return;clearTimeout(backupTimer);backupTimer=setTimeout(()=>writeFolderBackup(false),900)}
const ENCRYPTED_FOLDER_FILE = ACCOUNT?'Reserva_Simples_cifrado_'+ACCOUNT.id+'.json':'Reserva_Simples_cifrado.json';
function requestFolderPassword(title, confirmPassword, action) {
  showVaultDialog('folder');
  $('#vaultTitle').textContent = title;
  $('#vaultConfirmField').hidden = !confirmPassword;
  $('#vaultConfirm').required = confirmPassword;
  $('#vaultPassword').autocomplete = confirmPassword ? 'new-password' : 'current-password';
  $('#vaultHelp').textContent = confirmPassword ? (ACCOUNT?'Use a mesma senha do cofre e confirme-a.':'Use pelo menos 12 caracteres e repita a senha no segundo campo.') : 'Digite a senha definida para este backup.';
  folderPasswordAction = action;
}
async function readEncryptedFolder(handle = backupDirectory) {
  const file = await (await handle.getFileHandle(ENCRYPTED_FOLDER_FILE)).getFile();
  const envelope = JSON.parse(await file.text());
  validateVaultEnvelope(envelope);
  return envelope;
}
async function writeEncryptedFolder(handle, name, key, salt) {
  const payload = backupPayload();
  const envelope = await sealVault(payload,key,salt);
  const checked = await openVault(envelope,key);
  if (JSON.stringify(checked) !== JSON.stringify(verify(payload))) throw Error('A validação do backup falhou');
  await writeBackupEnvelope(handle,name,envelope);
}
async function writeBackupEnvelope(handle,name,envelope){
  const writer = await (await handle.getFileHandle(name,{create:true})).createWritable();
  try { await writer.write(JSON.stringify(envelope)); await writer.close(); }
  catch(error) { await writer.abort().catch(()=>{}); throw error; }
}
async function writeFolderBackup(manual=false) {
  if(!backupDirectory||!folderKey)return;
  if(backupConflict&&!manual)return;
  try {
    const envelope=await readEncryptedFolder();
    const previous=await openVault(envelope,folderKey);
    if((backupConflict||(!hasSavedData(db)&&hasSavedData(previous))) &&
       (!manual||!confirm('Substituir o backup cifrado da pasta pelos dados atuais?'))) return;
    if(canonicalData(previous)!==canonicalData(db)){
      const stamp=new Date().toISOString().replace(/[:.]/g,'-');
      await writeBackupEnvelope(backupDirectory,`Reserva_Simples_versao_${stamp}_${uid()}.json`,envelope);
      await writeEncryptedFolder(backupDirectory,ENCRYPTED_FOLDER_FILE,folderKey,folderSalt);
    }
    backupConflict=false;
    updateFolderStatus('Backup cifrado salvo.');
  } catch(error) {
    if(error?.name==='NotFoundError'){
      try{await writeEncryptedFolder(backupDirectory,ENCRYPTED_FOLDER_FILE,folderKey,folderSalt);backupConflict=false;updateFolderStatus('Arquivo de backup recriado com os dados atuais.');return}catch(recreateError){diagnostics.record('backup.recreate_failed',recreateError);updateFolderStatus('Não foi possível recriar o arquivo de backup. Confira as permissões da pasta.');return}
    }
    diagnostics.record('backup.write_failed', error);
    updateFolderStatus('Falha ao salvar. Reconecte a pasta com a senha do backup.');
  }
}
async function preserveBeforeDestructiveAction(label) {
  if(!backupDirectory)return true;
  if(!folderKey)return false;
  try {
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    await writeEncryptedFolder(backupDirectory,`Reserva_Simples_cifrado_${label}_${stamp}.json`,folderKey,folderSalt);
    return true;
  } catch { notify('Falha ao guardar a cópia cifrada. Os dados foram mantidos.'); return false; }
}
async function restoreFolderBackup(){
  if(!backupDirectory||!folderKey)return notify('Reconecte a pasta com a senha do backup.');
  try {
    const restored=await openVault(await readEncryptedFolder(),folderKey);
    if(ACCOUNT&&restored.ownerId!==ACCOUNT.id)throw Error('Backup de outro perfil');
    if(!confirm('Substituir os registros atuais pelo backup da pasta?'))return;
    if(!await preserveBeforeDestructiveAction('antes-de-restaurar'))return;
    backupConflict=true;
    if(await mutate(()=>{db=restored}))notify('Backup restaurado. A base anterior foi preservada.');
  } catch {notify('Não foi possível restaurar o backup cifrado.')}
}
async function chooseBackupFolder() {
  if(!window.showDirectoryPicker)return notify('Este navegador não oferece acesso direto a pastas.');
  try {
    const handle=await window.showDirectoryPicker({mode:'readwrite'});
    let envelope;
    try { envelope=await readEncryptedFolder(handle); } catch(error) { if(error.name!=='NotFoundError')throw error; }
    requestFolderPassword(envelope?'Senha do backup da pasta':'Criar senha do backup',!envelope,async(password,confirmation)=>{
      if(!envelope && password.length<12) throw Object.assign(Error(),{userMessage:'A senha precisa ter pelo menos 12 caracteres.'});
      if(!envelope && password!==confirmation) throw Object.assign(Error(),{userMessage:'As senhas digitadas são diferentes.'});
      if(!globalThis.crypto?.subtle) throw Object.assign(Error(),{userMessage:'Abra o aplicativo pelo endereço HTTPS para criar o backup cifrado.'});
      if(await handle.requestPermission({mode:'readwrite'})!=='granted') throw Object.assign(Error(),{userMessage:'Autorize a gravação ou escolha outra pasta.'});
      const salt=envelope?.salt||bytesTo64(crypto.getRandomValues(new Uint8Array(16)));
      const key=await deriveVaultKey(password,from64(salt));
      if(ACCOUNT&&!envelope&&vault){
       const testKey=await deriveVaultKey(password,from64(vault.salt));
       await openVault(vault,testKey);
     }
     const previous=envelope?await openVault(envelope,key):null;
     if(ACCOUNT&&previous&&previous.ownerId!==ACCOUNT.id)throw Error('Backup de outro perfil');
      if(!envelope)await writeEncryptedFolder(handle,ENCRYPTED_FOLDER_FILE,key,salt);
      let remembered=true;
      try { await storeBackupHandle(handle); } catch { remembered=false; }
      backupDirectory=handle;folderKey=key;folderSalt=salt;
      backupConflict=!!previous&&canonicalData(previous)!==canonicalData(db);
      updateFolderStatus(backupConflict?'Backup diferente dos dados atuais. Restaure ou salve manualmente.':(remembered?'Pasta de backup cifrado conectada.':'Backup criado. Selecione a pasta novamente ao reabrir o aplicativo.'));
    });
  } catch(error) { if(error.name!=='AbortError')notify('Não foi possível conectar a pasta.'); }
}
async function reconnectBackupFolder(){return chooseBackupFolder()}
async function initFolderBackup(){try{backupDirectory=await getBackupHandle();if(backupDirectory)updateFolderStatus('Reconecte a pasta e informe a senha para habilitar o backup.')}catch{}}

const mkey=(y,m)=>`${y}-${String(m+1).padStart(2,'0')}`;
const monthLabel=()=>`${MONTHS[state.month]} de ${state.year}`;
const formDate=()=>{const d=new Date();return state.year===d.getFullYear()&&state.month===d.getMonth()?`${state.year}-${String(state.month+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:`${mkey(state.year,state.month)}-01`};
const getMonth=(y,m)=>{
  const summary=Engines.monthData(db,y,m), prefix=summary.key;
  return {...summary,balance:summary.available,rate:summary.income?summary.saved/summary.income*100:0,
    records:db.records.filter(r=>r.date.startsWith(prefix)),movements:db.allocations.filter(a=>a.date.startsWith(prefix))};
};
const month=()=>getMonth(state.year,state.month);
function pendingRecurring(){
  const {first,last}=Engines.monthBounds(state.year,state.month);
  return Engines.pendingOccurrences(db,first,last);
}
function recurringList(){if(!db.recurring.length)return '<div class="empty"><strong>Nenhuma recorrência cadastrada</strong>Inclua contas, renda mensal ou recebimentos previstos.</div>';return `<div class="recurring-cards">${db.recurring.map(x=>`<article class="recurring-row ${x.paused?'is-paused':''}"><span class="recurring-kind ${x.kind==='income'?'income':'expense'}">${icon(x.kind==='income'?'income':'expense')}</span><span class="recurring-copy"><b>${esc(x.note||x.category||(x.source==='salary'?'Salário':'Renda'))}</b><small>${x.kind==='income'?(x.source==='salary'?'Salário':'Complemento'):'Despesa'} · dia ${x.day} · desde ${x.startMonth}${x.endMonth?' até '+x.endMonth:''}${x.paused?' · pausada':''}</small></span><strong>${money(x.amount)}</strong><button class="btn small" data-toggle-recurring="${esc(x.id)}" aria-label="${x.paused?'Retomar':'Pausar'} recorrência">${x.paused?'Retomar':'Pausar'}</button><button class="btn small" data-edit-recurring="${esc(x.id)}">Editar</button><button class="btn small negative" data-delete-recurring="${esc(x.id)}">Excluir</button></article>`).join('')}</div>`}
async function applyRecurring(){
  const pending=pendingRecurring();
  if(!pending.length)return notify('Não há previsões pendentes neste mês.');
  if(!confirm(`Lançar ${pending.length} previsão(ões) em ${monthLabel()}? Você poderá ajustar cada lançamento depois.`))return;
  const entries=pending.map(item=>({
    id:uid(), kind:item.kind, amount:item.amount, date:item.date,
    source:item.source||'complement', category:item.kind==='income'?'Outros':item.category,
    note:item.note, recurringId:item.id, recurringMonth:item.recurringMonth
  }));
  if(await mutate(()=>db.records.push(...entries)))notify(`${entries.length} previsão(ões) lançada(s).`);
}
async function toggleRecurring(id){const t=db.recurring.find(x=>x.id===id);if(t&&await mutate(()=>t.paused=!t.paused))notify(t.paused?'Recorrência pausada.':'Recorrência retomada.')}

async function deleteRecurring(id){const template=db.recurring.find(t=>t.id===id);if(!template)return;if(!confirm(`Excluir conta recorrente “${template.note||template.category}”? Despesas já lançadas serão preservadas.`))return;if(await mutate(()=>db.recurring=db.recurring.filter(t=>t.id!==id)))notify('Conta recorrente removida.')}
const yearly=y=>MONTHS.map((_,m)=>getMonth(y,m));
const jarTotal=id=>sum(db.allocations.filter(a=>a.jarId===id).map(a=>a.amount));
const allSaved=()=>sum(db.allocations.filter(a=>a.date.slice(0,7)<=mkey(state.year,state.month)).map(a=>a.amount));
const CDI_CACHE='reserva-simples-cdi-sgs12';
let cdiState=(()=>{try{const x=JSON.parse(localStorage.getItem(CDI_CACHE)||'{}');return{rates:Array.isArray(x.rates)?x.rates.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.value)&&r.value>=0):[],coveredFrom:x.coveredFrom||'',lastCheck:x.lastCheck||'',loading:false,error:''}}catch(e){return{rates:[],coveredFrom:'',lastCheck:'',loading:false,error:''}}})();
const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const shiftIso=(value,days)=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const parseSgsDate=value=>{const [d,m,y]=String(value).split('/');return `${y}-${m}-${d}`};
const cdiDateBR=value=>value?`${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`:'—';
const sgsDate=value=>`${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`;
const latestCdi=()=>cdiState.rates.slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||null;
const currentCdiAnnual=()=>{const r=latestCdi();return r?((Math.pow(1+r.value/100,252)-1)*100):null};
function cdiStatusText(){if(cdiState.loading)return 'Atualizando taxa CDI…';const last=latestCdi();if(cdiState.feedback)return cdiState.feedback+(last?' · CDI publicado até '+cdiDateBR(last.date):'')+(!cdiState.error&&cdiState.lastCheck?' · Consulta em '+new Date(cdiState.lastCheck).toLocaleString('pt-BR'):'');if(last)return `CDI atualizado até ${cdiDateBR(last.date)}${cdiState.error?' · usando histórico salvo':''}`;return cdiState.error?'CDI indisponível. Saldo exibido sem rendimento estimado.':'Buscando a taxa CDI oficial…'}
function cdiDateString(date){return `${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}`}
function cdiBounds(rates,pct=100){const dates=rates.map(x=>x.date),prefix=[1];for(const r of rates)prefix.push(prefix[prefix.length-1]*(1+r.value*pct/10000));const upper=(x)=>{let a=0,b=dates.length;while(a<b){const m=(a+b)>>1;if(dates[m]<=x)a=m+1;else b=m}return a};return{dates,prefix,factor:(after,through)=>{const a=upper(after),b=upper(through);return b>a?prefix[b]/prefix[a]:1}}}
function investmentCdiPercent(item){if(Number.isFinite(item.cdiPercent)&&item.cdiPercent>0)return item.cdiPercent;const text=`${item.name} ${item.product} ${item.institution}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');return item.assetType!=='livestock'&&text.includes('inter')&&text.includes('porquinho')?100:null}
function estimateCdbInvestment(item,asOf=isoToday()){
 const pct=investmentCdiPercent(item);if(item.assetType==='livestock'||!pct||item.cost<=0||item.status==='sold')return null;
 const product=`${item.name} ${item.product}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');if(!product.includes('cdb')&&!product.includes('porquinho'))return null;
 if((item.redemptions||[]).length)return{unavailable:'Atualize pelo extrato após registrar resgate.'};
 const rates=cdiState.rates.slice().sort((a,b)=>a.date.localeCompare(b.date)),first=latestCdi(),anchorDate=item.checked||item.date,covered=cdiState.coveredFrom||rates[0]?.date;
 if(!rates.length)return{unavailable:'CDI indisponível; saldo estimado não calculado.'};
 if(covered&&covered>anchorDate)return{unavailable:'Histórico CDI incompleto desde a conferência; atualize o CDI.'};
 if(anchorDate>asOf)return{unavailable:'A data da conferência está no futuro.'};
 const principal=item.cost,anchorAge=Math.max(0,Math.floor((new Date(anchorDate+'T12:00:00Z')-new Date(item.date+'T12:00:00Z'))/86400000)),anchorIofRate=(IOF_PERCENT[anchorAge]??0)/100,anchorIrRate=anchorAge<=180?.225:anchorAge<=360?.20:anchorAge<=720?.175:.15,anchorGainNet=item.balance-principal;
 if(anchorGainNet<0)return{unavailable:'O saldo informado está abaixo do valor aplicado; confira os dados do investimento.'};
 const anchorFactor=(1-anchorIofRate)*(1-anchorIrRate),anchorGross=principal+(anchorFactor?Math.round(anchorGainNet/anchorFactor):anchorGainNet),bounds=cdiBounds(rates,pct),gross=Math.round(anchorGross*bounds.factor(anchorDate,asOf)),gain=Math.max(0,gross-principal),age=Math.max(0,Math.floor((new Date(asOf+'T12:00:00Z')-new Date(item.date+'T12:00:00Z'))/86400000)),iof=Math.round(gain*((IOF_PERCENT[age]??0)/100)),irRate=age<=180?.225:age<=360?.20:age<=720?.175:.15,ir=Math.round(Math.max(0,gain-iof)*irRate),net=asOf===anchorDate?item.balance:Math.max(0,gross-iof-ir);
 return{principal,gross,gain,iof,ir,net,pct,asOf,anchorDate,rateDate:first?.date||null};
}
/* Resgates consomem primeiro os aportes mais antigos (FIFO); o valor restante de cada lote é ajustado proporcionalmente ao principal resgatado. */
function estimateCdbJar(jarId,asOf=isoToday()){const rates=cdiState.rates.slice().sort((a,b)=>a.date.localeCompare(b.date)),institution=db.institutions.find(x=>x.id===db.jars.find(j=>j.id===jarId)?.institutionId)||db.institutions[0],pct=institution?.cdiPercent||100;const rateDate=rates.length?rates[rates.length-1].date:null;const bounds=cdiBounds(rates,pct),events=db.allocations.filter(a=>a.jarId===jarId&&a.date<=asOf).sort(byAllocationDate);const lots=[];let cursor=events[0]?.date||asOf;for(const event of events){const factor=bounds.factor(cursor,event.date);for(const lot of lots)lot.value*=factor;if(event.amount>0)lots.push({date:event.date,principal:event.amount,value:event.amount});else{let remaining=-event.amount;for(const lot of lots){if(remaining<=0)break;const sold=Math.min(remaining,lot.principal);if(sold>0){lot.value*=1-sold/lot.principal;lot.principal-=sold;remaining-=sold}}}cursor=event.date}const through=rates.length?asOf:cursor,factor=bounds.factor(cursor,through);for(const lot of lots)lot.value*=factor;const principal=Math.round(lots.reduce((n,l)=>n+l.principal,0)),gross=Math.round(lots.reduce((n,l)=>n+l.value,0)),gain=Math.max(0,gross-principal),now=new Date(asOf+'T12:00:00Z');let iof=0,ir=0;for(const lot of lots){const age=Math.max(0,Math.floor((now-new Date(lot.date+'T12:00:00Z'))/86400000)),lotGain=Math.max(0,lot.value-lot.principal),iofRate=(IOF_PERCENT[age] ?? 0)/100,irRate=age<=180?.225:age<=360?.20:age<=720?.175:.15,lotIof=lotGain*iofRate;iof+=lotIof;ir+=(lotGain-lotIof)*irRate}return{principal,gross,gain,iof:Math.round(iof),ir:Math.round(ir),net:Math.max(0,gross-Math.round(iof)-Math.round(ir)),asOf,rateDate,hasRates:rates.length>0}}
async function updateCdi(force=false){if(cdiState.loading)return;if(!force&&!['http:','https:'].includes(location.protocol))return;const today=isoToday(),last=latestCdi(),checked=Date.parse(cdiState.lastCheck||0);if(!force&&last&&Date.now()-checked<12*60*60*1000)return;cdiState.loading=true;cdiState.error='';cdiState.feedback='';refreshMarketViews();try{const dates=[...db.allocations.filter(x=>x.amount>0).map(x=>x.date),...db.investments.filter(x=>investmentCdiPercent(x)).map(x=>x.date)].sort(),oldest=dates[0]||shiftIso(today,-35),lastDate=last?.date||'',from=lastDate?shiftIso(lastDate,-7):oldest,start=!lastDate||!cdiState.coveredFrom||oldest<cdiState.coveredFrom?oldest:from;let cursor=start;const added=[];while(cursor<=today){let end=shiftIso(cursor,3650);if(end>today)end=today;const url=`https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${encodeURIComponent(sgsDate(cursor))}&dataFinal=${encodeURIComponent(sgsDate(end))}`;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const rows=await response.json();if(!Array.isArray(rows))throw new Error('Resposta CDI inválida');for(const row of rows){const date=parseSgsDate(row.data),value=Number(String(row.valor).replace(',','.'));if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(value)&&value>=0)added.push({date,value})}}finally{clearTimeout(timer)}cursor=shiftIso(end,1)}const merged=new Map([...cdiState.rates,...added].map(x=>[x.date,x]));cdiState.rates=[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date));cdiState.coveredFrom=cdiState.coveredFrom&&cdiState.coveredFrom<start?cdiState.coveredFrom:start;cdiState.lastCheck=new Date().toISOString();let cached=true;try{localStorage.setItem(CDI_CACHE,JSON.stringify({rates:cdiState.rates,coveredFrom:cdiState.coveredFrom,lastCheck:cdiState.lastCheck}));}catch(e){cached=false;diagnostics.record('market.cdi_cache_failed',e)}cdiState.error='';if(force)cdiState.feedback=latestCdi()?.date===lastDate?'Consulta concluída. Nenhuma taxa nova disponível.':added.length?'Consulta concluída. CDI atualizado.':'Consulta concluída. Nenhuma taxa disponível.';if(force&&!cached)cdiState.feedback+=' O histórico não pôde ser salvo neste aparelho.'}catch(e){diagnostics.record('market.cdi_failed',e);cdiState.error='Não foi possível consultar o Banco Central agora.';if(force)cdiState.feedback=cdiState.error+(latestCdi()?' Usando a última taxa disponível.':'')+(!['http:','https:'].includes(location.protocol)?' Se o navegador bloquear a consulta pelo arquivo local, tente no app publicado.':'')}finally{cdiState.loading=false;refreshMarketViews()}}
const IPCA_CACHE='reserva-simples-ipca-sgs433';
let ipcaState=(()=>{try{const x=JSON.parse(localStorage.getItem(IPCA_CACHE)||'{}');return{rates:Array.isArray(x.rates)?x.rates.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.value)):[],lastCheck:x.lastCheck||'',loading:false,error:''}}catch(e){return{rates:[],lastCheck:'',loading:false,error:''}}})();
const latestIpca=()=>ipcaState.rates.slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||null;
const currentIpcaAnnual=()=>{const rates=ipcaState.rates.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);return rates.length<12?null:(rates.reduce((f,r)=>f*(1+r.value/100),1)-1)*100};
async function updateIpca(force=false){if(ipcaState.loading||location.protocol==='file:')return;const checked=Date.parse(ipcaState.lastCheck||0);if(!force&&ipcaState.rates.length>=12&&Date.now()-checked<24*60*60*1000)return;ipcaState.loading=true;try{const response=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json',{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const rows=await response.json();if(!Array.isArray(rows)||!rows.length)throw new Error('IPCA indisponível');ipcaState.rates=rows.map(r=>({date:parseSgsDate(r.data),value:Number(String(r.valor).replace(',','.'))})).filter(r=>validDate(r.date)&&Number.isFinite(r.value)).sort((a,b)=>a.date.localeCompare(b.date));ipcaState.lastCheck=new Date().toISOString();localStorage.setItem(IPCA_CACHE,JSON.stringify({rates:ipcaState.rates,lastCheck:ipcaState.lastCheck}));ipcaState.error=''}catch(e){diagnostics.record('market.ipca_failed',e);ipcaState.error='IPCA não atualizou; usando o histórico salvo.'}finally{ipcaState.loading=false;refreshMarketViews()}}
const fundLabel=f=>f==='fgc'?'FGC':f==='fgcoop'?'FGCoop':'Sem monitoramento';
function miniLine(values,label,axisLabels=['Início','30 dias','60 dias','90 dias']){const clean=values.filter(Number.isFinite);if(clean.length<2)return '<div class="empty-inline">O gráfico aparecerá com mais dados.</div>';const w=360,h=96,pad=12,min=Math.min(...clean,0),max=Math.max(...clean,0),range=max-min||1,points=clean.map((v,i)=>`${pad+i*(w-2*pad)/(clean.length-1)},${h-pad-(v-min)*(h-2*pad)/range}`).join(' '),zeroY=h-pad-(0-min)*(h-2*pad)/range;return `<div class="visual-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><line x1="${pad}" y1="${zeroY}" x2="${w-pad}" y2="${zeroY}" class="chart-zero"/><polyline points="${points}" class="chart-line"/><circle cx="${w-pad}" cy="${h-pad-(clean[clean.length-1]-min)*(h-2*pad)/range}" r="4" class="chart-point"/></svg><div class="visual-chart-labels">${axisLabels.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`}
function upcomingBillInstances(horizon=14,today=isoToday()){
  const start=Engines.dateAtOffset(today,-30),end=Engines.dateAtOffset(today,horizon);
  return Engines.pendingOccurrences(db,start,end,'expense').map(item=>{
    const daysUntil=(Date.parse(item.date)-Date.parse(today))/86400000;
    return {...item,daysUntil,daysLate:Math.max(0,-daysUntil)};
  });
}
function billNotificationPermission(){return !('Notification'in window)?'Este navegador não oferece notificações.':Notification.permission==='granted'?'Notificações permitidas neste aparelho.':Notification.permission==='denied'?'Permissão bloqueada nas configurações do navegador.':'Permissão ainda não concedida.'}
async function requestBillNotificationPermission(){if(!('Notification'in window))return notify('Este navegador não oferece notificações.');if(location.protocol==='file:')return notify('Abra o Reserva Simples pelo endereço HTTPS para permitir notificações.');try{const permission=await Notification.requestPermission();if(permission==='granted'){if(!db.prefs.billReminders)await mutate(()=>db.prefs.billReminders=true);notify('Notificações de vencimentos permitidas.');await checkBillReminders()}else notify(permission==='denied'?'Permissão negada. Altere nas configurações do navegador.':'Permissão não concedida.')}catch(e){notify('Não foi possível solicitar a permissão para notificações.')}settings()}
async function checkBillReminders(){if(!db.prefs.billReminders||!('Notification'in window)||Notification.permission!=='granted')return;const due=upcomingBillInstances(Number(db.prefs.billReminderDays)||0).filter(item=>item.daysUntil>=0&&item.daysUntil<=db.prefs.billReminderDays);if(!due.length)return;const storageKey='reserva.billReminder.sent',sent=(()=>{try{return new Set(JSON.parse(localStorage.getItem(storageKey)||'[]'))}catch(e){return new Set()}})();for(const item of due){const key=item.id+'@'+item.date;if(sent.has(key))continue;const when=item.daysUntil===0?'vence hoje':item.daysUntil===1?'vence amanhã':`vence em ${item.daysUntil} dias`,title='Lembrete de conta';const options={body:`${item.note||item.category} · ${money(item.amount)} · ${dateBR(item.date)}`,tag:'bill-'+key,renotify:false,data:{date:item.date,module:'budget'}};try{let registration=null;if('serviceWorker'in navigator){const current=await navigator.serviceWorker.getRegistration();registration=current?.active?current:null}if(registration?.showNotification)await registration.showNotification(title+': '+when,options);else{const notification=new Notification(title+': '+when,options);notification.onclick=()=>{window.focus();state.year=Number(item.date.slice(0,4));state.month=Number(item.date.slice(5,7))-1;state.calendarDate=item.date;go('calendar');notification.close()}}sent.add(key);localStorage.setItem(storageKey,JSON.stringify([...sent].slice(-500)))}catch(e){console.warn('Lembrete não exibido',e)}}}
function cashProjection(days){
  const {balanceAnchorCents:cents,balanceAnchorDate:anchor}=db.prefs,today=isoToday();
  if(!Number.isSafeInteger(cents)||!validDate(anchor)||anchor>today)return null;
  const end=shiftIso(today,days), daily=new Map();
  let nowBalance=cents,events=0;
  const add=(date,amount)=>{
    daily.set(date,(daily.get(date)||0)+amount);
    events++;
  };
  const addRecorded=(date,amount)=>{
    if(date<=anchor||date>end)return;
    if(date<=today)nowBalance+=amount;
    else add(date,amount);
  };
  for(const record of db.records)addRecorded(record.date,record.kind==='income'?record.amount:-record.amount);
  for(const item of db.allocations)addRecorded(item.date,item.netReceived??-item.amount);
  for(const item of Engines.investmentCashEvents(db))addRecorded(item.date,item.amount);
  const start=today.slice(0,7)+'-01';
  for(const item of Engines.pendingOccurrences(db,start,end)){
    if(item.date<=anchor)continue;
    add(item.date<today?today:item.date,item.kind==='income'?item.amount:-item.amount);
  }
  let running=nowBalance,lowest=running;
  const dailyBalances={};
  for(let date=today;date<=end;date=shiftIso(date,1)){
    running+=daily.get(date)||0;
    lowest=Math.min(lowest,running);
    dailyBalances[date]=running;
  }
  return {days,end,nowBalance,projected:running,lowest,events,dailyBalances};
}
function cashflowCard(){const horizons=[30,60,90].map(n=>cashProjection(n));if(horizons.every(x=>x===null))return `<article class="card">${cardTitle('Previsão de caixa em 30, 60 e 90 dias','Inclui contas recorrentes e lançamentos futuros informados.')}<div class="empty"><strong>Informe seu saldo disponível de referência</strong>Em Metas, abra “Referências de planejamento” para registrar o saldo atual e a data correspondente. A projeção usa esse valor e os lançamentos feitos depois dessa data.<button class="btn" data-page="goals" data-open-planning="1" style="margin-top:12px">Configurar saldo</button></div></article>`;return `<article class="card">${cardTitle('Previsão de caixa em 30, 60 e 90 dias','Saldo inicial informado por você, com recorrências e lançamentos futuros conhecidos.')}${miniLine([horizons[0]?.nowBalance,horizons[0]?.projected,horizons[1]?.projected,horizons[2]?.projected],'Linha do saldo projetado em 30, 60 e 90 dias')}<div class="table-wrap"><table class="data-table"><thead><tr><th>Prazo</th><th>Data</th><th>Saldo previsto</th><th>Menor saldo no período</th><th>Eventos</th></tr></thead><tbody>${horizons.map(x=>`<tr><td>${x.days} dias</td><td>${dateBR(x.end)}</td><td class="money ${x.projected<0?'danger-text':''}">${money(x.projected)}</td><td class="money ${x.lowest<0?'danger-text':''}">${money(x.lowest)}</td><td>${x.events}</td></tr>`).join('')}</tbody></table></div><p class="help">Projeção informativa: depende do saldo de referência, da atualização dos registros e das contas recorrentes cadastradas. Não inclui transações que ainda não foram registradas ou previstas.</p></article>`}
function calendarEventsForMonth(year,monthIndex){
  const period=mkey(year,monthIndex),events=new Map(),add=(date,item)=>{if(!validDate(date)||!date.startsWith(period))return;const list=events.get(date)||[];list.push(item);events.set(date,list)};
  for(const r of db.records.filter(x=>x.date.startsWith(period)))add(r.date,{kind:r.kind==='income'?'income':'expense',title:r.note||r.category,detail:[r.category,r.subcategory,...(r.tags||[]).map(tag=>'#'+tag)].filter(Boolean).join(' · '),value:r.kind==='income'?r.amount:-r.amount,source:'record',id:r.id});
  for(const a of db.allocations.filter(x=>x.date.startsWith(period))){const jar=db.jars.find(j=>j.id===a.jarId);add(a.date,{kind:a.amount>0?'deposit':'withdrawal',title:a.note||(a.amount>0?'Aporte no cofrinho':'Resgate do cofrinho'),detail:jar?.name||'Meta',value:a.amount>0?-a.amount:(a.netReceived??-a.amount),source:'allocation',id:a.id,jarId:a.jarId})}
  for(const position of db.investments){for(const item of Engines.investmentCashEvents({investments:[position]})){if(!item.date.startsWith(period))continue;const purchase=item.date===position.date&&!position.existing;add(item.date,{kind:purchase?'investment':'redemption',title:purchase?'Aplicação: '+position.name:'Resgate: '+position.name,detail:position.institution,value:item.amount,source:'investment',id:position.id})}}
  for(const task of db.tasks.filter(x=>x.date.startsWith(period)))add(task.date,{kind:task.done?'task-done':'task',title:task.title,detail:task.note||'Tarefa da agenda',time:task.time,source:'task',id:task.id,color:task.color||'blue',done:task.done});
  const {first,last}=Engines.monthBounds(year,monthIndex);
  for(const item of Engines.pendingOccurrences(db,first,last)){
    const income=item.kind==='income';
    add(item.date,{kind:income?'scheduled-income':'scheduled-expense',title:item.note||item.category||'Conta recorrente',
      detail:'Previsão recorrente · '+(income?'Entrada':'Saída'),value:income?item.amount:-item.amount,source:'recurring',id:item.id});
  }
  for(const list of events.values())list.sort((a,b)=>(a.time||'').localeCompare(b.time||'')||a.title.localeCompare(b.title,'pt-BR'));
  return events;
}
function ensureCalendarCompose(){
  if (!$('#calendarComposeDialog')) {
    document.body.insertAdjacentHTML('beforeend', `<dialog id="calendarComposeDialog" aria-label="Agendar compromisso"><article class="card calendar-compose"><div class="calendar-detail-head"><div><h3>Agendar compromisso</h3></div></div><p class="calendar-form-help">Inclua uma tarefa ou compromisso para este dia.</p><form id="calendarTaskForm" class="calendar-task-form"><label class="field"><span>O que você precisa fazer?</span><input name="title" type="text" maxlength="90" required placeholder="Ex.: pagar conta de luz"></label><div class="calendar-task-fields"><label class="field"><span>Horário (opcional)</span><input name="time" type="time"></label><label class="field"><span>Data</span><input name="date" type="date" required></label></div><fieldset class="calendar-color-picker"><legend>Cor do compromisso</legend><div class="calendar-color-options">${Object.entries(CALENDAR_TASK_COLORS).map(([color,hex])=>`<label><input type="radio" name="color" value="${color}" ${color==='blue'?'checked':''}><i style="--swatch:${hex}"></i><span>${CALENDAR_TASK_COLOR_LABELS[color]}</span></label>`).join('')}</div></fieldset><label class="field"><span>Observação (opcional)</span><input name="note" type="text" maxlength="180" placeholder="Detalhes do compromisso"></label><button class="btn primary" type="submit">Salvar na agenda</button><button type="button" class="btn" data-close-calendar-compose>Fechar</button></form></article></dialog>`);
  }
  return $('#calendarComposeDialog');
}
function openCalendarCompose(date=state.calendarDate||isoToday()){
  const dialog=ensureCalendarCompose();
  const form=dialog.querySelector('form');
  calendarTaskEditId=null;
  form.reset();
  form.elements.date.value=date;
  dialog.querySelector('h3').textContent='Agendar compromisso';
  form.querySelector('[type="submit"]').textContent='Salvar na agenda';
  form.querySelector('[data-task-edit-cancel]')?.remove();
  if(!dialog.open)dialog.showModal();
}

function validateCalendarNotes(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>5000)return null;
  const ids=new Set();
  const notes=[];
  for(const note of value){
    if(!note||typeof note.id!=='string'||!note.id||note.id.length>120||ids.has(note.id)||!validDate(note.date)||typeof note.text!=='string'||!note.text.trim()||note.text.length>1000)return null;
    ids.add(note.id);
    notes.push({id:note.id,date:note.date,text:note.text,pinned:note.pinned===true});
  }
  return notes;
}
function calendarNotes(){return db.notes||[]}
let calendarTab='agenda';
function syncCalendarTabs(){
  const root=$('#page-calendar');
  root.dataset.calendarTab=calendarTab;
  root.querySelectorAll('[data-calendar-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.calendarTab===calendarTab)));
}
function calendarOrganizer(date,tasks){
  const notes=calendarNotes().filter(note=>note.date===date).sort((a,b)=>Number(b.pinned)-Number(a.pinned));
  return `<article class="card calendar-organizer-card"><div class="calendar-detail-head"><div><span class="calendar-detail-date">${dateBR(date)}</span><h3>Tarefas</h3></div><span class="tag soft">${tasks.length}</span></div><button class="btn" data-calendar-new-task data-task-kind="task">Nova tarefa</button>${[...tasks].sort((a,b)=>Number(a.done)-Number(b.done)).map(task=>`<div class="calendar-organizer-row"><strong>${esc(task.title)}</strong><small>${task.done?'Concluída':'Pendente'}${task.time?' · '+esc(task.time):''}</small>${task.note?'<p>'+esc(task.note)+'</p>':''}<div class="actions"><button class="btn small" data-task-edit="${esc(task.id)}">Editar ou reagendar</button><button class="btn small" data-task-toggle="${esc(task.id)}">${task.done?'Reabrir':'Concluir'}</button><button class="btn small negative" data-task-delete="${esc(task.id)}">Excluir</button></div></div>`).join('')||'<p>Sem tarefas neste dia.</p>'}</article>
  <article class="card calendar-organizer-card"><div class="calendar-detail-head"><div><span class="calendar-detail-date">${dateBR(date)}</span><h3>Notas</h3></div><button type="button" class="btn small primary" data-calendar-new-note>Nova nota</button></div><dialog id="calendarNoteDialog" class="calendar-note-editor" aria-labelledby="calendarNoteTitle"><div class="card"><h3 id="calendarNoteTitle">Nova nota</h3><form id="calendarNoteForm" class="calendar-task-form"><input name="id" type="hidden"><label class="field">Nota<textarea name="text" maxlength="1000" required></textarea></label><label class="field">Data<input name="date" type="date" value="${date}" required></label><div class="actions"><button type="submit" class="btn primary">Salvar nota</button><button class="btn" type="button" data-close-calendar-note>Cancelar</button></div></form></div></dialog>${notes.map(note=>`<div class="calendar-organizer-row calendar-note-item"><strong>${note.pinned?'Fixada · ':''}${esc(note.text.length>150?note.text.slice(0,150)+'…':note.text)}</strong><div class="actions"><button class="btn small" data-note-action="edit" data-note-id="${esc(note.id)}">Editar ou mover</button><button class="btn small" data-note-action="pin" data-note-id="${esc(note.id)}">${note.pinned?'Desafixar':'Fixar'}</button><button class="btn small negative" data-note-action="delete" data-note-id="${esc(note.id)}">Excluir</button></div></div>`).join('')||'<div class="empty-inline">Sem notas nesta data.</div>'}</article>`;
}
async function saveCalendarNotes(notes){
  if(await mutate(()=>{db.notes=notes})){calendar();return true}
  return false;
}
document.addEventListener('submit',event=>{
  if(event.target.id!=='calendarNoteForm')return;
  event.preventDefault();
  const {id,text,date}=event.target.elements;
  const body=text.value.trim();
  if(!body||!validDate(date.value))return;
  const notes=calendarNotes(), previous=notes.find(note=>note.id===id.value);
  saveCalendarNotes([...notes.filter(note=>note.id!==id.value),{id:previous?.id||uid(),text:body,date:date.value,pinned:previous?.pinned||false}]);
});
document.addEventListener('click',event=>{
  const tab=event.target.closest('[data-calendar-tab]');
  if(tab){calendarTab=tab.dataset.calendarTab;syncCalendarTabs();}
  if(event.target.closest('[data-close-calendar-note]'))$('#calendarNoteDialog')?.close();
  if(event.target.closest('[data-calendar-new-note]')){
    $('#calendarNoteTitle').textContent='Nova nota';
    $('#calendarNoteForm').reset();
    $('#calendarNoteForm').elements.id.value='';
    $('#calendarNoteDialog').showModal();
  }
  if(event.target.closest('[data-close-calendar-compose]'))$('#calendarComposeDialog')?.close();
  const createTask=event.target.closest('[data-calendar-new-task]');
  if(createTask){
    openCalendarCompose(createTask.hasAttribute('data-home-new-task')?isoToday():undefined);
    if(createTask.dataset.taskKind==='task')$('#calendarComposeDialog h3').textContent='Nova tarefa';
  }
  const button=event.target.closest('[data-note-action]');
  if(!button)return;
  const notes=calendarNotes(),note=notes.find(item=>item.id===button.dataset.noteId);
  if(!note)return;
  if(button.dataset.noteAction==='edit'){
    const {id,text,date}=$('#calendarNoteForm').elements;
    $('#calendarNoteTitle').textContent='Editar nota';
    $('#calendarNoteDialog').showModal();
    id.value=note.id;text.value=note.text;date.value=note.date;text.focus();
  }else if(button.dataset.noteAction==='pin'){
    saveCalendarNotes(notes.map(item=>item===note?{...item,pinned:!item.pinned}:item));
  }else if(confirm('Excluir esta nota?'))saveCalendarNotes(notes.filter(item=>item!==note));
});
function calendarSpending(events){
  const expensesByDay=new Map();
  for(const [date,list] of events){const amount=list.filter(item=>item.source==='record'&&item.kind==='expense').reduce((total,item)=>total+Math.abs(item.value||0),0);if(amount>0)expensesByDay.set(date,amount)}
  const highestDailyExpense=Math.max(0,...expensesByDay.values());
  const levelFor=date=>{
    const expense=expensesByDay.get(date)||0;
    return expense&&highestDailyExpense?Math.min(5,Math.ceil(expense/highestDailyExpense*5)):0;
  };
  return {expensesByDay,highestDailyExpense,levelFor};
}
function calendar(){
  const y=state.year,m=state.month,key=mkey(y,m),today=isoToday(),days=new Date(y,m+1,0).getDate(),startOffset=(new Date(y,m,1).getDay()+6)%7,total=Math.ceil((startOffset+days)/7)*7,events=calendarEventsForMonth(y,m),selected=state.calendarDate?.startsWith(key)?state.calendarDate:(today.startsWith(key)?today:key+'-01');state.calendarDate=selected;
  const {expensesByDay,highestDailyExpense,levelFor}=calendarSpending(events);
  const futureDays=Math.max(0,Math.ceil((new Date(y,m+1,1)-new Date(today+'T12:00:00'))/86400000));const projection=futureDays<=120?cashProjection(futureDays):null;
  const dayBalance=date=>{if(!projection||!date.startsWith(key))return null;if(date===today)return projection.dailyBalances?.[today]??projection.nowBalance;if(date>today)return projection.dailyBalances?.[date]??null;return null};
  const noteDates=new Set(calendarNotes().map(note=>note.date));
  const cells=Array.from({length:total},(_,i)=>{const day=i-startOffset+1;if(day<1||day>days)return '<div class="calendar-day outside" aria-hidden="true"></div>';const date=key+'-'+String(day).padStart(2,'0'),list=events.get(date)||[],balance=dayBalance(date),flow=list.filter(x=>Number.isSafeInteger(x.value)).reduce((n,x)=>n+x.value,0),taskColors=[...new Set(list.filter(x=>x.source==='task').map(x=>x.color||'purple'))].slice(0,3),dayAccent=taskColors[0]||'',dailyExpense=expensesByDay.get(date)||0,heatLevel=levelFor(date);return `<button type="button" class="calendar-day ${date===selected?'selected':''} ${date===today?'is-today':''} ${dayAccent?'has-appointment':''}" ${dayAccent?`style="--calendar-day-accent:${calendarTaskColor(dayAccent)}"`:''} ${heatLevel?`data-expense-heat="${heatLevel}" title="Despesas do dia: ${money(dailyExpense)}"`:''} data-calendar-date="${date}" aria-pressed="${date===selected}" aria-label="${day} de ${MONTHS[m]}, ${list.length} evento(s)${noteDates.has(date)?', com notas':''}${dailyExpense&&!hideValues?', despesas '+money(dailyExpense):''}"><span class="calendar-day-number">${day}</span><span class="calendar-cell-preview">${list.slice(0,2).map(item=>`<span>${esc(item.title)}</span>`).join('')}${list.length>2?'<span>+'+(list.length-2)+'</span>':''}</span>${balance!==null?`<small class="calendar-balance ${balance<0?'negative':''}">${money(balance)}</small>`:list.length?`<small class="calendar-count">${list.length} ${list.length===1?'item':'itens'}${flow?` · ${money(flow)}`:''}</small>`:''}</button>`}).join('');
  const selectedEvents=events.get(selected)||[],tasks=db.tasks.filter(x=>x.date===selected).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const rows=selectedEvents.length?selectedEvents.map(item=>`<div class="calendar-event-row ${item.kind}" ${item.source==='task'?`style="--event-color:${calendarTaskColor(item.color)}"`:''}><span class="calendar-event-icon">${icon(item.source==='task'?'calendar':item.kind==='income'||item.kind==='scheduled-income'?'income':item.kind==='task-done'?'target':'expense')}</span><span class="calendar-event-copy"><b>${esc(item.title)}</b><small>${item.time?esc(item.time)+' · ':''}${esc(item.detail)}${item.source==='recurring'?' · ainda não lançada':''}</small></span>${Number.isSafeInteger(item.value)?`<strong class="${item.value<0?'negative':''}">${item.value>0?'+':''}${money(item.value)}</strong>`:''}${item.source==='task'?`<div class="calendar-event-actions"><button type="button" class="btn small" data-task-edit="${esc(item.id)}">Editar</button><button type="button" class="btn small" data-task-toggle="${esc(item.id)}">${item.done?'Reabrir':'Concluir'}</button><button type="button" class="calendar-delete" data-task-delete="${esc(item.id)}" aria-label="Excluir tarefa">×</button></div>`:''}${item.source==='record'?`<div class="calendar-event-actions"><button type="button" class="btn small" data-calendar-record-edit="${esc(item.id)}">Editar</button><button type="button" class="btn small negative" data-calendar-record-delete="${esc(item.id)}">Excluir</button></div>`:''}${item.source==='allocation'?`<div class="calendar-event-actions"><button type="button" class="btn small" data-calendar-allocation-edit="${esc(item.id)}">Editar</button><button type="button" class="btn small negative" data-calendar-allocation-delete="${esc(item.id)}">Excluir</button></div>`:''}${item.source==='investment'?`<div class="calendar-event-actions"><button type="button" class="btn small" data-calendar-investment-edit="${esc(item.id)}">Editar investimento</button><button type="button" class="btn small negative" data-calendar-investment-delete="${esc(item.id)}">Excluir investimento</button></div>`:''}</div>`).join(''):'<div class="empty-inline">Nenhum lançamento, compromisso ou tarefa neste dia.</div>';
  const balance=dayBalance(selected),dailyFlow=selectedEvents.filter(x=>Number.isSafeInteger(x.value)).reduce((n,x)=>n+x.value,0);
  $('#page-calendar').innerHTML=`${heading('Calendário','Consulte o saldo previsto, lançamentos e compromissos do mês.')}<div class="calendar-tabs" role="group" aria-label="Detalhes do dia"><button class="btn" data-calendar-tab="agenda">Agenda</button><button class="btn" data-calendar-tab="tasks">Tarefas</button><button class="btn" data-calendar-tab="notes">Notas</button></div><div class="calendar-organizer"><article class="card calendar-detail"><div class="calendar-detail-head"><div><span class="calendar-detail-date">${dateBR(selected)}</span><h3>Agenda do dia</h3></div><span class="tag soft">${selectedEvents.length} ${selectedEvents.length===1?'item':'itens'}</span></div><div class="actions calendar-day-actions"><button class="btn small" data-calendar-new-task>Agendar compromisso</button></div><div class="calendar-event-list">${rows}</div><div class="calendar-balance-panel"><div><span>Saldo previsto do dia</span><small>${balance===null?(selected<today?'Histórico diário não estimado':'Configure o saldo de referência em Metas'):'Estimativa acumulada até '+dateBR(selected)}</small></div><strong class="calendar-balance-total ${balance!==null&&balance<0?'negative':''}">${balance===null?'—':money(balance)}</strong></div><div class="calendar-balance-summary"><span>Movimento previsto neste dia</span><b>${money(dailyFlow)}</b></div>${tasks.length?`<div class="calendar-task-summary"><b>${tasks.filter(t=>!t.done).length} tarefa(s) pendente(s)</b><small>${tasks.filter(t=>t.done).length} concluída(s)</small></div>`:''}</article>${calendarOrganizer(selected,tasks)}</div><article class="card calendar-card"><div class="calendar-topline"><div><div class="actions"><button class="btn" data-home-month="prev" aria-label="Mês anterior">‹</button><button class="btn" data-home-month="pick">${esc(monthLabel())}</button><button class="btn" data-home-month="next" aria-label="Próximo mês">›</button></div><small>Selecione um dia para consultar a agenda.</small></div><span class="calendar-legend">${highestDailyExpense?'<span class="calendar-heat-legend" role="img" aria-label="Gastos: menos a mais despesas registradas"><b>Gastos</b><small>Menos</small>'+[1,2,3,4,5].map(level=>`<i data-heat-level="${level}" aria-hidden="true"></i>`).join('')+'<small>Mais</small></span>':''}</span></div><div class="calendar-grid" role="grid" aria-label="Calendário de ${esc(monthLabel())}">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=>`<div class="calendar-weekday" role="columnheader">${d}</div>`).join('')}${cells}</div><p class="help">A previsão usa o saldo de referência, os lançamentos e as contas recorrentes. Compromissos não alteram o saldo.</p></article>`;
  ensureCalendarCompose();
  syncCalendarTabs();
  const dayDialog=$('#calendarDayDialog'),dialogContent=$('#calendarDayDialogContent');if(dayDialog?.open&&dialogContent){const dayDetail=$('#page-calendar .calendar-detail');if(dayDetail)dialogContent.innerHTML=dayDetail.innerHTML}
}
let calendarTaskEditId=null,calendarRecordEditPending=false,calendarInvestmentEditPending=false;
function editCalendarTask(id){const task=db.tasks.find(x=>x.id===id),form=$('#calendarTaskForm');if(!task||!form)return;$('#calendarDayDialog')?.close();openCalendarCompose();calendarTaskEditId=id;form.elements.title.value=task.title;form.elements.date.value=task.date;form.elements.time.value=task.time||'';form.elements.note.value=task.note||'';const color=form.querySelector(`input[name="color"][value="${CSS.escape(task.color||'blue')}"]`);if(color)color.checked=true;form.querySelector('[type="submit"]').textContent='Salvar alterações';form.closest('.calendar-compose')?.querySelector('h3')?.replaceChildren(document.createTextNode('Editar compromisso'));let cancel=form.querySelector('[data-task-edit-cancel]');if(!cancel){cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.dataset.taskEditCancel='';cancel.textContent='Cancelar edição';form.append(cancel)}form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.title.focus()}
function cancelCalendarTaskEdit(){calendarTaskEditId=null;$('#calendarComposeDialog')?.close()}
async function submitCalendarTask(event){event.preventDefault();const form=event.target,title=form.elements.title.value.trim(),date=form.elements.date.value,time=form.elements.time.value,note=form.elements.note.value.trim(),color=form.querySelector('input[name="color"]:checked')?.value||'blue';if(!title||title.length>90||!validDate(date)||time&&!/^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(time))return notify('Confira o título, a data e o horário da tarefa.');const existing=db.tasks.find(x=>x.id===calendarTaskEditId),task={id:existing?.id||uid(),title,date,time,note,color,done:existing?.done||false};if(await mutate(()=>{if(existing)db.tasks[db.tasks.indexOf(existing)]=task;else db.tasks.push(task)})){calendarTaskEditId=null;form.closest('dialog')?.close();if(state.page==='calendar'){state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;state.calendarDate=date;render()}notify(existing?'Compromisso atualizado.':'Tarefa adicionada à agenda.')}}
async function toggleCalendarTask(id){const task=db.tasks.find(x=>x.id===id);if(task&&await mutate(()=>task.done=!task.done))calendar()}
async function deleteCalendarTask(id){const task=db.tasks.find(x=>x.id===id);if(!task)return;if(!confirm(`Excluir “${task.title}” da agenda?`))return;if(await mutate(()=>db.tasks=db.tasks.filter(x=>x.id!==id)))calendar()}
function emergencyReserveCard(){const now=new Date(),periods=[-3,-2,-1].map(delta=>{const d=new Date(now.getFullYear(),now.getMonth()+delta,1);return mkey(d.getFullYear(),d.getMonth())}),samples=periods.map(key=>({key,expense:sum(db.records.filter(r=>r.kind==='expense'&&r.date.startsWith(key)).map(r=>r.amount))})).filter(x=>x.expense>0),average=samples.length?Math.round(sum(samples.map(x=>x.expense))/samples.length):0,months=db.prefs.emergencyMonths||6,target=average*months,reserve=sum(db.jars.filter(j=>!j.archived).map(j=>estimateCdbJar(j.id).net)),cover=average?reserve/average:null,remaining=Math.max(0,target-reserve);if(!average||!db.jars.some(j=>!j.archived))return '';return `<article class="card">${cardTitle('Reserva de emergência','Compara os CDBs registrados com a média das despesas dos meses fechados recentes.')}<div class="prediction-grid"><div><span>Média mensal de despesas</span><strong>${average?money(average):'—'}</strong></div><div><span>Reserva líquida estimada</span><strong>${money(reserve)}</strong></div><div><span>Meses cobertos</span><strong>${cover===null?'Histórico insuficiente':cover.toFixed(1).replace('.',',')}</strong></div></div><div class="reserve-meter"><div class="reserve-meter-fill" style="width:${target?Math.min(100,reserve/target*100):0}%"></div></div><p class="help">Referência configurada: ${months} meses · meta sugerida ${average?money(target):'aguardando despesas'} · faltam ${money(remaining)}. Usa todas as despesas registradas, sem classificar apenas as essenciais. Pressupõe que os CDBs possam ser resgatados quando necessário.</p></article>`}
function guaranteeCard(){const groups=new Map();for(const i of db.institutions){if(!['fgc','fgcoop'].includes(i.guaranteeFund))continue;const key=i.guaranteeFund+'|'+(i.conglomerate||i.name).trim().toLocaleLowerCase('pt-BR');if(!groups.has(key))groups.set(key,{fund:i.guaranteeFund,name:i.conglomerate||i.name,total:0});const g=groups.get(key);g.total+=i.otherCoveredBalance||0;for(const j of db.jars.filter(j=>!j.archived&&j.institutionId===i.id))g.total+=estimateCdbJar(j.id).gross}const cap=25000000,rows=[...groups.values()];return `<article class="card">${cardTitle('Monitoramento FGC e FGCoop','Exposição estimada informada por você, agrupada por fundo e conglomerado.')}<div class="institution-list">${rows.length?rows.map(g=>`<div class="institution-row"><span><b>${fundLabel(g.fund)} · ${esc(g.name)}</b><small>Exposição cadastrada: ${money(g.total)} · margem até a referência de R$ 250 mil: ${money(Math.max(0,cap-g.total))}</small><span class="reserve-meter"><span class="reserve-meter-fill ${g.total>cap?'over':''}" style="width:${Math.min(100,g.total/cap*100)}%"></span></span></span><span class="tag ${g.total>cap?'warn':'soft'}">${g.total>cap?'Acima da referência':'Abaixo da referência'}</span></div>`).join(''):'<div class="empty-inline">Cadastre uma instituição e indique o fundo garantidor para acompanhar a exposição.</div>'}</div><p class="help">Monitoramento aproximado, não confirmação de cobertura. Confirme se a instituição e cada produto são elegíveis, some os saldos externos e considere regras de conglomerado e limites globais. O teto de R$ 1 milhão do FGC em quatro anos não está calculado aqui.</p></article>`}
function debtCompareValues(){const rate=currentCdiAnnual(),months=Number($('#debtMonths')?.value||0),tax=months>24?15:months>12?17.5:months>6?20:22.5,netAnnual=rate===null?null:rate*(1-tax/100),monthly=netAnnual===null?null:Math.pow(1+netAnnual/100,1/12)-1,quote=toCents($('#debtPayoff')?.value),payment=toCents($('#debtPayment')?.value),n=months,cet=Number($('#debtCET')?.value);if(!Number.isSafeInteger(quote)||quote<=0||!Number.isSafeInteger(payment)||payment<=0||!Number.isInteger(n)||n<=0||n>600||monthly===null)return '<p class="help">Preencha os valores da proposta de quitação e das parcelas para comparar.</p>';let pv=0;for(let i=1;i<=n;i++)pv+=payment/Math.pow(1+monthly,i);const diff=pv-quote,rateInfo=Number.isFinite(cet)&&cet>0?` CET informado: ${percent(cet)} a.a., ${cet>netAnnual?'acima':'abaixo'} do CDI líquido de referência.`:'';return `<div class="prediction-grid"><div><span>Parcelas trazidas a valor presente</span><strong>${money(Math.round(pv))}</strong></div><div><span>Quitar hoje</span><strong>${money(quote)}</strong></div><div><span>Diferença estimada</span><strong>${money(Math.abs(Math.round(diff)))}</strong></div></div><div class="comparison-bars"><div><span>Parcelas a valor presente</span><i><b style="width:${Math.min(100,pv/Math.max(pv,quote,1)*100)}%"></b></i></div><div><span>Quitar hoje</span><i><b class="alt" style="width:${Math.min(100,quote/Math.max(pv,quote,1)*100)}%"></b></i></div></div><p class="help">${diff>0?'A quitação custa menos que o valor presente estimado das parcelas.':'Manter as parcelas custa menos no cenário de rendimento usado.'}${rateInfo} CDI líquido de referência: ${percent(netAnnual)} a.a. Pressupõe parcelas iguais, pagamentos no fim de cada mês e uso do mesmo dinheiro; não inclui multas, descontos, seguros ou tarifas fora dos valores informados.</p>`}
function updateDebtComparison(){const el=$('#debtCompareResult');if(el)el.innerHTML=debtCompareValues()}
function debtCompareCard(){return `<article class="card">${cardTitle('Comparar quitação de dívida com CDB','Uma comparação matemática usando o rendimento líquido do CDI como custo de oportunidade.')}<div class="simulator-fields"><div class="field"><label for="debtPayoff">Valor para quitar hoje (R$)</label><input id="debtPayoff" type="number" min="0.01" step="0.01" inputmode="decimal"></div><div class="field"><label for="debtPayment">Valor de cada parcela restante (R$)</label><input id="debtPayment" type="number" min="0.01" step="0.01" inputmode="decimal"></div><div class="field"><label for="debtMonths">Parcelas restantes</label><input id="debtMonths" type="number" min="1" max="600" step="1"></div><div class="field"><label for="debtCET">CET informado pela instituição (% a.a.)</label><input id="debtCET" type="number" min="0" step="0.01"></div></div><div id="debtCompareResult" aria-live="polite">${debtCompareValues()}</div></article>`}
function inflationGoalCard(){const rate=currentIpcaAnnual(),latest=latestIpca();return `<article class="card">${cardTitle('Metas corrigidas pela inflação','Cenário que mantém o IPCA observado nos últimos 12 meses até a data da meta.')}${miniLine(ipcaState.rates.slice(-12).map(x=>x.value),'Variação mensal do IPCA nos últimos 12 meses',['12 meses atrás','Último mês'])}<div class="prediction-grid"><div><span>IPCA acumulado em 12 meses</span><strong>${rate===null?'Aguardando dados':percent(rate)}</strong></div><div><span>Último mês disponível</span><strong>${latest?latest.date.slice(5,7)+'/'+latest.date.slice(0,4):'—'}</strong></div><div><span>Status da consulta</span><strong>${esc(ipcaState.loading?'Atualizando':ipcaState.error?'Histórico salvo':'Disponível')}</strong></div></div><p class="help">O IPCA passado é usado como cenário, não como previsão. As metas nominais continuam iguais; nos cartões de metas aparece também o valor aproximado necessário no prazo para preservar o poder de compra.</p></article>`}
function planningSettingsCard(){const amount=db.prefs.balanceAnchorCents===null?'':(db.prefs.balanceAnchorCents/100).toFixed(2),date=db.prefs.balanceAnchorDate||'';return `<article class="card settings-card">${cardTitle('Saldo de referência e reserva','Configure os dados de referência usados nas novas estimativas.')}<form id="planningPrefsForm" class="form-grid"><div class="field"><label for="balanceAnchorAmount">Saldo disponível de referência (R$)</label><input id="balanceAnchorAmount" type="number" min="0" step="0.01" value="${amount}" inputmode="decimal"></div><div class="field"><label for="balanceAnchorDate">Data desse saldo</label><input id="balanceAnchorDate" type="date" value="${date}"></div><div class="field full"><label for="emergencyMonths">Meses de despesas desejados na reserva</label><select id="emergencyMonths">${[3,6,9,12].map(n=>`<option value="${n}" ${db.prefs.emergencyMonths===n?'selected':''}>${n} meses</option>`).join('')}</select></div><div class="setting-actions full"><button class="btn primary" type="submit">Salvar referências</button></div></form><p class="settings-note">O saldo e a data são informados por você. A projeção não substitui o saldo real dos seus bancos.</p></article>`}
const totalMonthSaved=()=>sum(month().movements.map(a=>a.amount));
const dateBR=d=>{const [y,m,day]=d.split('-');return `${day}/${m}/${y}`};
const dateTime=d=>new Date(d+'T12:00:00').getTime();
function stat(label,val,sub,i='wallet',cls=''){return `<article class="stat"><div class="name">${icon(i)}${esc(label)}</div><strong>${val}</strong><div class="hint ${cls}">${sub}</div></article>`}
function heading(title,description,action=''){return `<div class="section-heading"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>`}
function cardTitle(title,description,action=''){return `<div class="card-head"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>`}
let sidebarCompact = localStorage.getItem('reserva.sidebarCompact') === 'true';
function syncSidebar() {
  document.body.classList.toggle('sidebar-compact', sidebarCompact);
  const toggle = $('#sidebarToggle');
  
  toggle.setAttribute('aria-expanded', String(!sidebarCompact));
  toggle.setAttribute('aria-label', sidebarCompact ? 'Expandir menu lateral' : 'Recolher menu lateral');
  toggle.title = toggle.getAttribute('aria-label');
}
$('#sidebarToggle').addEventListener('click', () => {
  sidebarCompact = !sidebarCompact;
  try { localStorage.setItem('reserva.sidebarCompact', String(sidebarCompact)); } catch {}
  syncSidebar();
});
const desktopActionSets={budget:[['Nova despesa','open','wallet','expense'],['Calendário','go','calendar','calendar'],['Lançamentos','go','wallet','transactions'],['Relatórios','go','report','reports']],home:[['Registrar','quick','plus'],['Agenda','go','calendar','calendar'],['7 dias','period','chart','7d'],['Orçamento','go','wallet','budget'],['Relatórios','go','report','reports']],transactions:[['Novo lançamento','quick','plus'],['Receitas','filter','income','income'],['Despesas','filter','expense','expense'],['Importar CSV','click','refresh','#bankCsvBtn'],['Exportar CSV','click','report','#csvBtn'],['Recorrências','go','refresh','budget']],calendar:[['Novo compromisso','task','plus'],['Hoje','today','calendar'],['Metas','go','target','goals']],goals:[['Nova meta','open','target','jar'],['Registrar aporte','deposit','plus'],['Resgatar','open','wallet','withdraw'],['PDF de metas','clickPage','report','goals|#shareCdbPdfBtn']],investments:[['Novo investimento','investment','plus'],['Investimento existente','investmentExisting','wallet'],['Aportar em meta','deposit','target'],['Atualizar CDI','clickPage','refresh','investments|#refreshCdiBtn']],analysis:[['Lançamentos','go','wallet','transactions'],['Relatórios','go','report','reports'],['Exportar CSV','clickPage','report','transactions|#csvBtn']],reports:[['Gerar PDF','clickPage','report','reports|#globalPdfBtn'],['Lançamentos','go','wallet','transactions'],['Hoje','go','home']],settings:[['Backup','clickPage','wallet','settings|#exportBtn'],['Importar CSV','clickPage','refresh','transactions|#bankCsvBtn'],['Privacidade','privacy','eye']]};
function renderDesktopModuleBar(){const root=$('#desktopModuleToolbar');if(!root)return;const page=PAGES.find(x=>x[0]===state.page)||PAGES[0],actions=desktopActionSets[state.page]||[];root.innerHTML=`<div class="desktop-module-title"><span>${icon(page[2])}</span><strong>${page[1]}</strong><small>Atalhos</small></div><div class="desktop-module-actions">${actions.map(([label,type,ic,arg=''])=>`<button type="button" class="desktop-module-action" data-desktop-action="${type}" ${type==='go'?'data-route="'+arg+'"':''} ${type==='open'?'data-kind="'+arg+'"':''} ${type==='filter'?'data-filter="'+arg+'"':''} ${type==='click'||type==='clickPage'?'data-target="'+arg+'"':''} ${type==='period'?'data-period="'+arg+'"':''} title="${label}">${icon(ic)}<span>${label}</span></button>`).join('')}</div>`}
const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').trim();
let searchResults=[];
function searchReserva(query){
  const terms=normalizeSearch(query).split(/\s+/).filter(Boolean);
  if(!terms.length)return [];
  const results=[];
  const add=(page,title,subtitle='',extra={})=>{
    if(!title||results.length>=25)return;
    const {keywords='',date='',...target}=extra;
    const text=normalizeSearch([title,subtitle,keywords,date,date?dateBR(date):''].join(' '));
    if(terms.every(term=>text.includes(term)))results.push({page,title,subtitle,date,...target});
  };
  for(const [page,label] of PAGES){
    add(page,label,'Módulo',{keywords:page==='calendar'?'agenda tarefas compromissos notas':page==='settings'?'configurações preferências':page==='transactions'?'receitas despesas movimentações':''});
    const module=document.getElementById('page-'+page);
    for(const el of module?.querySelectorAll('h2,h3,summary,button,legend,label')||[]){
      if(el.closest('[data-edit-record],[data-delete-record],[data-home-category],[data-home-report-category],dialog'))continue;
      const title=el.textContent.trim();
      if(title.length>90||!title||results.some(item=>item.page===page&&item.title===title))continue;
      add(page,title,label,{element:el});
    }
  }
  for(const r of db.records){
    if(results.length>=25)break;
    const title=r.note|| (r.kind==='income'?(r.source==='salary'?'Salário':'Renda complementar'):r.category);
    add('transactions',title,'Lançamento · '+dateBR(r.date),{id:r.id,date:r.date,keywords:[r.kind==='income'?'receita entrada':'despesa saída',r.category,r.subcategory,...(r.tags||[]),hideValues?'':money(r.amount)].join(' ')});
  }
  for(const [list,page,label,fields] of [
    [db.tasks,'calendar','Compromisso',['title','note','time']],
    [db.notes,'calendar','Nota',['text']],
    [db.recurring,'budget','Recorrência',['note','category']],
    [db.jars,'goals','Meta',['name']],
    [db.investments,'investments','Investimento',['name','institution','product']],
    [db.institutions,'settings','Instituição',['name','conglomerate']],
    [db.allocations,'goals','Movimentação de cofrinho',['note']]
  ]){
    for(const item of list){
      if(results.length>=25)break;
      const name=page==='goals'&&item.jarId?db.jars.find(jar=>jar.id===item.jarId)?.name:'';
      const date=item.date||item.dueDate||'';
      add(page,item[fields[0]]||name||item.category||label,label+(date?' · '+dateBR(date):''),{id:item.id,date,keywords:[name,...fields.map(field=>item[field])].join(' '),entity:label});
    }
  }
  return results;
}
function closeReservaSearch(){
  $('#reservaSearchResults').hidden=true;
  $('#reservaSearchInput').setAttribute('aria-expanded','false');
}
function renderReservaSearch(){
  $('#desktopNotificationPanel').hidden=true;
  $('#desktopNotificationBell').setAttribute('aria-expanded','false');
  const input=$('#reservaSearchInput'),panel=$('#reservaSearchResults');
  if(!input.value.trim()){closeReservaSearch();return}
  searchResults=searchReserva(input.value);
  panel.innerHTML=searchResults.length?searchResults.map((item,index)=>
    `<button type="button" data-reserva-search-index="${index}"><b>${esc(item.title)}</b><small>${esc(item.subtitle)}</small></button>`).join(''):'<p>Nenhum resultado encontrado.</p>';
  panel.hidden=false;
  input.setAttribute('aria-expanded','true');
}
function revealSearchTarget(target){
  if(!target)return;
  for(let parent=target.parentElement;parent;parent=parent.parentElement){
    if(parent.matches('details'))parent.open=true;
  }
  target.scrollIntoView({block:'center'});
  if(!target.matches('button,input,summary,a'))target.tabIndex=-1;
  target.focus({preventScroll:true});
}
function setViewDate(date){
  if(!validDate(date))return;
  state.year=Number(date.slice(0,4));
  state.month=Number(date.slice(5,7))-1;
  state.calendarDate=date;
}
function openReservaSearchResult(item){
  if(!item)return;
  closeReservaSearch();
  $('#reservaSearchInput').value='';
  if(item.date&&item.entity!=='Meta'&&['transactions','calendar','goals'].includes(item.page))setViewDate(item.date);
  if(item.page==='transactions'){
    state.txFilter='all';state.txSearch='';state.txTag='';state.txSubcategory='';state.txCategorySet=null;
  }
  const selectors={
    Meta:['data-edit-jar','data-restore-jar'],
    Investimento:['data-investment-edit'],
    Recorrência:['data-edit-recurring'],
    Compromisso:['data-task-edit'],
    Nota:['data-note-id'],
    Instituição:['data-institution'],
    'Movimentação de cofrinho':['data-delete-allocation']
  };
  const targetAttributes=selectors[item.entity]||['data-edit-record'];
  go(item.page);
  const root=document.getElementById('page-'+item.page);
  if(item.entity==='Nota')root?.querySelector('[data-calendar-tab="notes"]')?.click();
  if(item.entity==='Compromisso')root?.querySelector('[data-calendar-tab="agenda"]')?.click();
  if(item.id){
    const id=CSS.escape(item.id);
    const target=root?.querySelector(targetAttributes.map(attribute=>`[${attribute}="${id}"]`).join(','));
    if(target){revealSearchTarget(target);return}
  }
  if(item.element){
    const target=[...root.querySelectorAll(item.element.tagName)].find(el=>el.textContent.trim()===item.title);
    revealSearchTarget(target);
  }
}
document.addEventListener('input',event=>{if(event.target.id==='reservaSearchInput')renderReservaSearch()});
document.addEventListener('click',event=>{
  const result=event.target.closest('[data-reserva-search-index]');
  if(result){openReservaSearchResult(searchResults[Number(result.dataset.reservaSearchIndex)]);return}
  if(!event.target.closest('#reservaSearch'))closeReservaSearch();
});
$('#reservaSearchInput').addEventListener('focus',renderReservaSearch);
$('#reservaSearch').addEventListener('submit',event=>{event.preventDefault();openReservaSearchResult(searchResults[0])});
$('#reservaSearch').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeReservaSearch();$('#reservaSearchInput').focus()}
  if(!['ArrowDown','ArrowUp'].includes(event.key)||$('#reservaSearchResults').hidden)return;
  const buttons=[...$('#reservaSearchResults').querySelectorAll('button')];
  if(!buttons.length)return;
  event.preventDefault();
  const index=buttons.indexOf(document.activeElement);
  const next=event.key==='ArrowDown'?index+1:index<0?buttons.length-1:index-1;
  (buttons[next]||$('#reservaSearchInput')).focus();
});
const DESKTOP_NOTIFICATION_DISMISSAL_KEY='reserva.desktopNotifications.dismissed.v1';
function readDesktopNotificationDismissals(){try{return new Set(JSON.parse(localStorage.getItem(DESKTOP_NOTIFICATION_DISMISSAL_KEY)||'[]'))}catch{return new Set()}}
function desktopNotificationId(item){
  let hash=2166136261;
  for(let i=0;i<item.id.length;i++)hash=Math.imul(hash^item.id.charCodeAt(i),16777619);
  return (hash>>>0).toString(36);
}
function desktopNotificationItems(today=isoToday()){
  const items=[],year=Number(today.slice(0,4)),monthIndex=Number(today.slice(5,7))-1;
  const day=Number(today.slice(8)),lastDay=new Date(year,monthIndex+1,0).getDate();
  if(day===1||day===lastDay){
    const closingDate=day===1?shiftIso(today,-1):today;
    const [closingYear,closingMonth]=closingDate.split('-').map(Number);
    items.push({id:'close:'+today,kind:'reports',date:closingDate,title:'Fechamento do mês',
      detail:MONTHS[closingMonth-1]+' de '+closingYear+' · Abra o checklist em Relatórios',priority:-1});
  }
  const ignoredReserve=reserveIncomeIds(RESERVE_INCOME_IGNORED_KEY),discardedReserve=reserveIncomeIds(RESERVE_INCOME_DISCARDED_KEY);
  for(const r of getMonth(year,monthIndex).records.filter(r=>r.kind==='income'&&r.date<=today&&!ignoredReserve.has(String(r.id))&&!discardedReserve.has(String(r.id)))){
    const {remaining}=incomeReserveStatus(r);
    if(remaining>0)items.push({id:'reserve:'+r.id,kind:'reserve',date:r.date,title:r.source==='salary'?'Reserva do salário':'Reserva da renda complementar',detail:dateBR(r.date)+' · Falta '+money(remaining),priority:2});
  }
  for(const bill of upcomingBillInstances(7,today)){
    const phase=bill.daysLate?'late':bill.daysUntil===0?'today':'soon';
    const prefix={late:'Vencida: ',today:'Vence hoje: ',soon:'Vence em breve: '}[phase];
    items.push({id:'bill:'+bill.id+':'+bill.date+':'+phase,kind:'budget',date:bill.date,title:prefix+(bill.note||bill.category||'Conta'),detail:dateBR(bill.date)+' · '+money(bill.amount),priority:phase==='soon'?2:0});
  }
  for(const task of db.tasks.filter(item=>!item.done&&item.date<=shiftIso(today,7))){
    const phase=task.date<today?'late':task.date===today?'today':'soon';
    const prefix={late:'Compromisso atrasado: ',today:'Compromisso hoje: ',soon:'Compromisso: '}[phase];
    items.push({id:'task:'+task.id+':'+task.date+':'+phase,kind:'calendar',date:task.date,title:prefix+task.title,detail:dateBR(task.date)+(task.time?' · '+task.time:''),priority:phase==='soon'?3:0});
  }
  for(const goal of db.jars){
    if(goal.archived||goal.paused||goal.dueDate>shiftIso(today,7)||goal.dueDate<shiftIso(today,-7))continue;
    if(estimateCdbJar(goal.id).net+linkedInvestmentBalance(goal.id)>=goal.target)continue;
    const phase=goal.dueDate<today?'late':goal.dueDate===today?'today':'soon';
    const prefix={late:'Meta com prazo encerrado: ',today:'Meta vence hoje: ',soon:'Meta perto do prazo: '}[phase];
    items.push({id:'goal:'+goal.id+':'+goal.dueDate+':'+phase,kind:'goals',date:goal.dueDate,title:prefix+goal.name,detail:dateBR(goal.dueDate),priority:phase==='soon'?3:1,targetId:goal.id});
  }
  const period=mkey(year,monthIndex),records=getMonth(year,monthIndex).records;
  const budgets={...db.prefs.categoryBudgets};
  if(db.prefs.marketBudget>0)budgets.Mercado=db.prefs.marketBudget;
  for(const [category,limit] of Object.entries(budgets)){
    const spent=sum(records.filter(record=>record.kind==='expense'&&record.date<=today&&record.category===category).map(record=>record.amount));
    const warning=category==='Mercado'&&db.prefs.marketBudget>0 ? .75 : .8;
    if(limit>0&&spent>=limit*warning){
      const reached=spent>=limit;
      items.push({id:'budget:'+period+':'+category+':'+(reached?'limit':'near'),kind:'budget-limit',date:today,title:(reached?'Limite atingido: ':'Perto do limite: ')+category,detail:money(spent)+' de '+money(limit)+' usados',priority:reached?0:3,filter:'expense',category});
    }
  }
  const dismissed=readDesktopNotificationDismissals();
  return items.sort((a,b)=>a.priority-b.priority).map(item=>({...item,dismissalId:desktopNotificationId(item)})).filter(item=>!dismissed.has(item.dismissalId));
}
function openDesktopNotification(item){
  if(item?.kind==='budget'){setViewDate(item.date);go('budget');revealSearchTarget($('#budgetDueCard'));return}
  if(item?.kind==='budget-limit'){setViewDate(item.date);go('budget');revealSearchTarget($(item.category==='Mercado'?'#marketBudgetCard':'#categoryBudgetCard'));return}
  if(item?.kind==='calendar'){setViewDate(item.date);go('calendar')}else if(item?.kind==='reports'){setViewDate(item.date);go('reports');revealSearchTarget($('#monthlyCloseChecklist'))}else if(item?.kind==='goals'){go('goals');revealSearchTarget(document.querySelector(`[data-edit-jar="${CSS.escape(item.targetId)}"]`))}else if(item?.kind==='reserve'){setViewDate(item.date);go('goals');revealSearchTarget($('#incomeReserveCard'))}else if(item?.kind==='analysis'){setViewDate(item.date);go('analysis')}else if(item?.kind==='transactions'){setViewDate(item.date);state.txFilter=item.filter||'all';state.txSearch='';state.txTag='';state.txSubcategory='';state.txCategorySet=item.category?[item.category]:null;go('transactions')}
}
function renderDesktopNotifications(){const button=$('#desktopNotificationBell'),panel=$('#desktopNotificationPanel'),count=$('#desktopNotificationCount');if(!button||!panel)return;const items=desktopNotificationItems(),visible=items.slice(0,12);count.hidden=!items.length;count.textContent=items.length>9?'9+':String(items.length);panel.innerHTML=`<div class="notification-panel-head"><strong>Notificações</strong><span>${items.length} alerta${items.length===1?'':'s'}</span><button type="button" class="notification-clear" data-clear-desktop-notifications ${items.length?'':'disabled'}>Limpar todas</button></div>${visible.length?visible.map((x,i)=>`<button type="button" class="desktop-notification-item" data-notification-index="${i}"><i class="notification-dot ${x.priority===0?'urgent':''}"></i><span><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span><span class="notification-arrow">›</span></button>`).join(''):'<p class="notification-empty">Tudo em dia. Os próximos vencimentos e compromissos aparecerão aqui.</p>'}${items.length>visible.length?'<p class="notification-more">Mostrando 12 de '+items.length+' alertas.</p>':''}`;panel.dataset.dismissKeys=JSON.stringify(items.map(x=>x.dismissalId));panel.dataset.items=JSON.stringify(visible.map(({kind,date,filter,category,targetId})=>({kind,date,filter,category,targetId})))}
const mobileNavigationMedia=window.matchMedia('(max-width: 1023px), (max-width: 1366px) and (pointer: coarse)');
function usesMobileNavigation(){return mobileNavigationMedia.matches}
function syncDesktopHeaderControls(){
 const bar=$('.sidebar-control'),header=$('.header'),right=$('.header-right'),notifications=$('#desktopNotificationWrap'),intro=header?.querySelector('.header-intro'),titleBlock=bar?.querySelector('.page-title-block')||intro?.querySelector(':scope > div');
 if(!bar||!header||!right||!notifications||!intro||!titleBlock)return;
 titleBlock.classList.add('page-title-block');
 const desktop=!usesMobileNavigation();
 const titleTarget=desktop?bar:intro;
 if(titleBlock.parentElement!==titleTarget)titleTarget.insertBefore(titleBlock,titleTarget.firstChild);
 const controlTarget=desktop?bar:header;
 if(right.parentElement!==controlTarget)controlTarget.append(right);
 const notificationTarget=controlTarget;
 if(notifications.parentElement!==notificationTarget)notificationTarget.append(notifications);
}
const MOBILE_PRIMARY_MODULES=['home','transactions','budget'];
function moduleNavButton([id,label,ic],shortLabel=label){
 const selected=state.page===id;
 return `<button type="button" class="nav-button ${selected?'selected':''}" data-page="${id}" aria-label="${label}" title="${label}"${selected?' aria-current="page"':''}>${icon(ic)}<span class="nav-label">${label}</span><span class="nav-short">${shortLabel}</span></button>`;
}
function mobileDockMarkup(){
 const button=(id,label)=>moduleNavButton(PAGES.find(page=>page[0]===id),label);
 const otherSelected=!MOBILE_PRIMARY_MODULES.includes(state.page);
 return [
   button('home','Hoje'),
   button('transactions','Mov.'),
   `<button type="button" id="quickAddButton" class="nav-button dock-register">${icon('plus')}<span class="nav-short">Registrar</span></button>`,
   button('budget','Orçamento'),
   `<button type="button" id="mobileMoreButton" class="nav-button ${otherSelected?'selected':''}" aria-haspopup="dialog" aria-controls="mobileMoreDialog">
     <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
     <span class="nav-short">Mais</span>
   </button>`
 ].join('');
}
function nav(){
 const desktopModules=PAGES.filter(([id])=>id!=='settings');
 $('#mobileNav').innerHTML=mobileDockMarkup();
 const more=$('#mobileMoreDialog .mobile-more-grid');
 if(more)more.innerHTML=PAGES.filter(([id])=>!MOBILE_PRIMARY_MODULES.includes(id)).map(module=>moduleNavButton(module)).join('');
 $('#desktopNav').innerHTML=desktopModules.map(module=>moduleNavButton(module)).join('')+'<button class="nav-button" type="button" data-register-menu aria-label="Registrar" title="Registrar">'+icon('plus')+'<span class="nav-label">Registrar</span></button>'+PAGES.filter(([id])=>id==='settings').map(module=>moduleNavButton(module)).join('');syncSidebar();syncDesktopHeaderControls();const agendaButton=$('#headerCalendar');agendaButton?.classList.toggle('selected',state.page==='calendar');if(state.page==='calendar')agendaButton?.setAttribute('aria-current','page');else agendaButton?.removeAttribute('aria-current');const settings=$('#headerSettings');settings?.classList.toggle('selected',state.page==='settings');if(state.page==='settings')settings?.setAttribute('aria-current','page');else settings?.removeAttribute('aria-current');renderDesktopModuleBar();renderDesktopNotifications()}
document.addEventListener('click',event=>{
 const dialog=$('#mobileMoreDialog');
 if(event.target.closest('#mobileMoreButton')){if(dialog&&!dialog.open)dialog.showModal();return}
 if(dialog?.open&&(event.target===dialog||event.target.closest('[data-close-mobile-more]')))dialog.close();
});
function miniProgress(val,target){return `<div class="track"><span style="width:${target?Math.max(0,Math.min(100,val/target*100)):0}%"></span></div>`}
function recentTable(records,kind){const rows=records.filter(r=>r.kind===kind).sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<tr><td>${dateBR(r.date)}</td><td><b>${kind==='income'?(r.source==='salary'?'Salário':'Complemento'):esc(r.category)}</b><div class="sub">${esc(r.note||'Sem descrição')}</div></td><td class="money">${money(r.amount)}</td><td class="right"><div class="table-actions"><button class="edit" data-edit-record="${esc(r.id)}" aria-label="Editar lançamento">Editar</button><button class="delete" data-delete-record="${esc(r.id)}" aria-label="Excluir lançamento">Excluir</button></div></td></tr>`).join('');return rows?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>${kind==='income'?'Origem':'Categoria'}</th><th class="right">Valor</th><th class="right">Ação</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty"><strong>Nenhum registro neste mês</strong>Adicione ${kind==='income'?'seu salário ou complemento':'suas despesas'} para começar.</div>`}
function horizontalCategories(rows){const cats=new Map();for(const x of rows.filter(r=>r.kind==='expense'))cats.set(x.category,(cats.get(x.category)||0)+x.amount);return [...cats].sort((a,b)=>b[1]-a[1])}
function donutHTML(rows){const cats=horizontalCategories(rows);const total=sum(cats.map(x=>x[1]));if(!total)return '<div class="empty"><strong>Sem despesas registradas</strong>O gráfico aparecerá quando você registrar seus gastos.</div>';let acc=0;const stops=cats.map(([name,amt])=>{const start=acc;acc+=amt/total*100;return `${CAT_COLORS[CATS.indexOf(name)]||'#acbdc0'} ${start}% ${acc}%`}).join(',');return `<div class="donut-row"><div class="donut" style="background:conic-gradient(${stops})"><b><small>Gastos do mês</small>${money(total)}</b></div><div class="legend-list">${cats.slice(0,5).map(([name,amt])=>`<div class="category-item"><span><i class="color" style="background:${CAT_COLORS[CATS.indexOf(name)]||'#8c9bab'}"></i>${esc(name)}</span><strong>${percent(amt/total*100)}</strong></div>`).join('')}</div></div>`}
function yearChart(){const arr=yearly(state.year);const mx=Math.max(1,...arr.flatMap(a=>[a.income,a.expenses,Math.max(0,a.saved)]));const series=[['income','Renda','#3488f5'],['expense','Despesas','#e9a26e'],['saving','Reserva','#7a75e7']];const bars=arr.map((v,i)=>`<div class="chart-month" title="${MONTHS[i]}: renda ${money(v.income)}, despesas ${money(v.expenses)}, guardado ${money(v.saved)}"><div class="chart-bars">${series.map(([cl],ix)=>{const n=[v.income,v.expenses,Math.max(0,v.saved)][ix];return `<i class="${cl}" style="height:${Math.max(1,n/mx*100)}%"></i>`}).join('')}</div><small>${MONTHS[i].slice(0,3)}</small></div>`).join('');return `<div class="chart-wrap" role="img" aria-label="Comparação mensal entre renda, despesas e reserva em ${state.year}">${bars}</div><div class="legend">${series.map(([_,label,color])=>`<span><i class="dot" style="background:${color}"></i>${label}</span>`).join('')}</div>`}
function upcomingBills() {
  const today = isoToday();
  const period = today.slice(0,7);
  const lastDay = new Date(Number(period.slice(0,4)),Number(period.slice(5)),0).getDate();
  const bills = db.recurring.filter(t => !t.paused && t.kind !== 'income' &&
    t.startMonth <= period && (!t.endMonth || t.endMonth >= period) &&
    !db.records.some(r => r.recurringId === t.id && (r.recurringMonth || r.date.slice(0,7)) === period))
    .map(t => ({...t, due: period+'-'+String(Math.min(lastDay,t.day)).padStart(2,'0')}))
    .sort((a,b) => a.due.localeCompare(b.due)).slice(0,5);
  return `<article class="card"><h2>Contas pendentes deste mês</h2>${bills.length ? bills.map(t =>
    `<p>${dateBR(t.due)} · ${esc(t.note || t.category)} · ${money(t.amount)}${t.due<today?' · vencida':''} <button class="btn small" data-edit-recurring="${esc(t.id)}">Editar previsão</button></p>`).join('') : '<p>Sem contas recorrentes pendentes.</p>'}</article>`;
}
function marketBudgetCard(monthData) {
  const budget=db.prefs.marketBudget;
  const spent=sum(monthData.records.filter(r=>r.kind==='expense'&&r.category==='Mercado').map(r=>r.amount));
  const milestone=budget?[100,75,50,25].find(level=>spent*100>=budget*level):undefined;
  const warning=milestone>=75;
  const message=!budget?'Sem cota definida':spent>budget?'Cota ultrapassada':spent===budget?'Cota atingida':milestone?`Você atingiu ${milestone}% da cota${warning?' · Gasto alto':''}`:'Abaixo de 25% da cota';
  return `<article id="marketBudgetCard" class="card market-budget ${warning?'market-warning':''}"><h2>Cota de Mercado</h2>
  <p><strong>${message}</strong></p><p>${money(spent)} gastos${budget?' de '+money(budget):''} em ${esc(monthLabel())}.</p>
  ${budget?`<p>${spent>budget?'Acima da cota':'Disponível na cota'}: ${money(Math.abs(budget-spent))}</p>`:''}
  <form data-market-budget-form><label class="field">Cota mensal (R$)<input name="budget" type="number" min="0.01" max="100000000" step="0.01" placeholder="Sem limite" value="${hideValues||!budget?'':(budget/100).toFixed(2)}"></label><button class="btn" type="submit">Salvar cota</button>${budget?'<button class="btn" type="submit" value="clear">Remover cota</button>':''}</form></article>`;
}
document.addEventListener('submit',async event=>{
  if(!event.target.matches('[data-market-budget-form]'))return;
  event.preventDefault();
  if(event.submitter?.value==='clear'){
    if(await mutate(()=>{db.prefs.marketBudget=null}))notify('Cota de Mercado removida.');
    return;
  }
  const budget=toCents(event.target.elements.namedItem('budget').value);
  if(!Number.isSafeInteger(budget)||budget<=0||budget>10000000000)return notify('Informe uma cota mensal válida.');
  if(await mutate(()=>{db.prefs.marketBudget=budget}))notify('Cota mensal de Mercado atualizada.');
});
function categoryBudgetCard(monthData) {
  const budgets=db.prefs.categoryBudgets||{}, categories=Object.entries(budgets).filter(([category])=>category!=='Mercado').sort(([a],[b])=>CATS.indexOf(a)-CATS.indexOf(b));
  const spentFor=category=>sum(monthData.records.filter(r=>r.kind==='expense'&&r.category===category).map(r=>r.amount));
  const rows=categories.map(([category,budget])=>{const spent=spentFor(category),ratio=spent/budget*100,over=spent>budget,warning=ratio>=75;return `<div class="category-budget-row ${warning?'market-warning':''}"><div class="category-budget-head"><span><strong>${esc(category)}</strong><small>${money(spent)} de ${money(budget)} · ${over?'acima do limite: '+money(spent-budget):'restam '+money(budget-spent)}</small></span><b>${percent(ratio)}</b><button class="btn small" type="button" data-category-budget-remove="${esc(category)}" aria-label="Remover limite de ${esc(category)}">Remover</button></div><progress max="${budget}" value="${Math.min(spent,budget)}" aria-label="${esc(category)}: ${percent(ratio)} do limite"></progress>${over?'<p class="budget-alert">Limite mensal ultrapassado.</p>':warning?'<p class="budget-alert">Atenção: você já utilizou pelo menos 75% do limite.</p>':''}</div>`});
  return `<article id="categoryBudgetCard" class="card category-budget"><h2>Orçamento mensal por categoria</h2><p>Os limites se repetem a cada mês e acompanham o mês selecionado.</p><form data-category-budget-form class="category-budget-form"><label class="field">Categoria<select name="category">${CATS.filter(c=>c!=='Mercado').map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label class="field">Limite mensal (R$)<input name="budget" type="number" min="0.01" max="100000000" step="0.01" required placeholder="Ex.: 500,00"></label><button class="btn primary" type="submit">Salvar limite</button></form>${rows.length?`<div class="category-budget-list">${rows.join('')}</div>`:'<div class="empty">Adicione limites para acompanhar os gastos e receber avisos ao chegar a 75% ou ultrapassar o valor.</div>'}</article>`;
}
document.addEventListener('submit',async event=>{
  if(!event.target.matches('[data-category-budget-form]'))return;
  event.preventDefault();
  const category=String(event.target.elements.namedItem('category').value),budget=toCents(event.target.elements.namedItem('budget').value);
  if(!CATS.includes(category)||!Number.isSafeInteger(budget)||budget<=0||budget>10000000000)return notify('Informe uma categoria e um limite mensal válidos.');
  if(await mutate(()=>{db.prefs.categoryBudgets={...(db.prefs.categoryBudgets||{}),[category]:budget}}))notify(`Limite de ${category} atualizado.`);
});
document.addEventListener('click',event=>{const clear=event.target.closest('[data-clear-desktop-notifications]');if(!clear)return;const panel=$('#desktopNotificationPanel');let keys=[];try{keys=JSON.parse(panel?.dataset.dismissKeys||'[]')}catch{}const dismissed=readDesktopNotificationDismissals();for(const key of keys)dismissed.add(key);try { localStorage.setItem(DESKTOP_NOTIFICATION_DISMISSAL_KEY,JSON.stringify([...dismissed])); } catch { notify('Não foi possível salvar a limpeza das notificações neste navegador.'); return; } renderDesktopNotifications();$('#desktopNotificationBell')?.focus();notify('Notificações limpas. Compromissos e lançamentos continuam salvos.')});
document.addEventListener('click',event=>{const bell=event.target.closest('#desktopNotificationBell');if(bell){renderDesktopNotifications();const panel=$('#desktopNotificationPanel');panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));return}if(!event.target.closest('#desktopNotificationWrap')&&$('#desktopNotificationPanel')){$('#desktopNotificationPanel').hidden=true;$('#desktopNotificationBell')?.setAttribute('aria-expanded','false')}const note=event.target.closest('[data-notification-index]');if(note){const items=JSON.parse($('#desktopNotificationPanel').dataset.items||'[]'),item=items[Number(note.dataset.notificationIndex)];openDesktopNotification(item);$('#desktopNotificationPanel').hidden=true;return}const action=event.target.closest('[data-desktop-action]');if(action){const type=action.dataset.desktopAction;if(type==='quick'){openQuickAdd();return}if(type==='go'){go(action.dataset.route);return}if(type==='open'){openModal(action.dataset.kind);return}if(type==='filter'){state.txFilter=action.dataset.filter;go('transactions');return}if(type==='period'){localStorage.setItem('reserva.home.period',action.dataset.period);go('home');return}if(type==='today'){const d=new Date();state.year=d.getFullYear();state.month=d.getMonth();go('calendar');return}if(type==='deposit'){openDepositPicker();return}if(type==='investment'||type==='investmentExisting'){go('investments');requestAnimationFrame(()=>document.querySelector('[data-investment-edit=""]'+(type==='investmentExisting'?'[data-existing="true"]':''))?.click());return}if(type==='privacy'){hideValues=!hideValues;localStorage.setItem('reserva.hideValues',String(hideValues));render();return}if(type==='task'){const d=new Date();state.year=d.getFullYear();state.month=d.getMonth();state.calendarDate=isoToday();go('calendar');requestAnimationFrame(()=>$('#calendarTaskForm input[name="title"]')?.focus());return}if(type==='click'||type==='clickPage'){const [route,selector]=type==='clickPage'?action.dataset.target.split('|'):[state.page,action.dataset.target];if(route!==state.page)go(route);requestAnimationFrame(()=>document.querySelector(selector)?.click());return}}});
document.addEventListener('click',event=>{
 const mode=event.target.closest('[data-home-chart-mode]');if(mode){event.preventDefault();event.stopImmediatePropagation();localStorage.setItem('reserva.home.categoryView',mode.dataset.homeChartMode);budget();return}
 const homePeriod=event.target.closest('[data-home-period]');if(homePeriod){localStorage.setItem('reserva.home.period',homePeriod.dataset.homePeriod);home();return}
 const category=event.target.closest('[data-home-category],[data-home-report-category]');if(category){event.preventDefault();event.stopImmediatePropagation();state.txFilter='expense';state.txSearch='';state.txTag='';state.txSubcategory='';const raw=category.dataset.homeCategory||category.dataset.homeReportCategory||'';if(raw==='__all'){try{state.txCategorySet=JSON.parse(decodeURIComponent(category.dataset.homeCategoryList||'%5B%5D'))}catch{state.txCategorySet=[]}}else state.txCategorySet=raw?[raw]:null;go('transactions');return}
 const action=event.target.closest('[data-home-action]');if(!action)return;
 event.preventDefault();event.stopImmediatePropagation();
 switch(action.dataset.homeAction){
  case 'detail':state.txFilter=action.dataset.filter||'all';state.txTag='';state.txSubcategory='';state.txSearch='';go(action.dataset.route||'transactions');break;
  case 'new':if(action.dataset.kind==='task'){openCalendarCompose(shiftIso(isoToday(),Number(action.dataset.dayOffset)||0))}else if(action.dataset.kind==='investments')go('investments');else if(action.dataset.kind==='jar')openModal('jar');else openModal(action.dataset.kind||'expense');break;
  case 'module':go(action.dataset.route||'home');break;
  case 'editBudget':action.closest('.market-budget')?.querySelector('[data-market-budget-form] input[name=budget]')?.focus();break;
  case 'planning':go('goals');requestAnimationFrame(()=>$('#planningSettingsDetails')?.setAttribute('open',''));break;
  case 'report':go('reports');break;
  case 'period':localStorage.setItem('reserva.home.period',action.dataset.period||'month');home();break;
  case 'refreshHome':home();break;
  case 'depositPicker':openDepositPicker();break;
  case 'completeTask':if(action.dataset.taskId)toggleCalendarTask(action.dataset.taskId).then(home);break;
  case 'editTask':{const task=db.tasks.find(x=>x.id===action.dataset.taskId);if(task){state.year=Number(task.date.slice(0,4));state.month=Number(task.date.slice(5,7))-1;state.calendarDate=task.date;go('calendar');requestAnimationFrame(()=>editCalendarTask(task.id))}break}
  case 'deleteTask':if(action.dataset.taskId)deleteCalendarTask(action.dataset.taskId).then(home);break;
  case 'chartMode':action.closest('.home-category-card')?.querySelector('[data-home-chart-mode="'+action.dataset.mode+'"]')?.click();break;
  case 'calendar':{const date=action.dataset.date||isoToday(),d=new Date(date+'T12:00:00');state.year=d.getFullYear();state.month=d.getMonth();state.calendarDate=date;go('calendar');break}
  case 'insights':go('analysis');break;
  case 'privacy':hideValues=!hideValues;localStorage.setItem('reserva.hideValues',String(hideValues));render();break;
  case 'csv':csv();break;
 }
});

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-category-budget-remove]');
  if(!button)return;
  const category=button.dataset.categoryBudgetRemove;
  if(await mutate(()=>{const budgets={...(db.prefs.categoryBudgets||{})};delete budgets[category];db.prefs.categoryBudgets=budgets}))notify(`Limite de ${category} removido.`);
});

function homeOverview(m) {
 const investments=db.investments,categories=horizontalCategories(m.records).slice(0,3);
 const committed=m.income?Math.max(0,(m.income-m.balance)/m.income*100):null;
 const portfolio=sum(investments.map(x=>x.balance)),linked=sum(investments.filter(x=>db.jars.some(j=>j.id===x.goalId&&!j.archived)).map(x=>x.balance));
 const redemptions=m.withdrawals+m.redeemed,expenseCount=m.records.filter(r=>r.kind==='expense').length;
 const detail=items=>'<div class="overview-detail-lines">'+items.map(x=>'<span>'+x+'</span>').join('')+'</div>';
 const card=(label,value,details)=>'<article class="card overview-card"><h3>'+label+'</h3><strong>'+value+'</strong>'+detail(details)+'</article>';
 const expenseList=categories.length?'<div class="overview-category-list">'+categories.map(([name,amount])=>'<span><b>'+esc(name)+'</b><strong>'+money(amount)+'</strong><small>'+(m.expenses?percent(amount/m.expenses*100):percent(0))+'</small></span>').join('')+'</div>':'<span>Sem despesas registradas neste mês.</span>';
 return '<section aria-labelledby="overviewTitle"><h2 id="overviewTitle">Visão geral · '+esc(monthLabel())+'</h2><div class="overview-grid">'
 +card('Saldo disponível',money(m.balance),['Salário: '+money(m.salary),'Complementos: '+money(m.complement),'Despesas pagas: −'+money(m.expenses),'Cofrinhos líquidos: '+money(m.saved),'Investimentos líquidos: '+money(m.invested-m.redeemed)])
 +card('Renda comprometida',committed===null?'Sem renda registrada':percent(committed),['Renda recebida: '+money(m.income),'Despesas: '+money(m.expenses),'Cofrinhos: '+money(m.saved),'Investimentos líquidos: '+money(m.invested-m.redeemed),'Disponível após compromissos: '+money(m.balance)])
 +card('Carteira de investimentos',money(portfolio),[investments.length+' aplicação(ões) ativa(s)','Vinculado a metas: '+money(linked),'Aportes deste mês: '+money(m.invested),'Resgates deste mês: '+money(m.redeemed)])
 +card('Reserva deste mês',money(m.deposits+m.invested-redemptions),['Aportes em cofrinhos: '+money(m.deposits),'Investido neste mês: '+money(m.invested),'Resgates: −'+money(redemptions),'Renda destinada à reserva: '+(m.income?percent((m.deposits+m.invested-redemptions)/m.income*100):'Sem renda registrada')])
 +card('Despesas do mês',money(m.expenses),['Lançamentos de despesa: '+expenseCount,expenseList])
 +'</div></section>';
}
function openCalendarDayOverlay(){const detail=$('#page-calendar .calendar-detail');if(!detail)return;let dialog=$('#calendarDayDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='calendarDayDialog';dialog.className='calendar-day-dialog';dialog.setAttribute('aria-label','Agenda do dia');dialog.innerHTML='<div class="calendar-day-dialog-top"><strong>Agenda do dia</strong><button type="button" data-close-calendar-day>Fechar</button></div><div id="calendarDayDialogContent" class="calendar-day-dialog-content"></div>';dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});document.body.append(dialog)}const content=$('#calendarDayDialogContent');if(content)content.innerHTML=detail.innerHTML;if(!dialog.open)dialog.showModal()}
function homeCalendarPreview(){
  const today=isoToday(), key=mkey(state.year,state.month);
  const events=calendarEventsForMonth(state.year,state.month);
  const {expensesByDay,highestDailyExpense,levelFor}=calendarSpending(events);
  const notes=new Set(calendarNotes().map(note=>note.date));
  const days=new Date(state.year,state.month+1,0).getDate();
  const offset=(new Date(state.year,state.month,1).getDay()+6)%7;
  const cells=Array.from({length:days},(_,index)=>{
    const day=index+1, date=key+'-'+String(day).padStart(2,'0');
    const dayEvents=events.get(date)||[], count=dayEvents.length, hasNotes=notes.has(date);
    const expense=expensesByDay.get(date),heat=levelFor(date);
    const label=[dateBR(date), expense&&!hideValues?'Despesas: '+money(expense):'', count?count+' evento(s)':'', hasNotes?'com notas':'', ...dayEvents.slice(0,3).map(event=>event.title)].filter(Boolean).join(' · ');
    return `<button type="button" data-open-calendar-date="${date}" ${heat?`data-expense-heat="${heat}"`: ''} class="home-calendar-day${count||hasNotes?' has-events':''}${date===today?' is-today':''}" aria-label="${esc(label)}" title="${esc(label)}" ${date===today?'aria-current="date"':''}>${day}${count?'<small aria-hidden="true">'+count+'</small>':''}</button>`;
  }).join('');
  return `<article class="card home-calendar-preview">
    <div class="card-head"><div><h2>Calendário</h2><p>${esc(monthLabel())}</p></div>
    <button type="button" class="btn small" data-page="calendar">Abrir calendário</button></div>
    <div class="home-calendar-grid" aria-label="Resumo mensal do calendário">
      ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(day=>'<b>'+day+'</b>').join('')}
      ${'<span aria-hidden="true"></span>'.repeat(offset)}${cells}
    </div>
    <div class="home-calendar-key"><small>Cores mais fortes indicam mais gastos no mês.</small>${highestDailyExpense?`<span class="calendar-heat-legend" aria-hidden="true"><small>Menos</small>${[1,2,3,4,5].map(level=>`<i data-heat-level="${level}"></i>`).join('')}<small>Mais</small></span>`:'<small>Sem despesas registradas.</small>'}</div>
  </article>`;
}
function homeAgendaCard(){const today=isoToday(),upcoming=db.tasks.filter(task=>!task.done&&task.date>=today).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')).slice(0,4),total=db.tasks.filter(task=>!task.done&&task.date>=today).length;const content=upcoming.length?`<div class="home-agenda-list">${upcoming.map(task=>`<button type="button" class="home-agenda-item" data-open-calendar-date="${task.date}"><span class="home-agenda-color" style="--task-color:${calendarTaskColor(task.color)}"></span><span class="home-agenda-copy"><b>${esc(task.title)}</b><small>${dateBR(task.date)}${task.time?' · '+esc(task.time):''}${task.note?' · '+esc(task.note):''}</small></span><span class="home-agenda-arrow" aria-hidden="true">›</span></button>`).join('')}</div>`:`<p class="home-agenda-empty">Agenda livre por enquanto. Adicione compromissos para se organizar por aqui.</p>`;return `<article class="card home-agenda-card"><div class="home-agenda-head"><div><h2>Próximos compromissos</h2><p>${total?`${total} compromisso${total===1?'':'s'} pendente${total===1?'':'s'}`:'Organize suas tarefas e compromissos futuros'}</p></div><div class="actions"><button type="button" class="btn small primary" data-calendar-new-task data-home-new-task>Novo compromisso</button><button type="button" class="btn small" data-page="calendar">Abrir agenda</button></div></div>${content}</article>`}

function categorySpendCard(m){
 const rows=horizontalCategories(m.records),total=rows.reduce((n,x)=>n+x[1],0),mode=localStorage.getItem('reserva.home.categoryView')||'distribution';
 const colors=rows.map(([cat])=>CAT_COLORS[CATS.indexOf(cat)]||'#8c9bab');let cursor=0;
 const slices=rows.map((x,i)=>{const from=cursor;cursor+=total?x[1]/total*100:0;return colors[i]+' '+from.toFixed(2)+'% '+cursor.toFixed(2)+'%'}).join(',');
 let py=state.year,pm=state.month-1;if(pm<0){pm=11;py--}const previous=horizontalCategories(getMonth(py,pm).records),before=new Map(previous);
 const body=mode==='distribution'
  ?(rows.length?'<div class="home-category-layout"><div class="home-category-donut" style="--spend-chart:conic-gradient('+slices+')"><div><small>Total de gastos</small><strong>'+money(total)+'</strong></div></div><div class="home-category-legend">'+rows.slice(0,5).map(([name,value],i)=>'<button type="button" class="home-category-row" data-home-category="'+esc(name)+'"><i style="--category-color:'+colors[i]+'"></i><span>'+esc(name)+'</span><strong>'+percent(value/total*100)+'</strong><small>'+money(value)+'</small></button>').join('')+(rows.length>5?'<button type="button" class="home-category-row" data-home-category="__all" data-home-category-list="'+encodeURIComponent(JSON.stringify(rows.slice(5).map(([name])=>name)))+'"><i style="--category-color:#8c9bab"></i><span>Outras categorias</span><strong>'+percent(rows.slice(5).reduce((n,x)=>n+x[1],0)/total*100)+'</strong><small>'+money(rows.slice(5).reduce((n,x)=>n+x[1],0))+'</small></button>':'')+'</div></div>':'<div class="empty-inline">Registre despesas para ver a distribuição por categoria.</div>')
  :(rows.length||previous.length?'<div class="home-category-trend">'+[...new Set([...rows.map(x=>x[0]),...previous.map(x=>x[0])])].map(name=>({name,current:rows.find(x=>x[0]===name)?.[1]||0,previous:before.get(name)||0})).sort((a,b)=>Math.abs(b.current-b.previous)-Math.abs(a.current-a.previous)).slice(0,6).map(x=>{const diff=x.current-x.previous,pct=x.previous?diff/x.previous*100:null;return '<button type="button" class="home-category-trend-row" data-home-category="'+esc(x.name)+'"><span><b>'+esc(x.name)+'</b><small>'+money(x.current)+' agora · '+money(x.previous)+' antes</small></span><strong class="'+(diff>0?'trend-up':diff<0?'trend-down':'')+'">'+(diff>0?'↑ ':diff<0?'↓ ':'= ')+(pct===null?(diff?'sem base':percent(0)):percent(Math.abs(pct)))+'</strong></button>'}).join('')+'</div>':'<div class="empty-inline">Ainda não há despesas para comparar com o mês anterior.</div>');
 return '<article id="budgetSpendingCard" class="card home-category-card"><div class="home-category-head"><div><h2>Gastos por categoria</h2><p>'+esc(monthLabel())+' · '+(mode==='distribution'?'distribuição do mês':'comparação com o mês anterior')+'</p></div><div class="home-category-toggle" role="group" aria-label="Visualização dos gastos"><button type="button" data-home-chart-mode="distribution" class="'+(mode==='distribution'?'selected':'')+'" aria-label="Distribuição dos gastos" title="Distribuição">◔</button><button type="button" data-home-chart-mode="comparison" class="'+(mode==='comparison'?'selected':'')+'" aria-label="Comparar com o mês anterior" title="Comparar evolução">↗</button></div></div>'+body+'</article>'
}
function attachTodayCardActions(){
 const root=$('#page-home');if(!root)return;const cards=[...root.querySelectorAll('.today-card,.market-budget,.overview-card,.home-agenda-card,.home-forecast-card,.today-stat,.today-reserve,.today-lower>.card,.home-category-card,.home-desktop-summary-grid>.card')];
 const mk=(label,action,ic,extra={})=>({label,action,ic,...extra});
 cards.forEach(card=>{if(card.querySelector(':scope > .home-compact-actions'))return;const title=card.querySelector('h2,h3,.today-stat-label')?.textContent?.trim()||'Resumo',text=title.toLocaleLowerCase('pt-BR');let actions;
 if(card.matches('.today-card')) actions=[mk('Ver receitas','detail','income',{filter:'income'}),mk('Ver despesas','detail','expense',{filter:'expense'}),mk('Nova renda','new','income',{kind:'income'}),mk('Nova despesa','new','expense',{kind:'expense'}),mk('Abrir agenda','calendar','calendar'),mk('Ocultar valores','privacy','eye')];
 else if(card.matches('.home-category-card')) actions=[mk('Ver despesas','detail','search',{route:'transactions',filter:'expense'}),mk('Lançar gasto','new','plus',{kind:'expense'}),mk('Abrir insights','insights','chart'),mk('Comparar meses','chartMode','chart',{mode:'comparison'}),mk('Ver distribuição','chartMode','chart',{mode:'distribution'}),mk('Exportar CSV','csv','report')];
 else if(card.matches('.market-budget')) actions=[mk('Ver gastos','detail','search',{route:'transactions',filter:'expense'}),mk('Novo gasto','new','plus',{kind:'expense'}),mk('Criar conta fixa','new','refresh',{kind:'recurring'}),mk('Ajustar cota','editBudget','settings'),mk('Comparar gastos','insights','chart'),mk('Abrir agenda','calendar','calendar')];
 else if(card.matches('.home-agenda-card')){const next=db.tasks.filter(t=>!t.done&&t.date>=isoToday()).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''))[0];actions=[mk('Agendar compromisso','new','plus',{kind:'task'}),mk('Abrir calendário','calendar','calendar'),mk('Ver próximos','calendar','calendar'),mk('Ver lançamentos','detail','wallet',{route:'transactions',filter:'all'}),mk('Planejar vencimentos','new','refresh',{kind:'recurring'}),mk('Abrir insights','insights','chart'),mk('Agenda de hoje','calendar','calendar',{date:isoToday()}),mk('Criar tarefa amanhã','new','plus',{kind:'task',dayOffset:1}),mk('Concluir próximo','completeTask','chart',{taskId:next?.id,disabled:!next}),mk('Editar próximo','editTask','settings',{taskId:next?.id,disabled:!next}),mk('Excluir próximo','deleteTask','report',{taskId:next?.id,disabled:!next})];if(next)actions[2].date=next.date}
 else if(card.matches('.home-forecast-card')) actions=[mk('Ver receitas','detail','income',{route:'transactions',filter:'income'}),mk('Ver despesas','detail','expense',{route:'transactions',filter:'expense'}),mk('Adicionar renda','new','plus',{kind:'income'}),mk('Adicionar despesa','new','plus',{kind:'expense'}),mk('Ver recorrências','new','refresh',{kind:'recurring'}),mk('Abrir calendário','calendar','calendar'),mk('Configurar saldo base','planning','wallet'),mk('Ver investimentos','module','piggy',{route:'investments'}),mk('Ver metas','module','target',{route:'goals'}),mk('Abrir relatórios','report','report'),mk('Ocultar valores','privacy','eye')];
 else if(/vencimento/.test(text)) actions=[mk('Ver despesas','detail','search',{route:'transactions',filter:'expense'}),mk('Nova conta recorrente','new','refresh',{kind:'recurring'}),mk('Adicionar despesa','new','plus',{kind:'expense'}),mk('Abrir agenda','calendar','calendar'),mk('Ver projeção','insights','chart'),mk('Exportar CSV','csv','report')];
 else if(/dica/.test(text)) actions=[mk('Abrir insights','insights','chart'),mk('Ver despesas','detail','search',{route:'transactions',filter:'expense'}),mk('Ver receitas','detail','income',{route:'transactions',filter:'income'}),mk('Adicionar despesa','new','plus',{kind:'expense'}),mk('Abrir agenda','calendar','calendar'),mk('Exportar CSV','csv','report')];
 else if(/reserva deste mês|progresso das metas/.test(text)) actions=[mk('Ver metas','module','target',{route:'goals'}),mk('Guardar valor','depositPicker','plus'),mk('Ver investimentos','module','piggy',{route:'investments'}),mk('Ver despesas','detail','search',{route:'transactions',filter:'expense'}),mk('Abrir insights','insights','chart'),mk('Abrir calendário','calendar','calendar'),mk('Nova meta','new','target',{kind:'jar'}),mk('Relatórios','report','report'),mk('Configurar saldo','planning','wallet'),mk('Ocultar valores','privacy','eye'),mk('Atualizar card','refreshHome','refresh')];
 else if(card.matches('.overview-card')){const route=card.querySelector('[data-page]')?.dataset.page||'analysis';if(/invest|carteira|investido/.test(text))actions=[mk('Abrir carteira','module','piggy',{route:'investments'}),mk('Adicionar investimento','new','plus',{kind:'investments'}),mk('Ver lançamentos','detail','search',{route:'transactions',filter:'all'}),mk('Abrir agenda','calendar','calendar'),mk('Ver insights','insights','chart'),mk('Exportar CSV','csv','report'),mk('Ver metas','module','target',{route:'goals'}),mk('Relatórios','report','report'),mk('Ver progresso','module','target',{route:'goals'}),mk('Ocultar valores','privacy','eye'),mk('Atualizar card','refreshHome','refresh')];else if(/reserva deste mês/.test(text))actions=[mk('Ver cofrinhos','module','target',{route:'goals'}),mk('Guardar valor','depositPicker','plus'),mk('Ver carteira','module','piggy',{route:'investments'}),mk('Ver aportes','detail','search',{route:'transactions',filter:'all'}),mk('Ver resgates','module','piggy',{route:'investments'}),mk('Nova meta','new','target',{kind:'jar'}),mk('Nova aplicação','new','plus',{kind:'investments'}),mk('Abrir agenda','calendar','calendar'),mk('Relatório','report','report'),mk('Abrir insights','insights','chart'),mk('Ocultar valores','privacy','eye')];else if(/gasto|despesa/.test(text))actions=[mk('Ver despesas','detail','search',{route:'transactions',filter:'expense'}),mk('Novo gasto','new','plus',{kind:'expense'}),mk('Comparar categorias','insights','chart'),mk('Abrir calendário','calendar','calendar'),mk('Relatório','report','report'),mk('Exportar CSV','csv','report'),mk('Nova conta fixa','new','refresh',{kind:'recurring'}),mk('Ver metas','module','target',{route:'goals'}),mk('Ocultar valores','privacy','eye'),mk('Insights','insights','chart'),mk('Atualizar card','refreshHome','refresh')];else if(/renda comprometida/.test(text))actions=[mk('Ver resumo','module','chart',{route}),mk('Ver receitas','detail','income',{route:'transactions',filter:'income'}),mk('Ver despesas','detail','expense',{route:'transactions',filter:'expense'}),mk('Nova renda','new','plus',{kind:'income'}),mk('Nova despesa','new','plus',{kind:'expense'}),mk('Abrir agenda','calendar','calendar'),mk('Abrir relatórios','report','report'),mk('Configurar saldo base','planning','wallet'),mk('Ver projeção','insights','chart'),mk('Ocultar valores','privacy','eye'),mk('Atualizar card','refreshHome','refresh')];else actions=[mk('Ver resumo','module','chart',{route}),mk('Ver receitas','detail','income',{route:'transactions',filter:'income'}),mk('Ver despesas','detail','expense',{route:'transactions',filter:'expense'}),mk('Nova renda','new','plus',{kind:'income'}),mk('Nova despesa','new','plus',{kind:'expense'}),mk('Abrir agenda','calendar','calendar'),mk('Gerar relatório PDF','report','report'),mk('Configurar saldo base','planning','wallet'),mk('Mês','period','calendar',{period:'month'}),mk('Ocultar valores','privacy','eye'),mk('Atualizar card','refreshHome','refresh')];}
 else if(card.matches('.today-stat,.today-reserve')) actions=[mk('Abrir metas','module','target',{route:'goals'}),mk('Guardar valor','new','plus',{kind:'add'}),mk('Resgatar valor','new','wallet',{kind:'withdraw'}),mk('Abrir investimentos','module','piggy',{route:'investments'}),mk('Ver despesas','detail','search',{route:'transactions',filter:'expense'}),mk('Abrir calendário','calendar','calendar')];
 else actions=[mk('Ver detalhes','detail','search',{route:'transactions',filter:'all'}),mk('Adicionar renda','new','plus',{kind:'income'}),mk('Adicionar despesa','new','plus',{kind:'expense'}),mk('Abrir agenda','calendar','calendar'),mk('Ver insights','insights','chart'),mk('Exportar CSV','csv','report')];

 const rule=[
  [/reserva deste mês/i,'Guardar valor',/aportes|resgates|cofrinhos|investimentos|carteira/i],
  [/progresso das metas/i,'Ver metas',/nova meta|guardar valor/i],
  [/próximos compromissos/i,'Agendar compromisso',/agenda de hoje|editar|concluir|excluir/i],
  [/previsto/i,'Ver projeção',/recorrências|saldo base/i],
  [/despesas do mês/i,'Ver despesas',/categorias|conta fixa/i]
 ].find(([pattern])=>pattern.test(title));
 if(rule?.[1]==='Ver projeção')actions.unshift(mk('Ver projeção','insights','chart'));
 const existing=[...card.querySelectorAll(':scope > button[data-page], :scope > .card-title button[data-page]')];
 const duplicate=a=>existing.some(button=>button.textContent.trim()===a.label);
 const usable=actions.filter(a=>!a.disabled&&!duplicate(a));
 const primary=usable.find(a=>a.label===rule?.[1])||(!existing.length?usable.find(a=>!['privacy','csv','report','refreshHome'].includes(a.action)):null);
 const secondary=usable.filter(a=>a!==primary&&(rule?rule[2].test(a.label):['detail','insights','chartMode','planning','depositPicker'].includes(a.action))).slice(0,4);
 const button=a=>'<button type="button" data-home-action="'+a.action+'" '+(a.route?'data-route="'+a.route+'" ':'')+(a.filter?'data-filter="'+a.filter+'" ':'')+(a.kind?'data-kind="'+a.kind+'" ':'')+(a.mode?'data-mode="'+a.mode+'" ':'')+(a.period?'data-period="'+a.period+'" ':'')+(a.date?'data-date="'+a.date+'" ':'')+(a.dayOffset!==undefined?'data-day-offset="'+a.dayOffset+'" ':'')+(a.taskId?'data-task-id="'+a.taskId+'" ':'')+(a.disabled?'disabled ':'')+'title="'+a.label+'" aria-label="'+a.label+'"><span>'+icon(a.ic)+'</span><small>'+a.label+'</small></button>';
 const tools=document.createElement('div');
 tools.className='home-compact-actions';
 tools.innerHTML=(primary?button(primary):'')+(secondary.length?'<details><summary>Mais ações</summary><div class="home-secondary-actions">'+secondary.map(button).join('')+'</div></details>':'');
 if(tools.innerHTML)card.append(tools);

 })
}
function homeForecastCard(){const today=isoToday(),key=mkey(state.year,state.month),records=db.records.filter(r=>r.date.slice(0,7)===key),pastIncome=sum(records.filter(r=>r.kind==='income'&&r.date<=today).map(r=>r.amount)),pastExpense=sum(records.filter(r=>r.kind==='expense'&&r.date<=today).map(r=>r.amount)),futureIncome=sum(records.filter(r=>r.kind==='income'&&r.date>today).map(r=>r.amount)),futureExpense=sum(records.filter(r=>r.kind==='expense'&&r.date>today).map(r=>r.amount));let recurringIncome=0,recurringExpense=0;for(const t of db.recurring.filter(x=>!x.paused&&x.startMonth<=key&&(!x.endMonth||x.endMonth>=key))){const d=Math.min(t.day,new Date(state.year,state.month+1,0).getDate()),date=key+'-'+String(d).padStart(2,'0');if(date<=today)continue;const exists=db.records.some(r=>r.recurringId===t.id&&(r.recurringMonth||r.date.slice(0,7))===key);if(exists)continue;if(t.kind==='income')recurringIncome+=t.amount;else recurringExpense+=t.amount}const projectedIncome=pastIncome+futureIncome+recurringIncome,projectedExpense=pastExpense+futureExpense+recurringExpense,max=Math.max(projectedIncome,projectedExpense,1),bar=(label,actual,projected,color)=>`<div class="forecast-row"><div><span>${label}</span><b>${money(actual)} <small>realizado</small></b><b>${money(projected)} <small>previsto</small></b></div><div class="forecast-track"><i style="width:${Math.min(100,projected/max*100)}%;background:${color}"></i><em style="width:${Math.min(100,actual/max*100)}%"></em></div></div>`;return `<article class="card home-forecast-card"><div class="card-head"><div><h2>Previsto × realizado</h2><p>${esc(monthLabel())} · inclui lançamentos futuros e recorrências ainda não lançadas</p></div></div>${bar('Receitas',pastIncome,projectedIncome,'var(--success)')}${bar('Despesas',pastExpense,projectedExpense,'var(--danger)')}<p class="help">Estimativa baseada somente nos registros e recorrências cadastrados.</p></article>`}
function homePeriodMetrics(){const today=isoToday(),mode=localStorage.getItem('reserva.home.period')||'month';let start,end,label;if(mode==='today'){start=end=today;label='Hoje'}else if(mode==='7d'){end=today;start=shiftIso(today,-6);label='Últimos 7 dias'}else if(mode==='12m'){end=today;const d=new Date(today+'T12:00:00');d.setMonth(d.getMonth()-11);start=d.toISOString().slice(0,10);label='Últimos 12 meses'}else if(mode==='custom'){const a=localStorage.getItem('reserva.home.from')||today,b=localStorage.getItem('reserva.home.to')||today;start=a<=b?a:b;end=a<=b?b:a;label='Período personalizado'}else{start=`${state.year}-${String(state.month+1).padStart(2,'0')}-01`;end=`${state.year}-${String(state.month+1).padStart(2,'0')}-${String(new Date(state.year,state.month+1,0).getDate()).padStart(2,'0')}`;label=monthLabel()}const span=Math.max(1,Math.round((new Date(end+'T12:00:00')-new Date(start+'T12:00:00'))/86400000)+1),prevEnd=shiftIso(start,-1),prevStart=shiftIso(start,-span),aggregate=(from,to)=>{const rows=db.records.filter(r=>r.date>=from&&r.date<=to);return{income:sum(rows.filter(x=>x.kind==='income').map(x=>x.amount)),expenses:sum(rows.filter(x=>x.kind==='expense').map(x=>x.amount))}};return{mode,start,end,label,...aggregate(start,end),previous:aggregate(prevStart,prevEnd)}}
function homePeriodControls(){const d=homePeriodMetrics(),options=[['today','Hoje'],['7d','7 dias'],['month','Mês'],['12m','12 meses'],['custom','Personalizado']];return `<div class="dashboard-period-control"><span>Período do painel</span><div class="dashboard-period-tabs">${options.map(([key,text])=>`<button type="button" data-home-period="${key}" class="${d.mode===key?'selected':''}" aria-pressed="${d.mode===key}">${text}</button>`).join('')}</div>${d.mode==='custom'?`<form class="dashboard-custom-period" id="homeCustomPeriodForm"><label>De <input type="date" name="from" value="${esc(d.start)}" required></label><label>Até <input type="date" name="to" value="${esc(d.end)}" required></label><button type="submit" class="btn small">Aplicar</button></form>`:''}</div>`}
function homeTrendCard(){const today=new Date(),months=[];for(let i=11;i>=0;i--){const d=new Date(today.getFullYear(),today.getMonth()-i,1),y=d.getFullYear(),m=d.getMonth(),rows=db.records.filter(r=>r.date.startsWith(mkey(y,m))),income=sum(rows.filter(r=>r.kind==='income').map(r=>r.amount)),expense=sum(rows.filter(r=>r.kind==='expense').map(r=>r.amount));months.push({label:MONTHS[m].slice(0,3),income,expense})}const max=Math.max(1,...months.flatMap(x=>[x.income,x.expense]));return `<article class="card home-trend-card"><div class="card-head"><div><h2>Fluxo mês a mês</h2><p>Receitas e despesas registradas nos últimos 12 meses</p></div><span class="trend-legend"><i></i>Receitas <b></b>Despesas</span></div><div class="trend-bars" role="img" aria-label="Gráfico comparando receitas e despesas nos últimos 12 meses">${months.map(x=>`<div class="trend-month" title="${x.label}: receitas ${money(x.income)}, despesas ${money(x.expense)}"><div class="trend-pair"><i style="height:${Math.max(x.income?3:0,x.income/max*100)}%"></i><b style="height:${Math.max(x.expense?3:0,x.expense/max*100)}%"></b></div><small>${x.label}</small></div>`).join('')}</div></article>`}
function homeSmartFinanceCard(m){const budgets=Object.entries(db.prefs.categoryBudgets||{}).filter(([c])=>c!=='Mercado').sort(([a],[b])=>CATS.indexOf(a)-CATS.indexOf(b)).map(([category,limit])=>({category,limit,spent:sum(m.records.filter(r=>r.kind==='expense'&&r.category===category).map(r=>r.amount))}));const watched=budgets.filter(x=>x.spent>=x.limit*.8),cardRecords=m.records.filter(r=>r.kind==='expense'&&r.category==='Cartões').sort((a,b)=>b.date.localeCompare(a.date)),cardSpent=sum(cardRecords.map(r=>r.amount)),cardPending=upcomingBillInstances(30).filter(x=>x.category==='Cartões').slice(0,3),installments=m.records.filter(r=>r.kind==='expense'&&r.category==='Cartões'&&/\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(r.note||'')).slice(-3).reverse();const status=watched.length?`${watched.length} limite${watched.length===1?'':'s'} perto de atingir`:'Nenhum limite perto de atingir';return `<article class="card home-smart-finance-card"><div class="card-head"><div><h2>Limites, cartões e parcelas</h2><p>${esc(monthLabel())} · acompanhamento dos registros existentes</p></div><button type="button" class="btn small" data-home-budget>Gerenciar limites</button></div><div class="actions home-finance-actions"><button type="button" class="btn small primary" data-home-finance-entry="card">Registrar gasto com cartão</button></div><div class="smart-mobile-summary"><b>${status}</b><span>Cartões: ${money(cardSpent)} no mês${cardPending.length?' · '+cardPending.length+' conta(s) fixa(s) próxima(s)':''}</span><div class="smart-mobile-actions"><button type="button" class="text-link" data-page="transactions" data-tx-set="expense">Ver despesas</button><button type="button" class="text-link" data-page="calendar">Ver vencimentos</button></div></div>${cardRecords.length?'<div class="home-card-records"><h3>Gastos com cartão · '+esc(monthLabel())+'</h3>'+cardRecords.slice(0,3).map(record=>`<button type="button" class="smart-due-row" data-edit-record="${esc(record.id)}"><span>${dateBR(record.date)} · ${esc(record.note||'Gasto com cartão')}</span><strong>${money(record.amount)}</strong></button>`).join('')+'<button type="button" class="text-link" data-home-category="Cartões">Ver todos os gastos com cartão</button></div>':'<p class="help">Nenhum gasto com cartão registrado neste mês.</p>'}<div class="smart-detail-grid"><section class="smart-detail-section"><h3>Limites por categoria</h3>${budgets.length?budgets.map(x=>{const ratio=Math.round(x.spent/x.limit*100),alert=ratio>=100;return `<div class="smart-budget-row"><div><span><b>${esc(x.category)}</b><small>${money(x.spent)} de ${money(x.limit)}</small></span><strong class="${alert?'danger-text':ratio>=80?'warning-text':''}">${percent(ratio)}</strong></div><progress max="${x.limit}" value="${Math.min(x.spent,x.limit)}"></progress></div>`}).join(''):'<p class="help">Nenhum limite por categoria cadastrado. Configure em Metas para acompanhar os alertas aqui.</p>'}</section><section class="smart-detail-section"><h3>Gastos com cartões</h3><div class="smart-card-spend"><strong>${money(cardSpent)}</strong><small>Despesas classificadas como Cartões neste mês</small></div>${cardPending.length?`<h4>Contas recorrentes de cartão</h4>${cardPending.map(x=>`<button class="smart-due-row" type="button" data-open-calendar-date="${x.date}"><span>${dateBR(x.date)} · ${esc(x.note||'Conta recorrente')}</span><strong>${money(x.amount)}</strong></button>`).join('')}`:'<p class="help">Sem conta recorrente de cartão prevista nos próximos 30 dias.</p>'}${installments.length?`<h4>Parcelas identificadas nas descrições</h4>${installments.map(x=>{const match=(x.note||'').match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);return `<div class="smart-installment-row"><span>${esc(x.note)}<small>Parcela ${match[1]} de ${match[2]} · ${dateBR(x.date)}</small></span><strong>${money(x.amount)}</strong></div>`}).join('')}<p class="help">Identificação baseada no texto do lançamento; não representa uma fatura oficial do cartão.</p>`:'<p class="help">Informe “3/10” na descrição para identificar uma parcela.</p>'}</section></div></article>`}
const mobileHomeLayout=matchMedia('(max-width:760px)');
const mobileHomeOpen=()=>mobileHomeLayout.matches?'':'open';
mobileHomeLayout.addEventListener('change',()=>{
 for(const disclosure of document.querySelectorAll('.mobile-home-disclosure'))disclosure.open=!mobileHomeLayout.matches;
});
document.addEventListener('click', event=>{
  const control=event.target.closest('[data-home-month]');
  if(!control)return;
  if(control.dataset.homeMonth==='pick')openMonthPicker();
  else changeMonth(control.dataset.homeMonth==='prev'?-1:1);
});
function budgetDueCard(){
  const bills=upcomingBillInstances(30);
  const dueOverdue=bills.filter(bill=>bill.daysLate>0).length;
  const dueToday=bills.filter(bill=>bill.daysUntil===0).length;
  const dueWeek=bills.filter(bill=>bill.daysUntil>0&&bill.daysUntil<=7).length;
  return `<article class="card" id="budgetDueCard">${cardTitle('Próximos vencimentos','Contas previstas para os próximos 30 dias e vencimentos recentes')}<div class="actions home-finance-actions"><button type="button" class="btn small primary" data-home-finance-entry="due">Adicionar vencimento</button><button type="button" class="btn small" data-page="calendar">Abrir calendário</button></div><div class="home-due-summary"><div><small>Vencidos</small><strong>${dueOverdue}</strong></div><div><small>Hoje</small><strong>${dueToday}</strong></div><div><small>Próximos 7 dias</small><strong>${dueWeek}</strong></div></div>${bills.length?`<div class="upcoming-list">${bills.map(t=>`<button type="button" class="upcoming-row" data-open-calendar-date="${t.date}"><span class="upcoming-day">${dateBR(t.date).slice(0,5)}</span><span><b>${esc(t.category)}</b><small>${t.daysLate?`<span class="overdue-label">Vencida há ${t.daysLate} dia(s)</span> · `:t.daysUntil===0?'Vence hoje · ':t.daysUntil===1?'Vence amanhã · ':`Vence em ${t.daysUntil} dias · `}${esc(t.note||'Conta prevista')}</small></span><strong>${money(t.amount)}</strong></button>`).join('')}</div>`:`<div class="empty-inline">Nenhum vencimento na lista. Use Adicionar vencimento para cadastrar uma conta.</div>`}</article>`;
}
function homeBudgetLinks(monthData,bills){
  const cardSpent=sum(monthData.records.filter(record=>record.kind==='expense'&&record.category==='Cartões').map(record=>record.amount));
  const next=bills.find(bill=>bill.daysUntil>=0);
  const overdue=bills.filter(bill=>bill.daysLate>0).length;
  return `<div class="home-reference-pair">
    <article class="card home-budget-link"><h2>Orçamento do mês</h2><p>${esc(monthLabel())}</p>
      <dl><div><dt>Despesas registradas</dt><dd>${money(monthData.expenses)}</dd></div><div><dt>Gastos com cartões</dt><dd>${money(cardSpent)}</dd></div></dl>
      <div class="actions"><button type="button" class="btn small" data-page="budget">Abrir orçamento</button><button type="button" class="btn small" data-home-budget>Gerenciar limites</button></div></article>
    <article class="card home-budget-link"><h2>Contas a pagar</h2>
      <p>${next?'Próximo vencimento em '+dateBR(next.date):'Sem contas previstas nos próximos 30 dias.'}</p>
      ${next?`<strong>${esc(next.note||next.category)} · ${money(next.amount)}</strong>`:''}
      ${overdue?`<p>${overdue} conta(s) vencida(s) recentemente.</p>`:''}
      <div class="actions"><button type="button" class="btn small" data-budget-target="budgetDueCard">Ver vencimentos</button></div></article>
  </div>`;
}
function budgetRecurrenceCard(){
  const pending=pendingRecurring();
  return `<article class="card" id="budgetRecurrenceCard">
    ${cardTitle('Contas e rendas recorrentes','As previsões entram nos totais quando você confirma os lançamentos.')}
    <div class="actions">
      <button type="button" class="btn small" data-open="recurring">Nova recorrência</button>
      <button type="button" class="btn small primary" id="applyRecurringBtn" ${pending.length?'':'disabled'}>Lançar previsões (${pending.length})</button>
    </div>
    ${recurringList()}
  </article>`;
}
function budget(){
  const m=month(),events=calendarEventsForMonth(state.year,state.month);
  const pendingTotal=sum([...events.values()].flat().filter(item=>item.kind==='scheduled-expense').map(item=>Math.abs(item.value)));
  $('#page-budget').innerHTML=`
    ${heading('Orçamento','Controle limites, gastos com cartão e contas a pagar.')}
    <div class="actions budget-month">
      <button type="button" class="btn small" data-home-month="prev" aria-label="Mês anterior">‹</button>
      <button type="button" class="btn small" data-home-month="pick">${esc(monthLabel())}</button>
      <button type="button" class="btn small" data-home-month="next" aria-label="Próximo mês">›</button>
      <button type="button" class="btn primary" data-open="expense">Nova despesa</button>
      <button type="button" class="btn" data-page="transactions" data-tx-set="expense">Lançamentos</button>
      <button type="button" class="btn" data-page="reports">Relatórios</button>
    </div>
    <div class="stats budget-stats">
      ${stat('Despesas do mês',money(m.expenses),'Valores lançados','wallet')}
      ${stat('Contas previstas',money(pendingTotal),'No mês selecionado · contas que ainda não viraram lançamento','calendar')}
    </div>
    <div class="budget-card-grid">
      ${budgetDueCard()}${homeSmartFinanceCard(m)}
      ${categorySpendCard(m)}${homeForecastCard()}
      ${marketBudgetCard(m)}${categoryBudgetCard(m)}
      ${expenseComparisonCards(m)}
      ${paydayPaceCard(m)}${cashflowCard()}
      ${budgetRecurrenceCard()}${debtCompareCard()}
    </div>`;
}
function home(){const m=month(),activeJars=db.jars.filter(j=>!j.archived&&!j.paused);const dueItems=upcomingBillInstances(30),dueToday=dueItems.filter(x=>x.daysUntil===0).length,dueWeek=dueItems.filter(x=>x.daysUntil>0&&x.daysUntil<=7).length;const period=homePeriodMetrics(),periodNet=period.income-period.expenses,periodChange=periodNet-(period.previous.income-period.previous.expenses),usesMonthlyBalance=period.mode==='today',displayBalance=usesMonthlyBalance?m.balance:periodNet,primary=displayBalance>=0?money(displayBalance):`−${money(Math.abs(displayBalance))}`,primaryLabel=usesMonthlyBalance?(m.balance>=0?'Você ainda pode gastar':'Saídas acima da renda'):(periodNet>=0?'Entradas menos despesas no período':'Despesas acima das receitas');$('#page-home').innerHTML=`<div class="today-top-grid"><article class="today-card"><div class="home-result-header"><h2>Saldo disponível</h2><div id="homeResultActions"><div class="home-result-tools"><button class="btn" data-home-month="prev" aria-label="Mês anterior">‹</button><button class="btn" data-home-month="pick">${esc(monthLabel())} ▾</button><button class="btn" data-home-month="next" aria-label="Próximo mês">›</button></div><button type="button" class="today-eye" data-home-action="privacy" aria-label="Ocultar valores" aria-pressed="${hideValues}" title="${hideValues?'Mostrar valores':'Ocultar valores'}">${hideValues?icon('eye').replace('</svg>','<path d="M3 3l18 18"/></svg>'):icon('eye')}</button></div></div><div class="today-balance-line"><strong class="today-amount ${m.balance<0?'over-budget':''}">${money(m.balance)}</strong></div><p>Saldo de ${esc(monthLabel())}. Receitas e despesas abaixo · ${esc(period.label)}.</p><div class="home-period-disclosure">${homePeriodControls()}</div><div class="today-income-expense"><button type="button" data-home-action="detail" data-route="transactions" data-filter="income"><span>${icon('income')}Receitas</span><strong>${money(period.income)}</strong></button><button type="button" data-home-action="detail" data-route="transactions" data-filter="expense"><span>${icon('expense')}Despesas</span><strong>${money(period.expenses)}</strong></button><button type="button" data-page="goals"><span>${icon('piggy')}Guardado no mês</span><strong>${money(m.saved)}</strong></button></div><p>${usesMonthlyBalance?'O saldo considera os lançamentos de todo o mês. Entradas e despesas mostram somente hoje.':`${periodChange>=0?'Resultado melhorou ':'Resultado caiu '}${money(Math.abs(periodChange))} em relação ao período anterior. ${primaryLabel}.`}</p>${period.income?`<div class="budget-progress"><div class="budget-progress-track"><span style="width:${Math.min(100,period.expenses/period.income*100)}%;background:${period.expenses>=period.income?'var(--danger)':period.expenses/period.income>=.8?'var(--warning)':'var(--primary)'}"></span></div><div class="budget-progress-caption"><span>${percent(period.expenses/period.income*100)} das receitas usadas</span><span>${period.expenses>=period.income?'Despesas acima das receitas':period.expenses/period.income>=.8?'Atenção ao ritmo':'Saldo positivo'}</span></div></div>`:`<div class="empty-inline">${usesMonthlyBalance?'Não houve receita registrada hoje; o saldo mensal considera também os lançamentos anteriores.':'Adicione uma receita no período para ver a comparação.'}</div>`}</article>${homeCalendarPreview()}</div><div class="home-reference-summary">${[['Receitas complementares',money(sum(m.records.filter(record=>record.kind==='income'&&record.source!=='salary').map(record=>record.amount))),'Registradas no mês selecionado','transactions','income'],['Metas',money(activeJars.reduce((total,jar)=>total+estimateCdbJar(jar.id).net,0)),'Guardado nos cofrinhos','goals','target'],['Investimentos',money(sum(db.investments.map(item=>item.balance))),'Carteira atual','investments','piggy'],['Próximos vencimentos',dueToday+dueWeek+' contas','Nos próximos 7 dias','budget','calendar']].map(([label,value,hint,page,ic])=>`<button class="card home-reference-stat" data-page="${page}"><span>${icon(ic)} ${label}</span><strong>${value}</strong><small>${hint}</small></button>`).join('')}</div>${homeBudgetLinks(m,dueItems)}<div class="mobile-home-shortcuts" aria-label="Atalhos"><button class="btn primary" data-open="expense">Nova despesa</button><button class="btn" data-page="analysis">Ver Insights</button><button class="btn" data-page="transactions">Lançamentos</button></div><details class="mobile-home-disclosure" ${mobileHomeOpen()}><summary>Gráficos, agenda e detalhes do mês</summary><div class="mobile-home-detail-content"><div class="home-reference-pair">${homeTrendCard()}${homeAgendaCard()}</div><div class="today-stats home-mobile-summary"></div>${goalProgressSummary('home-mobile-summary')}</div></details>`;syncDesktopHeaderControls();}
function income(){const m=month();$('#page-income').innerHTML=`${heading('Tudo que entra','Duas opções: salário e complemento.',`<button class="btn primary" data-open="income">${icon('plus')}Adicionar renda</button>`)}<div class="stats">${stat('Salário',money(m.salary),'Total recebido no mês','income')}${stat('Complemento',money(m.complement),'Ganhos adicionais','wallet')}${stat('Renda total',money(m.income),'Base para calcular o mínimo de 10%','income')}${stat('Mínimo para guardar',money(m.minimum),'10% da renda total','piggy')}</div><article class="card">${cardTitle('Entradas de '+monthLabel(),'Informe cada recebimento com valor e data.')}${recentTable(m.records,'income')}</article>`}
function transactionItems(){const key=mkey(state.year,state.month),rows=db.records.filter(x=>x.date.startsWith(key)).map(x=>({id:x.id,date:x.date,type:x.kind,category:x.category||'',amount:x.kind==='income'?x.amount:-x.amount,impact:x.kind==='income'?x.amount:-x.amount,title:x.kind==='income'?(x.source==='salary'?'Salário':'Complemento'):x.category,detail:[x.subcategory,x.note,...(x.tags||[]).map(tag=>'#'+tag)].filter(Boolean).join(' · ')||(x.kind==='income'?'Renda':'Despesa'),tags:x.tags||[],subcategory:x.subcategory||'',search:[x.kind,x.category,x.subcategory,x.source,x.note,...(x.tags||[]),x.date]}));const transfers=db.allocations.filter(x=>x.date.startsWith(key)).map(x=>{const cashImpact=x.amount>0?-x.amount:(x.netReceived??-x.amount);return{id:x.id,date:x.date,type:'goals',amount:cashImpact,impact:cashImpact,title:db.jars.find(j=>j.id===x.jarId)?.name||'Cofrinho',detail:x.amount>0?'Depósito · valor reservado':'Resgate · valor líquido recebido',search:['meta',x.note,x.date,db.jars.find(j=>j.id===x.jarId)?.name||'']}});return [...rows,...transfers].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))}
let transactionLimit=30, transactionQueryKey="";
function renderTransactionList(){const list=$('#transactionList');if(!list)return;let rows=transactionItems();if(state.txFilter!=='all')rows=rows.filter(x=>x.type===state.txFilter);if(state.txCategorySet?.length)rows=rows.filter(x=>state.txCategorySet.includes(x.category));const scope=$('#transactionCategoryScope');if(scope)scope.innerHTML=state.txCategorySet?.length?'<div class="transaction-filter-group"><span>Categoria</span><strong>'+esc(state.txCategorySet.length===1?state.txCategorySet[0]:'Outras categorias · '+state.txCategorySet.join(', '))+'</strong><button type="button" class="tag-filter" data-clear-tx-category-set>Limpar filtro</button></div>':'';const monthRecords=db.records.filter(x=>x.date.startsWith(mkey(state.year,state.month))),tags=[...new Set(monthRecords.flatMap(x=>x.tags||[]))].sort((a,b)=>a.localeCompare(b,'pt-BR')),subcategories=[...new Set(monthRecords.map(x=>x.subcategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),filterBox=$('#transactionTagFilters');if(state.txTag&&!tags.includes(state.txTag))state.txTag='';if(state.txSubcategory&&!subcategories.includes(state.txSubcategory))state.txSubcategory='';if(filterBox)filterBox.innerHTML=`${tags.length?`<div class="transaction-filter-group"><span>Etiquetas</span><button type="button" class="tag-filter ${state.txTag?'':'selected'}" data-tx-tag="">Todas</button>${tags.map(tag=>`<button type="button" class="tag-filter ${state.txTag===tag?'selected':''}" data-tx-tag="${esc(tag)}">#${esc(tag)}</button>`).join('')}</div>`:''}${subcategories.length?`<div class="transaction-filter-group"><span>Subcategorias</span><button type="button" class="tag-filter ${state.txSubcategory?'':'selected'}" data-tx-subcategory="">Todas</button>${subcategories.map(value=>`<button type="button" class="tag-filter ${state.txSubcategory===value?'selected':''}" data-tx-subcategory="${esc(value)}">${esc(value)}</button>`).join('')}</div>`:''}`;if(state.txTag)rows=rows.filter(x=>x.tags?.includes(state.txTag));if(state.txSubcategory)rows=rows.filter(x=>x.subcategory===state.txSubcategory);const q=(state.txSearch||'').trim().toLocaleLowerCase('pt-BR');if(q)rows=rows.filter(x=>[x.title,x.detail,x.date,...x.search,String(Math.abs(x.amount)/100),(Math.abs(x.amount)/100).toLocaleString('pt-BR',{minimumFractionDigits:2}),money(Math.abs(x.amount))].join(' ').toLocaleLowerCase('pt-BR').includes(q));const total=rows.reduce((a,x)=>a+(x.impact||0),0);const key=JSON.stringify([state.year,state.month,state.txFilter,state.txTag,state.txSubcategory,state.txCategorySet||[],q]);
if(key!==transactionQueryKey){transactionQueryKey=key;transactionLimit=30}
const formatter=rows.slice(0,transactionLimit).map(x=>`<article class="transaction-row"><span class="transaction-icon ${x.type}">${icon(x.type==='income'?'income':x.type==='expense'?'expense':'piggy')}</span><div class="transaction-copy"><b>${esc(x.title)}</b><small>${dateBR(x.date)} · ${esc(x.detail)}</small>${x.tags?.length?`<span class="transaction-tags">${x.tags.map(tag=>`<span>#${esc(tag)}</span>`).join(' ')}</span>`:''}</div><strong class="transaction-amount ${x.amount>=0?'positive':'negative'}">${x.amount>0?'+':'−'}${money(Math.abs(x.amount))}</strong><div class="transaction-actions">${x.type==='goals'?`<button class="btn small negative" data-delete-allocation="${esc(x.id)}" aria-label="Excluir movimentação de ${esc(x.title)} em ${dateBR(x.date)}">Excluir</button>`:`<button class="btn small" data-edit-record="${esc(x.id)}" aria-label="Editar ${esc(x.title)} em ${dateBR(x.date)}">Editar</button><button class="btn small negative" data-delete-record="${esc(x.id)}" aria-label="Excluir ${esc(x.title)} em ${dateBR(x.date)}">Excluir</button>`}</div></article>`).join('');list.innerHTML=formatter?`${formatter}${rows.length>transactionLimit?'<button class="btn" id="moreTransactions">Ver mais</button>':''}<div class="transaction-total" role="status" tabindex="-1">Mostrando ${Math.min(transactionLimit,rows.length)} de ${rows.length} ${rows.length===1?'item':'itens'} · impacto no orçamento ${total<0?'−':''}${money(Math.abs(total))}</div>`:'<div class="empty"><strong>Nenhum lançamento encontrado</strong>Experimente outro filtro ou registre um lançamento.</div>'}
function transactions(){const totals=month();$('#page-transactions').innerHTML=`${heading('Lançamentos','Rendas, despesas e movimentações dos cofrinhos em uma linha do tempo.',`<div class="actions"><button class="btn" id="copyPreviousBtn">Copiar despesas do mês anterior</button><button type="button" class="btn" data-budget-target="budgetRecurrenceCard">Contas recorrentes</button></div>`)}<div class="stats transaction-summary">${stat('Receitas',money(totals.income),monthLabel(),'income')}${stat('Despesas',money(totals.expenses),monthLabel(),'expense')}${stat('Resultado',money(totals.income-totals.expenses),'Receitas menos despesas','wallet')}</div><article class="card transaction-card"><div class="transaction-toolbar"><div class="tx-filters" role="group" aria-label="Filtrar lançamentos">${[['all','Tudo'],['expense','Despesas'],['income','Rendas'],['goals','Metas']].map(([id,label])=>`<button type="button" class="tx-filter ${state.txFilter===id?'selected':''}" data-tx-filter="${id}" aria-pressed="${state.txFilter===id}">${label}</button>`).join('')}</div><label class="search-field">${icon('search')}<input id="transactionSearch" type="search" placeholder="Buscar descrição, categoria ou valor" value="${esc(state.txSearch)}" aria-label="Buscar lançamentos"></label></div><div id="transactionCategoryScope" class="transaction-tag-filters" aria-label="Filtro por categoria"></div><div id="transactionTagFilters" class="transaction-tag-filters" aria-label="Filtrar etiquetas e subcategorias"></div><div id="transactionList" class="transaction-list"></div></article>`;renderTransactionList()}
function openCopyPreviousExpenses(){let y=state.year,m=state.month-1;if(m<0){m=11;y--}const source=getMonth(y,m).records.filter(r=>r.kind==='expense'&&!r.recurringId&&!r.investmentId);if(!source.length)return notify('O mês anterior não tem despesas avulsas para copiar.');const key=mkey(state.year,state.month);const exists=x=>db.records.some(r=>r.kind==='expense'&&r.date.startsWith(key)&&r.category===x.category&&r.note===x.note&&r.amount===x.amount);state.copyCandidates=source.filter(x=>!exists(x));if(!state.copyCandidates.length)return notify('As despesas avulsas do mês anterior já foram copiadas.');state.modalTrigger=document.activeElement;state.modal='copyExpenses';$('#modalTitle').textContent='Escolher despesas para copiar';$('#modalContent').innerHTML=`<form id="copyExpensesForm"><p class="help">Selecione o que se repete em ${monthLabel()}. As datas serão ajustadas ao mês atual.</p><div class="copy-expense-list">${state.copyCandidates.map(x=>`<label class="copy-expense-option"><input type="checkbox" name="copyExpense" value="${esc(x.id)}" checked><span><b>${esc(x.category)}</b><small>${dateBR(x.date)} · ${esc(x.note||'Sem descrição')}</small></span><strong>${money(x.amount)}</strong></label>`).join('')}</div><div class="form-buttons"><button type="button" class="btn" data-close="1">Cancelar</button><button type="submit" class="btn primary">Copiar selecionadas</button></div></form>`;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';focusAppModal($('#modalContent input'))}
async function submitCopyExpenses(e){e.preventDefault();const ids=new Set([...e.target.querySelectorAll('input[name="copyExpense"]:checked')].map(x=>x.value));if(!ids.size)return notify('Selecione ao menos uma despesa.');const key=mkey(state.year,state.month),maxDay=new Date(state.year,state.month+1,0).getDate();const copies=state.copyCandidates.filter(x=>ids.has(x.id)).map(x=>{const day=Math.min(Number(x.date.slice(8)),maxDay);return {...x,id:uid(),recurringId:null,recurringMonth:null,investmentId:null,investmentExpenseId:null,date:key+'-'+String(day).padStart(2,'0')}});const fresh=copies.filter(x=>!db.records.some(r=>r.kind==='expense'&&r.date===x.date&&r.category===x.category&&r.note===x.note&&r.amount===x.amount));if(!fresh.length)return notify('As despesas selecionadas já existem neste mês.');if(await mutate(()=>db.records.push(...fresh))){closeModal(true);notify(`${fresh.length} ${fresh.length===1?'despesa copiada':'despesas copiadas'} para ${monthLabel()}.`)}}
function linkedInvestmentBalance(id,asOf=null){return sum(db.investments.filter(x=>x.goalId===id&&(!asOf||x.checked<=asOf)).map(x=>x.balance))}
function goalEngineData(y,m){const key=mkey(y,m),today=isoToday(),currentKey=today.slice(0,7),asOf=key<currentKey?new Date(y,m+1,0).toISOString().slice(0,10):today,adjustments={};for(const jar of db.jars){const principal=sum(db.allocations.filter(a=>a.jarId===jar.id&&a.date<=asOf).map(a=>a.amount)),net=estimateCdbJar(jar.id,asOf).net,linked=linkedInvestmentBalance(jar.id,asOf);adjustments[jar.id]=net+linked-principal}return {...db,goalBalanceAdjustments:{[key]:adjustments}}}
function goalProgressSummary(extraClass='',showAction=true){
  const goals=db.jars.filter(j=>!j.archived);
  if(!goals.length)return '';
  return `<article class="card today-reserve ${extraClass}">${cardTitle('Progresso das metas','Cofrinhos e investimentos vinculados', showAction?'<button class="text-link" data-page="goals">Ver metas</button>':'')}
  <div class="today-goal-list">${goals.map(j=>{
    const balance=estimateCdbJar(j.id).net+linkedInvestmentBalance(j.id);
    const progress=j.target?balance/j.target*100:0;
    return `<div class="today-goal"><span class="goal-ring" style="--progress:${hideValues?0:Math.min(100,progress)}%"><b>${hideValues?'••':Math.round(progress)+'%'}</b></span><span><b>${esc(j.name)}</b><small>${money(balance)} de ${money(j.target)}${j.paused?' · Pausada':''}</small></span></div>`;
  }).join('')}</div></article>`;
}

function reserveMonthCard(m,extraClass=''){
 const total=m.deposits+m.invested,redemptions=m.withdrawals+m.redeemed,share=m.income?percent(total/m.income*100):'Sem renda registrada';
 const detail='Cofrinhos: '+money(m.deposits)+' · Carteira: '+money(m.invested)+(redemptions?' · Resgates: '+money(redemptions):'')+' · '+share;
 return '<article class="today-stat '+extraClass+'"><span class="today-stat-label">'+icon('piggy')+'Reserva deste mês</span><strong>'+money(total)+'</strong><small>'+detail+'</small></article>';
}
function marketBudgetOverviewCard(monthData,embedded=false){
 const budget=db.prefs.marketBudget,spent=sum(monthData.records.filter(r=>r.kind==='expense'&&r.category==='Mercado').map(r=>r.amount));
 const remaining=budget?Math.max(0,budget-spent):0,ratio=budget?Math.min(100,spent/budget*100):0;
 const status=!budget?'Sem cota definida':spent>budget?'Cota ultrapassada':spent===budget?'Cota atingida':ratio>=75?'Atenção ao limite':'Dentro da cota';
 return `${embedded?'<div class="market-budget-content">':'<article class="card market-budget home-quarter-card">'}<h3>Cota de Mercado</h3><strong>${money(spent)}</strong><small>Gastos em ${esc(monthLabel())}</small>
 ${budget?`<p>${spent>budget?'Acima da cota':'Restante'}: <b>${money(spent>budget?spent-budget:remaining)}</b> · ${percent(ratio)} usada</p><div class="budget-progress-track"><span style="width:${ratio}%;background:${ratio>=100?'var(--danger)':ratio>=75?'var(--warning)':'var(--primary)'}"></span></div>`:'<p>Defina um limite mensal para acompanhar os gastos.</p>'}
 <details class="market-budget-editor"><summary>${budget?'Ajustar cota':'Definir cota'}</summary><form data-market-budget-form><label class="field">Cota mensal (R$)<input name="budget" type="number" min="0.01" max="100000000" step="0.01" placeholder="Sem limite" value="${hideValues||!budget?'':(budget/100).toFixed(2)}"></label><button class="btn" type="submit">Salvar cota</button>${budget?'<button class="btn" type="submit" value="clear">Remover cota</button>':''}</form></details>${embedded?'</div>':'</article>'}`;
}
function homeDesktopSummaryCards(m,topTip){
 return '<article class="card tip-card home-quarter-card">'+cardTitle('Uma dica para você','Baseada nos lançamentos registrados')+'<p>'+esc(topTip)+'</p></article>'+reserveMonthCard(m,'home-quarter-card')+goalProgressSummary('home-quarter-card',false);
}

function portfolioSummary(){
  const items=db.investments;
  return `<article class="card"><h3>Carteira de investimentos</h3><p>${items.length} aplicação(ões) · Saldo líquido informado: <strong>${money(sum(items.map(x=>x.balance)))}</strong></p><p>Vinculado a metas ativas: ${money(sum(items.filter(x=>db.jars.some(j=>j.id===x.goalId&&!j.archived)).map(x=>x.balance)))}</p><button class="btn" data-page="investments">Abrir investimentos</button></article>`;
}
function jarCard(j,mini=false){
 const plan=Engines.goal(goalEngineData(state.year,state.month),j,state.year,state.month);
 const cdb=estimateCdbJar(j.id),institution=db.institutions.find(i=>i.id===j.institutionId)||db.institutions[0],linked=linkedInvestmentBalance(j.id),val=cdb.net+linked,ratio=j.target?val/j.target*100:0,remain=Math.max(0,j.target-val),paused=!!j.paused;
 const labels={concluida:'Concluída',atrasada:'Prazo encerrado',em_risco:'Em risco',no_ritmo:'No ritmo',sem_historico:'Acompanhar'};
 const status=remain===0?'concluida':plan.status,statusCls=['atrasada','em_risco'].includes(status)?'warn':status==='concluida'?'':'soft';
 let hint=remain===0?'Meta alcançada':plan.monthsRemaining>0?`${money(Math.ceil(remain/plan.monthsRemaining))} por mês até o prazo`:'Prazo anterior a este mês';
 const paceText=plan.monthlyPace===null?'Ritmo: aguardando histórico':`Ritmo recente: ${money(plan.monthlyPace)}/mês`,inflation=currentIpcaAnnual(),years=Math.max(0,(new Date(j.dueDate+'T12:00:00')-new Date(isoToday()+'T12:00:00'))/86400000/365.25),inflatedTarget=inflation===null?null:Math.round(j.target*Math.pow(1+inflation/100,years));
 return `<div class="goal-card"><div class="goal-top"><div><h3>${esc(j.name)}</h3><p>${esc(institution?.name||'Banco Inter')} · ${percent(institution?.cdiPercent||100)} do CDI · prazo: ${dateBR(j.dueDate)}</p></div><span class="tag ${paused?'soft':statusCls}">${paused?'Plano pausado':labels[status]}</span></div><div class="goal-amount"><strong>${money(val)}</strong><span>saldo para a meta · ${percent(ratio)} da meta</span></div>${miniProgress(val,j.target)}<div class="cdb-detail"><span>Saldo líquido do cofrinho: ${money(cdb.net)}</span>${linked?`<span>Aplicações vinculadas: ${money(linked)}</span>`:''}<span>Aportado: ${money(cdb.principal)}</span><span>Rendimento bruto: ${money(cdb.gain)}</span><span>Estimativa líquida após impostos se resgatar hoje</span></div><div class="goal-foot"><span>${remain>0?'Faltam '+money(remain):'Objetivo atingido'}</span><span>${mini?'':paused?'Sem aporte planejado':hint}</span></div>${mini?'':`<div class="goal-pacing"><b>${paused?'Plano pausado':esc(hint)}</b><span>${paused?'Saldo e histórico continuam registrados. Retome quando quiser.':esc(paceText)}</span><span>Saldo calculado com o CDI publicado até ${cdiDateBR(cdb.rateDate)}.</span>${inflatedTarget===null?'':`<span>Meta no prazo se o IPCA atual persistir: ${money(inflatedTarget)} · cenário, não previsão.</span>`}${!paused&&plan.projectedPeriod&&plan.status==='em_risco'?`<span>Na velocidade atual sem juros futuros: ${plan.projectedPeriod.slice(5)}/${plan.projectedPeriod.slice(0,4)}.</span>`:''}</div><div class="goal-actions"><button class="btn primary small" data-open="add" data-jar="${esc(j.id)}">+ Guardar</button><button class="btn small" data-open="withdraw" data-jar="${esc(j.id)}" ${val<=0?'disabled':''}>Resgatar</button><button class="btn small" data-edit-jar="${esc(j.id)}">Editar</button><button class="btn small" data-toggle-jar="${esc(j.id)}">${paused?'Retomar plano':'Pausar plano'}</button>${db.allocations.some(a=>a.jarId===j.id)?`<button class="btn small" data-archive-jar="${esc(j.id)}">Arquivar</button>`:`<button class="btn negative small" data-delete-jar="${esc(j.id)}">Excluir</button>`}</div>`}</div>`
}
function movementsTable(){
  const period=mkey(state.year,state.month);
  const rows=db.allocations.map(a=>({
    date:a.date,name:db.jars.find(j=>j.id===a.jarId)?.name||'Cofrinho',
    kind:a.amount>0?'Aporte em cofrinho':'Resgate de cofrinho',
    amount:a.amount>0?-a.amount:(a.netReceived??-a.amount),
    note:a.note, allocationId:a.id
  }));
  for(const x of db.investments){
    rows.push({date:x.date,name:x.name,kind:x.existing?'Aplicação existente · sem débito':'Novo investimento',amount:x.existing?x.cost:-x.cost, reference:x.existing});
    for(const r of x.redemptions??[])rows.push({date:r.date,name:x.name,kind:'Resgate de investimento',amount:r.amount});
  }
  const monthly=rows.filter(r=>r.date.startsWith(period)).sort((a,b)=>b.date.localeCompare(a.date));
  if(!monthly.length)return '<div class="empty">Nenhum aporte, resgate ou aplicação com data neste mês.</div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Cofrinho ou aplicação</th><th class="right">Valor</th><th class="right">Ação</th></tr></thead><tbody>${monthly.map(r=>`<tr><td>${dateBR(r.date)}</td><td><b>${esc(r.name)}</b><div class="sub">${r.kind}${r.note?' · '+esc(r.note):''}</div></td><td class="money">${r.reference||hideValues?'':r.amount<0?'−':'+'}${money(Math.abs(r.amount))}</td><td class="right">${r.allocationId?`<button class="delete" data-delete-allocation="${esc(r.allocationId)}">Excluir</button>`:'<button class="btn small" data-page="investments">Ver carteira</button>'}</td></tr>`).join('')}</tbody></table></div>`;
}
let investmentEditId = null;
let investmentExisting = false;
function investmentEstimateMarkup(item){const estimate=estimateCdbInvestment(item);if(!estimate)return'';if(estimate.unavailable)return`<p class="investment-estimate-note">Estimativa CDI: ${esc(estimate.unavailable)}</p>`;return`<details class="investment-estimate"><summary>Estimativa líquida aproximada · ${estimate.pct}% do CDI</summary><p>Saldo bruto estimado: <strong>${money(estimate.gross)}</strong> · líquido estimado hoje: <strong>${money(estimate.net)}</strong></p><p>Rendimento bruto: ${money(estimate.gain)} · IOF estimado: ${money(estimate.iof)} · IR estimado: ${money(estimate.ir)}</p><small>CDI publicado até ${cdiDateBR(estimate.rateDate)}. O saldo informado pelo Inter continua sendo a referência oficial.</small></details>`}
function investments() {
  const items=db.investments,byInstitution=new Map();
  const sorted=[...items].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'pt-BR'));
  for(const item of items)if(item.balance>0)byInstitution.set(item.institution,(byInstitution.get(item.institution)||0)+item.balance);
  const cdiEstimates=items.map(x=>estimateCdbInvestment(x)).filter(Boolean),validEstimates=cdiEstimates.filter(estimate=>!estimate.unavailable);
  $('#page-investments').innerHTML=`${heading('Investimentos','Acompanhe aplicações financeiras e ativos de pecuária na mesma carteira.')}
  <div class="actions"><button class="btn primary" data-investment-edit="">Registrar novo investimento</button><button class="btn" data-investment-edit="" data-existing="true">Registrar investimento já existente</button><button class="btn" data-quick-open="add">Registrar aporte em cofrinho</button></div>
  <div class="overview-grid"><article class="card"><h3>Saldo informado das aplicações e custo restante dos lotes</h3><strong>${money(sum(items.filter(x=>x.status!=='sold').map(x=>x.assetType==='livestock'?x.remainingCostBasis:x.balance)))}</strong></article><article class="card"><h3>Saldo atual da carteira</h3><strong>${money(sum(items.map(x=>x.balance)))}</strong></article>${cdiEstimates.length?`<article class="card"><h3>Estimativa líquida dos CDBs atrelados ao CDI</h3><strong>${money(sum(validEstimates.map(x=>x.net)))}</strong><small>${validEstimates.length} de ${cdiEstimates.length} aplicação(ões) calculada(s); não substitui o saldo informado pelo Inter.</small></article>`:''}
  ${byInstitution.size?`<article class="card institution-desktop-card"><h3>Saldo por instituição ou propriedade</h3>${[...byInstitution].map(([name,value])=>`<p>${esc(name)} · ${money(value)}</p>`).join('')}</article>`:''}</div>
  ${items.length?`<section class="investment-portfolio"><h2>Carteira</h2><div class="investment-card-grid">${sorted.map(x=>{const cattle=x.assetType==='livestock',sales=(x.redemptions||[]).filter(r=>r.kind==='sale'),realized=sum(sales.map(r=>r.amount-(r.costBasisSold||0))),expenseTotal=sum((x.expenses||[]).map(e=>e.amount)),label=cattle?`Pecuária · ${esc(x.livestockKind)} · ${x.headCount} cabeça(s) no lote`:`${esc(x.product)} · ${esc(x.institution)}`;return `<details class="card investment-tile"><summary><time datetime="${x.date}">${dateBR(x.date)}</time><b>${esc(x.name)}</b><small>${label}${cattle?' · '+esc(x.institution):''}</small><span>${x.status==='sold'?'Lote vendido':cattle?'Valor de mercado':'Saldo líquido'}</span><strong>${money(x.balance)}</strong></summary><div class="investment-tile-detail"><p>Compra: ${money(x.cost)} em ${dateBR(x.date)}${cattle?' · custo restante do lote: '+money(x.remainingCostBasis||0):''}</p><p>${cattle?`Valor de mercado informado: ${money(x.balance)} em ${dateBR(x.checked)}${x.headCount? ' · '+money(Math.round(x.balance/x.headCount))+' por cabeça':''}`:`Saldo líquido informado: ${money(x.balance)} em ${dateBR(x.checked)}`}</p>${!cattle?investmentEstimateMarkup(x):''}${cattle?`<p>Custos detalhados: ${money(expenseTotal)}${x.extraCosts?' · custos anteriores sem detalhamento: '+money(x.extraCosts):''} · Resultado realizado nas vendas: <strong>${money(realized)}</strong></p>${x.expenses?.length?`<details><summary>Despesas do lote (${x.expenses.length})</summary>${x.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<p>${dateBR(e.date)} · ${esc(e.category)} · ${money(e.amount)}${e.note?' · '+esc(e.note):''}</p>`).join('')}</details>`:''}${sales.length?`<details><summary>Vendas registradas (${sales.length})</summary>${sales.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<p>${dateBR(r.date)} · ${r.heads} cabeça(s) · ${money(r.amount)} recebido · resultado: ${money(r.amount-(r.costBasisSold||0))}</p>`).join('')}</details>`:''}`:`${x.redemptions?.length?`<details><summary>Resgates registrados</summary>${x.redemptions.map(r=>`<p>${dateBR(r.date)} · ${money(r.amount)}</p>`).join('')}</details>`:''}`}<div class="actions"><button class="btn" data-investment-edit="${esc(x.id)}">Editar dados</button>${cattle&&x.status!=='sold'?`<button class="btn" data-livestock-expense="${esc(x.id)}">Registrar gasto do lote</button><button class="btn" data-sell-livestock="${esc(x.id)}">Registrar venda parcial ou total</button>`:''}${!cattle&&x.status!=='sold'&&x.balance>0?`<button class="btn" data-redeem-investment="${esc(x.id)}">Registrar resgate</button>`:''}<button class="btn" data-investment-delete="${esc(x.id)}">Remover</button></div></div></details>`}).join('')}</div></section>`:'<article class="card">Cadastre sua primeira aplicação ou lote de pecuária para acompanhar sua carteira.</article>'}
  ${guaranteeCard()}`;
}
const redemptionForm=$('#redemptionForm'),livestockExpenseForm=$('#livestockExpenseForm');
let redemptionId=null,redemptionMode='redeem',livestockExpenseId=null;
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-redeem-investment],[data-sell-livestock]');
  if(button){
    redemptionMode=button.hasAttribute('data-sell-livestock')?'sale':'redeem';
    redemptionId=button.dataset.redeemInvestment||button.dataset.sellLivestock;
    const item=db.investments.find(x=>x.id===redemptionId);
    redemptionForm.reset();redemptionForm.elements.namedItem('date').value=isoToday();
    const sale=redemptionMode==='sale',headsInput=redemptionForm.elements.namedItem('heads'),headLabel=headsInput.closest('label');
    headsInput.required=sale;headsInput.max=item?.headCount||1;
    $('#redemptionTitle').textContent=sale?'Registrar venda do lote':'Registrar resgate';
    redemptionForm.querySelector('label span').textContent=sale?'Valor recebido pela venda (R$)':'Valor líquido recebido (R$)';
    redemptionForm.querySelector('button[type="submit"]').textContent=sale?'Salvar venda':'Salvar resgate';
    headLabel.hidden=!sale;
    if(sale)redemptionForm.elements.namedItem('heads').value=item?.headCount||1;
    $('#redemptionError').textContent='';$('#redemptionDialog').showModal();return;
  }
  const expense=event.target.closest('[data-livestock-expense]');
  if(expense){
    livestockExpenseId=expense.dataset.livestockExpense;
    const item=db.investments.find(x=>x.id===livestockExpenseId);
    livestockExpenseForm.reset();livestockExpenseForm.elements.namedItem('date').value=isoToday();
    $('#livestockExpenseTitle').textContent='Registrar gasto · '+(item?.name||'lote');
    $('#livestockExpenseError').textContent='';$('#livestockExpenseDialog').showModal();
  }
});
$('#redemptionCancel').addEventListener('click',()=>$('#redemptionDialog').close());
redemptionForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(redemptionForm),date=String(data.get('date')),amount=toCents(String(data.get('amount'))),item=db.investments.find(x=>x.id===redemptionId),error=$('#redemptionError');
  error.textContent='';
  if(redemptionMode==='sale'){
    const heads=Number(data.get('heads'));
    if(!item||item.assetType!=='livestock'||item.status==='sold'||!Number.isInteger(heads)||heads<1||heads>item.headCount||!Number.isSafeInteger(amount)||amount<=0||!validDate(date)||date<item.checked||date>isoToday()){
      error.textContent='Informe a quantidade vendida, o valor recebido e uma data válida entre a última conferência e hoje.';return;
    }
    if(await mutate(()=>{
      const beforeHeads=item.headCount,basis=item.remainingCostBasis||0;
      const costBasisSold=heads===beforeHeads?basis:Math.round(basis*heads/beforeHeads);
      const marketValueSold=heads===beforeHeads?item.balance:Math.round(item.balance*heads/beforeHeads);
      item.remainingCostBasis=Math.max(0,basis-costBasisSold);item.balance=Math.max(0,item.balance-marketValueSold);item.headCount-=heads;item.checked=date;
      (item.redemptions??=[]).push({date,amount,kind:'sale',heads,costBasisSold});
      if(item.headCount===0){item.status='sold';item.soldDate=date;item.saleAmount=sum(item.redemptions.filter(r=>r.kind==='sale').map(r=>r.amount));item.balance=0;}
    })){
      $('#redemptionDialog').close();notify('Venda registrada; quantidade, carteira e resultado realizado atualizados.');
    }
    return;
  }
  if(!item||item.status==='sold'||!Number.isSafeInteger(amount)||amount<=0||amount>item.balance||!validDate(date)||date<item.checked||date>isoToday()){
    error.textContent='Informe um valor até o saldo líquido e uma data entre a última conferência e hoje.';return;
  }
  if(await mutate(()=>{item.balance-=amount;item.checked=date;(item.redemptions??=[]).push({date,amount,kind:'redemption',heads:null,costBasisSold:null});})){
    $('#redemptionDialog').close();notify('Resgate registrado no saldo disponível.');
  }
});
$('#livestockExpenseCancel').addEventListener('click',()=>$('#livestockExpenseDialog').close());
livestockExpenseForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(livestockExpenseForm),item=db.investments.find(x=>x.id===livestockExpenseId),date=String(data.get('date')),amount=toCents(String(data.get('amount'))),category=String(data.get('category')),note=String(data.get('note')||'').trim().slice(0,120),error=$('#livestockExpenseError');
  error.textContent='';
  if(!item||item.assetType!=='livestock'||item.status==='sold'||!Number.isSafeInteger(amount)||amount<=0||item.remainingCostBasis+amount>10000000000||!validDate(date)||date<item.date||date>isoToday()){
    error.textContent='Informe um gasto positivo e uma data entre a compra e hoje.';return;
  }
  const expenseId=uid(),record={id:expenseId,kind:'expense',amount,date,source:'complement',category:'Pecuária',note:`${category} · ${item.name}${note?' — '+note:''}`,recurringId:null,recurringMonth:null,investmentId:item.id,investmentExpenseId:expenseId};
  if(await mutate(()=>{item.expenses??=[];item.expenses.push({id:expenseId,date,category,amount,note,recordId:expenseId});item.remainingCostBasis+=amount;db.records.push(record);})){
    $('#livestockExpenseDialog').close();notify('Gasto adicionado ao lote, ao histórico de despesas e aos orçamentos.');
  }
});
function toggleInvestmentAssetFields(){
  const form=$('#investmentForm'),cattle=form.elements.namedItem('assetType').value==='livestock';
  for(const [name,visible,required] of [['product',!cattle,!cattle],['cdiPercent',!cattle,false],['livestockKind',cattle,cattle],['headCount',cattle,cattle],['extraCosts',cattle,false]]){
    const input=form.elements.namedItem(name),label=input.closest('label'),item=db.investments.find(x=>x.id===investmentEditId),sold=!!(name==='headCount'&&item?.assetType==='livestock'&&(item.status==='sold'||(item.redemptions||[]).some(r=>r.kind==='sale')));label.hidden=!visible;input.required=required&&!sold;input.disabled=sold;
  }
  form.elements.namedItem('institution').closest('label').querySelector('span').textContent=cattle?'Fazenda ou propriedade':'Instituição';
  form.elements.namedItem('balance').closest('label').querySelector('span').textContent=cattle?'Valor de mercado atual do lote (R$)':'Saldo líquido do extrato (R$)';
  form.elements.namedItem('balance').closest('label').querySelector('small').textContent=cattle?'Informe uma estimativa atual para o lote.':'Use o valor líquido, após impostos, na data da conferência.';
  $('#investmentTitle').textContent=cattle?'Registrar investimento em pecuária':investmentExisting?'Investimento já existente':'Investimento com débito no saldo';
}
let reserveIncomeId=null;
function openInvestment(id,existing=false,income=null){
  reserveIncomeId=income?.id||null;
  const item=db.investments.find(x=>x.id===id);investmentEditId=item?.id??null;investmentExisting=item?item.existing===true:existing;
  const form=$('#investmentForm');form.reset();const goal=form.elements.namedItem('goalId');
  goal.innerHTML='<option value="">Sem vínculo</option>'+db.jars.filter(j=>!j.archived||j.id===item?.goalId).map(j=>`<option value="${esc(j.id)}">${esc(j.name)}</option>`).join('');goal.value=item?.goalId||'';
  form.elements.namedItem('assetType').value=item?.assetType||'financial';
  for(const key of ['name','institution','product','cdiPercent','livestockKind','headCount','extraCosts','date','checked','cost','balance']){
    const value=key==='cdiPercent'?(item?.cdiPercent??(item?investmentCdiPercent(item):null)):item?.[key];form.elements.namedItem(key).value=value==null?(key==='checked'?isoToday():key==='headCount'?1:''):['cost','balance','extraCosts'].includes(key)?value/100:value;
  }
  if(income){
    form.elements.namedItem('date').value=isoToday();
    const remaining=incomeReserveStatus(income).remaining/100;
    form.elements.namedItem('cost').value=remaining;
    form.elements.namedItem('balance').value=remaining;
  }
  const heads=form.elements.namedItem('headCount');
  heads.readOnly=!!(item?.redemptions||[]).some(r=>r.kind==='sale');
  toggleInvestmentAssetFields();$('#investmentDialog').showModal();
}
$('#investmentForm').elements.namedItem('assetType').addEventListener('change',toggleInvestmentAssetFields);
async function saveInvestment(event){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),field=key=>String(data.get(key)||'').trim();
  const existingItem=db.investments.find(x=>x.id===investmentEditId),cattle=existingItem?.status==='sold'&&existingItem.assetType==='livestock'||field('assetType')==='livestock';
  const extraCosts=cattle?Math.round(Number(field('extraCosts')||0)*100):0;
  const headCount=cattle?(existingItem?.status==='sold'?0:existingItem?.redemptions?.some(r=>r.kind==='sale')?existingItem.headCount:Number(field('headCount'))):null;
  const cdiPercent=field('cdiPercent')?Number(field('cdiPercent')):null;
  const cost=Math.round(Number(field('cost'))*100),balance=Math.round(Number(field('balance'))*100);
  if(cdiPercent!==null&&(!Number.isFinite(cdiPercent)||cdiPercent<=0||cdiPercent>500))return notify('Informe um percentual do CDI entre 0,01 e 500, ou deixe em branco.');
  if(existingItem?.assetType==='livestock'&&(existingItem.redemptions||[]).some(r=>r.kind==='sale')&&(cost!==existingItem.cost||extraCosts!==existingItem.extraCosts))return notify('Após uma venda parcial, o custo do lote e os custos adicionais ficam bloqueados para preservar o custo das vendas registradas.');
  const item={incomeRecordId:existingItem?.incomeRecordId||reserveIncomeId,id:investmentEditId||uid(),existing:investmentExisting,goalId:field('goalId')||null,name:field('name'),institution:field('institution'),product:cattle?'Pecuária · '+field('livestockKind'):field('product'),cdiPercent:cattle?null:cdiPercent,date:field('date'),checked:field('checked'),cost,balance,assetType:cattle?'livestock':'financial',livestockKind:cattle?field('livestockKind'):null,headCount,initialHeadCount:cattle?(existingItem?.initialHeadCount||headCount):null,extraCosts,expenses:existingItem?.expenses||[],remainingCostBasis:existingItem?(existingItem.remainingCostBasis+cost-existingItem.cost+extraCosts-existingItem.extraCosts):cost+extraCosts,status:existingItem?.status||'active',soldDate:existingItem?.soldDate||null,saleAmount:existingItem?.saleAmount||null,redemptions:existingItem?.redemptions||[]};
  if(cattle&&((existingItem?.status!=='sold'&&(!Number.isInteger(headCount)||headCount<1||headCount>100000))||!Number.isSafeInteger(extraCosts)||extraCosts<0||extraCosts>10000000000||!Number.isSafeInteger(item.remainingCostBasis)||item.remainingCostBasis<0||item.remainingCostBasis>10000000000))return notify('Informe a quantidade, os custos e o custo restante válidos.');
  if(reserveIncomeId){
    const income=db.records.find(record=>record.kind==='income'&&record.id===reserveIncomeId);
    if(!income||cattle||cost<=0||cost>incomeReserveStatus(income).remaining||item.date<income.date)
      return notify('Confira o valor restante da reserva e informe uma aplicação financeira com data igual ou posterior ao recebimento.');
  }
  if(item.checked<item.date||item.checked>isoToday())return notify('A conferência deve ocorrer entre a data da aplicação e hoje.');
  if(existingItem?.status==='sold'&&item.assetType==='livestock'){item.balance=0;item.headCount=0;item.remainingCostBasis=0;}
  if(calendarInvestmentEditPending&&!confirm('Confirma salvar? Isso mudará os valores registrados neste investimento e poderá alterar totais da carteira e relatórios.'))return;if(await mutate(()=>{const index=db.investments.findIndex(x=>x.id===item.id);if(index<0)db.investments.push(item);else db.investments[index]={...item,redemptions:db.investments[index].redemptions??[]};}))$('#investmentDialog').close();
}
$('#investmentForm').addEventListener('submit',saveInvestment);
$('#investmentCancel').addEventListener('click',()=>{calendarInvestmentEditPending=false;$('#investmentDialog').close()});$('#investmentDialog').addEventListener('close',()=>{calendarInvestmentEditPending=false});
document.addEventListener('click',async event=>{
  const edit=event.target.closest('[data-investment-edit]');
  if(edit)openInvestment(edit.dataset.investmentEdit,edit.dataset.existing==='true');
  const remove=event.target.closest('[data-investment-delete]');
  if(remove)removeInvestment(remove.dataset.investmentDelete);
});
function goals(){
 const m=month(),all=allSaved(),activeJars=db.jars.filter(j=>!j.archived&&!j.paused),pausedJars=db.jars.filter(j=>!j.archived&&j.paused),archivedJars=db.jars.filter(j=>j.archived),target=sum(activeJars.map(j=>j.target)),allCdb=sum(db.jars.filter(j=>!j.archived).map(j=>estimateCdbJar(j.id).net));
 const engineDb=goalEngineData(state.year,state.month),plan=Engines.goals(engineDb,state.year,state.month),required=activeJars.reduce((n,j)=>{const p=Engines.goal(engineDb,j,state.year,state.month),remaining=Math.max(0,j.target-estimateCdbJar(j.id).net-linkedInvestmentBalance(j.id));return n+(remaining===0?0:p.monthsRemaining?Math.ceil(remaining/p.monthsRemaining):0)},0);
 const budgetText=plan.estimatedRoom===null?'Registre pelo menos dois meses de receitas e despesas para comparar com sua disponibilidade.':plan.affordable?`Sobra estimada antes de guardar: ${money(plan.estimatedRoom)}. A soma mensal planejada cabe nessa estimativa.`:`Atenção: a soma necessária supera a sobra mensal estimada de ${money(plan.estimatedRoom)}.`;
 const annual=currentCdiAnnual(),latest=latestCdi();
 $('#page-goals').innerHTML=`${heading('Metas e cofrinhos','Acompanhe CDBs de bancos e cooperativas, registre aportes e estime o saldo atualizado pelo CDI.',`<div class="actions"><button class="btn" id="shareCdbPdfBtn">Baixar PDF</button><a class="btn" id="cdbPdfDownloadFallback" hidden download>Baixar PDF pronto</a><button class="btn primary" data-open="jar">${icon('plus')}Novo cofrinho</button></div>`)}<div class="cdi-banner"><div class="cdi-banner-main"><div class="cdi-title"><span class="tag soft">CDI aplicado conforme instituição</span><strong>${annual===null?'Taxa aguardando atualização':percent(annual)+' a.a. estimados'}</strong></div><p id="cdiStatus" aria-live="polite">${esc(cdiStatusText())}</p><small>Acumulação diária em dias úteis pela série oficial do Banco Central (SGS 12). O saldo líquido desconta IOF e IR estimados se resgatado hoje.</small></div><button type="button" class="btn" id="refreshCdiBtn" ${cdiState.loading?'disabled':''}>${cdiState.loading?'Atualizando…':'Atualizar CDI'}</button></div><div class="stats cdb-stats">${stat('Total aportado',money(all),'Até o mês selecionado, sem juros','piggy')}${stat('Saldo líquido estimado',money(allCdb),'Até '+cdiDateBR(isoToday())+' · CDI publicado até '+cdiDateBR(latest?.date),'wallet')}${stat('Mínimo deste mês',money(m.minimum),'10% da renda mensal','target')}${stat('Guardado no mês',money(m.saved),m.income?`${percent(m.rate)} da renda`:'Informe a renda para calcular %','wallet',m.income&&m.saved<m.minimum?'warn':'good')}${stat('Meta somada',money(target),`${activeJars.length} ${activeJars.length===1?'cofrinho ativo':'cofrinhos ativos'}`,'chart')}</div>
 ${activeJars.length?`<div class="plan-banner"><div><span class="overline">PLANEJAMENTO AUTOMÁTICO</span><h3>Para cumprir suas metas: ${money(required)} por mês</h3><p>${budgetText} O saldo atual considera os rendimentos calculados até a última taxa publicada.</p></div><div class="tag ${plan.delayed||plan.risky||plan.affordable===false?'warn':'soft'}">${plan.delayed?`${plan.delayed} atrasada(s)`:plan.risky?`${plan.risky} em risco`:'Acompanhamento de metas'}</div></div><article class="card simulator">${cardTitle('Simular minha economia','Escolha um cofrinho e teste qualquer valor mensal.')}
 <div class="simulator-fields"><div class="field"><label for="simGoal">Cofrinho</label><select id="simGoal">${activeJars.map(j=>`<option value="${esc(j.id)}">${esc(j.name)}</option>`).join('')}</select></div><div class="field"><label for="simAmount">Quanto posso guardar por mês (R$)</label><input id="simAmount" type="number" min="0" step="0.01" value="${esc(state.simAmount)}" inputmode="decimal"></div></div><div id="simResult" class="sim-result" aria-live="polite"></div></article><div class="goal-grid">${activeJars.map(j=>jarCard(j)).join('')}</div>`:pausedJars.length?`<div class="card"><div class="empty"><strong>Seu planejamento está pausado</strong>Retome uma meta quando quiser voltar a planejar aportes.<div style="margin-top:15px"><button class="btn primary" data-toggle-jar="${esc(pausedJars[0].id)}">Retomar plano</button></div></div></div>`:`<div class="card"><div class="empty"><strong>Comece criando sua primeira meta</strong>Ex.: reserva de emergência, viagem, faculdade ou compra importante.<div style="margin-top:15px"><button class="btn primary" data-open="jar">+ Criar meta</button></div></div></div>`}
 ${pausedJars.length?`<article class="card paused-goals">${cardTitle('Metas pausadas','O saldo e o histórico continuam registrados.')}<div class="goal-grid">${pausedJars.map(j=>jarCard(j)).join('')}</div></article>`:''}${archivedJars.length?`<details class="card archived-goals" open><summary>Cofrinhos arquivados (${archivedJars.length})</summary><div class="archived-goal-list">${archivedJars.map(j=>`<div><span><b>${esc(j.name)}</b><small>${money(estimateCdbJar(j.id).net)} estimados líquidos · histórico preservado</small></span><button class="btn small" data-restore-jar="${esc(j.id)}">Restaurar</button></div>`).join('')}</div></details>`:''}<article class="card">${cardTitle('Movimentações de '+monthLabel(),'Aportes, resgates e aplicações pela data registrada')}${movementsTable()}</article><div class="notice">Estimativa, não saldo bancário oficial. Os aportes e resgates são informados por você; a instituição e o percentual de CDI são configurados em Ajustes. O CDI futuro pode mudar. O app não acessa sua conta, não transfere dinheiro e não garante rendimento. Confirme o valor exato com a instituição antes de resgatar.</div>`;
 const simSelect=$('#simGoal');if(simSelect){if(state.simGoal&&[...simSelect.options].some(o=>o.value===state.simGoal))simSelect.value=state.simGoal;else state.simGoal=simSelect.value;$('#simAmount').value=state.simAmount;simulateGoal()}
 $('#page-goals .simulator')?.insertAdjacentHTML('afterend',`<div class="goal-support-card">${portfolioSummary()}</div>`);
 $('#page-goals').insertAdjacentHTML('beforeend',`<div class="goal-review-grid">${incomeReserveCard(m.records)}${emergencyReserveCard()}</div><details class="card insights-details" open><summary>Inflação e metas</summary>${inflationGoalCard()}</details><details class="card" id="planningSettingsDetails" open><summary>Referências de planejamento</summary><p>Defina o saldo usado na previsão de caixa e quantos meses de despesas deseja cobrir com a reserva.</p>${planningSettingsCard()}</details>`);
}
function simulateGoal(){const box=$('#simResult');if(!box)return;const j=db.jars.find(v=>v.id===$('#simGoal')?.value);if(!j){box.textContent='Selecione um cofrinho.';return}const p=Engines.goal(goalEngineData(state.year,state.month),j,state.year,state.month);const amount=Math.round(Math.max(0,Number($('#simAmount')?.value)||0)*100);if(!Number.isSafeInteger(amount)||amount>10000000000){box.textContent='Informe um valor válido.';return}const count=p.pending===0?0:amount?Math.ceil(p.pending/amount):null;const projected=count===null?null:new Date(state.year,state.month+Math.max(0,count-1),1);const dateText=projected?`${MONTHS[projected.getMonth()]} de ${projected.getFullYear()}`:'—';const deadline=new Date(j.dueDate+'T12:00:00');const onTime=p.pending===0||projected&&projected.getFullYear()*12+projected.getMonth()<=deadline.getFullYear()*12+deadline.getMonth();const atDeadline=Math.min(j.target,p.current+amount*p.monthsRemaining);box.innerHTML=`<div class="sim-result-grid"><div><span>Necessário para cumprir o prazo</span><strong>${p.perMonth===null?'Prazo vencido':money(p.perMonth)+'/mês'}</strong></div><div><span>Previsão com seu valor</span><strong>${p.pending===0?'Meta atingida':count===null?'Sem previsão':esc(dateText)}</strong></div><div><span>Quanto terá até o prazo</span><strong>${money(atDeadline)}</strong></div></div><p class="${onTime?'sim-good':'sim-alert'}">${p.pending===0?'Objetivo concluído.':count===null?'Informe um valor acima de zero para estimar a conclusão.':onTime?'Neste ritmo, você pode atingir a meta até o prazo.':'Neste ritmo, a meta tende a ultrapassar o prazo estabelecido.'} O saldo atual considera CDI já publicado; os aportes futuros não incluem juros futuros nem inflação.</p>`}
function syncMonthlyCloseChecklist(){const root=$('#monthlyCloseChecklist');if(!root)return;const key='reserva.monthlyClose.'+root.dataset.month;let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}root.querySelectorAll('[data-close-check]').forEach(input=>{input.checked=!!saved[input.dataset.closeCheck]});const done=Object.values(saved).filter(Boolean).length;const progress=root.querySelector('[data-close-progress]');if(progress)progress.textContent=`${done} de 4 etapas concluídas`;}
function dailyReportCard(today=isoToday()){
 const current=new Date(state.year,state.month,1),previous=new Date(state.year,state.month-1,1);
 const balances=date=>{
   const y=date.getFullYear(),m=date.getMonth();
   const daily=new Map();
   for(const [day,items] of calendarEventsForMonth(y,m)){
     daily.set(Number(day.slice(-2)),sum(items.filter(item=>['record','allocation','investment'].includes(item.source)&&Number.isSafeInteger(item.value)).map(item=>item.value)));
   }
   let total=0;
   return Array.from({length:new Date(y,m+1,0).getDate()},(_,day)=>total+=daily.get(day+1)||0);
 };
 const now=balances(current),before=balances(previous),period=mkey(state.year,state.month);
 const lastDay=period===today.slice(0,7)?Number(today.slice(8)):now.length;
 const rows=(from,to)=>Array.from({length:to-from+1},(_,index)=>{
   const day=to-index;
   return `<tr><th scope="row">${day}</th><td>${money(now[day-1])}</td><td>${day<=before.length?money(before[day-1]):'—'}</td></tr>`;
 }).join('');
 const table=body=>`<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Dia</th><th scope="col">${esc(monthLabel())}</th><th scope="col">${MONTHS[previous.getMonth()]} de ${previous.getFullYear()}</th></tr></thead><tbody>${body}</tbody></table></div>`;
 const first=Math.max(1,lastDay-9);
 return `<article class="card report-daily-card">${cardTitle('Saldo dia a dia','Saldo acumulado no mês a partir de R$ 0, com comparação com o mês anterior.')}
 ${table(rows(first,lastDay))}
 ${first>1||lastDay<now.length?`<details class="report-daily-details"><summary>Ver todos os ${now.length} dias do mês</summary>${table(rows(1,now.length))}</details>`:''}</article>`;
}
function expenseComparisonCards(monthData){
 const history=Array.from({length:3},(_,index)=>{
   const date=new Date(state.year,state.month-index-1,1);
   return new Map(horizontalCategories(getMonth(date.getFullYear(),date.getMonth()).records));
 });
 const current=new Map(horizontalCategories(monthData.records));
 const categories=[...new Set([...current.keys(),...history.flatMap(period=>[...period.keys()])])];
 const expenses=monthData.records.filter(record=>record.kind==='expense');
 const fixed=sum(expenses.filter(record=>record.recurringId).map(record=>record.amount));
 const biggest=[...expenses].sort((a,b)=>b.amount-a.amount).slice(0,5);
 return `<article class="card">${cardTitle('Comparativo por categoria','Mês selecionado e média dos três meses anteriores. Meses sem registros entram como zero.')}
 ${categories.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Categoria</th><th>Mês</th><th>Média</th><th>Diferença</th></tr></thead><tbody>${categories.map(category=>{
 const amount=current.get(category)||0,average=Math.round(sum(history.map(period=>period.get(category)||0))/3);
 return `<tr><th scope="row">${esc(category)}</th><td>${money(amount)}</td><td>${money(average)}</td><td>${money(amount-average)}</td></tr>`;
 }).join('')}</tbody></table></div>`:'<div class="empty-inline">Sem despesas registradas no período comparado.</div>'}</article>
 <article class="card">${cardTitle('Gastos fixos e variáveis','Despesas recorrentes registradas entram como fixas. As demais entram como variáveis.')}
 <p>Fixos: <strong>${money(fixed)}</strong> · Variáveis: <strong>${money(sum(expenses.map(record=>record.amount))-fixed)}</strong></p>
 <h3>Maiores gastos do mês</h3>${biggest.length?`<ol>${biggest.map(record=>`<li>${esc(record.note||record.category)} · ${dateBR(record.date)} · <strong>${money(record.amount)}</strong></li>`).join('')}</ol>`:'<div class="empty-inline">Sem despesas neste mês.</div>'}</article>`;
}
function reports(){
 const m=month(),yearMonths=yearly(state.year),income=sum(yearMonths.map(x=>x.income)),expenses=sum(yearMonths.map(x=>x.expenses)),net=income-expenses,reserve=sum(yearMonths.map(x=>x.saved)),cats=horizontalCategories(m.records),total=sum(cats.map(x=>x[1]));
 $('#page-reports').innerHTML=heading('Relatórios','Acompanhe sua vida financeira e gere relatórios em PDF.')+dailyReportCard()+
 '<div class="stats report-stats">'+stat('Receitas do mês',money(m.income),monthLabel(),'income')+stat('Despesas do mês',money(m.expenses),monthLabel(),'expense')+stat('Saldo do mês',money(m.income-m.expenses),'Receitas menos despesas','wallet')+'</div>'+
 '<div class="report-columns"><div class="report-stack">'+
 '<article class="card report-period-card"><h2>Gerar relatório financeiro</h2><p>Escolha o período. O PDF inclui receitas, despesas, categorias, compromissos e o resumo do período.</p><input type="hidden" id="globalPdfScope" value="month"><div class="pdf-period-options" role="group" aria-label="Período do relatório"><button type="button" class="btn selected" data-pdf-scope="month" aria-pressed="true">Este mês</button><button type="button" class="btn" data-pdf-scope="year" aria-pressed="false">Ano atual</button><button type="button" class="btn" data-pdf-scope="all" aria-pressed="false">Histórico completo</button></div><div class="report-period-actions"><button class="btn primary" id="globalPdfBtn">Gerar PDF</button><a class="btn" id="pdfDownloadFallback" hidden download>Baixar PDF pronto</a></div></article>'+
 '<article class="card report-overview-card"><div class="card-head"><div><h2>Visão anual · '+state.year+'</h2><p>Acumulado desde janeiro</p></div></div><div class="report-annual-stats"><div><small>Receitas</small><strong>'+money(income)+'</strong></div><div><small>Despesas</small><strong>'+money(expenses)+'</strong></div><div><small>Saldo</small><strong class="'+(net<0?'danger-text':'')+'">'+money(net)+'</strong></div><div><small>Reserva</small><strong>'+money(reserve)+'</strong><small>'+(income>0?percent(reserve/income*100)+' da renda':'Sem renda registrada')+'</small></div></div></article>'+
 '<article class="card report-year-chart">'+cardTitle('Fluxo ao longo do ano',String(state.year))+yearChart()+'</article>'+
 '</div><div class="report-stack">'+
 '<article class="card monthly-close-card"><div class="card-head"><div><h2>Fechamento do mês</h2><p>Checklist local para conferir os números antes de arquivar o relatório.</p></div></div><div id="monthlyCloseChecklist" data-month="'+mkey(state.year,state.month)+'"><label><input type="checkbox" data-close-check="income"> Conferi as receitas</label><label><input type="checkbox" data-close-check="expense"> Conferi as despesas</label><label><input type="checkbox" data-close-check="bills"> Revisei vencimentos e recorrências</label><label><input type="checkbox" data-close-check="pdf"> GereI o PDF do mês</label><p class="help" data-close-progress></p><button type="button" class="btn small" data-close-reset>Limpar checklist</button></div></article>'+
 '</div></div>'+
 '<article class="card report-categories-card"><h2>Despesas por categoria · '+esc(monthLabel())+'</h2>'+ (cats.length?'<div class="report-category-list">'+cats.map(([name,amount])=>'<button type="button" data-home-report-category="'+esc(name)+'"><span>'+esc(name)+'</span><span class="report-category-track"><i style="width:'+Math.max(4,amount/cats[0][1]*100)+'%;background:'+(CAT_COLORS[CATS.indexOf(name)]||'#8c9bab')+'"></i></span><strong>'+money(amount)+'</strong><small>'+percent(amount/total*100)+'</small></button>').join('')+'</div>':'<div class="empty-inline">Sem despesas neste mês para resumir.</div>')+'</article>';
 syncMonthlyCloseChecklist();
}

function monthlyInsightCards(m,categories){
 const target=Math.round(m.complement/10), invested=Math.max(0,m.invested-m.redeemed);
 const previousDate=new Date(state.year,state.month-1,1), now=new Date();
 const currentMonth=state.year===now.getFullYear()&&state.month===now.getMonth();
 const through=currentMonth?now.getDate():31;
 const comparable=rows=>horizontalCategories(rows.filter(r=>Number(r.date.slice(8,10))<=through));
 const previous=new Map(comparable(getMonth(previousDate.getFullYear(),previousDate.getMonth()).records));
 const rises=comparable(m.records).filter(([name])=>previous.has(name)).map(([name,amount])=>[name,amount-previous.get(name)]).filter(([,rise])=>rise>0).sort((a,b)=>b[1]-a[1]).slice(0,3);
 const category=categories[0];
 const cash=cashProjection(30), shortfall=cash&&Object.entries(cash.dailyBalances).find(([,balance])=>balance<0);
 return `
 <article class="card desktop-pair">${cardTitle('Economia possível','Simulação sobre os gastos do mês selecionado')}
 ${category?`<p>Reduzir gastos em <strong>${esc(category[0])}</strong> em 5%, 10% ou 15% liberaria ${[.05,.1,.15].map(rate=>money(Math.round(category[1]*rate))).join(' / ')}.</p><button class="btn small" data-home-report-category="${esc(category[0])}">Ver gastos da categoria</button>`:'<p>Registre despesas para simular a economia.</p>'}
 ${rises.length?`<p>Maiores aumentos frente ao mês anterior${currentMonth?' até o mesmo dia':''}</p><ul>${rises.map(([name,rise])=>`<li>${esc(name)} · +${money(rise)}</li>`).join('')}</ul>`:'<p>Sem aumentos nas categorias com registros nos dois períodos.</p>'}</article>
 <article class="card desktop-pair">${cardTitle('10% da renda complementar','Comparação com as aplicações líquidas do mês')}
 ${m.complement>0?`<p>Renda complementar <strong>${money(m.complement)}</strong> · meta <strong>${money(target)}</strong></p><p>Aplicações após resgates <strong>${money(invested)}</strong> · falta estimada <strong>${money(Math.max(0,target-invested))}</strong></p><p class="help">A comparação usa todas as aplicações líquidas do mês. O app não identifica a origem do dinheiro aplicado.</p><button class="btn small" data-page="investments">Abrir investimentos</button>`:'<p>Sem renda complementar registrada neste mês.</p>'}</article>
 <article class="card desktop-pair">${cardTitle('Risco de caixa','Próximos 30 dias a partir de hoje')}
 ${!cash?'<p>Configure o saldo de referência para calcular a previsão.</p><button class="btn small" data-page="goals" data-open-planning="1">Configurar saldo</button>':shortfall?`<p>Primeiro saldo negativo previsto em <strong>${dateBR(shortfall[0])}</strong>. Faltariam ${money(-shortfall[1])} nesse dia.</p>`:'<p>Sem saldo negativo previsto nas movimentações conhecidas.</p>'}</article>`;
}
function insightsReviewCards(m,categories){
 const previousDate=new Date(state.year,state.month-1,1),previousKey=mkey(previousDate.getFullYear(),previousDate.getMonth()),currentKey=mkey(state.year,state.month);
 const recurringChanges=db.recurring.filter(item=>item.kind==='expense'&&!item.paused).map(item=>{const before=db.records.filter(r=>r.kind==='expense'&&r.recurringId===item.id&&(r.recurringMonth||r.date.slice(0,7))===previousKey).reduce((n,r)=>n+r.amount,0);const now=db.records.filter(r=>r.kind==='expense'&&r.recurringId===item.id&&(r.recurringMonth||r.date.slice(0,7))===currentKey).reduce((n,r)=>n+r.amount,0);const current=now;return{name:item.note||item.category||'Conta recorrente',before,current,delta:current-before}}).filter(x=>x.before>0&&x.delta>0).sort((x,y)=>y.delta-x.delta).slice(0,4);
 const goals=db.jars.filter(j=>!j.archived&&!j.paused).map(j=>{const plan=Engines.goal(goalEngineData(state.year,state.month),j,state.year,state.month);return{name:j.name,plan,status:plan.status}}).filter(x=>['atrasada','em_risco'].includes(x.status)||x.plan.monthlyPace!==null&&x.plan.perMonth!==null&&x.plan.monthlyPace<x.plan.perMonth).slice(0,4);
 const uncategorized=m.records.filter(r=>r.kind==='expense'&&(!String(r.category||'').trim()||/^(sem categoria|não categorizado)$/i.test(String(r.category).trim())));
 const groups=new Map();for(const r of m.records){const desc=String(r.note||r.description||'').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');if(!desc||!r.kind||!r.amount)continue;const key=[r.date,r.kind,r.amount,desc].join('|');const group=groups.get(key)||[];group.push(r);groups.set(key,group)}const duplicates=[...groups.values()].filter(g=>g.length>1);
 return '<article class="card desktop-pair">'+cardTitle('Contas fixas que aumentaram','Comparação com o mês anterior')+(recurringChanges.length?'<ul>'+recurringChanges.map(x=>'<li>'+esc(x.name)+' · '+money(x.before)+' → '+money(x.current)+' (+'+money(x.delta)+')</li>').join('')+'</ul>':'<p>Sem aumento confirmado nas contas recorrentes deste período.</p>')+'</article>'+
 '<article class="card desktop-pair">'+cardTitle('Metas fora do ritmo','Metas atrasadas ou com aporte abaixo do necessário')+(goals.length?'<ul>'+goals.map(x=>'<li>'+esc(x.name)+' · '+(x.status==='atrasada'?'prazo vencido':x.status==='em_risco'?'em risco':'ritmo abaixo do necessário')+'</li>').join('')+'</ul>':'<p>As metas ativas estão no ritmo calculado ou ainda aguardam histórico.</p>')+'<button class="btn small" data-page="goals">Ver metas</button></article>'+
 '<article class="card desktop-pair">'+cardTitle('Revisar antes do fechamento','Categorias ausentes e possíveis lançamentos repetidos')+(uncategorized.length?'<p>'+uncategorized.length+' lançamento(s) sem categoria informada.</p>':'<p>Todos os lançamentos do período têm categoria.</p>')+(duplicates.length?'<p>'+duplicates.length+' grupo(s) com data, tipo, valor e descrição iguais. Confira antes de fechar.</p>':'<p>Nenhum possível duplicado idêntico encontrado neste período.</p>')+'<button class="btn small" data-page="transactions">Revisar lançamentos</button></article>';
}

function paydayPaceCard(m) {
 const today = isoToday(), now = new Date();
 if (today.slice(0,7) !== mkey(state.year,state.month)) return '';
 const received = m.records.filter(r=>r.kind==='income' && r.date<=today);
 const salary = sum(received.filter(r=>r.source==='salary').map(r=>r.amount));
 const spent = sum(m.records.filter(r=>r.kind==='expense' && r.date<=today).map(r=>r.amount));
 const futureIncome = sum(m.records.filter(r=>r.kind==='income' && r.date>today).map(r=>r.amount));
 const pendingBills = sum(pendingRecurring().filter(r=>r.kind!=='income').map(r=>r.amount));
 const key=mkey(state.year,state.month);
 const futureRedemptions=sum(db.investments.flatMap(item=>item.redemptions||[]).filter(r=>r.date>today&&r.date.slice(0,7)===key).map(r=>r.amount));
 const futureWithdrawals=sum(db.allocations.filter(r=>r.amount<0&&r.date>today&&r.date.slice(0,7)===key).map(r=>r.netReceived??-r.amount));
 const remaining = m.balance - futureIncome - futureRedemptions - futureWithdrawals - pendingBills;
 const days = new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate()+1;
 const daily = Math.floor(Math.max(0,remaining)/days);
 const salaryShare = salary ? `<p>As despesas já registradas equivalem a <strong>${percent(spent/salary*100)}</strong> do salário recebido neste mês.</p>` : '<p>Registre o salário recebido para acompanhar quanto dele as despesas representam.</p>';
 return `<article class="card payday-pace">${cardTitle('Limite diário até o fim do mês','Estimativa com o dinheiro já recebido')}
 <strong class="payday-value">${money(daily)} por dia</strong>
 ${salaryShare}
 <p>Contas recorrentes ainda não lançadas: ${money(pendingBills)}.</p>
 ${remaining<0?`<p class="danger-text">Faltam ${money(-remaining)} para cobrir as saídas registradas e as contas pendentes. Pause novas compras opcionais e confira os vencimentos.</p>`:'<p>Antes de uma compra opcional, compare o preço com o limite do dia.</p>'}
 <p class="help">O cálculo desconta saídas registradas e contas recorrentes pendentes. Receitas futuras ficam fora da estimativa.</p>
 <button class="btn small" data-page="transactions">Conferir gastos</button></article>`;
}
const RESERVE_INCOME_IGNORED_KEY='reserva.insights.reserveIncomeIgnored.v1';
const RESERVE_INCOME_DISCARDED_KEY='reserva.insights.reserveIncomeDiscarded.v1';
function reserveIncomeIds(key){
 try{const value=JSON.parse(localStorage.getItem(key)||'[]');return new Set(Array.isArray(value)?value.map(String):[])}
 catch{return new Set()}
}
function setReserveIncomeState(key,id,enabled){
 const ids=reserveIncomeIds(key);
 if(enabled)ids.add(String(id));else ids.delete(String(id));
 try{localStorage.setItem(key,JSON.stringify([...ids]));return true}
 catch{notify('Não foi possível salvar a alteração do lembrete neste navegador.');return false}
}
function refreshIgnoredReserveList(){
 const before=$('.reserve-ignored-list'),scrollTop=before?.scrollTop||0;
 render();
 const details=$('.reserve-ignored');
 if(!details){$('#pageTitle')?.focus();return}
 details.open=true;
 const list=details.querySelector('.reserve-ignored-list');
 list.focus({preventScroll:true});
 list.scrollTop=scrollTop;
}
function incomeReserveStatus(record){
 const target=Math.round(record.amount/10);
 const saved=sum(db.investments.filter(item=>item.incomeRecordId===record.id&&item.date<=isoToday()).map(item=>Math.max(0,item.cost-sum((item.redemptions||[]).filter(r=>r.date<=isoToday()).map(r=>r.amount)))));
 return {target,saved,remaining:Math.max(0,target-saved)};
}
function incomeReserveCard(records){
 const discardedIds=reserveIncomeIds(RESERVE_INCOME_DISCARDED_KEY),ignoredIds=reserveIncomeIds(RESERVE_INCOME_IGNORED_KEY);
 const entries=records.filter(r=>r.kind==='income'&&r.date<=isoToday()&&!discardedIds.has(String(r.id)));
 if(!entries.length)return '';
 const active=entries.filter(r=>!ignoredIds.has(String(r.id))),ignored=entries.filter(r=>ignoredIds.has(String(r.id))).sort((a,b)=>b.date.localeCompare(a.date));
 const cards=active.map(r=>{
   const status=incomeReserveStatus(r);
   const places=db.investments.filter(item=>item.incomeRecordId===r.id).map(item=>esc(item.institution)).join(', ');
   return '<div class="soft-tip"><strong>'+(r.source==='salary'?'Salário':'Complemento')+' · '+dateBR(r.date)+'</strong><p>Meta '+money(status.target)+' · guardado '+money(status.saved)+(places?' em '+places:'')+'</p>'+
    (status.remaining?'<p>Falta '+money(status.remaining)+'</p><button type="button" class="btn small" data-reserve-income="'+esc(r.id)+'">Registrar novo aporte</button> <button type="button" class="btn small" data-link-reserve-income="'+esc(r.id)+'">Vincular investimento existente</button> <button type="button" class="btn small" data-ignore-reserve-income="'+esc(r.id)+'">Ignorar por enquanto</button>':'<p>Meta atingida</p>')+'</div>';
 }).join('');
 const dismissed=ignored.length?`<details class="reserve-ignored"><summary>Lembretes ignorados (${ignored.length})</summary>
   <div class="reserve-ignored-list" role="region" aria-label="Lista de lembretes ignorados" tabindex="0">
     ${ignored.map(r=>`<div class="reserve-ignored-item">
       <strong>${r.source==='salary'?'Salário':'Complemento'} · ${dateBR(r.date)}</strong>
       <div class="actions">
         <button type="button" class="btn small" data-restore-reserve-income="${esc(r.id)}">Reativar</button>
         <button type="button" class="btn small negative" data-discard-reserve-income="${esc(r.id)}">Descartar</button>
       </div>
     </div>`).join('')}
   </div></details>`:'';

 return '<article class="card" id="incomeReserveCard">'+cardTitle('Você guardou 10% de cada recebimento?','Vincule um aporte ao recebimento ou registre um novo investimento.')+(cards||'<p class="help">Todos os lembretes deste período estão ignorados.</p>')+dismissed+'</article>';
}
function showExistingReserveInvestments(record){
 const remaining=incomeReserveStatus(record).remaining;
 const candidates=db.investments.filter(item=>item.status!=='sold'&&!item.incomeRecordId&&item.date<=isoToday()&&item.cost>0);
 let dialog=$('#reserveInvestmentDialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='reserveInvestmentDialog';dialog.className='calendar-day-dialog';document.body.append(dialog)}
 dialog.innerHTML='<div class="calendar-day-dialog-top"><strong>Vincular investimento existente</strong><button type="button" data-close-reserve-dialog>Fechar</button></div><p>Vincular associa uma aplicação completa à reserva deste recebimento, sem criar outro investimento nem alterar os valores da carteira. Confira o nome, a instituição e a data: cada aplicação só pode ser vinculada a um recebimento para evitar contagem duplicada.</p><div class="calendar-day-dialog-content">'+(candidates.length?candidates.map(item=>'<button type="button" class="btn" data-select-reserve-investment="'+esc(item.id)+'"><strong>'+esc(item.name)+'</strong><br>'+esc(item.institution)+' · '+money(item.cost)+' · '+dateBR(item.date)+'</button>').join(''):'<p>Não encontrei aplicação sem vínculo registrada até hoje. Aplicações já vinculadas ficam bloqueadas para evitar contagem duplicada.</p>')+'</div>';
 dialog.dataset.incomeId=record.id;dialog.showModal();
}
document.addEventListener('click',async event=>{
 const close=event.target.closest('[data-close-reserve-dialog]');
 if(close){$('#reserveInvestmentDialog')?.close();return}
 const select=event.target.closest('[data-select-reserve-investment]');
 if(select){
  const dialog=$('#reserveInvestmentDialog'),record=db.records.find(r=>r.id===dialog?.dataset.incomeId),item=db.investments.find(x=>x.id===select.dataset.selectReserveInvestment);
  if(!record||record.kind!=='income'||!item||item.incomeRecordId||item.status==='sold'||item.cost<=0||item.date>isoToday()||incomeReserveStatus(record).remaining<=0)return notify('A carteira ou a meta mudou. Atualizei as opções para evitar duplicidade.');
  if(await mutate(()=>{item.incomeRecordId=record.id}))dialog.close();
  return;
 }
 const ignore=event.target.closest('[data-ignore-reserve-income]');
 if(ignore){
  if(setReserveIncomeState(RESERVE_INCOME_IGNORED_KEY,ignore.dataset.ignoreReserveIncome,true)){
   render();notify('Lembrete pausado. Você pode reativá-lo em Lembretes ignorados.');
  }
  return;
 }
 const restore=event.target.closest('[data-restore-reserve-income]');
 if(restore){
  if(setReserveIncomeState(RESERVE_INCOME_IGNORED_KEY,restore.dataset.restoreReserveIncome,false)){
   refreshIgnoredReserveList();notify('Lembrete reativado.');
  }
  return;
 }
 const discard=event.target.closest('[data-discard-reserve-income]');
 if(discard){
  if(setReserveIncomeState(RESERVE_INCOME_DISCARDED_KEY,discard.dataset.discardReserveIncome,true)){
   refreshIgnoredReserveList();notify('Lembrete descartado.');
  }
  return;
 }
 const link=event.target.closest('[data-link-reserve-income]');
 if(link){const record=db.records.find(r=>r.kind==='income'&&r.id===link.dataset.linkReserveIncome);if(record&&incomeReserveStatus(record).remaining>0)showExistingReserveInvestments(record);return}
 const button=event.target.closest('[data-reserve-income]');
 if(!button)return;
 const record=db.records.find(r=>r.kind==='income'&&r.id===button.dataset.reserveIncome);
 if(record&&incomeReserveStatus(record).remaining>0)openInvestment('',false,record);
});
function insightPriorities(monthData){
  const items=[];
  const bills=upcomingBillInstances(7);
  if(bills.length){
    const late=bills.filter(bill=>bill.daysLate).length;
    items.push({title:late?'Revise as contas vencidas':'Planeje os próximos pagamentos',
      text:late?`${late} conta(s) vencida(s) nos últimos 30 dias.`:`${bills.length} conta(s) previstas para os próximos sete dias.`,
      target:'budgetDueCard',action:'Ver contas a pagar',tone:late?'danger':'neutral'});
  }
  const budgets={...db.prefs.categoryBudgets};
  if(db.prefs.marketBudget)budgets.Mercado=db.prefs.marketBudget;
  const watched=horizontalCategories(monthData.records).filter(([category,amount])=>{
    const limit=budgets[category],threshold=category==='Mercado'?.75:.8;
    return limit>0&&amount>=limit*threshold;
  });
  if(watched.length){
    const [category,amount]=watched[0],ratio=percent(amount/budgets[category]*100);
    items.push({title:'Confira o limite de '+category,text:`${ratio} do limite mensal já usado.`,
      target:category==='Mercado'?'marketBudgetCard':'categoryBudgetCard',action:'Revisar limites',tone:amount>=budgets[category]?'danger':'neutral'});
  }
  if(monthData.income>0&&monthData.expenses>monthData.income){
    items.push({title:'Reveja as despesas do mês',text:'As despesas superam as receitas em '+money(monthData.expenses-monthData.income)+'.',
      target:'budgetSpendingCard',action:'Ver gastos por categoria',tone:'danger'});
  }
  const hasActivity=monthData.records.length>0;
  if(hasActivity){
    items.push({title:'Confira os números do mês',text:'Revise receitas, despesas e vencimentos antes de arquivar o relatório.',
      route:'reports',action:'Abrir fechamento',tone:'neutral'});
  }
  if(!items.length){
    items.push({title:'Comece pelos lançamentos',text:'Registre receitas e despesas para receber sugestões baseadas no seu mês.',
      route:'transactions',action:'Abrir lançamentos',tone:'neutral'});
  }
  return `<section class="card insight-priorities">${cardTitle('Próximas ações','Sugestões com base nos registros e nas contas previstas.')}
    <div class="insight-priorities-grid">${items.slice(0,3).map(item=>`<article class="insight-priority ${item.tone}">
      <h3>${esc(item.title)}</h3><p>${esc(item.text)}</p>
      <button type="button" class="btn small" ${item.target?'data-budget-target="'+item.target+'"':item.route==='reports'?'data-insight-close':'data-page="'+item.route+'"'}>${esc(item.action)}</button>
    </article>`).join('')}</div></section>`;
}
function analysis(){
 const m=month();
 const result=Engines.insights(goalEngineData(state.year,state.month),state.year,state.month),pred=result.projection,cats=horizontalCategories(m.records);
 const withHistory=pred.afterMinimum!==null;
 const projectionCard=withHistory?`<div class="prediction-grid"><div><span>Renda provável</span><strong>${money(pred.income)}</strong></div><div><span>Despesas prováveis</span><strong>${money(pred.expenses)}</strong></div><div><span>Sobra após guardar 10%</span><strong class="${pred.afterMinimum<0?'danger-text':''}">${money(pred.afterMinimum)}</strong></div></div><p class="help">Estimativa ${pred.level}. Usa os meses fechados ${pred.monthsUsed.map(k=>{const [y,m]=k.split('-');return MONTHS[Number(m)-1]+' de '+y}).join(', ')}. Método: mediana das rendas e despesas dos mesmos meses. Não é garantia de saldo futuro.</p>`:`<div class="empty"><strong>Histórico ainda insuficiente</strong>Cadastre receitas e despesas de pelo menos dois meses para estimar o próximo mês.</div>`;
 const notices=result.items.slice().sort((a,b)=>({critical:0,attention:1,positive:2,info:3})[a.kind]-({critical:0,attention:1,positive:2,info:3})[b.kind]);
 $('#page-analysis').innerHTML=`
 ${insightPriorities(m)}
 <div class="stats">${stat('Entradas do mês',money(m.income),monthLabel(),'income')}${stat('Despesas do mês',money(m.expenses),monthLabel(),'expense')}${stat('Saldo disponível',money(m.balance),'Após despesas, cofrinhos e novos investimentos','wallet')}</div>
 <div class="insights-compact-grid insights-overview-grid">
   <article class="card">${cardTitle('Alertas e sugestões','Comparações e orientações baseadas apenas nos lançamentos')}${notices.length?`<div class="insight-grid">${notices.map(v=>`<div class="insight engine-${v.kind}"><strong>${esc(v.title)}</strong><p>${esc(v.message)}</p></div>`).join('')}</div>`:'<div class="empty">Registre suas movimentações para começar a receber análises.</div>'}</article>
   <article class="card">${cardTitle('Reserva dos recebimentos','Acompanhe os aportes e gerencie os lembretes de 10%.')}<button type="button" class="btn small" data-open-income-reserve>Ver em Metas</button></article>
 </div>
 <details class="card insights-extras" ${matchMedia("(min-width: 761px)").matches?"open":""}><summary>Economia e pontos de atenção</summary><div class="insights-extras-grid">
 ${insightsReviewCards(m,cats)}
 ${monthlyInsightCards(m,cats)}</div></details>
 <details class="card insights-details"><summary>Análises de renda e projeção</summary><div class="insights-compact-grid"><article class="card">${cardTitle('De onde vem a renda',monthLabel())}<div class="bar-list">${m.income?`<div><div class="bar-label"><span>Salário</span><b>${money(m.salary)} · ${percent(m.salary/m.income*100)}</b></div><div class="bar-track"><span style="width:${m.salary/m.income*100}%;background:#3488f5"></span></div></div><div><div class="bar-label"><span>Complemento</span><b>${money(m.complement)} · ${percent(m.complement/m.income*100)}</b></div><div class="bar-track"><span style="width:${m.complement/m.income*100}%;background:#7a75e7"></span></div></div>`:'<div class="empty">Adicione salário ou complemento para visualizar.</div>'}</div></article>
 ${withHistory?`<article class="card">${cardTitle('Previsão para o próximo mês','Estimativa com base no histórico')}${projectionCard}</article>`:''}
 </div></details>`;
}
function htmlReportToModel(html){
  const doc=new DOMParser().parseFromString(html,'text/html'),clean=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  const title=clean(doc.querySelector('h1'))||'Relatório financeiro';
  const subtitles=[...doc.querySelectorAll('header p,.muted')].map(clean).filter(Boolean);
  const summaries=[...doc.querySelectorAll('.pdf-totals article,.summary>div')].map(node=>{
    const label=clean(node.querySelector('span'))||clean(node).replace(clean(node.querySelector('strong,b')),'').trim();
    const value=clean(node.querySelector('strong,b'));
    return {label:label||'Resumo',value:value||clean(node)};
  });
  const sections=[];
  doc.querySelectorAll('section').forEach(section=>{
    const heading=clean(section.querySelector('h2'))||'Detalhes';
    const table=section.querySelector('table');
    if(!table){const p=section.querySelector('p');sections.push({heading,rows:[[clean(p)||'Sem registros.']]});return}
    sections.push({heading,rows:[...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(clean)).filter(row=>row.length)});
  });
  doc.querySelectorAll('table').forEach(table=>{if(table.closest('section'))return;sections.push({heading:'Detalhamento',rows:[...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(clean)).filter(row=>row.length)})});
  doc.querySelectorAll('.notes').forEach(node=>sections.push({heading:'Observações',rows:[[clean(node)]]}));
  if(!sections.length)sections.push({heading:'Detalhes',rows:[[clean(doc.body)||'Sem dados para exibir.']]});
  return {title,subtitle:subtitles.find(x=>/Emitido|Gerado|Estimativa/i.test(x))||subtitles[0]||'Relatório financeiro',summaries,sections};
}
function downloadPdfReport(title,html,targetDocument=document,targetWindow=window,fallbackId='pdfDownloadFallback'){
  const cp1252={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
  const hex=value=>[...String(value)].map(char=>{const code=char.codePointAt(0),byte=code<128||code>=160&&code<=255?code:cp1252[char]??63;return byte.toString(16).padStart(2,'0')}).join('').toUpperCase();
  const model=htmlReportToModel(html),W=842,H=595,left=36,right=36,usable=W-left-right,bottom=38;
  const blue='0.09 0.29 0.56',light='0.92 0.95 0.99',muted='0.36 0.42 0.50',ink='0.10 0.15 0.22',line='0.82 0.86 0.91';
  const pages=[];let ops=[],y=0,pageNo=0;
  const text=(x,top,value,size=8,color=ink,bold=false)=>{ops.push(`${color} rg BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(H-top).toFixed(2)} Tm <${hex(value)}> Tj ET`)};
  const rect=(x,top,w,h,color)=>ops.push(`${color} rg ${x.toFixed(2)} ${(H-top-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const rule=(x1,top,x2,color=line,width=.6)=>ops.push(`${color} RG ${width} w ${x1.toFixed(2)} ${(H-top).toFixed(2)} m ${x2.toFixed(2)} ${(H-top).toFixed(2)} l S`);
  const beginPage=first=>{ops=[];pageNo++;rect(0,0,W,8,blue);text(left, 34, 'RESERVA SIMPLES', 10, blue,true);text(left, 53, first?model.title:title, 18, ink,true);text(left, 69, model.subtitle, 8, muted);text(W-right-66,35,`PÁGINA ${pageNo}`,7,muted);rule(left,78,W-right,blue,1.2);y=94;
    if(first&&model.summaries.length){const count=Math.min(4,model.summaries.length),gap=10,cw=(usable-gap*(count-1))/count;model.summaries.slice(0,count).forEach((item,i)=>{const x=left+i*(cw+gap);rect(x,y,cw,46,light);rect(x,y,3,46,blue);text(x+12,y+17,item.label.slice(0,48),7,muted);text(x+12,y+35,item.value.slice(0,42),12,blue,true)});y+=60;}
  };
  const finishPage=()=>{rule(left,H-27,W-right,line,.6);text(left,H-18,'Reserva Simples · Relatório gerado pelo aplicativo',7,muted);text(W-right-52,H-18,`${pageNo}`,7,muted);pages.push(ops.join('\n'))};
  const newPage=()=>{finishPage();beginPage(false)};
  const wrap=(value,max)=>{const words=String(value||'—').split(/\s+/),out=[];let line='';for(const word0 of words){let word=word0;while(word.length>max){if(line){out.push(line);line=''}out.push(word.slice(0,max));word=word.slice(max)}const test=line?line+' '+word:word;if(test.length>max){out.push(line);line=word}else line=test}if(line)out.push(line);return out.length?out:['—']};
  beginPage(true);
  for(const section of model.sections){
    if(y>H-bottom-46)newPage();
    y+=5;text(left,y,section.heading,11,blue,true);y+=10;rule(left,y,W-right,line,.8);y+=8;
    const rows=section.rows||[];if(!rows.length){text(left,y,'Sem registros.',8,muted);y+=18;continue}
    const n=Math.max(1,...rows.map(r=>r.length)),headers=rows[0];
    const weights=Array.from({length:n},(_,i)=>{const h=(headers[i]||'').toLowerCase();return /descri|observ|aplica|institui|categoria|produto|cofrinho|meta|nome/.test(h)?1.65:/data|tipo|situa|prazo|confer|débito|dia|início|fim/.test(h)?0.9:/valor|saldo|receita|despesa|aporta|rendimento|líquido|objetivo|principal|ir est|iof/.test(h)?1.0:1.12});const total=weights.reduce((a,b)=>a+b,0),widths=weights.map(w=>usable*w/total);
    const renderRow=(cells,index,header=false)=>{const wrapped=cells.map((cell,i)=>wrap(cell,Math.max(7,Math.floor((widths[i]||usable/n)/(header?4.2:4.0)))));const lines=Math.max(1,...wrapped.map(v=>v.length));const rh=Math.max(header?21:18,lines*(header?8:8.3)+7);if(y+rh>H-bottom){newPage();if(!header)renderRow(headers,0,true)}if(header){rect(left,y,usable,rh,blue)}else if(index%2===0){rect(left,y,usable,rh,'0.97 0.98 0.99')};let x=left;for(let i=0;i<n;i++){const cellLines=wrapped[i]||[''];for(let li=0;li<cellLines.length;li++){text(x+5,y+12+li*8,cellLines[li],header?6.7:7,header?'1 1 1':ink,header)}x+=widths[i]||usable/n}if(!header)rule(left,y+rh,W-right,line,.35);y+=rh};
    renderRow(headers,0,true);for(let ri=1;ri<rows.length;ri++)renderRow(rows[ri],ri,false);y+=12;
  }
  finishPage();
  const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];const pageIds=[];
  for(const content of pages){const pageId=objects.length;pageIds.push(pageId);const contentId=pageId+1;const stream=`q\n${content}\nQ`;objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)}
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  let pdf='%PDF-1.4\n';const offsets=[0];for(let id=1;id<objects.length;id++){offsets[id]=pdf.length;pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)pdf+=String(offsets[id]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob=new Blob([pdf],{type:'application/pdf'}),url=targetWindow.URL.createObjectURL(blob),link=targetDocument.createElement('a');const filename=String(title||'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'relatorio';link.href=url;link.download=`reserva-simples-${filename}.pdf`;const fallback=targetDocument.getElementById(fallbackId);if(fallback){fallback.href=url;fallback.download=link.download;fallback.textContent='Baixar PDF pronto';fallback.hidden=false}targetDocument.body.append(link);link.click();link.remove();setTimeout(()=>targetWindow.URL.revokeObjectURL(url),30000);notify('PDF com layout do Reserva Simples pronto. Se não baixar automaticamente, toque em “Baixar PDF pronto”.');
}
function generateGlobalPdf(){
  diagnostics.step('pdf.requested', 'reports');
  const scope=$('#globalPdfScope').value;
  const prefix=scope==='month'?mkey(state.year,state.month):scope==='year'?String(state.year)+'-':'';
  const title=scope==='month'?monthLabel():scope==='year'?'Ano de '+state.year:'Histórico completo';
  const inPeriod=x=>!prefix||x.date.startsWith(prefix);
  const records=db.records.filter(inPeriod);
  const totals=[['Receitas',sum(records.filter(x=>x.kind==='income').map(x=>x.amount))],['Despesas',sum(records.filter(x=>x.kind==='expense').map(x=>x.amount))]];
  totals.push(['Receitas menos despesas',totals[0][1]-totals[1][1]]);
  const logo=new URL('./icon.svg',location.href).href;
  const ordered=rows=>[...rows].sort((a,b)=>a.date.localeCompare(b.date));
  const table=(title,columns,rows)=>`<section><h2>${esc(title)} <small>(${rows.length})</small></h2>${rows.length?`<table><thead><tr>${columns.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${esc(String(x??'—'))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p>Sem registros.</p>'}</section>`;
  const sections=[
    table('Receitas e despesas',['Data','Tipo','Categoria ou origem','Descrição','Valor'],ordered(records).map(x=>[dateBR(x.date),x.kind==='income'?'Receita':'Despesa',x.kind==='income'?(x.source==='salary'?'Salário':'Complemento'):x.category,x.note,money(x.amount)])),
    table('Contas recorrentes · cadastro atual',['Tipo','Descrição','Dia','Início','Fim','Valor','Situação'],db.recurring.map(x=>[x.kind==='income'?'Receita':'Despesa',x.note||x.category,x.day,x.startMonth,x.endMonth,money(x.amount),x.paused?'Pausada':'Ativa'])),
    table('Metas e cofrinhos · posição atual',['Meta','Prazo','Objetivo','Saldo estimado do cofrinho','Aplicações vinculadas','Situação'],db.jars.map(x=>[x.name,dateBR(x.dueDate),money(x.target),money(estimateCdbJar(x.id).net),money(linkedInvestmentBalance(x.id)),x.archived?'Arquivada':x.paused?'Pausada':'Ativa'])),
    table('Movimentos de cofrinhos',['Data','Cofrinho','Tipo','Principal','Líquido recebido','Descrição'],ordered(db.allocations.filter(inPeriod)).map(x=>[dateBR(x.date),db.jars.find(j=>j.id===x.jarId)?.name,x.amount>0?'Aporte':'Resgate',money(Math.abs(x.amount)),x.amount<0?money(x.netReceived??-x.amount):'—',x.note])),
    table('Aplicações do período · saldo informado',['Aplicação','Instituição','Produto','Data','Aplicado','Saldo líquido informado','Conferência','Meta','Débito no mês'],db.investments.filter(inPeriod).map(x=>[x.name,x.institution,x.product,dateBR(x.date),money(x.cost),money(x.balance),dateBR(x.checked),db.jars.find(j=>j.id===x.goalId)?.name,x.existing?'Não':'Sim'])),
    table('Carteira atual · posições informadas',['Aplicação','Tipo','Instituição','Data de conferência','Saldo informado','Custo restante do lote'],db.investments.filter(x=>x.status!=='sold').map(x=>[x.name,x.assetType==='livestock'?'Pecuária':'Financeiro',x.institution,dateBR(x.checked),money(x.balance),x.assetType==='livestock'?money(x.remainingCostBasis):'—'])),
    table('Resgates da carteira',['Data','Aplicação','Valor líquido'],ordered(db.investments.flatMap(x=>(x.redemptions??[]).map(r=>({...r,name:x.name}))).filter(inPeriod)).map(r=>[dateBR(r.date),r.name,money(r.amount)])),
    table('Instituições cadastradas',['Nome','Tipo','Percentual do CDI'],db.institutions.map(x=>[x.name,x.type==='cooperative'?'Cooperativa':'Banco',percent(x.cdiPercent)]))
  ].join('');
  const reportHtml=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Reserva Simples — Relatório geral</title><style>
  body{font:14px system-ui;color:#17263d;margin:24px}header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1a4d95;padding-bottom:12px}header img{width:46px;height:46px;border-radius:10px}h1{font-size:24px;margin:0}header p{margin:4px 0;color:#435772}.pdf-totals{display:flex;gap:12px;margin:16px 0}.pdf-totals article{flex:1;border:1px solid #b8cde7;border-top:3px solid #1a4d95;border-radius:8px;padding:10px;background:#eef5ff}.pdf-totals strong{display:block;font-size:18px;margin-top:4px}section{margin:24px 0}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;overflow-wrap:anywhere}th{background:#e6effb;color:#112c55}tbody tr:nth-child(even){background:#f5f8fd}h2{font-size:16px;break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}button{padding:9px 14px}@media print{button{display:none}body{margin:0}table{font-size:9px}}@page{size:A4 landscape;margin:12mm}
  </style></head><body><header><img src="${esc(logo)}" alt=""><div><h1>Reserva Simples</h1><p>Relatório financeiro · ${esc(title)} · Emitido em ${dateBR(isoToday())}${hideValues?' · Valores ocultos':''}</p></div></header><div class="pdf-totals">${totals.map(([label,value])=>`<article>${label}<strong>${money(value)}</strong></article>`).join('')}</div><button type="button" class="no-print" id="downloadPdfButton">Baixar PDF</button><button type="button" class="no-print" onclick="window.focus();window.print()">Imprimir</button>${sections}
<style id="desktop-integrated-page-header">
@media (min-width:761px){
 .sidebar-control{height:72px!important;justify-content:flex-start!important;margin-bottom:14px!important}
 .sidebar-control .page-title-block{display:grid;align-content:center;gap:3px;flex:1;min-width:0;margin:0 18px}
 .sidebar-control .page-title-block .subtitle{margin:0;font-size:9px;line-height:1.1}
 .sidebar-control .page-title-block h1{margin:0;font-size:24px;line-height:1.05;letter-spacing:-.7px}
 .sidebar-control .header-right{flex:0 0 auto!important;margin-left:auto!important}
 .main>.header{display:none!important}
}
@media (min-width:761px) and (max-width:1023px){
 .sidebar-control{height:64px!important;margin-bottom:12px!important}
 .sidebar-control #sidebarToggle{display:none!important}
 .sidebar-control .page-title-block{margin-left:0;margin-right:12px}
 .sidebar-control .page-title-block h1{font-size:21px}
}
</style>




</body></html>`;
  const parsed=new DOMParser().parseFromString(reportHtml,'text/html');
  downloadPdfReport('Relatorio financeiro - '+title,reportHtml,document,window);
}
function generateCdbPdf(){const rows=db.jars.filter(j=>!j.archived).map(j=>{const e=estimateCdbJar(j.id),institution=db.institutions.find(i=>i.id===j.institutionId)||db.institutions[0];return{j,e,institution}});const total={principal:sum(rows.map(x=>x.e.principal)),gross:sum(rows.map(x=>x.e.gross)),gain:sum(rows.map(x=>x.e.gain)),iof:sum(rows.map(x=>x.e.iof)),ir:sum(rows.map(x=>x.e.ir)),net:sum(rows.map(x=>x.e.net))};const annual=currentCdiAnnual();const rowHtml=rows.map(({j,e,institution})=>`<tr><td><b>${esc(j.name)}</b><small>${esc(institution?.name||'Banco Inter')} · ${institution?.type==='cooperative'?'Cooperativa':'Banco'} · ${percent(institution?.cdiPercent||100)} do CDI</small></td><td>${money(e.principal)}</td><td>${money(e.gain)}</td><td>${money(e.iof)}</td><td>${money(e.ir)}</td><td><b>${money(e.net)}</b></td></tr>`).join('');const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório de CDBs</title><style>*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172235;margin:32px auto;max-width:1100px;padding:0 22px}h1{margin:0 0 6px;font-size:25px}.muted,small{color:#667386}small{display:block;margin-top:4px;font-size:11px}.top{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;border-bottom:2px solid #dbe5ef;padding-bottom:18px}.badge{padding:8px 12px;border-radius:20px;background:#edf4ff;color:#2159a6;font-weight:bold}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.summary div{padding:13px;background:#f4f7fb;border-radius:12px}.summary span{display:block;color:#667386;font-size:11px}.summary b{display:block;font-size:19px;margin-top:7px}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e5eaf0;vertical-align:top}th{background:#f4f7fb;font-size:10px;text-transform:uppercase;letter-spacing:.04em}.right{text-align:right}.notes{margin-top:18px;padding:14px;background:#fff8e8;border:1px solid #f1e1b9;border-radius:10px;color:#61522d;font-size:11px;line-height:1.55}.foot{margin-top:20px;font-size:10px;color:#667386}@media print{body{max-width:none;margin:0;padding:0}.no-print{display:none}.summary div{break-inside:avoid}tr{break-inside:avoid}thead{display:table-header-group}}</style><body><div class="top"><div><h1>Relatório de cofrinhos e CDBs</h1><div class="muted">Gerado em ${new Date().toLocaleString('pt-BR')} · valores informados no aplicativo</div></div><span class="badge">CDI ${annual===null?'indisponível':percent(annual)+' a.a.'}</span></div><div class="summary"><div><span>Total aportado</span><b>${money(total.principal)}</b></div><div><span>Rendimento bruto estimado</span><b>${money(total.gain)}</b></div><div><span>Saldo líquido estimado</span><b>${money(total.net)}</b></div></div><button type="button" class="no-print" id="downloadPdfButton">Baixar PDF</button><button type="button" class="no-print" onclick="window.focus();window.print()">Imprimir</button><p class="muted">Estimativa calculada em ${cdiDateBR(isoToday())}; taxa CDI mais recente de ${cdiDateBR(latestCdi()?.date)} pela série diária CDI do Banco Central (SGS 12).</p><table><thead><tr><th>Cofrinho / instituição</th><th>Aportado</th><th>Rendimento bruto</th><th>IOF est.</th><th>IR est.</th><th>Saldo líquido est.</th></tr></thead><tbody>${rowHtml||'<tr><td colspan="6">Nenhum cofrinho cadastrado.</td></tr>'}<tr><th>Total</th><th>${money(total.principal)}</th><th>${money(total.gain)}</th><th>${money(total.iof)}</th><th>${money(total.ir)}</th><th>${money(total.net)}</th></tr></tbody></table><div class="notes"><b>Importante:</b> este documento é uma estimativa para compartilhamento, não é extrato bancário, comprovante de investimento nem saldo oficial. O CDI futuro pode mudar. O cálculo assume os aportes e resgates informados, consome aportes mais antigos primeiro (FIFO) e ajusta proporcionalmente o valor restante de cada lote ao principal resgatado; aplica a porcentagem do CDI cadastrada e estima IOF/IR em caso de resgate hoje. Confirme os valores com a instituição financeira.</div><div class="foot">Reserva Simples · Não contém número de conta ou credenciais bancárias.</div>
<style id="desktop-integrated-page-header">
@media (min-width:761px){
 .sidebar-control{height:72px!important;justify-content:flex-start!important;margin-bottom:14px!important}
 .sidebar-control .page-title-block{display:grid;align-content:center;gap:3px;flex:1;min-width:0;margin:0 18px}
 .sidebar-control .page-title-block .subtitle{margin:0;font-size:9px;line-height:1.1}
 .sidebar-control .page-title-block h1{margin:0;font-size:24px;line-height:1.05;letter-spacing:-.7px}
 .sidebar-control .header-right{flex:0 0 auto!important;margin-left:auto!important}
 .main>.header{display:none!important}
}
@media (min-width:761px) and (max-width:1023px){
 .sidebar-control{height:64px!important;margin-bottom:12px!important}
 .sidebar-control #sidebarToggle{display:none!important}
 .sidebar-control .page-title-block{margin-left:0;margin-right:12px}
 .sidebar-control .page-title-block h1{font-size:21px}
}
</style>

</body></html>`;const parsed=new DOMParser().parseFromString(html,'text/html');downloadPdfReport('Relatorio de cofrinhos e CDBs',html,document,window,'cdbPdfDownloadFallback')}
function institutionRegistryCard(){const rows=db.institutions.map(i=>{const used=db.jars.filter(j=>j.institutionId===i.id).length;return `<div class="institution-row"><span><b>${esc(i.name)}</b><small>${i.type==='cooperative'?'Cooperativa':'Banco'} · ${percent(i.cdiPercent)} do CDI · ${fundLabel(i.guaranteeFund)} · ${used} cofrinho(s)</small></span><span class="institution-actions"><button class="btn small" data-open="institution" data-institution="${esc(i.id)}">${i.isDefault?'Ajustar':'Editar'}</button>${i.isDefault?'<span class="tag soft">Padrão</span>':`<button class="btn small negative" data-delete-institution="${esc(i.id)}">Excluir</button>`}</span></div>`}).join('');return `<article class="card settings-card institution-settings-card"><div class="settings-card-head"><span class="settings-icon">${icon('wallet')}</span><div><h2>Bancos e cooperativas</h2><p>Cadastre instituições, remuneração do CDB e referências de proteção para o monitoramento estimado.</p></div></div><div class="institution-list">${rows}</div><div class="setting-actions"><button class="btn primary" data-open="institution">Cadastrar banco ou cooperativa</button></div></article>`}
async function deleteInstitution(id){const i=db.institutions.find(x=>x.id===id);if(!i)return;if(i.isDefault)return notify('A instituição padrão do Banco Inter não pode ser excluída.');const used=db.jars.filter(j=>j.institutionId===id);if(used.length)return notify('Antes de excluir, edite os cofrinhos vinculados e escolha outra instituição.');if(!confirm(`Excluir “${i.name}” da lista de instituições?`))return;if(await mutate(()=>db.institutions=db.institutions.filter(x=>x.id!==id)))notify('Instituição excluída.')}
async function savePlanningPrefs(e){e.preventDefault();const raw=$('#balanceAnchorAmount').value.trim(),date=$('#balanceAnchorDate').value,months=Number($('#emergencyMonths').value);let balance=null,anchor='';if(raw||date){const n=Number(raw);if(!raw||!Number.isFinite(n)||n<0||n>100000000||!validDate(date)||date>isoToday()){notify('Informe um saldo válido e a data em que ele foi conferido.');return}balance=Math.round(n*100);anchor=date}if(![3,6,9,12].includes(months)){notify('Escolha um prazo válido para a reserva.');return}if(await mutate(()=>{db.prefs.balanceAnchorCents=balance;db.prefs.balanceAnchorDate=anchor;db.prefs.emergencyMonths=months}))notify('Referências de planejamento salvas.')}
function preferredStartPage(){
  const page=localStorage.getItem('reserva.startPage');
  return PAGES.some(([id])=>id===page)?page:'home';
}
function settingOptions(choices, selected){
  return choices.map(([value,label])=>`<option value="${esc(value)}" ${selected===value?'selected':''}>${esc(label)}</option>`).join('');
}
document.addEventListener('change', event=>{
  const input=event.target;
  const key=input.dataset?.viewSetting;
  if (!['reserva.home.period','reserva.home.categoryView','reserva.startPage','reserva.sidebarCompact'].includes(key)) return;
  localStorage.setItem(key,input.type==='checkbox'?String(input.checked):input.value);
  if(key==='reserva.sidebarCompact'){sidebarCompact=input.checked;syncSidebar();}
  if(key==='reserva.home.period')home();
  if(key==='reserva.home.categoryView')budget();
});
function showAccountDialog(){
 const dlg=$('#accountDialog');if(!dlg||dlg.open)return;
 const legacy=!ACCOUNT&&!!localStorage.getItem('reserva-simples-v2');
 $('#accountLegacy').hidden=!legacy;
 $('#accountImportLegacy').checked=legacy;
 $('#accountError').textContent='';
 $('#accountAvatarChoices').innerHTML=Array.from({length:5},(_,i)=>
   '<label class="account-avatar-option"><input type="radio" name="avatar" value="'+i+'" '+(i===0?'checked':'')+'><img alt="Avatar financeiro '+(i+1)+'" src="'+Accounts.avatar(i)+'"></label>'
 ).join('');
 dlg.showModal();
}

async function createAccount(event){
 event.preventDefault();
 const form=event.target,err=$('#accountError'),button=form.querySelector('button[type="submit"]');
 if(button.disabled)return;
 button.disabled=true;err.textContent='';
 let newKey='';
 try{
   if(!globalThis.crypto?.subtle||!crypto.randomUUID)throw Error('Cadastro exige HTTPS e navegador com criptografia.');
   const password=form.elements.password.value;
   if(password.length<12||password!==form.elements.confirm.value)throw Error('A senha deve ter 12 caracteres ou mais, com confirmação igual.');
   const id=crypto.randomUUID();
   const profile=Accounts.profile({name:form.elements.name.value,email:form.elements.email.value,
     phone:form.elements.phone.value,avatar:form.elements.avatar.value,photo:''},id);
   let source=empty();
   if(!ACCOUNT&&$('#accountImportLegacy').checked){
     const old=localStorage.getItem('reserva-simples-v2');
     if(old){
       const parsed=JSON.parse(old);
       if(parsed.format==='reserva-vault-1'){
         const previousKey=await deriveVaultKey(password,from64(parsed.salt));
         source=await openVault(parsed,previousKey);
       }else source=verify(parsed);
       if(!source)throw Error('Base antiga inválida. Preserve e exporte seus dados antes de cadastrar.');
     }
   }
   source={...source,ownerId:id,profile};
   if(!verify(source))throw Error('Não foi possível validar a base do perfil.');
   const salt=bytesTo64(crypto.getRandomValues(new Uint8Array(16)));
   const key=await deriveVaultKey(password,from64(salt));
   const sealed=await sealVault(source,key,salt);
   await openVault(sealed,key);
   newKey=Accounts.storeKey(id);
   localStorage.setItem(newKey,JSON.stringify(sealed));
   Accounts.add(localStorage,id);
   document.body.classList.add('reserve-locked');
   location.reload();
 }catch(error){
   if(newKey&&!Accounts.list(localStorage).some(x=>Accounts.storeKey(x.id)===newKey))localStorage.removeItem(newKey);
   err.textContent=error?.message||'Não foi possível criar o perfil.';
 }finally{button.disabled=false}
}

function accountSettingsCard(){
 if(!ACCOUNT)return '';
 const profile=db.profile||{name:'',email:'',phone:'',avatar:0,photo:''};
 const image=profile.photo||Accounts.avatar(profile.avatar||0);
 return `<article class="card settings-card account-card">
  <div class="settings-card-head"><img class="account-current-avatar" src="${esc(image)}" alt=""><div><h2>Meu perfil</h2><p>Dados protegidos pela senha do cofre neste aparelho.</p></div></div>
  <form id="profileForm" class="form-grid">
   <label class="field"><span>Nome</span><input name="name" maxlength="80" minlength="2" required value="${esc(profile.name||'')}"></label>
   <label class="field"><span>Telefone</span><input name="phone" type="tel" maxlength="24" value="${esc(profile.phone||'')}"></label>
   <label class="field full"><span>E-mail</span><input name="email" type="email" maxlength="120" value="${esc(profile.email||'')}"></label>
   <div class="field full"><span>Avatar financeiro</span><div class="account-avatar-grid">${Array.from({length:5},(_,i)=>`<label class="account-avatar-option"><input type="radio" name="avatar" value="${i}" ${Number(profile.avatar||0)===i?'checked':''}><img src="${Accounts.avatar(i)}" alt="Avatar ${i+1}"></label>`).join('')}</div></div>
   <div class="form-buttons"><button class="btn primary" type="submit">Salvar perfil</button><label class="btn" for="accountPhotoInput">Enviar foto</label><input type="file" id="accountPhotoInput" accept="image/png,image/jpeg,image/webp" hidden><button class="btn" type="button" id="accountRemovePhoto" ${profile.photo?'':'hidden'}>Remover foto</button></div>
  </form>
  <div class="account-security">
   <h3>Segurança e biometria</h3><p>O cofre exige senha. A biometria usa uma credencial criptográfica WebAuthn PRF, se compatível.</p>
   <label class="field">Confirme a senha do cofre para ativar biometria<input id="accountBioPassword" type="password" autocomplete="current-password" placeholder="Senha do cofre"></label>
   <div class="setting-actions"><button class="btn primary" id="accountEnableBio" type="button">Ativar biometria</button>
   <button class="btn" id="accountDisableBio" type="button" ${Accounts.biometricConfigured(localStorage,ACCOUNT.id)?'':'hidden'}>Remover biometria</button>
   <button class="btn" id="accountLock" type="button">Bloquear agora</button></div>
   <p id="accountBioStatus" class="settings-note" role="status">${Accounts.biometricConfigured(localStorage,ACCOUNT.id)?'Biometria configurada.':'Biometria ainda não configurada neste navegador.'}</p>
  </div>
  <div class="account-switch">
   <h3>Perfis deste aparelho</h3>
   <div class="setting-actions"><select id="accountSelect" aria-label="Escolher perfil">${Accounts.list(localStorage).map((x,i)=>`<option value="${esc(x.id)}" ${x.id===ACCOUNT.id?'selected':''}>Perfil ${i+1}${x.id===ACCOUNT.id?' (atual)':''}</option>`).join('')}</select>
   <button type="button" class="btn" id="accountSwitch">Trocar perfil</button><button type="button" class="btn" id="accountCreateMore">Novo perfil</button></div>
   <p class="settings-note">Perfis e backups são independentes. Não há conta remota nem sincronização. Guarde a senha do cofre.</p>
  </div>
 </article>`;
}

async function saveProfileForm(event){
 event.preventDefault();
 const f=event.target;
 try{
   const profile=Accounts.profile({...db.profile,name:f.elements.name.value,
     phone:f.elements.phone.value,email:f.elements.email.value,avatar:f.elements.avatar.value},ACCOUNT.id);
   if(await mutate(()=>{db.profile=profile;db.ownerId=ACCOUNT.id}))notify('Perfil atualizado.');
 }catch(err){notify(err.message||'Dados inválidos.')}
}

async function handleProfilePhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5000000)
   return notify('Envie JPEG, PNG ou WebP de até 5 MB.');
 try{
   const dataUrl=await new Promise((resolve,reject)=>{
     const url=URL.createObjectURL(file),img=new Image();
     img.onload=()=>{
       try{
         const canvas=document.createElement('canvas'),scale=Math.min(1,256/Math.max(img.width,img.height));
         canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
         canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
         const data=canvas.toDataURL('image/jpeg',.77);
         URL.revokeObjectURL(url);resolve(data);
       }catch(err){URL.revokeObjectURL(url);reject(err)}
     };
     img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Imagem inválida'))};img.src=url;
   });
   if(!Accounts.photoValid(dataUrl))return notify('Foto muito grande após compressão.');
   if(await mutate(()=>{db.profile.photo=dataUrl}))notify('Foto salva no cofre.');
 }catch{notify('Não foi possível processar a foto.')}
}

async function unlockWithBiometric(){
 const error=$('#vaultError');
 try{
   if(!ACCOUNT||!vault)throw Error('Nenhum cofre associado ao perfil.');
   const password=await Accounts.unlock(localStorage,ACCOUNT.id);
   const key=await deriveVaultKey(password,from64(vault.salt));
   const restored=await openVault(vault,key);
   if(restored.ownerId!==ACCOUNT.id||restored.profile?.id!==ACCOUNT.id)throw Error('Cofre pertence a outro perfil.');
   db=restored;vaultKey=key;$('#vaultDialog').close();render();
 }catch(err){error.textContent=err.message||'Biometria indisponível. Use a senha.'}
}

async function toggleBiometricEnable(){
 const status=$('#accountBioStatus'),password=$('#accountBioPassword')?.value||'';
 try{
   if(!ACCOUNT||!vault)throw Error('Cofre não está ativo.');
   const key=await deriveVaultKey(password,from64(vault.salt));
   const verified=await openVault(vault,key);
   if(verified.ownerId!==ACCOUNT.id)throw Error('Perfil incorreto.');
   await Accounts.enroll(localStorage,ACCOUNT.id,password);
   $('#accountBioPassword').value='';
   status.textContent='Biometria configurada. A senha continua como alternativa.';
   render();
 }catch(err){status.textContent=err.message||'Dispositivo não compatível com a biometria criptográfica.'}
}


document.addEventListener('submit',event=>{
 if(event.target.id==='accountForm')void createAccount(event);
 if(event.target.id==='profileForm')void saveProfileForm(event);
});
document.addEventListener('change',event=>{
 if(event.target.id==='accountPhotoInput')void handleProfilePhoto(event.target.files?.[0]);
});
document.addEventListener('click',event=>{
 if(event.target.closest('#accountCreateMore'))showAccountDialog();
 if(event.target.closest('#accountSwitch')){
   const id=$('#accountSelect')?.value;
   if(id&&id!==ACCOUNT?.id){Accounts.select(localStorage,id);document.body.classList.add('reserve-locked');location.reload()}
 }
 if(event.target.closest('#accountLock')){document.body.classList.add('reserve-locked');location.reload()}
 if(event.target.closest('#accountEnableBio'))void toggleBiometricEnable();
 if(event.target.closest('#accountDisableBio')&&ACCOUNT){
   if(confirm('Remover biometria deste perfil? A senha continuará funcionando.')){Accounts.disableBiometric(localStorage,ACCOUNT.id);render()}
 }
 if(event.target.closest('#accountRemovePhoto'))void mutate(()=>{db.profile.photo=''});
 if(event.target.closest('#accountBioUnlock'))void unlockWithBiometric();
});

function settings(){
 const total=db.records.length+db.allocations.length;const institutionsCard=institutionRegistryCard();const recoveryCard=storageRecoveryRaw?`<article class="card settings-card settings-danger"><div class="settings-card-head"><span class="settings-icon">${icon('expense')}</span><div><h2>Recuperação de dados</h2><p>Os dados salvos não puderam ser lidos. O app pausou gravações para não sobrescrever o arquivo original.</p></div></div><div class="setting-actions"><button class="btn primary" id="exportCorruptBtn">Baixar cópia dos dados</button><button class="btn negative" id="startFreshAfterCorruptBtn">Iniciar base nova</button></div><p class="settings-note">${recoveryArchived?'Uma cópia também foi guardada neste navegador.':'Não foi possível arquivar a cópia automaticamente; exporte o arquivo antes de iniciar uma base nova.'}</p></article>`:'';
 $('#page-settings').innerHTML=`${heading('Configurações','Ajuste a aparência e organize seus dados.')}<div class="settings-grid">${recoveryCard}${accountSettingsCard()}<article class="card settings-card"><div class="settings-card-head"><div><h2>Central de Integridade</h2><p>Verifique o banco e gere um relatório técnico.</p></div></div><button class="btn primary" id="integrityScanBtn">Escanear</button><p id="integritySummary" role="status"></p></article>${institutionsCard}
 <article class="card settings-card"><div class="settings-card-head"><span class="settings-icon">${icon('settings')}</span><div><h2>Aparência</h2><p>Escolha como o aplicativo aparece neste aparelho.</p></div></div><div class="setting-row"><div><h3>Tema escuro</h3><p>Reduz o brilho da tela.</p></div><label class="switch"><input id="darkMode" type="checkbox" ${db.prefs.dark?'checked':''}>Ativar</label></div><div class="field"><span>Paleta de cores</span><div class="theme-palette-grid" role="group" aria-label="Selecione a paleta de cores">${[['blue','Azul','#1762c4'],['emerald','Esmeralda','#16834b'],['petrol','Petróleo','#08796e'],['plum','Ameixa','#7444a5'],['graphite','Grafite','#525d70'],['carbon','Preto/amarelo','#ffd43b']].map(([id,label,color])=>`<button type="button" class="theme-palette-choice ${(db.prefs.palette||'blue')===id?'selected':''}" data-palette-pick="${id}" aria-pressed="${(db.prefs.palette||'blue')===id}" title="${label}"><i style="--palette-chip:${color}"></i><span>${label}</span></button>`).join('')}</div></div></article><article class="card settings-card"><h2>Notificações</h2><p>Som ao atingir 75% ou 100% da cota de Mercado no mês atual, com o app aberto.</p><label class="switch"><input type="checkbox" id="budgetSound" ${db.prefs.budgetSound?'checked':''}>Ativar som</label> <button type="button" class="btn small" id="testBudgetSound">Testar som</button><div class="setting-row"><div><h3>Lembretes de contas</h3><p>Usa as contas recorrentes e as datas exibidas na agenda.</p></div><label class="switch"><input type="checkbox" id="billReminders" ${db.prefs.billReminders?'checked':''}>Ativar</label></div><label class="field">Avisar com antecedência<select id="billReminderDays">${[[0,'No dia do vencimento'],[1,'1 dia antes'],[3,'3 dias antes'],[7,'7 dias antes']].map(([value,label])=>`<option value="${value}" ${db.prefs.billReminderDays===value?'selected':''}>${label}</option>`).join('')}</select></label><div class="setting-actions"><button type="button" class="btn" id="enableBillNotifications">Permitir avisos no aparelho</button></div><p class="settings-note" id="billNotificationStatus">${esc(billNotificationPermission())} Os avisos automáticos são verificados quando o app está aberto.</p></article>
 <article class="card settings-card update-card"><div class="settings-card-head"><span class="settings-icon">${icon('refresh')}</span><div><h2>Atualizações</h2><p>Consulte a versão publicada e atualize o aplicativo sem apagar seus registros.</p></div></div><div id="updateState" class="update-status" data-state="${esc(updateInfo.state)}" role="status" aria-live="polite">${esc(updateInfo.status)}</div><div class="update-metrics"><div class="update-metric"><span>VERSÃO INSTALADA</span><strong>v${APP_VERSION}</strong></div><div class="update-metric"><span>VERSÃO PUBLICADA</span><strong id="updateLatest">v${esc(updateInfo.latest)}</strong></div><div class="update-metric"><span>ÚLTIMA CONSULTA</span><strong id="updateLastCheck">${updateInfo.lastCheck?esc(new Date(updateInfo.lastCheck).toLocaleString('pt-BR')):'Ainda não consultado'}</strong></div></div><div class="setting-actions"><button class="btn" id="checkUpdatesBtn">Verificar agora</button><button class="btn primary" id="applyUpdateBtn" ${updateInfo.available?'':'hidden'}>Atualizar agora</button></div><p class="update-help" id="updateNotes">${esc(updateInfo.notes||'O app preserva o banco local. A atualização do PWA requer conexão com o endereço publicado.')}</p></article>
 <article class="card settings-card backup-panel"><div class="settings-card-head"><span class="settings-icon">${icon('wallet')}</span><div><h2>Backup e exportação</h2><p>Proteja seus registros e gere relatórios.</p></div></div><div class="backup-grid">
<section class="backup-group"><h3>Backup em pasta</h3><p>Guarde cópias cifradas e versões anteriores dos registros.</p><div class="vault-inline"><h4>Cofre local</h4><p>${vault?'Cofre ativo. Exporte uma cópia cifrada em Backup.':'Proteja os registros com uma senha. Guarde-a para poder abrir o cofre.'}</p><div class="setting-actions"><button class="btn" id="vaultAction">${vault?'Bloquear cofre':'Ativar cofre'}</button>${vault&&!ACCOUNT?'<button class="btn" id="disableVaultBtn">Desativar cofre local</button>':''}</div></div><p class="settings-note" id="folderBackupStatus" role="status">${folderStatusText()}</p><div class="setting-actions"><button class="btn primary" id="chooseBackupFolderBtn">Escolher pasta de backup</button><button class="btn" id="reconnectBackupFolderBtn" hidden>Reconectar pasta</button><button class="btn" id="saveFolderBackupBtn" ${backupDirectory?'':'disabled'}>Salvar backup agora</button><button class="btn" id="restoreFolderBackupBtn" ${backupDirectory?'':'disabled'}>Restaurar da pasta</button></div></section>
<section class="backup-group"><h3>Arquivos de backup</h3><p>Baixe uma cópia ou restaure um arquivo salvo.</p><div class="setting-actions"><button class="btn" id="exportBtn">Baixar backup</button><button class="btn" id="importBtn">Restaurar arquivo</button></div><input id="importFile" type="file" accept=".json,application/json" hidden></section>

<section class="backup-group"><h3>Importar extrato bancário</h3><p>Envie o CSV exportado pelo banco. Datas, valores e categorias são identificados automaticamente; confira a prévia antes de adicionar os lançamentos.</p><div class="setting-actions"><button class="btn primary" id="bankCsvBtn">Importar CSV do banco</button><input id="bankCsvFile" type="file" accept=".csv,text/csv,text/plain" hidden></div></section><section class="backup-group"><h3>Planilha de lançamentos</h3><p>Exporte o histórico em CSV.</p><div class="setting-actions"><button class="btn" id="csvBtn">Exportar CSV</button></div></section></div></article>
 <article class="card settings-card"><h2>Privacidade</h2><p>Controle a exibição dos valores financeiros neste aparelho.</p><div class="setting-actions"><button type="button" class="btn" id="settingsPrivacyToggle" aria-pressed="${hideValues}">${hideValues?'Mostrar valores':'Ocultar valores'}</button></div></article>
 <article class="card settings-card"><h2>Acessibilidade</h2><p>Personalize a leitura e o movimento da interface.</p><label class="switch"><input type="checkbox" data-accessibility="reduceMotion" ${document.documentElement.classList.contains('reduceMotion')?'checked':''}>Reduzir animações</label><label class="switch"><input type="checkbox" data-accessibility="strongText" ${document.documentElement.classList.contains('strongText')?'checked':''}>Aumentar contraste do texto secundário</label></article>
 <article class="card settings-card"><h2>Painel Hoje e navegação</h2><p>Escolha como o painel apresenta os resultados e como o aplicativo abre.</p><label class="field">Período do painel<select data-view-setting="reserva.home.period">${settingOptions([['today','Hoje'],['7d','Últimos 7 dias'],['month','Mês selecionado'],['12m','Últimos 12 meses'],['custom','Personalizado em Hoje']],localStorage.getItem('reserva.home.period')||'month')}</select></label><label class="field">Gráfico por categoria em Orçamento<select data-view-setting="reserva.home.categoryView">${settingOptions([['distribution','Distribuição'],['comparison','Comparação com mês anterior']],localStorage.getItem('reserva.home.categoryView')||'distribution')}</select></label><label class="field">Tela inicial<select data-view-setting="reserva.startPage">${settingOptions(PAGES.map(([id,label])=>[id,label]),preferredStartPage())}</select></label><label class="switch"><input type="checkbox" data-view-setting="reserva.sidebarCompact" ${sidebarCompact?'checked':''}>Menu lateral compacto no desktop</label></article>
 <article class="card settings-card diagnostic-advanced-card" hidden><div class="settings-card-head"><span class="settings-icon">${icon('report')}</span><div><h2>Diagnóstico avançado</h2><p>Ferramenta de desenvolvimento e QA, destinada a uso com orientação técnica.</p></div></div><p>Varre todos os módulos, estrutura e layout, cálculos, persistência isolada, regressões, acessibilidade, segurança e APIs locais. Os testes sintéticos preservam os registros reais. A análise pode levar até 60 segundos.</p><p>O JSON distingue falhas, erros, pendências e recursos não suportados. Inclui esqueleto técnico do DOM sem textos visíveis, valores de campos ou dados financeiros e pessoais. Para investigar um problema, envie o JSON, um print separado e a descrição do comportamento. Nada é enviado automaticamente.</p><p>${diagnostics.report().events.length} evento(s) técnico(s) no histórico local.</p><div class="setting-actions"><button type="button" class="btn primary" id="runDiagnosticScan">Executar análise completa e baixar JSON</button><button type="button" class="btn" id="exportDiagnostics">Baixar logs JSONL</button><button type="button" class="btn" id="clearDiagnostics">Limpar logs</button></div><p id="diagnosticScanStatus" role="status" aria-live="polite">A análise percorre os módulos; testes que dependem de navegador, aparelho ou serviços externos aparecem como pendentes.</p></article>
 <article class="card settings-card settings-danger"><div class="settings-card-head"><span class="settings-icon">${icon('expense')}</span><div><h2>Apagar dados</h2><p>Remove ${total} movimentações e ${db.jars.length} cofrinhos salvos neste navegador.</p></div></div><div class="setting-actions"><button class="btn negative" id="clearBtn">Apagar todos os dados</button></div></article>
 </div><div class="notice">Versão ${APP_VERSION}. Os cálculos são feitos no próprio aparelho. Mantenha backups atualizados para evitar perder seus registros.</div>`
}
function setUpdateStatus(status,state='waiting'){updateInfo.status=status;updateInfo.state=state;const el=$('#updateState');if(el){el.textContent=status;el.dataset.state=state}const button=$('#applyUpdateBtn');if(button)button.hidden=!updateInfo.available;const latest=$('#updateLatest');if(latest)latest.textContent='v'+updateInfo.latest;const checked=$('#updateLastCheck');if(checked)checked.textContent=updateInfo.lastCheck?new Date(updateInfo.lastCheck).toLocaleString('pt-BR'):'Ainda não consultado';const notes=$('#updateNotes');if(notes)notes.textContent=updateInfo.notes||'O app preserva o banco local. A atualização do PWA requer conexão com o endereço publicado.'}
const parseAppVersion=value=>{
  if(typeof value!=='string')return null;
  const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([a-z][a-z0-9-]*)(?:\.(0|[1-9]\d*))?)?$/.exec(value);
  if(!match)return null;
  return {numbers:match.slice(1,4).map(Number),channel:match[4]||'',sequence:Number(match[5]||0)};
};
function compareVersions(a,b){
  const left=parseAppVersion(a),right=parseAppVersion(b);
  if(!left||!right)throw new Error('Versão do manifesto inválida');
  for(let i=0;i<3;i++){
    const diff=left.numbers[i]-right.numbers[i];
    if(diff)return diff;
  }
  if(!left.channel||!right.channel)return Number(!left.channel)-Number(!right.channel);
  return left.channel.localeCompare(right.channel,'en')||left.sequence-right.sequence;
}
async function checkForUpdates(){const button=$('#checkUpdatesBtn');if(button)button.disabled=true;updateInfo.available=false;setUpdateStatus('Consultando versão publicada…','checking');if(location.protocol==='file:'){updateInfo.lastCheck=new Date().toISOString();localStorage.setItem('reserva.update.checkedAt',updateInfo.lastCheck);updateInfo.notes='Abra o PWA em um endereço HTTPS para consultar e instalar atualizações. O arquivo HTML isolado não possui um servidor de versões.';setUpdateStatus('Consulta online indisponível neste modo','error');if(button)button.disabled=false;return}try{const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)throw new Error('manifesto indisponível');const release=await response.json();if(release.application!=='Reserva Simples'||!parseAppVersion(release.version))throw new Error('manifesto incompatível');updateInfo.latest=String(release.version);updateInfo.available=compareVersions(updateInfo.latest,APP_VERSION)>0;updateInfo.lastCheck=new Date().toISOString();updateInfo.notes=release.notes||'O banco de dados local permanece no aparelho durante a atualização.';localStorage.setItem('reserva.update.checkedAt',updateInfo.lastCheck);setUpdateStatus(updateInfo.available?'Nova versão disponível':'Você está usando a versão mais recente',updateInfo.available?'available':'success')}catch(err){diagnostics.record('update.check_failed',err);updateInfo.lastCheck=new Date().toISOString();localStorage.setItem('reserva.update.checkedAt',updateInfo.lastCheck);updateInfo.notes='Não foi possível consultar o manifesto de atualização. Confira sua conexão e tente novamente.';setUpdateStatus('Não foi possível verificar agora','error')}finally{if(button)button.disabled=false}}
let updateInProgress=false;
async function applyUpdate(){
 if(updateInProgress)return;
 if(saving||vaultBusy)return notify('Aguarde o salvamento antes de atualizar.');
 if($('#modal.open form')||document.querySelector('dialog[open] form'))return notify('Salve ou feche o formulário aberto antes de atualizar.');
 if(!updateInfo.available)return notify('Não há atualização disponível.');
 if(!('serviceWorker'in navigator)||location.protocol==='file:')return notify('Instale o app publicado como PWA para aplicar atualizações.');
 updateInProgress=true;diagnostics.step('update.requested');const button=$('#applyUpdateBtn');if(button)button.disabled=true;setUpdateStatus('Preparando atualização…','checking');
 const previousController=navigator.serviceWorker.controller;
 let reloaded=false,resolveActivation,rejectActivation;
 const activation=new Promise((resolve,reject)=>{resolveActivation=resolve;rejectActivation=reject});
 const reload=()=>{if(reloaded)return;reloaded=true;try{localStorage.setItem('reserva.update.pendingVersion',String(updateInfo.latest));}catch{}resolveActivation();location.reload()};
 const watch=worker=>{
  if(!worker)return;
  const onState=()=>{
   if(worker.state==='installed'||worker.state==='waiting')worker.postMessage({type:'SKIP_WAITING'});
   if(worker.state==='activated')reload();
   if(worker.state==='redundant')rejectActivation(new Error('O navegador descartou a instalação dos novos arquivos.'));
  };
  worker.addEventListener('statechange',onState);onState();
 };
 navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
 try{
  updateRegistration=await navigator.serviceWorker.getRegistration('./');
  if(!updateRegistration)throw new Error('Não encontrei o registro do PWA neste endereço.');
  updateRegistration.addEventListener('updatefound',()=>watch(updateRegistration.installing));
  await updateRegistration.update();
  if(reloaded)return;
  if(navigator.serviceWorker.controller!==previousController){reload();return;}
  watch(updateRegistration.installing);
  watch(updateRegistration.waiting);
  if(reloaded)return;
  if(!updateRegistration.installing&&!updateRegistration.waiting){
   const expectedCache='reserva-simples-v'+updateInfo.latest+'-';
   const readyCache=Boolean(globalThis.caches&&(await caches.keys()).some(name=>name.startsWith(expectedCache)));
   if(readyCache){diagnostics.record('update.cache_ready',undefined,{status:'aprovada',target_version:updateInfo.latest,reason:'Cache da versão publicada já está instalado; recarregando para confirmar a versão ativa'});reload();return;}
   throw new Error('O navegador não encontrou um Service Worker novo nem o cache da versão publicada. Feche outras janelas do Reserva Simples e tente novamente.');
  }
  setUpdateStatus('Baixando e ativando os novos arquivos…','available');
  await Promise.race([activation,new Promise((_,reject)=>setTimeout(()=>reject(new Error('O navegador não concluiu a instalação em 45 segundos. Confira a conexão e tente novamente; seus dados continuam preservados.')),45000))]);
 }catch(err){
  if(reloaded)return;
  diagnostics.record('update.install_failed',err,{error_message:err?.message||'Falha ao ativar a atualização',target_version:updateInfo.latest});updateInProgress=false;if(button)button.disabled=false;
  const msg=err?.message||'Falha ao ativar a atualização.';
  setUpdateStatus(msg,'error');
 }
}
let marketRefreshPending = false;
const editingField = () => document.activeElement?.matches?.('input, select, textarea');
function refreshMarketViews() {
  if (state.modal || editingField()) {
    marketRefreshPending = true;
    return;
  }
  render();
}
document.addEventListener('focusout', () => {
  if (marketRefreshPending) setTimeout(() => {
    if (marketRefreshPending && !state.modal && !editingField()) render();
  }, 0);
});
const pageRenderers={home,transactions,budget,calendar,goals,investments,analysis,reports,settings};
function render(){
  if(!ACCOUNT){document.body.classList.add('reserve-locked');showAccountDialog();return}
  if(vault&&!vaultKey){document.body.classList.add('reserve-locked');showVaultDialog('unlock');return}
  document.body.classList.remove('reserve-locked');
  marketRefreshPending=false;
  const debtInputs=['debtPayoff','debtPayment','debtMonths','debtCET'];
  const debtDraft=debtInputs.map(id=>$('#'+id)?.value);
  const [,title]=PAGES.find(([id])=>id===state.page)||PAGES[0];
  document.body.classList.toggle('dark',db.prefs.dark);
  document.body.classList.toggle('hide-values',hideValues);
  document.body.dataset.palette=db.prefs.palette||'blue';
  document.body.dataset.currentPage=state.page;
  $('#pageTitle').textContent=title;
  $('#monthTitleLabel').textContent=monthLabel();
  const privacy=$('#privacyToggle');
  privacy.textContent=hideValues?'Mostrar valores':'Ocultar valores';
  privacy.setAttribute('aria-pressed',String(hideValues));
  const now=new Date();
  $('#todayBtn').hidden=state.year===now.getFullYear()&&state.month===now.getMonth();
  document.title='Reserva — '+title;
  nav();
  document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id==='page-'+state.page));
  for(const [id] of PAGES)pageRenderers[id]();
  debtInputs.forEach((id,index)=>{
    const input=$('#'+id);
    if(input&&debtDraft[index]!==undefined)input.value=debtDraft[index];
  });
  updateDebtComparison();
}
function supportsHostedApp(){return location.protocol==='https:'||(location.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname))}
for (const key of ['reduceMotion','strongText']) {
  try { document.documentElement.classList.toggle(key, localStorage.getItem('reserva.accessibility.'+key)==='true'); } catch {}
}
document.addEventListener('change', event => {
  const key = event.target.dataset?.accessibility;
  if (!['reduceMotion','strongText'].includes(key)) return;
  document.documentElement.classList.toggle(key, event.target.checked);
  try { localStorage.setItem('reserva.accessibility.'+key, String(event.target.checked)); } catch {}
});
let latestDiagnosticScan = null;
let responsiveNavigationMatrixCache = null;
function scanResponsiveNavigationMatrix() {
  if(!document.documentElement.clientWidth)return {status:'não_suportado',reason:'Medição de layout indisponível',scenarios:[]};
  const widths = [320,360,390,768,1024,1280,1366,1440];
  const results = [],moduleLayouts=[];
  const sourceCss = [...document.querySelectorAll('style')].map(style => style.textContent || '').join('\n');
  const frame = document.createElement('iframe');
  frame.title = 'Verificação responsiva isolada';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden','true');
  frame.setAttribute('sandbox','allow-same-origin');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1440px;height:900px;border:0;opacity:0;pointer-events:none;z-index:-1';
  document.body.append(frame);
  try {
    const doc = frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="shell"><aside id="desktopSidebar"><div class="sidebar-brand"><strong>Reserva Simples</strong></div><nav id="desktopNav"><button class="nav-button" type="button"><span class="nav-label">Início</span></button></nav></aside><main class="main"><div class="sidebar-control"><button id="sidebarToggle" type="button">Menu</button><div class="page-title-block"><h1>Início</h1></div></div><header class="header"><h1>Início</h1></header><section class="page active" id="page-home"><article class="card"><h2>Verificação responsiva</h2></article></section></main></div><nav id="mobileNav" class="floating-nav">'+mobileDockMarkup()+'</nav></body></html>');
    doc.close();
    const testStyle = doc.createElement('style');
    doc.head.append(testStyle);
    doc.documentElement.className=document.documentElement.className;
    doc.body.className=document.body.className;
    doc.body.dataset.palette=document.body.dataset.palette;
    const main=doc.querySelector('.main');
    const screenSample=main.querySelector('.page');
    const moduleWidths={fine:[1440],coarse:[390,768,1280]};
    for (const pointer of ['fine','coarse']) {
      testStyle.textContent = sourceCss.replace(/\(\s*pointer\s*:\s*coarse\s*\)/gi,
        pointer === 'coarse' ? '(min-width:0px)' : '(max-width:0px)');
      for (const width of widths) {
        frame.style.width = width+'px';
        const root = doc.documentElement;
        const mobileExpected = width <= 1023 || (pointer === 'coarse' && width <= 1366);
        const mobileNav = doc.getElementById('mobileNav');
        const desktopSidebar = doc.getElementById('desktopSidebar');
        const rendered = node => Boolean(node && doc.defaultView.getComputedStyle(node).display !== 'none' && node.getClientRects().length);
        const mobileVisible = rendered(mobileNav);
        const sidebarVisible = rendered(desktopSidebar);
        const navRect = mobileNav.getBoundingClientRect();
        const overflowPx = Math.max(0,root.scrollWidth-root.clientWidth);
        const mobileNavInBounds = !mobileVisible || (navRect.left >= -2 && navRect.right <= width+2 && navRect.top < 900 && navRect.bottom <= 902);
        const budgetButton=mobileNav.querySelector('[data-page="budget"]');
        const dockButtonsInBounds=!mobileVisible||Boolean(budgetButton&&[...mobileNav.children].every(child=>{
          const rect=child.getBoundingClientRect();
          return rect.width>=44&&rect.height>=44&&rect.left>=navRect.left-1&&rect.right<=navRect.right+1;
        }));
        const passed = mobileVisible === mobileExpected && sidebarVisible !== mobileExpected && overflowPx <= 1 && mobileNavInBounds && dockButtonsInBounds;
        results.push({width,pointer,expected:mobileExpected?'dock móvel/tablet':'barra lateral desktop',mobileVisible,sidebarVisible,
          overflowPx,mobileNavInBounds,dockButtonsInBounds,passed});
        if(moduleWidths[pointer].includes(width)){
          screenSample.hidden=true;
          screenSample.classList.remove('active');
          for(const [module] of PAGES){
            const source=document.getElementById('page-'+module);
            if(!source)continue;
            const screen=doc.importNode(source,true);
            screen.classList.add('active');
            doc.body.dataset.currentPage=module;
            main.append(screen);
            const contentOverflowPx=Math.max(0,root.scrollWidth-root.clientWidth);
            const cards=[...screen.querySelectorAll('.card,.investment-tile,.goal-card')].filter(rendered);
            const outOfBounds=cards.filter(card=>{
              const box=card.getBoundingClientRect();
              return box.left < -2 || box.right > width+2;
            }).length;
            moduleLayouts.push({module,width,pointer,contentOverflowPx,cardsChecked:cards.length,
              outOfBounds,passed:contentOverflowPx<=1&&!outOfBounds});
            screen.remove();
          }
          screenSample.hidden=false;
          screenSample.classList.add('active');
          delete doc.body.dataset.currentPage;
        }
      }
    }
  } catch (error) {
    return {status:'erro',reason:error?.name==='SecurityError'?'Estilos inacessíveis no contexto isolado':'Falha ao montar a matriz responsiva',scenarios:results};
  } finally { frame.remove(); }
  const failed = [...results,...moduleLayouts].filter(result => !result.passed);
  return {status:failed.length?'alerta':'ok',reason:'Matriz isolada de navegação e geometria dos módulos',
    viewportProfiles:results.length,moduleViewportChecks:moduleLayouts.length,failed:failed.length,
    scenarios:results,moduleLayouts};
}
function scanDiagnosticPage(pageId, screenOnly = false) {
  const started = performance.now();
  const checks = [];
  function check(name, run) {
    if (screenOnly && !['Largura da tela atual','Geometria do layout visível',
      'Navegação exclusiva conforme breakpoint','Matriz responsiva de navegação','Formulários e acessibilidade'].includes(name)) return;
    const start = performance.now();
    let result;
    try { result = run(); }
    catch (error) {
      const known = ['Error','TypeError','ReferenceError','SyntaxError','RangeError',
        'QuotaExceededError','SecurityError','NotAllowedError'];
      result = {status:'erro', reason:known.includes(error?.name) ? error.name : 'Erro inesperado'};
    }
    checks.push({name, durationMs:Math.round(performance.now()-start), ...result});
  }
  const outcome = (passed, reason) => ({status:passed ? 'ok' : 'alerta', reason});
  const noLayout = () => !document.documentElement.clientWidth;
  const layoutUnavailable = () => ({status:'não_suportado',reason:'Medição de layout indisponível'});
  check('Integridade da base em memória', () => {
    if (vault && !vaultKey) return {status:'ignorado', reason:'Base bloqueada'};
    return outcome(Boolean(verify(JSON.parse(JSON.stringify(db)))), 'Validação pelo esquema de importação');
  });
  check('Base local e recuperação', () => {
    if (storageRecoveryRaw) return {status:'erro', reason:'Base em recuperação'};
    const raw = localStorage.getItem(STORE);
    if (!raw) return {status:'ignorado', reason:'Nenhuma base salva'};
    const saved = JSON.parse(raw);
    if (saved?.format === 'reserva-vault-1') return {status:'ignorado', reason:'Base criptografada'};
    return outcome(Boolean(verify(saved)), 'Validação da base salva');
  });
  for (const [name, storage] of [['Armazenamento local', () => localStorage],
                                  ['Armazenamento da sessão', () => sessionStorage]]) {
    check(name, () => {
      const store = storage();
      const key = 'reserva.scan.' + Date.now() + '.' + Math.random();
      try {
        store.setItem(key, 'ok');
        return outcome(store.getItem(key) === 'ok', 'Escrita e leitura de chave temporária');
      } finally { store.removeItem(key); }
    });
  }
  check('Destinos dos módulos', () => {
    const missing = PAGES.filter(([id]) => !document.getElementById('page-' + id)
      && id !== 'income' && id !== 'expense').map(([id]) => id);
    return {...outcome(!missing.length, 'Presença das telas no HTML'), missing};
  });
  check('IDs duplicados', () => {
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    const duplicates = ids.length - new Set(ids).size;
    return {...outcome(!duplicates, 'Contagem no documento'), duplicates};
  });
  check('Largura da tela atual', () => {
    if(noLayout())return layoutUnavailable();
    const overflowPx = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return {...outcome(overflowPx <= 1, 'Excesso de largura horizontal'), overflowPx};
  });
  check('Geometria do layout visível', () => {
    if(noLayout())return layoutUnavailable();
    const page = document.querySelector('.page.active');
    const width = document.documentElement.clientWidth;
    const findings = [];
    let count = 0;
    const label = node => ({
      tag:node.localName,
      position:[...node.parentElement.children].indexOf(node)+1,
      x:Math.round(node.getBoundingClientRect().left),
      y:Math.round(node.getBoundingClientRect().top+window.scrollY)
    });
    function flag(type, node, pixels, other) {
      count++;
      if (findings.length < 100) findings.push({type, element:label(node),
        pixels:Math.round(pixels), ...(other ? {neighbor:label(other)} : {})});
    }
    const nav = document.getElementById('mobileNav');
    const navRect = nav?.getBoundingClientRect();
    const visible = node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility === 'visible';
    };
    const header = document.querySelector(usesMobileNavigation()?'.main > .header':'.main > .sidebar-control');
    if (header && visible(header)) {
      const items = [...header.children].filter(visible);
      for (const [index,node] of items.entries()) {
        const rect = node.getBoundingClientRect();
        for (const other of items.slice(index+1)) {
          const neighbor = other.getBoundingClientRect();
          const overlapX = Math.min(rect.right,neighbor.right)-Math.max(rect.left,neighbor.left);
          const overlapY = Math.min(rect.bottom,neighbor.bottom)-Math.max(rect.top,neighbor.top);
          if (overlapX > 2 && overlapY > 2)
            flag('sobreposição no cabeçalho',node,Math.min(overlapX,overlapY),other);
        }
      }
    }
    const cards = [...(page?.querySelectorAll('.card,.goal-card,.transaction-row') || [])].filter(visible);
    const title = document.getElementById('pageTitle');
    const homeTitle = page?.querySelector('.approved-page-heading h1');
    if (title && homeTitle && visible(title) && visible(homeTitle))
      flag('título Hoje duplicado', title, 0, homeTitle);
    for (const node of header?.querySelectorAll('.page-title-block, .month-picker') || []) {
      if (!visible(node)) continue;
      const excess = node.scrollWidth-node.clientWidth;
      if (excess > 4) flag('conteúdo excede a largura do cabeçalho',node,excess);
    }

    const groups = new Map();
    for (const node of cards) {
      const rect = node.getBoundingClientRect();
      const excess = Math.max(-rect.left, rect.right-width);
      if (excess > 2) flag('fora da tela', node, excess);
      if (!groups.has(node.parentElement)) groups.set(node.parentElement, []);
      groups.get(node.parentElement).push({node,rect});
      if (node.matches('.transaction-row, details:not([open])')) continue;
      const children = [...node.children].filter(child => visible(child) &&
        !['absolute','fixed'].includes(getComputedStyle(child).position));
      if (children.length && rect.height > 150) {
        const bottom = Math.max(...children.map(child => child.getBoundingClientRect().bottom));
        const padding = parseFloat(getComputedStyle(node).paddingBottom) || 0;
        const blank = rect.bottom-bottom-padding;
        if (blank > 64 && blank > rect.height*.30)
          flag('possível espaço vazio no fim do cartão',node,blank);
      }
    }
    for (const [parent, entries] of groups) {
      entries.sort((a,b) => a.rect.top-b.rect.top);
      const gap = parseFloat(getComputedStyle(parent).rowGap) || 0;
      for (let i=0; i<entries.length; i++) {
        const {node,rect} = entries[i];
        let nearest = null;
        for (let j=i+1; j<entries.length; j++) {
          const {node:other,rect:box} = entries[j];
          const overlapX = Math.min(rect.right,box.right)-Math.max(rect.left,box.left);
          if (overlapX <= 2) continue;
          const overlapY = Math.min(rect.bottom,box.bottom)-box.top;
          if (overlapY > 2) flag('sobreposição entre cartões',node,overlapY,other);
          if (box.top >= rect.bottom) {
            if (node.nextElementSibling === other) nearest = {other, gap:box.top-rect.bottom};
            if (nearest) break;
          }
        }
        if (!nearest) continue;
        if (nearest.gap > Math.max(48,gap+32))
          flag('possível lacuna excessiva entre cartões da mesma coluna',node,nearest.gap,nearest.other);
      }
    }
    for (const node of [...(page?.querySelectorAll('button, input:not([type=hidden]), select, textarea') || [])].filter(visible)) {
      const rect = node.getBoundingClientRect();
      if (rect.right > width+2 || rect.left < -2)
        flag('controle fora da tela',node,Math.max(-rect.left,rect.right-width));
      if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth+4 && node.matches('button'))
        flag('conteúdo excede a largura do botão',node,node.scrollWidth-node.clientWidth);
      if (navRect?.height && rect.top < innerHeight && rect.bottom > navRect.top &&
          rect.bottom - Math.max(0,document.documentElement.scrollHeight-innerHeight-scrollY) > navRect.top+2)
        flag('controle pode ficar encoberto pela barra inferior no fim da rolagem',node,rect.bottom-navRect.top);
    }
    return {...outcome(!count,'Heurísticas aplicadas à tela renderizada; podem gerar falsos positivos'),
      viewport:{width,height:innerHeight}, cardsChecked:cards.length, count, findings};
  });
  check('Navegação exclusiva conforme breakpoint', () => {
    if(noLayout())return layoutUnavailable();
    const mobileNav = document.getElementById('mobileNav');
    const desktopSidebar = document.getElementById('desktopSidebar');
    const mobileExpected = usesMobileNavigation();
    const isRendered = node => Boolean(node && getComputedStyle(node).display !== 'none' && node.getClientRects().length);
    const mobileVisible = isRendered(mobileNav);
    const sidebarVisible = isRendered(desktopSidebar);
    const passed = mobileVisible === mobileExpected && sidebarVisible !== mobileExpected;
    const issue = mobileVisible && sidebarVisible ? 'dock e barra lateral simultâneas' :
      !mobileVisible && !sidebarVisible ? 'navegação ausente' :
      mobileExpected && !mobileVisible ? 'dock móvel/tablet ausente' :
      !mobileExpected && !sidebarVisible ? 'barra lateral desktop ausente' : null;
    return {...outcome(passed,'Exatamente uma navegação deve estar visível no breakpoint atual'),
      viewport:{width:innerWidth,height:innerHeight,pointerCoarse:matchMedia('(pointer:coarse)').matches},
      expected:mobileExpected?'dock móvel/tablet':'barra lateral desktop',mobileVisible,sidebarVisible,
      issue};
  });
  check('Matriz responsiva de navegação', () => {
    if (pageId !== 'home') return {status:'ignorado',reason:'Executada uma vez por varredura completa'};
    if (!responsiveNavigationMatrixCache) responsiveNavigationMatrixCache = scanResponsiveNavigationMatrix();
    return responsiveNavigationMatrixCache;
  });
  check('Referências financeiras e identificadores', () => {
    if (vault && !vaultKey) return {status:'ignorado', reason:'Base bloqueada'};
    const jars = new Set(db.jars.map(item => item.id));
    const orphanAllocations = db.allocations.filter(item => !jars.has(item.jarId)).length;
    const duplicateIds = [db.jars, db.records, db.allocations, db.tasks].reduce((total, items) =>
      total + items.length - new Set(items.map(item => item.id)).size, 0);
    const invalidAmounts = [...db.records,...db.allocations]
      .filter(item => !Number.isSafeInteger(item.amount) || item.amount === 0).length;
    return {...outcome(!orphanAllocations && !duplicateIds && !invalidAmounts,
      'Referências, identificadores e valores em centavos'), orphanAllocations, duplicateIds, invalidAmounts};
  });
  check('Navegação e painéis', () => {
    const activePages = [...document.querySelectorAll('.page.active')];
    const currentPageMismatch = activePages.length !== 1 || activePages[0]?.id !== 'page-'+state.page;
    const routes = new Set([...PAGES.map(([id]) => id), 'income', 'expense']);
    const invalidRoutes = [...document.querySelectorAll('button[data-page],a[data-page]')]
      .filter(node => !routes.has(node.dataset.page)).length;
    return {...outcome(!currentPageMismatch && !invalidRoutes,'Rotas dos controles e tela ativa'),
      currentPageMismatch, invalidRoutes};
  });
  check('Formulários e acessibilidade', () => {
    const page = document.querySelector('.page.active');
    const controls = [...(page?.querySelectorAll('button,input,select,textarea') || [])]
      .filter(node => !node.disabled && node.getClientRects().length && getComputedStyle(node).visibility === 'visible');
    const unlabeled = controls.filter(node => !node.textContent?.trim() &&
      !node.getAttribute('aria-label') && !node.getAttribute('aria-labelledby') &&
      !node.title && !node.labels?.length && node.type !== 'submit').length;
    const missingAriaTargets = controls.reduce((total,node) => total +
      ['aria-labelledby','aria-describedby','aria-controls'].flatMap(attr =>
        (node.getAttribute(attr) || '').split(/\s+/).filter(Boolean))
      .filter(id => !document.getElementById(id)).length,0);
    const invalidBounds = controls.filter(node => node.min && node.max &&
      Number.isFinite(Number(node.min)) && Number(node.min) > Number(node.max)).length;
    const touchTarget = node => {
      const own=node.getBoundingClientRect();
      const labels=[...(node.labels||[])].map(label=>label.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
      if(!labels.length)return {width:own.width,height:own.height,source:'controle'};
      const left=Math.min(own.left,...labels.map(rect=>rect.left)),right=Math.max(own.right,...labels.map(rect=>rect.right));
      const top=Math.min(own.top,...labels.map(rect=>rect.top)),bottom=Math.max(own.bottom,...labels.map(rect=>rect.bottom));
      return {width:right-left,height:bottom-top,source:'controle_mais_rotulo'};
    };
    const smallTargets = innerWidth <= 760 ? controls.filter(node => {
      if (node.matches('input[type=checkbox],input[type=radio]') && node.labels?.length) return false;
      const rect = touchTarget(node);
      return rect.width < 24 || rect.height < 24;
    }) : [];
    const smallTouchTargets = smallTargets.length;
    const smallTargetDetails = smallTargets.slice(0,20).map(node => ({
      tag:node.localName, id:node.id||undefined, type:node.type||undefined,
      label:node.getAttribute('aria-label')||node.textContent.trim().slice(0,40)||undefined,
      width:Math.round(node.getBoundingClientRect().width),height:Math.round(node.getBoundingClientRect().height),
      effectiveTarget:(()=>{const rect=touchTarget(node);return {width:Math.round(rect.width),height:Math.round(rect.height),source:rect.source}})()
    }));
    return {...outcome(!unlabeled && !missingAriaTargets && !invalidBounds && !smallTouchTargets,
      'Rótulos, referências, limites e áreas de toque na tela atual'),
      unlabeled, missingAriaTargets, invalidBounds, smallTouchTargets, smallTargetDetails};
  });
  check('Falhas registradas no histórico', () => {
    const allEvents=diagnostics.report().events;
    const counts = {}, resolvedCounts = {}, historicalCounts = {};
    const activeSince=Date.now()-60*60*1000;
    for (const event of allEvents) {
      if (!/^(javascript\.|.*(?:failed|invalid|error)$)/.test(event.code)) continue;
      const eventTime=Date.parse(event.at||'');
      const newerStart=event.code==='update.install_failed'&&allEvents.some(later=>later.code==='session.started'&&
        Date.parse(later.at||'')>=eventTime&&compareVersions(later.version,event.version)>0);
      const bucket=newerStart?resolvedCounts:eventTime>=activeSince?counts:historicalCounts;
      bucket[event.code]=(bucket[event.code]||0)+1;
    }
    const hostedOnly = Object.keys(counts).length && Object.keys(counts).every(code =>
      ['update.check_failed','offline.registration_failed'].includes(code));
    if (!supportsHostedApp() && hostedOnly)
      return {status:'info', reason:'Histórico de atualização e modo offline do PWA. A prévia local não executa essas operações.', counts};
    if(!Object.keys(counts).length&&(Object.keys(resolvedCounts).length||Object.keys(historicalCounts).length))
      return {status:'info',reason:'Não há falhas na última hora. Eventos antigos ou seguidos pela inicialização de versão mais nova permanecem apenas no histórico.',counts,resolvedCounts,historicalCounts};
    return {...outcome(!Object.keys(counts).length,'Falhas recentes no histórico; confira os eventos desta última hora.'), counts,resolvedCounts,historicalCounts};
  });
  check('Datas financeiras e precisão dos totais', () => {
    if (vault && !vaultKey) return {status:'ignorado', reason:'Base bloqueada'};
    let invalidDates = 0, unsafeAmounts = 0, absoluteTotal = 0n;
    for (const item of [...db.records, ...db.allocations]) {
      const date = new Date(item.date + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0,10) !== item.date) invalidDates++;
      if (Number.isSafeInteger(item.amount)) absoluteTotal += BigInt(Math.abs(item.amount));
      else unsafeAmounts++;
    }
    const potentialPrecisionLoss = absoluteTotal > BigInt(Number.MAX_SAFE_INTEGER);
    return {...outcome(!invalidDates && !unsafeAmounts && !potentialPrecisionLoss,
      'Datas civis válidas e margem de precisão em centavos'),
      invalidDates, unsafeAmounts, potentialPrecisionLoss};
  });
  check('Possíveis lançamentos repetidos', () => {
    if (vault && !vaultKey) return {status:'ignorado', reason:'Base bloqueada'};
    const seen = new Set();
    let candidates = 0;
    for (const item of db.records) {
      const key = JSON.stringify([item.date,item.kind,item.amount,item.category,item.note]);
      if (seen.has(key)) candidates++;
      seen.add(key);
    }
    return {...outcome(!candidates,'Coincidências podem representar lançamentos legítimos'), candidates};
  });
  check('HTML: estrutura e referências', () => {
    const missingLabelTargets = [...document.querySelectorAll('label[for]')]
      .filter(label => !document.getElementById(label.htmlFor)).length;
    const brokenFragments = [...document.querySelectorAll('a[href^="#"]')]
      .filter(link => link.hash.length > 1 && !document.getElementById(link.hash.slice(1))).length;
    const missingButtonTypes = document.querySelectorAll('form button:not([type])').length;
    return {...outcome(!missingLabelTargets && !brokenFragments && !missingButtonTypes,
      'Estrutura do DOM; botões sem tipo podem enviar o formulário por padrão'),
      missingLabelTargets, brokenFragments, missingButtonTypes};
  });
  check('CSS: folhas e variáveis do tema', () => {
    if(noLayout())return layoutUnavailable();
    let unreadableSheets = 0, emptyInlineSheets = 0;
    for (const style of document.querySelectorAll('style')) {
      if (!style.textContent.trim()) continue;
      try { if (!style.sheet?.cssRules.length) emptyInlineSheets++; }
      catch { unreadableSheets++; }
    }
    const computed = getComputedStyle(document.body);
    const missingThemeVariables = ['--bg','--card','--ink','--muted','--line']
      .filter(name => !computed.getPropertyValue(name).trim());
    return {...outcome(!emptyInlineSheets && !unreadableSheets && !missingThemeVariables.length,
      'Verifica regras aceitas pelo navegador e variáveis essenciais do tema'),
      unreadableSheets, emptyInlineSheets, missingThemeVariables};
  });
  check('JavaScript: exceções e promessas rejeitadas', () => {
    const events = diagnostics.report().events.filter(event =>
      event.code === 'javascript.error' || event.code === 'javascript.rejection');
    return {...outcome(!events.length,'Falhas capturadas pelo navegador no histórico'),
      count:events.length, recent:events.slice(-20).map(({code,type,line,column,module}) =>
        ({code,type,line,column,module}))};
  });
  check('Compatibilidade com a main aprovada', () => {
    // Atualizar a partir da main aprovada antes de preparar uma nova versão.
    const baseline = {
      branch:'main', version:'0.39.26', appJsBlob:'4a47bd36379693aa10697cf90d9b8be855d2db9a',
      storageKey:'reserva-simples-v2', schema:4,
      modules:['home','transactions','calendar','goals','investments','analysis','reports','settings'],
      collections:['records','jars','allocations','investments','recurring','tasks','institutions']
    };
    const fresh = empty();
    const currentModules = new Set(PAGES.map(([id]) => id));
    const missingModules = baseline.modules.filter(id =>
      !currentModules.has(id) || !document.getElementById('page-'+id));
    const missingCollections = baseline.collections.filter(key => !Array.isArray(fresh[key]));
    const storageKeyChanged = STORE !== baseline.storageKey;
    const schemaChanged = fresh.version !== baseline.schema;
    return {...outcome(!storageKeyChanged && !schemaChanged && !missingModules.length &&
      !missingCollections.length,'Mudanças de contrato exigem revisão de compatibilidade'),
      baseline, currentSchema:fresh.version, storageKeyChanged, schemaChanged,
      missingModules, missingCollections};
  });
  check('Conexão', () => ({status:navigator.onLine?'ok':'info',
    reason:navigator.onLine?'Navegador conectado':'Aplicativo em uso offline'}));
  check('Modo offline do PWA', () => {
    if(!supportsHostedApp())return {status:'ignorado',reason:'Prévia local'};
    return navigator.serviceWorker?.controller?
      {status:'ok',reason:'Controle por Service Worker'}:
      {status:'pendente',reason:'Service Worker ainda sem controle da página'};
  });
  check('APIs do navegador', () => ({
    status:'info', crypto:Boolean(globalThis.crypto?.subtle),
    backupFolder:typeof window.showDirectoryPicker === 'function',
    download:typeof URL.createObjectURL === 'function',
    indexedDB:'indexedDB' in window
  }));
  return {
    at:new Date().toISOString(), module:pageId,
    durationMs:Math.round(performance.now()-started), checks
  };
}
const DIAGNOSTIC_TEST_PLAN = [{"id":1,"title":"Abrir o arquivo via file:// e confirmar que a mensagem de limitação (ex.: CDI indisponível) aparece corretamente em vez de travar a tela.","status":"manual"},{"id":2,"title":"Servir o app via HTTPS/localhost e verificar se o manifest/ícones carregam sem erro 404 no console.","status":"manual"},{"id":3,"title":"Verificar se o Service Worker (se houver) registra sem exceções e se atualizações de versão não quebram o cache.","status":"manual"},{"id":4,"title":"Testar o app totalmente offline após o primeiro carregamento (modo avião) e confirmar que os dados locais continuam acessíveis.","status":"manual"},{"id":5,"title":"Verificar o comportamento ao abrir em um navegador sem suporte a showDirectoryPicker (deve mostrar o texto de \"acesso à pasta indisponível\").","status":"manual"},{"id":6,"title":"Verificar o comportamento ao abrir em navegador sem suporte a IndexedDB (fallback do backup em pasta).","status":"manual"},{"id":7,"title":"Conferir se favicon e apple-touch-icon (SVG inline em base64) renderizam corretamente em iOS/Android.","status":"manual"},{"id":8,"title":"Medir o tempo de carregamento inicial com uma base de dados grande (ex.: 50.000 registros) e verificar se a UI trava (thread bloqueada).","status":"manual"},{"id":9,"title":"Testar o evento pageshow/pagehide ao alternar abas repetidamente, garantindo que listeners não duplicam.","status":"manual"},{"id":10,"title":"Forçar um erro global (window.onerror) e checar se diagnostics.record captura sem expor dados sensíveis no log.","status":"manual"},{"id":11,"title":"Corromper manualmente o valor salvo em localStorage (JSON inválido) e verificar se o app recupera com a rotina de load()/verify() sem perder o backup bruto.","status":"manual"},{"id":12,"title":"Verificar se a cópia \"STORE-corrompido-timestamp\" é realmente criada uma única vez ao detectar dado corrompido (não duplicar a cada reload).","status":"manual"},{"id":13,"title":"Testar startFreshAfterCorrupt() cancelando o confirm() e garantir que nada é apagado.","status":"manual"},{"id":14,"title":"Testar startFreshAfterCorrupt() confirmando, e then checar se storageRecoveryRaw permanece acessível para exportação mesmo após criar base nova.","status":"manual"},{"id":15,"title":"Validar verify(src) com records.length = 50001 (deve ser rejeitado) e 50000 (deve ser aceito).","status":"automatic"},{"id":16,"title":"Validar verify(src) com jars.length = 5001 (rejeitado).","status":"automatic"},{"id":17,"title":"Enviar version fora de [2,3,4] (ex.: 1 ou 5) e confirmar rejeição segura, sem exception não tratada.","status":"automatic"},{"id":18,"title":"Simular localStorage.setItem lançando QuotaExceededError (armazenamento cheio) durante save() e verificar o tratamento de erro ao usuário.","status":"manual"},{"id":19,"title":"Testar mutate() chamando duas operações assíncronas concorrentes (ex.: duplo clique rápido em \"Salvar\") e verificar condição de corrida na escrita.","status":"manual"},{"id":20,"title":"Verificar se, com \"Salvamento pausado para proteger dados inválidos\" ativo, todas as ações de escrita (nova despesa, meta, etc.) são bloqueadas e o usuário é avisado de forma consistente.","status":"manual"},{"id":21,"title":"Confirmar que exportar os dados brutos funciona mesmo com o app em estado de dado corrompido.","status":"manual"},{"id":22,"title":"Testar restauração de backup com arquivo de formato antigo (version:2) e verificar migração correta de campos ausentes (recurring, tasks).","status":"manual"},{"id":23,"title":"Verificar se registros com amount não numérico ou negativo são filtrados/rejeitados na importação.","status":"automatic"},{"id":24,"title":"Testar com records contendo IDs duplicados (uid() colidindo) e observar se a edição/exclusão afeta o item errado.","status":"manual"},{"id":25,"title":"Verificar persistência correta após fechar o navegador no meio de uma gravação assíncrona (ex.: aba fechada durante save()).","status":"manual"},{"id":26,"title":"Criar um cofre com senha e verificar se deriveVaultKey/sealVault realmente impedem a leitura do localStorage em texto puro.","status":"manual"},{"id":27,"title":"Tentar abrir o cofre com senha incorreta e verificar mensagem de erro (vaultError) sem vazar detalhes técnicos.","status":"manual"},{"id":28,"title":"Confirmar o campo de confirmação de senha (vaultConfirmField) bloqueando submissão quando as senhas não coincidem.","status":"manual"},{"id":29,"title":"Testar senha vazia ou apenas espaços no formulário do cofre (required deve impedir, mas checar trim no JS também).","status":"manual"},{"id":30,"title":"Verificar comportamento ao trocar de senha do cofre: dados antigos continuam acessíveis com a nova chave?","status":"manual"},{"id":31,"title":"Testar abertura do cofre em outro navegador/dispositivo com o mesmo localStorage exportado — deve pedir senha normalmente.","status":"manual"},{"id":32,"title":"Verificar se cancelar o diálogo do cofre (vaultCancel) deixa a aplicação em estado consistente (sem tela em branco).","status":"manual"},{"id":33,"title":"Medir o tempo de deriveVaultKey em dispositivo lento — há risco de travar a UI (sem feedback de carregamento)?","status":"manual"},{"id":34,"title":"Testar entrada de caracteres Unicode/emoji na senha do cofre.","status":"manual"},{"id":35,"title":"Verificar se, ao atingir o cofre pela segunda vez na mesma sessão, a senha é solicitada novamente ou fica em cache de forma insegura.","status":"manual"},{"id":36,"title":"Conectar uma pasta de backup e verificar se writeFolderBackup cria o arquivo esperado com conteúdo íntegro.","status":"manual"},{"id":37,"title":"Revogar manualmente a permissão da pasta no navegador e verificar se hasFolderPermission detecta e solicita nova permissão sem travar.","status":"manual"},{"id":38,"title":"Simular conflito: pasta com backup diferente do dispositivo atual (backupConflict) e testar as duas opções oferecidas (restaurar vs. sobrescrever).","status":"manual"},{"id":39,"title":"Testar reconnectBackupFolder() após reiniciar o navegador (handle persistido via IndexedDB) — handle inválido deve ser tratado.","status":"manual"},{"id":40,"title":"Verificar debounce de scheduleFolderBackup() ao fazer múltiplas edições em sequência rápida (não deve escrever um arquivo por tecla).","status":"manual"},{"id":41,"title":"Testar restauração de backup com senha diferente da usada para gravar (readEncryptedFolder).","status":"manual"},{"id":42,"title":"Verificar preserveBeforeDestructiveAction antes de uma ação destrutiva (ex.: excluir tudo) — o backup prévio realmente acontece antes da ação?","status":"manual"},{"id":43,"title":"Remover fisicamente a pasta do disco entre duas sessões e verificar erro tratado ao tentar escrever.","status":"manual"},{"id":44,"title":"Testar o fluxo completo: criar dados → gerar backup → localStorage.clear() → restaurar → comparar se todos os campos (jars, records, tasks, recurring) retornam idênticos.","status":"manual"},{"id":45,"title":"Verificar removeBackupHandle() ao desconectar a pasta — notificações e botões de reconexão devem sumir/aparecer corretamente.","status":"manual"},{"id":46,"title":"Cadastrar uma despesa com valor \"0\" (deve ser rejeitado pelo min/validação) e conferir mensagem de erro.","status":"automatic"},{"id":47,"title":"Cadastrar valor negativo digitado manualmente burlando o type=number (colar texto) e verificar validação no JS, não só no HTML.","status":"automatic"},{"id":48,"title":"Testar valor extremo (ex.: 999999999999) e verificar overflow em centavos/arredondamento (toCents).","status":"automatic"},{"id":49,"title":"Testar casas decimais além de duas (ex.: 10,999) e conferir arredondamento consistente em toda a interface.","status":"automatic"},{"id":50,"title":"Cadastrar lançamento com data inválida (validDate) como 2027-02-30 e confirmar rejeição.","status":"automatic"},{"id":51,"title":"Cadastrar lançamento com data em formato diferente do esperado (31/02/2027) colado no campo via teclado.","status":"automatic"},{"id":52,"title":"Testar campo de nota/observação no limite de caracteres (maxlength) e um caractere acima, via paste.","status":"manual"},{"id":53,"title":"Testar tags com caracteres especiais, emojis e múltiplos separadores (; e , juntos) em normalizeTags.","status":"automatic"},{"id":54,"title":"Verificar duplicidade: adicionar a mesma tag duas vezes (#casa e casa) — deve deduplicar conforme normalizeTags.","status":"automatic"},{"id":55,"title":"Inserir mais de 8 tags e confirmar que o corte em 8 (slice(0,8)) funciona sem erro visual.","status":"automatic"},{"id":56,"title":"Editar um lançamento existente e cancelar — garantir que nada é alterado.","status":"manual"},{"id":57,"title":"Editar um lançamento e trocar o tipo (receita→despesa) — verificar se campos dependentes (categoria) resetam corretamente.","status":"manual"},{"id":58,"title":"Excluir um lançamento vinculado a uma recorrência (recurringId) e conferir se a recorrência pai não é afetada indevidamente.","status":"manual"},{"id":59,"title":"Testar \"Copiar despesas do mês anterior\" quando o mês anterior não tem despesas avulsas (mensagem de vazio).","status":"manual"},{"id":60,"title":"Testar \"Copiar despesas do mês anterior\" quando as despesas já foram copiadas (deve detectar duplicidade via exists()).","status":"manual"},{"id":61,"title":"Criar recorrência mensal com dia 31 e verificar comportamento em meses com menos dias (fevereiro, abril etc. via Math.min(t.day, maxDay)).","status":"automatic"},{"id":62,"title":"Pausar uma recorrência e confirmar que ela não aparece mais em pendingRecurring().","status":"manual"},{"id":63,"title":"Retomar uma recorrência pausada e verificar se meses \"perdidos\" no meio do caminho geram lançamentos retroativos indevidos.","status":"manual"},{"id":64,"title":"Excluir uma recorrência com lançamentos já confirmados — confirmar que os lançamentos passados permanecem (preserved).","status":"manual"},{"id":65,"title":"Aplicar \"Lançar contas\" com zero pendências — deve mostrar aviso e não quebrar.","status":"manual"},{"id":66,"title":"Aplicar \"Lançar contas\" cancelando a confirmação (confirm()), verificando que nada é persistido.","status":"manual"},{"id":67,"title":"Criar recorrência com startMonth no futuro e checar se ela não gera pendência antes da data.","status":"manual"},{"id":68,"title":"Criar recorrência com endMonth anterior ao mês atual e verificar que ela some da lista de pendências correntes.","status":"manual"},{"id":69,"title":"Testar duas recorrências com mesmo id (corrompido manualmente) e avaliar o impacto na edição/exclusão.","status":"manual"},{"id":70,"title":"Verificar unicidade: lançar a mesma recorrência duas vezes no mesmo mês não deve duplicar (pendingRecurring filtra por recurringMonth).","status":"manual"},{"id":71,"title":"Editar uma recorrência já aplicada no mês corrente — o lançamento confirmado deve, ou não, refletir a alteração (checar inconsistência).","status":"manual"},{"id":72,"title":"Testar recorrência de valor zero ou negativo via manipulação de formulário.","status":"automatic"},{"id":73,"title":"Criar um cofrinho sem instituição vinculada e conferir se o cálculo de CDI usa um valor padrão sensato.","status":"manual"},{"id":74,"title":"Criar um cofrinho com dueDate no passado e verificar mensagem de \"prazo vencido\" no simulador (simulateGoal).","status":"manual"},{"id":75,"title":"Simular aporte mensal igual a zero e conferir mensagem \"Informe um valor acima de zero\".","status":"manual"},{"id":76,"title":"Simular aporte com valor acima do limite (amount>10000000000) — deve ser rejeitado.","status":"manual"},{"id":77,"title":"Pausar/retomar uma meta e verificar que o cofrinho pausado só aparece na seção de \"planejamento pausado\".","status":"manual"},{"id":78,"title":"Criar meta e não registrar nenhum aporte — conferir estado vazio e ausência de divisão por zero no progresso (miniProgress).","status":"manual"},{"id":79,"title":"Registrar aporte maior que o valor alvo (target) da meta e conferir que a barra de progresso não ultrapassa 100% visualmente (overflow).","status":"manual"},{"id":80,"title":"Resgatar (retirar) de um cofrinho valor maior que o saldo disponível — deve haver bloqueio ou aviso.","status":"manual"},{"id":81,"title":"Excluir um cofrinho com aportes/investimentos vinculados — verificar órfãos em db.allocations/db.investments.","status":"manual"},{"id":82,"title":"Vincular um investimento a uma meta e depois excluir a meta — conferir se a referência (goalId) fica pendurada (dados órfãos).","status":"manual"},{"id":83,"title":"Testar duas metas com o mesmo nome — não deve haver conflito de identificação por nome, apenas por id.","status":"manual"},{"id":84,"title":"Verificar cálculo de estimateCdbJar quando não há nenhuma taxa de CDI carregada (rates.length === 0).","status":"manual"},{"id":85,"title":"Verificar cálculo de IOF/IR com resgate no mesmo dia do aporte (idade zero dias).","status":"manual"},{"id":86,"title":"Verificar cálculo de IOF/IR com aporte com mais de 720 dias (deve aplicar a alíquota mínima de IR de 15%).","status":"manual"},{"id":87,"title":"Testar resgate parcial de um cofrinho com múltiplos aportes (lotes) em datas diferentes — conferir se o FIFO de estimateCdbJar reduz o lote mais antigo corretamente.","status":"manual"},{"id":88,"title":"Baixar o PDF de metas (\"Baixar PDF\") com zero cofrinhos cadastrados e com uma base muito grande (centenas de cofrinhos) — checar geração e timeout.","status":"manual"},{"id":89,"title":"Alternar entre \"Aplicação financeira\" e \"Pecuária — compra de gado\" no formulário e verificar se os campos ocultos/visíveis (toggleInvestmentAssetFields) trocam sem deixar campos obrigatórios escondidos.","status":"manual"},{"id":90,"title":"Cadastrar investimento pecuário com headCount fracionário (ex.: 2,5) — deve ser rejeitado pelo step=\"1\".","status":"manual"},{"id":91,"title":"Cadastrar investimento com balance menor que cost (perda) e conferir se os indicadores tratam valores negativos corretamente.","status":"manual"},{"id":92,"title":"Registrar gasto de lote (livestockExpenseForm) com valor \"0,00\" — deve falhar pelo min=0.01.","status":"manual"},{"id":93,"title":"Registrar resgate (redemptionForm) de pecuária com quantidade de cabeças maior que o total do lote — checar se há validação de limite.","status":"manual"},{"id":94,"title":"Excluir um investimento vinculado a uma meta e verificar linkedInvestmentBalance após a exclusão (não deve contar valor fantasma).","status":"manual"},{"id":95,"title":"Editar a data de conferência (checked) para uma data anterior à data de compra (date) e verificar se há validação cronológica.","status":"manual"},{"id":96,"title":"Cadastrar instituição sem guaranteeFund definido e checar se guaranteeCard() não quebra ao agrupar.","status":"manual"},{"id":97,"title":"Cadastrar duas instituições do mesmo conglomerado e verificar se guaranteeCard() soma corretamente por conglomerado (não por instituição isolada).","status":"manual"},{"id":98,"title":"Testar exposição que ultrapasse o teto de R$ 25.000.000 fictício usado no código e conferir se o rótulo \"Acima da referência\" aparece.","status":"manual"},{"id":99,"title":"Cadastrar custo extra (extraCosts) e verificar se ele realmente entra no cálculo de patrimônio do lote, sem duplicar com lançamentos individuais.","status":"manual"},{"id":100,"title":"Testar adicionar/editar múltiplos investimentos no mesmo lote rapidamente (double submit) e verificar se o botão \"Salvar\" não permite duplo envio.","status":"manual"},{"id":101,"title":"Criar compromisso em um dia sem nenhuma movimentação financeira e verificar que o saldo previsto do dia não quebra (balance===null).","status":"manual"},{"id":102,"title":"Criar compromisso com horário inválido digitado manualmente (ex.: \"25:99\") e conferir a regex de validação de horário.","status":"manual"},{"id":103,"title":"Criar compromisso sem horário (campo opcional) e verificar exibição correta na lista do dia.","status":"manual"},{"id":104,"title":"Editar um compromisso existente e cancelar a edição (cancelCalendarTaskEdit) — garantir que o formulário volta ao estado de criação.","status":"manual"},{"id":105,"title":"Excluir um compromisso e cancelar a confirmação do confirm() — nada deve ser removido.","status":"manual"},{"id":106,"title":"Navegar entre meses usando ‹/› rapidamente (muitos cliques em sequência) e verificar se o calendário renderiza o mês correto ao final (sem race condition).","status":"manual"},{"id":107,"title":"Clicar em \"Hoje\" vindo de um ano completamente diferente (ex.: 2030) e verificar se retorna exatamente ao mês/ano atual do sistema.","status":"manual"},{"id":108,"title":"Verificar virada de ano ao navegar de dezembro para janeiro e de janeiro para dezembro (prevMonth/nextMonth).","status":"automatic"},{"id":109,"title":"Verificar o indicador visual de dias com entradas, saídas e compromissos simultâneos no mesmo dia (sobreposição de pontos/cores).","status":"manual"},{"id":110,"title":"Testar o seletor de cor do compromisso com todas as opções (CALENDAR_TASK_COLORS) e conferir contraste/acessibilidade.","status":"manual"},{"id":111,"title":"Abrir o modal do dia (openCalendarDayOverlay) em tela pequena e verificar rolagem/fechamento correto (data-close-calendar-day).","status":"manual"},{"id":112,"title":"Verificar o botão \"Hoje\" (todayBtn) — deve ficar oculto quando o mês selecionado já é o mês atual (hidden).","status":"manual"},{"id":113,"title":"Definir um limite de categoria igual a zero e verificar divisão por zero no cálculo de percentual (spent/limit*100).","status":"manual"},{"id":114,"title":"Ultrapassar 100% do limite de uma categoria e conferir se o estado visual \"danger\" é aplicado corretamente.","status":"manual"},{"id":115,"title":"Atingir exatamente 80% do limite e verificar se o alerta de \"quase no limite\" dispara (spent>=limit*.8).","status":"manual"},{"id":116,"title":"Remover um limite de categoria que já estava em alerta e confirmar que a notificação correspondente desaparece da lista.","status":"manual"},{"id":117,"title":"Testar o alerta sonoro de orçamento (playBudgetSound) em navegador que bloqueia áudio automático (política de autoplay) — deve exigir interação do usuário (unlockBudgetAudio).","status":"manual"},{"id":118,"title":"Testar groceryAlertLevel() nos limites exatos de transição de nível (ex.: ratio em 0.79 vs 0.80 vs 1.00).","status":"manual"},{"id":119,"title":"Verificar se limites configurados para uma categoria renomeada/excluída continuam referenciando corretamente ou ficam órfãos.","status":"manual"},{"id":120,"title":"Testar múltiplas categorias no limite simultaneamente e conferir se todas aparecem na lista de \"limites próximos\" sem truncamento inesperado.","status":"manual"},{"id":121,"title":"Simular falha de rede ao chamar a API do Banco Central (updateCdi) e verificar se a mensagem de erro aparece e o app usa o histórico salvo em cache.","status":"manual"},{"id":122,"title":"Simular resposta HTTP não-OK (ex.: 500) da API do CDI e conferir tratamento do throw new Error.","status":"manual"},{"id":123,"title":"Simular timeout da requisição CDI (mais de 15s, usando o AbortController) e verificar cancelamento limpo sem travar a UI.","status":"manual"},{"id":124,"title":"Simular resposta JSON malformada (não-array) da API SGS e verificar se Array.isArray(rows) barra o processamento.","status":"manual"},{"id":125,"title":"Forçar duas chamadas simultâneas de updateCdi() (clique duplo em \"Atualizar CDI\") e verificar a trava de cdiState.loading.","status":"manual"},{"id":126,"title":"Verificar o comportamento com o relógio do sistema no futuro (ex.: data do SO alterada) e seu impacto em isoToday() e nos cálculos de rendimento.","status":"manual"},{"id":127,"title":"Verificar o comportamento com o relógio do sistema no passado e seu impacto nas projeções de 30/60/90 dias.","status":"manual"},{"id":128,"title":"Testar requestBillNotificationPermission() quando a permissão do navegador já está \"denied\" — deve orientar o usuário sem repetir o prompt nativo.","status":"manual"},{"id":129,"title":"Testar notificação de conta a vencer no dia exato do vencimento (0 dias) e verificar o texto \"vence hoje\".","status":"manual"},{"id":130,"title":"Verificar deduplicação de notificações já enviadas (reserva.billReminder.sent) ao recarregar a página várias vezes no mesmo dia.","status":"manual"},{"id":131,"title":"Verificar updateIpca() quando a API retorna menos de 12 meses de histórico — conferir se o restante é tratado sem gerar undefined na interface.","status":"manual"},{"id":132,"title":"Alterar o protocolo para file: e confirmar que nenhuma chamada de rede ao Banco Central é disparada (checagem de location.protocol==='file:').","status":"manual"},{"id":133,"title":"Gerar o gráfico anual (yearChart) em um ano totalmente sem lançamentos — barras devem ficar no mínimo visual sem erro de NaN/Infinity.","status":"manual"},{"id":134,"title":"Gerar o donut de categorias (donutHTML) com apenas uma categoria — conferir que o conic-gradient fecha em 100% sem brechas visuais.","status":"manual"},{"id":135,"title":"Verificar miniLine() com apenas um valor válido (deve mostrar \"O gráfico aparecerá com mais dados\" por exigir ao menos 2 pontos).","status":"manual"},{"id":136,"title":"Testar cashProjection() sem saldo de referência configurado (balanceAnchorCents nulo) — deve exibir o CTA \"Configurar saldo\" e não travar a página.","status":"manual"},{"id":137,"title":"Testar cashProjection() com a data de referência (balanceAnchorDate) no futuro em relação a hoje (deve ser invalidada, anchor>today).","status":"manual"},{"id":138,"title":"Verificar o simulador de quitação de dívida (debtCompareValues) com número de parcelas igual a 0 ou negativo.","status":"manual"},{"id":139,"title":"Verificar o simulador de dívida com CET informado maior e menor que o CDI líquido, conferindo a frase condicional \"acima/abaixo do CDI\".","status":"manual"},{"id":140,"title":"Testar cashflowCard() com eventos futuros em datas muito distantes (ex.: recorrência cadastrada para daqui a 5 anos) — verificar performance e precisão do agrupamento diário.","status":"manual"},{"id":141,"title":"Verificar a \"Reserva de emergência\" quando não há nenhum mês fechado anterior com despesas (deve usar amostra vazia sem gerar NaN na média).","status":"manual"},{"id":142,"title":"Alterar o número de meses de reserva desejados (3/6/9/12) e confirmar recálculo imediato da meta sugerida e do valor faltante.","status":"manual"},{"id":143,"title":"Ativar \"Ocultar valores\" (privacyToggle) e verificar que todos os valores monetários da tela (incluindo gráficos e metas) ficam realmente ocultos, sem vazamento em atributos title/aria-label.","status":"manual"},{"id":144,"title":"Alternar paletas de cor (blue, emerald, petrol, plum, graphite, carbon) e verificar contraste mínimo de texto em cada uma (especialmente nos estados de alerta/perigo).","status":"manual"},{"id":145,"title":"Navegar por toda a interface apenas via teclado (Tab/Shift+Tab/Enter/Esc) e verificar se o foco visível (:focus-visible) nunca se perde, inclusive dentro de modais.","status":"manual"},{"id":146,"title":"Testar leitor de tela nos botões de navegação mobile (aria-expanded, aria-current) ao abrir o menu \"Mais módulos\" e confirmar que o estado é anunciado corretamente.","status":"manual"},{"id":147,"title":"Redimensionar a janela entre o layout desktop (sidebar fixa) e o mobile (navegação flutuante) no ponto de quebra do CSS, verificando se nenhum elemento fica duplicado ou cortado.","status":"manual"},{"id":148,"title":"Verificar o painel de notificações do sino (desktopNotificationPanel) fechando ao clicar fora (document.addEventListener('click', ...)), inclusive em dispositivos touch.","status":"manual"},{"id":149,"title":"Testar \"Limpar notificações\" e confirmar que os itens voltam a aparecer somente se uma nova condição realmente mudar (e não reaparecem indevidamente no próximo recálculo).","status":"manual"},{"id":150,"title":"Realizar teste de estresse geral: importar uma base muito grande (próxima aos limites de verify(): ~50.000 registros, ~5.000 cofrinhos), navegar por todas as páginas e medir se a aplicação permanece responsiva (sem congelar a thread principal por tempo perceptível).","status":"manual"}];
function runPlannedRegressionTests() {
  const checks = new Map([
    [15, () => {const x=empty();x.records=Array(50001).fill(null);return verify(x)===null}],
    [16, () => {const x=empty();x.jars=Array(5001).fill(null);return verify(x)===null}],
    [17, () => [1,5,99].every(version=>{const x=empty();x.version=version;return verify(x)===null})],
    [23, () => {const x=empty();x.records=[{id:'bad-amount',kind:'expense',amount:-1,date:'2026-01-01',category:'Outros'}];return verify(x)===null}],
    [46, () => Number.isNaN(toCents('0'))], [47, () => Number.isNaN(toCents('-12.00'))],
    [48, () => Number.isNaN(toCents('999999999999'))], [49, () => toCents('10.999')===1100],
    [50, () => !validDate('2027-02-30')], [51, () => !validDate('31/02/2027')],
    [53, () => normalizeTags(' #casa; café,🙂 ').join('|')==='casa|café|🙂'],
    [54, () => normalizeTags('#casa,casa').length===1], [55, () => normalizeTags('a,b,c,d,e,f,g,h,i').length===8],
    [61, () => {const fixture=empty();fixture.recurring=[{id:'qa-month-end',kind:'expense',category:'Outros',amount:100,day:31,startMonth:isoToday().slice(0,7)}];const previous=db;let rows;try{db=fixture;rows=upcomingBillInstances(90).filter(row=>row.id==='qa-month-end')}finally{db=previous}return rows.length>0&&rows.every(row=>validDate(row.date)&&Number(row.date.slice(8))===new Date(Number(row.date.slice(0,4)),Number(row.date.slice(5,7)),0).getDate())}],
    [72, () => [0,-1].every(amount=>{const x=empty();x.recurring=[{id:'x',kind:'expense',category:'Outros',amount,day:1,startMonth:'2026-01'}];return verify(x)===null})],
    [108, () => mkey(2026,11)==='2026-12' && mkey(2027,0)==='2027-01']
  ]);
  return DIAGNOSTIC_TEST_PLAN.map(test => {
    const run=checks.get(test.id);
    if(!run)return {...test,result:'pendente',reason:'Requer navegador, interação real ou fixture isolada ainda não implementada'};
    try{return {...test,result:run()?'ok':'falha',mode:'simulação sem alterar os dados'};}
    catch(error){return {...test,result:'erro',error:error?.name||'Erro inesperado'};}
  });
}
function scanInternalViews(target, id) {
  const scenarios = [];
  const record = (scenario, index) => {
    scenarios.push({scenario, index, ...scanDiagnosticPage(id, true)});
  };
  [...target.querySelectorAll('details:not([open])')].slice(0,12).forEach((detail,index) => {
    if (!detail.getClientRects().length) return;
    try {
      detail.open = true;
      record('seção expandida', index+1);
    } finally {
      detail.open = false;
    }
  });
  const panels = [...target.querySelectorAll('.mobile-analysis-panel')];
  const hidden = panels.map(panel => panel.hidden);
  try {
    panels.forEach((panel,index) => {
      panels.forEach(item => { item.hidden = item !== panel; });
      record('aba de Insights', index+1);
    });
  } finally {
    panels.forEach((panel,index) => { panel.hidden = hidden[index]; });
  }
  return scenarios;
}
function scanSyntheticFinance() {
  const cases = [
    ['Conversão em centavos', () => toCents('12.34') === 1234 && toCents('0.01') === 1],
    ['Rejeição de entradas inválidas', () => ['','abc','-1','Infinity'].every(value => Number.isNaN(toCents(value)))],
    ['Virada de período', () => mkey(2025,11) === '2025-12' && mkey(2026,0) === '2026-01'],
    ['Restauração de uma base vazia', () => Boolean(verify(JSON.parse(JSON.stringify(empty()))))],
    ['Rejeição de backup incompatível', () => !verify({version:-1,records:[],jars:[],allocations:[]})]
  ];
  return cases.map(([name, run]) => {
    const start = performance.now();
    let passed = false;
    try { passed = run(); } catch {}
    return {name,status:passed?'ok':'erro',durationMs:Math.round(performance.now()-start)};
  });
}
const ADDITIONAL_TEST_PLAN = [[1, "**[Novo]** Verificar, via `'serviceWorker' in navigator`, `'indexedDB' in window`, `'showDirectoryPicker' in window`, `'Notification' in window`, `crypto?.subtle`, `matchMedia`, se a detecção de recursos do próprio `environment()` está correta e não lança exceção quando a API não existe. *(Mecanismo 1)*"], [2, "**[Ref. 5]** Mockar temporariamente `window.showDirectoryPicker = undefined` e confirmar que `folderStatusText()` retorna a frase \"Acesso à pasta indisponível neste navegador...\". *(Mecanismo 2)*"], [3, "**[Ref. 6]** Mockar `window.indexedDB = undefined` dentro de uma cópia isolada de `openBackupDb` (ou capturar a exceção esperada) e confirmar que o erro é tratado sem subir ao `window.onerror`. *(Mecanismo 2)*"], [4, "**[Ref. 10]** Disparar `window.dispatchEvent(new ErrorEvent('error', {message:'teste-diagnostico', error:new Error('x')}))` em um contexto isolado e confirmar que `diagnostics.record` grava o evento sem incluir valores monetários/senhas em texto no payload. *(Mecanismo 2/4)*"], [5, "**[Novo]** Verificar se `addEventListener('unhandledrejection', ...)` realmente existe registrado uma única vez (sem duplicação) inspecionando se múltiplos `render()` sucessivos não acrescentam novos listeners globais."], [6, "**[Novo]** Medir com `performance.now()` o tempo de execução de `render()` da sessão atual (sem alterar dados) e marcar como alerta caso ultrapasse um limite configurável (ex.: 150ms) — substitui a necessidade de \"base de 50.000 registros real\" por extrapolação com fixture volumosa em memória (ver item 41)."], [7, "**[Novo]** Verificar se existe mais de um elemento com `id=\"toast\"`, `id=\"modal\"` ou qualquer outro `id` crítico usado por `$()` — IDs duplicados quebram `getElementById`/`querySelector` silenciosamente."], [8, "**[Novo]** Confirmar que todo `\u003cscript>` inline do documento não lança exceção de sintaxe isolada (via `new Function(textoDoScript)` em modo de verificação, sem executar) para pelo menos identificar erros grosseiros de sintaxe introduzidos em edições futuras."], [9, "**[Novo]** Verificar se `document.title` e `meta[name=description]` não ficam vazios após navegação entre páginas (`go()` para cada uma das 8 rotas)."], [10, "**[Novo]** Confirmar que nenhuma rota de `PAGES` aponta para um `id` de `\u003csection>` inexistente no DOM (cada `page-\u003cid>` deve existir)."], [11, "**[Ref. 11/12]** Chamar `verify()` com uma string JSON corrompida sintética (não tocar no `localStorage` real) e confirmar que retorna `null` sem lançar exceção. *(Mecanismo 1)*"], [12, "**[Ref. 18]** Mockar `localStorage.setItem` para lançar `DOMException('QuotaExceededError')` apenas durante a chamada de teste (usando uma instância de storage falsa passada por parâmetro, nunca o `localStorage` global do usuário) e confirmar que `save()` retorna `false`/notifica o erro em vez de travar. *(Mecanismo 2, isolado)*"], [13, "**[Ref. 19]** Simular duas chamadas concorrentes de uma função `mutate`-like em uma cópia de `db` isolada (`structuredClone`), disparando ambas com `Promise.all`, e verificar se o resultado final é consistente (sem perda de uma das alterações) — não usar o `db` real em memória."], [14, "**[Ref. 23]** Validar `verify()`/normalizadores de registro com `amount: \"abc\"`, `amount: -100`, `amount: NaN`, `amount: Infinity` em fixture isolada."], [15, "**[Novo]** Validar `verify()` com `records` contendo campos obrigatórios ausentes (`date` ausente, `kind` ausente) em fixture isolada."], [16, "**[Novo]** Validar `verify()` com tipos trocados (`jars` como objeto em vez de array, `allocations` como string) — deve rejeitar com `null`, nunca lançar exceção não tratada."], [17, "**[Novo]** Gerar uma fixture com 50.000 registros em memória (sem persistir) e cronometrar `verify()` + `forecast()` + `categories()` para registrar o tempo de execução como métrica de regressão de desempenho."], [18, "**[Ref. 24]** Gerar fixture com dois registros de `id` idêntico e verificar que funções de busca (`find`) sempre retornam o primeiro de forma determinística e documentada (evitar comportamento indefinido silencioso)."], [19, "**[Novo]** Verificar, por inspeção estática do código-fonte do `\u003cscript>` (regex/parse simples), se toda chamada a `JSON.parse` dentro de funções críticas (`load`, `openBackupDb`, histórico CDI/IPCA) está envolvida em `try/catch` — identificar pontos sem tratamento antes que virem bug em produção."], [20, "**[Novo]** Confirmar, com fixture isolada, que `verify()` aceita exatamente os limites documentados (50000 registros aceitos, 50001 rejeitados; 5000 jars aceitos, 5001 rejeitados; 50000 allocations aceitos, 50001 rejeitados; 5000 recorrências aceitas, 5001 rejeitadas; 10000 tarefas aceitas, 10001 rejeitadas) — cobre todos os limites de `verify`, não só os três já cobertos hoje."], [21, "**[Ref. 26]** Chamar `deriveVaultKey`/`sealVault`/`openVault` em um contexto isolado com senha fictícia e payload fictício (nunca o `db` real) e confirmar que o envelope resultante não contém o texto original em claro (checagem de substring no JSON serializado do envelope). *(Mecanismo 1)*"], [22, "**[Ref. 27]** Chamar `openVault` com a chave errada derivada de outra senha e confirmar que lança/retorna erro tratável, sem vazar qual parte da senha está errada."], [23, "**[Ref. 29]** Simular submissão do `vaultForm` com senha `\"   \"` (apenas espaços) via evento sintético em cópia isolada do formulário, confirmando que a validação de \"trim\" no JS rejeita, mesmo que o `required` do HTML já deixe passar espaços."], [24, "**[Ref. 34]** Chamar `deriveVaultKey` com senha contendo emoji/Unicode (`\"🔒áéü\"`) e confirmar que não lança exceção de encoding e que o resultado é estável (mesma senha gera a mesma chave em duas execuções)."], [25, "**[Novo]** Medir com `performance.now()` o tempo de `deriveVaultKey` na sessão atual e sinalizar alerta se ultrapassar um limiar (ex.: 1s), como proxy local para \"risco de travar a UI em aparelho lento\", sem precisar de um dispositivo lento real."], [26, "**[Novo]** Verificar estaticamente se existe algum `console.log`/`console.debug` no código-fonte que imprima a senha do cofre, o payload decifrado ou a chave derivada (varredura de texto no `\u003cscript>` por termos como `vaultPassword`, `key`, `salt` dentro de chamadas de `console`)."], [27, "**[Ref. 40]** Chamar `scheduleFolderBackup`-like (ou a função de debounce isolada) disparando múltiplas chamadas em sequência rápida com `backupDirectory` mockado como objeto fake (que apenas conta chamadas, não grava nada em disco) e confirmar que a função de escrita real só é chamada uma vez após o intervalo de debounce. *(Mecanismo 2, com handle falso em memória)*"], [28, "**[Ref. 42]** Mockar a função de escrita de backup como um espião (*spy*) e confirmar, via ordem de chamadas registradas, que `preserveBeforeDestructiveAction` sempre invoca o espião **antes** da função destrutiva, usando um fluxo de teste isolado (sem apagar dados reais)."], [29, "**[Ref. 44]** Rodar o ciclo completo de \"gerar envelope → decifrar envelope\" inteiramente em memória, com um objeto `db` fictício e um `FileSystemFileHandle` falso (objeto simples com `getFile`/`createWritable` simulados), comparando por igualdade profunda (`JSON.stringify`) o `db` antes e depois — sem tocar no sistema de arquivos real nem no `localStorage` do usuário."], [30, "**[Novo]** Verificar, por inspeção estática, se toda função que usa `backupDirectory`/`indexedDB` tem bloco `catch` (mesmo que mínimo) ao redor da chamada — útil porque qualquer uma dessas APIs pode não existir ou falhar em tempo real sem aviso prévio."], [31, "**[Ref. 56]** Clonar o formulário de lançamento (`cloneNode(true)`) fora da árvore visível, preencher com um evento sintético e abandonar sem `submit` — confirmar que nenhuma função de persistência foi chamada e que o `db` real permanece inalterado (checagem antes/depois por hash do `localStorage`)."], [32, "**[Novo]** Submeter, em um formulário clonado e isolado, todos os valores-limite de uma só vez (valor = 0,01; valor = 100000000; valor = 100000000,01) e confirmar que o terceiro é rejeitado pelo `max` tanto no HTML quanto na validação JS equivalente."], [33, "**[Novo]** Verificar estaticamente que todo campo `type=\"number\"` com `min`/`max` no HTML tem uma validação equivalente em JS antes de persistir (procurar, para cada `name` de input numérico nos formulários de diálogo, se existe checagem correspondente de limite no código) — fecha a lacuna de \"confiar só no HTML5\"."], [34, "**[Novo]** Simular `paste` sintético (`ClipboardEvent`) de um texto maior que `maxlength` em um campo de nota clonado e confirmar truncamento/validação consistente, sem precisar de interação humana real de colar."], [35, "**[Novo]** Rodar `normalizeTags` com entradas adversariais adicionais: string vazia, só separadores (`\";;;,,,\"`), 50 tags repetidas, tag de 1000 caracteres — confirmar que o corte em 30 caracteres por tag e 8 tags no total é respeitado em todos os casos, não só no caso feliz já coberto."], [36, "**[Novo]** Rodar `validDate` com uma bateria completa de datas-limite: ano bissexto (`2028-02-29` válido, `2027-02-29` inválido), mudança de século, dia `00`, mês `00`, mês `13`, string com espaços, string vazia, `null`, `undefined`."], [37, "**[Novo]** Verificar, para os três diálogos de formulário (`investmentForm`, `livestockExpenseForm`, `redemptionForm`), se todo campo marcado `required` no HTML possui, de fato, um `name` presente e lido em algum ponto do JS de submissão (detecta campo \"órfão\" que parece obrigatório mas não é validado nem salvo)."], [38, "**[Ref. 61]** Chamar a lógica de geração de data de recorrência (dia 31) para os 12 meses do ano em fixture isolada e confirmar que todo mês com menos de 31 dias usa o último dia válido (`Math.min`), incluindo fevereiro em ano bissexto e não bissexto."], [39, "**[Ref. 62/70]** Rodar `pendingRecurring()` sobre uma fixture com recorrência pausada e confirmar que ela não aparece; depois, sobre uma fixture com a mesma recorrência já lançada no mês (`recurringMonth` preenchido), confirmar que também não aparece (dedup)."], [40, "**[Ref. 67/68]** Rodar a mesma função com `startMonth` no futuro (deve ficar de fora) e com `endMonth` no passado (deve ficar de fora), tudo em fixture isolada, sem usar `db` real."], [41, "**[Novo]** Gerar fixture com 5.000 recorrências ativas e medir o tempo de `pendingRecurring()`/`upcomingBillInstances()` como métrica de regressão de desempenho (proxy local para \"base grande\", sem precisar que o usuário importe dados reais volumosos)."], [42, "**[Novo]** Verificar, em fixture isolada, que aplicar `applyRecurring` (ou sua lógica equivalente) sobre uma lista de pendências vazia não gera nenhum registro novo e não lança exceção."], [43, "**[Ref. 74/78]** Chamar `Engines.goal`/`simulateGoal`-like com uma meta cujo `dueDate` já passou e com uma meta sem nenhum aporte (`current=0`), ambas em fixture isolada, e confirmar as mensagens \"prazo vencido\" e a ausência de divisão por zero no progresso."], [44, "**[Ref. 84/85/86]** Chamar `estimateCdbJar` com: (a) `cdiState.rates = []` (sem taxas carregadas); (b) resgate no mesmo dia do aporte (idade 0); (c) aporte com mais de 720 dias de idade — tudo com datas e valores fictícios, sem tocar nos cofrinhos reais do usuário, conferindo que a alíquota de IR aplicada em cada faixa bate com a tabela (22,5% / 20% / 17,5% / 15%)."], [45, "**[Ref. 87]** Montar fixture com um cofrinho que recebeu três aportes em datas diferentes e sofreu um resgate parcial, e confirmar que `estimateCdbJar` reduz o lote mais antigo primeiro (lógica FIFO) comparando os `principal`/`value` restantes esperados."], [46, "**[Novo]** Rodar `estimateCdbJar` com `asOf` anterior à data de todos os aportes do cofrinho (cenário \"ainda não existia\") e confirmar que retorna saldo zero sem erro."], [47, "**[Novo]** Verificar, em fixture isolada, o comportamento de `linkedInvestmentBalance` quando o `goalId` informado não corresponde a nenhum investimento existente (deve retornar 0, não `NaN`/`undefined`)."], [48, "**[Novo]** Simular duas metas com nomes idênticos, mas `id`s diferentes, em fixture, e confirmar que toda função de busca usada na tela de metas localiza pelo `id` e nunca pelo `name` (varredura no código por `db.jars.find(` para checar o critério de busca usado)."], [49, "**[Ref. 91]** Calcular, em fixture isolada, os indicadores de um investimento com `balance \u003c cost` (perda) e confirmar que o resultado é um número negativo coerente, sem formatação quebrada (ex.: sem \"R$ -0,00\" truncando o sinal) e sem virar `NaN`."], [50, "**[Ref. 94]** Montar fixture com investimento vinculado a uma meta (`goalId`), remover o investimento da lista e rodar `linkedInvestmentBalance` novamente — confirmar que o valor cai para refletir a ausência, sem resíduo fantasma."], [51, "**[Novo]** Verificar estaticamente se os campos `headCount` (pecuária) e `cost`/`balance` (financeiro) realmente alternam de `hidden` ao trocar `assetType` no formulário clonado e isolado, cobrindo os dois sentidos da troca (financeiro→pecuária e pecuária→financeiro), não só um."], [52, "**[Novo]** Rodar o cálculo de patrimônio do lote de pecuária com `extraCosts` preenchido e, separadamente, com despesas individuais do mesmo lote já registradas, confirmando em fixture que os dois não são somados em duplicidade."], [53, "**[Novo]** Verificar, por fixture, o agrupamento de `guaranteeCard()` com duas instituições cujo `conglomerate` é escrito com capitalização diferente (`\"Banco X\"` vs `\"banco x\"`) — confirmar se a normalização (`toLocaleLowerCase('pt-BR')`) realmente une os dois no mesmo grupo, como o código pretende."], [54, "**[Novo]** Rodar `guaranteeCard()` com instituição sem `guaranteeFund` (campo ausente) e confirmar que ela é ignorada no agrupamento sem lançar exceção (cobre o caso 96 de forma automatizável)."], [55, "**[Ref. 101]** Chamar a função de saldo do dia (`cashProjection`/equivalente usado no calendário) para uma data sem nenhuma movimentação em fixture isolada e confirmar que retorna `null` de forma limpa, sem exceção, e que a tela trata esse `null` com o texto apropriado."], [56, "**[Ref. 102]** Validar a regex de horário (`^(?:[01]\\d|2[0-3]):[0-5]\\d$`) com uma bateria completa: `\"00:00\"` (válido), `\"23:59\"` (válido), `\"24:00\"` (inválido), `\"9:30\"` sem zero à esquerda (inválido conforme regex atual — vale confirmar se é o comportamento desejado), `\"25:99\"` (inválido)."], [57, "**[Ref. 108]** Estender o caso já automatizado de virada de ano para cobrir também a virada de mês dentro do mesmo ano (ex.: janeiro→fevereiro e fevereiro→janeiro) e a navegação de 24 cliques consecutivos em `nextMonth` a partir de um mês qualquer, conferindo que o estado final corresponde exatamente a `+24` meses em fixture de estado isolada (sem navegar a UI real)."], [58, "**[Novo]** Verificar, por varredura estática do DOM depois de renderizar o calendário com uma fixture de tarefas conhecida, se cada dia com tarefa realmente tem o indicador (`task-dot`) presente e se dias sem tarefa não têm — comparação 1 a 1 entre fixture e DOM renderizado."], [59, "**[Novo]** Verificar o estado do botão \"Hoje\" (`hidden`) programaticamente para três estados de `state.year`/`state.month`: igual ao mês atual real do sistema (deve estar oculto), um mês à frente e um mês atrás (deve estar visível nos dois)."], [60, "**[Ref. 113]** Chamar o cálculo de percentual de limite (`spent/limit*100`) com `limit=0` em fixture isolada e confirmar que o resultado é tratado antes de chegar ao template (nunca `Infinity`/`NaN` renderizado na tela)."], [61, "**[Ref. 114/115]** Rodar o mesmo cálculo nos pontos exatos de transição: `spent/limit = 0.79`, `0.80`, `0.99`, `1.00`, `1.01`, confirmando que o estado visual (`danger-text`/`warning-text`/neutro) muda exatamente no limiar documentado (80% e 100%), nem antes nem depois."], [62, "**[Ref. 118]** Rodar `groceryAlertLevel()` isoladamente nos mesmos pontos de transição de limiar usados no item anterior."], [63, "**[Ref. 119]** Montar fixture com um limite configurado para uma categoria que não existe mais em `CATS` e confirmar que o card de limites não quebra ao tentar exibir essa categoria (ou que a trata como removida de forma explícita)."], [64, "**[Novo]** Montar fixture com 10+ categorias simultaneamente no limite de alerta e confirmar, por inspeção do HTML gerado, que todas aparecem na lista (sem corte silencioso por `.slice()` indevido)."], [65, "**[Ref. 121/122/124]** Mockar `window.fetch` dentro da sessão de diagnóstico para: (a) rejeitar a Promise (simula falha de rede); (b) resolver com `{ok:false, status:500}`; (c) resolver com `ok:true` mas corpo `{}` (não-array) — chamando `updateCdi`/`updateIpca` reais, mas apontando para o `fetch` falso, e restaurando o `fetch` original no `finally`. Confirmar em todos os casos que `cdiState.error`/`ipcaState.error` é preenchido e que o histórico salvo anteriormente (fixture) não é apagado. *(Mecanismo 2 — rede 100% simulada em memória, sem nenhuma chamada real)*"], [66, "**[Ref. 123]** Mockar `fetch` para nunca resolver (Promise pendente) e confirmar que o `AbortController`/`setTimeout` interno cancela a chamada dentro do tempo esperado, sem travar o restante do diagnóstico (usar um timeout de teste bem menor que 15s para não deixar o teste lento)."], [67, "**[Ref. 125]** Disparar duas chamadas de `updateCdi(force:true)` em sequência imediata (ambas apontando para o `fetch` mockado) e confirmar, pelo contador de chamadas do mock, que a segunda é ignorada enquanto `cdiState.loading` está `true`."], [68, "**[Ref. 128]** Mockar `window.Notification = { permission: 'denied' }` (objeto simples, sem registrar notificação real) e confirmar que `requestBillNotificationPermission`/`billNotificationPermission` orientam o usuário a mudar a permissão no navegador, sem tentar chamar `Notification.requestPermission()` de novo."], [69, "**[Ref. 129/130]** Rodar a lógica de montagem da mensagem de lembrete (`\"vence hoje\"`/`\"vence amanhã\"`/`\"vence em N dias\"`) em fixture isolada para `daysUntil` = 0, 1 e N>1, e separadamente verificar que a chave de deduplicação (`id+'@'+date`) realmente impede o mesmo lembrete de ser contado duas vezes num `Set` simulado."], [70, "**[Ref. 131]** Mockar `fetch` do IPCA para devolver apenas 3 meses de histórico (menos que os 12 esperados) e confirmar que `miniLine`/o card de inflação não gera `undefined` nem `NaN` na interface, mostrando apenas os meses disponíveis."], [71, "**[Ref. 132]** Confirmar, por inspeção do código, que toda função de rede (`updateCdi`, `updateIpca`) checa `location.protocol==='file:'` **antes** de montar a URL de requisição (ordem das instruções), não apenas em paralelo — evita que a app tente montar a URL (e eventualmente vazar dados) mesmo quando vai abortar em seguida."], [72, "**[Ref. 133]** Chamar `yearChart()`-like com uma fixture de ano totalmente vazio (`income=expenses=saved=0` em todos os 12 meses) e confirmar que nenhuma barra gera altura `NaN%`/negativa no HTML produzido."], [73, "**[Ref. 134]** Chamar `donutHTML` com uma fixture de uma única categoria concentrando 100% do total e confirmar que o `conic-gradient` gerado cobre exatamente de 0% a 100% sem lacuna (checar a string do `stops` produzida)."], [74, "**[Ref. 135]** Chamar `miniLine` com `values=[10]` (um único ponto válido) e confirmar a mensagem de \"gráfico aparecerá com mais dados\"; chamar novamente com `[10, \"x\", null]` (valores inválidos misturados) e confirmar que o filtro (`Number.isFinite`) realmente descarta os inválidos antes de decidir se há pontos suficientes."], [75, "**[Ref. 136/137]** Chamar `cashProjection` com `balanceAnchorCents=null` (sem saldo de referência) e, separadamente, com `balanceAnchorDate` no futuro em relação a uma data \"hoje\" fictícia passada como parâmetro — confirmar `null` como retorno em ambos os casos, sem exceção."], [76, "**[Ref. 138]** Chamar `debtCompareValues`-like com `months=0` e `months=-5` em fixture isolada e confirmar a mensagem de \"preencha os valores\" em vez de cálculo com `Math.pow` indefinido."], [77, "**[Ref. 139]** Chamar a mesma função com `cet` acima e abaixo do CDI líquido de referência (valores fictícios) e confirmar que a frase condicional (\"acima\"/\"abaixo do CDI\") corresponde à comparação numérica real feita internamente."], [78, "**[Ref. 140]** Montar fixture com uma recorrência cuja data projetada cai 5 anos no futuro e confirmar que o agrupamento diário de `cashProjection`/`cashflowCard` não trava nem demora de forma desproporcional (medir tempo de execução) — sem precisar cadastrar isso de fato no app do usuário."], [79, "**[Ref. 141]** Chamar a lógica da \"reserva de emergência\" com uma fixture sem nenhum mês fechado anterior (`samples=[]`) e confirmar que a média não vira `NaN` (deve cair para 0 ou mensagem explícita)."], [80, "**[Ref. 142]** Rodar o cálculo de meta sugerida/valor faltante para os quatro valores possíveis de meses de reserva (3, 6, 9, 12) em fixture isolada e confirmar que o resultado muda proporcionalmente em todos eles."], [81, "**[Novo]** Verificar, por varredura do HTML gerado pelas funções de gráfico, se todo elemento `role=\"img\"` possui `aria-label` não vazio (acessibilidade de gráficos decorativos vs. informativos)."], [82, "**[Ref. 143]** Ativar `privacyToggle` e varrer **todos** os atributos `title`, `aria-label`, `data-*` e o `innerText` de elementos ocultos (`display:none`/`visibility:hidden`) à procura de valores monetários (padrão `R\\$\\s?[\\d.,]+`) que tenham escapado da ocultação."], [83, "**[Ref. 144]** Para cada paleta disponível (`blue`, `emerald`, `petrol`, `plum`, `graphite`, `carbon`), aplicar a paleta programaticamente, ler os estilos computados (`getComputedStyle`) dos textos sobre fundo de alerta/perigo e calcular a razão de contraste (fórmula WCAG) sem precisar de inspeção visual humana — reprovar paletas abaixo de 4.5:1 em texto normal."], [84, "**[Ref. 145]** Simular `Tab` programaticamente (percorrer `document.querySelectorAll('button, a, input, select, textarea, [tabindex]')` na ordem do DOM) e confirmar que nenhum elemento focável está com `tabindex=\"-1\"` indevido nem oculto por CSS enquanto ainda é alcançável pelo teclado (foco \"fantasma\")."], [85, "**[Ref. 146]** Abrir o menu \"Mais módulos\" programaticamente (chamando o handler, sem clique real) e verificar que `aria-expanded` no botão muda de `\"false\"` para `\"true\"` e volta corretamente ao fechar."], [86, "**[Ref. 147]** Simular a mudança de breakpoint chamando `matchMedia` mockado (retornando `matches:true`/`false` conforme o teste) em vez de redimensionar a janela de verdade, e confirmar que os elementos exclusivos de mobile/desktop (`.mobile-nav`, `#desktopSidebar`) nunca ficam visíveis os dois ao mesmo tempo."], [87, "**[Novo]** Verificar se existem elementos com `width`/`height` computados maiores que o `viewport` atual (overflow horizontal), reaproveitando a mesma lógica já citada no diagnóstico de \"largura excedente\", mas aplicando a cada uma das 8 páginas após navegação programática (`go()`), não só na página inicial."], [88, "**[Novo]** Verificar duplicidade de `id` em **todo** o documento (não só nos elementos críticos usados por `$()`), já que HTML permite tecnicamente ids repetidos sem erro, mas isso quebra qualquer seletor futuro."], [89, "**[Novo]** Verificar se todo `\u003cbutton>` sem texto visível (ícone apenas) possui `aria-label` ou `title`, varrendo os 8 módulos após navegação programática."], [90, "**[Novo]** Verificar se todo `\u003cinput>`/`\u003cselect>` dentro dos diálogos (`\u003cdialog>`) possui `label` associado (`for`/`id` correspondente ou `aria-label`), incluindo os campos que só aparecem depois de uma interação (ex.: campos de pecuária escondidos)."], [91, "**[Novo]** Verificar, em cada uma das 8 páginas, se existe mais de um elemento com `role=\"main\"` ou mais de um `\u003ch1>` por página (estrutura de landmark duplicada)."], [92, "**[Novo]** Verificar se o `tabindex` de elementos não interativos (`\u003cdiv>`, `\u003cspan>`) nunca é positivo (`tabindex > 0`), o que quebraria a ordem natural de navegação por teclado."], [93, "**[Novo]** Verificar, para cada `\u003cdialog>` do documento, se `aria-labelledby`/`aria-label` aponta para um elemento que realmente existe no DOM (referência não quebrada)."], [94, "**[Novo]** Verificar se o foco é movido para dentro do diálogo ao abri-lo programaticamente (`showModal()`) e se volta para o elemento que abriu o diálogo ao fechá-lo (`state.modalTrigger`), sem precisar de clique humano real, apenas chamando as funções de abrir/fechar."], [95, "**[Novo]** Verificar se todas as cores usadas como única forma de distinguir informação (ex.: pontos do calendário, barras do gráfico) têm também um `title`/texto alternativo equivalente, evitando dependência só de cor (WCAG 1.4.1)."], [96, "**[Novo]** Verificar, por `getComputedStyle`, se a área clicável de todos os botões de navegação mobile (`.nav-button`, `.nav-add`) atinge o mínimo recomendado de 44×44px, estendendo o diagnóstico de \"alvos de toque pequenos\" já existente para cobrir explicitamente a barra inferior em todas as 8 rotas."], [97, "**[Novo]** Verificar se, ao trocar de página via `go()`, o foco do teclado é posicionado em um elemento sensato (ex.: título da página) em vez de permanecer em um botão agora invisível/fora da página anterior."], [98, "**[Novo]** Verificar se o texto renderizado em todas as páginas respeita o `:root { font-family }` esperado, sinalizando qualquer elemento que tenha sobrescrito a fonte sem motivo aparente (possível CSS conflitante de edição futura)."], [99, "**[Novo]** Verificar se nenhum elemento de texto está com `overflow` cortando conteúdo sem reticências nem rolagem (`scrollWidth > clientWidth` em elementos sem `overflow:auto/scroll` e sem `text-overflow:ellipsis`), em todas as 8 páginas."], [100, "**[Novo]** Verificar se todas as folhas de `\u003cstyle>` internas (`id=\"...\"`) citadas no diagnóstico de \"CSS sem regras\" continuam, de fato, sendo referenciadas por pelo menos um seletor usado no HTML atual — sinaliza CSS morto introduzido em edições futuras."]];
async function runAdditionalLocalTests(scan) {
  const results = new Map();
  async function record(id, run, scope) {
    const start = performance.now();
    try {
      const value = await run();
      results.set(id, {status:value === null ? 'ignorado' : value ? 'ok' : 'falha', scope,
        durationMs:Math.round(performance.now()-start)});
    } catch (error) {
      results.set(id, {status:'erro', scope, error:error.name});
    }
  }
  const sample = (fields = {}) => ({id:'teste',kind:'expense',category:'Outros',
    amount:100,date:'2027-02-01',...fields});
  const fromRecords = records => verify({...empty(),records});
  function withFixture(data, run) {
    const previous = db;
    db = data;
    try { return run(); } finally { db = previous; }
  }
  const period = mkey(state.year,state.month);
  const recurring = {id:'teste-rec',kind:'expense',category:'Outros',
    amount:100,day:31,startMonth:period};
  const hasAccessibleName = node => Boolean(node.getAttribute('aria-label')?.trim() ||
    node.getAttribute('title')?.trim() || node.labels?.length ||
    node.getAttribute('aria-labelledby')?.trim().split(/\s+/).some(id =>
      document.getElementById(id)?.textContent.trim()));
  const checks = [
    [7, () => ['toast','modal'].every(id => document.querySelectorAll('#'+id).length === 1),'IDs críticos'],
    [10, () => PAGES.every(([id]) => document.getElementById('page-'+id)),'Destinos reais das rotas'],
    [11, () => verify('{incompleto') === null,'Validador recebe entrada inválida. Recuperação em disco fica fora'],
    [14, () => ['abc',-100,NaN,Infinity].every(amount => !fromRecords([sample({amount})])),'Valores inválidos na importação'],
    [15, () => !fromRecords([sample({date:undefined})]) && !fromRecords([sample({kind:undefined})]),'Campos obrigatórios'],
    [16, () => !verify({...empty(),jars:{}}) && !verify({...empty(),allocations:'x'}),'Tipos de coleções'],
    [18, () => !fromRecords([sample(),sample()]),'Rejeição de IDs duplicados na importação'],
    [20, () => {
      const records = Array.from({length:50000}, (_,i) => sample({id:'r'+i}));
      const jars = Array.from({length:5000}, (_,i) => ({id:'j'+i,name:'Teste',target:100,dueDate:'2027-12-31'}));
      return fromRecords(records)?.records.length === 50000 && !fromRecords([...records,sample()]) &&
        verify({...empty(),jars})?.jars.length === 5000 && !verify({...empty(),jars:[...jars,jars[0]]});
    },'Limites do validador com registros válidos em memória'],
    [32, () => toCents('0.01') === 1 && toCents('100000000') === 10000000000 &&
      Number.isNaN(toCents('100000000.01')),'Conversor real. Submissão pela interface ainda pendente'],
    [35, () => !normalizeTags(';;;,,,').length && normalizeTags(Array(50).fill('a')).length === 1 &&
      normalizeTags('a'.repeat(1000))[0]?.length === 30,'Limites das tags'],
    [36, () => ['2028-02-29','2000-02-29'].every(validDate) &&
      ['2027-02-29','1900-02-29','2027-01-00','2027-13-01'].every(date => !validDate(date)),'Datas civis'],
    [39, () => withFixture({...empty(),recurring:[recurring,{...recurring,id:'pausada',paused:true}],
      records:[sample({recurringId:recurring.id,recurringMonth:period})]}, () => pendingRecurring().length === 0),'Pausa e recorrência já confirmada'],
    [40, () => withFixture({...empty(),recurring:[recurring,{...recurring,id:'futura',startMonth:'9999-01'},
      {...recurring,id:'encerrada',startMonth:'1900-01',endMonth:'1900-02'}]},
      () => pendingRecurring().map(item => item.id).join() === recurring.id),'Início, fim e controle positivo'],
    [47, () => withFixture(empty(), () => linkedInvestmentBalance('inexistente') === 0),'Vínculo inexistente'],
    [50, () => {
      const fixture = {...empty(),investments:[{goalId:'meta',balance:500}]};
      return withFixture(fixture, () => {
        const before = linkedInvestmentBalance('meta');
        fixture.investments = [];
        return before === 500 && linkedInvestmentBalance('meta') === 0;
      });
    },'Recálculo após remoção em memória'],
    [56, () => ['00:00','23:59','24:00','25:99','12:60'].every((time,index) =>
      Boolean(verify({...empty(),tasks:[{id:'t',title:'Teste',date:'2027-02-01',time}]})) === (index < 2)),'Validador real de compromissos'],
    [57, () => mkey(2027,0) === '2027-01' && mkey(2027,1) === '2027-02','Chaves mensais. Navegação ainda pendente'],
    [62, () => {
      const fixture = {...empty(),records:[sample({date:isoToday(),category:'Mercado'})]};
      fixture.prefs.marketBudget = 100;
      return withFixture(fixture, () => [74,75,99,100,101].every((amount,index) => {
        fixture.records[0].amount = amount;
        return groceryAlertLevel() === [0,1,1,2,2][index];
      }));
    },'Limiar efetivo de 75% e 100% usado pelo aplicativo'],
    [72, () => withFixture(empty(), () => {
      const html = yearChart();
      return html.includes('chart-bars') && !/NaN|Infinity/.test(html);
    }),'Gráfico anual sem dados'],
    [73, () => /0%\s+100%/.test(donutHTML([sample()])),'Gradiente de categoria única'],
    [74, () => miniLine([10],'Teste').includes('empty-inline') &&
      !miniLine([10,20],'Teste').includes('empty-inline'),'Gráfico com um ou dois pontos'],
    [75, () => withFixture(empty(), () => {
      const absent = cashProjection(30) === null;
      db.prefs.balanceAnchorCents = 100;
      db.prefs.balanceAnchorDate = '9999-01-01';
      return absent && cashProjection(30) === null;
    }),'Saldo de referência ausente ou no futuro'],
    [81, () => [...document.querySelectorAll('[role="img"]')].every(hasAccessibleName),'Nomes dos gráficos renderizados'],
    [87, () => !scan.modules.some(module => module.checks.some(check =>
      check.overflowPx > 1 || check.findings?.some(item => /fora da tela/.test(item.type)))),'Largura atual nos oito módulos'],
    [88, () => {
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      return ids.length === new Set(ids).size;
    },'IDs no documento inteiro'],
    [89, () => [...document.querySelectorAll('.page button')].every(button =>
      button.textContent.trim() || hasAccessibleName(button)),'Botões renderizados'],
    [90, () => [...document.querySelectorAll('dialog input:not([type=hidden]),dialog select,dialog textarea')]
      .every(hasAccessibleName),'Campos presentes nos diálogos'],
    [91, () => [...document.querySelectorAll('.page')].every(page =>
      page.querySelectorAll('h1').length <= 1 && page.querySelectorAll('main,[role=main]').length <= 1),'Estrutura interna por módulo'],
    [92, () => !document.querySelector('div[tabindex]:not([role])[tabindex^="+"]') &&
      ![...document.querySelectorAll('div[tabindex]:not([role]),span[tabindex]:not([role])')].some(node => node.tabIndex > 0),'Ordem explícita de foco'],
    [93, () => [...document.querySelectorAll('dialog')].every(hasAccessibleName),'Nomes dos diálogos'],
    [96, () => !matchMedia('(max-width:760px)').matches ? null :
      [...document.querySelectorAll('#mobileNav button')].every(button => {
        const rect = button.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44;
      }),'Área medida da barra inferior']
  ];
  for (const [id,run,scope] of checks) await record(id,run,scope);

  if (globalThis.crypto?.subtle) {
    const salt = new Uint8Array(16);
    const password = 'Teste local 🔒áéü';
    let envelope, key;
    await record(21, async () => {
      key = await deriveVaultKey(password,salt);
      envelope = await sealVault({...empty(),records:[sample({note:'marcador fictício'})]},key,bytesTo64(new Uint8Array(16)));
      const restored = await openVault(envelope,key);
      return envelope.format === 'reserva-vault-1' &&
        !JSON.stringify(envelope).includes('marcador fictício') &&
        restored.records[0]?.note === 'marcador fictício';
    },'Cofre real com dados sintéticos em memória');
    await record(22, async () => {
      if (!envelope) return null;
      const wrong = await deriveVaultKey('outra senha fictícia',salt);
      try { await openVault(envelope,wrong); } catch (error) { return error.name === 'OperationError'; }
      return false;
    },'Chave incorreta. Mensagem do formulário ainda pendente');
    await record(24, async () => {
      if (!envelope) return null;
      const second = await deriveVaultKey(password,salt);
      return (await openVault(envelope,second)).records[0]?.id === 'teste';
    },'Derivação repetível com senha Unicode');
  }
  return ADDITIONAL_TEST_PLAN.map(([id,title]) => ({
    id,title,...(results.get(id) || {status:[21,22,24].includes(id) ? 'ignorado' : 'pendente',
      scope:[21,22,24].includes(id) ? 'Web Crypto indisponível' : 'Cenário ainda sem execução automática'})
  }));
}

const PROPOSAL_TEST_PLAN = [[1, "Registrador único de desempenho reaproveitável"], [2, "Migração `version:2` → `version:4` em um passo"], [3, "Migração `version:3` → `version:4`"], [4, "Migração com campo de versão ausente/corrompido"], [5, "Idempotência de migração (rodar duas vezes)"], [6, "Nenhum segredo literal passa por `console.*` durante o fluxo do cofre"], [7, "Restauração de backup com envelope de formato incompatível"], [8, "Restauração cancelada no meio do fluxo"], [9, "Equivalência de dados antes/depois do ciclo cofre completo"], [10, "Pasta indisponível via adaptador de teste (não via navegador real)"], [11, "Criar → editar → cancelar → excluir → reenviar, tudo em base isolada"], [12, "CSV com separador `;` vs `,` no mesmo arquivo"], [13, "Reconciliação Início × Lançamentos × Relatórios"], [14, "Relógio lógico injetado em vez do relógio do SO"], [15, "Vencidos (contas em atraso) com relógio lógico"], [16, "Geração duplicada de recorrência ao aplicar duas vezes com relógio parado"], [17, "Compromisso sem horário + botão Hoje em três meses, tudo com relógio lógico fixo"], [18, "Importação de CSV: aspas malformadas, linha corrompida ao final, cabeçalho ausente, importação repetida do mesmo arquivo"], [19, "Importação de CSV: aspas malformadas, linha corrompida ao final, cabeçalho ausente, importação repetida do mesmo arquivo"], [20, "Importação de CSV: aspas malformadas, linha corrompida ao final, cabeçalho ausente, importação repetida do mesmo arquivo"], [21, "Importação de CSV: aspas malformadas, linha corrompida ao final, cabeçalho ausente, importação repetida do mesmo arquivo"], [22, "Aporte seguido de resgate maior que o saldo disponível"], [23, "Venda parcial de lote de pecuária com `heads` maior que o total cadastrado"], [24, "IOF e IR documentados por tabela de aging, com resultado esperado explícito por faixa"], [25, "FIFO com resgate que consome mais de um lote"], [26, "Vínculo de investimento removido: `linkedInvestmentBalance` e `goalEngineData` em conjunto"], [27, "Integridade estrutural do JSON exportado pelo diagnóstico"], [28, "Integridade estrutural da exportação de dados do usuário (backup bruto)"], [29, "Chamadas simultâneas de CDI e IPCA (APIs diferentes, não a mesma duas vezes)"], [30, "Cache antigo de CDI/IPCA sendo usado quando a rede simulada falha"], [31, "Contraste com regra de inconclusivo para fundo não sólido"], [32, "Seletores do diagnóstico de layout sem correspondência no estado atual"], [33, "Breakpoint real em área de renderização isolada (iframe)"], [34, "Estados vazio/preenchido em três larguras de referência (mobile/tablet/desktop), para as 8 páginas"], [35, "Estados vazio/preenchido em três larguras de referência (mobile/tablet/desktop), para as 8 páginas"], [36, "Estados vazio/preenchido em três larguras de referência (mobile/tablet/desktop), para as 8 páginas"], [37, "Nome acessível de todo controle interativo nas 8 páginas"], [38, "Relações ARIA quebradas (referência a ID inexistente) em todo o documento"], [39, "Ocultar valores: varredura completa incluindo nomes acessíveis computados"], [40, "Foco inicial e retorno de foco em todos os diálogos do app, não só um"], [41, "Mapeamento de cobertura real dos 30 casos históricos"], [42, "Validação de fixtures de tamanho crescente (100 / 1.000 / 10.000 / 50.000) para as quatro funções mais pesadas"], [43, "Validação de fixtures de tamanho crescente (100 / 1.000 / 10.000 / 50.000) para as quatro funções mais pesadas"], [44, "Validação de fixtures de tamanho crescente (100 / 1.000 / 10.000 / 50.000) para as quatro funções mais pesadas"], [45, "Validação de fixtures de tamanho crescente (100 / 1.000 / 10.000 / 50.000) para as quatro funções mais pesadas"], [46, "Verificação de assinatura das funções exercitadas pelo diagnóstico"], [47, "Ponto de verificação indireto para funções não globais"], [48, "Checagem de versão/commit analisado embutida no relatório"], [49, "Suíte de \"testes-sentinela\" mínimos que não dependem de implementação interna"], [50, "Processo de validação do contrato e da cobertura antes de aplicar a trava"]];
const DIAGNOSTIC_SUITE_VERSION = '1.5.0';
const DIAGNOSTIC_SOURCE_REVISION = 'dutrafg/Reserva-Simples · main · app '+APP_VERSION;
function diagnosticContract() {
  const capabilities = {verify, validDate, normalizeTags, pendingRecurring,
    estimateCdbJar, cashProjection, bankCsvParseRows, monthData:Engines?.monthData,
    pendingOccurrences:Engines?.pendingOccurrences, budget, mobileDockMarkup, calendarSpending, validReleaseManifest};
  const expectedArity={verify:1,validDate:1,normalizeTags:1,pendingRecurring:0,
    estimateCdbJar:1,cashProjection:1,bankCsvParseRows:2,monthData:3,
    pendingOccurrences:3,budget:0,mobileDockMarkup:0,calendarSpending:1,validReleaseManifest:1};
  const signatures=Object.fromEntries(Object.entries(capabilities).map(([name,fn])=>[name,
    {available:typeof fn==='function',expectedArity:expectedArity[name],actualArity:typeof fn==='function'?fn.length:null,
      matches:typeof fn==='function'&&fn.length===expectedArity[name]}]));
  return {version:2,appVersion:APP_VERSION,suiteVersion:DIAGNOSTIC_SUITE_VERSION,
    referenceBranch:'main',sourceRevision:DIAGNOSTIC_SOURCE_REVISION,signatures,
    coverage:{modules:PAGES.map(([id])=>id),releaseFiles:releaseFiles.slice(),responsiveProfiles:16,moduleViewportChecks:PAGES.length*4},
    missing:Object.keys(capabilities).filter(name=>typeof capabilities[name]!=='function'),
    brokenSignatures:Object.entries(signatures).filter(([,item])=>!item.matches).map(([name])=>name)};
}
if(!window.ReservaDiagnosticBridge)window.ReservaDiagnosticBridge=Object.freeze({contractVersion:2,
  inspect:()=>diagnosticContract()});
function diagnosticReport(scan, report = diagnostics.report()) {
  const {applicationSkeleton:capturedSkeleton,...safeScan}=scan||{};
  return {...report, telemetry:{schema_version:TELEMETRY_SCHEMA,format:'json-events',encoding:'UTF-8',timestamp:'UTC ISO-8601',storage:'local-only',redaction:'sensitive-strings-masked',retention_days:report.retentionDays,max_events:report.eventLimit},
    events:report.events.map(diagnosticPublicEvent),
    diagnosticContract:diagnosticContract(),
    applicationSkeleton:capturedSkeleton||captureApplicationSkeleton(),
    supportContext:{attachScreenshotSeparately:true,includeBugDescriptionInMessage:true,
      screenshotAndDescriptionAreNotEmbedded:true}, scan:scan?safeScan:null};
}
function diagnosticPublicEvent(event) {
  const technicalCodes = new Set([
    'session.started','session.interrupted','javascript.error','javascript.rejection',
    'resource.failed','mutation.invalid','mutation.refresh_failed','mutation.failed',
    'storage.save_failed','backup.write_failed','update.check_failed','update.install_failed',
    'offline.registration_failed','connection.online','connection.offline','diagnostic.generation_failed',
    'update.applied','update.cache_ready','backup.recreate_failed','csv.read_failed',
    'market.cdi_cache_failed','market.cdi_failed','market.ipca_failed','storage.conflict_prevented',
    'storage.recovery'
  ]);
  const modules = PAGES.map(([id]) => id);
  const integrityCodes = new Set(['banco','banco.monitoramento','banco.rechecagem','diario','diagnostico.integrado',
    'central.execucao','monitoramento','cache_pwa',releaseManifestPath,...releaseFiles,...PAGES.map(([id])=>'interface.'+id)]);
  const types = ['Error','TypeError','ReferenceError','SyntaxError','RangeError',
    'QuotaExceededError','SecurityError','NetworkError','AbortError','NotAllowedError'];
  const safeString = value => {
    if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))return undefined;
    return value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[REDACTED_EMAIL]')
      .replace(/\bBearer\s+[^\s,;]+/gi,'Bearer [REDACTED]')
      .replace(/([?&](?:access_token|token|secret|password|api_key|authorization|cookie)=)[^&\s]+/gi,'$1[REDACTED]')
      .replace(/\b\d{3}[. -]?\d{3}[. -]?\d{3}[- .]?\d{2}\b/g,'[REDACTED_ID]')
      .replace(/\b\d{2}[. -]?\d{3}[. -]?\d{3}[/. -]?\d{4}[- .]?\d{2}\b/g,'[REDACTED_ID]')
      .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)9?\d{4}[-. ]?\d{4}\b/g,'[REDACTED_PHONE]')
      .replace(/\b(?:\d[ -]?){13,19}\b/g,'[REDACTED_NUMBER]').slice(0,240);
  };
  const safeId = value => typeof value === 'string' && /^[a-z0-9-]{8,64}$/i.test(value) ? value : undefined;
  const safeHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value) ? value : undefined;
  const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  return {
    event_id:safeId(event.event_id), ts:typeof event.ts==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.ts)?event.ts:undefined,
    level:['DEBUG','INFO','WARN','ERROR','FATAL'].includes(event.level)?event.level:undefined,
    service:'reserva-simples-pwa', env:['browser','standalone'].includes(event.env)?event.env:undefined,
    schema_version:TELEMETRY_SCHEMA, session_id:safeId(event.session_id), msg:safeString(event.msg),
    at: typeof event.at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.at) ? event.at : undefined,
    version: parseAppVersion(event.version) ? event.version : undefined,
    code: technicalCodes.has(event.code)||integrityCodes.has(event.code) ? event.code : 'technical.other',
    type: types.includes(event.type) ? event.type : undefined,
    module: modules.includes(event.module) ? event.module : undefined,
    online: typeof event.online === 'boolean' ? event.online : undefined,
    line: Number.isSafeInteger(event.line) ? event.line : undefined,
    column: Number.isSafeInteger(event.column) ? event.column : undefined,
    element: ['SCRIPT','LINK','IMG','other'].includes(event.element) ? event.element : undefined,
    status:['aprovada','ok','corrigida','alerta','falha','erro','pendente','sem_cofre','sem_correcao_aplicavel','ignorado','não_suportado','info'].includes(event.status)?event.status:undefined,
    check:safeString(event.check), action:safeString(event.action), reason:safeString(event.reason), error_message:safeString(event.error_message),
    duration_ms:safeCount(event.duration_ms??event.durationMs), run_id:safeId(event.run_id??event.runId),
    target_version:typeof event.target_version==='string'&&/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(event.target_version)?event.target_version:undefined,
    expected_sha256:safeHash(event.expected_sha256), observed_sha256:safeHash(event.observed_sha256),
    source:['service_worker_cache','network'].includes(event.source)?event.source:undefined, cache_name:safeString(event.cache_name),
    stage_index:Number.isSafeInteger(event.stage_index)&&event.stage_index>=0&&event.stage_index<4?event.stage_index:undefined,
    target_duration_ms:safeCount(event.target_duration_ms), stage_count:safeCount(event.stage_count), checks_count:safeCount(event.checks_count)
  };
}
function diagnosticSafeClassNames(element) {
  return [...(typeof element.className === 'string' ? element.className.split(/\s+/) : [])]
    .filter(name => /^[a-z][a-z0-9_-]{0,34}$/i.test(name) &&
      !/(?:^|[-_])(?:\d{6,}|[a-f0-9]{12,}|[a-z0-9]{20,})(?:$|[-_])/i.test(name))
    .slice(0,5);
}
function diagnosticSelectorPath(element, root) {
  const parts=[]; let node=element;
  while(node && node!==root && parts.length<7) {
    const tag=String(node.tagName||'').toLowerCase();
    if(!tag)break;
    const siblings=node.parentElement ? [...node.parentElement.children].filter(x=>x.tagName===node.tagName) : [];
    const index=siblings.indexOf(node)+1;
    const classes=diagnosticSafeClassNames(node).slice(0,2).map(x=>'.'+x).join('');
    parts.unshift(tag+classes+(siblings.length>1?':nth-of-type('+index+')':''));
    node=node.parentElement;
  }
  return (root?.id && /^page-[a-z0-9-]{1,32}$/i.test(root.id) ? '#'+root.id+' ' : '.page ')+parts.join(' > ');
}
function diagnosticElementSnapshot(element, root) {
  const rect=element.getBoundingClientRect(), css=getComputedStyle(element);
  const role=element.getAttribute('role');
  const safeRole=role && /^[a-z-]{1,24}$/i.test(role) ? role : null;
  const attrs={};
  ['aria-expanded','aria-hidden','aria-pressed','aria-selected','aria-modal'].forEach(name=>{
    const value=element.getAttribute(name);
    if(value==='true'||value==='false')attrs[name]=value;
  });
  if(element.hidden)attrs.hidden=true;
  if(element.disabled)attrs.disabled=true;
  return {
    selector:diagnosticSelectorPath(element,root), tag:String(element.tagName||'').toLowerCase(),
    classes:diagnosticSafeClassNames(element), role:safeRole,
    type:['button','submit','reset','text','number','date','month','email','password','checkbox','radio','search','tel','url','file'].includes(element.type)?element.type:undefined,
    state:attrs, visible:css.display!=='none'&&css.visibility!=='hidden'&&rect.width>0&&rect.height>0,
    rect:{x:Math.round(rect.left),y:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height)},
    layout:{display:css.display,position:css.position,overflowX:css.overflowX,overflowY:css.overflowY,
      flexDirection:css.flexDirection,gridColumns:String(css.gridTemplateColumns||'').slice(0,100),
      gap:String(css.gap||'').slice(0,32),zIndex:css.zIndex,fontSize:css.fontSize,lineHeight:css.lineHeight,
      whiteSpace:css.whiteSpace,textOverflow:css.textOverflow},
    childCount:element.children.length
  };
}
function capturePageSkeleton(page,id,title) {
  if(!page)return {id,title,present:false,elementCounts:{},sampledElements:[],overflow:null};
  const counts={}, candidates=[];
  const nodes=[page,...page.querySelectorAll('*')];
  const skip=new Set(['SCRIPT','STYLE','SVG','PATH','G','DEFS','CIRCLE','LINE','POLYLINE','OPTION']);
  for(const node of nodes) {
    if(skip.has(node.tagName))continue;
    const tag=String(node.tagName||'').toLowerCase();counts[tag]=(counts[tag]||0)+1;
    const cls=diagnosticSafeClassNames(node).join(' ');
    const important=/^(BUTTON|INPUT|SELECT|TEXTAREA|FORM|DIALOG|NAV|HEADER|MAIN|SECTION|ARTICLE|TABLE|FIELDSET)$/.test(node.tagName)||
      node.hasAttribute('role')||/(?:^| )(?:card|grid|panel|modal|dialog|toolbar|nav|chart|calendar|form)(?: |$)/i.test(cls);
    if(important && candidates.length<180)candidates.push(diagnosticElementSnapshot(node,page));
  }
  const rect=page.getBoundingClientRect(), doc=document.documentElement;
  return {id,title,present:true,visible:getComputedStyle(page).display!=='none',
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1},
    pageRect:{x:Math.round(rect.left),y:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height)},
    overflow:{horizontalPx:Math.max(0,doc.scrollWidth-doc.clientWidth),verticalPx:Math.max(0,doc.scrollHeight-doc.clientHeight),
      pageScrollWidth:page.scrollWidth,pageClientWidth:page.clientWidth},
    elementCounts:counts,sampledElements:candidates,sampled:candidates.length,
    sampleLimit:180,candidateElements:counts?Object.values(counts).reduce((sum,value)=>sum+value,0):0,
    candidatesOmitted:Math.max(0,Object.values(counts).reduce((sum,value)=>sum+value,0)-candidates.length),
    privacy:{textIncluded:false,inputValuesIncluded:false,hrefsIncluded:false,dataAttributesIncluded:false,personalDataIncluded:false}};
}
function captureApplicationSkeleton(prebuilt) {
  const pages=prebuilt||PAGES.map(([id,title])=>capturePageSkeleton(document.getElementById('page-'+id),id,title));
  return {schemaVersion:'app-skeleton.v1',capturedAt:new Date().toISOString(),application:'Reserva Simples',
    appVersion:APP_VERSION,suiteVersion:DIAGNOSTIC_SUITE_VERSION,
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1,scrollX:Math.round(scrollX),scrollY:Math.round(scrollY)},
    activeModule:document.body.dataset.currentPage||state.page||null,
    purpose:'Correlacionar o print e a descrição do usuário com a estrutura e as medidas dos componentes.',
    privacy:{redacted:true,includesVisibleText:false,includesFieldValues:false,includesNames:false,includesFinancialOrClinicalData:false},
    modules:pages};
}
function createDiagnosticMemoryStorage(seed={},quotaError=false) {
  const map=new Map(Object.entries(seed).map(([key,value])=>[String(key),String(value)]));
  return {get length(){return map.size},key:index=>[...map.keys()][index]??null,
    getItem:key=>map.has(String(key))?map.get(String(key)):null,
    setItem:(key,value)=>{if(quotaError)throw new DOMException('Quota exceeded','QuotaExceededError');map.set(String(key),String(value))},
    removeItem:key=>map.delete(String(key)),clear:()=>map.clear(),_map:map};
}
async function withDiagnosticSandbox(options,run) {
  options=options||{};
  const original={db,state,cdiState,ipcaState,vault,vaultKey,vaultBusy,saving,hideValues,loadedStoreRaw,integrityContainmentLock,
    storageRecoveryRaw,recoveryArchived,backupDirectory,backupConflict,folderKey,folderSalt,
    confirm:Object.getOwnPropertyDescriptor(window,'confirm'),fetch:Object.getOwnPropertyDescriptor(window,'fetch'),
    localStorage:Object.getOwnPropertyDescriptor(window,'localStorage'),sessionStorage:Object.getOwnPropertyDescriptor(window,'sessionStorage'),
    scrollX,scrollY};
  const local=createDiagnosticMemoryStorage(options.storage||{},!!options.quotaError);
  diagnosticFixtureStorages.add(local);
  const session=createDiagnosticMemoryStorage(options.sessionStorage||{});
  const restoreProperty=(name,descriptor)=>{try{if(descriptor)Object.defineProperty(window,name,descriptor);else delete window[name]}catch{}};
  try {
    Object.defineProperty(window,'localStorage',{configurable:true,enumerable:true,writable:true,value:local});
    Object.defineProperty(window,'sessionStorage',{configurable:true,enumerable:true,writable:true,value:session});
    if(options.confirm!==undefined)window.confirm=typeof options.confirm==='function'?options.confirm:()=>Boolean(options.confirm);
    if(options.fetch)window.fetch=options.fetch;
    db=structuredClone(options.db||empty());
    state={...state,...(options.state||{})};
    cdiState={...cdiState,rates:structuredClone(options.cdiRates||[]),loading:false,error:''};
    ipcaState={...ipcaState,rates:structuredClone(options.ipcaRates||[]),loading:false,error:''};
    vault=options.vault||null;vaultKey=options.vaultKey||null;vaultBusy=false;saving=false;
    storageRecoveryRaw=null;recoveryArchived=false;loadedStoreRaw=local.getItem(STORE);integrityContainmentLock=false;backupDirectory=options.backupDirectory||null;
    backupConflict=false;folderKey=options.folderKey||null;folderSalt=options.folderSalt||null;hideValues=!!options.hideValues;
    return await run({localStorage:local,sessionStorage:session});
  } finally {
    db=original.db;state=original.state;cdiState=original.cdiState;ipcaState=original.ipcaState;
    vault=original.vault;vaultKey=original.vaultKey;vaultBusy=original.vaultBusy;saving=original.saving;
    loadedStoreRaw=original.loadedStoreRaw;integrityContainmentLock=original.integrityContainmentLock;
    hideValues=original.hideValues;storageRecoveryRaw=original.storageRecoveryRaw;recoveryArchived=original.recoveryArchived;
    backupDirectory=original.backupDirectory;backupConflict=original.backupConflict;folderKey=original.folderKey;folderSalt=original.folderSalt;
    restoreProperty('confirm',original.confirm);restoreProperty('fetch',original.fetch);
    restoreProperty('localStorage',original.localStorage);restoreProperty('sessionStorage',original.sessionStorage);
    try{render();window.scrollTo({left:original.scrollX,top:original.scrollY,behavior:'instant'})}catch{}
  }
}
async function runDataSecurityTests() {
  const tests = [];
  async function check(id, name, run) {
    const start = performance.now();
    let status;
    try {
      const result = await run();
      status = result === null ? 'ignorado' : result ? 'ok' : 'falha';
    } catch { status = 'erro'; }
    tests.push({id,name,status,durationMs:Math.round(performance.now()-start),
      ...(status === 'ignorado' ? {reason:'Web Crypto indisponível ou preparação do teste falhou'} : {})});
  }

  const marker = 'marcador-ficticio-de-privacidade';
  await check('SEG-01','Exportação exclui mensagem, pilha e contexto arbitrário de eventos', () => {
    const report = diagnosticReport(null,{events:[{code:'javascript.error',type:'TypeError',
      line:17,stack:marker,message:marker,password:marker,trail:[{action:marker}],
      module:marker,version:marker}]});
    const event = report.events[0];
    return !JSON.stringify(report).includes(marker) && event.line === 17 && event.type === 'TypeError';
  });
  const allocation = {id:'seg-a',jarId:'seg-j',amount:100,date:'2027-01-01'};
  await check('SEG-02','Validador rejeita movimentação sem cofrinho correspondente', () =>
    verify({...empty(),allocations:[allocation]}) === null);
  await check('SEG-03','Validador rejeita histórico com resgate acima do saldo', () =>
    verify({...empty(),jars:[{id:'seg-j',name:'Teste',target:500,dueDate:'2027-12-31'}],
      allocations:[allocation,{...allocation,id:'seg-b',date:'2027-01-02',amount:-101}]}) === null);

  let key, envelope, second;
  const salt = new Uint8Array(16);
  await check('SEG-04','Chave derivada não pode ser exportada e o cofre usa AES-GCM', async () => {
    if (!globalThis.crypto?.subtle) return null;
    key = await deriveVaultKey('senha fictícia de diagnóstico',salt);
    envelope = await sealVault(empty(),key,bytesTo64(new Uint8Array(16)));
    second = await sealVault(empty(),key,bytesTo64(new Uint8Array(16)));
    return key.extractable === false && key.algorithm.name === 'AES-GCM';
  });
  await check('SEG-05','Cifragens sucessivas geram IVs distintos de 12 bytes', () =>
    envelope && second ? from64(envelope.iv).length === 12 &&
      from64(second.iv).length === 12 && envelope.iv !== second.iv : null);
  const rejects = async candidate => {
    try { await openVault(candidate,key); return false; }
    catch (error) { return error.name === 'OperationError'; }
  };
  await check('SEG-06','Cofre rejeita conteúdo cifrado alterado', () => {
    if (!envelope) return null;
    const bytes = from64(envelope.data);
    bytes[0] ^= 1;
    return rejects({...envelope,data:bytesTo64(bytes)});
  });
  await check('SEG-07','Cofre rejeita conteúdo cifrado truncado', () => {
    if (!envelope) return null;
    return rejects({...envelope,data:bytesTo64(from64(envelope.data).slice(0,-1))});
  });
  await check('SEG-08','Cofre rejeita IV alterado', () => {
    if (!envelope) return null;
    const iv = from64(envelope.iv);
    iv[0] ^= 1;
    return rejects({...envelope,iv:bytesTo64(iv)});
  });
  await check('SEG-09','Cofre rejeita esquema inválido mesmo após decifrar', async () => {
    if (!key) return null;
    const invalid = await sealVault({...empty(),version:99},key,bytesTo64(new Uint8Array(16)));
    try { await openVault(invalid,key); return false; }
    catch (error) { return error.message === 'Dados inválidos'; }
  });
  await check('SEG-11','Validador aceita envelope cifrado com salt, IV e dados no tamanho esperado', () => {
    if (!envelope) return null;
    return validateVaultEnvelope(envelope) === envelope &&
      from64(envelope.salt).length === 16 && from64(envelope.iv).length === 12 &&
      from64(envelope.data).length >= 16;
  });
  await check('SEG-12','Validador rejeita envelope com salt ou IV inválido e campos extras', () => {
    if (!envelope) return null;
    const rejectsStructure = candidate => {
      try { validateVaultEnvelope(candidate); return false; }
      catch { return true; }
    };
    return rejectsStructure({...envelope,salt:bytesTo64(new Uint8Array(8))}) &&
      rejectsStructure({...envelope,iv:bytesTo64(new Uint8Array(8))}) &&
      rejectsStructure({...envelope,records:[{amount:999}]});
  });
  await check('SEG-13','Pré-validação de backup confirma os dados fictícios antes de persistir', async () => {
    if (!key) return null;
    const fixture = {...empty(),records:[{id:'seg13-fixture',kind:'expense',category:'Outros',amount:100,date:'2027-02-01',note:'QA_BACKUP_FIXTURE'}]};
    const candidate = await sealVault(fixture,key,bytesTo64(new Uint8Array(16)));
    const reopened = await openVault(candidate,key);
    return JSON.stringify(reopened) === JSON.stringify(verify(fixture)) &&
      !JSON.stringify(candidate).includes('QA_BACKUP_FIXTURE');
  });
  await check('SEG-10','Esqueleto do app não exporta texto, links, atributos de dados ou valores de campos', () => {
    const marker='QA_DOM_SECRET_6a31';
    const root=document.createElement('section');root.id='page-qa';root.className='page';
    const label=document.createElement('span');label.textContent=marker;
    const input=document.createElement('input');input.value=marker;input.setAttribute('data-private',marker);
    const link=document.createElement('a');link.href='https://invalid.example/'+marker;link.textContent=marker;
    root.append(label,input,link);
    const snapshot=capturePageSkeleton(root,'qa','Fixture estrutural');
    const json=JSON.stringify(snapshot);
    return !json.includes(marker)&&snapshot.privacy.textIncluded===false&&snapshot.privacy.inputValuesIncluded===false;
  });
  return tests;
}

async function runProposalTests(scan) {
  const results = [];
  const record = {id:'proposta-r',date:'2027-01-01',kind:'expense',category:'Outros',amount:125};
  const legacy = version => ({version, records:[record], jars:[], allocations:[]});
  const migration = version => {
    const data = verify(legacy(version));
    return data?.version === 4 && data.records[0]?.amount === 125 &&
      Array.isArray(data.tasks) && Array.isArray(data.recurring);
  };
  const checks = {
    1: ['Duração por cenário novo registrada em milissegundos', () => results.every(item => item.durationMs >= 0)],
    2: ['Normalização real do esquema 2 para 4', () => migration(2)],
    3: ['Normalização real do esquema 3 para 4', () => migration(3)],
    4: ['Versão ausente ou inválida', () => [undefined,null,'4',99].every(version => !verify(legacy(version)))],
    5: ['Normalização idempotente dos três esquemas suportados', () => [2,3,4].every(version => {
      const normalized = verify(legacy(version));
      return normalized && JSON.stringify(normalized) === JSON.stringify(verify(normalized));
    })],
    9: ['Ciclo criptográfico integral em memória', async () => {
      if (!globalThis.crypto?.subtle) return null;
      const fixture = verify(legacy(4));
      const key = await deriveVaultKey('senha fictícia',new Uint8Array(16));
      return JSON.stringify(await openVault(await sealVault(fixture,key,bytesTo64(new Uint8Array(16))),key)) === JSON.stringify(fixture);
    }],
    12: ['Parser real de dois formatos de separador; arquivo misto fica fora', () =>
      [';',','].every(sep => {
        const csv = 'Data'+sep+'Valor'+sep+'Descrição\n2027-01-01'+sep+'12'+sep+'"A'+sep+'B"';
        return bankCsvDelimiter(csv) === sep && bankCsvParseRows(csv,sep)[1]?.[2] === 'A'+sep+'B';
      })],
    17: ['Validação de compromisso sem horário; botão Hoje fica fora', () =>
      verify({...empty(),tasks:[{id:'proposta-t',title:'Teste',date:'2027-01-01'}]})?.tasks[0]?.time === ''],
    20: ['Busca de cabeçalho ausente; fluxo de importação fica fora', () =>
      bankCsvHeaderIndex(['descrição','observação'],['data']) === -1],
    22: ['Validação cronológica de saldo; fluxo de resgate fica fora', () => {
      const rows = [{id:'a',jarId:'meta',amount:500,date:'2027-01-01'},
        {id:'b',jarId:'meta',amount:-501,date:'2027-01-02'}];
      return firstNegativeJarDate('meta',rows) === '2027-01-02' &&
        firstNegativeJarDate('meta',[rows[0],{...rows[1],amount:-500}]) === null;
    }],
    27: ['Serialização real do relatório e campos essenciais; download e auditoria de privacidade ficam fora', () => {
      const payload = JSON.parse(JSON.stringify(diagnosticReport({modules:[],syntheticChecks:[]})));
      return Array.isArray(payload.events) && Array.isArray(payload.scan.modules) &&
        payload.diagnosticContract.suiteVersion === DIAGNOSTIC_SUITE_VERSION;
    }],
    38: ['Referências ARIA a IDs no DOM atual', () =>
      [...document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns]')]
        .every(node => ['aria-labelledby','aria-describedby','aria-controls','aria-owns']
          .flatMap(attr => (node.getAttribute(attr)||'').split(/\s+/).filter(Boolean))
          .every(id => document.getElementById(id)))],
    41: ['30 regressões catalogadas com estado explícito', () =>
      scan.historicalRegressions.length === 30 &&
      new Set(scan.historicalRegressions.map(item => item.id)).size === 30 &&
      scan.historicalRegressions.every(item => item.status)],
    46: ['Presença e aridade dos pontos de integração; schemas comportamentais ampliados em LOC-01', () => !diagnosticContract().missing.length&&!diagnosticContract().brokenSignatures.length],
    48: ['Versões do app, contrato e suíte; commit do protótipo fica fora', () =>
      diagnosticContract().appVersion === APP_VERSION && diagnosticContract().version===2&&Boolean(DIAGNOSTIC_SUITE_VERSION)]
  };
  for (const [id,title] of PROPOSAL_TEST_PLAN) {
    const test = checks[id];
    if (!test) { results.push({id,title,status:'pendente'}); continue; }
    const [scope,run] = test;
    const started = performance.now();
    let status;
    try {
      const passed = await run();
      status = passed === null ? 'ignorado' : passed ? 'ok' : 'falha';
      if (id === 46 && !passed) status = 'contrato_incompativel';
    } catch { status = 'erro'; }
    results.push({id,title,scope,status,durationMs:Math.round(performance.now()-started)});
  }
  return results;
}

async function runLocProposalTests(onCaseProgress) {
  const definitions=[];
  const add=(id,title,run,scope='fixture isolada')=>definitions.push({id:'LOC-'+String(id).padStart(2,'0'),title,run,scope});
  const pending=(id,title,reason)=>definitions.push({id:'LOC-'+String(id).padStart(2,'0'),title,reason,scope:'pendente de implementação/ambiente'});
  const close=(a,b,tolerance=0)=>Math.abs(a-b)<=tolerance;
  const dateRecord=(id,kind,amount,date,extra={})=>({id,kind,amount,date,category:kind==='expense'?'Outros':'',source:kind==='income'?'salary':'',note:'fixture QA',subcategory:'',tags:[],...extra});

  add(1,'Contrato comportamental de APIs e schemas de retorno',()=>withDiagnosticSandbox({},()=>{
    const v=verify(empty()),month=Engines.monthData(empty(),2027,0);
    const required=['version','records','jars','allocations','investments','recurring','tasks','institutions','prefs'];
    const missing=required.filter(key=>!(key in (v||{})));
    const monthly=['income','expenses','saved','available'].filter(key=>!(key in (month||{})));
    const contract=diagnosticContract();
    return {passed:!missing.length&&!monthly.length&&!contract.missing.length&&!contract.brokenSignatures.length,
      evidence:{missing,monthly,missingFunctions:contract.missing,brokenSignatures:contract.brokenSignatures,contractVersion:contract.version}};
  }));
  add(2,'Rotas e estado visual das páginas',()=>withDiagnosticSandbox({},()=>{
    const outcomes=[];
    for(const [id] of PAGES){go(id);const active=[...document.querySelectorAll('.page.active')];
      outcomes.push({id,active:active.length===1&&active[0].id==='page-'+id});}
    return {passed:outcomes.every(x=>x.active),evidence:{routesChecked:outcomes.length,invalidRoutes:outcomes.filter(x=>!x.active).map(x=>x.id)}};
  }),'DOM real; navegação revertida ao final');
  add(3,'Reconciliação de totais entre motores e período',()=>withDiagnosticSandbox({state:{year:2027,month:4}},()=>{
    db.records.push(dateRecord('loc3-i1','income',500000,'2027-05-05'),dateRecord('loc3-i2','income',150000,'2027-05-10'),
      dateRecord('loc3-e1','expense',80000,'2027-05-12'),dateRecord('loc3-e2','expense',25000,'2027-05-15'));
    const m=Engines.monthData(db,2027,4),expectedIncome=650000,expectedExpenses=105000;
    return {passed:m.income===expectedIncome&&m.expenses===expectedExpenses,evidence:{income:m.income,expenses:m.expenses,expectedIncome,expectedExpenses}};
  }));
  add(4,'Projeção de caixa com lançamentos sintéticos após o saldo âncora',()=>withDiagnosticSandbox({},()=>{
    const today=isoToday(),anchor=shiftIso(today,-10),end=shiftIso(today,5);
    db.prefs.balanceAnchorCents=100000;db.prefs.balanceAnchorDate=anchor;
    db.records.push(dateRecord('loc4-i','income',50000,shiftIso(today,-5)),dateRecord('loc4-e','expense',20000,shiftIso(today,-2)),
      dateRecord('loc4-f','expense',35000,shiftIso(today,3)));
    const p=cashProjection(5),expectedNow=130000,expectedEnd=95000;
    return {passed:!!p&&p.nowBalance===expectedNow&&p.projected===expectedEnd&&p.dailyBalances[end]===expectedEnd,
      evidence:{nowBalance:p?.nowBalance,projected:p?.projected,expectedNow,expectedEnd}};
  }));
  add(5,'Recuperação isolada de JSON corrompido e quarentena única',()=>withDiagnosticSandbox({storage:{[STORE]:'{"version":4,"records":[corrompido'}},async({localStorage})=>{
    const raw=localStorage.getItem(STORE);load();const first=[...localStorage._map.keys()].filter(key=>key.startsWith(STORE+'-corrompido-')).length;
    load();const second=[...localStorage._map.keys()].filter(key=>key.startsWith(STORE+'-corrompido-')).length;
    const blocked=await save()===false&&localStorage.getItem(STORE)===raw;
    return {passed:first===1&&second===1&&blocked,evidence:{firstQuarantineCount:first,secondQuarantineCount:second,saveBlocked:blocked}};
  }));
  add(6,'Rollback quando o armazenamento isolado retorna QuotaExceededError',()=>withDiagnosticSandbox({quotaError:true},async()=>{
    const result=await mutate(()=>db.records.push(dateRecord('loc6','expense',1000,isoToday())));
    return {passed:result===false&&db.records.length===0,evidence:{mutationRejected:result===false,rollbackComplete:db.records.length===0}};
  }));
  add(7,'Limites restantes de verify e normalização de versões',()=>withDiagnosticSandbox({},()=>{
    const sample={id:'loc7',jarId:'loc7-j',amount:1,date:'2027-01-01'};
    const overAlloc=verify({...empty(),allocations:Array(50001).fill(sample)})===null;
    const overRecurring=verify({...empty(),recurring:Array(5001).fill({id:'r',amount:1,day:1,startMonth:'2027-01'})})===null;
    const overTasks=verify({...empty(),tasks:Array(10001).fill({id:'t',title:'x',date:'2027-01-01'})})===null;
    const overInvest=verify({...empty(),investments:Array(5001).fill({id:'i',name:'x'})})===null;
    const migration=[2,3,4].every(version=>verify({...empty(),version})?.version===4);
    return {passed:overAlloc&&overRecurring&&overTasks&&overInvest&&migration,evidence:{overAlloc,overRecurring,overTasks,overInvest,migration}};
  }));
  add(8,'Validação de senha curta e confirmação divergente do cofre',()=>withDiagnosticSandbox({},async()=>{
    const dialog=$('#vaultDialog');if(!dialog||!$('#vaultPassword')||!$('#vaultConfirm'))return{unsupported:true,reason:'Campos do cofre não encontrados'};
    dialog.dataset.mode='setup';let shortBlocked=false,mismatchBlocked=false;
    $('#vaultPassword').value='12345678901';$('#vaultConfirm').value='12345678901';$('#vaultError').textContent='';
    await submitVault({preventDefault(){}});shortBlocked=$('#vaultError').textContent.includes('12 caracteres');
    vaultBusy=false;$('#vaultPassword').value='SenhaForte123!';$('#vaultConfirm').value='OutraSenha123!';$('#vaultError').textContent='';
    await submitVault({preventDefault(){}});mismatchBlocked=$('#vaultError').textContent.includes('confirme a senha');
    return {passed:shortBlocked&&mismatchBlocked,evidence:{shortPasswordBlocked:shortBlocked,mismatchBlocked}};
  }));
  add(9,'Relatório técnico e telemetria não carregam marcador de segredo',()=>withDiagnosticSandbox({},()=>{
    const marker='QA_SEGREDO_NAO_EXPORTAR_9f3c';
    const report=diagnosticReport(null,{events:[{code:'javascript.error',type:'TypeError',message:marker,stack:marker,password:marker,context:{secret:marker}}]});
    const leaked=JSON.stringify(report).includes(marker);
    return {passed:!leaked,evidence:{secretMarkerLeaked:leaked}};
  }));
  pending(10,'Adaptador de backup em pasta: escrita, recriação e permissão','O fluxo de pasta depende de diretório criptografado e de um adaptador fake específico; não foi simulado nesta rodada para evitar relatar sucesso de persistência do SO.');
  pending(11,'Ciclo completo de lançamento: criar, editar, cancelar e excluir','O submit do formulário é assíncrono e ainda precisa de um harness de eventos isolado que valide cada etapa sem interferir no modal ativo.');
  add(12,'Pré-condições para cópia mensal: datas válidas e fixture normalizada',()=>withDiagnosticSandbox({},()=>{
    const feb28=validDate('2027-02-28'),bad=validDate('2027-02-31');
    const source=empty();source.records=[dateRecord('copy','expense',20000,'2027-01-31')];
    const normalized=verify(source);return {passed:feb28&&!bad&&normalized?.records.length===1,evidence:{februaryDateValid:feb28,invalidDayRejected:!bad,fixtureValid:!!normalized}};
  }));
  add(13,'Importação CSV: datas e valores contábeis de referência',()=>withDiagnosticSandbox({},()=>{
    const dateOk=bankCsvDate('2027-05-10')==='2027-05-10'&&bankCsvDate('10/05/2027')==='2027-05-10';
    const moneyOk=bankCsvMoney('(1.234,56)')===-123456&&bankCsvMoney('1.234,56')===123456;
    const parsed=bankCsvParseRows('Data;Valor\n2027-05-10;1.234,56', ';');
    return {passed:dateOk&&moneyOk&&parsed.length===2,evidence:{dateFormatsOk:dateOk,moneyFormatsOk:moneyOk,parsedRows:parsed.length}};
  }));
  add(14,'Recorrências: vencimento hoje e atraso com data do sistema',()=>withDiagnosticSandbox({},()=>{
    const today=isoToday(),[y,m,d]=today.split('-').map(Number),period=mkey(y,m-1);
    db.recurring.push({id:'loc14-today',kind:'expense',amount:1000,category:'Outros',day:d,startMonth:period,paused:false,note:'Fixture'});
    const row=upcomingBillInstances(2).find(item=>item.id==='loc14-today');
    return {passed:!!row&&row.daysUntil===0&&row.daysLate===0,evidence:{dueToday:row?.daysUntil===0,daysLate:row?.daysLate}};
  }));
  add(15,'Calendário: movimentos e tarefa no mesmo dia',()=>withDiagnosticSandbox({},()=>{
    db.records.push(dateRecord('loc15-i','income',100,'2027-06-15'),dateRecord('loc15-e','expense',50,'2027-06-15'));
    db.tasks.push({id:'loc15-t',title:'Fixture',date:'2027-06-15',time:'',color:'purple',done:false});
    const events=calendarEventsForMonth(2027,5).get('2027-06-15')||[];
    const kinds=new Set(events.map(item=>item.kind));return {passed:kinds.has('income')&&kinds.has('expense')&&kinds.has('task'),evidence:{eventKinds:[...kinds]}};
  }));
  add(16,'CDB: tabela de IOF/IR e ausência de CDI',()=>withDiagnosticSandbox({cdiRates:[]},()=>{
    db.jars.push({id:'loc16-j',name:'Fixture',target:500000,dueDate:'2027-12-31',institutionId:'inter-default'});
    db.allocations.push({id:'loc16-a',jarId:'loc16-j',amount:100000,date:'2025-01-01'});
    const noRates=estimateCdbJar('loc16-j','2025-06-01');cdiState.rates=[{date:'2025-01-02',value:10}];
    const early=estimateCdbJar('loc16-j','2025-01-02'),late=estimateCdbJar('loc16-j','2026-12-23');
    return {passed:!noRates.hasRates&&noRates.net===100000&&early.iof>=0&&late.iof===0&&late.net<=late.gross,
      evidence:{noRatesPreservedPrincipal:noRates.net===100000,earlyTaxNonnegative:early.iof>=0,lateIofZero:late.iof===0,agingCases:3}};
  }));
  add(17,'CDB: saldo remanescente após resgate em múltiplos lotes (checagem FIFO indireta)',()=>withDiagnosticSandbox({},()=>{
    db.jars.push({id:'loc17-j',name:'FIFO fixture',target:500000,dueDate:'2027-12-31',institutionId:'inter-default'});
    db.allocations.push({id:'loc17-a1',jarId:'loc17-j',amount:100000,date:'2025-01-01'},
      {id:'loc17-a2',jarId:'loc17-j',amount:200000,date:'2025-01-15'},
      {id:'loc17-a3',jarId:'loc17-j',amount:-150000,date:'2025-01-20'});
    cdiState.rates=[{date:'2025-01-10',value:10},{date:'2025-02-01',value:10}];
    const out=estimateCdbJar('loc17-j','2025-03-01');
    return {passed:out.principal===150000&&out.gross>=out.principal&&out.net<=out.gross,evidence:{principal:out.principal,gross:out.gross,net:out.net}};
  }));
  add(18,'Cofrinho: rejeição cronológica de saldo negativo',()=>withDiagnosticSandbox({},()=>{
    const rows=[{id:'a',jarId:'j',amount:50000,date:'2027-01-10'},{id:'b',jarId:'j',amount:-30000,date:'2027-01-20'}];
    return {passed:firstNegativeJarDate('j',rows)===null&&firstNegativeJarDate('j',[rows[0],{...rows[1],amount:-50001}])==='2027-01-20',
      evidence:{validHistoryAccepted:firstNegativeJarDate('j',rows)===null,overdrawDate:firstNegativeJarDate('j',[rows[0],{...rows[1],amount:-50001}])}};
  }));
  pending(19,'Investimento em pecuária: gastos e venda proporcional','Fluxo depende de vários formulários dinâmicos e eventos encadeados; precisa de harness específico de lote isolado antes de ser marcado como validado.');
  add(20,'Monitoramento FGC/FGCoop agrupa instituição e compara referência',()=>withDiagnosticSandbox({},()=>{
    db.institutions.push({id:'loc20-1',name:'Banco QA',type:'bank',cdiPercent:100,guaranteeFund:'fgc',conglomerate:'Grupo QA',otherCoveredBalance:15000000},
      {id:'loc20-2',name:'Banco QA 2',type:'bank',cdiPercent:100,guaranteeFund:'fgc',conglomerate:'grupo qa',otherCoveredBalance:15000000});
    const html=guaranteeCard();return {passed:html.includes('Acima da referência')&&html.includes('300.000,00'),evidence:{capExceeded:html.includes('Acima da referência'),groupedExposure:html.includes('300.000,00')}};
  }));
  add(21,'Limite de Mercado: transições de aviso em 75% e 100%',()=>withDiagnosticSandbox({},()=>{
    const today=isoToday(),period=today.slice(0,7);db.prefs.marketBudget=10000;
    db.records.push(dateRecord('loc21-74','expense',7400,today,{category:'Mercado'}));const normal=groceryAlertLevel()===0;
    db.records[0].amount=7500;const warn=groceryAlertLevel()===1;
    db.records[0].amount=10000;const reached=groceryAlertLevel()===2;
    return {passed:normal&&warn&&reached,evidence:{below75:normal,at75:warn,at100:reached,period}};
  }));
  add(22,'Reserva de emergência vazia sem histórico não gera valores inválidos',()=>withDiagnosticSandbox({},()=>{
    const html=emergencyReserveCard();return {passed:html===''&&!/NaN|Infinity/.test(html),evidence:{emptyHistorySafe:html===''}};
  }));
  add(23,'Estrutura do backup e do relatório de diagnóstico',()=>withDiagnosticSandbox({},()=>{
    db.records.push(dateRecord('loc23','expense',100,'2027-01-01'));
    const backup=JSON.parse(JSON.stringify(backupPayload())),verified=verify(backup);
    const report=diagnosticReport({modules:[],applicationSkeleton:captureApplicationSkeleton([])}, {events:[]});
    return {passed:!!verified&&report.applicationSkeleton?.schemaVersion==='app-skeleton.v1'&&report.diagnosticContract.suiteVersion===DIAGNOSTIC_SUITE_VERSION,
      evidence:{backupRoundTrip:!!verified,skeletonIncluded:!!report.applicationSkeleton,contractVersion:report.diagnosticContract.suiteVersion}};
  }));
  pending(24,'CDI/IPCA: erros HTTP e concorrência com cache preservado','O HTML aberto por file:// bloqueia consulta externa; a bateria HTTP simulada fica separada até existir adaptador injetável para o pipeline de fetch.');
  pending(25,'Breakpoint CSS real em iframe isolado nas três larguras','A proposta clona a árvore ativa; antes de executar automaticamente, implementar clone DOM sem texto/atributos de usuário e validar CSP/origens em navegador.');
  add(26,'Privacidade: ocultação de valores no formatador de moeda',()=>withDiagnosticSandbox({hideValues:true},()=>{
    const hidden=money(432189);return {passed:!hidden.includes('4.321,89')&&!hidden.includes('4321,89'),evidence:{formattedValueHidden:!hidden.includes('4.321,89')}};
  }));
  pending(27,'Contraste WCAG nas paletas e modos claro/escuro','A medição confiável requer pares texto/fundo efetivamente renderizados em cada paleta; gradientes e transparências devem permanecer inconclusivos.');
  add(48,'Registro rápido mantém os campos essenciais e os detalhes recolhidos',()=>withDiagnosticSandbox({},()=>{
    try{
      return {passed:['expense','income'].every(mode=>{
        openModal(mode,null,true);
        const form=$('#entryForm'), more=form?.querySelector('.quick-entry-more');
        return more&&!more.open&&Boolean(more.querySelector('#date')?.value)&&['amount','note',mode==='income'?'type':'category'].every(id=>{
          const field=form.querySelector('#'+id);
          return field&&!more.contains(field);
        });
      })};
    }finally{if($('#modal').classList.contains('open'))closeModal(true);}
  }));
  add(49,'Insights calcula média de três meses e separa gastos recorrentes',()=>withDiagnosticSandbox({state:{year:2027,month:3}},()=>{
    db.records=[['01',10000],['02',20000],['03',30000]].map(([month,amount])=>({kind:'expense',category:'Mercado',date:'2027-'+month+'-01',amount}));
    const html=expenseComparisonCards({records:[{kind:'expense',category:'Mercado',date:'2027-04-01',amount:40000,recurringId:'qa'},{kind:'expense',category:'Outros',date:'2027-04-02',amount:5000}]});
    return {passed:html.includes('<td>'+money(20000)+'</td>')&&html.includes('Fixos: <strong>'+money(40000))&&html.includes('Variáveis: <strong>'+money(5000))};
  }));
  add(50,'Relatório diário compara acumulados de meses consecutivos',()=>withDiagnosticSandbox({state:{year:2027,month:1}},()=>{
    db.records=[{id:'qa-day-1',kind:'income',date:'2027-01-01',amount:10000},{id:'qa-day-2',kind:'income',date:'2027-02-02',amount:25000}];
    const doc=new DOMParser().parseFromString(dailyReportCard('2027-03-15'),'text/html');
    const preview=doc.querySelectorAll('.report-daily-card > .table-wrap tbody tr');
    const rows=doc.querySelectorAll('.report-daily-details tbody tr');
    return {passed:preview.length===10&&preview[0].cells[0].textContent==='28'&&preview[9].cells[0].textContent==='19'&&
      rows.length===28&&rows[26].cells[1].textContent===money(25000)&&rows[26].cells[2].textContent===money(10000)&&rows[27].cells[1].textContent===money(0)};
  }));
  add(51,'Calendário oferece criação e edição de notas em janela própria',()=>{
    const page=$('#page-calendar');
    const dialog=page?.querySelector('#calendarNoteDialog');
    return {passed:Boolean(page?.querySelector('[data-calendar-new-note]')&&dialog?.querySelector('#calendarNoteForm input[name="date"]')?.value&&dialog.matches('dialog'))};
  },'estrutura local do Calendário');
  add(47,'Notas mantêm data e fixação no backup',()=>{
    const sample={...empty(),notes:[{id:'qa-note',date:'2027-01-03',text:'Nota de teste',pinned:true}]};
    const note=verify(JSON.parse(JSON.stringify(sample)))?.notes[0];
    return {passed:note?.date==='2027-01-03'&&note.pinned&&verify({...sample,notes:[{...sample.notes[0],date:'2027-02-31'}]})===null};
  },'backup local do Calendário');
  add(46,'Calendário reúne agenda, tarefas e notas antes da grade mensal',()=>{
    const page=$('#page-calendar'), row=page.querySelector('.calendar-organizer');
    const titles=[...row.querySelectorAll(':scope > .card > .calendar-detail-head h3')].map(title=>title.textContent.trim());
    return {passed:titles.join('|')==='Agenda do dia|Tarefas|Notas'&&row.nextElementSibling?.matches('.calendar-card')&&page.querySelectorAll('[data-calendar-tab]').length===3&&Boolean($('#calendarComposeDialog #calendarTaskForm'))};
  },'estrutura local do Calendário');
  add(28,'Abertura e fechamento do modal com foco rastreável',()=>withDiagnosticSandbox({},()=>{
    const trigger=$('#headerSettings');trigger?.focus();openModal('income');const opened=$('#modal').getAttribute('aria-hidden')==='false';
    const focusInside=$('#modal').contains(document.activeElement);closeModal(true);const closed=$('#modal').getAttribute('aria-hidden')==='true';
    return {passed:opened&&focusInside&&closed,evidence:{opened,focusInside,closed}};
  }),'interação no DOM real com dados sintéticos');
  add(29,'Referências ARIA e nomes acessíveis nos controles presentes',()=>withDiagnosticSandbox({},()=>{
    const broken=[];for(const node of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns]'))
      for(const attr of ['aria-labelledby','aria-describedby','aria-controls','aria-owns'])
        for(const ref of (node.getAttribute(attr)||'').split(/\s+/).filter(Boolean))if(!document.getElementById(ref))broken.push(attr);
    const unnamed=[...document.querySelectorAll('button,input,select,textarea')].filter(node=>{
      if(node.disabled||node.hidden||node.closest('[hidden]'))return false;
      const css=getComputedStyle(node),rect=node.getBoundingClientRect();
      if(css.display==='none'||css.visibility==='hidden'||rect.width===0||rect.height===0)return false;
      const labelledBy=(node.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean);
      const labelledByText=labelledBy.map(id=>document.getElementById(id)?.textContent?.trim()||'').join(' ').trim();
      return !node.getAttribute('aria-label')&&!labelledByText&&!node.labels?.length&&!node.textContent.trim()&&!node.title;
    });
    return {passed:!broken.length&&!unnamed.length,evidence:{brokenAriaReferenceCount:broken.length,unnamedControlCount:unnamed.length}};
  }));
  add(30,'Benchmark escalado de verificação com fixtures sintéticas',()=>withDiagnosticSandbox({},()=>{
    const timings={};for(const n of [100,1000,10000]){
      const fixture=empty();fixture.records=Array.from({length:n},(_,i)=>dateRecord('perf-'+i,i%4?'expense':'income',100,'2027-01-01'));
      const start=performance.now(),out=verify(fixture);timings[n]=Math.round(performance.now()-start);
      if(!out)return {passed:false,evidence:{timings,failedAt:n}};
    }
    const bounded=timings[10000] < 60000;
    return {passed:bounded,evidence:{timings,limitMs:60000}};
  }),'benchmark sintético; não é garantia de desempenho em todo aparelho');

  add(52,'Hoje abre o formulário do módulo Orçamento',()=>withDiagnosticSandbox({state:{page:'home'}},()=>{
    render();
    $('#page-home [data-home-budget]').click();
    return {passed:state.page==='budget'&&Boolean($('#page-budget #categoryBudgetCard [data-category-budget-form]'))};
  }));
  add(53,'Orçamento registra gasto com cartão e vencimentos avulsos ou mensais',()=>withDiagnosticSandbox({state:{page:'budget'}},async()=>{
    try {
      render();
      $('#page-budget [data-home-finance-entry="card"]').click();
      const prefilled=$('#category').value==='Cartões';
      $('#amount').value='28.75';
      $('#date').value=isoToday();
      $('#note').value='Fatura de teste';
      await submitEntry({preventDefault(){}});
      const card=db.records.some(item=>item.amount===2875&&item.category==='Cartões')&&$('#page-budget .home-card-records')?.textContent.includes('Fatura de teste');
      for(const monthly of [false,true]){
        $('#page-budget [data-home-finance-entry="due"]').click();
        $('#amount').value='42';
        $('#note').value=monthly?'Conta mensal de teste':'Conta avulsa de teste';
        $('#dueEntryMonthly').checked=monthly;
        await submitEntry({preventDefault(){}});
      }
      const [single,monthly]=db.recurring;
      const bills=upcomingBillInstances(7);
      return {passed:prefilled&&card&&single?.endMonth===isoToday().slice(0,7)&&monthly?.endMonth===null&&bills.length===2&&state.page==='budget'};
    }finally{if($('#modal').classList.contains('open'))closeModal(true)}
  }));
  add(54,'Busca global encontra registros sem acentos e abre o investimento',()=>withDiagnosticSandbox({state:{page:'home'}},()=>{
    db.investments=[{id:'qa-invest-search',name:'Título de Liquidez',institution:'Inter',product:'CDB',date:'2027-01-03',checked:'2027-01-03',cost:10000,balance:10000}];
    render();
    const hit=searchReserva('titulo liquidez').find(item=>item.id==='qa-invest-search');
    openReservaSearchResult(hit);
    return {passed:!!hit&&state.page==='investments'&&Boolean($('#page-investments .investment-tile[open] [data-investment-edit="qa-invest-search"]'))};
  }));
  add(55,'Sino abre o fechamento do mês correto, inclusive na virada de ano',()=>withDiagnosticSandbox({},()=>{
    const closing=date=>desktopNotificationItems(date).find(item=>item.kind==='reports');
    const yearEnd=closing('2027-12-31'),yearStart=closing('2028-01-01'),leap=closing('2028-02-29');
    if(!yearEnd||!yearStart||!leap)return {passed:false};
    openDesktopNotification(yearStart);
    return {passed:yearEnd.date==='2027-12-31'&&yearStart.date==='2027-12-31'&&yearEnd.dismissalId!==yearStart.dismissalId&&
      leap.date==='2028-02-29'&&!closing('2027-12-15')&&state.page==='reports'&&$('#monthlyCloseChecklist')?.dataset.month==='2027-12'};
  }));
  add(56,'Hoje mantém atalhos, calendário e cadastro rápido de compromisso',()=>withDiagnosticSandbox({state:{page:'home'}},async()=>{
    try{
      render();
      const paired=Boolean($('#page-home .home-calendar-preview')&&$('#page-home [data-page="budget"]'));
      $('#page-home [data-home-new-task]').click();
      const dialog=$('#calendarComposeDialog'),form=$('#calendarTaskForm');
      const opened=dialog.open;
      form.elements.title.value='Compromisso de teste';
      await submitCalendarTask({preventDefault(){},target:form});
      return {passed:paired&&opened&&!dialog.open&&state.page==='home'&&db.tasks.some(task=>task.title==='Compromisso de teste')};
    }finally{if($('#calendarComposeDialog').open)$('#calendarComposeDialog').close()}
  }));
  add(57,'Carteira usa uma grade única ordenada por data',()=>withDiagnosticSandbox({},()=>{
    db.investments=['2027-01-01','2027-01-04','2027-01-04'].map((date,index)=>({id:'qa-position-'+index,name:'Posição '+index,institution:'Inter',product:'CDB',date,checked:date,cost:10000,balance:10000}));
    investments();
    const cards=[...document.querySelectorAll('.investment-card-grid > .investment-tile')];
    return {passed:cards.length===3&&cards.map(card=>card.querySelector('time')?.dateTime).join()===
      '2027-01-04,2027-01-04,2027-01-01'&&cards.every(card=>card.querySelector('[data-investment-edit]'))};
  }));

  add(58,'Calendários compartilham a escala de gastos lançados',()=>{
    const {levelFor}=calendarSpending(new Map([
      ['2027-01-01',[{source:'record',kind:'expense',value:-100}]],
      ['2027-01-02',[{source:'record',kind:'expense',value:-500}]],
      ['2027-01-03',[{source:'recurring',kind:'scheduled-expense',value:-900}]]
    ]));
    return {passed:levelFor('2027-01-01')===1&&levelFor('2027-01-02')===5&&levelFor('2027-01-03')===0};
  });

  add(59,'Gravação de outra aba preservada após rejeitar edição desatualizada',()=>withDiagnosticSandbox({},async({localStorage:store})=>{
    const foreign=empty();
    foreign.records.push(dateRecord('qa-other-tab','expense',321,'2027-01-04'));
    const raw=JSON.stringify(foreign);
    store.setItem(STORE,raw);
    const changed=await mutate(()=>db.records.push(dateRecord('qa-stale-tab','expense',123,'2027-01-05')));
    return {passed:!changed&&!db.records.length&&store.getItem(STORE)===raw&&await integrityBank()==='pendente'};
  }));

  add(60,'Previsão no Orçamento e no Calendário vira um único lançamento',()=>withDiagnosticSandbox({
    confirm:true,state:{year:2028,month:1,page:'budget'}},async()=>{
    db.recurring=[{id:'qa-bill',kind:'expense',amount:2500,day:31,category:'Água',
      startMonth:'2028-01',endMonth:'2028-02',note:'Conta sintética'}];
    render();
    const date='2028-02-29';
    const before=calendarEventsForMonth(2028,1).get(date)||[];
    const pending=pendingRecurring();
    await applyRecurring();
    await applyRecurring();
    const after=calendarEventsForMonth(2028,1).get(date)||[];
    return {passed:pending.length===1&&pending[0].date===date&&
      before.some(item=>item.kind==='scheduled-expense')&&!after.some(item=>item.kind==='scheduled-expense')&&
      db.records.length===1&&Engines.monthData(db,2028,1).expenses===2500};
  }));

  add(61,'A navegação liga os nove módulos na barra lateral e no menu móvel',()=>{
    const interfaces=integrityInterface();
    return {passed:interfaces.every(item=>item.status==='aprovada')&&$('#mobileNav').children.length===5&&
      Boolean($('#mobileNav [data-page="budget"], #mobileMoreDialog [data-page="budget"]'))};
  });

  const historical=[
    [31,'H1 · Cópia de despesas e vínculo com investimento',()=>({pending:true,reason:'Ciclo de formulário ainda sem isolamento completo'})],
    [32,'H2 · Cálculo de metas e CDI',()=>({pass:typeof cdiBounds([{date:'2027-01-01',value:1}],100).factor==='function'})],
    [33,'H3 · Limpeza não pode depender da API de pasta',()=>({pending:true,reason:'Exige adaptador de pasta fake ligado às funções reais'})],
    [34,'H4 · Relatório/PDF mantém estrutura sem truncamento',()=>({pass:typeof htmlReportToModel==='function'})],
    [35,'H5 · CSS de impressão mantém colunas',()=>({pending:true,reason:'Verificar as colunas na prévia de impressão do relatório gerado. O CSS do relatório é criado separadamente.'})],
    [36,'H6 · Lote vendido permanece editável sem reabrir saldo',()=>({pending:true,reason:'Exige fluxo de edição de investimento em DOM isolado'})],
    [37,'H8 · Custo proporcional de venda parcial',()=>({pending:true,reason:'Exige fluxo de venda parcial e despesas de pecuária isolado'})],
    [38,'H9 · Atualização não registra abandono indevido',()=>({pending:true,reason:'Exige simulação de ciclo de vida do service worker'})],
    [39,'H10 · Backup em pasta trata NotFoundError',()=>({pending:true,reason:'Exige adaptador fake de diretório ligado ao gravador real'})],
    [40,'H11 · Categoria Outros tem cor cadastrada',()=>({pass:CATS.includes('Outros')&&Boolean(CAT_COLORS[CATS.indexOf('Outros')])})],
    [41,'H12 · Percentual de renda comprometida',()=>withDiagnosticSandbox({state:{year:2027,month:4}},()=>{db.records=[dateRecord('h12-i','income',100000,'2027-05-05'),dateRecord('h12-e','expense',60000,'2027-05-06')];return {pass:close((100000-40000)/100000*100,60),evidence:{percentage:60}}})],
    [42,'H13 · Resgate líquido entra no fluxo de caixa',()=>withDiagnosticSandbox({state:{year:2027,month:0}},()=>{db.jars.push({id:'h13-j',name:'fixture',target:10000,dueDate:'2027-12-31'});db.allocations.push({id:'h13-a',jarId:'h13-j',amount:-40000,netReceived:43500,date:'2027-01-10'});const m=Engines.monthData(db,2027,0);return {pass:m.saved===-43500,evidence:{netReceivedApplied:m.saved}}})],
    [43,'H14 · CDI usa limite da data do evento',()=>({pass:close(cdiBounds([{date:'2027-01-10',value:1}],100).factor('2027-01-10','2027-01-10'),1)})],
    [44,'H18 · Limites de Mercado não duplica orçamento de categoria',()=>withDiagnosticSandbox({},()=>{const v=verify({...empty(),prefs:{...empty().prefs,marketBudget:80000,categoryBudgets:{Mercado:90000,Luz:10000}}});return {pass:!!v&&!('Mercado' in v.prefs.categoryBudgets),evidence:{marketExcluded:!!v&&!('Mercado' in v.prefs.categoryBudgets)}}})],
    [45,'H21 · Metas respeitam o mês selecionado',()=>withDiagnosticSandbox({},()=>{const fixture=empty(),jar={id:'h21-j',name:'fixture',target:100000,dueDate:'2027-12-31'};fixture.jars.push(jar);const a=Engines.goal(fixture,jar,2027,0),b=Engines.goal(fixture,jar,2027,6);return {pass:a?.monthsRemaining!==b?.monthsRemaining,evidence:{jan:a?.monthsRemaining,jul:b?.monthsRemaining}}})]
  ];
  for(const [id,title,run] of historical)add(id,title,run,'regressão histórica; fixture isolada');

  const results=[];
  for(let index=0;index<definitions.length;index++){
    const item=definitions[index];
    if(onCaseProgress)await onCaseProgress(index+1,definitions.length,item.id,item.title);
    const start=performance.now();let status='pendente',evidence,reason=item.reason;
    if(item.run){try{const result=await item.run();
      if(result?.unsupported){status='não_suportado';reason=result.reason||'Recurso indisponível';}
      else if(result?.pending){status='pendente';reason=result.reason;}
      else {status=result?.passed===true||result?.pass===true?'ok':'falha';evidence=result?.evidence;}
    }catch(error){status='erro';reason='Exceção sanitizada: '+(['Error','TypeError','ReferenceError','SyntaxError','RangeError','AbortError','QuotaExceededError','InvalidStateError','DataError'].includes(error?.name)?error.name:'Error');}}
    results.push({id:item.id,title:item.title,scope:item.scope,status,durationMs:Math.round(performance.now()-start),...(evidence?{evidence}:{}),...(reason?{reason}:{})});
  }
  return results;
}

async function runDiagnosticScan(onProgress) {
  responsiveNavigationMatrixCache = null;
  const start = performance.now();
  const scan = scanDiagnosticPage(state.page);
  scan.startedAt = new Date().toISOString();
  scan.executionBudgetMs = 60000;
  scan.modules = [];
  const skeletonModules = [];
  scan.syntheticChecks = scanSyntheticFinance();
  scan.testPlan = runPlannedRegressionTests();
  const pages = [...document.querySelectorAll('.page')];
  const active = pages.filter(page => page.classList.contains('active'));
  const current = document.body.dataset.currentPage;
  const x = window.scrollX, y = window.scrollY;
  try {
    for (const [index, [id, title]] of PAGES.entries()) {
      await onProgress(index+1, title, 40*(index+1)/PAGES.length);
      const target = document.getElementById('page-' + id);
      if (!target) {
        scan.modules.push({module:id, title, checks:[{name:'Tela do módulo', status:'erro', reason:'Tela ausente'}]});
        continue;
      }
      document.body.dataset.currentPage = id;
      pages.forEach(page => page.classList.toggle('active', page === target));
      window.scrollTo({top:0,left:0,behavior:'instant'});
      scan.modules.push({...scanDiagnosticPage(id, true), title, scenarios:scanInternalViews(target,id)});
      skeletonModules.push(capturePageSkeleton(target,id,title));
    }
  } finally {
    pages.forEach(page => page.classList.toggle('active', active.includes(page)));
    if (current === undefined) delete document.body.dataset.currentPage;
    else document.body.dataset.currentPage = current;
    window.scrollTo({top:y,left:x,behavior:'instant'});
  }
  scan.applicationSkeleton = captureApplicationSkeleton(skeletonModules);
  await onProgress(PAGES.length+1, "Testes locais adicionais", 45);
  scan.additionalTestPlan = await runAdditionalLocalTests(scan);
  await onProgress(PAGES.length+2, "Regressões históricas", 50);
  scan.historicalRegressions = historicalRegressions(scan);
  await onProgress(PAGES.length+3, "Propostas N e contrato", 55);
  scan.proposalTests = await runProposalTests(scan);
  await onProgress(PAGES.length+4, "Novos testes LOC — preparando", 58);
  scan.locTests = await runLocProposalTests(async(index,total,id,title)=>{
    const pct=58+(index/total)*35;
    await onProgress(PAGES.length+4, id+' · '+title, pct);
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  });
  await onProgress(PAGES.length+5, "Verificações de segurança", 94);
  scan.dataSecurityTests = await runDataSecurityTests();
  await onProgress(PAGES.length+6, "Esqueleto do aplicativo e fechamento do JSON", 98);
  scan.durationMs = Math.round(performance.now()-start);
  scan.completedAt = new Date().toISOString();
  const statusCounts = items => (items||[]).reduce((counts,item)=>{
    const key=String(item.status||item.result||'sem_status').toLowerCase();
    counts[key]=(counts[key]||0)+1;return counts;
  },{});
  const testSuites={loc:scan.locTests,propostas:scan.proposalTests,seguranca:scan.dataSecurityTests,
    testesAdicionais:scan.additionalTestPlan,regressoesHistoricas:scan.historicalRegressions};
  scan.testSuiteSummary={executionBudgetMs:scan.executionBudgetMs,durationMs:scan.durationMs,
    withinExecutionBudget:scan.durationMs<=scan.executionBudgetMs,
    suites:Object.fromEntries(Object.entries(testSuites).map(([name,items])=>[name,{total:items?.length||0,statusCounts:statusCounts(items)}])),
    locCoverage:{total:scan.locTests.length,implemented:scan.locTests.filter(x=>['ok','falha','erro'].includes(x.status)).length,
      passed:scan.locTests.filter(x=>x.status==='ok').length,failed:scan.locTests.filter(x=>x.status==='falha').length,
      errors:scan.locTests.filter(x=>x.status==='erro').length,pending:scan.locTests.filter(x=>x.status==='pendente').length,
      unsupported:scan.locTests.filter(x=>x.status==='não_suportado').length}};
  latestDiagnosticScan = scan;
  return scan;
}
function historicalRegressions(scan) {
  const catalog = [
    ['Cópia de despesas perde vínculo com investimento','auditoria'],
    ['Cálculo de metas e CDI incorreto','auditoria'],
    ['Limpeza da base depende da API de pasta','auditoria'],
    ['PDF com conteúdo truncado','auditoria'],
    ['PDF com colunas colapsadas','auditoria'],
    ['Edição de lote vendido bloqueada pelo mínimo de cabeças','auditoria'],
    ['Exclusão de investimento deixa despesas órfãs','auditoria'],
    ['Carteira ignora resgates ou vendas parciais','auditoria'],
    ['Atualização dispara alerta de abandono','auditoria'],
    ['Backup em pasta falha com NotFoundError','auditoria'],
    ['Categoria Outros sem cor','auditoria'],
    ['Percentual de renda comprometida divergente','auditoria'],
    ['Valor líquido do resgate incorreto','auditoria'],
    ['CDI usa data fixa ou exclui o dia do aporte','auditoria'],
    ['Projeção ignora recorrências vencidas','auditoria'],
    ['CSV interpreta milhares e centavos incorretamente','auditoria'],
    ['CSV falha ao identificar importação repetida','auditoria'],
    ['Limites de Mercado duplicados','auditoria'],
    ['Navegação móvel inconsistente com módulos existentes','auditoria'],
    ['Saldo de Hoje diverge do saldo esperado','outro chat'],
    ['Previsões e metas ignoram o mês selecionado','outro chat'],
    ['Controles do Android encobrem a interface','outro chat'],
    ['Restauração Windows falha ao criar banco temporário','outro chat'],
    ['Compilação Windows falha na leitura do banco cifrado','outro chat'],
    ['Controles sobrepostos no cabeçalho desktop','prints'],
    ['Título Hoje duplicado no desktop','prints'],
    ['Lacunas e cartões esticados no desktop','prints'],
    ['Barras vazias nas abas de Insights','prints'],
    ['Abas de Insights encobrem o conteúdo durante a rolagem','prints'],
    ['Prévia local tenta atualizar e registrar service worker','logs']
  ];
  const findings = scan.modules.flatMap(module =>
    [module, ...(module.scenarios || [])].flatMap(view =>
      view.checks.flatMap(check => (check.findings || []).map(item => ({module:module.module,...item})))));
  const events = diagnostics.report().events;
  const coverage = {
    7: () => db.records.some(record => record.investmentId &&
      !db.investments.some(item => item.id === record.investmentId)),
    16: () => bankCsvMoney('R$ 1.234,56') !== 123456 ||
      bankCsvMoney('(1.234,56)') !== -123456,
    17: () => {
      const sample = {date:'2026-01-01',kind:'expense',amount:123456,note:'Café'};
      return bankCsvRecordKey(sample) !== bankCsvRecordKey({...sample,note:'  Cafe  '});
    },
    19: () => scan.modules.some(module => module.checks.some(check => check.status === 'erro' &&
      check.name === 'Tela do módulo')),
    25: () => findings.filter(item => item.type === 'sobreposição no cabeçalho'),
    26: () => findings.filter(item => item.type === 'título Hoje duplicado'),
    27: () => findings.filter(item => /lacuna excessiva|espaço vazio/.test(item.type)),
    28: () => [...document.querySelectorAll('#page-analysis > .mobile-analysis-panel[hidden]')]
      .some(panel => getComputedStyle(panel).display !== 'none'),
    30: () => !supportsHostedApp() && events.some(event =>
      ['offline.registration_failed','update.check_failed'].includes(event.code) &&
      Date.parse(event.at) >= Date.parse(scan.startedAt || scan.at))
  };
  return catalog.map(([name,source],index) => {
    const id = index+1;
    const run = coverage[id];
    if (!run || (id === 7 && vault && !vaultKey) ||
        (id === 28 && !matchMedia('(max-width:760px)').matches))
      return {id,name,source,status:'pendente',reason:'Requer cenário específico ou teste na plataforma'};
    try {
      const result = run();
      const count = Array.isArray(result) ? result.length : Number(Boolean(result));
      return {id,name,source,status:count?'alerta':'ok',count,
        scope:'Verificação parcial',...(Array.isArray(result)?{findings:result.slice(0,20)}:{})};
    } catch { return {id,name,source,status:'erro',reason:'Falha na execução da verificação'}; }
  });
}
function exportDiagnosticLog() {
  const events = diagnosticReport(latestDiagnosticScan).events;
  download(events.map(event=>JSON.stringify(event)).join('\n')+(events.length?'\n':''),
    'application/x-ndjson;charset=utf-8', 'Reserva_Simples_telemetria.jsonl');
}
function diagnosticChecks(scan){
  return [
    ...scan.checks,...scan.syntheticChecks,...scan.dataSecurityTests,...scan.proposalTests,...scan.locTests,
    ...scan.additionalTestPlan,...scan.historicalRegressions,
    ...scan.testPlan.map(test=>({id:test.id,name:test.title,status:test.result==='pendente'?(test.status==='manual'?'manual':'pendente'):test.result})),
    ...scan.modules.flatMap(module=>[...module.checks,...(module.scenarios||[]).flatMap(scenario=>scenario.checks)])
  ];
}
let diagnosticRunning = false;
function canStartDiagnostic(){
  if(diagnosticRunning)return false;
  if(saving||vaultBusy||cdiState.loading||ipcaState.loading||updateInProgress||integrityMonitoring){
    notify('Aguarde a operação em andamento antes de iniciar o diagnóstico.');
    return false;
  }
  return true;
}
async function generateDiagnosticWithProgress() {
  if (!canStartDiagnostic()) return;
  diagnosticRunning = true;
  const dialog = document.createElement('dialog');
  dialog.id = 'diagnosticProgressDialog';
  dialog.setAttribute('aria-labelledby','diagnosticProgressTitle');
  dialog.innerHTML = '<h2 id="diagnosticProgressTitle">Gerando diagnóstico</h2>' +
    '<p role="status">Preparando verificações…</p><progress aria-label="Progresso do diagnóstico"></progress>';
  const status = dialog.querySelector('p');
  const bar = dialog.querySelector('progress');
  bar.max = 100;
  bar.value = 0;
  dialog.addEventListener('cancel', event => event.preventDefault());
  document.body.append(dialog);
  const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
  try {
    dialog.showModal();
    const started = performance.now();
    await wait(450);
    const scan = await runDiagnosticScan(async (step,title,percent) => {
      bar.value = Number.isFinite(percent)?percent:Math.min(40,step/PAGES.length*40);
      status.textContent = title+' · '+Math.round(bar.value)+'%';
      await wait(Math.max(0, 14500 * bar.value / 100 - (performance.now() - started)));
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    });
    bar.value = Math.max(bar.value, 95);
    status.textContent = 'Preparando arquivo de logs…';
    await wait(Math.max(350, 14700 - (performance.now() - started)));
    bar.value = 100;
    status.textContent = 'Diagnóstico concluído';
    await wait(300);
    const checks = diagnosticChecks(scan).filter(item=>!['pendente','ignorado','não_suportado','manual'].includes(item.status));
    const alerts = checks.filter(item => ['erro','alerta','falha','contrato_incompativel'].includes(item.status)).length;
    const loc=scan.testSuiteSummary.locCoverage;
    const output = $('#diagnosticScanStatus');
    if (output) output.textContent = scan.modules.length + ' módulos · ' + checks.length +
      ' verificações · LOC: ' + loc.passed + ' aprovados, ' + (loc.failed+loc.errors) +
      ' falhas/erros, ' + loc.pending + ' pendentes e ' + loc.unsupported + ' não suportados · ' +
      scan.durationMs + ' ms · ' + alerts + ' alerta(s) ou erro(s)' +
      (scan.testSuiteSummary.withinExecutionBudget?'':' · limite de 60 s excedido') + '.';
    exportDiagnosticLog();
  } catch (error) {
    diagnostics.record('diagnostic.generation_failed',error);
    const message = $('#diagnosticScanStatus');
    if (message) message.textContent = 'Falha ao gerar o diagnóstico. Tente novamente.';
  } finally {
    dialog.close();
    dialog.remove();
    diagnosticRunning = false;
  }
}
document.addEventListener('click', event => {
  if (event.target.closest('#settingsPrivacyToggle')) {
    $('#privacyToggle').click();
    $('#settingsPrivacyToggle')?.focus();
    return;
  }
  if (event.target.closest('#runDiagnosticScan')) {
    void generateDiagnosticWithProgress();
    return;
  }
  if (event.target.closest('#exportDiagnostics')) {
    exportDiagnosticLog();
  }
  if (event.target.closest('#clearDiagnostics') && confirm('Apagar o histórico de diagnóstico?')) {
    diagnostics.clear();
    latestDiagnosticScan = null;
    settings();
  }
});
function go(page){if(page==='income'||page==='expense'){state.txFilter=page;page='transactions'}const next=PAGES.some(p=>p[0]===page)?page:'home';state.page=next;diagnostics.step('navigation', next);render();window.scrollTo({top:0,behavior:'instant'});$('#pageTitle').focus?.({preventScroll:true})}
function changeMonth(dir){state.month+=dir;if(state.month>11){state.month=0;state.year++}else if(state.month<0){state.month=11;state.year--}render()}
function openMonthPicker(){state.modalTrigger=document.activeElement;const monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];const currentYear=new Date().getFullYear(),yearSet=new Set([state.year]);for(let y=currentYear-20;y<=currentYear+20;y++)yearSet.add(y);for(const item of [...db.records,...db.tasks]){const y=Number((item.date||'').slice(0,4));if(y>=1900&&y<=2200)yearSet.add(y)}const monthOptions=monthNames.map((name,index)=>'<option value="'+index+'" '+(index===state.month?'selected':'')+'>'+name+'</option>').join(''),yearOptions=[...yearSet].sort((x,y)=>y-x).map(year=>'<option value="'+year+'" '+(year===state.year?'selected':'')+'>'+year+'</option>').join('');state.modal='monthPicker';$('#modalTitle').textContent='Escolher mês e ano';$('#modalContent').innerHTML='<form id="monthJumpForm" class="form-grid"><div class="month-jump-fields"><div class="field"><label for="monthJumpMonth">Mês</label><select id="monthJumpMonth" required>'+monthOptions+'</select></div><div class="field"><label for="monthJumpYear">Ano</label><select id="monthJumpYear" required>'+yearOptions+'</select></div></div><div class="form-buttons"><button type="button" class="btn" data-close="1">Cancelar</button><button class="btn primary" type="submit">Ver período</button></div></form>';$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#monthJumpMonth').focus()}
function openDepositPicker(){if(!$('#modal').classList.contains('open'))state.modalTrigger=document.activeElement;const jars=db.jars.filter(j=>!j.archived);state.modal='depositPicker';$('#modalTitle').textContent='Guardar em um cofrinho';$('#modalContent').innerHTML=jars.length?`<div class="deposit-picker-list">${jars.map(j=>`<button class="deposit-picker-option" data-open="add" data-jar="${esc(j.id)}">${icon('piggy')}<span><b>${esc(j.name)}</b><small>Saldo atual ${money(jarTotal(j.id))}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>`:`<div class="empty-inline">Crie um cofrinho para começar a guardar valores.</div><div class="form-buttons"><button type="button" class="btn" data-close="1">Agora não</button><button class="btn primary" data-open="jar">Criar cofrinho</button></div>`;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#modalContent button')?.focus()}
function openQuickAdd(){state.modalTrigger=document.activeElement;state.modal='quickAdd';$('#modalTitle').textContent='Registrar';$('#modalContent').innerHTML=`<div class="quick-add-options"><button class="quick-add-option expense" data-quick-open="expense">${icon('expense')}<span><b>Despesa</b><small>Registrar um gasto</small></span></button><button class="quick-add-option income" data-quick-open="income">${icon('income')}<span><b>Renda</b><small>Registrar um recebimento</small></span></button><button class="quick-add-option goal" data-register-investment>${icon('piggy')}<span><b>Investimento</b><small>Abrir a carteira e registrar uma aplicação</small></span></button></div>`;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#modalContent button')?.focus()}
function openModal(mode,entityId=null,quick=false,homeEntry=''){if(!$('#modal').classList.contains('open'))state.modalTrigger=document.activeElement;state.modal=mode;const existingAllocation=['add','withdraw'].includes(mode)?db.allocations.find(a=>a.id===entityId):null;state.editAllocationId=existingAllocation?.id||null;state.editJarId=['jar','add','withdraw'].includes(mode)?(existingAllocation?.jarId||entityId):null;state.editRecordId=['income','expense','recurring'].includes(mode)?entityId:null;state.editInstitutionId=mode==='institution'?entityId:null;const existingRecord=state.editRecordId?db.records.find(r=>r.id===state.editRecordId&&r.kind===mode):null;if(state.editRecordId&&!existingRecord&&mode!=='recurring'){notify('Lançamento não encontrado.');return}const titles={income:existingRecord?'Editar renda':'Adicionar renda',expense:existingRecord?'Editar despesa':'Nova despesa',jar:entityId?'Editar cofrinho':'Novo cofrinho',add:existingAllocation?'Editar aporte':'Guardar no cofrinho',withdraw:existingAllocation?'Editar resgate':'Resgatar do cofrinho',recurring:entityId?'Editar conta recorrente':'Nova conta recorrente',institution:entityId?'Editar instituição':'Cadastrar banco ou cooperativa'};$('#modalTitle').textContent=titles[mode];let fields='';
if(mode==='income'||mode==='expense')fields=`${mode==='income'?`<div class="field full"><label for="type">Tipo de renda</label><select id="type"><option value="salary" ${existingRecord?.source==='salary'?'selected':''}>Salário</option><option value="complement" ${existingRecord?.source==='complement'?'selected':''}>Complemento</option></select></div>`:`<div class="field full"><label for="category">Categoria</label><select id="category">${CATS.map(cat=>`<option ${(existingRecord?.category||(homeEntry==='card'?'Cartões':''))===cat?'selected':''}>${esc(cat)}</option>`).join('')}</select></div>`}<div class="field full"><label for="subcategory">Subcategoria (opcional)</label><input id="subcategory" type="text" maxlength="50" value="${esc(existingRecord?.subcategory||'')}" placeholder="Ex.: supermercado, combustível, material"></div><div class="field full"><label for="tags">Etiquetas (opcional)</label><input id="tags" type="text" maxlength="240" value="${esc((existingRecord?.tags||[]).join(', '))}" placeholder="Ex.: casa, viagem, reembolso"><small>Separe as etiquetas por vírgulas. Você pode usar até 8.</small></div><div class="field full"><label for="amount">Valor (R$)</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0,00" value="${existingRecord?existingRecord.amount/100:''}"></div><div class="field"><label for="date">Data</label><input id="date" type="date" value="${existingRecord?.date||formDate()}" required></div><div class="field full"><label for="note">Descrição (opcional)</label><input id="note" type="text" maxlength="140" value="${esc(existingRecord?.note||'')}" placeholder="Ex.: ${mode==='income'?'pagamento recebido':'conta do mês'}"></div>`;
if(mode==='recurring'){const t=db.recurring.find(x=>x.id===entityId),kind=t?.kind||'expense';fields=`<div class="field full"><label for="recurringKind">Tipo de previsão</label><select id="recurringKind"><option value="expense" ${kind==='expense'?'selected':''}>Despesa</option><option value="income" ${kind==='income'?'selected':''}>Renda</option></select></div><div class="field full" id="recurringCategoryWrap" ${kind==='income'?'hidden':''}><label for="category">Categoria</label><select id="category">${CATS.map(cat=>`<option ${t?.category===cat?'selected':''}>${esc(cat)}</option>`).join('')}</select></div><div class="field full" id="recurringSourceWrap" ${kind!=='income'?'hidden':''}><label for="recurringSource">Origem da renda</label><select id="recurringSource"><option value="salary" ${t?.source==='salary'?'selected':''}>Salário</option><option value="complement" ${t?.source!=='salary'?'selected':''}>Complemento</option></select></div><div class="field full"><label for="amount">Valor previsto (R$)</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${t?t.amount/100:''}" placeholder="0,00"></div><div class="field"><label for="recurringDay">Dia do mês</label><input id="recurringDay" type="number" min="1" max="31" required value="${t?.day||5}"></div><div class="field"><label for="recurringStart">A partir do mês</label><input id="recurringStart" type="month" required value="${t?.startMonth||mkey(state.year,state.month)}"></div><div class="field"><label for="recurringEnd">Até o mês (opcional)</label><input id="recurringEnd" type="month" value="${t?.endMonth||''}"></div><label class="switch"><input id="recurringPaused" type="checkbox" ${t?.paused?'checked':''}>Pausada</label><div class="field full"><label for="note">Descrição (opcional)</label><input id="note" type="text" maxlength="140" value="${esc(t?.note||'')}" placeholder="Ex.: Internet residencial"></div><div class="soft-tip full">A previsão só aparece nos totais após você confirmar o lançamento.</div>`}
if(homeEntry==='due'){
  $('#modalTitle').textContent='Adicionar vencimento';
  fields=`<div class="field full"><label for="note">Nome da conta</label><input id="note" type="text" maxlength="140" required placeholder="Ex.: Fatura do cartão"></div>
  <div class="field"><label for="amount">Valor previsto (R$)</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0,00"></div>
  <div class="field"><label for="dueEntryDate">Data de vencimento</label><input id="dueEntryDate" type="date" value="${isoToday()}" required></div>
  <div class="field full"><label for="category">Categoria</label><select id="category">${CATS.map(cat=>`<option ${cat==='Outros'?'selected':''}>${esc(cat)}</option>`).join('')}</select></div>
  <label class="switch full"><input id="dueEntryMonthly" type="checkbox"> Repetir todos os meses</label>
  <p class="help full">A conta aparece no Calendário e em Próximos vencimentos. A conta entra nos totais quando você confirma o lançamento em Orçamento.</p>`;
}
if(mode==='institution'){const i=db.institutions.find(x=>x.id===entityId);fields=`<div class="field full"><label for="institutionName">Nome do banco ou cooperativa</label><input id="institutionName" type="text" maxlength="70" required value="${esc(i?.name||'')}" placeholder="Ex.: Cooperativa de crédito"></div><div class="field"><label for="institutionType">Tipo</label><select id="institutionType"><option value="bank" ${i?.type!=='cooperative'?'selected':''}>Banco</option><option value="cooperative" ${i?.type==='cooperative'?'selected':''}>Cooperativa</option></select></div><div class="field"><label for="institutionCdiPercent">Rendimento (% do CDI)</label><input id="institutionCdiPercent" type="number" min="0.01" max="500" step="0.01" required value="${i?.cdiPercent??100}"></div><div class="field full"><label for="institutionFund">Fundo garantidor informado</label><select id="institutionFund"><option value="fgc" ${i?.guaranteeFund==='fgc'?'selected':''}>FGC</option><option value="fgcoop" ${i?.guaranteeFund==='fgcoop'?'selected':''}>FGCoop</option><option value="none" ${i?.guaranteeFund==='none'?'selected':''}>Não monitorar</option></select></div><div class="field full"><label for="institutionConglomerate">Conglomerado financeiro</label><input id="institutionConglomerate" type="text" maxlength="100" value="${esc(i?.conglomerate||i?.name||'')}"></div><div class="field full"><label for="institutionOtherBalance">Outros saldos elegíveis nessa instituição (R$)</label><input id="institutionOtherBalance" type="number" min="0" step="0.01" value="${((i?.otherCoveredBalance||0)/100).toFixed(2)}"></div><div class="soft-tip full">O percentual estima os rendimentos. A cobertura depende da instituição, do produto e das regras do fundo; confirme essas informações.</div>`}
if(mode==='jar'){const j=db.jars.find(x=>x.id===entityId);fields=`<div class="field full"><label for="jarName">O que você quer realizar?</label><input id="jarName" type="text" maxlength="70" required value="${esc(j?.name||'')}" placeholder="Ex.: Reserva de emergência"><span class="explain">Dê um nome que ajude a identificar o objetivo.</span></div><div class="field full"><label for="jarInstitution">Banco ou cooperativa</label><select id="jarInstitution">${db.institutions.map(i=>`<option value="${esc(i.id)}" ${(j?.institutionId||'inter-default')===i.id?'selected':''}>${esc(i.name)} · ${percent(i.cdiPercent)} do CDI</option>`).join('')}</select><span class="explain">Para cadastrar outra instituição, use Ajustes → Bancos e cooperativas.</span></div><div class="field full"><label for="jarTarget">Quanto você precisa? (R$)</label><input id="jarTarget" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${j?j.target/100:''}" placeholder="Ex.: 10000"></div><div class="field full"><label for="jarDue">Até quando quer alcançar?</label><input id="jarDue" type="date" required value="${j?.dueDate||state.year+'-12-31'}"><span class="explain">O app calcula uma referência mensal. Você decide quando e quanto guardar.</span></div>${db.investments.length?`<fieldset class="full linked-positions"><legend>Investimentos vinculados <small>Opcional</small></legend><p>Selecione aplicações externas ao cofrinho. O saldo vinculado é somado ao cofrinho; não vincule aqui o mesmo dinheiro já lançado como aporte.</p><div class="linked-positions-list">${db.investments.filter(x=>!x.goalId||x.goalId===j?.id||!db.jars.some(g=>g.id===x.goalId)).map(x=>`<label class="linked-position"><input type="checkbox" name="linkedInvestment" value="${esc(x.id)}" ${x.goalId===j?.id?'checked':''}><span class="linked-position-name"><strong>${esc(x.name)}</strong><small>${esc(x.institution)} · ${esc(x.product)}</small></span><span class="linked-position-value">${money(x.balance)}</span></label>`).join('') || '<p>As aplicações cadastradas já estão vinculadas a outras metas.</p>'}</div></fieldset>`:''}<div class="goal-draft-preview" id="goalDraftPreview" aria-live="polite"></div>`}
if(mode==='add'||mode==='withdraw'){const j=db.jars.find(x=>x.id===state.editJarId);if(!j)return notify('Cofrinho não encontrado.');fields=`<div class="preview-line">${mode==='add'?'Guardando em':'Resgatando de'} <b>${esc(j.name)}</b>. Principal disponível: <b>${money(jarTotal(j.id))}</b>.</div><div class="field full"><label for="amount">${mode==='withdraw'?'Principal baixado (R$)':'Valor (R$)'}</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0,00" value="${existingAllocation?Math.abs(existingAllocation.amount)/100:''}"></div>${mode==='withdraw'?`<div class="field full"><label for="netReceived">Valor líquido recebido (R$, opcional)</label><input id="netReceived" type="number" min="0.01" step="0.01" inputmode="decimal" value="${existingAllocation?.netReceived?existingAllocation.netReceived/100:''}"><small>Informe o valor do extrato, após rendimentos e impostos. Em branco, será usado o principal baixado.</small></div>`:''}<div class="field full"><label for="date">Data</label><input id="date" type="date" required value="${existingAllocation?.date||formDate()}"></div><div class="field full"><label for="note">Descrição (opcional)</label><input id="note" type="text" maxlength="140" placeholder="Ex.: ${mode==='add'?'valor separado':'despesa imprevista'}" value="${esc(existingAllocation?.note||'')}"></div>${mode==='add'&&!existingAllocation?`<div class="preview-line" id="percentPreview">Sua reserva mínima no mês é ${money(month().minimum)} (10% da renda). Informe quanto vai guardar para ver sua porcentagem.</div>`:''}`}
if(quick&&['income','expense'].includes(mode)){
 const template=document.createElement('template');
 template.innerHTML=fields;
 const main=['amount',mode==='income'?'type':'category','note'];
 const basic=main.map(id=>template.content.querySelector('#'+id).closest('.field'));
 basic.forEach(field=>field.remove());
 fields=basic.map(field=>field.outerHTML).join('')+
   '<details class="full quick-entry-more"><summary>Mais opções</summary>'+template.innerHTML+'</details>';
}
$('#modalContent').innerHTML=`<form id="entryForm" class="form-grid">${fields}<div class="form-buttons"><button type="button" class="btn" data-close="1">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div></form>`;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';focusAppModal($('#amount')||$('#jarName')||$('#institutionName'));if(mode==='jar')goalDraftPreview()}
function focusAppModal(preferred){const surface=$('#modal .dialog');if(!surface)return;surface.setAttribute('tabindex','-1');(preferred||surface.querySelector('input,select,textarea,button')||surface).focus();if(!$('#modal').contains(document.activeElement))surface.focus()}
function closeModal(force=false){if(!force&&$('#modal').classList.contains('open')){const f=$('#modalContent form');if(f&&[...f.elements].some(x=>{if(x.type==='submit'||x.type==='button')return false;if(x.type==='checkbox'||x.type==='radio')return x.checked!==x.defaultChecked;if(x.tagName==='SELECT'){const initial=[...x.options].find(o=>o.defaultSelected)||x.options[0];return x.value!==(initial?.value??'')}return x.value!==x.defaultValue})&&!confirm('Descartar as alterações não salvas?'))return}$('#modal').classList.remove('open');$('#modal').setAttribute('aria-hidden','true');document.body.style.overflow='';state.modal='';state.editJarId=null;state.editRecordId=null;state.editInstitutionId=null;state.editAllocationId=null;calendarRecordEditPending=false;calendarInvestmentEditPending=false;const trigger=state.modalTrigger;state.modalTrigger=null;setTimeout(()=>trigger?.isConnected&&trigger.focus?.(),0)}
function preview(){if(state.modal!=='add')return;const n=toCents($('#amount')?.value);const m=month();const saved=m.saved+(Number.isFinite(n)?n:0);$('#percentPreview').textContent=`Após guardar: ${money(saved)} no mês, ${m.income?percent(saved/m.income*100):'porcentagem indisponível sem renda'}. Mínimo recomendado: ${money(m.minimum)}.${m.income?(saved>=m.minimum?' Referência atingida.':' Faltam '+money(m.minimum-saved)+'.'):''}`}
function goalDraftPreview(){const box=$('#goalDraftPreview');if(!box||state.modal!=='jar')return;const target=toCents($('#jarTarget')?.value),due=$('#jarDue')?.value,j=db.jars.find(x=>x.id===state.editJarId),selected=[...document.querySelectorAll('input[name="linkedInvestment"]:checked')].map(x=>x.value),linked=sum(db.investments.filter(x=>selected.includes(x.id)).map(x=>x.balance)),current=(j?estimateCdbJar(j.id).net:0)+linked;if(!Number.isFinite(target)||!validDate(due)){box.innerHTML='<b>Prévia do plano</b><span>Informe um valor e um prazo válido para ver a contribuição mensal estimada.</span>';return}const today=new Date(),dueDate=new Date(due+'T12:00:00'),months=Math.max(0,(dueDate.getFullYear()-today.getFullYear())*12+dueDate.getMonth()-today.getMonth()+1),pending=Math.max(0,target-current),monthly=pending===0?0:months?Math.ceil(pending/months):null;box.innerHTML=`<b>${pending===0?'Objetivo já alcançado':monthly===null?'Prazo anterior a este mês':`${money(monthly)} por mês como referência`}</b><span>${money(current)} já guardados de ${money(target)}. ${monthly===null?'Ajuste o prazo para calcular o valor mensal.':'Estimativa simples, sem considerar rendimentos ou inflação.'}</span>`}
document.addEventListener('click',event=>{
  if(event.target.closest('[data-open-income-reserve]')){go('goals');revealSearchTarget($('#incomeReserveCard'));return}
  const budgetLink=event.target.closest('[data-home-budget],[data-budget-target]');
  if(budgetLink){go('budget');revealSearchTarget(document.getElementById(budgetLink.dataset.budgetTarget||'categoryBudgetCard'));return}
  if(event.target.closest('[data-insight-close]')){go('reports');revealSearchTarget($('#monthlyCloseChecklist'));return}
  const button=event.target.closest('[data-home-finance-entry]');
  if(!button)return;
  const mode=button.dataset.homeFinanceEntry;
  openModal(mode==='card'?'expense':'recurring',null,false,mode);
});
async function saveHomeDueEntry(){
  const date=$('#dueEntryDate').value,amount=toCents($('#amount').value);
  const category=$('#category').value,note=$('#note').value.trim();
  if(!validDate(date)||!Number.isSafeInteger(amount)||amount<=0||!note||!CATS.includes(category)){
    notify('Informe o nome, o vencimento e o valor da conta.');
    return;
  }
  const startMonth=date.slice(0,7);
  const entry={id:uid(),kind:'expense',source:'complement',amount,day:Number(date.slice(8)),
    startMonth,endMonth:$('#dueEntryMonthly').checked?null:startMonth,category,note,paused:false};
  if(await mutate(()=>db.recurring.push(entry))){
    closeModal(true);
    notify('Vencimento cadastrado.');
  }
}
async function submitEntry(e){e.preventDefault();const mode=state.modal,monthBefore=mkey(state.year,state.month);let record;
if(mode==='recurring'&&$('#dueEntryDate'))return saveHomeDueEntry();
if(mode==='recurring'){const amount=toCents($('#amount').value),day=Number($('#recurringDay').value),startMonth=$('#recurringStart').value,endMonth=$('#recurringEnd').value||null,kind=$('#recurringKind').value,source=$('#recurringSource')?.value||'complement',category=kind==='income'?'Outros':$('#category').value,note=$('#note').value.trim().slice(0,140);if(!Number.isSafeInteger(amount)||!Number.isInteger(day)||day<1||day>31||!validDate(startMonth+'-01')||(endMonth&&(!validDate(endMonth+'-01')||endMonth<startMonth))||(kind==='expense'&&!CATS.includes(category))){notify('Confira os dados da previsão recorrente.');return}const existing=db.recurring.find(t=>t.id===state.editRecordId);const entry={id:existing?.id||uid(),kind,source,amount,day,startMonth,endMonth,category,note,paused:$('#recurringPaused').checked};if(!await mutate(()=>{if(existing)db.recurring[db.recurring.indexOf(existing)]=entry;else db.recurring.push(entry)}))return}
else if(mode==='institution'){const name=$('#institutionName').value.trim(),type=$('#institutionType').value,cdiPercent=Number($('#institutionCdiPercent').value),guaranteeFund=$('#institutionFund').value,conglomerate=$('#institutionConglomerate').value.trim(),otherRaw=Number($('#institutionOtherBalance').value),otherCoveredBalance=Number.isFinite(otherRaw)&&otherRaw>=0&&otherRaw<=100000000?Math.round(otherRaw*100):NaN,existing=db.institutions.find(x=>x.id===state.editInstitutionId);if(!name||!['bank','cooperative'].includes(type)||!Number.isFinite(cdiPercent)||cdiPercent<=0||cdiPercent>500||!['fgc','fgcoop','none'].includes(guaranteeFund)||!conglomerate||!Number.isSafeInteger(otherCoveredBalance)){notify('Confira o nome, o tipo e o percentual de CDI.');return}const item={id:existing?.id||uid(),name:name.slice(0,70),type,cdiPercent,guaranteeFund,conglomerate:conglomerate.slice(0,100),otherCoveredBalance,isDefault:!!existing?.isDefault};if(!await mutate(()=>{if(existing)db.institutions[db.institutions.indexOf(existing)]=item;else db.institutions.push(item)}))return;closeModal(true);notify(existing?'Instituição atualizada.':'Instituição cadastrada.');return}
else if(mode==='jar'){const name=$('#jarName').value.trim(),target=toCents($('#jarTarget').value),dueDate=$('#jarDue').value;if(!name||!Number.isFinite(target)||!validDate(dueDate)){notify('Preencha corretamente o nome, valor e prazo.');return}const exists=db.jars.find(x=>x.id===state.editJarId);const linkedIds=new Set(new FormData(e.target).getAll('linkedInvestment'));const newJar={id:exists?.id||uid(),name:name.slice(0,70),target,dueDate,institutionId:$('#jarInstitution').value||'inter-default',paused:!!exists?.paused,archived:!!exists?.archived};if(!await mutate(()=>{if(exists)db.jars[db.jars.indexOf(exists)]=newJar;else db.jars.push(newJar);for(const item of db.investments){if(linkedIds.has(item.id))item.goalId=newJar.id;else if(item.goalId===newJar.id)item.goalId=null}}))return}
else{const amount=toCents($('#amount').value),date=$('#date').value,note=$('#note').value.trim().slice(0,140);if(!Number.isFinite(amount)||!validDate(date)){notify('Informe um valor positivo e uma data válida.');return}if(mode==='income'||mode==='expense'){const previousRecord=db.records.find(r=>r.id===state.editRecordId),linkedInvestment=previousRecord?.investmentId?db.investments.find(x=>x.id===previousRecord.investmentId):null;if(linkedInvestment&&(linkedInvestment.redemptions||[]).some(r=>r.kind==='sale')){notify('Para preservar o custo já distribuído nas vendas, este gasto do lote não pode ser editado após a primeira venda.');return}record={id:state.editRecordId||uid(),kind:mode,amount,date,note,source:mode==='income'?$('#type').value:'complement',category:previousRecord?.investmentId?'Pecuária':mode==='expense'?$('#category').value:'Outros',subcategory:$('#subcategory')?.value.trim().slice(0,50)||'',tags:normalizeTags($('#tags')?.value||''),recurringId:previousRecord?.recurringId||null,recurringMonth:previousRecord?.recurringMonth||null,investmentId:previousRecord?.investmentId||null,investmentExpenseId:previousRecord?.investmentExpenseId||null};state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;if(calendarRecordEditPending&&!confirm('Confirma salvar? Isso mudará os valores registrados no lançamento e poderá alterar totais e relatórios.'))return;if(!await mutate(()=>{if(previousRecord?.investmentId){const asset=db.investments.find(x=>x.id===previousRecord.investmentId),expense=asset?.expenses?.find(e=>e.id===previousRecord.investmentExpenseId);if(expense){asset.remainingCostBasis=Math.max(0,asset.remainingCostBasis-expense.amount+amount);expense.amount=amount;expense.date=date;expense.note=note}}const i=db.records.findIndex(x=>x.id===record.id);if(i>=0)db.records[i]=record;else db.records.push(record)}))return}else{const jar=db.jars.find(j=>j.id===state.editJarId);if(!jar){notify('Cofrinho não encontrado.');return}const signed=mode==='withdraw'?-amount:amount;if(signed<0){const balanceAtDate=sum(db.allocations.filter(a=>a.jarId===jar.id&&a.id!==state.editAllocationId&&a.date<=date).map(a=>a.amount));if(amount>balanceAtDate){notify(`Resgate maior que o saldo disponível em ${dateBR(date)}.`);return}}const receivedInput = mode==='withdraw' ? $('#netReceived').value.trim() : '';
const netReceived = receivedInput ? toCents(receivedInput) : null;
if(receivedInput && (!Number.isSafeInteger(netReceived)||netReceived<=0)){notify('Informe um valor líquido recebido válido.');return}
const previousAllocation=db.allocations.find(a=>a.id===state.editAllocationId);record={id:previousAllocation?.id||uid(),jarId:jar.id,amount:signed,date,note,...(netReceived!==null?{netReceived}:{})};const remaining=previousAllocation?db.allocations.filter(a=>a.id!==previousAllocation.id):db.allocations,proposed=[...remaining,record],invalidDate=firstNegativeJarDate(jar.id,proposed);if(invalidDate){notify(`Essa alteração deixaria o saldo do cofrinho negativo em ${dateBR(invalidDate)}.`);return}if(state.editAllocationId&&!confirm('Confirma salvar? Isso mudará os valores registrados no cofrinho e poderá alterar saldos e relatórios.'))return;state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;if(!await mutate(()=>db.allocations=proposed))return}}closeModal(true);notify(monthBefore===mkey(state.year,state.month)?'Salvo com sucesso.':`Salvo em ${monthLabel()}.`)}
async function copyPreviousExpenses(){let y=state.year,m=state.month-1;if(m<0){m=11;y--}const previous=getMonth(y,m).records.filter(r=>r.kind==='expense'&&!r.recurringId);if(!previous.length){notify('O mês anterior não tem despesas para copiar.');return}const targetKey=mkey(state.year,state.month);const hasSame=x=>db.records.some(r=>r.kind==='expense'&&r.date===x.date&&r.category===x.category&&r.note===x.note&&r.amount===x.amount);const copy=previous.map(x=>{const day=Number(x.date.slice(8));const lastDay=new Date(state.year,state.month+1,0).getDate();return {...x,id:uid(),recurringId:null,date:targetKey+'-'+String(Math.min(day,lastDay)).padStart(2,'0')}}).filter(x=>!hasSame(x));if(!copy.length){notify('Todas as despesas do mês anterior já foram copiadas.');return}if(!confirm(`Copiar ${copy.length} ${copy.length===1?'despesa':'despesas'} de ${MONTHS[m]} para ${monthLabel()}? Você poderá editar os valores.`))return;if(await mutate(()=>db.records.push(...copy)))notify(`${copy.length} despesas copiadas. Ajuste os valores em Editar.`)}
async function deleteRecord(id){const x=db.records.find(r=>r.id===id);if(!x)return;const asset=x.investmentId?db.investments.find(v=>v.id===x.investmentId):null;if(asset&&(asset.redemptions||[]).some(r=>r.kind==='sale')){notify('Este gasto do lote já compõe vendas registradas e não pode ser excluído.');return}if(!confirm(`Excluir ${money(x.amount)} de ${dateBR(x.date)}?`))return;if(await mutate(()=>{if(asset){const expense=asset.expenses?.find(e=>e.id===x.investmentExpenseId);if(expense){asset.remainingCostBasis=Math.max(0,asset.remainingCostBasis-expense.amount);asset.expenses=asset.expenses.filter(e=>e.id!==expense.id)}}db.records=db.records.filter(r=>r.id!==id)}))notify('Lançamento excluído.')}
function firstNegativeJarDate(jarId,allocations){let balance=0;for(const item of allocations.filter(x=>x.jarId===jarId).sort(byAllocationDate)){balance+=item.amount;if(balance<0)return item.date}return null}
async function deleteAllocation(id){const a=db.allocations.find(r=>r.id===id);if(!a)return;const remaining=db.allocations.filter(x=>x.id!==id),invalidDate=firstNegativeJarDate(a.jarId,remaining);if(invalidDate){notify(`Não é possível excluir: o saldo ficaria negativo em ${dateBR(invalidDate)}.`);return}if(!confirm('Excluir esta movimentação do cofrinho?'))return;if(await mutate(()=>db.allocations=remaining))notify('Movimentação excluída.')}
async function removeInvestment(id){const item=db.investments.find(x=>x.id===id);if(!item)return;if(!confirm('Remover este investimento? Isso alterará os valores registrados na carteira. As despesas do lote continuarão no histórico como Pecuária.'))return;if(await mutate(()=>{db.records=db.records.map(r=>r.investmentId===id?{...r,investmentId:null,investmentExpenseId:null,category:'Pecuária'}:r);db.investments=db.investments.filter(x=>x.id!==id)}))notify('Investimento removido da carteira.')}

async function archiveJar(id,archived=true){const jar=db.jars.find(j=>j.id===id);if(!jar)return;if(await mutate(()=>jar.archived=archived))notify(archived?'Cofrinho arquivado. O histórico foi preservado.':'Cofrinho restaurado.')}
async function toggleJarPlan(id){const jar=db.jars.find(j=>j.id===id);if(!jar)return;if(await mutate(()=>jar.paused=!jar.paused))notify(jar.paused?'Plano pausado. Saldo e histórico preservados.':'Plano retomado. A contribuição mensal voltou ao planejamento.')}
async function deleteJar(id){const j=db.jars.find(r=>r.id===id);if(!j)return;if(db.allocations.some(a=>a.jarId===id)){notify('Este cofrinho possui histórico. Edite o nome e a meta; para preservá-lo, não é possível excluir.');return}if(!confirm(`Excluir o cofrinho “${j.name}”?`))return;if(await mutate(()=>db.jars=db.jars.filter(x=>x.id!==id)))notify('Cofrinho excluído.')}
function download(content,mime,filename){const blob=new Blob([content],{type:mime});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),700)}
function backup(){if(saving||vaultBusy)return;if(vault){download(JSON.stringify(vault),'application/json','reserva-cofre.json');return notify('Backup cifrado exportado.')}download(JSON.stringify(backupPayload(),null,2),'application/json',`reserva-backup-${new Date().toISOString().slice(0,10)}.json`);notify('Backup exportado.')}
function csv(){const rows=[['Data','Tipo','Categoria ou cofrinho','Descrição','Valor (R$)','Subcategoria','Etiquetas']];const decimal=cents=>(cents/100).toFixed(2).replace('.',',');for(const x of db.records){rows.push([x.date,x.kind==='income'?'Renda':'Despesa',x.kind==='income'?(x.source==='salary'?'Salário':'Complemento'):x.category,x.note,decimal((x.kind==='income'?1:-1)*x.amount),x.subcategory||'',(x.tags||[]).join(', ')])}for(const a of db.allocations){rows.push([a.date,a.amount>0?'Guardar':'Resgatar',db.jars.find(j=>j.id===a.jarId)?.name||'',a.note,decimal(a.amount>0?-a.amount:(a.netReceived??-a.amount)),'',''])}for(const item of db.investments){if(!item.existing)rows.push([item.date,'Aplicação',item.name,'Aplicação registrada',decimal(-item.cost),'','']);for(const redemption of item.redemptions||[])rows.push([redemption.date,redemption.kind==='sale'?'Venda de ativo':'Resgate de investimento',item.name,'Movimento da carteira',decimal(redemption.amount),'',''])}rows.sort((a,b)=>a[0]==='Data'?-1:b[0]==='Data'?1:String(a[0]).localeCompare(String(b[0])));const encode=(cell,column)=>{let value=String(cell??'');if(column!==4&&/^[\s]*[=+\-@]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"'};download('\ufeff'+rows.map(r=>r.map(encode).join(';')).join('\r\n'),'text/csv;charset=utf-8',`reserva-movimentacoes-todos-os-anos.csv`);notify('CSV de todos os anos exportado.')}


// Importador local de CSV bancário: identifica colunas usuais, gera prévia e acrescenta sem substituir dados.
let pendingBankCsvRecords=[];
function bankCsvNorm(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function bankCsvDelimiter(text){const line=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).find(x=>x.trim())||'';return [[';',line.split(';').length],['\t',line.split('\t').length],[',',line.split(',').length],['|',line.split('|').length]].sort((a,b)=>b[1]-a[1])[0][0]}
function bankCsvParseRows(text,delimiter){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&c===delimiter){row.push(cell.trim());cell=''}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);row=[];cell=''}else cell+=c}row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);return rows}
function bankCsvHeaderIndex(headers,aliases){const keys=headers.map(bankCsvNorm);for(const alias of aliases){const exact=keys.indexOf(alias);if(exact>=0)return exact}for(let i=0;i<keys.length;i++)if(aliases.some(alias=>alias.length>3&&keys[i].includes(alias)))return i;return -1}
function bankCsvDate(value){const s=String(value??'').trim();if(!s)return null;let m;if((m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))){const y=+m[1],mo=+m[2],d=+m[3],iso=y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');return validDate(iso)?iso:null}if((m=s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})$/))){let y=+m[3];if(y<100)y+=y<70?2000:1900;const iso=y+'-'+String(+m[2]).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0');return validDate(iso)?iso:null}if(/^\d{5}(\.\d+)?$/.test(s)){const d=new Date(Date.UTC(1899,11,30)+Math.round(Number(s)*86400000)),iso=d.toISOString().slice(0,10);return validDate(iso)?iso:null}return null}
function bankCsvMoney(value){let s=String(value??'').trim();if(!s)return null;const negative=/^\s*\(.*\)\s*$/.test(s)||/^\s*-/.test(s)||/[0-9]\s*-\s*$/.test(s)||/[0-9]\s*d\s*$/i.test(s);s=s.replace(/[()]/g,'').replace(/[R$\s]/g,'').replace(/[dDcC]\s*$/,'').replace(/[+-]/g,'');if(!/\d/.test(s))return null;const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');if(comma>=0&&dot>=0){const decimal=comma>dot?',':'.',group=decimal===','?'.':',';s=s.replace(new RegExp('\\'+group,'g'),'');const at=s.lastIndexOf(decimal);s=s.slice(0,at).replace(new RegExp('\\'+decimal,'g'),'')+'.'+s.slice(at+1)}else{const sep=comma>=0?',':dot>=0?'.':null;if(sep){const groups=s.split(sep),last=groups[groups.length-1],thousands=groups.length>1&&groups.slice(1).every(g=>g.length===3)&&groups[0].length>=1&&groups[0].length<=3;if(thousands)s=groups.join('');else{const at=s.lastIndexOf(sep);s=s.slice(0,at).replace(new RegExp('\\'+sep,'g'),'')+'.'+s.slice(at+1)}}}const amount=Number(s);if(!Number.isFinite(amount))return null;const cents=Math.round(Math.abs(amount)*100);return cents?(negative?-cents:cents):0}
function bankCsvCategory(bankCategory,description){const direct=bankCsvNorm(bankCategory),exact=CATS.find(x=>bankCsvNorm(x)===direct);if(exact)return exact;const merchant=bankCsvNorm(description);try{const rules=JSON.parse(localStorage.getItem('reserva.bankCsvRules')||'{}');if(rules[merchant]&&CATS.includes(rules[merchant]))return rules[merchant]}catch{}const t=bankCsvNorm(String(bankCategory||'')+' '+String(description||''));if(/supermerc|mercado|mercearia|hortifruti|grocery/.test(t))return 'Mercado';if(/restaurante|lanchonete|padaria|ifood|marmita|alimentacao|food/.test(t))return 'Comida / Marmita';if(/\bagua\b/.test(t))return 'Água';if(/energia|eletric|conta de luz|\bluz\b/.test(t))return 'Luz';if(/internet|banda larga|wifi/.test(t))return 'Internet';if(/faculdade|escola|universidade|curso|mensalidade escolar/.test(t))return 'Faculdade';if(/farmacia|drogaria|remedio/.test(t))return 'Farmácia';if(/cartao|fatura|credito rotativo/.test(t))return 'Cartões';if(/telefone|celular|operadora|recarga/.test(t))return 'Telefone';if(/aluguel|condominio|moradia|imovel|iptu/.test(t))return 'Moradia';if(/uber|99 |combustivel|gasolina|onibus|metro|pedagio|passagem|transporte/.test(t))return 'Transporte';if(/clinica|hospital|medico|consulta|dentista|saude/.test(t))return 'Saúde';if(/cinema|viagem|hotel|lazer|show|parque/.test(t))return 'Lazer';if(/netflix|spotify|streaming|assinatura|subscription/.test(t))return 'Assinaturas';return 'Outros'}
function bankCsvRecordKey(x){return [x.date,x.kind,x.amount,bankCsvNorm(x.note)].join('|')}
function csvRecurringMatch(record){if(record.kind!=='expense')return null;const key=record.date.slice(0,7);return db.recurring.find(t=>t.kind==='expense'&&!t.paused&&t.amount===record.amount&&t.category===record.category&&t.startMonth<=key&&(!t.endMonth||t.endMonth>=key)&&Math.abs(Number(t.day)-Number(record.date.slice(8,10)))<=4&&!db.records.some(r=>r.recurringId===t.id&&(r.recurringMonth||r.date.slice(0,7))===key))||null}
function openBankCsvPreview(fileName,records,meta){pendingBankCsvRecords=records;const suggestions=records.reduce((n,r)=>n+(csvRecurringMatch(r)?1:0),0);state.modalTrigger=document.activeElement;state.modal='bankCsvImport';$('#modalTitle').textContent='Revisar importação bancária';const sample=records.slice(0,15);const rows=sample.map((x,i)=>'<tr><td>'+dateBR(x.date)+'</td><td>'+(x.kind==='income'?'Entrada':'Saída')+'</td><td>'+(x.kind==='income'?esc(x.source==='salary'?'Salário':'Renda complementar'):'<select class="csv-category" data-csv-category="'+i+'">'+CATS.map(c=>'<option '+(c===x.category?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>')+'</td><td>'+esc(x.note||'Sem descrição')+(csvRecurringMatch(x)?'<small class="help">Sugestão: '+esc(csvRecurringMatch(x).note||csvRecurringMatch(x).category)+' recorrente</small>':'')+'</td><td class="money">'+money(x.amount)+'</td></tr>').join('');$('#modalContent').innerHTML='<form id="bankCsvImportForm"><p class="help"><b>'+esc(fileName)+'</b> · '+records.length+' lançamento(s) reconhecidos. Revise categorias; as correções serão lembradas para próximas importações.</p><div class="bank-csv-summary"><span>'+records.length+' prontos</span><span>'+meta.duplicates+' duplicados ignorados</span><span>'+meta.invalid+' linhas inválidas</span></div>'+(suggestions?'<label class="csv-reconcile"><input type="checkbox" name="reconcile" checked> Vincular '+suggestions+' lançamento(s) provável(is) às contas recorrentes correspondentes</label>':'')+'<div class="table-wrap bank-csv-preview"><table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th class="right">Valor</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+(records.length>15?'<p class="help">Prévia das primeiras 15 linhas; todas as linhas válidas serão importadas.</p>':'')+'<div class="form-buttons"><button type="button" class="btn" data-close="1">Cancelar</button><button type="submit" class="btn primary">Importar '+records.length+' lançamento(s)</button></div></form>';$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#modalContent button')?.focus()}
async function importBankCsv(file){if(file)diagnostics.step('csv.requested');if(!file||saving||vaultBusy||(vault&&!vaultKey))return;if(file.size>8000000)return notify('CSV muito grande; o limite é 8 MB.');let text='';try{text=(await file.text()).replace(/^\uFEFF/,'')}catch(e){diagnostics.record('csv.read_failed',e);return notify('Não foi possível ler esse arquivo CSV.')}const rows=bankCsvParseRows(text,bankCsvDelimiter(text));if(rows.length<2)return notify('O CSV não contém linhas de dados.');let headerAt=-1,map=null;for(let i=0;i<Math.min(rows.length,10);i++){const h=rows[i],candidate={date:bankCsvHeaderIndex(h,['data','date','dt','data lancamento','data transacao','data movimento','transaction date','posting date']),amount:bankCsvHeaderIndex(h,['valor','amount','value','montante','valor lancado','valor transacao']),debit:bankCsvHeaderIndex(h,['debito','debit','saida','outflow','valor debitado']),credit:bankCsvHeaderIndex(h,['credito','credit','entrada','inflow','valor creditado']),description:bankCsvHeaderIndex(h,['descricao','description','historico','history','memo','merchant','estabelecimento','detalhe','lancamento']),category:bankCsvHeaderIndex(h,['categoria','category','grupo','classificacao']),type:bankCsvHeaderIndex(h,['tipo','type','natureza','operacao','operation','dc'])};if(candidate.date>=0&&(candidate.amount>=0||candidate.debit>=0||candidate.credit>=0)){headerAt=i;map=candidate;break}}if(!map)return notify('Não identifiquei as colunas de data e valor. Use um CSV com cabeçalhos como Data, Descrição e Valor.');if(db.records.length>=50000)return notify('A base atingiu o limite de lançamentos aceito pelo aplicativo.');const existingInDb=new Set(db.records.map(bankCsvRecordKey)),records=[];let invalid=0,duplicates=0;const append=(date,cents,kind,description,bankCategory)=>{if(!cents)return;const isIncome=kind==='income',note=String(description||bankCategory||(isIncome?'Entrada importada':'Saída importada')).trim().slice(0,140),record={id:uid(),date,kind,amount:Math.abs(cents),note,source:isIncome?(/salario|folha|payroll|remuneracao|provento/.test(bankCsvNorm(note))?'salary':'complement'):'',category:isIncome?'Outros':bankCsvCategory(bankCategory,note)},key=bankCsvRecordKey(record);if(existingInDb.has(key)){duplicates++;return}records.push(record)};for(const row of rows.slice(headerAt+1)){if(!row.some(x=>String(x||'').trim()))continue;const date=bankCsvDate(row[map.date]);if(!date){invalid++;continue}const description=map.description>=0?row[map.description]:'',bankCategory=map.category>=0?row[map.category]:'',type=bankCsvNorm(map.type>=0?row[map.type]:'');if(map.debit>=0||map.credit>=0){let made=false;if(map.debit>=0){const v=bankCsvMoney(row[map.debit]);if(v){append(date,Math.abs(v),'expense',description,bankCategory);made=true}}if(map.credit>=0){const v=bankCsvMoney(row[map.credit]);if(v){append(date,Math.abs(v),'income',description,bankCategory);made=true}}if(!made)invalid++;continue}const signed=bankCsvMoney(row[map.amount]);if(signed===null||signed===0){invalid++;continue}let kind=signed<0?'expense':'income';const debitType=/(^| )(d|debito|debit|saida|outflow|compra|pagamento|despesa|saque|withdrawal)( |$)/.test(type),creditType=/(^| )(c|credito|credit|entrada|inflow|deposito|recebimento|renda)( |$)/.test(type);if(kind==='income'&&debitType&&!creditType)kind='expense';else if(kind==='expense'&&creditType&&!debitType)kind='income';append(date,signed,kind,description,bankCategory);if(records.length>5000)return notify('O arquivo excede o limite de 5.000 lançamentos por importação. Divida o extrato em arquivos menores.')}if(!records.length)return notify('Não encontrei lançamentos válidos para importar. Confira as datas e os valores do CSV.');openBankCsvPreview(file.name,records,{duplicates,invalid})}
async function submitBankCsvImport(event){event.preventDefault();if(!pendingBankCsvRecords.length)return closeModal();if(storageRecoveryRaw&&!recoveryArchived)return notify('Exporte primeiro a cópia bruta antes de importar.');const records=pendingBankCsvRecords.slice(),form=event.currentTarget,learned={};form.querySelectorAll('[data-csv-category]').forEach(select=>{const i=Number(select.dataset.csvCategory),r=records[i];if(r&&r.kind==='expense'&&CATS.includes(select.value)){if(select.value!==r.category&&r.note)learned[bankCsvNorm(r.note)]=select.value;r.category=select.value}});if(form.elements.reconcile?.checked){const linked=new Set();for(const r of records){const t=csvRecurringMatch(r),key=t&&t.id+'|'+r.date.slice(0,7);if(t&&!linked.has(key)){r.recurringId=t.id;r.recurringMonth=r.date.slice(0,7);linked.add(key)}}}if(db.records.length+records.length>50000)return notify('A importação excede o limite de lançamentos do aplicativo.');const count=records.length;if(await mutate(()=>{db.records.push(...records)})){try{const rules=JSON.parse(localStorage.getItem('reserva.bankCsvRules')||'{}');Object.assign(rules,learned);localStorage.setItem('reserva.bankCsvRules',JSON.stringify(rules))}catch{}pendingBankCsvRecords=[];closeModal(true);notify(count+' lançamento(s) importado(s); categorias corrigidas serão sugeridas nas próximas importações.')}}

async function importFile(file){if(!file||saving||vaultBusy||(vault&&!vaultKey))return;if(file.size>8000000)return notify('Backup muito grande; máximo de 8 MB.');let restored=null;try{const source=JSON.parse(await file.text());if(source?.format==='reserva-vault-1'){validateVaultEnvelope(source);pendingVaultImport=source;showVaultDialog('import');return}restored=verify(source)}catch(e){}if(!restored)return notify('Backup inválido ou incompatível.');if(!confirm('Importar o backup? Ele substituirá todos os dados atuais.'))return;if(storageRecoveryRaw&&!recoveryArchived)return notify('Exporte primeiro a cópia bruta; não foi possível arquivá-la automaticamente.');if(!await preserveBeforeDestructiveAction('antes-de-importar'))return notify('Reconecte a pasta para preservar a base atual.');if(backupDirectory)backupConflict=true;const before=db;db=restored;if(!await save({recover:!!storageRecoveryRaw})){db=before;return}render();notify('Backup importado.')}
async function demo(){if(!confirm('Carregar dados fictícios de 2027? Os dados atuais serão substituídos.'))return;if(!await preserveBeforeDestructiveAction('antes-do-exemplo'))return;const d=empty();const add=(mo,kind,amount,details={})=>d.records.push({id:uid(),date:`2027-${String(mo).padStart(2,'0')}-05`,kind,amount:Math.round(amount*100),note:'',source:'complement',category:'Outros',...details});for(let m=1;m<=5;m++){add(m,'income',3400,{source:'salary'});add(m,'income',[700,400,850,500,750][m-1]);for(const [cat,value] of [['Água',96],['Luz',178],['Internet',110],['Faculdade',560],['Farmácia',105],['Cartões',430],['Telefone',55],['Mercado',770],['Transporte',210]])add(m,'expense',value+((m+1)%3)*10,{category:cat})}const j1={id:uid(),name:'Reserva de emergência',target:1000000,dueDate:'2027-12-31'},j2={id:uid(),name:'Viagem',target:350000,dueDate:'2028-07-31'};d.jars.push(j1,j2);for(let m=1;m<=5;m++){d.allocations.push({id:uid(),jarId:j1.id,date:`2027-${String(m).padStart(2,'0')}-10`,amount:[40000,55000,60000,45000,70000][m-1],note:''});if(m%2)d.allocations.push({id:uid(),jarId:j2.id,date:`2027-${String(m).padStart(2,'0')}-12`,amount:20000,note:''})}d.prefs.dark=db.prefs.dark;const prev=db;db=d;if(!await save({folderBackup:false})){db=prev;return}state.year=2027;state.month=4;go('home');notify('Exemplo fictício carregado.')}
async function clearAll(){
  if(saving||vaultBusy||(vault&&!vaultKey))return;
  if(!confirm('Apagar todos os dados deste navegador?'))return;
  const previous=db;
  if(backupDirectory&&folderKey){
    if(!await hasFolderPermission(true))return notify('Permita o acesso à pasta de backup antes de apagar os dados.');
    requestFolderPassword('Confirme a senha do backup para apagar',false,async password=>{
      const envelope=await readEncryptedFolder();
      const key=await deriveVaultKey(password,from64(envelope.salt));
      await openVault(envelope,key);
      await writeEncryptedFolder(backupDirectory,`Reserva_Simples_cifrado_antes-de-apagar_${Date.now()}.json`,key,envelope.salt);
      db=empty();
      if(!await save({folderBackup:false})){db=previous;throw Error('Falha ao apagar')}
      backupConflict=true;
      notify('Dados apagados. A cópia cifrada anterior foi mantida.');
    });
    return;
  }
  if(!confirm('Não há pasta de backup cifrado conectada. A exclusão é permanente neste aparelho. Deseja continuar?'))return;
  db=empty();
  if(!await save({folderBackup:false})){db=previous;return notify('Não foi possível apagar os dados. O conteúdo anterior foi mantido.')}
  render();
  notify('Dados apagados deste aparelho.');
}
document.addEventListener('click',e=>{if(e.target.closest('[data-close-calendar-day]')){$('#calendarDayDialog')?.close();return}if(e.target.closest('[data-task-edit-cancel]')){cancelCalendarTaskEdit();return}const taskEdit=e.target.closest('[data-task-edit]');if(taskEdit){editCalendarTask(taskEdit.dataset.taskEdit);return}const calendarRecordEdit=e.target.closest('[data-calendar-record-edit]');if(calendarRecordEdit){const id=calendarRecordEdit.dataset.calendarRecordEdit,record=db.records.find(x=>x.id===id);if(record&&confirm('Editar este lançamento? Ao salvar, os valores registrados poderão mudar nos totais e relatórios.')){calendarRecordEditPending=true;openModal(record.kind,record.id)}return}const calendarRecordDelete=e.target.closest('[data-calendar-record-delete]');if(calendarRecordDelete){const record=db.records.find(x=>x.id===calendarRecordDelete.dataset.calendarRecordDelete);if(record&&confirm(`Excluir ${money(record.amount)} de ${dateBR(record.date)}? Esta ação alterará os valores registrados no lançamento. Confirme novamente na próxima etapa.`))deleteRecord(record.id);return}const calendarAllocationEdit=e.target.closest('[data-calendar-allocation-edit]');if(calendarAllocationEdit){const item=db.allocations.find(x=>x.id===calendarAllocationEdit.dataset.calendarAllocationEdit);if(item&&confirm('Editar esta movimentação? Ao salvar, os valores registrados no cofrinho e seus saldos serão recalculados.'))openModal(item.amount>0?'add':'withdraw',item.id);return}const calendarAllocationDelete=e.target.closest('[data-calendar-allocation-delete]');if(calendarAllocationDelete){const item=db.allocations.find(x=>x.id===calendarAllocationDelete.dataset.calendarAllocationDelete);if(item&&confirm(`Excluir ${money(Math.abs(item.amount))} de ${dateBR(item.date)}? Isso alterará os valores registrados no cofrinho. Confirme novamente na próxima etapa.`))deleteAllocation(item.id);return}const calendarInvestmentEdit=e.target.closest('[data-calendar-investment-edit]');if(calendarInvestmentEdit){const item=db.investments.find(x=>x.id===calendarInvestmentEdit.dataset.calendarInvestmentEdit);if(item&&confirm('Editar este investimento? Ao salvar, os valores registrados na carteira e nos relatórios poderão mudar.')){calendarInvestmentEditPending=true;openInvestment(item.id)}return}const calendarInvestmentDelete=e.target.closest('[data-calendar-investment-delete]');if(calendarInvestmentDelete){const item=db.investments.find(x=>x.id===calendarInvestmentDelete.dataset.calendarInvestmentDelete);if(item&&confirm(`Excluir “${item.name}” da carteira? Isso alterará os valores registrados no investimento. Confirme novamente na próxima etapa.`))removeInvestment(item.id);return}const openAgendaDate=e.target.closest('[data-open-calendar-date]');if(openAgendaDate){const date=openAgendaDate.dataset.openCalendarDate;if(validDate(date)){state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;state.calendarDate=date;go('calendar');openCalendarDayOverlay()}return}const calDate=e.target.closest('[data-calendar-date]');if(calDate){state.calendarDate=calDate.dataset.calendarDate;calendarTaskEditId=null;calendar();$('#page-calendar [data-calendar-date="'+state.calendarDate+'"]')?.focus({preventScroll:true});openCalendarDayOverlay();return}const tagFilter=e.target.closest('[data-tx-tag]');if(tagFilter){state.txTag=tagFilter.dataset.txTag||'';renderTransactionList();return}const subcategoryFilter=e.target.closest('[data-tx-subcategory]');if(subcategoryFilter){state.txSubcategory=subcategoryFilter.dataset.txSubcategory||'';renderTransactionList();return}const taskToggle=e.target.closest('[data-task-toggle]');if(taskToggle){toggleCalendarTask(taskToggle.dataset.taskToggle);return}const taskDelete=e.target.closest('[data-task-delete]');if(taskDelete){deleteCalendarTask(taskDelete.dataset.taskDelete);return}const pdfScope=e.target.closest('[data-pdf-scope]');if(pdfScope){const input=$('#globalPdfScope');if(input)input.value=pdfScope.dataset.pdfScope;document.querySelectorAll('[data-pdf-scope]').forEach(b=>{b.classList.toggle('selected',b===pdfScope);b.setAttribute('aria-pressed',b===pdfScope?'true':'false')});return}if(e.target.closest('[data-close-reset]')){const root=$('#monthlyCloseChecklist');if(root){localStorage.removeItem('reserva.monthlyClose.'+root.dataset.month);syncMonthlyCloseChecklist()}return}if(e.target.closest('#globalPdfBtn')){if($('#globalPdfScope')?.value==='month'){const root=$('#monthlyCloseChecklist');if(root){const key='reserva.monthlyClose.'+root.dataset.month;let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}saved.pdf=true;localStorage.setItem(key,JSON.stringify(saved));syncMonthlyCloseChecklist()}}generateGlobalPdf();return}if(e.target.closest('#enableBillNotifications')){requestBillNotificationPermission();return}if(e.target.closest('#disableVaultBtn')){if(ACCOUNT)return notify('Perfis exigem cofre ativo.');if(vault&&vaultKey&&!saving&&!vaultBusy)showVaultDialog('disable');return}if(e.target.closest('#vaultAction')){if(saving||vaultBusy)return;if(vault){document.body.classList.add('reserve-locked');location.reload();return}if(!globalThis.crypto?.subtle||storageRecoveryRaw)return notify('O cofre requer HTTPS e uma base válida.');showVaultDialog('setup');return}if(e.target.closest('#moreTransactions')){transactionLimit+=30;renderTransactionList();($('#moreTransactions')||$('#transactionList .transaction-total'))?.focus();return}if(e.target.closest('#privacyToggle')){hideValues=!hideValues;localStorage.setItem('reserva.hideValues',String(hideValues));render();return}if(e.target.closest('#checkUpdatesBtn')){checkForUpdates();return}if(e.target.closest('#applyUpdateBtn')){applyUpdate();return}if(e.target.closest('#refreshCdiBtn')){updateCdi(true);return}if(e.target.closest('#shareCdbPdfBtn')){generateCdbPdf();return}if(e.target.closest('[data-register-investment]')){closeModal(true);go('investments');return}if(e.target.closest('#quickAddButton,[data-register-menu]')){openQuickAdd();return}const quick=e.target.closest('[data-quick-open]');if(quick){quick.dataset.quickOpen==='add'?openDepositPicker():openModal(quick.dataset.quickOpen,null,true);return}if(e.target.closest('#monthTitle')){openMonthPicker();return}if(e.target.closest('#todayBtn')){const d=new Date();state.year=d.getFullYear();state.month=d.getMonth();render();return}const clearCategorySet=e.target.closest('[data-clear-tx-category-set]');if(clearCategorySet){state.txCategorySet=null;renderTransactionList();return}const txf=e.target.closest('[data-tx-filter]');if(txf){state.txCategorySet=null;state.txFilter=txf.dataset.txFilter;document.querySelectorAll('[data-tx-filter]').forEach(b=>{b.classList.toggle('selected',b===txf);b.setAttribute('aria-pressed',b===txf?'true':'false')});renderTransactionList();return}const delInstitution=e.target.closest('[data-delete-institution]');if(delInstitution){deleteInstitution(delInstitution.dataset.deleteInstitution);return}const p=e.target.closest('[data-page]');if(p){p.closest('#mobileMoreDialog')?.close();if(p.dataset.txSet)state.txFilter=p.dataset.txSet;go(p.dataset.page);if(p.hasAttribute('data-open-planning'))requestAnimationFrame(()=>$('#planningSettingsDetails')?.setAttribute('open',''));return}const o=e.target.closest('[data-open]');if(o){openModal(o.dataset.open,o.dataset.jar||o.dataset.institution||null);return}const editRecord=e.target.closest('[data-edit-record]');if(editRecord){const r=db.records.find(x=>x.id===editRecord.dataset.editRecord);if(r)openModal(r.kind,r.id);return}if(e.target.closest('#copyPreviousBtn')){openCopyPreviousExpenses();return}if(e.target.closest('#applyRecurringBtn')){applyRecurring();return}const pause=e.target.closest('[data-toggle-recurring]');if(pause){toggleRecurring(pause.dataset.toggleRecurring);return}const recEdit=e.target.closest('[data-edit-recurring]');if(recEdit){openModal('recurring',recEdit.dataset.editRecurring);return}const recDelete=e.target.closest('[data-delete-recurring]');if(recDelete){deleteRecurring(recDelete.dataset.deleteRecurring);return}const ed=e.target.closest('[data-edit-jar]');if(ed){openModal('jar',ed.dataset.editJar);return}const r=e.target.closest('[data-delete-record]');if(r){deleteRecord(r.dataset.deleteRecord);return}const a=e.target.closest('[data-delete-allocation]');if(a){deleteAllocation(a.dataset.deleteAllocation);return}const toggleJar=e.target.closest('[data-toggle-jar]');if(toggleJar){toggleJarPlan(toggleJar.dataset.toggleJar);return}const archive=e.target.closest('[data-archive-jar]');if(archive){archiveJar(archive.dataset.archiveJar,true);return}const restore=e.target.closest('[data-restore-jar]');if(restore){archiveJar(restore.dataset.restoreJar,false);return}const j=e.target.closest('[data-delete-jar]');if(j){deleteJar(j.dataset.deleteJar);return}if(e.target.closest('[data-close]')||e.target.closest('#closeModal')||e.target===$('#modal')){closeModal();return}if(e.target.closest('#chooseBackupFolderBtn')){chooseBackupFolder();return}if(e.target.closest('#reconnectBackupFolderBtn')){reconnectBackupFolder();return}if(e.target.closest('#saveFolderBackupBtn')){writeFolderBackup(true);return}if(e.target.closest('#restoreFolderBackupBtn')){restoreFolderBackup();return}if(e.target.closest('#exportBtn')){backup();return}if(e.target.closest('#bankCsvBtn')){$('#bankCsvFile')?.click();return}if(e.target.closest('#csvBtn')){csv();return}if(e.target.closest('#importBtn')){$('#importFile')?.click();return}if(e.target.closest('#demoBtn')){demo();return}if(e.target.closest('#clearBtn')){clearAll();return}if(e.target.closest('#exportCorruptBtn')){if(storageRecoveryRaw){download(storageRecoveryRaw,'application/json',`reserva-dados-brutos-${new Date().toISOString().slice(0,10)}.txt`);recoveryArchived=true;settings()}return}if(e.target.closest('#startFreshAfterCorruptBtn')){startFreshAfterCorrupt();return}});
document.addEventListener('submit',e=>{if(e.target.id==='homeCustomPeriodForm'){e.preventDefault();localStorage.setItem('reserva.home.from',e.target.elements.from.value);localStorage.setItem('reserva.home.to',e.target.elements.to.value);localStorage.setItem('reserva.home.period','custom');home();return}if(e.target.id==='calendarTaskForm'){submitCalendarTask(e);return}if(e.target.id==='vaultForm')return;if(e.target.id==='bankCsvImportForm'){submitBankCsvImport(e);return}if(e.target.id==='planningPrefsForm'){savePlanningPrefs(e);return}if(e.target.id==='entryForm')submitEntry(e);if(e.target.id==='copyExpensesForm')submitCopyExpenses(e);if(e.target.id==='monthJumpForm'){e.preventDefault();const year=Number($('#monthJumpYear').value),month=Number($('#monthJumpMonth').value);if(Number.isInteger(year)&&year>=1900&&year<=2200&&Number.isInteger(month)&&month>=0&&month<=11){state.year=year;state.month=month;closeModal(true);render()}}});
document.addEventListener('input',e=>{if(e.target.id==='amount')preview();if(e.target.id==='jarTarget'||e.target.id==='jarDue')goalDraftPreview();if(e.target.id==='simAmount'){state.simAmount=e.target.value;simulateGoal()}if(['debtPayoff','debtPayment','debtMonths','debtCET'].includes(e.target.id))updateDebtComparison();if(e.target.id==='transactionSearch'){state.txCategorySet=null;state.txSearch=e.target.value;renderTransactionList()}});
document.addEventListener('change',async e=>{if(e.target.matches('[data-close-check]')){const root=$('#monthlyCloseChecklist');if(root){const key='reserva.monthlyClose.'+root.dataset.month;let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}saved[e.target.dataset.closeCheck]=e.target.checked;localStorage.setItem(key,JSON.stringify(saved));syncMonthlyCloseChecklist()}return}if(e.target.id==='jarTarget'||e.target.id==='jarDue'||e.target.name==='linkedInvestment')goalDraftPreview();if(e.target.id==='simGoal'){state.simGoal=e.target.value;simulateGoal()}if(e.target.id==='recurringKind'){const expense=e.target.value==='expense';$('#recurringCategoryWrap').hidden=!expense;$('#recurringSourceWrap').hidden=expense}if(e.target.id==='darkMode')await mutate(()=>db.prefs.dark=e.target.checked);if(e.target.id==='billReminders'){const enabled=e.target.checked;if(await mutate(()=>db.prefs.billReminders=enabled)){if(enabled)await checkBillReminders();else notify('Lembretes de contas desativados.')}}if(e.target.id==='billReminderDays'){const days=Number(e.target.value);if([0,1,3,7].includes(days)){if(await mutate(()=>db.prefs.billReminderDays=days))await checkBillReminders()}}if(e.target.id==='bankCsvFile'){const file=e.target.files?.[0];e.target.value='';if(file)importBankCsv(file);return}if(e.target.id==='importFile'){importFile(e.target.files[0]);e.target.value=''}});
$('#prevMonth').addEventListener('click',()=>changeMonth(-1));$('#nextMonth').addEventListener('click',()=>changeMonth(1));let monthTouchStart=0;$('#monthTitle').addEventListener('touchstart',e=>{monthTouchStart=e.changedTouches[0].clientX},{passive:true});$('#monthTitle').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-monthTouchStart;if(Math.abs(dx)>55)changeMonth(dx<0?1:-1)},{passive:true});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Tab'&&$('#modal').classList.contains('open')){const items=[...$('#modal').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(items.length){const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();go('transactions');$('#transactionSearch')?.focus()}});
$('#vaultForm').addEventListener('submit',submitVault);
$('#vaultDialog').addEventListener('cancel',event=>{if((vault&&!vaultKey)||vaultBusy)event.preventDefault()});
$('#vaultCancel').addEventListener('click',()=>{if(!vaultBusy && (!vault||vaultKey))$('#vaultDialog').close()});
render();window.scrollTo({top:0,left:0,behavior:'instant'});document.querySelectorAll('.sidebar,#desktopSidebar').forEach(element=>{element.scrollTop=0});const notificationLink=new URLSearchParams(location.search);
const dueDate=notificationLink.get('budgetDate');
const reminderDate=notificationLink.get('calendarDate');
if(validDate(dueDate))openDesktopNotification({kind:'budget',date:dueDate});
else if(validDate(reminderDate)){setViewDate(reminderDate);go('calendar')}
if(storageRecoveryRaw)setTimeout(()=>notify('Dados inválidos preservados. Acesse Configurações para exportar ou iniciar uma base nova.'),0);
if(navigator.storage?.persist)navigator.storage.persist().then(granted=>{persistenceStatus=granted?'O navegador autorizou armazenamento persistente.':'O navegador pode remover dados locais em uma limpeza de armazenamento.';const el=$('#storagePersistenceStatus');if(el)el.textContent=persistenceStatus}).catch(()=>{persistenceStatus='Não foi possível confirmar a proteção de armazenamento.'});
initFolderBackup();
if(location.protocol!=='file:')checkForUpdates();
function whileAppIdle(callback){
  return ()=>{if(!diagnosticRunning&&navigator.onLine)void callback()};
}
if(location.protocol!=='file:'&&navigator.onLine){
  setInterval(whileAppIdle(checkForUpdates),6*60*60*1000);
  setTimeout(whileAppIdle(updateCdi),1100);
  setInterval(whileAppIdle(updateCdi),12*60*60*1000);
  setTimeout(whileAppIdle(updateIpca),1500);
  setInterval(whileAppIdle(updateIpca),24*60*60*1000);
}
window.addEventListener('offline',()=>diagnostics.record('connection.offline'));
window.addEventListener('resize',syncDesktopHeaderControls,{passive:true});
mobileNavigationMedia.addEventListener?.('change',syncDesktopHeaderControls);
window.addEventListener('online',()=>{diagnostics.record('connection.online');if(location.protocol!=='file:'&&!diagnosticRunning){checkForUpdates();updateCdi();updateIpca()}});
let notificationDate=isoToday();
function refreshDatedNotifications(){
  const today=isoToday();
  if(diagnosticRunning||today===notificationDate)return;
  notificationDate=today;
  renderDesktopNotifications();
}
window.addEventListener('focus',refreshDatedNotifications);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDatedNotifications()});
setInterval(refreshDatedNotifications,30000);
const checkDatedReminders=whileAppIdle(checkBillReminders);
window.addEventListener('focus',checkDatedReminders);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDatedReminders()});
setTimeout(checkDatedReminders,2500);
setInterval(checkDatedReminders,30*60*1000);
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{updateRegistration=reg}).catch(e=>diagnostics.record('offline.registration_failed',e)));
document.addEventListener('keydown',event=>{
  const reload=event.key==='F5'||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='r');
  if(!reload||updateInProgress)return;
  event.preventDefault();
  notify('Recarga por atalho bloqueada. Use Ajustes → Atualizações para atualizar o app.');
});
window.addEventListener('beforeunload',event=>{
  if(updateInProgress)return;
  if(!saving&&!vaultBusy&&!$('#modalContent form')?.closest('.modal.open')&&!document.querySelector('dialog[open] form'))return;
  event.preventDefault();
  event.returnValue='';
});

const integrityJournal = STORE + '.integrity.v1';
const integrityRetention = 30 * 86400000;
const integrityEvents = [];
let integrityRunning = false, integrityQueue = Promise.resolve(), integrityLast;
let integrityContainmentLock = false;
function integrityRecord(check, status, detail = {}) {
  if(diagnosticFixtureStorages.has(window.localStorage))return;
  integrityEvents.push({check,status,...detail,time:Date.now()});
}
async function integrityHistory() {
  const key = vaultKey;
  const salt = vault?.salt;
  const run = async () => {
    const since = Date.now()-integrityRetention;
    while (integrityEvents[0]?.time <= since) integrityEvents.shift();
    if (!key) return {status:'pendente',events:integrityEvents.slice()};
    const raw = localStorage.getItem(integrityJournal);
    const aad = encoder.encode('reserva.integrity.v1');
    let previous = [];
    if (raw) {
      const entry = JSON.parse(raw);
      const clear = await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(entry.iv),additionalData:aad},key,from64(entry.data));
      previous = JSON.parse(new TextDecoder().decode(clear));
      if (!Array.isArray(previous)) throw Error();
    }
    const batch = integrityEvents.slice();
    const events = [...previous,...batch].filter(item=>Number.isFinite(item.time)&&item.time>since);
    if (batch.length || events.length !== previous.length) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,encoder.encode(JSON.stringify(events)));
      if (vaultKey !== key || vault?.salt !== salt || localStorage.getItem(integrityJournal)!==raw) throw Error();
      localStorage.setItem(integrityJournal,JSON.stringify({iv:bytesTo64(iv),data:bytesTo64(new Uint8Array(data))}));
      integrityEvents.splice(0,batch.length);
    }
    return {status:'aprovada',events};
  };
  const result = integrityQueue.then(()=>navigator.locks ? navigator.locks.request(integrityJournal,run) : run())
    .catch(()=>({status:'alerta',events:integrityEvents.slice()}));
  integrityQueue = result;
  return result;
}
async function integrityBank() {
  if (saving || vaultBusy) return 'pendente';
  const raw = localStorage.getItem(STORE);
  if (!raw) return vault ? 'alerta' : 'pendente';
  try {
    const data = JSON.parse(raw);
    if (data?.format !== 'reserva-vault-1') {
      if(!verify(data))return 'alerta';
      return raw!==loadedStoreRaw?'pendente':'sem_cofre';
    }
    validateVaultEnvelope(data);
    if(raw!==loadedStoreRaw)return 'pendente';
    if (!vaultKey) return 'pendente';
    await openVault(data,vaultKey);
    return raw === localStorage.getItem(STORE) ? 'aprovada' : 'pendente';
  } catch {return 'alerta';}
}
const releaseFiles=['./index.html','./app.js','./engines.js','./manifest.webmanifest','./version.json','./sw.js'];
const releaseManifestPath='./integrity-manifest.json';
function validReleaseManifest(manifest){
  return manifest?.format===1&&manifest.version===APP_VERSION&&manifest.assets&&
    Object.keys(manifest.assets).length===releaseFiles.length&&
    releaseFiles.every(path=>typeof manifest.assets[path]==='string'&&/^[a-f0-9]{64}$/.test(manifest.assets[path]));
}
async function integrityAssets(repair = false) {
  if (!/^https?:$/.test(location.protocol) || !navigator.serviceWorker?.controller || !globalThis.caches || !globalThis.crypto?.subtle)
    return [{check:'cache_pwa',status:'pendente',reason:'Service Worker ou cache da versão indisponível'}];
  const name = APP_CACHE_NAME;
  if (!(await caches.has(name))) return [{check:'cache_pwa',status:'pendente',reason:'Service Worker ou cache da versão indisponível'}];
  const cache = await caches.open(name);
  const manifestUrl=new URL(releaseManifestPath,location.href);
  let manifest=null;
  try{
    const response=await cache.match(manifestUrl);
    if(response?.ok)manifest=await response.json();
  }catch{}
  let replacementManifest=null;
  if(!validReleaseManifest(manifest)&&repair&&navigator.onLine){
    try{
      const response=await fetch(manifestUrl,{cache:'no-store',redirect:'error'});
      const fresh=response.ok?await response.clone().json():null;
      if(validReleaseManifest(fresh)){
        // Only replace the manifest after the matching files have been checked below.
        manifest=fresh;
        replacementManifest=response;
      }
    }catch{}
  }
  if(!validReleaseManifest(manifest))return [{
    check:releaseManifestPath,status:'alerta',reason:'Manifesto de integridade ausente, inválido ou de outra versão'
  }];
  const hashResponse = async response => {
    if (!response?.ok) return false;
    const digest = await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
    return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  };
  const results = [];
  const replacements = [];
  for (const [path,hash] of Object.entries(manifest.assets)) {
    const url = new URL(path,location.href);
    let status,observedHash,source='service_worker_cache';
    try {
      observedHash=await hashResponse(await cache.match(url));
      if (observedHash===hash) status = repair ? 'sem_correcao_aplicavel' : 'aprovada';
      else if (!repair) status = 'alerta';
      else if (!navigator.onLine) status = 'pendente';
      else {
        const response = await fetch(url,{cache:'no-store',redirect:'error'});
        const networkHash=await hashResponse(response.clone());
        source='network';
        if (networkHash!==hash) {status='alerta';observedHash=networkHash;}
        else {
          replacements.push({url,hash,response,resultIndex:results.length});
          status = 'validada_para_reparo';
          observedHash=networkHash;
        }
      }
    } catch {status='alerta';}
    results.push({check:path,status,action:repair?'validar_reposicao':'comparar_sha256',
      expected_sha256:hash,observed_sha256:observedHash||undefined,source,cache_name:name,
      reason:status==='alerta'?(observedHash?'O hash observado diverge do manifesto desta versão':'Arquivo ausente ou ilegível no cache da versão'):
        status==='pendente'?'Sem conexão para validar um arquivo alterado no cache':undefined});
  }
  const canRepair = results.every(item=>['sem_correcao_aplicavel','validada_para_reparo'].includes(item.status));
  for (const {url,hash,response,resultIndex} of replacements) {
    const result = results[resultIndex];
    if (!canRepair) {
      Object.assign(result,{status:'pendente',reason:'Outro arquivo da versão ficou sem validação'});
      continue;
    }
    try {
      await cache.put(url,response);
      const verifiedHash=await hashResponse(await cache.match(url));
      Object.assign(result,{status:verifiedHash===hash?'corrigida':'alerta',action:'repor_e_reverificar',
        observed_sha256:verifiedHash||undefined,source:'network',reason:verifiedHash===hash?'Arquivo obtido da origem e revalidado após gravação no cache':'A rechecagem após gravação divergiu do hash esperado'});
    } catch {Object.assign(result,{status:'alerta',reason:'Falha ao gravar ou reler o cache'});}
  }
  const manifestOk=results.every(item=>['aprovada','sem_correcao_aplicavel','corrigida'].includes(item.status));
  const manifestResult={check:releaseManifestPath,status:repair?'sem_correcao_aplicavel':'aprovada',action:'validar_versao_de_publicacao'};
  if(replacementManifest){
    if(!manifestOk){
      manifestResult.status='pendente';
      manifestResult.reason='Há arquivos da versão sem validação';
    }else{
      try{await cache.put(manifestUrl,replacementManifest);manifestResult.status='corrigida'}
      catch{manifestResult.status='alerta';manifestResult.reason='Não foi possível salvar o manifesto no cache'}
    }
  }
  return [manifestResult,...results];
}
function integrityInterface() {
  return PAGES.map(([id])=>{
    const screen=document.querySelectorAll('#page-'+id);
    const hasRenderer=typeof pageRenderers[id]==='function';
    const desktopLink=$('#desktopNav [data-page="'+id+'"]');
    const mobileLink=$('#mobileNav [data-page="'+id+'"],#mobileMoreDialog [data-page="'+id+'"]');
    return {check:'interface.'+id,
      status:screen.length===1&&hasRenderer&&desktopLink&&mobileLink?'aprovada':'alerta',
      action:'verificar_tela_renderizador_e_navegacao'};
  });
}
async function integrityRepairJournal() {
  const before = localStorage.getItem(integrityJournal);
  const result = await integrityHistory();
  if (result.status!=='aprovada') return {check:'diario',status:result.status,
    reason:result.status==='pendente'?'Cofre fechado ou desativado':'Falha ao abrir ou atualizar diário cifrado'};
  return {check:'diario',status:'aprovada',action:'autenticar_e_aplicar_retencao',
    reason:before===localStorage.getItem(integrityJournal)?'Diário sem alteração necessária':'Diário cifrado atualizado'};
}
let integrityMonitoring = false;
let integrityLastCache = 0;
function integrityStoreCheck(results) {
  for (const {check,status,reason,action,recheckOf} of results)
    integrityRecord(check,status,{reason,action,recheckOf});
  if (results.some(item=>item.status==='alerta')) notify('Central de Integridade detectou uma anomalia. Consulte Ajustes.');
}
async function integrityMonitor() {
  if (integrityRunning || diagnosticRunning || integrityMonitoring) return;
  integrityMonitoring = true;
  try {
    const status = await integrityBank().catch(()=> 'pendente');
    if (status !== integrityLast) {
      integrityLast = status;
      integrityContainmentLock = status==='alerta';
      integrityStoreCheck([{check:'banco.monitoramento',status,
        reason:status==='alerta'?'Falha na validação do banco':'Estado do banco verificado',
        action:status==='alerta'?'suspender_gravacoes':'manter_operacao'}]);
    }
    if (Date.now()-integrityLastCache >= 60000) {
      integrityLastCache = Date.now();
      integrityStoreCheck(await integrityAssets());
    }
    await integrityHistory();
  } catch {integrityRecord('monitoramento','alerta');}
  finally {integrityMonitoring = false;}

}
async function integrityScan() {
  if (!canStartDiagnostic()) return;
  integrityRunning = diagnosticRunning = true;
  const dialog = document.createElement('dialog');
  const names = ['Varredura de integridade','Autocorreção','Monitoramento e checagem','Diagnóstico'];
  dialog.setAttribute('aria-label','Central de Integridade');
  dialog.className = 'card integrity-progress';
  dialog.innerHTML = '<div class="settings-card-head"><span class="settings-icon">'+icon('refresh')+'</span><div><h2>Central de Integridade</h2><p role="status" class="integrity-screen">Preparando verificações</p></div></div>'+names.map((name,index)=>'<div class="integrity-stage"><div><strong>'+name+'</strong><output>Aguardando</output></div><p class="integrity-stage-detail" id="integrity-stage-detail-'+index+'">Aguardando esta etapa</p><progress max="100" value="0" aria-label="'+name+'"></progress></div>').join('');
  dialog.addEventListener('cancel',event=>event.preventDefault());
  document.body.append(dialog);
  const outputs = dialog.querySelectorAll('output');
  const bars = dialog.querySelectorAll('progress');
  const details = [...dialog.querySelectorAll('.integrity-stage-detail')];
  const stages = [], stageTimings = [];
  const scanStartedAt = new Date().toISOString(), scanStartedPerf = performance.now();
  let runId = '';
  async function step(index,work) {
    const duration = [6000,8000,12000,15000][index];
    const start = performance.now();
    const startedAt = new Date().toISOString();
    let frame, timer;
    const draw = now => {
      bars[index].value = Math.min(99,(now-start)/duration*100);
      outputs[index].textContent = Math.floor(bars[index].value)+'%';
      frame = requestAnimationFrame(draw);
    };
    try {
      outputs[index].textContent='0%';
      details[index].textContent = ['Conferindo banco, telas e arquivos do cache','Validando diário e tentando reparar arquivos comprovadamente íntegros','Repetindo as verificações e observando alterações','Percorrendo os módulos do diagnóstico normal'][index];
      frame = requestAnimationFrame(draw);
      const [result] = await Promise.all([work(message=>{details[index].textContent=message;}),new Promise(resolve=>{timer=setTimeout(resolve,duration);})]);
      bars[index].value=100;
      outputs[index].textContent='Concluída';
      stageTimings.push({stage_index:index,stage:names[index],status:'concluida',started_at:startedAt,
        completed_at:new Date().toISOString(),duration_ms:Math.round(performance.now()-start),target_duration_ms:duration,
        checks_count:Array.isArray(result)?result.length:1});
      return result;
    } catch(error) {
      stageTimings.push({stage_index:index,stage:names[index],status:'falha',started_at:startedAt,
        completed_at:new Date().toISOString(),duration_ms:Math.round(performance.now()-start),target_duration_ms:duration,
        error_type:['Error','TypeError','ReferenceError','SyntaxError','RangeError','QuotaExceededError','SecurityError','NetworkError','AbortError','NotAllowedError'].includes(error?.name)?error.name:'Error'});
      throw error;
    } finally {cancelAnimationFrame(frame);clearTimeout(timer);}
  }
  try {
    dialog.showModal();
    runId = crypto.randomUUID ? crypto.randomUUID() : 'run-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    stages.push(await step(0,async update=>{
      update('Autenticando e validando a estrutura do banco');
      const bank=[{check:'banco',status:await integrityBank()}];
      update('Conferindo presença das telas do aplicativo');
      const pages=integrityInterface();
      update('Comparando os hashes dos arquivos no cache');
      return [...bank,...pages,...await integrityAssets()];
    }));
    stages.push(await step(1,async update=>{
      update('Preservando os dados financeiros e verificando o diário');
      const bank={check:'banco',status:'sem_correcao_aplicavel',reason:'Banco preservado para evitar sobrescrever registros'};
      const journal=await integrityRepairJournal();
      update('Buscando cópias válidas para reparar o cache');
      const assets=await integrityAssets(true);
      return [bank,journal,...assets];
    }));
    stages.push(await step(2,async update=>{
      update('Reautenticando o banco após as ações de correção');
      const bank={check:'banco.rechecagem',status:await integrityBank()};
      update('Rechecando as telas e os arquivos do cache');
      return [bank,...integrityInterface(),...await integrityAssets()];
    }));
    stages.flat().forEach(result=>{
      const {check,status,...details}=result;
      integrityRecord(check,status,{...details,runId});
    });
    const scan = await step(3,async()=>{
      const screen = dialog.querySelector('.integrity-screen');
      const started = performance.now();
      const result = await runDiagnosticScan(async(_step,title,percent)=>{
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,14500*percent/100-(performance.now()-started))));
        screen.textContent = title;
        await new Promise(resolve=>requestAnimationFrame(resolve));
      });
      const items = diagnosticChecks(result);
      const failures=items.filter(item=>['falha','erro','contrato_incompativel'].includes(item.status)).length;
      const warnings=items.filter(item=>item.status==='alerta').length;
      const pending=items.filter(item=>['pendente','ignorado','não_suportado','manual'].includes(item.status)).length;
      const summary={check:'diagnostico.integrado',status:failures||warnings?'alerta':'aprovada',runId,
        durationMs:result.durationMs,modules:result.modules.length,checks:items.length,failures,warnings,pending,
        action:'executar_diagnostico_normal_tela_a_tela',
        reason:`${failures} falha(s), ${warnings} aviso(s) e ${pending} verificação(ões) sem conclusão automática.`};
      stages.push([summary]);
      const {check,status,...detail}=summary;
      integrityRecord(check,status,detail);
      return result;
    });
    const checks = stages.flat();
    const totals = {
      aprovadas:checks.filter(item=>item.status==='aprovada'||item.status==='ok').length,
      corrigidas:checks.filter(item=>item.status==='corrigida').length,
      alertas:checks.filter(item=>['alerta','falha','erro'].includes(item.status)).length,
      pendentes:checks.filter(item=>['pendente','sem_cofre','ignorado','não_suportado'].includes(item.status)).length
    };
    const history = await integrityHistory();
    const summary = $('#integritySummary');
    if (summary) summary.textContent = Object.entries(totals).map(([label,count])=>count+' '+label).join(' · ') +
      (checks.some(item=>item.status==='sem_cofre')?' · Banco sem cofre ativo.':'') +
      (checks.some(item=>item.check==='cache_pwa'&&item.status==='pendente')?' · Cache da PWA indisponível.':'') +
      (history.status!=='aprovada'?' · Histórico cifrado não confirmado.':'');
    const completedAt=new Date().toISOString();
    download(JSON.stringify({...diagnosticReport(scan),centralDeIntegridade:{schemaVersion:'reserva.integrity.report.v3',runId,startedAt:scanStartedAt,completedAt,durationMs:Math.round(performance.now()-scanStartedPerf),stages,stageTimings,history,totals}},null,2),'application/json','Reserva_Simples_Diagnostico_Integridade.json');
    notify('Diagnóstico da Central de Integridade gerado.');
  } catch(error) {
    const errorType=['Error','TypeError','ReferenceError','SyntaxError','RangeError','QuotaExceededError','SecurityError','NetworkError','AbortError','NotAllowedError'].includes(error?.name)?error.name:'Error';
    integrityRecord('central.execucao','alerta',{runId:runId||undefined,error_type:errorType,reason:'A execução da Central de Integridade foi interrompida antes de concluir todas as etapas'});
    const completedAt=new Date().toISOString();
    const history=await integrityHistory();
    const checks=stages.flat();
    const totals={aprovadas:checks.filter(item=>['aprovada','ok'].includes(item.status)).length,
      corrigidas:checks.filter(item=>item.status==='corrigida').length,
      alertas:checks.filter(item=>['alerta','falha','erro'].includes(item.status)).length+1,
      pendentes:checks.filter(item=>['pendente','sem_cofre','ignorado','não_suportado'].includes(item.status)).length};
    download(JSON.stringify({...diagnosticReport(null),centralDeIntegridade:{schemaVersion:'reserva.integrity.report.v3',runId:runId||null,
      startedAt:scanStartedAt,completedAt,durationMs:Math.round(performance.now()-scanStartedPerf),stages,stageTimings,history,totals,
      failure:{stage:stageTimings.at(-1)?.stage||names[stageTimings.length],type:errorType}}},null,2),
      'application/json','Reserva_Simples_Diagnostico_Integridade.json');
    notify('Falha ao concluir a Central de Integridade.');
  } finally {
    dialog.remove();
    integrityRunning = diagnosticRunning = false;
  }
}
integrityRecord('app.inicio','observado');
document.addEventListener('click',event=>{if(event.target.closest('#integrityScanBtn')) void integrityScan();});
document.addEventListener('securitypolicyviolation',()=>{
  integrityStoreCheck([{check:'politica.conteudo',status:'alerta'}]);
  void integrityHistory();
});
document.addEventListener('visibilitychange',()=>{if (!document.hidden) void integrityMonitor();});
window.addEventListener('storage',event=>{if(event.key===STORE) void integrityMonitor();});
setInterval(integrityMonitor,15000);
void integrityMonitor();

})();
