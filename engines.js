/* Reserva Engines v0.4 — pure local analysis; values are integer centavos.
   No third-party packages, no network, no generative AI, no personal data collection.
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReservaEngines = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  const asPeriod = d => String(d || '').slice(0, 7);
  const period = (y, m) => String(y).padStart(4, '0') + '-' + String(m + 1).padStart(2, '0');
  const addMonths = (y, m, delta) => {
    const dt = new Date(Date.UTC(y, m + delta, 1));
    return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() };
  };
  const nth = (a, n) => a.slice().sort((x, y) => x - y)[n];
  const median = xs => {
    if (!xs.length) return null;
    const n = xs.length; return Math.round(n % 2 ? nth(xs, (n - 1) / 2) : (nth(xs, n / 2 - 1) + nth(xs, n / 2)) / 2);
  };
  const monthData = (db, y, m) => {
    const key = period(y, m);
    const rows = (db.records || []).filter(x => asPeriod(x.date) === key);
    const income = sum(rows.filter(x => x.kind === 'income').map(x => x.amount));
    const expenses = sum(rows.filter(x => x.kind === 'expense').map(x => x.amount));
    const salary = sum(rows.filter(x => x.kind === 'income' && x.source === 'salary').map(x => x.amount));
    const allocations=(db.allocations||[]).filter(x=>asPeriod(x.date)===key);const deposits=sum(allocations.filter(x=>x.amount>0).map(x=>x.amount));const withdrawals=sum(allocations.filter(x=>x.amount<0).map(x=>x.netReceived??-x.amount));const saved=deposits-withdrawals;
    const invested = sum((db.investments || []).filter(x => !x.existing && asPeriod(x.date) === key).map(x => x.cost));
    return { invested, key, year: y, month: m, income, expenses, salary, complement: income - salary,
      deposits, withdrawals, saved, minimum: Math.round(income * 0.1), available: income - expenses - saved - invested,
      recordedIncome: rows.some(x => x.kind === 'income'), recordedExpenses: rows.some(x => x.kind === 'expense') };
  };
  const history = (db, y, m, count = 6) => Array.from({ length: count }, (_, i) => {
    const dt = addMonths(y, m, i - count + 1);
    return monthData(db, dt.year, dt.month);
  });
  function forecast(db, y, m) {
    const now=new Date(),lastClosed=addMonths(now.getFullYear(),now.getMonth(),-1);
    const recent=history(db,lastClosed.year,lastClosed.month,6);
    const sample=recent.filter(x=>x.recordedIncome&&x.recordedExpenses).slice(-4);
    const incomes=sample.map(x=>x.income),expenses=sample.map(x=>x.expenses);
    const predictedIncome=sample.length>=2?median(incomes):null;
    const predictedExpenses=sample.length>=2?median(expenses):null;
    const complete=predictedIncome!==null&&predictedExpenses!==null;
    return {income:predictedIncome,expenses:predictedExpenses,
      minimum:predictedIncome!==null?Math.round(predictedIncome*.1):null,
      afterMinimum:complete?predictedIncome-predictedExpenses-Math.round(predictedIncome*.1):null,
      beforeSavings:complete?predictedIncome-predictedExpenses:null,
      incomeMonths:sample.length,expenseMonths:sample.length,monthsUsed:sample.map(x=>x.key),
      level:complete?(sample.length>=4?'referência histórica':'preliminar'):'insuficiente',
      method:'Mediana dos mesmos meses fechados, anteriores ao mês atual. Não inclui rendimentos ou inflação.'};
  }
  function categories(db, y, m) {
    const key = period(y, m);
    const prev = addMonths(y, m, -1);
    const prevKey = period(prev.year, prev.month);
    const prevRows = (db.records || []).filter(x => x.kind === 'expense' && asPeriod(x.date) === prevKey);
    const rows = (db.records || []).filter(x => x.kind === 'expense' && asPeriod(x.date) === key);
    const group = items => items.reduce((acc, x) => { acc[x.category] = (acc[x.category] || 0) + x.amount; return acc; }, {});
    const now = group(rows), before = group(prevRows);
    const total = sum(Object.values(now));
    const items = Object.keys(now).map(name => {
      const value = now[name], previous = before[name] || 0;
      const change = value - previous;
      return { name, amount: value, share: total > 0 ? value / total * 100 : 0,
        previous, change, rateChange: previous > 0 ? change / previous * 100 : null,
        growthAlert: prevRows.length > 0 && previous > 0 && change >= 5000 && change / previous >= 0.25 };
    }).sort((a, b) => b.amount - a.amount);
    return { items, total, previousTotal: sum(prevRows.map(x => x.amount)), hasPrevious: prevRows.length > 0,
      biggestRise: items.filter(x => x.growthAlert).sort((a, b) => b.change - a.change)[0] || null,
      savingExample: items.length ? Math.round(items[0].amount * 0.10) : 0 };
  }
  const balanceAt = (db, id, y, m) => sum((db.allocations || [])
    .filter(x => x.jarId === id && asPeriod(x.date) <= period(y, m)).map(x => x.amount));
  function goal(db, jar, y, m) {
    const actualToday=new Date(),actualYear=actualToday.getFullYear(),actualMonth=actualToday.getMonth();
    const todayKey=period(actualYear,actualMonth),selectedKey=period(y,m),current=balanceAt(db,jar.id,y,m);
    const pending=Math.max(0,jar.target-current),deadline=asPeriod(jar.dueDate),dueYear=Number(deadline.slice(0,4)),dueMonth=Number(deadline.slice(5,7))-1;
    const monthsRemaining=Math.max(0,(dueYear-actualYear)*12+(dueMonth-actualMonth)+1);
    const perMonth=pending===0?0:monthsRemaining>0?Math.ceil(pending/monthsRemaining):null;
    const closedMonth=addMonths(actualYear,actualMonth,-1),recentPeriods=history(db,closedMonth.year,closedMonth.month,3);
    const movements=(db.allocations||[]).filter(x=>x.jarId===jar.id&&asPeriod(x.date)<todayKey);
    const first=movements.length?movements.map(x=>asPeriod(x.date)).sort()[0]:null;
    const recent=first?recentPeriods.filter(x=>x.key>=first).map(periodData=>sum(movements.filter(x=>asPeriod(x.date)===periodData.key).map(x=>x.amount))):[];
    const monthlyPace=recent.length>=2?Math.round(sum(recent)/recent.length):null;
    let status = 'sem_historico';
    if (pending === 0) status = 'concluida';
    else if (deadline < todayKey) status = 'atrasada';
    else if (monthlyPace !== null && monthlyPace < perMonth) status = 'em_risco';
    else if (monthlyPace !== null) status = 'no_ritmo';
    const monthsAtPace = pending > 0 && monthlyPace > 0 ? Math.ceil(pending / monthlyPace) : null;
    const projected=monthsAtPace!==null?addMonths(actualYear,actualMonth,monthsAtPace-1):null;
    return { id: jar.id, name: jar.name, dueDate: jar.dueDate, target: jar.target,
      current, pending, progress: jar.target > 0 ? current / jar.target * 100 : 0,
      monthsRemaining, perMonth, monthlyPace, sampleMonths: recent.length, status,
      projectedPeriod: projected ? period(projected.year, projected.month) : null };
  }
  function goals(db, y, m) {
    const plans=(db.jars||[]).filter(j=>!j.archived&&!j.paused).map(j=>goal(db,j,y,m));
    const need = sum(plans.filter(x => x.perMonth !== null).map(x => x.perMonth));
    const estimate = forecast(db, y, m);
    const budget = estimate.beforeSavings;
    return { plans, monthlyRequired: need,
      estimatedRoom: budget, affordable: budget === null ? null : need <= budget,
      delayed: plans.filter(x => x.status === 'atrasada').length,
      risky: plans.filter(x => x.status === 'em_risco').length };
  }
  function insights(db, y, m) {
    const now = monthData(db, y, m), prev = addMonths(y, m, -1), before = monthData(db, prev.year, prev.month);
    const byCat = categories(db, y, m), projection = forecast(db, y, m), goalsView = goals(db, y, m);
    const items = [];
    const add = (kind, title, message) => items.push({ kind, title, message });
    if (!now.recordedIncome && !now.recordedExpenses && !(db.allocations || []).some(a => asPeriod(a.date) === now.key)) {
      add('info', 'Comece pelos registros', 'Cadastre salário, complemento e despesas para receber análises do mês.');
    } else {
      if (now.income > 0 && now.available < 0) add('critical', 'Saldo do mês negativo', 'Despesas e valores guardados ultrapassam a renda registrada.');
      if (now.income > 0 && now.saved < now.minimum) add('attention', 'Reserva abaixo do mínimo', 'O valor líquido guardado neste mês está abaixo da referência de 10%.');
      if (now.income > 0 && now.saved >= now.minimum) add('positive', 'Reserva mínima alcançada', 'O valor líquido guardado atingiu pelo menos 10% da renda.');
      if (byCat.items.length) add('info', 'Maior categoria de despesas', byCat.items[0].name + ' representa ' + byCat.items[0].share.toFixed(1).replace('.', ',') + '% do total do mês.');
      if (byCat.biggestRise) add('attention', 'Aumento relevante em despesas', byCat.biggestRise.name + ' cresceu mais de 25% e pelo menos R$ 50 em relação ao mês anterior.');
      if (before.recordedExpenses && now.recordedExpenses && now.expenses > before.expenses * 1.2 && now.expenses - before.expenses >= 10000)
        add('attention', 'Despesas totais cresceram', 'O total gasto aumentou mais de 20% em comparação ao mês anterior.');
      if (projection.afterMinimum !== null && projection.afterMinimum < 0)
        add('attention', 'Projeção apertada', 'O histórico indica que separar 10% da renda poderá deixar o saldo mensal negativo.');
    }
    if (goalsView.delayed) add('critical', 'Meta com prazo encerrado', 'Há cofrinho sem o valor desejado após a data final.');
    if (goalsView.risky) add('attention', 'Cofrinho em risco', 'O ritmo recente de depósitos está abaixo do necessário para cumprir uma ou mais metas.');
    if (goalsView.affordable === false) add('attention', 'Metas exigem ajuste', 'A soma mensal necessária para os cofrinhos supera a sobra mensal estimada antes de guardar.');
    return { items, now, byCat, projection, goals: goalsView };
  }
  return Object.freeze({ monthData, history, median, forecast, categories, balanceAt, goal, goals, insights });
});
