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
