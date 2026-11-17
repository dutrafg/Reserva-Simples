function syncMonthlyCloseChecklist(){const root=$('#monthlyCloseChecklist');if(!root)return;const key=userKey('reserva.monthlyClose.'+root.dataset.month);let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}root.querySelectorAll('[data-close-check]').forEach(input=>{input.checked=!!saved[input.dataset.closeCheck]});const done=Object.values(saved).filter(Boolean).length;const progress=root.querySelector('[data-close-progress]');if(progress)progress.textContent=`${done} de 4 etapas concluídas`;}
function dailyReportCard(today=isoToday()){
 const current=new Date(state.year,state.month,1),previous=new Date(state.year,state.month-1,1);
 const balances=date=>{
   const y=date.getFullYear(),m=date.getMonth();
   const daily=new Map();
   for(const [day,items] of calendarEventsForMonth(y,m)){
     daily.set(Number(day.slice(-2)),sum(items.filter(item=>['record','allocation','investment'].includes(item.source)&&Number.isSafeInteger(item.value)).map(item=>item.value)));
   }
   let total=0;
   return Array.from({length:new Date(y,m+1,0).getDate()},(_,day)=>total+=daily.get(day+1)||0);
 };
 const now=balances(current),before=balances(previous),period=mkey(state.year,state.month);
 const lastDay=period===today.slice(0,7)?Number(today.slice(8)):now.length;
 const rows=(from,to)=>Array.from({length:to-from+1},(_,index)=>{
   const day=to-index;
   return `<tr><th scope="row">${day}</th><td>${money(now[day-1])}</td><td>${day<=before.length?money(before[day-1]):'—'}</td></tr>`;
 }).join('');
 const table=body=>`<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Dia</th><th scope="col">${esc(monthLabel())}</th><th scope="col">${MONTHS[previous.getMonth()]} de ${previous.getFullYear()}</th></tr></thead><tbody>${body}</tbody></table></div>`;
 const first=Math.max(1,lastDay-9);
 return `<article class="card report-daily-card">${cardTitle('Saldo dia a dia','Saldo acumulado no mês a partir de R$ 0, com comparação com o mês anterior.')}
 ${table(rows(first,lastDay))}
 ${first>1||lastDay<now.length?`<details class="report-daily-details"><summary>Ver todos os ${now.length} dias do mês</summary>${table(rows(1,now.length))}</details>`:''}</article>`;
}
function expenseComparisonCards(monthData){
 const history=Array.from({length:3},(_,index)=>{
   const date=new Date(state.year,state.month-index-1,1);
   return new Map(horizontalCategories(getMonth(date.getFullYear(),date.getMonth()).records));
 });
 const current=new Map(horizontalCategories(monthData.records));
 const categories=[...new Set([...current.keys(),...history.flatMap(period=>[...period.keys()])])];
 const expenses=monthData.records.filter(record=>record.kind==='expense');
 const fixed=sum(expenses.filter(record=>record.recurringId).map(record=>record.amount));
 const biggest=[...expenses].sort((a,b)=>b.amount-a.amount).slice(0,5);
 return `<article class="card">${cardTitle('Comparativo por categoria','Mês selecionado e média dos três meses anteriores. Meses sem registros entram como zero.')}
 ${categories.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Categoria</th><th>Mês</th><th>Média</th><th>Diferença</th></tr></thead><tbody>${categories.map(category=>{
 const amount=current.get(category)||0,average=Math.round(sum(history.map(period=>period.get(category)||0))/3);
 return `<tr><th scope="row">${esc(category)}</th><td>${money(amount)}</td><td>${money(average)}</td><td>${money(amount-average)}</td></tr>`;
 }).join('')}</tbody></table></div>`:'<div class="empty-inline">Sem despesas registradas no período comparado.</div>'}</article>
 <article class="card">${cardTitle('Gastos fixos e variáveis','Despesas recorrentes registradas entram como fixas. As demais entram como variáveis.')}
 <p>Fixos: <strong>${money(fixed)}</strong> · Variáveis: <strong>${money(sum(expenses.map(record=>record.amount))-fixed)}</strong></p>
 <h3>Maiores gastos do mês</h3>${biggest.length?`<ol>${biggest.map(record=>`<li>${esc(record.note||record.category)} · ${dateBR(record.date)} · <strong>${money(record.amount)}</strong></li>`).join('')}</ol>`:'<div class="empty-inline">Sem despesas neste mês.</div>'}</article>`;
}
function reports(){
 const m=month(),yearMonths=yearly(state.year),income=sum(yearMonths.map(x=>x.income)),expenses=sum(yearMonths.map(x=>x.expenses)),net=income-expenses,reserve=sum(yearMonths.map(x=>x.saved)),cats=horizontalCategories(m.records),total=sum(cats.map(x=>x[1]));
 $('#page-reports').innerHTML=heading('Relatórios','Acompanhe sua vida financeira e gere relatórios em PDF.')+dailyReportCard()+
 '<div class="stats report-stats">'+stat('Receitas do mês',money(m.income),monthLabel(),'income')+stat('Despesas do mês',money(m.expenses),monthLabel(),'expense')+stat('Saldo do mês',money(m.income-m.expenses),'Receitas menos despesas','wallet')+'</div>'+
 '<div class="report-columns"><div class="report-stack">'+
 '<article class="card report-period-card"><h2>Gerar relatório financeiro</h2><p>Escolha o período. O PDF inclui receitas, despesas, categorias, compromissos e o resumo do período.</p><input type="hidden" id="globalPdfScope" value="month"><div class="pdf-period-options" role="group" aria-label="Período do relatório"><button type="button" class="btn selected" data-pdf-scope="month" aria-pressed="true">Este mês</button><button type="button" class="btn" data-pdf-scope="year" aria-pressed="false">Ano atual</button><button type="button" class="btn" data-pdf-scope="all" aria-pressed="false">Histórico completo</button></div><div class="report-period-actions"><button class="btn primary" id="globalPdfBtn">Gerar PDF</button><a class="btn" id="pdfDownloadFallback" hidden download>Baixar PDF pronto</a></div></article>'+
 '<article class="card report-overview-card"><div class="card-head"><div><h2>Visão anual · '+state.year+'</h2><p>Acumulado desde janeiro</p></div></div><div class="report-annual-stats"><div><small>Receitas</small><strong>'+money(income)+'</strong></div><div><small>Despesas</small><strong>'+money(expenses)+'</strong></div><div><small>Saldo</small><strong class="'+(net<0?'danger-text':'')+'">'+money(net)+'</strong></div><div><small>Reserva</small><strong>'+money(reserve)+'</strong><small>'+(income>0?percent(reserve/income*100)+' da renda':'Sem renda registrada')+'</small></div></div></article>'+
 '<article class="card report-year-chart">'+cardTitle('Fluxo ao longo do ano',String(state.year))+yearChart()+'</article>'+
 '</div><div class="report-stack">'+
 '<article class="card monthly-close-card"><div class="card-head"><div><h2>Fechamento do mês</h2><p>Checklist local para conferir os números antes de arquivar o relatório.</p></div></div><div id="monthlyCloseChecklist" data-month="'+mkey(state.year,state.month)+'"><label><input type="checkbox" data-close-check="income"> Conferi as receitas</label><label><input type="checkbox" data-close-check="expense"> Conferi as despesas</label><label><input type="checkbox" data-close-check="bills"> Revisei vencimentos e recorrências</label><label><input type="checkbox" data-close-check="pdf"> GereI o PDF do mês</label><p class="help" data-close-progress></p><button type="button" class="btn small" data-close-reset>Limpar checklist</button></div></article>'+
 '</div></div>'+
 '<article class="card report-categories-card"><h2>Despesas por categoria · '+esc(monthLabel())+'</h2>'+ (cats.length?'<div class="report-category-list">'+cats.map(([name,amount])=>'<button type="button" data-home-report-category="'+esc(name)+'"><span>'+esc(name)+'</span><span class="report-category-track"><i style="width:'+Math.max(4,amount/cats[0][1]*100)+'%;background:'+(CAT_COLORS[CATS.indexOf(name)]||'#8c9bab')+'"></i></span><strong>'+money(amount)+'</strong><small>'+percent(amount/total*100)+'</small></button>').join('')+'</div>':'<div class="empty-inline">Sem despesas neste mês para resumir.</div>')+'</article>';
 syncMonthlyCloseChecklist();
}

