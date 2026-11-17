function calendar(){
  const y=state.year,m=state.month,key=mkey(y,m),today=isoToday(),days=new Date(y,m+1,0).getDate(),startOffset=(new Date(y,m,1).getDay()+6)%7,total=Math.ceil((startOffset+days)/7)*7,events=calendarEventsForMonth(y,m),selected=state.calendarDate?.startsWith(key)?state.calendarDate:(today.startsWith(key)?today:key+'-01');state.calendarDate=selected;
  const {expensesByDay,highestDailyExpense,levelFor}=calendarSpending(events);
  const futureDays=Math.max(0,Math.ceil((new Date(y,m+1,1)-new Date(today+'T12:00:00'))/86400000));const projection=futureDays<=120?cashProjection(futureDays):null;
  const dayBalance=date=>{if(!projection||!date.startsWith(key))return null;if(date===today)return projection.dailyBalances?.[today]??projection.nowBalance;if(date>today)return projection.dailyBalances?.[date]??null;return null};
  const noteDates=new Set(calendarNotes().map(note=>note.date));
  const cells=Array.from({length:total},(_,i)=>{const day=i-startOffset+1;if(day<1||day>days)return '<div class="calendar-day outside" aria-hidden="true"></div>';const date=key+'-'+String(day).padStart(2,'0'),list=events.get(date)||[],balance=dayBalance(date),flow=list.filter(x=>Number.isSafeInteger(x.value)).reduce((n,x)=>n+x.value,0),taskColors=[...new Set(list.filter(x=>x.source==='task').map(x=>x.color||'purple'))].slice(0,3),dayAccent=taskColors[0]||'',dailyExpense=expensesByDay.get(date)||0,heatLevel=levelFor(date);return `<button type="button" class="calendar-day ${date===selected?'selected':''} ${date===today?'is-today':''} ${dayAccent?'has-appointment':''}" ${dayAccent?`style="--calendar-day-accent:${calendarTaskColor(dayAccent)}"`:''} ${heatLevel?`data-expense-heat="${heatLevel}" title="Despesas do dia: ${money(dailyExpense)}"`:''} data-calendar-date="${date}" aria-pressed="${date===selected}" aria-label="${day} de ${MONTHS[m]}, ${list.length} evento(s)${noteDates.has(date)?', com notas':''}${dailyExpense&&!hideValues?', despesas '+money(dailyExpense):''}"><span class="calendar-day-number">${day}</span><span class="calendar-cell-preview">${list.slice(0,2).map(item=>`<span>${esc(item.title)}</span>`).join('')}${list.length>2?'<span>+'+(list.length-2)+'</span>':''}</span>${balance!==null?`<small class="calendar-balance ${balance<0?'negative':''}">${money(balance)}</small>`:list.length?`<small class="calendar-count">${list.length} ${list.length===1?'item':'itens'}${flow?` · ${money(flow)}`:''}</small>`:''}</button>`}).join('');
  const selectedEvents=events.get(selected)||[],tasks=db.tasks.filter(x=>x.date===selected).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const rows=selectedEvents.length?selectedEvents.map(item=>`<div class="calendar-event-row ${item.kind}" ${item.source==='task'?`style="--event-color:${calendarTaskColor(item.color)}"`:''}><span class="calendar-event-icon">${icon(item.source==='task'?'calendar':item.kind==='income'||item.kind==='scheduled-income'?'income':item.kind==='task-done'?'target':'expense')}</span><span class="calendar-event-copy"><b>${esc(item.title)}</b><small>${item.time?esc(item.time)+' · ':''}${esc(item.detail)}${item.source==='recurring'?' · ainda não lançada':''}</small></span>${Number.isSafeInteger(item.value)?`<strong class="${item.value<0?'negative':''}">${item.value>0?'+':''}${money(item.value)}</strong>`:''}${item.source==='task'?`<div class="calendar-event-actions"><button type="button" class="btn small" data-task-edit="${esc(item.id)}">Editar</button><button type="button" class="btn small" data-task-toggle="${esc(item.id)}">${item.done?'Reabrir':'Concluir'}</button><button type="button" class="calendar-delete" data-task-delete="${esc(item.id)}" aria-label="Excluir tarefa">×</button></div>`:''}${item.source==='record'?`<div class="calendar-event-actions"><button type="button" class="btn small" data-calendar-record-edit="${esc(item.id)}">Editar</button><button type="button" class="btn small negative" data-calendar-record-delete="${esc(item.id)}">Excluir</button></div>`:''}${item.source==='allocation'?`<div class="calendar-event-actions"><button type="button" class="btn small" data-calendar-allocation-edit="${esc(item.id)}">Editar</button><button type="button" class="btn small negative" data-calendar-allocation-delete="${esc(item.id)}">Excluir</button></div>`:''}${item.source==='investment'?`<div class="calendar-event-actions"><button type="button" class="btn small" data-calendar-investment-edit="${esc(item.id)}">Editar investimento</button><button type="button" class="btn small negative" data-calendar-investment-delete="${esc(item.id)}">Excluir investimento</button></div>`:''}</div>`).join(''):'<div class="empty-inline">Nenhum lançamento, compromisso ou tarefa neste dia.</div>';
  const balance=dayBalance(selected),dailyFlow=selectedEvents.filter(x=>Number.isSafeInteger(x.value)).reduce((n,x)=>n+x.value,0);
  $('#page-calendar').innerHTML=`${heading('Calendário','Consulte o saldo previsto, lançamentos e compromissos do mês.')}<div class="calendar-tabs" role="group" aria-label="Detalhes do dia"><button class="btn" data-calendar-tab="agenda">Agenda</button><button class="btn" data-calendar-tab="tasks">Tarefas</button><button class="btn" data-calendar-tab="notes">Notas</button></div><div class="calendar-organizer"><article class="card calendar-detail"><div class="calendar-detail-head"><div><span class="calendar-detail-date">${dateBR(selected)}</span><h3>Agenda do dia</h3></div><span class="tag soft">${selectedEvents.length} ${selectedEvents.length===1?'item':'itens'}</span></div><div class="actions calendar-day-actions"><button class="btn small" data-calendar-new-task>Agendar compromisso</button></div><div class="calendar-event-list">${rows}</div><div class="calendar-balance-panel"><div><span>Saldo previsto do dia</span><small>${balance===null?(selected<today?'Histórico diário não estimado':'Configure o saldo de referência em Metas'):'Estimativa acumulada até '+dateBR(selected)}</small></div><strong class="calendar-balance-total ${balance!==null&&balance<0?'negative':''}">${balance===null?'—':money(balance)}</strong></div><div class="calendar-balance-summary"><span>Movimento previsto neste dia</span><b>${money(dailyFlow)}</b></div>${tasks.length?`<div class="calendar-task-summary"><b>${tasks.filter(t=>!t.done).length} tarefa(s) pendente(s)</b><small>${tasks.filter(t=>t.done).length} concluída(s)</small></div>`:''}</article>${calendarOrganizer(selected,tasks)}</div><article class="card calendar-card"><div class="calendar-topline"><div><div class="actions"><button class="btn" data-home-month="prev" aria-label="Mês anterior">‹</button><button class="btn" data-home-month="pick">${esc(monthLabel())}</button><button class="btn" data-home-month="next" aria-label="Próximo mês">›</button></div><small>Selecione um dia para consultar a agenda.</small></div><span class="calendar-legend">${highestDailyExpense?'<span class="calendar-heat-legend" role="img" aria-label="Gastos: menos a mais despesas registradas"><b>Gastos</b><small>Menos</small>'+[1,2,3,4,5].map(level=>`<i data-heat-level="${level}" aria-hidden="true"></i>`).join('')+'<small>Mais</small></span>':''}</span></div><div class="calendar-grid" role="grid" aria-label="Calendário de ${esc(monthLabel())}">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=>`<div class="calendar-weekday" role="columnheader">${d}</div>`).join('')}${cells}</div><p class="help">A previsão usa o saldo de referência, os lançamentos e as contas recorrentes. Compromissos não alteram o saldo.</p></article>`;
  ensureCalendarCompose();
  syncCalendarTabs();
  const dayDialog=$('#calendarDayDialog'),dialogContent=$('#calendarDayDialogContent');if(dayDialog?.open&&dialogContent){const dayDetail=$('#page-calendar .calendar-detail');if(dayDetail)dialogContent.innerHTML=dayDetail.innerHTML}
}
let calendarTaskEditId=null,calendarRecordEditPending=false,calendarInvestmentEditPending=false;
function editCalendarTask(id){const task=db.tasks.find(x=>x.id===id),form=$('#calendarTaskForm');if(!task||!form)return;$('#calendarDayDialog')?.close();openCalendarCompose();calendarTaskEditId=id;form.elements.title.value=task.title;form.elements.date.value=task.date;form.elements.time.value=task.time||'';form.elements.note.value=task.note||'';const color=form.querySelector(`input[name="color"][value="${CSS.escape(task.color||'blue')}"]`);if(color)color.checked=true;form.querySelector('[type="submit"]').textContent='Salvar alterações';form.closest('.calendar-compose')?.querySelector('h3')?.replaceChildren(document.createTextNode('Editar compromisso'));let cancel=form.querySelector('[data-task-edit-cancel]');if(!cancel){cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.dataset.taskEditCancel='';cancel.textContent='Cancelar edição';form.append(cancel)}form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.title.focus()}
function cancelCalendarTaskEdit(){calendarTaskEditId=null;$('#calendarComposeDialog')?.close()}
async function submitCalendarTask(event){event.preventDefault();const form=event.target,title=form.elements.title.value.trim(),date=form.elements.date.value,time=form.elements.time.value,note=form.elements.note.value.trim(),color=form.querySelector('input[name="color"]:checked')?.value||'blue';if(!title||title.length>90||!validDate(date)||time&&!/^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(time))return notify('Confira o título, a data e o horário da tarefa.');const existing=db.tasks.find(x=>x.id===calendarTaskEditId),task={id:existing?.id||uid(),title,date,time,note,color,done:existing?.done||false};if(await mutate(()=>{if(existing)db.tasks[db.tasks.indexOf(existing)]=task;else db.tasks.push(task)})){calendarTaskEditId=null;form.closest('dialog')?.close();if(state.page==='calendar'){state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;state.calendarDate=date;render()}notify(existing?'Compromisso atualizado.':'Tarefa adicionada à agenda.')}}
async function toggleCalendarTask(id){const task=db.tasks.find(x=>x.id===id);if(task&&await mutate(()=>task.done=!task.done))calendar()}
async function deleteCalendarTask(id){const task=db.tasks.find(x=>x.id===id);if(!task)return;if(!confirm(`Excluir “${task.title}” da agenda?`))return;if(await mutate(()=>db.tasks=db.tasks.filter(x=>x.id!==id)))calendar()}
function emergencyReserveCard(){const now=new Date(),periods=[-3,-2,-1].map(delta=>{const d=new Date(now.getFullYear(),now.getMonth()+delta,1);return mkey(d.getFullYear(),d.getMonth())}),samples=periods.map(key=>({key,expense:sum(db.records.filter(r=>r.kind==='expense'&&r.date.startsWith(key)).map(r=>r.amount))})).filter(x=>x.expense>0),average=samples.length?Math.round(sum(samples.map(x=>x.expense))/samples.length):0,months=db.prefs.emergencyMonths||6,target=average*months,reserve=sum(db.jars.filter(j=>!j.archived).map(j=>estimateCdbJar(j.id).net)),cover=average?reserve/average:null,remaining=Math.max(0,target-reserve);if(!average||!db.jars.some(j=>!j.archived))return '';return `<article class="card">${cardTitle('Reserva de emergência','Compara os CDBs registrados com a média das despesas dos meses fechados recentes.')}<div class="prediction-grid"><div><span>Média mensal de despesas</span><strong>${average?money(average):'—'}</strong></div><div><span>Reserva líquida estimada</span><strong>${money(reserve)}</strong></div><div><span>Meses cobertos</span><strong>${cover===null?'Histórico insuficiente':cover.toFixed(1).replace('.',',')}</strong></div></div><div class="reserve-meter"><div class="reserve-meter-fill" style="width:${target?Math.min(100,reserve/target*100):0}%"></div></div><p class="help">Referência configurada: ${months} meses · meta sugerida ${average?money(target):'aguardando despesas'} · faltam ${money(remaining)}. Usa todas as despesas registradas, sem classificar apenas as essenciais. Pressupõe que os CDBs possam ser resgatados quando necessário.</p></article>`}
function guaranteeCard(){const groups=new Map();for(const i of db.institutions){if(!['fgc','fgcoop'].includes(i.guaranteeFund))continue;const key=i.guaranteeFund+'|'+(i.conglomerate||i.name).trim().toLocaleLowerCase('pt-BR');if(!groups.has(key))groups.set(key,{fund:i.guaranteeFund,name:i.conglomerate||i.name,total:0});const g=groups.get(key);g.total+=i.otherCoveredBalance||0;for(const j of db.jars.filter(j=>!j.archived&&j.institutionId===i.id))g.total+=estimateCdbJar(j.id).gross}const cap=25000000,rows=[...groups.values()];return `<article class="card">${cardTitle('Monitoramento FGC e FGCoop','Exposição estimada informada por você, agrupada por fundo e conglomerado.')}<div class="institution-list">${rows.length?rows.map(g=>`<div class="institution-row"><span><b>${fundLabel(g.fund)} · ${esc(g.name)}</b><small>Exposição cadastrada: ${money(g.total)} · margem até a referência de R$ 250 mil: ${money(Math.max(0,cap-g.total))}</small><span class="reserve-meter"><span class="reserve-meter-fill ${g.total>cap?'over':''}" style="width:${Math.min(100,g.total/cap*100)}%"></span></span></span><span class="tag ${g.total>cap?'warn':'soft'}">${g.total>cap?'Acima da referência':'Abaixo da referência'}</span></div>`).join(''):'<div class="empty-inline">Cadastre uma instituição e indique o fundo garantidor para acompanhar a exposição.</div>'}</div><p class="help">Monitoramento aproximado, não confirmação de cobertura. Confirme se a instituição e cada produto são elegíveis, some os saldos externos e considere regras de conglomerado e limites globais. O teto de R$ 1 milhão do FGC em quatro anos não está calculado aqui.</p></article>`}
function debtCompareValues(){const rate=currentCdiAnnual(),months=Number($('#debtMonths')?.value||0),tax=months>24?15:months>12?17.5:months>6?20:22.5,netAnnual=rate===null?null:rate*(1-tax/100),monthly=netAnnual===null?null:Math.pow(1+netAnnual/100,1/12)-1,quote=toCents($('#debtPayoff')?.value),payment=toCents($('#debtPayment')?.value),n=months,cet=Number($('#debtCET')?.value);if(!Number.isSafeInteger(quote)||quote<=0||!Number.isSafeInteger(payment)||payment<=0||!Number.isInteger(n)||n<=0||n>600||monthly===null)return '<p class="help">Preencha os valores da proposta de quitação e das parcelas para comparar.</p>';let pv=0;for(let i=1;i<=n;i++)pv+=payment/Math.pow(1+monthly,i);const diff=pv-quote,rateInfo=Number.isFinite(cet)&&cet>0?` CET informado: ${percent(cet)} a.a., ${cet>netAnnual?'acima':'abaixo'} do CDI líquido de referência.`:'';return `<div class="prediction-grid"><div><span>Parcelas trazidas a valor presente</span><strong>${money(Math.round(pv))}</strong></div><div><span>Quitar hoje</span><strong>${money(quote)}</strong></div><div><span>Diferença estimada</span><strong>${money(Math.abs(Math.round(diff)))}</strong></div></div><div class="comparison-bars"><div><span>Parcelas a valor presente</span><i><b style="width:${Math.min(100,pv/Math.max(pv,quote,1)*100)}%"></b></i></div><div><span>Quitar hoje</span><i><b class="alt" style="width:${Math.min(100,quote/Math.max(pv,quote,1)*100)}%"></b></i></div></div><p class="help">${diff>0?'A quitação custa menos que o valor presente estimado das parcelas.':'Manter as parcelas custa menos no cenário de rendimento usado.'}${rateInfo} CDI líquido de referência: ${percent(netAnnual)} a.a. Pressupõe parcelas iguais, pagamentos no fim de cada mês e uso do mesmo dinheiro; não inclui multas, descontos, seguros ou tarifas fora dos valores informados.</p>`}
function updateDebtComparison(){const el=$('#debtCompareResult');if(el)el.innerHTML=debtCompareValues()}
function debtCompareCard(){return `<article class="card">${cardTitle('Comparar quitação de dívida com CDB','Uma comparação matemática usando o rendimento líquido do CDI como custo de oportunidade.')}<div class="simulator-fields"><div class="field"><label for="debtPayoff">Valor para quitar hoje (R$)</label><input id="debtPayoff" type="number" min="0.01" step="0.01" inputmode="decimal"></div><div class="field"><label for="debtPayment">Valor de cada parcela restante (R$)</label><input id="debtPayment" type="number" min="0.01" step="0.01" inputmode="decimal"></div><div class="field"><label for="debtMonths">Parcelas restantes</label><input id="debtMonths" type="number" min="1" max="600" step="1"></div><div class="field"><label for="debtCET">CET informado pela instituição (% a.a.)</label><input id="debtCET" type="number" min="0" step="0.01"></div></div><div id="debtCompareResult" aria-live="polite">${debtCompareValues()}</div></article>`}
function inflationGoalCard(){const rate=currentIpcaAnnual(),latest=latestIpca();return `<article class="card">${cardTitle('Metas corrigidas pela inflação','Cenário que mantém o IPCA observado nos últimos 12 meses até a data da meta.')}${miniLine(ipcaState.rates.slice(-12).map(x=>x.value),'Variação mensal do IPCA nos últimos 12 meses',['12 meses atrás','Último mês'])}<div class="prediction-grid"><div><span>IPCA acumulado em 12 meses</span><strong>${rate===null?'Aguardando dados':percent(rate)}</strong></div><div><span>Último mês disponível</span><strong>${latest?latest.date.slice(5,7)+'/'+latest.date.slice(0,4):'—'}</strong></div><div><span>Status da consulta</span><strong>${esc(ipcaState.loading?'Atualizando':ipcaState.error?'Histórico salvo':'Disponível')}</strong></div></div><p class="help">O IPCA passado é usado como cenário, não como previsão. As metas nominais continuam iguais; nos cartões de metas aparece também o valor aproximado necessário no prazo para preservar o poder de compra.</p></article>`}
function planningSettingsCard(){const amount=db.prefs.balanceAnchorCents===null?'':(db.prefs.balanceAnchorCents/100).toFixed(2),date=db.prefs.balanceAnchorDate||'';return `<article class="card settings-card">${cardTitle('Saldo de referência e reserva','Configure os dados de referência usados nas novas estimativas.')}<form id="planningPrefsForm" class="form-grid"><div class="field"><label for="balanceAnchorAmount">Saldo disponível de referência (R$)</label><input id="balanceAnchorAmount" type="number" min="0" step="0.01" value="${amount}" inputmode="decimal"></div><div class="field"><label for="balanceAnchorDate">Data desse saldo</label><input id="balanceAnchorDate" type="date" value="${date}"></div><div class="field full"><label for="emergencyMonths">Meses de despesas desejados na reserva</label><select id="emergencyMonths">${[3,6,9,12].map(n=>`<option value="${n}" ${db.prefs.emergencyMonths===n?'selected':''}>${n} meses</option>`).join('')}</select></div><div class="setting-actions full"><button class="btn primary" type="submit">Salvar referências</button></div></form><p class="settings-note">O saldo e a data são informados por você. A projeção não substitui o saldo real dos seus bancos.</p></article>`}
const totalMonthSaved=()=>sum(month().movements.map(a=>a.amount));
const dateBR=d=>{const [y,m,day]=d.split('-');return `${day}/${m}/${y}`};
const dateTime=d=>new Date(d+'T12:00:00').getTime();
function stat(label,val,sub,i='wallet',cls=''){return `<article class="stat"><div class="name">${icon(i)}${esc(label)}</div><strong>${val}</strong><div class="hint ${cls}">${sub}</div></article>`}
function heading(title,description,action=''){return `<div class="section-heading"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>`}
function cardTitle(title,description,action=''){return `<div class="card-head"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>`}
let sidebarCompact = localStorage.getItem(userKey('reserva.sidebarCompact')) === 'true';
function syncSidebar() {
  document.body.classList.toggle('sidebar-compact', sidebarCompact);
  const toggle = $('#sidebarToggle');
  
  toggle.setAttribute('aria-expanded', String(!sidebarCompact));
  toggle.setAttribute('aria-label', sidebarCompact ? 'Expandir menu lateral' : 'Recolher menu lateral');
  toggle.title = toggle.getAttribute('aria-label');
}
$('#sidebarToggle').addEventListener('click', () => {
  sidebarCompact = !sidebarCompact;
  try { localStorage.setItem(userKey('reserva.sidebarCompact'), String(sidebarCompact)); } catch {}
  syncSidebar();
});
const desktopActionSets={budget:[['Nova despesa','open','wallet','expense'],['Calendário','go','calendar','calendar'],['Lançamentos','go','wallet','transactions'],['Relatórios','go','report','reports']],home:[['Registrar','quick','plus'],['Agenda','go','calendar','calendar'],['7 dias','period','chart','7d'],['Orçamento','go','wallet','budget'],['Relatórios','go','report','reports']],transactions:[['Novo lançamento','quick','plus'],['Receitas','filter','income','income'],['Despesas','filter','expense','expense'],['Importar CSV','click','refresh','#bankCsvBtn'],['Exportar CSV','click','report','#csvBtn'],['Recorrências','go','refresh','budget']],calendar:[['Novo compromisso','task','plus'],['Hoje','today','calendar'],['Metas','go','target','goals']],goals:[['Nova meta','open','target','jar'],['Registrar aporte','deposit','plus'],['Resgatar','open','wallet','withdraw'],['PDF de metas','clickPage','report','goals|#shareCdbPdfBtn']],investments:[['Novo investimento','investment','plus'],['Investimento existente','investmentExisting','wallet'],['Aportar em meta','deposit','target'],['Atualizar CDI','clickPage','refresh','investments|#refreshCdiBtn']],analysis:[['Lançamentos','go','wallet','transactions'],['Relatórios','go','report','reports'],['Exportar CSV','clickPage','report','transactions|#csvBtn']],reports:[['Gerar PDF','clickPage','report','reports|#globalPdfBtn'],['Lançamentos','go','wallet','transactions'],['Hoje','go','home']],settings:[['Backup','clickPage','wallet','settings|#exportBtn'],['Importar CSV','clickPage','refresh','transactions|#bankCsvBtn'],['Privacidade','privacy','eye']]};
function renderDesktopModuleBar(){const root=$('#desktopModuleToolbar');if(!root)return;const page=PAGES.find(x=>x[0]===state.page)||PAGES[0],actions=desktopActionSets[state.page]||[];root.innerHTML=`<div class="desktop-module-title"><span>${icon(page[2])}</span><strong>${page[1]}</strong><small>Atalhos</small></div><div class="desktop-module-actions">${actions.map(([label,type,ic,arg=''])=>`<button type="button" class="desktop-module-action" data-desktop-action="${type}" ${type==='go'?'data-route="'+arg+'"':''} ${type==='open'?'data-kind="'+arg+'"':''} ${type==='filter'?'data-filter="'+arg+'"':''} ${type==='click'||type==='clickPage'?'data-target="'+arg+'"':''} ${type==='period'?'data-period="'+arg+'"':''} title="${label}">${icon(ic)}<span>${label}</span></button>`).join('')}</div>`}
const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').trim();
let searchResults=[];
function searchReserva(query){
  const terms=normalizeSearch(query).split(/\s+/).filter(Boolean);
  if(!terms.length)return [];
  const results=[];
  const add=(page,title,subtitle='',extra={})=>{
    if(!title||results.length>=25)return;
    const {keywords='',date='',...target}=extra;
    const text=normalizeSearch([title,subtitle,keywords,date,date?dateBR(date):''].join(' '));
    if(terms.every(term=>text.includes(term)))results.push({page,title,subtitle,date,...target});
  };
  for(const [page,label] of PAGES){
    add(page,label,'Módulo',{keywords:page==='calendar'?'agenda tarefas compromissos notas':page==='settings'?'configurações preferências':page==='transactions'?'receitas despesas movimentações':''});
    const module=document.getElementById('page-'+page);
    for(const el of module?.querySelectorAll('h2,h3,summary,button,legend,label')||[]){
      if(el.closest('[data-edit-record],[data-delete-record],[data-home-category],[data-home-report-category],dialog'))continue;
      const title=el.textContent.trim();
      if(title.length>90||!title||results.some(item=>item.page===page&&item.title===title))continue;
      add(page,title,label,{element:el});
    }
  }
  for(const r of db.records){
    if(results.length>=25)break;
    const title=r.note|| (r.kind==='income'?(r.source==='salary'?'Salário':'Renda complementar'):r.category);
    add('transactions',title,'Lançamento · '+dateBR(r.date),{id:r.id,date:r.date,keywords:[r.kind==='income'?'receita entrada':'despesa saída',r.category,r.subcategory,...(r.tags||[]),hideValues?'':money(r.amount)].join(' ')});
  }
  for(const [list,page,label,fields] of [
    [db.tasks,'calendar','Compromisso',['title','note','time']],
    [db.notes,'calendar','Nota',['text']],
    [db.recurring,'budget','Recorrência',['note','category']],
    [db.jars,'goals','Meta',['name']],
    [db.investments,'investments','Investimento',['name','institution','product']],
    [db.institutions,'settings','Instituição',['name','conglomerate']],
    [db.allocations,'goals','Movimentação de cofrinho',['note']]
  ]){
    for(const item of list){
      if(results.length>=25)break;
      const name=page==='goals'&&item.jarId?db.jars.find(jar=>jar.id===item.jarId)?.name:'';
      const date=item.date||item.dueDate||'';
      add(page,item[fields[0]]||name||item.category||label,label+(date?' · '+dateBR(date):''),{id:item.id,date,keywords:[name,...fields.map(field=>item[field])].join(' '),entity:label});
    }
  }
  return results;
}
function closeReservaSearch(){
  $('#reservaSearchResults').hidden=true;
  $('#reservaSearchInput').setAttribute('aria-expanded','false');
}
function renderReservaSearch(){
  $('#desktopNotificationPanel').hidden=true;
  $('#desktopNotificationBell').setAttribute('aria-expanded','false');
  const input=$('#reservaSearchInput'),panel=$('#reservaSearchResults');
  if(!input.value.trim()){closeReservaSearch();return}
  searchResults=searchReserva(input.value);
  panel.innerHTML=searchResults.length?searchResults.map((item,index)=>
    `<button type="button" data-reserva-search-index="${index}"><b>${esc(item.title)}</b><small>${esc(item.subtitle)}</small></button>`).join(''):'<p>Nenhum resultado encontrado.</p>';
  panel.hidden=false;
  input.setAttribute('aria-expanded','true');
}
function revealSearchTarget(target){
  if(!target)return;
  for(let parent=target.parentElement;parent;parent=parent.parentElement){
    if(parent.matches('details'))parent.open=true;
  }
  target.scrollIntoView({block:'center'});
  if(!target.matches('button,input,summary,a'))target.tabIndex=-1;
  target.focus({preventScroll:true});
}
function setViewDate(date){
  if(!validDate(date))return;
  state.year=Number(date.slice(0,4));
  state.month=Number(date.slice(5,7))-1;
  state.calendarDate=date;
}
function openReservaSearchResult(item){
  if(!item)return;
  closeReservaSearch();
  $('#reservaSearchInput').value='';
  if(item.date&&item.entity!=='Meta'&&['transactions','calendar','goals'].includes(item.page))setViewDate(item.date);
  if(item.page==='transactions'){
    state.txFilter='all';state.txSearch='';state.txTag='';state.txSubcategory='';state.txCategorySet=null;
  }
  const selectors={
    Meta:['data-edit-jar','data-restore-jar'],
    Investimento:['data-investment-edit'],
    Recorrência:['data-edit-recurring'],
    Compromisso:['data-task-edit'],
    Nota:['data-note-id'],
    Instituição:['data-institution'],
    'Movimentação de cofrinho':['data-delete-allocation']
  };
  const targetAttributes=selectors[item.entity]||['data-edit-record'];
  go(item.page);
  const root=document.getElementById('page-'+item.page);
  if(item.entity==='Nota')root?.querySelector('[data-calendar-tab="notes"]')?.click();
  if(item.entity==='Compromisso')root?.querySelector('[data-calendar-tab="agenda"]')?.click();
  if(item.id){
    const id=CSS.escape(item.id);
    const target=root?.querySelector(targetAttributes.map(attribute=>`[${attribute}="${id}"]`).join(','));
    if(target){revealSearchTarget(target);return}
  }
  if(item.element){
    const target=[...root.querySelectorAll(item.element.tagName)].find(el=>el.textContent.trim()===item.title);
    revealSearchTarget(target);
  }
}
document.addEventListener('input',event=>{if(event.target.id==='reservaSearchInput')renderReservaSearch()});
document.addEventListener('click',event=>{
  const result=event.target.closest('[data-reserva-search-index]');
  if(result){openReservaSearchResult(searchResults[Number(result.dataset.reservaSearchIndex)]);return}
  if(!event.target.closest('#reservaSearch'))closeReservaSearch();
});
$('#reservaSearchInput').addEventListener('focus',renderReservaSearch);
$('#reservaSearch').addEventListener('submit',event=>{event.preventDefault();openReservaSearchResult(searchResults[0])});
$('#reservaSearch').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeReservaSearch();$('#reservaSearchInput').focus()}
  if(!['ArrowDown','ArrowUp'].includes(event.key)||$('#reservaSearchResults').hidden)return;
  const buttons=[...$('#reservaSearchResults').querySelectorAll('button')];
  if(!buttons.length)return;
  event.preventDefault();
  const index=buttons.indexOf(document.activeElement);
  const next=event.key==='ArrowDown'?index+1:index<0?buttons.length-1:index-1;
  (buttons[next]||$('#reservaSearchInput')).focus();
});
const DESKTOP_NOTIFICATION_DISMISSAL_KEY=userKey('reserva.desktopNotifications.dismissed.v1');
function readDesktopNotificationDismissals(){try{return new Set(JSON.parse(localStorage.getItem(DESKTOP_NOTIFICATION_DISMISSAL_KEY)||'[]'))}catch{return new Set()}}
function desktopNotificationId(item){
  let hash=2166136261;
  for(let i=0;i<item.id.length;i++)hash=Math.imul(hash^item.id.charCodeAt(i),16777619);
  return (hash>>>0).toString(36);
}
function desktopNotificationItems(today=isoToday()){
  const items=[],year=Number(today.slice(0,4)),monthIndex=Number(today.slice(5,7))-1;
  const day=Number(today.slice(8)),lastDay=new Date(year,monthIndex+1,0).getDate();
  if(day===1||day===lastDay){
    const closingDate=day===1?shiftIso(today,-1):today;
    const [closingYear,closingMonth]=closingDate.split('-').map(Number);
    items.push({id:'close:'+today,kind:'reports',date:closingDate,title:'Fechamento do mês',
      detail:MONTHS[closingMonth-1]+' de '+closingYear+' · Abra o checklist em Relatórios',priority:-1});
  }
  const ignoredReserve=reserveIncomeIds(RESERVE_INCOME_IGNORED_KEY),discardedReserve=reserveIncomeIds(RESERVE_INCOME_DISCARDED_KEY);
  for(const r of getMonth(year,monthIndex).records.filter(r=>r.kind==='income'&&r.date<=today&&!ignoredReserve.has(String(r.id))&&!discardedReserve.has(String(r.id)))){
    const {remaining}=incomeReserveStatus(r);
    if(remaining>0)items.push({id:'reserve:'+r.id,kind:'reserve',date:r.date,title:r.source==='salary'?'Reserva do salário':'Reserva da renda complementar',detail:dateBR(r.date)+' · Falta '+money(remaining),priority:2});
  }
  for(const bill of upcomingBillInstances(7,today)){
    const phase=bill.daysLate?'late':bill.daysUntil===0?'today':'soon';
    const prefix={late:'Vencida: ',today:'Vence hoje: ',soon:'Vence em breve: '}[phase];
    items.push({id:'bill:'+bill.id+':'+bill.date+':'+phase,kind:'budget',date:bill.date,title:prefix+(bill.note||bill.category||'Conta'),detail:dateBR(bill.date)+' · '+money(bill.amount),priority:phase==='soon'?2:0});
  }
  for(const task of db.tasks.filter(item=>!item.done&&item.date<=shiftIso(today,7))){
    const phase=task.date<today?'late':task.date===today?'today':'soon';
    const prefix={late:'Compromisso atrasado: ',today:'Compromisso hoje: ',soon:'Compromisso: '}[phase];
    items.push({id:'task:'+task.id+':'+task.date+':'+phase,kind:'calendar',date:task.date,title:prefix+task.title,detail:dateBR(task.date)+(task.time?' · '+task.time:''),priority:phase==='soon'?3:0});
  }
  for(const goal of db.jars){
    if(goal.archived||goal.paused||goal.dueDate>shiftIso(today,7)||goal.dueDate<shiftIso(today,-7))continue;
    if(estimateCdbJar(goal.id).net+linkedInvestmentBalance(goal.id)>=goal.target)continue;
    const phase=goal.dueDate<today?'late':goal.dueDate===today?'today':'soon';
    const prefix={late:'Meta com prazo encerrado: ',today:'Meta vence hoje: ',soon:'Meta perto do prazo: '}[phase];
    items.push({id:'goal:'+goal.id+':'+goal.dueDate+':'+phase,kind:'goals',date:goal.dueDate,title:prefix+goal.name,detail:dateBR(goal.dueDate),priority:phase==='soon'?3:1,targetId:goal.id});
  }
  const period=mkey(year,monthIndex),records=getMonth(year,monthIndex).records;
  const budgets={...db.prefs.categoryBudgets};
  if(db.prefs.marketBudget>0)budgets.Mercado=db.prefs.marketBudget;
  for(const [category,limit] of Object.entries(budgets)){
    const spent=sum(records.filter(record=>record.kind==='expense'&&record.date<=today&&record.category===category).map(record=>record.amount));
    const warning=category==='Mercado'&&db.prefs.marketBudget>0 ? .75 : .8;
    if(limit>0&&spent>=limit*warning){
      const reached=spent>=limit;
      items.push({id:'budget:'+period+':'+category+':'+(reached?'limit':'near'),kind:'budget-limit',date:today,title:(reached?'Limite atingido: ':'Perto do limite: ')+category,detail:money(spent)+' de '+money(limit)+' usados',priority:reached?0:3,filter:'expense',category});
    }
  }
  const weekly=marketWeeklyStatus(today);
  for(const level of weekly.milestones){
    items.push({id:'market-week:'+weekly.start+':'+level,kind:'market-week',date:today,
      title:level===100&&weekly.spent>MARKET_WEEK_LIMIT?'Mercado: limite semanal ultrapassado':`Mercado: ${level}% do limite semanal`,
      detail:money(weekly.spent)+' de '+money(MARKET_WEEK_LIMIT)+' usados nesta semana',
      priority:level===100?0:2});
  }
  const dismissed=readDesktopNotificationDismissals();
  return items.sort((a,b)=>a.priority-b.priority).map(item=>({...item,dismissalId:desktopNotificationId(item)})).filter(item=>!dismissed.has(item.dismissalId));
}
function openDesktopNotification(item){
  if(item?.kind==='market-week'){go('budget');revealSearchTarget($('#marketWeeklyCard'));return}
  if(item?.kind==='budget'){setViewDate(item.date);go('budget');revealSearchTarget($('#budgetDueCard'));return}
  if(item?.kind==='budget-limit'){setViewDate(item.date);go('budget');revealSearchTarget($(item.category==='Mercado'?'#marketBudgetCard':'#categoryBudgetCard'));return}
  if(item?.kind==='calendar'){setViewDate(item.date);go('calendar')}else if(item?.kind==='reports'){setViewDate(item.date);go('reports');revealSearchTarget($('#monthlyCloseChecklist'))}else if(item?.kind==='goals'){go('goals');revealSearchTarget(document.querySelector(`[data-edit-jar="${CSS.escape(item.targetId)}"]`))}else if(item?.kind==='reserve'){setViewDate(item.date);go('goals');revealSearchTarget($('#incomeReserveCard'))}else if(item?.kind==='analysis'){setViewDate(item.date);go('analysis')}else if(item?.kind==='transactions'){setViewDate(item.date);state.txFilter=item.filter||'all';state.txSearch='';state.txTag='';state.txSubcategory='';state.txCategorySet=item.category?[item.category]:null;go('transactions')}
}
function renderDesktopNotifications(){const button=$('#desktopNotificationBell'),panel=$('#desktopNotificationPanel'),count=$('#desktopNotificationCount');if(!button||!panel)return;const items=desktopNotificationItems(),visible=items.slice(0,12);count.hidden=!items.length;count.textContent=items.length>9?'9+':String(items.length);panel.innerHTML=`<div class="notification-panel-head"><strong>Notificações</strong><span>${items.length} alerta${items.length===1?'':'s'}</span><button type="button" class="notification-clear" data-clear-desktop-notifications ${items.length?'':'disabled'}>Limpar todas</button></div>${visible.length?visible.map((x,i)=>`<button type="button" class="desktop-notification-item" data-notification-index="${i}"><i class="notification-dot ${x.priority===0?'urgent':''}"></i><span><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span><span class="notification-arrow">›</span></button>`).join(''):'<p class="notification-empty">Tudo em dia. Os próximos vencimentos e compromissos aparecerão aqui.</p>'}${items.length>visible.length?'<p class="notification-more">Mostrando 12 de '+items.length+' alertas.</p>':''}`;panel.dataset.dismissKeys=JSON.stringify(items.map(x=>x.dismissalId));panel.dataset.items=JSON.stringify(visible.map(({kind,date,filter,category,targetId})=>({kind,date,filter,category,targetId})))}
const mobileNavigationMedia=window.matchMedia('(max-width: 1023px), (max-width: 1366px) and (pointer: coarse)');
function usesMobileNavigation(){return mobileNavigationMedia.matches}
function syncDesktopHeaderControls(){
 const bar=$('.sidebar-control'),header=$('.header'),right=$('.header-right'),notifications=$('#desktopNotificationWrap'),intro=header?.querySelector('.header-intro'),titleBlock=bar?.querySelector('.page-title-block')||intro?.querySelector(':scope > div');
 if(!bar||!header||!right||!notifications||!intro||!titleBlock)return;
 titleBlock.classList.add('page-title-block');
 const desktop=!usesMobileNavigation();
 const titleTarget=desktop?bar:intro;
 if(titleBlock.parentElement!==titleTarget)titleTarget.insertBefore(titleBlock,titleTarget.firstChild);
 const controlTarget=desktop?bar:header;
 if(right.parentElement!==controlTarget)controlTarget.append(right);
 const notificationTarget=controlTarget;
 if(notifications.parentElement!==notificationTarget)notificationTarget.append(notifications);
}
const MOBILE_PRIMARY_MODULES=['home','transactions','budget'];
function moduleNavButton([id,label,ic],shortLabel=label){
 const selected=state.page===id;
 return `<button type="button" class="nav-button ${selected?'selected':''}" data-page="${id}" aria-label="${label}" title="${label}"${selected?' aria-current="page"':''}>${icon(ic)}<span class="nav-label">${label}</span><span class="nav-short">${shortLabel}</span></button>`;
}
function mobileDockMarkup(){
 const button=(id,label)=>moduleNavButton(PAGES.find(page=>page[0]===id),label);
 const otherSelected=state.page!=='settings'&&!MOBILE_PRIMARY_MODULES.includes(state.page);
 return [
   button('home','Hoje'),
   button('transactions','Mov.'),
   `<button type="button" id="quickAddButton" class="nav-button dock-register">${icon('plus')}<span class="nav-short">Registrar</span></button>`,
   button('budget','Orçamento'),
   `<button type="button" id="mobileMoreButton" class="nav-button ${otherSelected?'selected':''}" aria-haspopup="dialog" aria-controls="mobileMoreDialog">
     <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
     <span class="nav-short">Mais</span>
   </button>`
 ].join('');
}
function nav(){
 const desktopModules=PAGES.filter(([id])=>id!=='settings');
 $('#mobileNav').innerHTML=mobileDockMarkup();
 const more=$('#mobileMoreDialog .mobile-more-grid');
 if(more)more.innerHTML=PAGES.filter(([id])=>id!=='settings'&&!MOBILE_PRIMARY_MODULES.includes(id)).map(module=>moduleNavButton(module)).join('');
 $('#desktopNav').innerHTML=desktopModules.map(module=>moduleNavButton(module)).join('')+'<button class="nav-button" type="button" data-register-menu aria-label="Registrar" title="Registrar">'+icon('plus')+'<span class="nav-label">Registrar</span></button>'+PAGES.filter(([id])=>id==='settings').map(module=>moduleNavButton(module)).join('');syncSidebar();syncDesktopHeaderControls();const agendaButton=$('#headerCalendar');agendaButton?.classList.toggle('selected',state.page==='calendar');if(state.page==='calendar')agendaButton?.setAttribute('aria-current','page');else agendaButton?.removeAttribute('aria-current');const settings=$('#headerSettings');settings?.classList.toggle('selected',state.page==='settings');if(state.page==='settings')settings?.setAttribute('aria-current','page');else settings?.removeAttribute('aria-current');renderDesktopModuleBar();renderDesktopNotifications()}
