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
  go, render, verify, empty, isoToday, toCents, mutate, applyRecurring, pendingRecurring, upcomingBillInstances,
  calendarEventsForMonth, desktopNotificationItems, openDesktopNotification,
  integrityInterface, integrityBank, compareVersions, searchReserva,
  submitEntry, importFile, integrityScan, integrityAssets, APP_VERSION, STORE, getDb:()=>db, getState:()=>state
}});\n`;
const appSource = originalApp
  .replace(/\}\)\(\);\s*$/, hook + '})();')
  .replace('[6000,8000,12000,15000][index]', '1')
  .replace('14500*percent/100', '0');
assert.notEqual(originalApp, appSource);
const pages = ['home', 'transactions', 'budget', 'calendar', 'goals', 'investments', 'analysis', 'reports', 'settings'];

function boot(testContext, { width = 1440, coarse = false, seed, query = '' } = {}) {
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
      const id='00000000-0000-4000-8000-000000000001';
      const profile={id,name:'Usuário de teste',phone:'',email:'',avatar:0,photo:''};
      window.localStorage.setItem('reserva.accounts.index.v1',JSON.stringify([{id,label:'Usuário 1'}]));
      window.localStorage.setItem('reserva.accounts.active.v1',id);
      window.localStorage.setItem('reserva-simples-account-'+id,JSON.stringify({
        ...(seed||{version:4,records:[],jars:[],allocations:[],recurring:[],investments:[],tasks:[],prefs:{}}),ownerId:id,profile
      }));
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

test('abre os nove módulos e mantém somente uma tela ativa, sem IDs duplicados', t => {
  const { qa, document, get } = boot(t);
  for (const page of pages) {
    get('#desktopNav [data-page="' + page + '"]').click();
    assert.equal(qa.getState().page, page);
    assert.equal(document.querySelectorAll('.page.active').length, 1);
    assert.equal(get('.page.active').id, 'page-' + page);
    assert.ok(get('.page.active').children.length);
  }
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(ids.length, new Set(ids).size, ids.filter((id, index) => ids.indexOf(id) !== index).join(', '));
  assert.equal(qa.integrityInterface().filter(item => item.status === 'aprovada').length, 9);
  get('#desktopNav [data-page="budget"]').remove();
  assert.equal(qa.integrityInterface().find(item => item.check === 'interface.budget').status, 'alerta');
});

test('Orçamento no celular e menu Mais com atalhos de tablet', t => {
  const { window, qa, get } = boot(t, { width: 390, coarse: true });
  assert.equal(get('#mobileNav').children.length, 5);
  assert.equal(get('#desktopNotificationWrap').parentElement.className, 'header');
  get('#mobileNav [data-page="budget"]').click();
  assert.equal(qa.getState().page, 'budget');
  get('#mobileMoreButton').click();
  assert.equal(get('#mobileMoreDialog').open, true);
  assert.deepEqual([...get('.mobile-more-grid').children].map(el => el.dataset.page),
    ['calendar', 'goals', 'investments', 'analysis', 'reports', 'settings']);
  get('#mobileMoreDialog [data-page="reports"]').click();
  assert.equal(qa.getState().page, 'reports');
  assert.equal(get('#mobileMoreDialog').open, false);
  for (const [width, parent] of [[768,'header'], [1280,'header'], [1440,'sidebar-control']]) {
    window.innerWidth = width;
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(get('#desktopNotificationWrap').parentElement.className, parent);
  }
});

test('registra cartão e vencimento em Orçamento e reconcilia Calendário, busca e Lançamentos', async t => {
  const { qa, window, get } = boot(t);
  const day = qa.isoToday();
  qa.go('budget');
  get('[data-home-finance-entry="card"]').click();
  assert.equal(get('#category').value, 'Cartões');
  Object.assign(get('#amount'), { value: '28.75' });
  get('#date').value = day;
  get('#note').value = 'Fatura sintética';
  await qa.submitEntry({preventDefault() {}});
  assert.ok(get('#page-budget .home-card-records').textContent.includes('Fatura sintética'));
  get('[data-home-finance-entry="due"]').click();
  get('#amount').value = '42';
  get('#dueEntryDate').value = day;
  get('#note').value = 'Conta sintética';
  get('#dueEntryMonthly').checked = false;
  await qa.submitEntry({preventDefault() {}});
  assert.equal(qa.pendingRecurring().length, 1);
  assert.ok(qa.upcomingBillInstances(7).some(item => item.note === 'Conta sintética'));
  assert.ok(qa.searchReserva('fatura sintetica').some(item => item.title.includes('Fatura')));
  const events = () => qa.calendarEventsForMonth(qa.getState().year, qa.getState().month).get(day);
  assert.ok(events().some(item => item.kind === 'scheduled-expense'));
  await qa.applyRecurring();
  await qa.applyRecurring();
  assert.equal(qa.pendingRecurring().length, 0);
  assert.equal(qa.getDb().records.length, 2);
  assert.equal(events().filter(item => item.kind === 'scheduled-expense').length, 0);
  const monthData = window.ReservaEngines.monthData(qa.getDb(), qa.getState().year, qa.getState().month);
  assert.equal(monthData.expenses, 7075);
  qa.go('transactions');
  assert.match(get('#transactionList').textContent, /Conta sintética/);
  qa.go('reports');
  assert.match(get('#page-reports').textContent, /70,75/);
});

test('protege um banco antigo e uma edição de outra aba acima de uma mutação desatualizada', async t => {
  const seed = { ...stored(2), records: [expense('qa-start', '2027-01-01', 100)] };
  const { qa, window } = boot(t, { seed });
  assert.equal(qa.getDb().version, 4);
  assert.equal(qa.getDb().records.length, 1);
  assert.ok(await qa.mutate(() => qa.getDb().records.push(expense('qa-saved','2027-01-02',200))));
  const foreign = JSON.parse(window.localStorage.getItem(qa.STORE));
  foreign.records.push(expense('qa-foreign', '2027-01-03', 300));
  const raw = JSON.stringify(foreign);
  window.localStorage.setItem(qa.STORE, raw);
  assert.equal(await qa.integrityBank(), 'pendente');
  assert.equal(await qa.mutate(() => qa.getDb().records.pop()), false);
  assert.equal(qa.getDb().records.length, 2);
  assert.equal(window.localStorage.getItem(qa.STORE), raw);
  assert.ok(Number.isNaN(qa.toCents('0.001')));
  assert.equal(qa.toCents('0.01'), 1);
});

test('sino liga o fechamento mensal à data correta e o vencimento ao Orçamento', t => {
  const { qa, get } = boot(t, { query: '?budgetDate=2028-02-29' });
  assert.equal(qa.getState().page, 'budget');
  assert.equal(qa.getState().month, 1);
  const closeItems = date => qa.desktopNotificationItems(date).filter(item => item.kind === 'reports');
  assert.equal(closeItems('2028-02-28').length, 0);
  assert.equal(closeItems('2028-02-29')[0].date, '2028-02-29');
  assert.equal(closeItems('2028-03-01')[0].date, '2028-02-29');
  qa.openDesktopNotification(closeItems('2027-01-01')[0]);
  assert.equal(qa.getState().page, 'reports');
  assert.equal(get('#monthlyCloseChecklist').dataset.month, '2026-12');
});

test('atualizador ordena as versões 0.x, beta e 1.0 estável', async t => {
  const { qa } = boot(t);
  assert.equal(qa.APP_VERSION, JSON.parse(read('version.json')).version);
  assert.ok(qa.compareVersions('1.0.0-beta.1', '0.39.43') > 0);
  assert.ok(qa.compareVersions('1.0.0-beta.2', '1.0.0-beta.1') > 0);
  assert.ok(qa.compareVersions('1.0.0-beta.10', '1.0.0-beta.2') > 0);
  assert.ok(qa.compareVersions('1.0.0', '1.0.0-beta.1') > 0);
  assert.equal(qa.compareVersions('1.0.0-beta.1', '1.0.0-beta.1'), 0);
  assert.throws(() => qa.compareVersions('inválida','1.0.0'), /Versão/);
});

test('limite por categoria avisa e abre o controle em Orçamento', t => {
  const date = new Date().toLocaleDateString('sv-SE');
  const seed = { ...stored(), prefs:{categoryBudgets:{Luz:10_000}}, records:[
    {...expense('qa-limit',date,8500),category:'Luz'}
  ] };
  const { qa, document } = boot(t, {seed});
  const notice = qa.desktopNotificationItems(date).find(item => item.kind === 'budget-limit');
  assert.equal(notice.category, 'Luz');
  qa.openDesktopNotification(notice);
  assert.equal(qa.getState().page, 'budget');
  assert.equal(document.activeElement.id, 'categoryBudgetCard');
});

test('descarta um lembrete ignorado sem apagar o recebimento', t => {
  const date = new Date().toLocaleDateString('sv-SE');
  const seed = { ...stored(), records:[{id:'qa-income', kind:'income', amount:100_000, source:'salary', date}] };
  const { qa, get, window, document } = boot(t, {seed});
  const raw = window.localStorage.getItem(qa.STORE);
  qa.go('goals');
  get('[data-ignore-reserve-income="qa-income"]').click();
  get('.reserve-ignored').open = true;
  get('[data-discard-reserve-income="qa-income"]').click();
  assert.equal(document.querySelector('[data-discard-reserve-income="qa-income"]'), null);
  assert.equal(document.querySelector('[data-ignore-reserve-income="qa-income"]'), null);
  assert.equal(qa.desktopNotificationItems(date).some(item => item.kind === 'reserve'), false);
  assert.equal(window.localStorage.getItem(qa.STORE), raw);
});

test('Central verifica os arquivos e só repara conteúdo da mesma versão', async t => {
  const { qa, window } = boot(t);
  const manifest = JSON.parse(read('integrity-manifest.json'));
  const name = qa.APP_VERSION+'-pwa';
  const files = new Map(Object.keys(manifest.assets).map(path => [path.slice(2), read(path)]));
  files.set('integrity-manifest.json', JSON.stringify(manifest));
  const cache = new Map(files);
  cache.set('app.js','versão incompleta no cache');
  const filename = url => new URL(url).pathname.slice(1);
  Object.defineProperties(window.navigator, {
    serviceWorker:{value:{controller:{}}},
    onLine:{value:true}
  });
  window.caches = {
    has: async key => key === 'reserva-simples-v'+name,
    open: async () => ({
      match: async url => cache.has(filename(url))?new Response(cache.get(filename(url))):undefined,
      put: async (url,response) => cache.set(filename(url),await response.text())
    })
  };
  const trace = await qa.integrityAssets();
  assert.equal(trace.length, 8);
  assert.equal(trace.find(item => item.check === './app.js').status, 'alerta');
  window.fetch = async url => new Response(filename(url)==='app.js'?'arquivo de outra versão':files.get(filename(url)));
  const rejected = await qa.integrityAssets(true);
  assert.equal(rejected.find(item => item.check === './app.js').status, 'alerta');
  assert.equal(cache.get('app.js'),'versão incompleta no cache');
  window.fetch = async url => new Response(files.get(filename(url)));
  cache.delete('integrity-manifest.json');
  const restored = await qa.integrityAssets(true);
  assert.equal(restored.filter(item => item.status === 'corrigida').length, 2);
  assert.equal((await qa.integrityAssets()).filter(item => item.status === 'aprovada').length, 8);
});

test('Central gera o relatório das quatro etapas e preserva a base ativa', { timeout: 60_000 }, async t => {
  const seed = { ...stored(), records:[expense('qa-data','2027-01-01',1234,'Registro da fixture')] };
  const { qa, window, downloads } = boot(t, {seed});
  const raw = window.localStorage.getItem(qa.STORE);
  await new Promise(resolve => setImmediate(resolve));
  await qa.integrityScan();
  assert.equal(window.localStorage.getItem(qa.STORE),raw);
  assert.equal(downloads.length,1);
  const json = await downloads[0].text();
  const report = JSON.parse(json);
  const central = report.centralDeIntegridade;
  assert.equal(central.failure,undefined);
  assert.equal(central.stageTimings.length,4);
  assert.deepEqual(report.scan.modules.map(module => module.module),pages);
  const checks = central.stages.flat();
  const integrated = checks.find(item => item.check === 'diagnostico.integrado');
  t.diagnostic(JSON.stringify(report.scan.testSuiteSummary.locCoverage));
  t.diagnostic(integrated.reason);
  for (const check of [...report.scan.checks, ...report.scan.modules.flatMap(module => module.checks)]) {
    if (check.status === 'alerta') t.diagnostic(check.name + ' · ' + check.reason);
  }
  const locFailures=report.scan.locTests.filter(item=>item.status==='falha'||item.status==='erro');
  if(locFailures.length)t.diagnostic('Falhas LOC: '+JSON.stringify(locFailures.map(item=>({id:item.id,title:item.title,reason:item.reason,evidence:item.evidence}))));
  const suites = report.scan.testSuiteSummary.suites;
  for (const [name,suite] of Object.entries(suites)) {
    assert.equal((suite.statusCounts.falha||0)+(suite.statusCounts.erro||0),0,name);
  }
  assert.equal(integrated.failures,0);
  assert.equal(report.scan.checks.find(item => item.name === 'Matriz responsiva de navegação').status,'não_suportado');
  assert.equal(report.diagnosticContract.coverage.modules.length,9);
  assert.equal(report.diagnosticContract.coverage.releaseFiles.length,7);
  assert.equal(report.diagnosticContract.brokenSignatures.length,0);
  assert.equal(json.includes('Registro da fixture'),false);
});
