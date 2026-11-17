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
  submitEntry, submitCalendarTask, validTime, importFile, integrityScan, integrityAssets, APP_VERSION, STORE, getDb:()=>db, getState:()=>state
}});\n`;
const appSource = originalApp
  .replace(/\}\)\(\);\s*$/, hook + '})();')
  .replace('[6000,8000,12000,15000][index]', '1')
  .replace('14500*percent/100', '0');
assert.notEqual(originalApp, appSource);
const pages = ['home', 'register', 'transactions', 'budget', 'goals', 'investments', 'analysis', 'reports', 'settings'];

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


test('central em modo visitante preserva DOM sem IDs duplicados', {timeout:90000},async t=>{
 const {qa,downloads,document}=boot(t,{guest:true,noAccount:true});await new Promise(resolve=>setImmediate(resolve));qa.go('analysis');document.querySelector('[data-analysis-view=reports]').click();qa.go('settings');document.querySelector('[data-settings-tab=system]').click();await qa.integrityScan();const report=JSON.parse(await downloads.at(-1).text());const duplicateCheck=report.scan.additionalTestPlan.find(x=>x.id===88);t.diagnostic(JSON.stringify(duplicateCheck));const counts=new Map();for(const node of document.querySelectorAll('[id]'))counts.set(node.id,(counts.get(node.id)||0)+1);t.diagnostic(JSON.stringify([...counts].filter(([id,n])=>n>1)));assert.equal(duplicateCheck.status,'ok');
});
