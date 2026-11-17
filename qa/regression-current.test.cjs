const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = resolve(__dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const originalApp = read('app.js');
const hook = `Object.assign(window, { qa: {
  forceDiagnosticRender:()=>{diagnosticRunning=true;try{render()}finally{diagnosticRunning=false}},duplicateDomIds,runAdditionalLocalTests,withDiagnosticSandbox,sealVault,openVault,validateVaultEnvelope,deriveVaultKey,bytesTo64,bankCsvMoney,bankCsvDate,htmlReportToModel,downloadPdfReport,importBankCsv,go, render, verify, empty, isoToday, toCents, mutate, applyRecurring, pendingRecurring, upcomingBillInstances,
  calendarEventsForMonth, desktopNotificationItems, openDesktopNotification,
  integrityInterface, integrityBank, compareVersions, searchReserva,
  submitEntry, submitCalendarTask, validTime, importFile, integrityScan, integrityAssets, APP_VERSION, STORE, getDb:()=>db, getState:()=>state
}});\n`;
const appSource = originalApp
  .replace(/\}\)\(\);\s*$/, hook + '})();')
  .replace('[6000,8000,12000,15000][index]', '1')
  .replace('14500*percent/100', '0');
assert.notEqual(originalApp, appSource);
const pages = ['home', 'transactions', 'budget', 'calendar', 'goals', 'investments', 'analysis', 'reports', 'settings'];

function boot(testContext, { width = 1440, coarse = false, seed, query = '', noAccount = false, guest = false } = {}) {
  const errors = [], downloads = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => {
    if (error.type !== 'css parsing') errors.push(error);
  });
  const dom = new JSDOM(read('index.html'), {
    url: 'https://reserva.test/' + query,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: console,
    beforeParse(window) {
      const { HTMLElement, HTMLDialogElement } = window;
      Object.defineProperty(window, 'crypto', { value: webcrypto });
      Object.assign(window, {
        TextEncoder, TextDecoder, structuredClone, Response, AbortController, Blob,
        confirm: () => true,
        scrollTo() {},
        innerWidth: width,
        matchMedia(query) {
          function matches() { return query.split(',').some(clause => {
            const max = /max-width:\s*(\d+)px/.exec(clause);
            const min = /min-width:\s*(\d+)px/.exec(clause);
            return (!max || window.innerWidth <= Number(max[1])) &&
              (!min || window.innerWidth >= Number(min[1])) &&
              (!clause.includes('coarse') || coarse);
          }); }
          return { get matches() { return matches(); }, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
        },
        CSS: {escape: value => String(value).replace(/[^a-z0-9_-]/gi, '\\$&')},
        fetch: async input => {
          if (String(input).includes('version.json')) return new Response(read('version.json'));
          throw new Error('Rede indisponível na fixture');
        }
      });
      window.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:https://reserva.test/qa'; };
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function () {};
      HTMLElement.prototype.scrollIntoView = function () {};
      HTMLDialogElement.prototype.show = HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      HTMLDialogElement.prototype.close = function () {
        this.open = false;
        this.dispatchEvent(new window.Event('close'));
      };
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      window.requestAnimationFrame = callback => window.setTimeout(() => callback(window.performance.now()), 0);
      window.cancelAnimationFrame = id => window.clearTimeout(id);
      if (guest) window.localStorage.setItem('reserva.guest.enabled.v1','true');
      if (noAccount) {
        if (seed) window.localStorage.setItem('reserva-simples-v2',JSON.stringify(seed));
      } else {
      const id='00000000-0000-4000-8000-000000000001';
      const profile={id,name:'Usuário de teste',phone:'',email:'',avatar:0,photo:''};
      window.localStorage.setItem('reserva.accounts.index.v1',JSON.stringify([{id,label:'Usuário 1'}]));
      window.localStorage.setItem('reserva.accounts.active.v1',id);
      window.localStorage.setItem('reserva-simples-account-'+id,JSON.stringify({
        ...(seed||{version:4,records:[],jars:[],allocations:[],recurring:[],investments:[],tasks:[],prefs:{}}),ownerId:id,profile
      }));
      }
    }
  });
  const { window } = dom;
  testContext.after(async () => {
    await new Promise(resolve => setImmediate(resolve));
    window.close();
    assert.deepEqual(errors.map(error => error.message), []);
  });
  window.eval(read('engines.js'));
  window.eval(read('accounts.js'));
  window.eval(read('diagnostics.js'));
  window.eval(appSource);
  const { document, qa } = window;
  const get = selector => {
    const element = document.querySelector(selector);
    assert.ok(element, selector);
    return element;
  };
  return { window, document, qa, get, downloads };
}

