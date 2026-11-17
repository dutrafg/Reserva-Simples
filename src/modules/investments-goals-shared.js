function linkedInvestmentBalance(id,asOf=null){return sum(db.investments.filter(x=>x.goalId===id&&(!asOf||x.checked<=asOf)).map(x=>x.balance))}
function goalEngineData(y,m){const key=mkey(y,m),today=isoToday(),currentKey=today.slice(0,7),asOf=key<currentKey?new Date(y,m+1,0).toISOString().slice(0,10):today,adjustments={};for(const jar of db.jars){const principal=sum(db.allocations.filter(a=>a.jarId===jar.id&&a.date<=asOf).map(a=>a.amount)),net=estimateCdbJar(jar.id,asOf).net,linked=linkedInvestmentBalance(jar.id,asOf);adjustments[jar.id]=net+linked-principal}return {...db,goalBalanceAdjustments:{[key]:adjustments}}}
function goalProgressSummary(extraClass='',showAction=true){
  const goals=db.jars.filter(j=>!j.archived);
  if(!goals.length)return '';
  return `<article class="card today-reserve ${extraClass}">${cardTitle('Progresso das metas','Cofrinhos e investimentos vinculados', showAction?'<button class="text-link" data-page="goals">Ver metas</button>':'')}
  <div class="today-goal-list">${goals.map(j=>{
    const balance=estimateCdbJar(j.id).net+linkedInvestmentBalance(j.id);
    const progress=j.target?balance/j.target*100:0;
    return `<div class="today-goal"><span class="goal-ring" style="--progress:${hideValues?0:Math.min(100,progress)}%"><b>${hideValues?'••':Math.round(progress)+'%'}</b></span><span><b>${esc(j.name)}</b><small>${money(balance)} de ${money(j.target)}${j.paused?' · Pausada':''}</small></span></div>`;
  }).join('')}</div></article>`;
}