document.addEventListener('click',event=>{
 const dialog=$('#mobileMoreDialog');
 if(event.target.closest('#mobileMoreButton')){if(dialog&&!dialog.open)dialog.showModal();return}
 if(dialog?.open&&(event.target===dialog||event.target.closest('[data-close-mobile-more]')))dialog.close();
});
function miniProgress(val,target){return `<div class="track"><span style="width:${target?Math.max(0,Math.min(100,val/target*100)):0}%"></span></div>`}
function recentTable(records,kind){const rows=records.filter(r=>r.kind===kind).sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<tr><td>${dateBR(r.date)}</td><td><b>${kind==='income'?(r.source==='salary'?'Salário':'Complemento'):esc(r.category)}</b><div class="sub">${esc(r.note||'Sem descrição')}</div></td><td class="money">${money(r.amount)}</td><td class="right"><div class="table-actions"><button class="edit" data-edit-record="${esc(r.id)}" aria-label="Editar lançamento">Editar</button><button class="delete" data-delete-record="${esc(r.id)}" aria-label="Excluir lançamento">Excluir</button></div></td></tr>`).join('');return rows?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>${kind==='income'?'Origem':'Categoria'}</th><th class="right">Valor</th><th class="right">Ação</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty"><strong>Nenhum registro neste mês</strong>Adicione ${kind==='income'?'seu salário ou complemento':'suas despesas'} para começar.</div>`}
function horizontalCategories(rows){const cats=new Map();for(const x of rows.filter(r=>r.kind==='expense'))cats.set(x.category,(cats.get(x.category)||0)+x.amount);return [...cats].sort((a,b)=>b[1]-a[1])}
function donutHTML(rows){const cats=horizontalCategories(rows);const total=sum(cats.map(x=>x[1]));if(!total)return '<div class="empty"><strong>Sem despesas registradas</strong>O gráfico aparecerá quando você registrar seus gastos.</div>';let acc=0;const stops=cats.map(([name,amt])=>{const start=acc;acc+=amt/total*100;return `${CAT_COLORS[CATS.indexOf(name)]||'#acbdc0'} ${start}% ${acc}%`}).join(',');return `<div class="donut-row"><div class="donut" style="background:conic-gradient(${stops})"><b><small>Gastos do mês</small>${money(total)}</b></div><div class="legend-list">${cats.slice(0,5).map(([name,amt])=>`<div class="category-item"><span><i class="color" style="background:${CAT_COLORS[CATS.indexOf(name)]||'#8c9bab'}"></i>${esc(name)}</span><strong>${percent(amt/total*100)}</strong></div>`).join('')}</div></div>`}
function yearChart(){const arr=yearly(state.year);const mx=Math.max(1,...arr.flatMap(a=>[a.income,a.expenses,Math.max(0,a.saved)]));const series=[['income','Renda','#3488f5'],['expense','Despesas','#e9a26e'],['saving','Reserva','#7a75e7']];const bars=arr.map((v,i)=>`<div class="chart-month" title="${MONTHS[i]}: renda ${money(v.income)}, despesas ${money(v.expenses)}, guardado ${money(v.saved)}"><div class="chart-bars">${series.map(([cl],ix)=>{const n=[v.income,v.expenses,Math.max(0,v.saved)][ix];return `<i class="${cl}" style="height:${Math.max(1,n/mx*100)}%"></i>`}).join('')}</div><small>${MONTHS[i].slice(0,3)}</small></div>`).join('');return `<div class="chart-wrap" role="img" aria-label="Comparação mensal entre renda, despesas e reserva em ${state.year}">${bars}</div><div class="legend">${series.map(([_,label,color])=>`<span><i class="dot" style="background:${color}"></i>${label}</span>`).join('')}</div>`}
function marketBudgetCard(monthData) {
  const budget=db.prefs.marketBudget;
  const spent=sum(monthData.records.filter(r=>r.kind==='expense'&&r.category==='Mercado').map(r=>r.amount));
  const milestone=budget?[100,75,50,25].find(level=>spent*100>=budget*level):undefined;
  const warning=milestone>=75;
  const message=!budget?'Sem cota definida':spent>budget?'Cota ultrapassada':spent===budget?'Cota atingida':milestone?`Você atingiu ${milestone}% da cota${warning?' · Gasto alto':''}`:'Abaixo de 25% da cota';
  return `<article id="marketBudgetCard" class="card market-budget ${warning?'market-warning':''}"><h2>Cota de Mercado</h2>
  <p><strong>${message}</strong></p><p>${money(spent)} gastos${budget?' de '+money(budget):''} em ${esc(monthLabel())}.</p>
  ${budget?`<p>${spent>budget?'Acima da cota':'Disponível na cota'}: ${money(Math.abs(budget-spent))}</p>`:''}
  <form data-market-budget-form><label class="field">Cota mensal (R$)<input name="budget" type="number" min="0.01" max="100000000" step="0.01" placeholder="Sem limite" value="${hideValues||!budget?'':(budget/100).toFixed(2)}"></label><button class="btn" type="submit">Salvar cota</button>${budget?'<button class="btn" type="submit" value="clear">Remover cota</button>':''}</form></article>`;
}
document.addEventListener('submit',async event=>{
  if(!event.target.matches('[data-market-budget-form]'))return;
  event.preventDefault();
  if(event.submitter?.value==='clear'){
    if(await mutate(()=>{db.prefs.marketBudget=null}))notify('Cota de Mercado removida.');
    return;
  }
  const budget=toCents(event.target.elements.namedItem('budget').value);
  if(!Number.isSafeInteger(budget)||budget<=0||budget>10000000000)return notify('Informe uma cota mensal válida.');
  if(await mutate(()=>{db.prefs.marketBudget=budget}))notify('Cota mensal de Mercado atualizada.');
});
function categoryBudgetCard(monthData) {
  const budgets=db.prefs.categoryBudgets||{}, categories=Object.entries(budgets).filter(([category])=>category!=='Mercado').sort(([a],[b])=>CATS.indexOf(a)-CATS.indexOf(b));
  const spentFor=category=>sum(monthData.records.filter(r=>r.kind==='expense'&&r.category===category).map(r=>r.amount));
  const rows=categories.map(([category,budget])=>{const spent=spentFor(category),ratio=spent/budget*100,over=spent>budget,warning=ratio>=75;return `<div class="category-budget-row ${warning?'market-warning':''}"><div class="category-budget-head"><span><strong>${esc(category)}</strong><small>${money(spent)} de ${money(budget)} · ${over?'acima do limite: '+money(spent-budget):'restam '+money(budget-spent)}</small></span><b>${percent(ratio)}</b><button class="btn small" type="button" data-category-budget-remove="${esc(category)}" aria-label="Remover limite de ${esc(category)}">Remover</button></div><progress max="${budget}" value="${Math.min(spent,budget)}" aria-label="${esc(category)}: ${percent(ratio)} do limite"></progress>${over?'<p class="budget-alert">Limite mensal ultrapassado.</p>':warning?'<p class="budget-alert">Atenção: você já utilizou pelo menos 75% do limite.</p>':''}</div>`});
  return `<article id="categoryBudgetCard" class="card category-budget"><h2>Orçamento mensal por categoria</h2><p>Os limites se repetem a cada mês e acompanham o mês selecionado.</p><form data-category-budget-form class="category-budget-form"><label class="field">Categoria<select name="category">${CATS.filter(c=>c!=='Mercado').map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label class="field">Limite mensal (R$)<input name="budget" type="number" min="0.01" max="100000000" step="0.01" required placeholder="Ex.: 500,00"></label><button class="btn primary" type="submit">Salvar limite</button></form>${rows.length?`<div class="category-budget-list">${rows.join('')}</div>`:'<div class="empty">Adicione limites para acompanhar os gastos e receber avisos ao chegar a 75% ou ultrapassar o valor.</div>'}</article>`;
}
document.addEventListener('submit',async event=>{
  if(!event.target.matches('[data-category-budget-form]'))return;
  event.preventDefault();
  const category=String(event.target.elements.namedItem('category').value),budget=toCents(event.target.elements.namedItem('budget').value);
  if(!CATS.includes(category)||!Number.isSafeInteger(budget)||budget<=0||budget>10000000000)return notify('Informe uma categoria e um limite mensal válidos.');
  if(await mutate(()=>{db.prefs.categoryBudgets={...(db.prefs.categoryBudgets||{}),[category]:budget}}))notify(`Limite de ${category} atualizado.`);
});
document.addEventListener('click',event=>{const clear=event.target.closest('[data-clear-desktop-notifications]');if(!clear)return;const panel=$('#desktopNotificationPanel');let keys=[];try{keys=JSON.parse(panel?.dataset.dismissKeys||'[]')}catch{}const dismissed=readDesktopNotificationDismissals();for(const key of keys)dismissed.add(key);try { localStorage.setItem(DESKTOP_NOTIFICATION_DISMISSAL_KEY,JSON.stringify([...dismissed])); } catch { notify('Não foi possível salvar a limpeza das notificações neste navegador.'); return; } renderDesktopNotifications();$('#desktopNotificationBell')?.focus();notify('Notificações limpas. Compromissos e lançamentos continuam salvos.')});
document.addEventListener('click',event=>{const bell=event.target.closest('#desktopNotificationBell');if(bell){renderDesktopNotifications();const panel=$('#desktopNotificationPanel');panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));return}if(!event.target.closest('#desktopNotificationWrap')&&$('#desktopNotificationPanel')){$('#desktopNotificationPanel').hidden=true;$('#desktopNotificationBell')?.setAttribute('aria-expanded','false')}const note=event.target.closest('[data-notification-index]');if(note){const items=JSON.parse($('#desktopNotificationPanel').dataset.items||'[]'),item=items[Number(note.dataset.notificationIndex)];openDesktopNotification(item);$('#desktopNotificationPanel').hidden=true;return}const action=event.target.closest('[data-desktop-action]');if(action){const type=action.dataset.desktopAction;if(type==='quick'){openQuickAdd();return}if(type==='go'){go(action.dataset.route);return}if(type==='open'){openModal(action.dataset.kind);return}if(type==='filter'){state.txFilter=action.dataset.filter;go('transactions');return}if(type==='period'){localStorage.setItem(userKey('reserva.home.period'),action.dataset.period);go('home');return}if(type==='today'){const d=new Date();state.year=d.getFullYear();state.month=d.getMonth();go('calendar');return}if(type==='deposit'){openDepositPicker();return}if(type==='investment'||type==='investmentExisting'){go('investments');requestAnimationFrame(()=>document.querySelector('[data-investment-edit=""]'+(type==='investmentExisting'?'[data-existing="true"]':''))?.click());return}if(type==='privacy'){hideValues=!hideValues;localStorage.setItem(userKey('reserva.hideValues'),String(hideValues));render();return}if(type==='task'){const d=new Date();state.year=d.getFullYear();state.month=d.getMonth();state.calendarDate=isoToday();go('calendar');requestAnimationFrame(()=>$('#calendarTaskForm input[name="title"]')?.focus());return}if(type==='click'||type==='clickPage'){const [route,selector]=type==='clickPage'?action.dataset.target.split('|'):[state.page,action.dataset.target];if(route!==state.page)go(route);requestAnimationFrame(()=>document.querySelector(selector)?.click());return}}});
document.addEventListener('click',event=>{
 const mode=event.target.closest('[data-home-chart-mode]');if(mode){event.preventDefault();event.stopImmediatePropagation();localStorage.setItem(userKey('reserva.home.categoryView'),mode.dataset.homeChartMode);budget();return}
 const homePeriod=event.target.closest('[data-home-period]');if(homePeriod){localStorage.setItem(userKey('reserva.home.period'),homePeriod.dataset.homePeriod);home();return}
 const category=event.target.closest('[data-home-category],[data-home-report-category]');if(category){event.preventDefault();event.stopImmediatePropagation();state.txFilter='expense';state.txSearch='';state.txTag='';state.txSubcategory='';const raw=category.dataset.homeCategory||category.dataset.homeReportCategory||'';if(raw==='__all'){try{state.txCategorySet=JSON.parse(decodeURIComponent(category.dataset.homeCategoryList||'%5B%5D'))}catch{state.txCategorySet=[]}}else state.txCategorySet=raw?[raw]:null;go('transactions');return}
 const action=event.target.closest('[data-home-action]');if(!action)return;
 event.preventDefault();event.stopImmediatePropagation();
 switch(action.dataset.homeAction){
  case 'detail':state.txFilter=action.dataset.filter||'all';state.txTag='';state.txSubcategory='';state.txSearch='';go(action.dataset.route||'transactions');break;
  case 'new':if(action.dataset.kind==='task'){openCalendarCompose(shiftIso(isoToday(),Number(action.dataset.dayOffset)||0))}else if(action.dataset.kind==='investments')go('investments');else if(action.dataset.kind==='jar')openModal('jar');else openModal(action.dataset.kind||'expense');break;
  case 'module':go(action.dataset.route||'home');break;
  case 'editBudget':action.closest('.market-budget')?.querySelector('[data-market-budget-form] input[name=budget]')?.focus();break;
  case 'planning':go('goals');requestAnimationFrame(()=>$('#planningSettingsDetails')?.setAttribute('open',''));break;
  case 'report':go('reports');break;
  case 'period':localStorage.setItem(userKey('reserva.home.period'),action.dataset.period||'month');home();break;
  case 'refreshHome':home();break;
  case 'depositPicker':openDepositPicker();break;
  case 'completeTask':if(action.dataset.taskId)toggleCalendarTask(action.dataset.taskId).then(home);break;
  case 'editTask':{const task=db.tasks.find(x=>x.id===action.dataset.taskId);if(task){state.year=Number(task.date.slice(0,4));state.month=Number(task.date.slice(5,7))-1;state.calendarDate=task.date;go('calendar');requestAnimationFrame(()=>editCalendarTask(task.id))}break}
  case 'deleteTask':if(action.dataset.taskId)deleteCalendarTask(action.dataset.taskId).then(home);break;
  case 'chartMode':action.closest('.home-category-card')?.querySelector('[data-home-chart-mode="'+action.dataset.mode+'"]')?.click();break;
  case 'calendar':{const date=action.dataset.date||isoToday(),d=new Date(date+'T12:00:00');state.year=d.getFullYear();state.month=d.getMonth();state.calendarDate=date;go('calendar');break}
  case 'insights':go('analysis');break;
  case 'privacy':hideValues=!hideValues;localStorage.setItem(userKey('reserva.hideValues'),String(hideValues));render();break;
  case 'csv':csv();break;
 }
});

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-category-budget-remove]');
  if(!button)return;
  const category=button.dataset.categoryBudgetRemove;
  if(await mutate(()=>{const budgets={...(db.prefs.categoryBudgets||{})};delete budgets[category];db.prefs.categoryBudgets=budgets}))notify(`Limite de ${category} removido.`);
});