function expense(id, date, amount, note = '') {
  return { id, date, amount, note, kind: 'expense', category: 'Mercado' };
}

function stored(version = 4) {
  return { version, records: [], jars: [], allocations: [], recurring: [], investments: [], tasks: [], prefs: {} };
}


test('regressão: abre o app e quatro formulários laterais e detalhes do dia',async t=>{
const {qa,document,get,window}=boot(t);
assert.ok(document.querySelector('#homeFullCalendar'));
qa.go('register');
for(const view of ['income','expense','investment','commitment']){
 get('[data-register-view="'+view+'"]').click();
 assert.ok(document.querySelector('#registerSecondaryForm form'));
 assert.equal(document.querySelectorAll('#registerSecondaryForm').length,1);
}
get('[data-register-view="income"]').click();
const entry=get('[data-register-entry="income"]');entry.elements.amount.value='123.45';entry.elements.date.value=qa.isoToday();entry.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
await new Promise(resolve=>window.setTimeout(resolve,80));assert.ok(qa.getDb().records.some(r=>r.amount===12345));
qa.go('home');get('#homeFullCalendar [data-calendar-date]').click();
assert.ok(get('#calendarDayDialog').open);
assert.ok(get('#selectedDateContent').textContent.length);
assert.equal(document.querySelectorAll('[data-date-action]').length,0);
get('[data-close-calendar-day]').click();
get('#homeFullCalendar [data-calendar-new-note]').click();
assert.ok(get('#calendarNoteDialog').open);
const note=get('#calendarNoteForm');note.elements.text.value='Nota com cor';note.elements.color.value='purple';note.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
await new Promise(resolve=>window.setTimeout(resolve,80));assert.ok(qa.getDb().notes.some(n=>n.text==='Nota com cor'&&n.color==='purple'));assert.equal(get('#calendarNoteDialog').open,false);assert.ok(document.querySelector('#homeFullCalendar .calendar-note-color'));
});

test('formulários laterais salvam recorrências, meta e vencimento sem conflitar com modais',async t=>{
 const {qa,get,window,document}=boot(t);qa.go('register');
 const submit=async form=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>window.setTimeout(resolve,90))};
 for(const view of ['income','expense']){get('[data-register-view="'+view+'"]').click();get('#registerInline-amount').value='75';get('#registerInline-note').value='Recorrente '+view;await submit(get('#registerSecondaryEntryForm'));assert.ok(qa.getDb().recurring.some(r=>r.note==='Recorrente '+view&&r.kind===view));}
 get('[data-register-view="investment"]').click();get('#registerInline-jarName').value='Meta integrada';get('#registerInline-jarTarget').value='1000';get('#registerInline-jarDue').value='2027-12-31';await submit(get('#registerSecondaryEntryForm'));assert.ok(qa.getDb().jars.some(j=>j.name==='Meta integrada'));
 get('[data-register-view="commitment"]').click();get('#registerInline-note').value='Conta integrada';get('#registerInline-amount').value='42';get('#registerInline-dueEntryDate').value=qa.isoToday();await submit(get('#registerSecondaryEntryForm'));assert.ok(qa.getDb().recurring.some(r=>r.note==='Conta integrada'));
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);assert.equal(ids.length,new Set(ids).size);
 qa.go('settings');get('[data-settings-tab="system"]').click();qa.render();assert.equal(get('[data-settings-panel="system"]').hidden,false);
});