function reserveMonthCard(m,extraClass=''){
 const total=m.deposits+m.invested,redemptions=m.withdrawals+m.redeemed,share=m.income?percent(total/m.income*100):'Sem renda registrada';
 const detail='Cofrinhos: '+money(m.deposits)+' · Carteira: '+money(m.invested)+(redemptions?' · Resgates: '+money(redemptions):'')+' · '+share;
 return '<article class="today-stat '+extraClass+'"><span class="today-stat-label">'+icon('piggy')+'Reserva deste mês</span><strong>'+money(total)+'</strong><small>'+detail+'</small></article>';
}
function portfolioSummary(){
  const items=db.investments;
  return `<article class="card"><h3>Carteira de investimentos</h3><p>${items.length} aplicação(ões) · Saldo líquido informado: <strong>${money(sum(items.map(x=>x.balance)))}</strong></p><p>Vinculado a metas ativas: ${money(sum(items.filter(x=>db.jars.some(j=>j.id===x.goalId&&!j.archived)).map(x=>x.balance)))}</p><button class="btn" data-page="investments">Abrir investimentos</button></article>`;
}
function jarCard(j,mini=false){
 const plan=Engines.goal(goalEngineData(state.year,state.month),j,state.year,state.month);
 const cdb=estimateCdbJar(j.id),institution=db.institutions.find(i=>i.id===j.institutionId)||db.institutions[0],linked=linkedInvestmentBalance(j.id),val=cdb.net+linked,ratio=j.target?val/j.target*100:0,remain=Math.max(0,j.target-val),paused=!!j.paused;
 const labels={concluida:'Concluída',atrasada:'Prazo encerrado',em_risco:'Em risco',no_ritmo:'No ritmo',sem_historico:'Acompanhar'};
 const status=remain===0?'concluida':plan.status,statusCls=['atrasada','em_risco'].includes(status)?'warn':status==='concluida'?'':'soft';
 let hint=remain===0?'Meta alcançada':plan.monthsRemaining>0?`${money(Math.ceil(remain/plan.monthsRemaining))} por mês até o prazo`:'Prazo anterior a este mês';
 const paceText=plan.monthlyPace===null?'Ritmo: aguardando histórico':`Ritmo recente: ${money(plan.monthlyPace)}/mês`,inflation=currentIpcaAnnual(),years=Math.max(0,(new Date(j.dueDate+'T12:00:00')-new Date(isoToday()+'T12:00:00'))/86400000/365.25),inflatedTarget=inflation===null?null:Math.round(j.target*Math.pow(1+inflation/100,years));
 return `<div class="goal-card"><div class="goal-top"><div><h3>${esc(j.name)}</h3><p>${esc(institution?.name||'Banco Inter')} · ${percent(institution?.cdiPercent||100)} do CDI · prazo: ${dateBR(j.dueDate)}</p></div><span class="tag ${paused?'soft':statusCls}">${paused?'Plano pausado':labels[status]}</span></div><div class="goal-amount"><strong>${money(val)}</strong><span>saldo para a meta · ${percent(ratio)} da meta</span></div>${miniProgress(val,j.target)}<div class="cdb-detail"><span>Saldo líquido do cofrinho: ${money(cdb.net)}</span>${linked?`<span>Aplicações vinculadas: ${money(linked)}</span>`:''}<span>Aportado: ${money(cdb.principal)}</span><span>Rendimento bruto: ${money(cdb.gain)}</span><span>Estimativa líquida após impostos se resgatar hoje</span></div><div class="goal-foot"><span>${remain>0?'Faltam '+money(remain):'Objetivo atingido'}</span><span>${mini?'':paused?'Sem aporte planejado':hint}</span></div>${mini?'':`<div class="goal-pacing"><b>${paused?'Plano pausado':esc(hint)}</b><span>${paused?'Saldo e histórico continuam registrados. Retome quando quiser.':esc(paceText)}</span><span>Saldo calculado com o CDI publicado até ${cdiDateBR(cdb.rateDate)}.</span>${inflatedTarget===null?'':`<span>Meta no prazo se o IPCA atual persistir: ${money(inflatedTarget)} · cenário, não previsão.</span>`}${!paused&&plan.projectedPeriod&&plan.status==='em_risco'?`<span>Na velocidade atual sem juros futuros: ${plan.projectedPeriod.slice(5)}/${plan.projectedPeriod.slice(0,4)}.</span>`:''}</div><div class="goal-actions"><button class="btn primary small" data-open="add" data-jar="${esc(j.id)}">+ Guardar</button><button class="btn small" data-open="withdraw" data-jar="${esc(j.id)}" ${val<=0?'disabled':''}>Resgatar</button><button class="btn small" data-edit-jar="${esc(j.id)}">Editar</button><button class="btn small" data-toggle-jar="${esc(j.id)}">${paused?'Retomar plano':'Pausar plano'}</button>${db.allocations.some(a=>a.jarId===j.id)?`<button class="btn small" data-archive-jar="${esc(j.id)}">Arquivar</button>`:`<button class="btn negative small" data-delete-jar="${esc(j.id)}">Excluir</button>`}</div>`}</div>`
}
function movementsTable(){
  const period=mkey(state.year,state.month);
  const rows=db.allocations.map(a=>({
    date:a.date,name:db.jars.find(j=>j.id===a.jarId)?.name||'Cofrinho',
    kind:a.amount>0?'Aporte em cofrinho':'Resgate de cofrinho',
    amount:a.amount>0?-a.amount:(a.netReceived??-a.amount),
    note:a.note, allocationId:a.id
  }));
  for(const x of db.investments){
    rows.push({date:x.date,name:x.name,kind:x.existing?'Aplicação existente · sem débito':'Novo investimento',amount:x.existing?x.cost:-x.cost, reference:x.existing});
    for(const r of x.redemptions??[])rows.push({date:r.date,name:x.name,kind:'Resgate de investimento',amount:r.amount});
  }
  const monthly=rows.filter(r=>r.date.startsWith(period)).sort((a,b)=>b.date.localeCompare(a.date));
  if(!monthly.length)return '<div class="empty">Nenhum aporte, resgate ou aplicação com data neste mês.</div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Cofrinho ou aplicação</th><th class="right">Valor</th><th class="right">Ação</th></tr></thead><tbody>${monthly.map(r=>`<tr><td>${dateBR(r.date)}</td><td><b>${esc(r.name)}</b><div class="sub">${r.kind}${r.note?' · '+esc(r.note):''}</div></td><td class="money">${r.reference||hideValues?'':r.amount<0?'−':'+'}${money(Math.abs(r.amount))}</td><td class="right">${r.allocationId?`<button class="delete" data-delete-allocation="${esc(r.allocationId)}">Excluir</button>`:'<button class="btn small" data-page="investments">Ver carteira</button>'}</td></tr>`).join('')}</tbody></table></div>`;
}
let investmentEditId = null;
let investmentExisting = false;
function investmentEstimateMarkup(item){const estimate=estimateCdbInvestment(item);if(!estimate)return'';if(estimate.unavailable)return`<p class="investment-estimate-note">Estimativa CDI: ${esc(estimate.unavailable)}</p>`;return`<details class="investment-estimate"><summary>Estimativa líquida aproximada · ${estimate.pct}% do CDI</summary><p>Saldo bruto estimado: <strong>${money(estimate.gross)}</strong> · líquido estimado hoje: <strong>${money(estimate.net)}</strong></p><p>Rendimento bruto: ${money(estimate.gain)} · IOF estimado: ${money(estimate.iof)} · IR estimado: ${money(estimate.ir)}</p><small>CDI publicado até ${cdiDateBR(estimate.rateDate)}. O saldo informado pelo Inter continua sendo a referência oficial.</small></details>`}
function investments() {
  const items=db.investments,byInstitution=new Map();
  const sorted=[...items].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'pt-BR'));
  for(const item of items)if(item.balance>0)byInstitution.set(item.institution,(byInstitution.get(item.institution)||0)+item.balance);
  const cdiEstimates=items.map(x=>estimateCdbInvestment(x)).filter(Boolean),validEstimates=cdiEstimates.filter(estimate=>!estimate.unavailable);
  $('#page-investments').innerHTML=`${heading('Investimentos','Acompanhe aplicações financeiras e ativos de pecuária na mesma carteira.')}
  <div class="actions"><button class="btn primary" data-investment-edit="">Registrar novo investimento</button><button class="btn" data-investment-edit="" data-existing="true">Registrar investimento já existente</button><button class="btn" data-quick-open="add">Registrar aporte em cofrinho</button></div>
  <div class="overview-grid"><article class="card"><h3>Saldo informado das aplicações e custo restante dos lotes</h3><strong>${money(sum(items.filter(x=>x.status!=='sold').map(x=>x.assetType==='livestock'?x.remainingCostBasis:x.balance)))}</strong></article><article class="card"><h3>Saldo atual da carteira</h3><strong>${money(sum(items.map(x=>x.balance)))}</strong></article>${cdiEstimates.length?`<article class="card"><h3>Estimativa líquida dos CDBs atrelados ao CDI</h3><strong>${money(sum(validEstimates.map(x=>x.net)))}</strong><small>${validEstimates.length} de ${cdiEstimates.length} aplicação(ões) calculada(s); não substitui o saldo informado pelo Inter.</small></article>`:''}
  ${byInstitution.size?`<article class="card institution-desktop-card"><h3>Saldo por instituição ou propriedade</h3>${[...byInstitution].map(([name,value])=>`<p>${esc(name)} · ${money(value)}</p>`).join('')}</article>`:''}</div>
  ${items.length?`<section class="investment-portfolio"><h2>Carteira</h2><div class="investment-card-grid">${sorted.map(x=>{const cattle=x.assetType==='livestock',sales=(x.redemptions||[]).filter(r=>r.kind==='sale'),realized=sum(sales.map(r=>r.amount-(r.costBasisSold||0))),expenseTotal=sum((x.expenses||[]).map(e=>e.amount)),label=cattle?`Pecuária · ${esc(x.livestockKind)} · ${x.headCount} cabeça(s) no lote`:`${esc(x.product)} · ${esc(x.institution)}`;return `<details class="card investment-tile"><summary><time datetime="${x.date}">${dateBR(x.date)}</time><b>${esc(x.name)}</b><small>${label}${cattle?' · '+esc(x.institution):''}</small><span>${x.status==='sold'?'Lote vendido':cattle?'Valor de mercado':'Saldo líquido'}</span><strong>${money(x.balance)}</strong></summary><div class="investment-tile-detail"><p>Compra: ${money(x.cost)} em ${dateBR(x.date)}${cattle?' · custo restante do lote: '+money(x.remainingCostBasis||0):''}</p><p>${cattle?`Valor de mercado informado: ${money(x.balance)} em ${dateBR(x.checked)}${x.headCount? ' · '+money(Math.round(x.balance/x.headCount))+' por cabeça':''}`:`Saldo líquido informado: ${money(x.balance)} em ${dateBR(x.checked)}`}</p>${!cattle?investmentEstimateMarkup(x):''}${cattle?`<p>Custos detalhados: ${money(expenseTotal)}${x.extraCosts?' · custos anteriores sem detalhamento: '+money(x.extraCosts):''} · Resultado realizado nas vendas: <strong>${money(realized)}</strong></p>${x.expenses?.length?`<details><summary>Despesas do lote (${x.expenses.length})</summary>${x.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<p>${dateBR(e.date)} · ${esc(e.category)} · ${money(e.amount)}${e.note?' · '+esc(e.note):''}</p>`).join('')}</details>`:''}${sales.length?`<details><summary>Vendas registradas (${sales.length})</summary>${sales.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<p>${dateBR(r.date)} · ${r.heads} cabeça(s) · ${money(r.amount)} recebido · resultado: ${money(r.amount-(r.costBasisSold||0))}</p>`).join('')}</details>`:''}`:`${x.redemptions?.length?`<details><summary>Resgates registrados</summary>${x.redemptions.map(r=>`<p>${dateBR(r.date)} · ${money(r.amount)}</p>`).join('')}</details>`:''}`}<div class="actions"><button class="btn" data-investment-edit="${esc(x.id)}">Editar dados</button>${cattle&&x.status!=='sold'?`<button class="btn" data-livestock-expense="${esc(x.id)}">Registrar gasto do lote</button><button class="btn" data-sell-livestock="${esc(x.id)}">Registrar venda parcial ou total</button>`:''}${!cattle&&x.status!=='sold'&&x.balance>0?`<button class="btn" data-redeem-investment="${esc(x.id)}">Registrar resgate</button>`:''}<button class="btn" data-investment-delete="${esc(x.id)}">Remover</button></div></div></details>`}).join('')}</div></section>`:'<article class="card">Cadastre sua primeira aplicação ou lote de pecuária para acompanhar sua carteira.</article>'}
  ${guaranteeCard()}`;
}
const redemptionForm=$('#redemptionForm'),livestockExpenseForm=$('#livestockExpenseForm');
let redemptionId=null,redemptionMode='redeem',livestockExpenseId=null;
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-redeem-investment],[data-sell-livestock]');
  if(button){
    redemptionMode=button.hasAttribute('data-sell-livestock')?'sale':'redeem';
    redemptionId=button.dataset.redeemInvestment||button.dataset.sellLivestock;
    const item=db.investments.find(x=>x.id===redemptionId);
    redemptionForm.reset();redemptionForm.elements.namedItem('date').value=isoToday();
    const sale=redemptionMode==='sale',headsInput=redemptionForm.elements.namedItem('heads'),headLabel=headsInput.closest('label');
    headsInput.required=sale;headsInput.max=item?.headCount||1;
    $('#redemptionTitle').textContent=sale?'Registrar venda do lote':'Registrar resgate';
    redemptionForm.querySelector('label span').textContent=sale?'Valor recebido pela venda (R$)':'Valor líquido recebido (R$)';
    redemptionForm.querySelector('button[type="submit"]').textContent=sale?'Salvar venda':'Salvar resgate';
    headLabel.hidden=!sale;
    if(sale)redemptionForm.elements.namedItem('heads').value=item?.headCount||1;
    $('#redemptionError').textContent='';$('#redemptionDialog').showModal();return;
  }
  const expense=event.target.closest('[data-livestock-expense]');
  if(expense){
    livestockExpenseId=expense.dataset.livestockExpense;
    const item=db.investments.find(x=>x.id===livestockExpenseId);
    livestockExpenseForm.reset();livestockExpenseForm.elements.namedItem('date').value=isoToday();
    $('#livestockExpenseTitle').textContent='Registrar gasto · '+(item?.name||'lote');
    $('#livestockExpenseError').textContent='';$('#livestockExpenseDialog').showModal();
  }
});
$('#redemptionCancel').addEventListener('click',()=>$('#redemptionDialog').close());
redemptionForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(redemptionForm),date=String(data.get('date')),amount=toCents(String(data.get('amount'))),item=db.investments.find(x=>x.id===redemptionId),error=$('#redemptionError');
  error.textContent='';
  if(redemptionMode==='sale'){
    const heads=Number(data.get('heads'));
    if(!item||item.assetType!=='livestock'||item.status==='sold'||!Number.isInteger(heads)||heads<1||heads>item.headCount||!Number.isSafeInteger(amount)||amount<=0||!validDate(date)||date<item.checked||date>isoToday()){
      error.textContent='Informe a quantidade vendida, o valor recebido e uma data válida entre a última conferência e hoje.';return;
    }
    if(await mutate(()=>{
      const beforeHeads=item.headCount,basis=item.remainingCostBasis||0;
      const costBasisSold=heads===beforeHeads?basis:Math.round(basis*heads/beforeHeads);
      const marketValueSold=heads===beforeHeads?item.balance:Math.round(item.balance*heads/beforeHeads);
      item.remainingCostBasis=Math.max(0,basis-costBasisSold);item.balance=Math.max(0,item.balance-marketValueSold);item.headCount-=heads;item.checked=date;
      (item.redemptions??=[]).push({date,amount,kind:'sale',heads,costBasisSold});
      if(item.headCount===0){item.status='sold';item.soldDate=date;item.saleAmount=sum(item.redemptions.filter(r=>r.kind==='sale').map(r=>r.amount));item.balance=0;}
    })){
      $('#redemptionDialog').close();notify('Venda registrada; quantidade, carteira e resultado realizado atualizados.');
    }
    return;
  }
  if(!item||item.status==='sold'||!Number.isSafeInteger(amount)||amount<=0||amount>item.balance||!validDate(date)||date<item.checked||date>isoToday()){
    error.textContent='Informe um valor até o saldo líquido e uma data entre a última conferência e hoje.';return;
  }
  if(await mutate(()=>{item.balance-=amount;item.checked=date;(item.redemptions??=[]).push({date,amount,kind:'redemption',heads:null,costBasisSold:null});})){
    $('#redemptionDialog').close();notify('Resgate registrado no saldo disponível.');
  }
});
$('#livestockExpenseCancel').addEventListener('click',()=>$('#livestockExpenseDialog').close());
livestockExpenseForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(livestockExpenseForm),item=db.investments.find(x=>x.id===livestockExpenseId),date=String(data.get('date')),amount=toCents(String(data.get('amount'))),category=String(data.get('category')),note=String(data.get('note')||'').trim().slice(0,120),error=$('#livestockExpenseError');
  error.textContent='';
  if(!item||item.assetType!=='livestock'||item.status==='sold'||!Number.isSafeInteger(amount)||amount<=0||item.remainingCostBasis+amount>10000000000||!validDate(date)||date<item.date||date>isoToday()){
    error.textContent='Informe um gasto positivo e uma data entre a compra e hoje.';return;
  }
  const expenseId=uid(),record={id:expenseId,kind:'expense',amount,date,source:'complement',category:'Pecuária',note:`${category} · ${item.name}${note?' — '+note:''}`,recurringId:null,recurringMonth:null,investmentId:item.id,investmentExpenseId:expenseId};
  if(await mutate(()=>{item.expenses??=[];item.expenses.push({id:expenseId,date,category,amount,note,recordId:expenseId});item.remainingCostBasis+=amount;db.records.push(record);})){
    $('#livestockExpenseDialog').close();notify('Gasto adicionado ao lote, ao histórico de despesas e aos orçamentos.');
  }
});
function toggleInvestmentAssetFields(){
  const form=$('#investmentForm'),cattle=form.elements.namedItem('assetType').value==='livestock';
  for(const [name,visible,required] of [['product',!cattle,!cattle],['cdiPercent',!cattle,false],['livestockKind',cattle,cattle],['headCount',cattle,cattle],['extraCosts',cattle,false]]){
    const input=form.elements.namedItem(name),label=input.closest('label'),item=db.investments.find(x=>x.id===investmentEditId),sold=!!(name==='headCount'&&item?.assetType==='livestock'&&(item.status==='sold'||(item.redemptions||[]).some(r=>r.kind==='sale')));label.hidden=!visible;input.required=required&&!sold;input.disabled=sold;
  }
  form.elements.namedItem('institution').closest('label').querySelector('span').textContent=cattle?'Fazenda ou propriedade':'Instituição';
  form.elements.namedItem('balance').closest('label').querySelector('span').textContent=cattle?'Valor de mercado atual do lote (R$)':'Saldo líquido do extrato (R$)';
  form.elements.namedItem('balance').closest('label').querySelector('small').textContent=cattle?'Informe uma estimativa atual para o lote.':'Use o valor líquido, após impostos, na data da conferência.';
  $('#investmentTitle').textContent=cattle?'Registrar investimento em pecuária':investmentExisting?'Investimento já existente':'Investimento com débito no saldo';
}
let reserveIncomeId=null;
function openInvestment(id,existing=false,income=null){
  reserveIncomeId=income?.id||null;
  const item=db.investments.find(x=>x.id===id);investmentEditId=item?.id??null;investmentExisting=item?item.existing===true:existing;
  const form=$('#investmentForm');form.reset();const goal=form.elements.namedItem('goalId');
  goal.innerHTML='<option value="">Sem vínculo</option>'+db.jars.filter(j=>!j.archived||j.id===item?.goalId).map(j=>`<option value="${esc(j.id)}">${esc(j.name)}</option>`).join('');goal.value=item?.goalId||'';
  form.elements.namedItem('assetType').value=item?.assetType||'financial';
  for(const key of ['name','institution','product','cdiPercent','livestockKind','headCount','extraCosts','date','checked','cost','balance']){
    const value=key==='cdiPercent'?(item?.cdiPercent??(item?investmentCdiPercent(item):null)):item?.[key];form.elements.namedItem(key).value=value==null?(key==='checked'?isoToday():key==='headCount'?1:''):['cost','balance','extraCosts'].includes(key)?value/100:value;
  }
  if(income){
    form.elements.namedItem('date').value=isoToday();
    const remaining=incomeReserveStatus(income).remaining/100;
    form.elements.namedItem('cost').value=remaining;
    form.elements.namedItem('balance').value=remaining;
  }
  const heads=form.elements.namedItem('headCount');
  heads.readOnly=!!(item?.redemptions||[]).some(r=>r.kind==='sale');
  toggleInvestmentAssetFields();$('#investmentDialog').showModal();
}
$('#investmentForm').elements.namedItem('assetType').addEventListener('change',toggleInvestmentAssetFields);
async function saveInvestment(event){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),field=key=>String(data.get(key)||'').trim();
  const existingItem=db.investments.find(x=>x.id===investmentEditId),cattle=existingItem?.status==='sold'&&existingItem.assetType==='livestock'||field('assetType')==='livestock';
  const extraCosts=cattle?Math.round(Number(field('extraCosts')||0)*100):0;
  const headCount=cattle?(existingItem?.status==='sold'?0:existingItem?.redemptions?.some(r=>r.kind==='sale')?existingItem.headCount:Number(field('headCount'))):null;
  const cdiPercent=field('cdiPercent')?Number(field('cdiPercent')):null;
  const cost=Math.round(Number(field('cost'))*100),balance=Math.round(Number(field('balance'))*100);
  if(cdiPercent!==null&&(!Number.isFinite(cdiPercent)||cdiPercent<=0||cdiPercent>500))return notify('Informe um percentual do CDI entre 0,01 e 500, ou deixe em branco.');
  if(existingItem?.assetType==='livestock'&&(existingItem.redemptions||[]).some(r=>r.kind==='sale')&&(cost!==existingItem.cost||extraCosts!==existingItem.extraCosts))return notify('Após uma venda parcial, o custo do lote e os custos adicionais ficam bloqueados para preservar o custo das vendas registradas.');
  const item={incomeRecordId:existingItem?.incomeRecordId||reserveIncomeId,id:investmentEditId||uid(),existing:investmentExisting,goalId:field('goalId')||null,name:field('name'),institution:field('institution'),product:cattle?'Pecuária · '+field('livestockKind'):field('product'),cdiPercent:cattle?null:cdiPercent,date:field('date'),checked:field('checked'),cost,balance,assetType:cattle?'livestock':'financial',livestockKind:cattle?field('livestockKind'):null,headCount,initialHeadCount:cattle?(existingItem?.initialHeadCount||headCount):null,extraCosts,expenses:existingItem?.expenses||[],remainingCostBasis:existingItem?(existingItem.remainingCostBasis+cost-existingItem.cost+extraCosts-existingItem.extraCosts):cost+extraCosts,status:existingItem?.status||'active',soldDate:existingItem?.soldDate||null,saleAmount:existingItem?.saleAmount||null,redemptions:existingItem?.redemptions||[]};
  if(cattle&&((existingItem?.status!=='sold'&&(!Number.isInteger(headCount)||headCount<1||headCount>100000))||!Number.isSafeInteger(extraCosts)||extraCosts<0||extraCosts>10000000000||!Number.isSafeInteger(item.remainingCostBasis)||item.remainingCostBasis<0||item.remainingCostBasis>10000000000))return notify('Informe a quantidade, os custos e o custo restante válidos.');
  if(reserveIncomeId){
    const income=db.records.find(record=>record.kind==='income'&&record.id===reserveIncomeId);
    if(!income||cattle||cost<=0||cost>incomeReserveStatus(income).remaining||item.date<income.date)
      return notify('Confira o valor restante da reserva e informe uma aplicação financeira com data igual ou posterior ao recebimento.');
  }
  if(item.checked<item.date||item.checked>isoToday())return notify('A conferência deve ocorrer entre a data da aplicação e hoje.');
  if(existingItem?.status==='sold'&&item.assetType==='livestock'){item.balance=0;item.headCount=0;item.remainingCostBasis=0;}
  if(calendarInvestmentEditPending&&!confirm('Confirma salvar? Isso mudará os valores registrados neste investimento e poderá alterar totais da carteira e relatórios.'))return;if(await mutate(()=>{const index=db.investments.findIndex(x=>x.id===item.id);if(index<0)db.investments.push(item);else db.investments[index]={...item,redemptions:db.investments[index].redemptions??[]};}))$('#investmentDialog').close();
}
$('#investmentForm').addEventListener('submit',saveInvestment);
$('#investmentCancel').addEventListener('click',()=>{calendarInvestmentEditPending=false;$('#investmentDialog').close()});$('#investmentDialog').addEventListener('close',()=>{calendarInvestmentEditPending=false});
document.addEventListener('click',async event=>{
  const edit=event.target.closest('[data-investment-edit]');
  if(edit)openInvestment(edit.dataset.investmentEdit,edit.dataset.existing==='true');
  const remove=event.target.closest('[data-investment-delete]');
  if(remove)removeInvestment(remove.dataset.investmentDelete);
});
