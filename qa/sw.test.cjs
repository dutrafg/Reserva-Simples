const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const root = resolve(__dirname, '..');
const read = file => readFileSync(resolve(root, file));
const base = 'https://reserva.test/reserva/';
const cacheName = 'reserva-simples-v' + JSON.parse(read('version.json')).version + '-pwa';

function worker({ corrupt, missing } = {}) {
  const listeners = new Map();
  const clients = [];
  const previous = 'reserva-simples-v0.39.43-rc1';
  const caches = new Map([[previous, new Map()]]);
  let online = true;
  let skipped = false;
  let claimed = false;
  let notificationLink = '';
  async function fetch(request) {
    if (!online) throw new TypeError('offline');
    const path = new URL(request.url || request).pathname.slice(new URL(base).pathname.length);
    const file = path || 'index.html';
    if (file === missing) return new Response(null, {status:404});
    if (file === corrupt) return new Response('arquivo de outra versão');
    return new Response(read(file));
  }
  async function open(name) {
    if (!caches.has(name)) caches.set(name,new Map());
    const store = caches.get(name);
    return {
      match: async request => store.get(new URL(request.url || request,base).href)?.clone(),
      add: async request => {
        const response = await fetch(request);
        if (!response.ok) throw new Error('Arquivo ausente');
        store.set(request.url,response);
      },
      async addAll(requests) {
        for (const request of requests) await this.add(request);
      }
    };
  }
  runInNewContext(read('sw.js').toString(), {
    self: {
      registration: {scope:base},
      location: new URL(base),
      addEventListener: (name, listener) => listeners.set(name,listener),
      skipWaiting: () => { skipped = true; },
      clients: {
        claim: () => { claimed = true; },
        matchAll: () => Promise.resolve(clients),
        openWindow: url => { notificationLink = url; }
      }
    },
    caches: {
      open,
      keys: () => Promise.resolve([...caches.keys()]),
      delete: name => Promise.resolve(caches.delete(name))
    },
    fetch, URL, Request, Response, crypto:webcrypto
  });
  return {
    send(name, detail = {}) {
      let operation;
      const assign = value => { operation = value; };
      listeners.get(name)({waitUntil:assign, respondWith:assign, ...detail});
      return operation;
    },
    setOffline() { online = false; },
    ready: () => caches.has(cacheName) && skipped && claimed,
    cacheNames: () => [...caches.keys()],
    previous, clients, notificationLink: () => notificationLink
  };
}

test('instala oito arquivos verificados e abre o aplicativo e os assets offline', async () => {
  const sw = worker();
  await sw.send('install');
  await sw.send('activate');
  assert.equal(sw.ready(),true);
  assert.ok(sw.cacheNames().includes(sw.previous));
  sw.setOffline();
  const shell = await sw.send('fetch',{request:{method:'GET',mode:'navigate',url:base}});
  assert.equal(await shell.text(),read('index.html').toString());
  const script = await sw.send('fetch',{request:new Request(base+'app.js')});
  assert.equal(await script.text(),read('app.js').toString());
  assert.equal(sw.send('fetch',{request:new Request(base+'app.js',{cache:'no-store'})}),undefined);
  assert.equal(sw.send('fetch',{request:new Request(base+'version.json?check=1',{cache:'no-store'})}),undefined);
});

test('uma publicação inconsistente falha antes da ativação e deixa o cache anterior disponível', async () => {
  for (const [files, message] of [[{corrupt:'app.js'}, /mesma versão/], [{missing:'engines.js'}, /ausente/]]) {
    const sw = worker(files);
    await assert.rejects(sw.send('install'),message);
    assert.deepEqual(sw.cacheNames(), [sw.previous]);
  }
});

test('clicar em vencimento abre Orçamento na data e preserva o destino de notificações antigas', async () => {
  const sw = worker();
  let closed = false;
  sw.clients.push({url:'https://reserva.test/outro-app',navigate:()=>assert.fail('Outra aplicação recebeu o lembrete')});
  const notification = {data:{date:'2028-02-29',module:'budget'},close:()=>{closed = true;}};
  await sw.send('notificationclick',{notification});
  assert.equal(sw.notificationLink(),base+'?budgetDate=2028-02-29');
  assert.equal(closed,true);
  notification.data = {date:'2027-04-15'};
  await sw.send('notificationclick',{notification});
  assert.equal(sw.notificationLink(),base+'?calendarDate=2027-04-15');
});