function openCalendarDayOverlay(){const detail=$('#page-calendar .calendar-detail');if(!detail)return;let dialog=$('#calendarDayDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='calendarDayDialog';dialog.className='calendar-day-dialog';dialog.setAttribute('aria-label','Agenda do dia');dialog.innerHTML='<div class="calendar-day-dialog-top"><strong>Agenda do dia</strong><button type="button" data-close-calendar-day>Fechar</button></div><div id="calendarDayDialogContent" class="calendar-day-dialog-content"></div>';dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});document.body.append(dialog)}const content=$('#calendarDayDialogContent');if(content)content.innerHTML=detail.innerHTML;if(!dialog.open)dialog.showModal()}
function homeCalendarPreview(){
  const today=isoToday(), key=mkey(state.year,state.month);
  const events=calendarEventsForMonth(state.year,state.month);
  const {expensesByDay,highestDailyExpense,levelFor}=calendarSpending(events);
  const notes=new Set(calendarNotes().map(note=>note.date));
  const days=new Date(state.year,state.month+1,0).getDate();
  const offset=(new Date(state.year,state.month,1).getDay()+6)%7;
  const cells=Array.from({length:days},(_,index)=>{
    const day=index+1, date=key+'-'+String(day).padStart(2,'0');
    const dayEvents=events.get(date)||[], count=dayEvents.length, hasNotes=notes.has(date);
    const expense=expensesByDay.get(date),heat=levelFor(date);
    const label=[dateBR(date), expense&&!hideValues?'Despesas: '+money(expense):'', count?count+' evento(s)':'', hasNotes?'com notas':'', ...dayEvents.slice(0,3).map(event=>event.title)].filter(Boolean).join(' · ');
    return `<button type="button" data-open-calendar-date="${date}" ${heat?`data-expense-heat="${heat}"`: ''} class="home-calendar-day${date===today?' is-today':''}" aria-label="${esc(label)}" title="${esc(label)}" ${date===today?'aria-current="date"':''}>${day}</button>`;
  }).join('');
  return `<article class="card home-calendar-preview">
    <div class="card-head"><div><h2>Calendário</h2><p>${esc(monthLabel())}</p></div>
    <button type="button" class="btn small" data-page="calendar">Abrir calendário</button></div>
    <div class="home-calendar-grid" aria-label="Resumo mensal do calendário">
      ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(day=>'<b>'+day+'</b>').join('')}
      ${'<span aria-hidden="true"></span>'.repeat(offset)}${cells}
    </div>
    <div class="home-calendar-key"><small>Cores mais fortes indicam mais gastos no mês.</small>${highestDailyExpense?`<span class="calendar-heat-legend" aria-hidden="true"><small>Menos</small>${[1,2,3,4,5].map(level=>`<i data-heat-level="${level}"></i>`).join('')}<small>Mais</small></span>`:'<small>Sem despesas registradas.</small>'}</div>
  </article>`;
}
function upcomingCommitmentsCard(){const today=isoToday(),upcoming=db.tasks.filter(task=>!task.done&&task.date>=today).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')).slice(0,4),total=db.tasks.filter(task=>!task.done&&task.date>=today).length;const content=upcoming.length?`<div class="home-agenda-list">${upcoming.map(task=>`<button type="button" class="home-agenda-item" data-open-calendar-date="${task.date}"><span class="home-agenda-color" style="--task-color:${calendarTaskColor(task.color)}"></span><span class="home-agenda-copy"><b>${esc(task.title)}</b><small>${dateBR(task.date)}${task.time?' · '+esc(task.time):''}${task.note?' · '+esc(task.note):''}</small></span><span class="home-agenda-arrow" aria-hidden="true">›</span></button>`).join('')}</div>`:`<p class="home-agenda-empty">Agenda livre por enquanto. Adicione compromissos para se organizar por aqui.</p>`;return `<article class="card home-agenda-card" id="upcomingCommitmentsCard"><div class="home-agenda-head"><div><h2>Próximos compromissos</h2><p>${total?`${total} compromisso${total===1?'':'s'} pendente${total===1?'':'s'}`:'Organize suas tarefas e compromissos futuros'}</p></div><div class="actions"><button type="button" class="btn small primary" data-calendar-new-task data-home-new-task>Novo compromisso</button><button type="button" class="btn small" data-page="calendar">Abrir agenda</button></div></div>${content}</article>`}

function categorySpendCard(m){
 const rows=horizontalCategories(m.records),total=rows.reduce((n,x)=>n+x[1],0),mode=localStorage.getItem(userKey('reserva.home.categoryView'))||'distribution';
 const colors=rows.map(([cat])=>CAT_COLORS[CATS.indexOf(cat)]||'#8c9bab');let cursor=0;
 const slices=rows.map((x,i)=>{const from=cursor;cursor+=total?x[1]/total*100:0;return colors[i]+' '+from.toFixed(2)+'% '+cursor.toFixed(2)+'%'}).join(',');
 let py=state.year,pm=state.month-1;if(pm<0){pm=11;py--}const previous=horizontalCategories(getMonth(py,pm).records),before=new Map(previous);
 const body=mode==='distribution'
  ?(rows.length?'<div class="home-category-layout"><div class="home-category-donut" style="--spend-chart:conic-gradient('+slices+')"><div><small>Total de gastos</small><strong>'+money(total)+'</strong></div></div><div class="home-category-legend">'+rows.slice(0,5).map(([name,value],i)=>'<button type="button" class="home-category-row" data-home-category="'+esc(name)+'"><i style="--category-color:'+colors[i]+'"></i><span>'+esc(name)+'</span><strong>'+percent(value/total*100)+'</strong><small>'+money(value)+'</small></button>').join('')+(rows.length>5?'<button type="button" class="home-category-row" data-home-category="__all" data-home-category-list="'+encodeURIComponent(JSON.stringify(rows.slice(5).map(([name])=>name)))+'"><i style="--category-color:#8c9bab"></i><span>Outras categorias</span><strong>'+percent(rows.slice(5).reduce((n,x)=>n+x[1],0)/total*100)+'</strong><small>'+money(rows.slice(5).reduce((n,x)=>n+x[1],0))+'</small></button>':'')+'</div></div>':'<div class="empty-inline">Registre despesas para ver a distribuição por categoria.</div>')
  :(rows.length||previous.length?'<div class="home-category-trend">'+[...new Set([...rows.map(x=>x[0]),...previous.map(x=>x[0])])].map(name=>({name,current:rows.find(x=>x[0]===name)?.[1]||0,previous:before.get(name)||0})).sort((a,b)=>Math.abs(b.current-b.previous)-Math.abs(a.current-a.previous)).slice(0,6).map(x=>{const diff=x.current-x.previous,pct=x.previous?diff/x.previous*100:null;return '<button type="button" class="home-category-trend-row" data-home-category="'+esc(x.name)+'"><span><b>'+esc(x.name)+'</b><small>'+money(x.current)+' agora · '+money(x.previous)+' antes</small></span><strong class="'+(diff>0?'trend-up':diff<0?'trend-down':'')+'">'+(diff>0?'↑ ':diff<0?'↓ ':'= ')+(pct===null?(diff?'sem base':percent(0)):percent(Math.abs(pct)))+'</strong></button>'}).join('')+'</div>':'<div class="empty-inline">Ainda não há despesas para comparar com o mês anterior.</div>');
 return '<article id="budgetSpendingCard" class="card home-category-card"><div class="home-category-head"><div><h2>Gastos por categoria</h2><p>'+esc(monthLabel())+' · '+(mode==='distribution'?'distribuição do mês':'comparação com o mês anterior')+'</p></div><div class="home-category-toggle" role="group" aria-label="Visualização dos gastos"><button type="button" data-home-chart-mode="distribution" class="'+(mode==='distribution'?'selected':'')+'" aria-label="Distribuição dos gastos" title="Distribuição">◔</button><button type="button" data-home-chart-mode="comparison" class="'+(mode==='comparison'?'selected':'')+'" aria-label="Comparar com o mês anterior" title="Comparar evolução">↗</button></div></div>'+body+'</article>'
}
function homeForecastCard(){const today=isoToday(),key=mkey(state.year,state.month),records=db.records.filter(r=>r.date.slice(0,7)===key),pastIncome=sum(records.filter(r=>r.kind==='income'&&r.date<=today).map(r=>r.amount)),pastExpense=sum(records.filter(r=>r.kind==='expense'&&r.date<=today).map(r=>r.amount)),futureIncome=sum(records.filter(r=>r.kind==='income'&&r.date>today).map(r=>r.amount)),futureExpense=sum(records.filter(r=>r.kind==='expense'&&r.date>today).map(r=>r.amount));let recurringIncome=0,recurringExpense=0;for(const t of db.recurring.filter(x=>!x.paused&&x.startMonth<=key&&(!x.endMonth||x.endMonth>=key))){const d=Math.min(t.day,new Date(state.year,state.month+1,0).getDate()),date=key+'-'+String(d).padStart(2,'0');if(date<=today)continue;const exists=db.records.some(r=>r.recurringId===t.id&&(r.recurringMonth||r.date.slice(0,7))===key);if(exists)continue;if(t.kind==='income')recurringIncome+=t.amount;else recurringExpense+=t.amount}const projectedIncome=pastIncome+futureIncome+recurringIncome,projectedExpense=pastExpense+futureExpense+recurringExpense,max=Math.max(projectedIncome,projectedExpense,1),bar=(label,actual,projected,color)=>`<div class="forecast-row"><div><span>${label}</span><b>${money(actual)} <small>realizado</small></b><b>${money(projected)} <small>previsto</small></b></div><div class="forecast-track"><i style="width:${Math.min(100,projected/max*100)}%;background:${color}"></i><em style="width:${Math.min(100,actual/max*100)}%"></em></div></div>`;return `<article class="card home-forecast-card"><div class="card-head"><div><h2>Previsto × realizado</h2><p>${esc(monthLabel())} · inclui lançamentos futuros e recorrências ainda não lançadas</p></div></div>${bar('Receitas',pastIncome,projectedIncome,'var(--success)')}${bar('Despesas',pastExpense,projectedExpense,'var(--danger)')}<p class="help">Estimativa baseada somente nos registros e recorrências cadastrados.</p></article>`}
function homePeriodMetrics(){
 const today=isoToday(),mode=localStorage.getItem(userKey('reserva.home.period'))||'month';let start,end,label,prevStart,prevEnd,compareLabel;
 if(mode==='today'){start=end=today;label='Hoje';prevStart=prevEnd=shiftIso(today,-1);compareLabel='ontem'}
 else if(mode==='7d'){end=today;start=shiftIso(today,-6);label='Últimos 7 dias';prevEnd=shiftIso(start,-1);prevStart=shiftIso(start,-7);compareLabel='7 dias anteriores'}
 else if(mode==='12m'){const d=new Date(today+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()-11);start=d.toISOString().slice(0,10);end=today;label='Últimos 12 meses';const span=Math.max(1,Math.round((new Date(end+'T12:00:00')-new Date(start+'T12:00:00'))/86400000)+1);prevEnd=shiftIso(start,-1);prevStart=shiftIso(start,-span);compareLabel='12 meses anteriores'}
 else if(mode==='custom'){const a=localStorage.getItem(userKey('reserva.home.from'))||today,b=localStorage.getItem(userKey('reserva.home.to'))||today;start=a<=b?a:b;end=a<=b?b:a;label='Período personalizado';const span=Math.max(1,Math.round((new Date(end+'T12:00:00')-new Date(start+'T12:00:00'))/86400000)+1);prevEnd=shiftIso(start,-1);prevStart=shiftIso(start,-span);compareLabel='período imediatamente anterior'}
 else{start=`${state.year}-${String(state.month+1).padStart(2,'0')}-01`;const currentMonth=today.slice(0,7)===mkey(state.year,state.month),lastDay=new Date(state.year,state.month+1,0).getDate();end=currentMonth?today:`${mkey(state.year,state.month)}-${String(lastDay).padStart(2,'0')}`;label=currentMonth?`${monthLabel()} até hoje`:monthLabel();const prev=new Date(state.year,state.month-1,1),prevKey=mkey(prev.getFullYear(),prev.getMonth()),prevLast=new Date(prev.getFullYear(),prev.getMonth()+1,0).getDate(),endDay=Number(end.slice(8,10));prevStart=prevKey+'-01';prevEnd=prevKey+'-'+String(currentMonth?Math.min(endDay,prevLast):prevLast).padStart(2,'0');compareLabel=currentMonth?'mesmo período do mês anterior':'mês anterior'}
 const aggregate=(from,to)=>{const rows=db.records.filter(r=>r.date>=from&&r.date<=to),categoryExpenses={};for(const row of rows)if(row.kind==='expense'){const category=String(row.category||'Outros');categoryExpenses[category]=(categoryExpenses[category]||0)+row.amount}return{income:sum(rows.filter(x=>x.kind==='income').map(x=>x.amount)),expenses:sum(rows.filter(x=>x.kind==='expense').map(x=>x.amount)),categoryExpenses}};
 return{mode,start,end,label,compareLabel,...aggregate(start,end),previous:aggregate(prevStart,prevEnd)}
}
function periodChangeText(value,previous,kind){
 const abs=money(Math.abs(value)),pct=previous>0?` (${percent(Math.abs(value)/previous*100)})`:'';
 if(value===0)return `${kind} ficaram iguais`;
 const verb=kind==='receitas'?(value>0?'subiram':'caíram'):(value>0?'aumentaram':'diminuíram');
 return `${kind} ${verb} ${abs}${pct}`;
}
function homePeriodExplanation(period){
 const currentResult=period.income-period.expenses,previousResult=period.previous.income-period.previous.expenses,resultDelta=currentResult-previousResult;
 const categoryChanges=Object.keys({...period.previous.categoryExpenses,...period.categoryExpenses}).map(category=>({category,delta:(period.categoryExpenses[category]||0)-(period.previous.categoryExpenses[category]||0),before:period.previous.categoryExpenses[category]||0,now:period.categoryExpenses[category]||0})).filter(item=>item.delta!==0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
 const driver=categoryChanges[0];
 const resultText=resultDelta===0?'o resultado ficou igual':`o resultado ${resultDelta>0?'melhorou':'caiu'} ${money(Math.abs(resultDelta))}`;
 const driverText=driver?driver.before===0?`Maior mudança nos gastos: começou registro em ${esc(driver.category)} (${money(driver.now)}).`:`Maior mudança nos gastos: ${esc(driver.category)} ${driver.delta>0?'aumentou':'diminuiu'} ${money(Math.abs(driver.delta))}.`:'Registre despesas nos períodos comparados para destacar o que mudou por categoria.';
 return `<strong>Comparação com ${esc(period.compareLabel)}:</strong><p>${periodChangeText(period.income-period.previous.income,period.previous.income,'receitas')}; ${periodChangeText(period.expenses-period.previous.expenses,period.previous.expenses,'despesas')}; ${resultText}.</p><small>${driverText}</small>`;
}
function homePeriodControls(){const d=homePeriodMetrics(),options=[['today','Hoje'],['7d','7 dias'],['month','Mês'],['12m','12 meses'],['custom','Personalizado']];return `<div class="dashboard-period-control"><span>Período do painel</span><div class="dashboard-period-tabs">${options.map(([key,text])=>`<button type="button" data-home-period="${key}" class="${d.mode===key?'selected':''}" aria-pressed="${d.mode===key}">${text}</button>`).join('')}</div>${d.mode==='custom'?`<form class="dashboard-custom-period" id="homeCustomPeriodForm"><label>De <input type="date" name="from" value="${esc(d.start)}" required></label><label>Até <input type="date" name="to" value="${esc(d.end)}" required></label><button type="submit" class="btn small">Aplicar</button></form>`:''}</div>`}
function homeTrendCard(){const today=new Date(),months=[];for(let i=11;i>=0;i--){const d=new Date(today.getFullYear(),today.getMonth()-i,1),y=d.getFullYear(),m=d.getMonth(),rows=db.records.filter(r=>r.date.startsWith(mkey(y,m))),income=sum(rows.filter(r=>r.kind==='income').map(r=>r.amount)),expense=sum(rows.filter(r=>r.kind==='expense').map(r=>r.amount));months.push({label:MONTHS[m].slice(0,3),income,expense})}const max=Math.max(1,...months.flatMap(x=>[x.income,x.expense]));return `<article class="card home-trend-card"><div class="card-head"><div><h2>Fluxo mês a mês</h2><p>Receitas e despesas registradas nos últimos 12 meses</p></div><span class="trend-legend"><i></i>Receitas <b></b>Despesas</span></div><div class="trend-bars" role="img" aria-label="Gráfico comparando receitas e despesas nos últimos 12 meses">${months.map(x=>`<div class="trend-month" title="${x.label}: receitas ${money(x.income)}, despesas ${money(x.expense)}"><div class="trend-pair"><i style="height:${Math.max(x.income?3:0,x.income/max*100)}%"></i><b style="height:${Math.max(x.expense?3:0,x.expense/max*100)}%"></b></div><small>${x.label}</small></div>`).join('')}</div></article>`}
function homeSmartFinanceCard(m){const budgets=Object.entries(db.prefs.categoryBudgets||{}).filter(([c])=>c!=='Mercado').sort(([a],[b])=>CATS.indexOf(a)-CATS.indexOf(b)).map(([category,limit])=>({category,limit,spent:sum(m.records.filter(r=>r.kind==='expense'&&r.category===category).map(r=>r.amount))}));const watched=budgets.filter(x=>x.spent>=x.limit*.8),cardRecords=m.records.filter(r=>r.kind==='expense'&&r.category==='Cartões').sort((a,b)=>b.date.localeCompare(a.date)),cardSpent=sum(cardRecords.map(r=>r.amount)),cardPending=upcomingBillInstances(30).filter(x=>x.category==='Cartões').slice(0,3),installments=m.records.filter(r=>r.kind==='expense'&&r.category==='Cartões'&&/\b\d{1,2}\s*\/\s*\d{1,2}\b/.test(r.note||'')).slice(-3).reverse();const status=watched.length?`${watched.length} limite${watched.length===1?'':'s'} perto de atingir`:'Nenhum limite perto de atingir';return `<article class="card home-smart-finance-card"><div class="card-head"><div><h2>Limites, cartões e parcelas</h2><p>${esc(monthLabel())} · acompanhamento dos registros existentes</p></div><button type="button" class="btn small" data-home-budget>Gerenciar limites</button></div><div class="actions home-finance-actions"><button type="button" class="btn small primary" data-home-finance-entry="card">Registrar gasto com cartão</button></div><div class="smart-mobile-summary"><b>${status}</b><span>Cartões: ${money(cardSpent)} no mês${cardPending.length?' · '+cardPending.length+' conta(s) fixa(s) próxima(s)':''}</span><div class="smart-mobile-actions"><button type="button" class="text-link" data-page="transactions" data-tx-set="expense">Ver despesas</button><button type="button" class="text-link" data-page="calendar">Ver vencimentos</button></div></div>${cardRecords.length?'<div class="home-card-records"><h3>Gastos com cartão · '+esc(monthLabel())+'</h3>'+cardRecords.slice(0,3).map(record=>`<button type="button" class="smart-due-row" data-edit-record="${esc(record.id)}"><span>${dateBR(record.date)} · ${esc(record.note||'Gasto com cartão')}</span><strong>${money(record.amount)}</strong></button>`).join('')+'<button type="button" class="text-link" data-home-category="Cartões">Ver todos os gastos com cartão</button></div>':'<p class="help">Nenhum gasto com cartão registrado neste mês.</p>'}<div class="smart-detail-grid"><section class="smart-detail-section"><h3>Limites por categoria</h3>${budgets.length?budgets.map(x=>{const ratio=Math.round(x.spent/x.limit*100),alert=ratio>=100;return `<div class="smart-budget-row"><div><span><b>${esc(x.category)}</b><small>${money(x.spent)} de ${money(x.limit)}</small></span><strong class="${alert?'danger-text':ratio>=80?'warning-text':''}">${percent(ratio)}</strong></div><progress max="${x.limit}" value="${Math.min(x.spent,x.limit)}"></progress></div>`}).join(''):'<p class="help">Nenhum limite por categoria cadastrado. Configure em Metas para acompanhar os alertas aqui.</p>'}</section><section class="smart-detail-section"><h3>Gastos com cartões</h3><div class="smart-card-spend"><strong>${money(cardSpent)}</strong><small>Despesas classificadas como Cartões neste mês</small></div>${cardPending.length?`<h4>Contas recorrentes de cartão</h4>${cardPending.map(x=>`<button class="smart-due-row" type="button" data-open-calendar-date="${x.date}"><span>${dateBR(x.date)} · ${esc(x.note||'Conta recorrente')}</span><strong>${money(x.amount)}</strong></button>`).join('')}`:'<p class="help">Sem conta recorrente de cartão prevista nos próximos 30 dias.</p>'}${installments.length?`<h4>Parcelas identificadas nas descrições</h4>${installments.map(x=>{const match=(x.note||'').match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);return `<div class="smart-installment-row"><span>${esc(x.note)}<small>Parcela ${match[1]} de ${match[2]} · ${dateBR(x.date)}</small></span><strong>${money(x.amount)}</strong></div>`}).join('')}<p class="help">Identificação baseada no texto do lançamento; não representa uma fatura oficial do cartão.</p>`:'<p class="help">Informe “3/10” na descrição para identificar uma parcela.</p>'}</section></div></article>`}
const mobileHomeLayout=matchMedia('(max-width:760px)');
const mobileHomeOpen=()=>mobileHomeLayout.matches?'':'open';
mobileHomeLayout.addEventListener('change',()=>{
 for(const disclosure of document.querySelectorAll('.mobile-home-disclosure'))disclosure.open=!mobileHomeLayout.matches;
});
document.addEventListener('click', event=>{
  const control=event.target.closest('[data-home-month]');
  if(!control)return;
  if(control.dataset.homeMonth==='pick')openMonthPicker();
  else changeMonth(control.dataset.homeMonth==='prev'?-1:1);
});
