function budgetDueCard(){
  const bills=upcomingBillInstances(30);
  const dueOverdue=bills.filter(bill=>bill.daysLate>0).length;
  const dueToday=bills.filter(bill=>bill.daysUntil===0).length;
  const dueWeek=bills.filter(bill=>bill.daysUntil>0&&bill.daysUntil<=7).length;
  return `<article class="card" id="budgetDueCard">${cardTitle('Próximos vencimentos','Contas previstas para os próximos 30 dias e vencimentos recentes')}<div class="actions home-finance-actions"><button type="button" class="btn small primary" data-home-finance-entry="due">Adicionar vencimento</button><button type="button" class="btn small" data-page="calendar">Abrir calendário</button></div><div class="home-due-summary"><div><small>Vencidos</small><strong>${dueOverdue}</strong></div><div><small>Hoje</small><strong>${dueToday}</strong></div><div><small>Próximos 7 dias</small><strong>${dueWeek}</strong></div></div>${bills.length?`<div class="upcoming-list">${bills.map(t=>`<button type="button" class="upcoming-row" data-open-calendar-date="${t.date}"><span class="upcoming-day">${dateBR(t.date).slice(0,5)}</span><span><b>${esc(t.category)}</b><small>${t.daysLate?`<span class="overdue-label">Vencida há ${t.daysLate} dia(s)</span> · `:t.daysUntil===0?'Vence hoje · ':t.daysUntil===1?'Vence amanhã · ':`Vence em ${t.daysUntil} dias · `}${esc(t.note||'Conta prevista')}</small></span><strong>${money(t.amount)}</strong></button>`).join('')}</div>`:`<div class="empty-inline">Nenhum vencimento na lista. Use Adicionar vencimento para cadastrar uma conta.</div>`}</article>`;
}
function homeBudgetOverview(monthData){
  const cardSpent=sum(monthData.records.filter(record=>record.kind==='expense'&&record.category==='Cartões').map(record=>record.amount));
  return `<article class="card home-budget-link"><h2>Orçamento do mês</h2><p>${esc(monthLabel())}</p>
      <dl><div><dt>Despesas registradas</dt><dd>${money(monthData.expenses)}</dd></div><div><dt>Gastos com cartões</dt><dd>${money(cardSpent)}</dd></div></dl>
      <div class="actions"><button type="button" class="btn small" data-page="budget">Abrir orçamento</button><button type="button" class="btn small" data-home-budget>Gerenciar limites</button></div></article>
    `;
}
function accountsPayableCard(bills){
  const next=bills.find(bill=>bill.daysUntil>=0);
  const overdue=bills.filter(bill=>bill.daysLate>0).length;
  return `<article class="card home-budget-link" id="accountsPayableCard"><h2>Contas a pagar</h2>
      <p>${next?'Próximo vencimento em '+dateBR(next.date):'Sem contas previstas nos próximos 30 dias.'}</p>
      ${next?`<strong>${esc(next.note||next.category)} · ${money(next.amount)}</strong>`:''}
      ${overdue?`<p>${overdue} conta(s) vencida(s) recentemente.</p>`:''}
      <div class="actions"><button type="button" class="btn small" data-budget-target="budgetDueCard">Ver vencimentos</button></div></article>`;
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
      ${upcomingCommitmentsCard()}${accountsPayableCard(upcomingBillInstances(30))}
      ${budgetDueCard()}${homeSmartFinanceCard(m)}
      ${categorySpendCard(m)}${homeForecastCard()}
      ${marketWeeklyCard()}${marketBudgetCard(m)}${categoryBudgetCard(m)}
      ${expenseComparisonCards(m)}
      ${paydayPaceCard(m)}${cashflowCard()}
      ${budgetRecurrenceCard()}${debtCompareCard()}
    </div>`;
}
