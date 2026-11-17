function homeWorkspace(m){
 const categories=horizontalCategories(m.records);
 const expenseCount=m.records.filter(record=>record.kind==='expense').length;
 const metrics=[
  ['Saldo disponível',m.balance,'home','home'],
  ['Receitas',m.income,'transactions','income'],
  ['Despesas',m.expenses,'transactions','expense'],
  ['Guardado no mês',m.saved,'goals','piggy']
 ];
 return `<div class="home-workspace" aria-label="Resumo financeiro do mês">
  <div class="workspace-metrics">${metrics.map(([label,value,page,ic])=>`<button type="button" class="workspace-metric" data-page="${page}"><span class="workspace-metric-label">${icon(ic)}${label}</span><strong>${money(value)}</strong><small>${esc(monthLabel())}</small></button>`).join('')}</div>
  <div class="workspace-body"><section class="workspace-categories card" aria-labelledby="workspaceCategoriesTitle">
   <div class="workspace-section-head"><div><small>Visão financeira</small><h2 id="workspaceCategoriesTitle">Gastos por categoria</h2><p>Valores registrados em ${esc(monthLabel())}</p></div><button type="button" class="btn small" data-home-budget>Gerenciar limites</button></div>
   <label class="workspace-search">${icon('search')}<span class="sr-only">Filtrar categorias</span><input type="search" data-workspace-search placeholder="Buscar categoria" autocomplete="off"></label>
   <div class="workspace-list">${categories.length?categories.map(([name,amount],index)=>{
    const limit=db.prefs.categoryBudgets?.[name]||0;
    return `<button type="button" class="workspace-category" data-home-category="${esc(name)}" data-workspace-name="${esc(name.toLocaleLowerCase('pt-BR'))}"><span class="workspace-category-order">${String(index+1).padStart(2,'0')}</span><span class="workspace-category-name"><b>${esc(name)}</b><small>${limit?`${percent(amount/limit*100)} do limite de ${money(limit)}`:'Toque para ver os lançamentos'}</small></span><span class="workspace-category-share">${percent(m.expenses?amount/m.expenses*100:0)}</span><strong>${money(amount)}</strong><span aria-hidden="true">›</span></button>`}).join(''):'<div class="workspace-empty">Nenhuma despesa neste mês. Registre uma saída para acompanhar as categorias.</div>'}</div>
  </section><aside class="workspace-side card" aria-label="Ações e resumo">
   <h2>Registrar</h2><p>Adicione uma movimentação sem procurar outra tela.</p>
   <div class="workspace-actions"><button type="button" data-open="income">+ Entrada</button><button type="button" data-open="expense">− Saída</button><button type="button" data-page="investments">Investimento</button><button type="button" data-page="calendar">Compromisso</button></div>
   <div class="workspace-total"><small>${expenseCount} lançamento${expenseCount===1?'':'s'} de despesa</small><span>Total gasto no mês</span><strong>${money(m.expenses)}</strong></div>
   <button type="button" class="workspace-primary" data-page="budget">Abrir Orçamento</button><button type="button" class="workspace-secondary" data-page="reports">Ver Relatórios</button>
  </aside></div></div>`;
}
document.addEventListener('input',event=>{
 if(!event.target.matches('[data-workspace-search]'))return;
 const query=event.target.value.trim().toLocaleLowerCase('pt-BR');
 document.querySelectorAll('#page-home .workspace-category').forEach(row=>{row.hidden=!row.dataset.workspaceName.includes(query)});
});