test('auditoria: sinal monetário, datas explícitas, teto e PDF completo',async t=>{
 const {qa,get,window,downloads}=boot(t);
 for(const value of ['R$ -150,00','BRL -150,00','(150,00)','150,00-','150,00 D'])assert.equal(qa.bankCsvMoney(value),-15000,value);
 assert.equal(qa.bankCsvDate('03/25/2026','mdy'),'2026-03-25');assert.equal(qa.bankCsvDate('03/04/2026','mdy'),'2026-03-04');assert.equal(qa.bankCsvDate('03/04/2026','dmy'),'2026-04-03');assert.equal(qa.bankCsvDate('02/30/2026','mdy'),null);
 const excessive=qa.verify({...qa.empty(),prefs:{categoryBudgets:{Mercado:999999999999}}});assert.notEqual(excessive?.prefs.marketBudget,999999999999);
 const fixture='<html><h1>Teste</h1><section><h2>Seção</h2><p>Explicação</p><table><tr><th>Primeira</th></tr><tr><td>Um</td></tr></table><table><tr><th>Segunda</th></tr><tr><td>Dois</td></tr></table></section></html>';
 const model=qa.htmlReportToModel(fixture);assert.equal(model.sections.length,3);assert.ok(model.sections.some(s=>s.rows.some(r=>r[0]==='Explicação')));
 qa.downloadPdfReport('Longo','<section><h2>Teste longo</h2><table><tr><th>Descrição</th></tr><tr><td>'+('Conteúdo longo '.repeat(5000))+'</td></tr></table></section>');const pdf=await downloads.at(-1).text();assert.ok((pdf.match(/\/Type \/Page /g)||[]).length>2);assert.ok(pdf.includes('%%EOF'));
 await qa.importBankCsv({name:'us.csv',size:100,text:async()=> 'Date;Description;Amount\n03/25/2026;Compra;R$ -150,00'});get('#csvDateOrderForm select').value='mdy';get('#csvDateOrderForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>window.setTimeout(resolve,50));assert.match(get('#bankCsvImportForm').textContent,/25\/03\/2026/);assert.match(get('#bankCsvImportForm').textContent,/Saída/);
});

test('cofre AAD lê v1, grava v2 e rejeita alteração de proprietário, versão e conteúdo',async t=>{
 const {qa,window}=boot(t),salt=new Uint8Array(16),key=await qa.deriveVaultKey('senha longa teste cofre',salt),data=qa.empty();
 const iv=webcrypto.getRandomValues(new Uint8Array(12)),encrypted=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));
 const legacy={format:'reserva-vault-1',salt:qa.bytesTo64(salt),iv:qa.bytesTo64(iv),data:qa.bytesTo64(new Uint8Array(encrypted))};
 assert.ok(await qa.openVault(legacy,key));const next=await qa.sealVault(data,key,legacy.salt);assert.equal(next.format,'reserva-vault-2');assert.ok(await qa.openVault(next,key));
 await assert.rejects(()=>qa.openVault({...next,ownerId:'outro-perfil'},key));await assert.rejects(()=>qa.openVault({...next,format:'reserva-vault-1'},key));
 const altered={...next,data:next.data.slice(0,3)+(next.data[3]==='A'?'B':'A')+next.data.slice(4)};await assert.rejects(()=>qa.openVault(altered,key));
 const wrong=await qa.deriveVaultKey('senha completamente diferente',salt);await assert.rejects(()=>qa.openVault(next,wrong));
 const before=window.localStorage.getItem(qa.STORE);await qa.importFile({size:300,text:async()=>JSON.stringify(next)});assert.equal(window.localStorage.getItem(qa.STORE),before);assert.ok(window.document.querySelector('#vaultDialog').open);
});
test('renderização atualiza a tela ativa, preserva rascunho lateral e reconcilia ao navegar',async t=>{
 const {qa,get,window}=boot(t);qa.go('register');
 const inactive=get('#page-reports'),before=inactive.firstElementChild;
 const input=get('[data-register-entry] input[name=note]');input.value='Rascunho preservado';input.focus();input.setSelectionRange(4,4);qa.render();assert.equal(get('[data-register-entry] input[name=note]').value,'Rascunho preservado');assert.equal(window.document.activeElement.selectionStart,4);assert.equal(inactive.firstElementChild,before);
 const form=get('[data-register-entry]');form.elements.amount.value='99.50';form.elements.date.value=qa.isoToday();form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>window.setTimeout(resolve,90));qa.go('reports');assert.notEqual(inactive.firstElementChild,before);assert.match(inactive.textContent,/99,50/);
});

