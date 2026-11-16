const { test } = require('node:test');
const assert = require('node:assert/strict');
const Engines = require('../engines.js');

test('projeções seguem o fim do mês e respeitam suspensão, encerramento e virada de ano', () => {
  const base = {
    recurring: [
      { id: 'end-of-month', day: 31, startMonth: '2027-12', endMonth: '2028-02' },
      { id: 'salary', kind: 'income', day: 10, startMonth: '2028-01' },
      { id: 'paused', day: 8, startMonth: '2027-12', paused: true }
    ],
    records: [{ recurringId: 'end-of-month', kind: 'expense', date: '2028-01-21' }]
  };
  const actual = Engines.pendingOccurrences(base, '2027-12-29', '2028-03-11');
  assert.deepEqual(actual.map(item => [item.id, item.date]), [
    ['end-of-month','2027-12-31'],
    ['salary','2028-01-10'],
    ['salary','2028-02-10'],
    ['end-of-month','2028-02-29'],
    ['salary','2028-03-10']
  ]);
  assert.deepEqual(Engines.pendingOccurrences(base, '2028-02-01', '2028-02-28', 'expense'), []);
  assert.deepEqual(Engines.monthBounds(2027,1), {first:'2027-02-01',last:'2027-02-28'});
  assert.deepEqual(Engines.monthBounds(2028,1), {first:'2028-02-01',last:'2028-02-29'});
  assert.equal(Engines.dateAtOffset('2027-12-31',1), '2028-01-01');
  assert.deepEqual(Engines.monthBounds(9999,11), {first:'9999-12-01',last:'9999-12-31'});
});

test('uma recorrência lançada em mês diferente usa o período original para deduplicação', () => {
  const fixture = {
    recurring: [{ id:'due', kind:'expense', day:31, startMonth:'2028-01' }],
    records: [
      { recurringId:'due', recurringMonth:'2028-01', kind:'expense', date:'2028-02-01' },
      { recurringId:'due', kind:'income', date:'2028-02-29' }
    ]
  };
  assert.deepEqual(Engines.pendingOccurrences(fixture,'2028-01-01','2028-02-29').map(item => item.date), ['2028-02-29']);
});

test('totais mensais conciliam entradas, despesas, metas e compras e resgates da carteira', () => {
  const base = {
    records:[
      { kind:'income', source:'salary', amount:100_000, date:'2028-02-01' },
      { kind:'expense', category:'Mercado', amount:30_000, date:'2028-02-02' }
    ],
    allocations:[
      { amount:12_000, date:'2028-02-07' },
      { amount:-5_000, netReceived:5_600, date:'2028-02-14' }
    ],
    investments:[
      { cost:15_000, date:'2028-02-03', redemptions:[{ amount:7_000, date:'2028-02-22' }] },
      { cost:60_000, date:'2028-02-01', existing:true }
    ]
  };
  const month = Engines.monthData(base, 2028, 1);
  assert.equal(month.available, 55_600);
  assert.equal(month.minimum, 10_000);
  assert.equal(month.expenses, Engines.categories(base,2028,1).total);
  assert.deepEqual(Engines.investmentCashEvents(base).map(event => event.amount), [-15_000,7_000]);
});

test('os cálculos mantêm centavos exatos em uma base com 50 mil lançamentos', () => {
  const records = Array.from({length:50_000}, (_, index) => ({
    kind:index % 2 === 0 ? 'income' : 'expense',
    category:'Mercado',
    amount:101,
    date:index % 5 === 0 ? '2028-01-31' : '2028-02-29'
  }));
  const fixture = { records };
  const result = Engines.monthData(fixture,2028,1);
  assert.equal(result.expenses, 2_020_000);
  assert.equal(result.available, 0);
  assert.equal(Engines.categories(fixture,2028,1).total, result.expenses);
});
