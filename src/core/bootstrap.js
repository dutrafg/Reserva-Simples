(()=>{'use strict';
const byAllocationDate = (a,b) => a.date.localeCompare(b.date) || Number(b.amount > 0) - Number(a.amount > 0) || a.id.localeCompare(b.id);
const IOF_PERCENT = [0,96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3];
const Accounts=window.ReservaAccounts;
const ACCOUNT=Accounts.active(localStorage);
let GUEST=!ACCOUNT&&localStorage.getItem('reserva.guest.enabled.v1')==='true';
const STORE=ACCOUNT?Accounts.storeKey(ACCOUNT.id):'reserva-simples-v2';
const userKey=key=>ACCOUNT?key+'::'+ACCOUNT.id:key;
const Engines=window.ReservaEngines;
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATS=['Água','Luz','Internet','Faculdade','Farmácia','Cartões','Telefone','Mercado','Comida / Marmita','Moradia','Transporte','Saúde','Lazer','Assinaturas','Pecuária','Outros'];
const CALENDAR_TASK_COLORS={blue:'#1762c4',green:'#17834c',teal:'#0f8b8d',purple:'#8064d8',red:'#c44747',orange:'#bb7516'};
const CALENDAR_TASK_COLOR_LABELS={blue:'Azul',green:'Verde',teal:'Turquesa',purple:'Roxo',red:'Vermelho',orange:'Laranja'};
const calendarTaskColor=color=>CALENDAR_TASK_COLORS[color]||CALENDAR_TASK_COLORS.blue;
const CAT_COLORS=['#3488f5','#f4a56c','#6d6ce8','#659ed4','#d98ba9','#879db5','#74bbdf','#e6a26d','#a3a6d7','#b392db','#d78f86','#5babc3','#c5b26b','#a8bbc9','#9b7b46','#8c9bab'];
const PAGES=[['home','Hoje','home'],['register','Registrar','plus'],['transactions','Lançamentos','wallet'],['budget','Finanças','wallet'],['goals','Metas','target'],['investments','Investimentos','piggy'],['analysis','Insights','chart'],['reports','Relatórios','report'],['settings','Ajustes','settings']];
const APP_VERSION='1.0.0-beta.35';
const APP_CACHE_NAME='reserva-simples-v'+APP_VERSION+'-pwa';
const TELEMETRY_SCHEMA='reserva.telemetry.event.v1';
const diagnosticFixtureStorages = new WeakSet();
const diagnostics=window.ReservaDiagnostics.create({userKey,APP_VERSION,TELEMETRY_SCHEMA,PAGES,diagnosticFixtureStorages});
const updateInfo={lastCheck:localStorage.getItem('reserva.update.checkedAt')||'',latest:APP_VERSION,available:false,status:'Aguardando verificação',state:'waiting',notes:''};
try {
  const pendingVersion=localStorage.getItem('reserva.update.pendingVersion');
  if(pendingVersion===APP_VERSION){localStorage.removeItem('reserva.update.pendingVersion');diagnostics.record('update.applied',undefined,{status:'aprovada',target_version:pendingVersion,reason:'A nova versão iniciou após a ativação do Service Worker'});}
} catch {}
let updateRegistration=null;
const $=(q)=>document.querySelector(q);
const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
let hideValues = localStorage.getItem(userKey('reserva.hideValues')) === 'true';
const money = n => hideValues ? '••••' : fmt.format((n || 0) / 100);
const percent=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const toCents=value=>{const n=Number(value),cents=Math.round(n*100);return Number.isFinite(n)&&cents>0&&n<=100000000?cents:NaN};
const icon=name=>`<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const sum=a=>a.reduce((v,n)=>v+n,0);
const empty=()=>({version:4,ownerId:null,profile:null,investments:[],records:[],jars:[],allocations:[],recurring:[],tasks:[],notes:[],institutions:[{id:'inter-default',name:'Banco Inter',type:'bank',cdiPercent:100,guaranteeFund:'fgc',conglomerate:'Banco Inter',otherCoveredBalance:0,isDefault:true}],prefs:{dark:!!window.matchMedia?.('(prefers-color-scheme: dark)').matches,balanceAnchorCents:null,balanceAnchorDate:'',emergencyMonths:6,categoryBudgets:{},billReminders:false,billReminderDays:1}});
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d}
function validTime(value){return value===''||typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)}
function normalizeTags(value){const input=Array.isArray(value)?value:String(value||'').split(/[;,]/);return [...new Set(input.map(x=>String(x||'').trim().replace(/^#+/,'').slice(0,30)).filter(Boolean).map(x=>x.slice(0,30)))].slice(0,8)}
function verify(src){if(!src||![2,3,4].includes(src.version)||!Array.isArray(src.records)||!Array.isArray(src.jars)||!Array.isArray(src.allocations)||src.records.length>50000||src.jars.length>5000||src.allocations.length>50000||!Array.isArray(src.recurring||[])||(src.recurring||[]).length>5000||!Array.isArray(src.tasks||[])||(src.tasks||[]).length>10000||!Array.isArray(src.institutions??[])||(src.institutions??[]).length>5000)return null;
 const clean=empty();const ids=new Set();
 const goodId=id=>typeof id==='string'&&id.length>0&&id.length<=120&&!ids.has(id)&&(ids.add(id),true);
 for(const x of src.records){if(!x||!goodId(x.id)||!['income','expense'].includes(x.kind)||!Number.isSafeInteger(x.amount)||x.amount<=0||x.amount>10000000000||!validDate(x.date))return null;clean.records.push({id:x.id,kind:x.kind,amount:x.amount,date:x.date,source:x.source==='salary'?'salary':'complement',category:CATS.includes(x.category)?x.category:'Outros',subcategory:String(x.subcategory||'').trim().slice(0,50),tags:normalizeTags(x.tags),note:String(x.note||'').slice(0,140),recurringId:typeof x.recurringId==='string'&&x.recurringId.length<=120?x.recurringId:null,recurringMonth:/^\d{4}-\d{2}$/.test(x.recurringMonth||'')?x.recurringMonth:null,investmentId:typeof x.investmentId==='string'&&x.investmentId.length<=120?x.investmentId:null,investmentExpenseId:typeof x.investmentExpenseId==='string'&&x.investmentExpenseId.length<=120?x.investmentExpenseId:null})}
 clean.institutions=[];const institutionIds=new Set();for(const x of src.institutions||[]){const pct=Number(x?.cdiPercent??100),fund=['fgc','fgcoop','none'].includes(x?.guaranteeFund)?x.guaranteeFund:(x?.type==='cooperative'?'fgcoop':'fgc'),other=Number.isSafeInteger(x?.otherCoveredBalance)&&x.otherCoveredBalance>=0?x.otherCoveredBalance:0;if(!x||!goodId(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>70||!['bank','cooperative'].includes(x.type)||!Number.isFinite(pct)||pct<=0||pct>500)return null;clean.institutions.push({id:x.id,name:x.name.trim(),type:x.type,cdiPercent:pct,guaranteeFund:fund,conglomerate:String(x.conglomerate||x.name).trim().slice(0,100),otherCoveredBalance:other,isDefault:!!x.isDefault});institutionIds.add(x.id)}if(!institutionIds.has('inter-default')){clean.institutions.unshift({id:'inter-default',name:'Banco Inter',type:'bank',cdiPercent:100,guaranteeFund:'fgc',conglomerate:'Banco Inter',otherCoveredBalance:0,isDefault:true});institutionIds.add('inter-default')}
 for(const x of src.jars){if(!x||!goodId(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>70||!Number.isSafeInteger(x.target)||x.target<=0||x.target>10000000000||!validDate(x.dueDate))return null;const name=x.name.trim(),legacyChallenge=x.challengeType==='save-10000-2027'||name==='Desafio R$ 10.000 — 2027'||name==='Desafio R$ 10.000',institutionId=institutionIds.has(x.institutionId)?x.institutionId:'inter-default';clean.jars.push({id:x.id,name:legacyChallenge?'Meta de R$ 10.000 — 2027':name,target:x.target,dueDate:x.dueDate,institutionId,archived:!!x.archived,paused:!!x.paused})}
 for(const x of src.recurring||[]){const kind=x?.kind==='income'?'income':'expense',source=x?.source==='salary'?'salary':'complement';if(!x||!goodId(x.id)||(kind==='expense'&&!CATS.includes(x.category))||!Number.isSafeInteger(x.amount)||x.amount<=0||x.amount>10000000000||!Number.isInteger(x.day)||x.day<1||x.day>31||!/^\d{4}-\d{2}$/.test(x.startMonth||'')||!validDate(x.startMonth+'-01')||(x.endMonth&&(!/^\d{4}-\d{2}$/.test(x.endMonth)||!validDate(x.endMonth+'-01')||x.endMonth<x.startMonth)))return null;clean.recurring.push({id:x.id,kind,source,category:kind==='expense'?x.category:'Outros',amount:x.amount,day:x.day,note:String(x.note||'').slice(0,140),startMonth:x.startMonth,endMonth:x.endMonth||null,paused:!!x.paused})}
 for(const x of src.tasks||[]){if(!x||!goodId(x.id)||typeof x.title!=='string'||!x.title.trim()||x.title.length>90||!validDate(x.date)||!validTime(x.time||'')||String(x.note||'').length>180)return null;clean.tasks.push({id:x.id,title:x.title.trim(),date:x.date,time:x.time||'',note:String(x.note||'').trim(),color:CALENDAR_TASK_COLORS[x.color]?x.color:'blue',done:!!x.done})}
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
   const remainingCostBasis=status==='sold'?0:(Number.isSafeInteger(x.remainingCostBasis)&&x.remainingCostBasis>=0&&x.remainingCostBasis<=10000000000?x.remainingCostBasis:Math.max(0,x.cost+extraCosts+sum(expenses.map(e=>e.amount))-sum(normalizedRedemptions.map(r=>r.costBasisSold||0))));
   if(remainingCostBasis>10000000000||status==='sold'&&soldDate<x.date)return null;
   const cdiPercent=Number.isFinite(x.cdiPercent)&&x.cdiPercent>0&&x.cdiPercent<=500?Math.round(x.cdiPercent*100)/100:null;
   clean.investments.push({incomeRecordId:typeof x.incomeRecordId==='string'?x.incomeRecordId:null,id:x.id,name:x.name,institution:x.institution,product:x.product,cost:x.cost,balance:x.balance,date:x.date,checked:x.checked,cdiPercent,redemptions:normalizedRedemptions,existing:x.existing===true,goalId:clean.jars.some(j=>j.id===x.goalId)?x.goalId:null,assetType,livestockKind,headCount,initialHeadCount,extraCosts,expenses:expenses.map(e=>({id:String(e.id||uid()),date:e.date,category:e.category,amount:e.amount,note:String(e.note||'').slice(0,140),recordId:typeof e.recordId==='string'?e.recordId:null})),remainingCostBasis,status,soldDate,saleAmount});
 
 }
 const marketBudget=src.prefs?.marketBudget;
 clean.prefs.marketBudget=Number.isSafeInteger(marketBudget)&&marketBudget>0&&marketBudget<=10000000000?marketBudget:null;
 const categoryBudgets={};for(const [category,amount] of Object.entries(src.prefs?.categoryBudgets||{})){if(CATS.includes(category)&&category!=='Mercado'&&Number.isSafeInteger(amount)&&amount>0&&amount<=10000000000)categoryBudgets[category]=amount;else if(category==='Mercado'&&clean.prefs.marketBudget===null&&Number.isSafeInteger(amount)&&amount>0&&amount<=10000000000)clean.prefs.marketBudget=amount}clean.prefs.categoryBudgets=categoryBudgets;
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
function isVaultFormat(format){return format==='reserva-vault-1'||format==='reserva-vault-2'}
function vaultAdditionalData(envelope){return encoder.encode(JSON.stringify([envelope.format,envelope.ownerId||null]))}
async function sealVault(data,key,salt){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const envelope={format:'reserva-vault-2',ownerId:data.ownerId||null,salt,iv:bytesTo64(iv)};
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:vaultAdditionalData(envelope)},key,encoder.encode(JSON.stringify(data)));
  return {...envelope,data:bytesTo64(new Uint8Array(encrypted))};
}
function validateVaultEnvelope(envelope){
  if(!envelope||!isVaultFormat(envelope.format)||typeof envelope.salt!=='string'||typeof envelope.iv!=='string'||typeof envelope.data!=='string')throw Error('Envelope do cofre inválido');
  const allowed=envelope.format==='reserva-vault-2'?['format','ownerId','salt','iv','data']:['format','salt','iv','data'];
  if(envelope.format==='reserva-vault-2'&&envelope.ownerId!==null&&(typeof envelope.ownerId!=='string'||envelope.ownerId.length>120))throw Error('Proprietário do cofre inválido');
  if(from64(envelope.salt).length!==16||from64(envelope.iv).length!==12||from64(envelope.data).length<16||Object.keys(envelope).some(key=>!allowed.includes(key)))throw Error('Estrutura do cofre inválida');
  return envelope;
}
async function openVault(envelope,key){
  validateVaultEnvelope(envelope);
  const algorithm={name:'AES-GCM',iv:from64(envelope.iv)};
  if(envelope.format==='reserva-vault-2')algorithm.additionalData=vaultAdditionalData(envelope);
  const clear=await crypto.subtle.decrypt(algorithm,key,from64(envelope.data));
  const result=verify(JSON.parse(new TextDecoder().decode(clear)));
  if(!result||envelope.format==='reserva-vault-2'&&(result.ownerId||null)!==envelope.ownerId)throw Error('Dados inválidos');
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
function load(){let raw=null;try{raw=localStorage.getItem(STORE);loadedStoreRaw=raw;if(!raw){const fresh=empty();try{fresh.notes=validateCalendarNotes(JSON.parse(localStorage.getItem('reserva.calendarNotes')||'[]'))||[]}catch{}return fresh}const parsed=JSON.parse(raw);if(parsed&&parsed.notes===undefined&&!isVaultFormat(parsed.format)){try{parsed.notes=validateCalendarNotes(JSON.parse(localStorage.getItem('reserva.calendarNotes')||'[]'))||[]}catch{}}if(isVaultFormat(parsed?.format)){vault=parsed;return empty()}const clean=verify(parsed);if(clean)return clean;storageRecoveryRaw=raw}catch(e){try{raw=localStorage.getItem(STORE)}catch(ignore){}}if(raw){diagnostics.record('storage.recovery');storageRecoveryRaw=raw;try{recoveryArchived=false;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(`${STORE}-corrompido-`)&&localStorage.getItem(key)===raw){recoveryArchived=true;break}}if(!recoveryArchived){localStorage.setItem(`${STORE}-corrompido-${Date.now()}`,raw);recoveryArchived=true}}catch(e){recoveryArchived=false}}return empty()}
let db=load();diagnostics.step('app.initialized', 'home');const todayAtStart=new Date();let state={page:preferredStartPage(),financeView:'overview',analysisView:'insights',registerView:'income',year:todayAtStart.getFullYear(),month:todayAtStart.getMonth(),modal:'',editJarId:null,editRecordId:null,editInstitutionId:null,editAllocationId:null,simGoal:'',simAmount:'200',txFilter:'all',txSearch:'',txTag:'',txSubcategory:'',txCategorySet:null,copyCandidates:[],modalTrigger:null,calendarDate:''};let toastTimer;
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
    if(ACCOUNT&&!diagnosticFixtureStorages.has(localStorage)&&(db.ownerId!==ACCOUNT.id||db.profile?.id!==ACCOUNT.id)){notify('Base não pertence ao perfil ativo. Gravação bloqueada.');return false}
    const candidate=vault?await sealVault(db,vaultKey,vault.salt):db;
    if(integrityContainmentLock&&!(recover&&storageRecoveryRaw&&recoveryArchived))return false;
    if(vault?.format==='reserva-vault-1'&&candidate.format==='reserva-vault-2'){const legacyKey=STORE+'-pre-aad-v1';if(!localStorage.getItem(legacyKey))localStorage.setItem(legacyKey,JSON.stringify(vault));}
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
const MARKET_WEEK_LIMIT=17500;
const MARKET_WEEK_MILESTONES=[25,50,75,100];
function marketWeeklyStatus(today=isoToday()){
  const weekday=new Date(today+'T00:00:00Z').getUTCDay();
  const start=Engines.dateAtOffset(today,-((weekday+6)%7));
  const end=Engines.dateAtOffset(start,6);
  const spent=sum(db.records.filter(record=>record.kind==='expense'&&record.category==='Mercado'&&record.date>=start&&record.date<=today).map(record=>record.amount));
  return {start,end,spent,milestones:MARKET_WEEK_MILESTONES.filter(level=>spent*100>=MARKET_WEEK_LIMIT*level)};
}
function expenseHistoryCard(){
  const today=isoToday();
  const currentMonth=today.slice(0,7);
  const months=[currentMonth];
  let start=currentMonth+'-01';
  for(let index=0;index<2;index++){
    const month=Engines.dateAtOffset(start,-1).slice(0,7);
    months.unshift(month);
    start=month+'-01';
  }
  const totals=new Map(months.map(month=>[month,new Map()]));
  for(const record of db.records){
    if(record.kind!=='expense'||record.date>today)continue;
    const categories=totals.get(record.date.slice(0,7));
    if(categories)categories.set(record.category,(categories.get(record.category)||0)+record.amount);
  }
  const rows=CATS.map(category=>{
    const values=months.map(month=>totals.get(month).get(category));
    const recorded=values.filter(value=>value!==undefined);
    const average=recorded.length?Math.round(sum(recorded)/recorded.length):undefined;
    const cell=value=>value===undefined?'Sem registro':money(value);
    return `<tr><th scope="row">${esc(category)}</th>${values.map(value=>`<td>${cell(value)}</td>`).join('')}<td>${cell(average)}</td></tr>`;
  }).join('');
  return `<article class="card" id="expenseHistoryCard"><h2>Histórico por categoria</h2>
    <p>Mês atual (parcial) e dois meses anteriores. A média usa os meses com registro em cada categoria.</p>
    <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Categoria</th>
    ${months.map(month=>`<th scope="col">${MONTHS[Number(month.slice(5))-1]} de ${month.slice(0,4)}${month===currentMonth?' (parcial)':''}</th>`).join('')}
    <th scope="col">Média mensal</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}
function marketWeeklyCard(){
  const {start,end,spent,milestones}=marketWeeklyStatus();
  const remaining=MARKET_WEEK_LIMIT-spent;
  return `<article class="card" id="marketWeeklyCard"><h2>Mercado · limite semanal</h2>
    <p>${dateBR(start)} a ${dateBR(end)} · ${money(spent)} de ${money(MARKET_WEEK_LIMIT)}</p>
    <p><strong>${remaining<0?'Acima do limite':'Disponível nesta semana'} · ${money(Math.abs(remaining))}</strong></p>
    <p>Avisos no sino a cada 25% · ${milestones.at(-1)||0}% da faixa atingida</p>
</article>`;
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
    previous = typeof structuredClone==='function'?structuredClone(db):JSON.parse(JSON.stringify(db));
    const oldAlert = groceryAlertLevel();
    const previousIncomeIds=new Set(db.records.filter(r=>r.kind==='income').map(r=>r.id));
    callback();
    const newIncome=db.records.filter(r=>r.kind==='income'&&!previousIncomeIds.has(r.id));
    if (!verify(db)) {
      db = previous;
      diagnostics.record('mutation.invalid', undefined, { module: state.page });
      notify('Não foi possível validar os dados. Nenhuma alteração foi salva. Confira valores, datas e saldo do cofrinho.');
      return false;
    }
    if (!await save()) {
      db = previous;
      return false;
    }
    committed = true;
    render();
    if(newIncome.length)setTimeout(()=>notify('Recebimento registrado. Confira a reserva de 10% em Metas.'),0);
    const alert = groceryAlertLevel();
    if (db.prefs.budgetSound && alert > oldAlert) playBudgetSound(alert === 2);
    return true;
  } catch (error) {
    if (!committed && previous) db = previous;
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
async function updateIpca(force=false){if(ipcaState.loading)return;if(location.protocol==='file:'){if(force)notify('A atualização do IPCA requer a versão publicada; o histórico salvo continua disponível.');return;}const checked=Date.parse(ipcaState.lastCheck||0);if(!force&&ipcaState.rates.length>=12&&Date.now()-checked<24*60*60*1000)return;ipcaState.loading=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);const rows=await response.json();if(!Array.isArray(rows)||!rows.length)throw new Error('IPCA indisponível');ipcaState.rates=rows.map(r=>({date:parseSgsDate(r.data),value:Number(String(r.valor).replace(',','.'))})).filter(r=>validDate(r.date)&&Number.isFinite(r.value)).sort((a,b)=>a.date.localeCompare(b.date));ipcaState.lastCheck=new Date().toISOString();localStorage.setItem(IPCA_CACHE,JSON.stringify({rates:ipcaState.rates,lastCheck:ipcaState.lastCheck}));ipcaState.error=''}catch(e){diagnostics.record('market.ipca_failed',e);ipcaState.error='IPCA não atualizou; usando o histórico salvo.'}finally{clearTimeout(timeout);ipcaState.loading=false;refreshMarketViews()}}
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
async function checkBillReminders(){if(!db.prefs.billReminders||!('Notification'in window)||Notification.permission!=='granted')return;const due=upcomingBillInstances(Number(db.prefs.billReminderDays)||0).filter(item=>item.daysUntil>=0&&item.daysUntil<=db.prefs.billReminderDays);if(!due.length)return;const storageKey=userKey('reserva.billReminder.sent'),sent=(()=>{try{return new Set(JSON.parse(localStorage.getItem(storageKey)||'[]'))}catch(e){return new Set()}})();for(const item of due){const key=item.id+'@'+item.date;if(sent.has(key))continue;const when=item.daysUntil===0?'vence hoje':item.daysUntil===1?'vence amanhã':`vence em ${item.daysUntil} dias`,title='Lembrete de conta';const options={body:`${item.note||item.category} · ${money(item.amount)} · ${dateBR(item.date)}`,tag:'bill-'+key,renotify:false,data:{date:item.date,module:'budget'}};try{let registration=null;if('serviceWorker'in navigator){const current=await navigator.serviceWorker.getRegistration();registration=current?.active?current:null}if(registration?.showNotification)await registration.showNotification(title+': '+when,options);else{const notification=new Notification(title+': '+when,options);notification.onclick=()=>{window.focus();state.year=Number(item.date.slice(0,4));state.month=Number(item.date.slice(5,7))-1;state.calendarDate=item.date;go('calendar');notification.close()}}sent.add(key);localStorage.setItem(storageKey,JSON.stringify([...sent].slice(-500)))}catch(e){console.warn('Lembrete não exibido',e)}}}
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
    notes.push({id:note.id,date:note.date,text:note.text,pinned:note.pinned===true,color:Object.hasOwn(CALENDAR_TASK_COLORS,note.color)?note.color:'blue'});
  }
  return notes;
}
function calendarNotes(){return db.notes||[]}
let calendarTab='calendar';
function syncCalendarTabs(){
  const root=$('#homeFullCalendar')||$('#page-calendar');
  root.dataset.calendarTab=calendarTab;
  root.querySelectorAll('[data-calendar-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.calendarTab===calendarTab)));
  root.querySelectorAll('.calendar-organizer-card').forEach(card=>{card.hidden=calendarTab==='calendar'||card.dataset.calendarPanel!==calendarTab});
}
function calendarOrganizer(date,tasks){
  const notes=calendarNotes().filter(note=>note.date===date).sort((a,b)=>Number(b.pinned)-Number(a.pinned));
  return `<article class="card calendar-organizer-card" data-calendar-panel="tasks" hidden><div class="calendar-detail-head"><div><span class="calendar-detail-date">${dateBR(date)}</span><h3>Tarefas</h3></div><span class="tag soft">${tasks.length}</span></div><button class="btn" data-calendar-new-task data-task-kind="task">Nova tarefa</button>${[...tasks].sort((a,b)=>Number(a.done)-Number(b.done)).map(task=>`<div class="calendar-organizer-row"><strong>${esc(task.title)}</strong><small>${task.done?'Concluída':'Pendente'}${task.time?' · '+esc(task.time):''}</small>${task.note?'<p>'+esc(task.note)+'</p>':''}<div class="actions"><button class="btn small" data-task-edit="${esc(task.id)}">Editar ou reagendar</button><button class="btn small" data-task-toggle="${esc(task.id)}">${task.done?'Reabrir':'Concluir'}</button><button class="btn small negative" data-task-delete="${esc(task.id)}">Excluir</button></div></div>`).join('')||'<p>Sem tarefas neste dia.</p>'}</article>
  <article class="card calendar-organizer-card" data-calendar-panel="notes" hidden><div class="calendar-detail-head"><div><span class="calendar-detail-date">${dateBR(date)}</span><h3>Notas</h3></div><button type="button" class="btn small primary" data-calendar-new-note>Nova nota</button></div>${notes.map(note=>`<div class="calendar-organizer-row calendar-note-item" style="border-left:4px solid ${calendarTaskColor(note.color||'blue')};padding-left:10px"><strong>${note.pinned?'Fixada · ':''}${esc(note.text.length>150?note.text.slice(0,150)+'…':note.text)}</strong><div class="actions"><button class="btn small" data-note-action="edit" data-note-id="${esc(note.id)}">Editar ou mover</button><button class="btn small" data-note-action="pin" data-note-id="${esc(note.id)}">${note.pinned?'Desafixar':'Fixar'}</button><button class="btn small negative" data-note-action="delete" data-note-id="${esc(note.id)}">Excluir</button></div></div>`).join('')||'<div class="empty-inline">Sem notas nesta data.</div>'}</article>`;
}
function ensureCalendarNoteEditor(){
 let dialog=$('#calendarNoteDialog');if(dialog)return dialog;
 document.body.insertAdjacentHTML('beforeend', `<dialog id="calendarNoteDialog" class="calendar-note-editor" aria-labelledby="calendarNoteTitle"><div class="card"><h3 id="calendarNoteTitle">Nova nota</h3><form id="calendarNoteForm" class="calendar-task-form"><input name="id" type="hidden"><label class="field">Nota<textarea name="text" maxlength="1000" required></textarea></label><label class="field">Data<input name="date" type="date" value="${state.calendarDate||isoToday()}" required></label><label class="field">Cor da nota<select name="color">${Object.keys(CALENDAR_TASK_COLORS).map(color=>`<option value="${color}">${CALENDAR_TASK_COLOR_LABELS[color]}</option>`).join('')}</select></label><div class="actions"><button type="submit" class="btn primary">Salvar nota</button><button class="btn" type="button" data-close-calendar-note>Cancelar</button></div></form></div></dialog>`);
 dialog=$('#calendarNoteDialog');dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});return dialog;
}
async function saveCalendarNotes(notes){
  if(await mutate(()=>{db.notes=notes})){$('#calendarNoteDialog')?.close();notify('Nota salva.');return true}
  return false;
}
document.addEventListener('submit',event=>{
  if(event.target.id!=='calendarNoteForm')return;
  event.preventDefault();
  const {id,text,date,color}=event.target.elements;
  const body=text.value.trim();
  if(!body||!validDate(date.value))return;
  const notes=calendarNotes(), previous=notes.find(note=>note.id===id.value);
  saveCalendarNotes([...notes.filter(note=>note.id!==id.value),{id:previous?.id||uid(),text:body,date:date.value,color:color.value,pinned:previous?.pinned||false}]);
});
document.addEventListener('click',event=>{
  const tab=event.target.closest('[data-calendar-tab]');
  if(tab){calendarTab=calendarTab===tab.dataset.calendarTab?'calendar':tab.dataset.calendarTab;syncCalendarTabs();}
  if(event.target.closest('[data-close-calendar-note]'))$('#calendarNoteDialog')?.close();
  if(event.target.closest('[data-calendar-new-note]')){
    const dialog=ensureCalendarNoteEditor();
    $('#calendarNoteTitle').textContent='Nova nota';
    $('#calendarNoteForm').reset();
    $('#calendarNoteForm').elements.id.value='';
    $('#calendarNoteForm').elements.date.value=state.calendarDate||isoToday();
    if(!$('#calendarNoteDialog').open)$('#calendarNoteDialog').showModal();
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
    ensureCalendarNoteEditor();
    const {id,text,date}=$('#calendarNoteForm').elements;
    $('#calendarNoteTitle').textContent='Editar nota';
    if(!$('#calendarNoteDialog').open)$('#calendarNoteDialog').showModal();
    id.value=note.id;text.value=note.text;date.value=note.date;$('#calendarNoteForm').elements.color.value=note.color||'blue';text.focus();
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