test('abas incorporadas movem o conteúdo sem duplicar IDs e mantêm o mês correto',t=>{
 const {qa,get,document}=boot(t);
 const unique=()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);assert.equal(ids.length,new Set(ids).size,ids.filter((id,i)=>ids.indexOf(id)!==i).join(','))};
 qa.go('budget');for(const view of ['transactions','investments','goals']){get('#page-budget .finance-section-nav [data-page="'+view+'"]').click();unique();assert.ok(get('#financeEmbeddedView').children.length)}
 qa.go('analysis');get('[data-analysis-view="reports"]').click();unique();assert.ok(get('#page-analysis #monthlyCloseChecklist'));
 qa.go('reports');unique();assert.ok(get('#page-reports #monthlyCloseChecklist'));qa.go('analysis');get('[data-analysis-view="insights"]').click();unique();
});

test('primeira gravação migra cofre v1 sem perder a cópia cifrada anterior',async t=>{
 const {qa}=boot(t),salt=new Uint8Array(16),key=await qa.deriveVaultKey('senha legada válida de teste',salt),db=qa.empty(),iv=webcrypto.getRandomValues(new Uint8Array(12));
 const encrypted=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(db))),legacy={format:'reserva-vault-1',salt:qa.bytesTo64(salt),iv:qa.bytesTo64(iv),data:qa.bytesTo64(new Uint8Array(encrypted))},original=JSON.stringify(legacy);
 await qa.withDiagnosticSandbox({db,vault:legacy,vaultKey:key,storage:{[qa.STORE]:original}},async({localStorage})=>{
   assert.equal(await qa.mutate(()=>qa.getDb().records.push({id:'migra-teste',kind:'income',amount:1234,date:qa.isoToday(),source:'salary',category:'Outros',note:''})),true);
   assert.equal(localStorage.getItem(qa.STORE+'-pre-aad-v1'),original);
   const migrated=JSON.parse(localStorage.getItem(qa.STORE));assert.equal(migrated.format,'reserva-vault-2');assert.equal((await qa.openVault(migrated,key)).records[0].amount,1234);
 });
});

test('diagnóstico não duplica IDs após alternar abas e abrir editores',async t=>{
 const {qa,get,document}=boot(t,{guest:true,noAccount:true});await new Promise(resolve=>setImmediate(resolve));
 for(const view of ['income','expense','investment','commitment']){
 qa.go('register');get('[data-register-view="'+view+'"]').click();qa.go('settings');get('[data-settings-tab=system]').click();
 const results=await qa.runAdditionalLocalTests({modules:[],checks:[],testSuiteSummary:{},syntheticChecks:[]});const check=results.find(item=>item.id===88);assert.equal(check.status,'ok',JSON.stringify(check));assert.equal(qa.duplicateDomIds().length,0);
 }
});

test('Central não duplica o relatório oculto após a aba Relatórios de Análises',t=>{
 const {qa,get,document}=boot(t);qa.go('analysis');get('[data-analysis-view=reports]').click();qa.go('settings');qa.forceDiagnosticRender();assert.equal(qa.duplicateDomIds().length,0);assert.equal(document.querySelectorAll('#monthlyCloseChecklist').length,1);assert.ok(get('#page-reports #monthlyCloseChecklist'));
});
