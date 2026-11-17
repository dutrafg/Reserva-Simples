function budgetDueCard(){
  const bills=upcomingBillInstances(30);
  const dueOverdue=bills.filter(bill=>bill.daysLate>0).length;
  const dueToday=bills.filter(bill=>bill.daysUntil===0).length;
  const dueWeek=bills.filter(bill=>bill.daysUntil>0&&bill.daysUntil<=7).length;
  return `<article class="card" id="budgetDueCard">${cardTitle('Próximos vencimentos','Contas previstas para os próximos 30 dias e vencimentos recentes')}<div class="actions home-finance-actions"><button type="button" class="btn small primary" data-home-finance-entry="due">Adicionar vencimento</button><button type="button" class="btn small" data-page="calendar">Abrir calendário</button></div><div class="home-due-summary"><div><small>Vencidos</small><strong>${dueOverdue}</strong></div><div><small>Hoje</small><strong>${dueToday}</strong></div><div><small>Próximos 7 dias</small><strong>${dueWeek}</strong></div></div>${bills.length?`<div class="upcoming-list">${bills.map(t=>`<button type="button" class="upcoming-row" data-open-calendar-date="${t.date}"><span class="upcoming-day">${dateBR(t.date).slice(0,5)}</span><span><b>${esc(t.category)}</b><small>${t.daysLate?`<span class="overdue-label">Vencida há ${t.daysLate} dia(s)</span> · `:t.daysUntil===0?'Vence hoje · ':t.daysUntil===1?'Vence amanhã · ':`Vence em ${t.daysUntil} dias · `}${esc(t.note||'Conta prevista')}</small></span><strong>${money(t.amount)}</strong></button>`).join('')}</div>`:`<div class="empty-inline">Nenhum vencimento na lista. Use Adicionar vencimento para cadastrar uma conta.</div>`}</article>`;
}
function accountsPayableCard(bills){
  const next=bills.find(bill=>bill.daysUntil>=0);
  const overdue=bills.filter(bill=>bill.daysLate>0).length;
  return `<div class="accounts-payable-summary" id="accountsPayableCard"><span>${overdue?`${overdue} vencida(s)`:next?`Próxima: ${dateBR(next.date)}`:'Sem contas previstas'}</span>${next?`<b>${esc(next.note||next.category)} · ${money(next.amount)}</b>`:''}</div>`;
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
function financeInline(html){return html.replace(/<article class="card([^"]*)"/g,'<section class="finance-subcard$1"').replace(/<\/article>/g,'</section>')}
function financeGroup(title,description,content,open=false){return `<details class="card finance-group" ${open?'open':''}><summary><span><b>${title}</b><small>${description}</small></span><span class="finance-group-chevron" aria-hidden="true">⌄</span></summary><div class="finance-group-content">${content}</div></details>`}
function budget(){
  const m=month(),events=calendarEventsForMonth(state.year,state.month);
  if(state.financeView&&state.financeView!=='overview'){
    const view=state.financeView,renderer=pageRenderers[view],target=$('#page-budget');
    target.innerHTML=`${heading('Finanças',view==='transactions'?'Lançamentos':view==='investments'?'Investimentos':'Metas')}<nav class="finance-section-nav" data-module="finance" aria-label="Seções de Finanças"><button type="button" data-page="budget">Visão geral</button><button type="button" class="${view==='transactions'?'selected':''}" data-page="transactions">Lançamentos</button><button type="button" class="${view==='investments'?'selected':''}" data-page="investments">Investimentos</button><button type="button" class="${view==='goals'?'selected':''}" data-page="goals">Metas</button></nav><div id="financeEmbeddedView"></div>`;
    const source=$('#page-'+view);renderer();$('#financeEmbeddedView').replaceChildren(...source.childNodes);return;
  }
  const pendingTotal=sum([...events.values()].flat().filter(item=>item.kind==='scheduled-expense').map(item=>Math.abs(item.value)));
  $('#page-budget').innerHTML=`
    ${heading('Finanças','Lançamentos, orçamento, investimentos e metas em um só lugar.')}
    <div class="actions budget-month">
      <button type="button" class="btn small" data-home-month="prev" aria-label="Mês anterior">‹</button>
      <button type="button" class="btn small" data-home-month="pick">${esc(monthLabel())}</button>
      <button type="button" class="btn small" data-home-month="next" aria-label="Próximo mês">›</button>



    </div>
    <div class="finance-period-summary" aria-label="Resumo do período"><span>Despesas<strong>${money(m.expenses)}</strong></span><span>Contas previstas<strong>${money(pendingTotal)}</strong></span><small>${esc(monthLabel())} · valores registrados e previstos</small></div>
    <nav class="finance-section-nav" data-module="finance" aria-label="Seções de Finanças"><button type="button" class="selected" data-page="budget" aria-current="page">Visão geral</button><button type="button" data-page="transactions">Lançamentos</button><button type="button" data-page="investments">Investimentos</button><button type="button" data-page="goals">Metas</button></nav>
    <div class="budget-card-grid finance-groups">
      ${financeGroup('Gastos e orçamento','Cartões, categorias, limites e comparativo mensal.',`${financeInline(homeSmartFinanceCard(m))}<details class="finance-detail" open><summary>Gastos por categoria</summary>${financeInline(categorySpendCard(m))}</details><details class="finance-detail" open><summary>Limites e mercado</summary>${financeInline(marketWeeklyCard())}${financeInline(marketBudgetCard(m))}${financeInline(categoryBudgetCard(m))}</details><details class="finance-detail" open><summary>Comparativo mensal e maiores gastos</summary>${financeInline(expenseComparisonCards(m))}</details>`,true)}
      ${financeGroup('Agenda e contas','Compromissos, vencimentos e recorrências no mesmo lugar.',`<div class="finance-agenda-grid">${financeInline(upcomingCommitmentsCard())}${financeInline(budgetDueCard())}</div>${accountsPayableCard(upcomingBillInstances(30))}${financeInline(budgetRecurrenceCard())}`,true)}
      ${financeGroup('Previsões e decisões','Fluxo de caixa, ritmo de gastos e comparação de dívida.',`${financeInline(homeForecastCard())}${financeInline(paydayPaceCard(m))}${financeInline(cashflowCard())}<details class="finance-detail" open><summary>Comparar dívida com investimento</summary>${financeInline(debtCompareCard())}</details>`,true)}
    </div>`;
}
