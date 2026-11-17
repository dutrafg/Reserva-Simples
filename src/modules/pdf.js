function htmlReportToModel(html){
  const doc=new DOMParser().parseFromString(html,'text/html'),clean=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  const title=clean(doc.querySelector('h1'))||'Relatório financeiro';
  const subtitles=[...doc.querySelectorAll('header p,.muted')].map(clean).filter(Boolean);
  const summaries=[...doc.querySelectorAll('.pdf-totals article,.summary>div')].map(node=>{
    const label=clean(node.querySelector('span'))||clean(node).replace(clean(node.querySelector('strong,b')),'').trim();
    const value=clean(node.querySelector('strong,b'));
    return {label:label||'Resumo',value:value||clean(node)};
  });
  const sections=[];
  doc.querySelectorAll('section').forEach(section=>{
    const heading=clean(section.querySelector('h2'))||'Detalhes';
    const table=section.querySelector('table');
    if(!table){const p=section.querySelector('p');sections.push({heading,rows:[[clean(p)||'Sem registros.']]});return}
    sections.push({heading,rows:[...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(clean)).filter(row=>row.length)});
  });
  doc.querySelectorAll('table').forEach(table=>{if(table.closest('section'))return;sections.push({heading:'Detalhamento',rows:[...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(clean)).filter(row=>row.length)})});
  doc.querySelectorAll('.notes').forEach(node=>sections.push({heading:'Observações',rows:[[clean(node)]]}));
  if(!sections.length)sections.push({heading:'Detalhes',rows:[[clean(doc.body)||'Sem dados para exibir.']]});
  return {title,subtitle:subtitles.find(x=>/Emitido|Gerado|Estimativa/i.test(x))||subtitles[0]||'Relatório financeiro',summaries,sections};
}
function downloadPdfReport(title,html,targetDocument=document,targetWindow=window,fallbackId='pdfDownloadFallback'){
  const cp1252={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
  const hex=value=>[...String(value)].map(char=>{const code=char.codePointAt(0),byte=code<128||code>=160&&code<=255?code:cp1252[char]??63;return byte.toString(16).padStart(2,'0')}).join('').toUpperCase();
  const model=htmlReportToModel(html),W=842,H=595,left=36,right=36,usable=W-left-right,bottom=38;
  const blue='0.09 0.29 0.56',light='0.92 0.95 0.99',muted='0.36 0.42 0.50',ink='0.10 0.15 0.22',line='0.82 0.86 0.91';
  const pages=[];let ops=[],y=0,pageNo=0;
  const text=(x,top,value,size=8,color=ink,bold=false)=>{ops.push(`${color} rg BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(H-top).toFixed(2)} Tm <${hex(value)}> Tj ET`)};
  const rect=(x,top,w,h,color)=>ops.push(`${color} rg ${x.toFixed(2)} ${(H-top-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const rule=(x1,top,x2,color=line,width=.6)=>ops.push(`${color} RG ${width} w ${x1.toFixed(2)} ${(H-top).toFixed(2)} m ${x2.toFixed(2)} ${(H-top).toFixed(2)} l S`);
  const beginPage=first=>{ops=[];pageNo++;rect(0,0,W,8,blue);text(left, 34, 'RESERVA SIMPLES', 10, blue,true);text(left, 53, first?model.title:title, 18, ink,true);text(left, 69, model.subtitle, 8, muted);text(W-right-66,35,`PÁGINA ${pageNo}`,7,muted);rule(left,78,W-right,blue,1.2);y=94;
    if(first&&model.summaries.length){const count=Math.min(4,model.summaries.length),gap=10,cw=(usable-gap*(count-1))/count;model.summaries.slice(0,count).forEach((item,i)=>{const x=left+i*(cw+gap);rect(x,y,cw,46,light);rect(x,y,3,46,blue);text(x+12,y+17,item.label.slice(0,48),7,muted);text(x+12,y+35,item.value.slice(0,42),12,blue,true)});y+=60;}
  };
  const finishPage=()=>{rule(left,H-27,W-right,line,.6);text(left,H-18,'Reserva Simples · Relatório gerado pelo aplicativo',7,muted);text(W-right-52,H-18,`${pageNo}`,7,muted);pages.push(ops.join('\n'))};
  const newPage=()=>{finishPage();beginPage(false)};
  const wrap=(value,max)=>{const words=String(value||'—').split(/\s+/),out=[];let line='';for(const word0 of words){let word=word0;while(word.length>max){if(line){out.push(line);line=''}out.push(word.slice(0,max));word=word.slice(max)}const test=line?line+' '+word:word;if(test.length>max){out.push(line);line=word}else line=test}if(line)out.push(line);return out.length?out:['—']};
  beginPage(true);
  for(const section of model.sections){
    if(y>H-bottom-46)newPage();
    y+=5;text(left,y,section.heading,11,blue,true);y+=10;rule(left,y,W-right,line,.8);y+=8;
    const rows=section.rows||[];if(!rows.length){text(left,y,'Sem registros.',8,muted);y+=18;continue}
    const n=Math.max(1,...rows.map(r=>r.length)),headers=rows[0];
    const weights=Array.from({length:n},(_,i)=>{const h=(headers[i]||'').toLowerCase();return /descri|observ|aplica|institui|categoria|produto|cofrinho|meta|nome/.test(h)?1.65:/data|tipo|situa|prazo|confer|débito|dia|início|fim/.test(h)?0.9:/valor|saldo|receita|despesa|aporta|rendimento|líquido|objetivo|principal|ir est|iof/.test(h)?1.0:1.12});const total=weights.reduce((a,b)=>a+b,0),widths=weights.map(w=>usable*w/total);
    const renderRow=(cells,index,header=false)=>{const wrapped=cells.map((cell,i)=>wrap(cell,Math.max(7,Math.floor((widths[i]||usable/n)/(header?4.2:4.0)))));const lines=Math.max(1,...wrapped.map(v=>v.length));const rh=Math.max(header?21:18,lines*(header?8:8.3)+7);if(y+rh>H-bottom){newPage();if(!header)renderRow(headers,0,true)}if(header){rect(left,y,usable,rh,blue)}else if(index%2===0){rect(left,y,usable,rh,'0.97 0.98 0.99')};let x=left;for(let i=0;i<n;i++){const cellLines=wrapped[i]||[''];for(let li=0;li<cellLines.length;li++){text(x+5,y+12+li*8,cellLines[li],header?6.7:7,header?'1 1 1':ink,header)}x+=widths[i]||usable/n}if(!header)rule(left,y+rh,W-right,line,.35);y+=rh};
    renderRow(headers,0,true);for(let ri=1;ri<rows.length;ri++)renderRow(rows[ri],ri,false);y+=12;
  }
  finishPage();
  const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];const pageIds=[];
  for(const content of pages){const pageId=objects.length;pageIds.push(pageId);const contentId=pageId+1;const stream=`q\n${content}\nQ`;objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)}
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  let pdf='%PDF-1.4\n';const offsets=[0];for(let id=1;id<objects.length;id++){offsets[id]=pdf.length;pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)pdf+=String(offsets[id]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob=new Blob([pdf],{type:'application/pdf'}),url=targetWindow.URL.createObjectURL(blob),link=targetDocument.createElement('a');const filename=String(title||'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'relatorio';link.href=url;link.download=`reserva-simples-${filename}.pdf`;const fallback=targetDocument.getElementById(fallbackId);if(fallback){fallback.href=url;fallback.download=link.download;fallback.textContent='Baixar PDF pronto';fallback.hidden=false}targetDocument.body.append(link);link.click();link.remove();setTimeout(()=>targetWindow.URL.revokeObjectURL(url),30000);notify('PDF com layout do Reserva Simples pronto. Se não baixar automaticamente, toque em “Baixar PDF pronto”.');
}
function generateGlobalPdf(){
  diagnostics.step('pdf.requested', 'reports');
  const scope=$('#globalPdfScope').value;
  const prefix=scope==='month'?mkey(state.year,state.month):scope==='year'?String(state.year)+'-':'';
  const title=scope==='month'?monthLabel():scope==='year'?'Ano de '+state.year:'Histórico completo';
  const inPeriod=x=>!prefix||x.date.startsWith(prefix);
  const records=db.records.filter(inPeriod);
  const totals=[['Receitas',sum(records.filter(x=>x.kind==='income').map(x=>x.amount))],['Despesas',sum(records.filter(x=>x.kind==='expense').map(x=>x.amount))]];
  totals.push(['Receitas menos despesas',totals[0][1]-totals[1][1]]);
  const logo=new URL('./icon.svg',location.href).href;
  const ordered=rows=>[...rows].sort((a,b)=>a.date.localeCompare(b.date));
  const table=(title,columns,rows)=>`<section><h2>${esc(title)} <small>(${rows.length})</small></h2>${rows.length?`<table><thead><tr>${columns.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${esc(String(x??'—'))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p>Sem registros.</p>'}</section>`;
  const sections=[
    table('Receitas e despesas',['Data','Tipo','Categoria ou origem','Descrição','Valor'],ordered(records).map(x=>[dateBR(x.date),x.kind==='income'?'Receita':'Despesa',x.kind==='income'?(x.source==='salary'?'Salário':'Complemento'):x.category,x.note,money(x.amount)])),
    table('Contas recorrentes · cadastro atual',['Tipo','Descrição','Dia','Início','Fim','Valor','Situação'],db.recurring.map(x=>[x.kind==='income'?'Receita':'Despesa',x.note||x.category,x.day,x.startMonth,x.endMonth,money(x.amount),x.paused?'Pausada':'Ativa'])),
    table('Metas e cofrinhos · posição atual',['Meta','Prazo','Objetivo','Saldo estimado do cofrinho','Aplicações vinculadas','Situação'],db.jars.map(x=>[x.name,dateBR(x.dueDate),money(x.target),money(estimateCdbJar(x.id).net),money(linkedInvestmentBalance(x.id)),x.archived?'Arquivada':x.paused?'Pausada':'Ativa'])),
    table('Movimentos de cofrinhos',['Data','Cofrinho','Tipo','Principal','Líquido recebido','Descrição'],ordered(db.allocations.filter(inPeriod)).map(x=>[dateBR(x.date),db.jars.find(j=>j.id===x.jarId)?.name,x.amount>0?'Aporte':'Resgate',money(Math.abs(x.amount)),x.amount<0?money(x.netReceived??-x.amount):'—',x.note])),
    table('Aplicações do período · saldo informado',['Aplicação','Instituição','Produto','Data','Aplicado','Saldo líquido informado','Conferência','Meta','Débito no mês'],db.investments.filter(inPeriod).map(x=>[x.name,x.institution,x.product,dateBR(x.date),money(x.cost),money(x.balance),dateBR(x.checked),db.jars.find(j=>j.id===x.goalId)?.name,x.existing?'Não':'Sim'])),
    table('Carteira atual · posições informadas',['Aplicação','Tipo','Instituição','Data de conferência','Saldo informado','Custo restante do lote'],db.investments.filter(x=>x.status!=='sold').map(x=>[x.name,x.assetType==='livestock'?'Pecuária':'Financeiro',x.institution,dateBR(x.checked),money(x.balance),x.assetType==='livestock'?money(x.remainingCostBasis):'—'])),
    table('Resgates da carteira',['Data','Aplicação','Valor líquido'],ordered(db.investments.flatMap(x=>(x.redemptions??[]).map(r=>({...r,name:x.name}))).filter(inPeriod)).map(r=>[dateBR(r.date),r.name,money(r.amount)])),
    table('Instituições cadastradas',['Nome','Tipo','Percentual do CDI'],db.institutions.map(x=>[x.name,x.type==='cooperative'?'Cooperativa':'Banco',percent(x.cdiPercent)]))
  ].join('');
  const reportHtml=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Reserva Simples — Relatório geral</title><style>
  body{font:14px system-ui;color:#17263d;margin:24px}header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1a4d95;padding-bottom:12px}header img{width:46px;height:46px;border-radius:10px}h1{font-size:24px;margin:0}header p{margin:4px 0;color:#435772}.pdf-totals{display:flex;gap:12px;margin:16px 0}.pdf-totals article{flex:1;border:1px solid #b8cde7;border-top:3px solid #1a4d95;border-radius:8px;padding:10px;background:#eef5ff}.pdf-totals strong{display:block;font-size:18px;margin-top:4px}section{margin:24px 0}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;overflow-wrap:anywhere}th{background:#e6effb;color:#112c55}tbody tr:nth-child(even){background:#f5f8fd}h2{font-size:16px;break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}button{padding:9px 14px}@media print{button{display:none}body{margin:0}table{font-size:9px}}@page{size:A4 landscape;margin:12mm}
  </style></head><body><header><img src="${esc(logo)}" alt=""><div><h1>Reserva Simples</h1><p>Relatório financeiro · ${esc(title)} · Emitido em ${dateBR(isoToday())}${hideValues?' · Valores ocultos':''}</p></div></header><div class="pdf-totals">${totals.map(([label,value])=>`<article>${label}<strong>${money(value)}</strong></article>`).join('')}</div><button type="button" class="no-print" id="downloadPdfButton">Baixar PDF</button><button type="button" class="no-print" onclick="window.focus();window.print()">Imprimir</button>${sections}
<style id="desktop-integrated-page-header">
@media (min-width:761px){
 .sidebar-control{height:72px!important;justify-content:flex-start!important;margin-bottom:14px!important}
 .sidebar-control .page-title-block{display:grid;align-content:center;gap:3px;flex:1;min-width:0;margin:0 18px}
 .sidebar-control .page-title-block .subtitle{margin:0;font-size:9px;line-height:1.1}
 .sidebar-control .page-title-block h1{margin:0;font-size:24px;line-height:1.05;letter-spacing:-.7px}
 .sidebar-control .header-right{flex:0 0 auto!important;margin-left:auto!important}
 .main>.header{display:none!important}
}
@media (min-width:761px) and (max-width:1023px){
 .sidebar-control{height:64px!important;margin-bottom:12px!important}
 .sidebar-control #sidebarToggle{display:none!important}
 .sidebar-control .page-title-block{margin-left:0;margin-right:12px}
 .sidebar-control .page-title-block h1{font-size:21px}
}
</style>




</body></html>`;
  const parsed=new DOMParser().parseFromString(reportHtml,'text/html');
  downloadPdfReport('Relatorio financeiro - '+title,reportHtml,document,window);
}
function generateCdbPdf(){const rows=db.jars.filter(j=>!j.archived).map(j=>{const e=estimateCdbJar(j.id),institution=db.institutions.find(i=>i.id===j.institutionId)||db.institutions[0];return{j,e,institution}});const total={principal:sum(rows.map(x=>x.e.principal)),gross:sum(rows.map(x=>x.e.gross)),gain:sum(rows.map(x=>x.e.gain)),iof:sum(rows.map(x=>x.e.iof)),ir:sum(rows.map(x=>x.e.ir)),net:sum(rows.map(x=>x.e.net))};const annual=currentCdiAnnual();const rowHtml=rows.map(({j,e,institution})=>`<tr><td><b>${esc(j.name)}</b><small>${esc(institution?.name||'Banco Inter')} · ${institution?.type==='cooperative'?'Cooperativa':'Banco'} · ${percent(institution?.cdiPercent||100)} do CDI</small></td><td>${money(e.principal)}</td><td>${money(e.gain)}</td><td>${money(e.iof)}</td><td>${money(e.ir)}</td><td><b>${money(e.net)}</b></td></tr>`).join('');const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório de CDBs</title><style>*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172235;margin:32px auto;max-width:1100px;padding:0 22px}h1{margin:0 0 6px;font-size:25px}.muted,small{color:#667386}small{display:block;margin-top:4px;font-size:11px}.top{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;border-bottom:2px solid #dbe5ef;padding-bottom:18px}.badge{padding:8px 12px;border-radius:20px;background:#edf4ff;color:#2159a6;font-weight:bold}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.summary div{padding:13px;background:#f4f7fb;border-radius:12px}.summary span{display:block;color:#667386;font-size:11px}.summary b{display:block;font-size:19px;margin-top:7px}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e5eaf0;vertical-align:top}th{background:#f4f7fb;font-size:10px;text-transform:uppercase;letter-spacing:.04em}.right{text-align:right}.notes{margin-top:18px;padding:14px;background:#fff8e8;border:1px solid #f1e1b9;border-radius:10px;color:#61522d;font-size:11px;line-height:1.55}.foot{margin-top:20px;font-size:10px;color:#667386}@media print{body{max-width:none;margin:0;padding:0}.no-print{display:none}.summary div{break-inside:avoid}tr{break-inside:avoid}thead{display:table-header-group}}</style><body><div class="top"><div><h1>Relatório de cofrinhos e CDBs</h1><div class="muted">Gerado em ${new Date().toLocaleString('pt-BR')} · valores informados no aplicativo</div></div><span class="badge">CDI ${annual===null?'indisponível':percent(annual)+' a.a.'}</span></div><div class="summary"><div><span>Total aportado</span><b>${money(total.principal)}</b></div><div><span>Rendimento bruto estimado</span><b>${money(total.gain)}</b></div><div><span>Saldo líquido estimado</span><b>${money(total.net)}</b></div></div><button type="button" class="no-print" id="downloadPdfButton">Baixar PDF</button><button type="button" class="no-print" onclick="window.focus();window.print()">Imprimir</button><p class="muted">Estimativa calculada em ${cdiDateBR(isoToday())}; taxa CDI mais recente de ${cdiDateBR(latestCdi()?.date)} pela série diária CDI do Banco Central (SGS 12).</p><table><thead><tr><th>Cofrinho / instituição</th><th>Aportado</th><th>Rendimento bruto</th><th>IOF est.</th><th>IR est.</th><th>Saldo líquido est.</th></tr></thead><tbody>${rowHtml||'<tr><td colspan="6">Nenhum cofrinho cadastrado.</td></tr>'}<tr><th>Total</th><th>${money(total.principal)}</th><th>${money(total.gain)}</th><th>${money(total.iof)}</th><th>${money(total.ir)}</th><th>${money(total.net)}</th></tr></tbody></table><div class="notes"><b>Importante:</b> este documento é uma estimativa para compartilhamento, não é extrato bancário, comprovante de investimento nem saldo oficial. O CDI futuro pode mudar. O cálculo assume os aportes e resgates informados, consome aportes mais antigos primeiro (FIFO) e ajusta proporcionalmente o valor restante de cada lote ao principal resgatado; aplica a porcentagem do CDI cadastrada e estima IOF/IR em caso de resgate hoje. Confirme os valores com a instituição financeira.</div><div class="foot">Reserva Simples · Não contém número de conta ou credenciais bancárias.</div>
<style id="desktop-integrated-page-header">
@media (min-width:761px){
 .sidebar-control{height:72px!important;justify-content:flex-start!important;margin-bottom:14px!important}
 .sidebar-control .page-title-block{display:grid;align-content:center;gap:3px;flex:1;min-width:0;margin:0 18px}
 .sidebar-control .page-title-block .subtitle{margin:0;font-size:9px;line-height:1.1}
 .sidebar-control .page-title-block h1{margin:0;font-size:24px;line-height:1.05;letter-spacing:-.7px}
 .sidebar-control .header-right{flex:0 0 auto!important;margin-left:auto!important}
 .main>.header{display:none!important}
}
@media (min-width:761px) and (max-width:1023px){
 .sidebar-control{height:64px!important;margin-bottom:12px!important}
 .sidebar-control #sidebarToggle{display:none!important}
 .sidebar-control .page-title-block{margin-left:0;margin-right:12px}
 .sidebar-control .page-title-block h1{font-size:21px}
}
</style>

</body></html>`;const parsed=new DOMParser().parseFromString(html,'text/html');downloadPdfReport('Relatorio de cofrinhos e CDBs',html,document,window,'cdbPdfDownloadFallback')}
function institutionRegistryCard(){const rows=db.institutions.map(i=>{const used=db.jars.filter(j=>j.institutionId===i.id).length;return `<div class="institution-row"><span><b>${esc(i.name)}</b><small>${i.type==='cooperative'?'Cooperativa':'Banco'} · ${percent(i.cdiPercent)} do CDI · ${fundLabel(i.guaranteeFund)} · ${used} cofrinho(s)</small></span><span class="institution-actions"><button class="btn small" data-open="institution" data-institution="${esc(i.id)}">${i.isDefault?'Ajustar':'Editar'}</button>${i.isDefault?'<span class="tag soft">Padrão</span>':`<button class="btn small negative" data-delete-institution="${esc(i.id)}">Excluir</button>`}</span></div>`}).join('');return `<article class="card settings-card institution-settings-card"><div class="settings-card-head"><span class="settings-icon">${icon('wallet')}</span><div><h2>Bancos e cooperativas</h2><p>Cadastre instituições, remuneração do CDB e referências de proteção para o monitoramento estimado.</p></div></div><div class="institution-list">${rows}</div><div class="setting-actions"><button class="btn primary" data-open="institution">Cadastrar banco ou cooperativa</button></div></article>`}
async function deleteInstitution(id){const i=db.institutions.find(x=>x.id===id);if(!i)return;if(i.isDefault)return notify('A instituição padrão do Banco Inter não pode ser excluída.');const used=db.jars.filter(j=>j.institutionId===id);if(used.length)return notify('Antes de excluir, edite os cofrinhos vinculados e escolha outra instituição.');if(!confirm(`Excluir “${i.name}” da lista de instituições?`))return;if(await mutate(()=>db.institutions=db.institutions.filter(x=>x.id!==id)))notify('Instituição excluída.')}
async function savePlanningPrefs(e){e.preventDefault();const raw=$('#balanceAnchorAmount').value.trim(),date=$('#balanceAnchorDate').value,months=Number($('#emergencyMonths').value);let balance=null,anchor='';if(raw||date){const n=Number(raw);if(!raw||!Number.isFinite(n)||n<0||n>100000000||!validDate(date)||date>isoToday()){notify('Informe um saldo válido e a data em que ele foi conferido.');return}balance=Math.round(n*100);anchor=date}if(![3,6,9,12].includes(months)){notify('Escolha um prazo válido para a reserva.');return}if(await mutate(()=>{db.prefs.balanceAnchorCents=balance;db.prefs.balanceAnchorDate=anchor;db.prefs.emergencyMonths=months}))notify('Referências de planejamento salvas.')}
function preferredStartPage(){
  const page=localStorage.getItem(userKey('reserva.startPage'));
  return PAGES.some(([id])=>id===page)?page:'home';
}
function settingOptions(choices, selected){
  return choices.map(([value,label])=>`<option value="${esc(value)}" ${selected===value?'selected':''}>${esc(label)}</option>`).join('');
}
document.addEventListener('change', event=>{
  const input=event.target;
  const key=input.dataset?.viewSetting;
  if (!['reserva.home.period','reserva.home.categoryView','reserva.startPage','reserva.sidebarCompact'].includes(key)) return;
  localStorage.setItem(userKey(key),input.type==='checkbox'?String(input.checked):input.value);
  if(key==='reserva.sidebarCompact'){sidebarCompact=input.checked;syncSidebar();}
  if(key==='reserva.home.period')home();
  if(key==='reserva.home.categoryView')budget();
});
function showAccountDialog(){
 const dlg=$('#accountDialog');if(!dlg||dlg.open)return;
 const legacy=!ACCOUNT&&!!localStorage.getItem('reserva-simples-v2');
 $('#accountLegacy').hidden=!legacy;
 $('#accountImportLegacy').checked=legacy;
 $('#accountError').textContent='';
 $('#accountAvatarChoices').innerHTML=Array.from({length:5},(_,i)=>
   '<label class="account-avatar-option"><input type="radio" name="avatar" value="'+i+'" '+(i===0?'checked':'')+'><img alt="Avatar financeiro '+(i+1)+'" src="'+Accounts.avatar(i)+'"></label>'
 ).join('');
 dlg.showModal();
}

async function createAccount(event){
 event.preventDefault();
 const form=event.target,err=$('#accountError'),button=form.querySelector('button[type="submit"]');
 if(button.disabled)return;
 button.disabled=true;err.textContent='';
 let newKey='';
 try{
   if(!globalThis.crypto?.subtle||!crypto.randomUUID)throw Error('Cadastro exige HTTPS e navegador com criptografia.');
   const password=form.elements.password.value;
   if(password.length<12||password!==form.elements.confirm.value)throw Error('A senha deve ter 12 caracteres ou mais, com confirmação igual.');
   const id=crypto.randomUUID();
   const profile=Accounts.profile({name:form.elements.name.value,email:form.elements.email.value,
     phone:form.elements.phone.value,avatar:form.elements.avatar.value,photo:''},id);
   let source=empty();
   if(!ACCOUNT&&$('#accountImportLegacy').checked){
     const old=localStorage.getItem('reserva-simples-v2');
     if(old){
       const parsed=JSON.parse(old);
       if(parsed.format==='reserva-vault-1'){
         const previousKey=await deriveVaultKey(password,from64(parsed.salt));
         source=await openVault(parsed,previousKey);
       }else source=verify(parsed);
       if(!source)throw Error('Base antiga inválida. Preserve e exporte seus dados antes de cadastrar.');
     }
   }
   source={...source,ownerId:id,profile};
   if(!verify(source))throw Error('Não foi possível validar a base do perfil.');
   const salt=bytesTo64(crypto.getRandomValues(new Uint8Array(16)));
   const key=await deriveVaultKey(password,from64(salt));
   const sealed=await sealVault(source,key,salt);
   await openVault(sealed,key);
   newKey=Accounts.storeKey(id);
   localStorage.setItem(newKey,JSON.stringify(sealed));
   Accounts.add(localStorage,id);
   document.body.classList.add('reserve-locked');
   location.reload();
 }catch(error){
   if(newKey&&!Accounts.list(localStorage).some(x=>Accounts.storeKey(x.id)===newKey))localStorage.removeItem(newKey);
   err.textContent=error?.message||'Não foi possível criar o perfil.';
 }finally{button.disabled=false}
}

function accountSettingsCard(){
 if(!ACCOUNT)return `<article class="card settings-card account-card account-guest">
   <div class="settings-card-head"><span class="settings-icon">${icon('wallet')}</span><div>
   <h2>Modo sem cadastro</h2><p>Você está usando o Reserva Simples sem perfil protegido.</p>
   </div></div>
   <p>Seus dados ficam neste navegador e podem ser acessados por outras pessoas que utilizem este dispositivo, salvo se você ativou o cofre manualmente. Não há biometria nem recuperação de conta.</p>
   <div class="setting-actions"><button class="btn primary" type="button" id="guestCreateProfile">Criar perfil protegido</button></div>
   <p class="settings-note">Você pode vincular os registros atuais durante o cadastro. Uma cópia da base anterior será mantida.</p>
   </article>`;
 const profile=db.profile||{name:'',email:'',phone:'',avatar:0,photo:''};
 const image=profile.photo||Accounts.avatar(profile.avatar||0);
 return `<article class="card settings-card account-card">
  <div class="settings-card-head"><img class="account-current-avatar" src="${esc(image)}" alt=""><div><h2>Meu perfil</h2><p>Dados protegidos pela senha do cofre neste aparelho.</p></div></div>
  <form id="profileForm" class="form-grid">
   <label class="field"><span>Nome</span><input name="name" maxlength="80" minlength="2" required value="${esc(profile.name||'')}"></label>
   <label class="field"><span>Telefone</span><input name="phone" type="tel" maxlength="24" value="${esc(profile.phone||'')}"></label>
   <label class="field full"><span>E-mail</span><input name="email" type="email" maxlength="120" value="${esc(profile.email||'')}"></label>
   <div class="field full"><span>Avatar financeiro</span><div class="account-avatar-grid">${Array.from({length:5},(_,i)=>`<label class="account-avatar-option"><input type="radio" name="avatar" value="${i}" ${Number(profile.avatar||0)===i?'checked':''}><img src="${Accounts.avatar(i)}" alt="Avatar ${i+1}"></label>`).join('')}</div></div>
   <div class="form-buttons"><button class="btn primary" type="submit">Salvar perfil</button><label class="btn" for="accountPhotoInput">Enviar foto</label><input type="file" id="accountPhotoInput" accept="image/png,image/jpeg,image/webp" hidden><button class="btn" type="button" id="accountRemovePhoto" ${profile.photo?'':'hidden'}>Remover foto</button></div>
  </form>
  <div class="account-security">
   <h3>Segurança e biometria</h3><p>O cofre exige senha. A biometria usa uma credencial criptográfica WebAuthn PRF, se compatível.</p>
   <label class="field">Confirme a senha do cofre para ativar biometria<input id="accountBioPassword" type="password" autocomplete="current-password" placeholder="Senha do cofre"></label>
   <div class="setting-actions"><button class="btn primary" id="accountEnableBio" type="button">Ativar biometria</button>
   <button class="btn" id="accountDisableBio" type="button" ${Accounts.biometricConfigured(localStorage,ACCOUNT.id)?'':'hidden'}>Remover biometria</button>
   <button class="btn" id="accountLock" type="button">Bloquear agora</button></div>
   <p id="accountBioStatus" class="settings-note" role="status">${Accounts.biometricConfigured(localStorage,ACCOUNT.id)?'Biometria configurada.':'Biometria ainda não configurada neste navegador.'}</p>
  </div>
  <div class="account-switch">
   <h3>Perfis deste aparelho</h3>
   <div class="setting-actions"><select id="accountSelect" aria-label="Escolher perfil">${Accounts.list(localStorage).map((x,i)=>`<option value="${esc(x.id)}" ${x.id===ACCOUNT.id?'selected':''}>Perfil ${i+1}${x.id===ACCOUNT.id?' (atual)':''}</option>`).join('')}</select>
   <button type="button" class="btn" id="accountSwitch">Trocar perfil</button><button type="button" class="btn" id="accountCreateMore">Novo perfil</button></div>
   <p class="settings-note">Perfis e backups são independentes. Não há conta remota nem sincronização. Guarde a senha do cofre.</p>
  </div>
 </article>`;
}

async function saveProfileForm(event){
 event.preventDefault();
 const f=event.target;
 try{
   const profile=Accounts.profile({...db.profile,name:f.elements.name.value,
     phone:f.elements.phone.value,email:f.elements.email.value,avatar:f.elements.avatar.value},ACCOUNT.id);
   if(await mutate(()=>{db.profile=profile;db.ownerId=ACCOUNT.id}))notify('Perfil atualizado.');
 }catch(err){notify(err.message||'Dados inválidos.')}
}

async function handleProfilePhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5000000)
   return notify('Envie JPEG, PNG ou WebP de até 5 MB.');
 try{
   const dataUrl=await new Promise((resolve,reject)=>{
     const url=URL.createObjectURL(file),img=new Image();
     img.onload=()=>{
       try{
         const canvas=document.createElement('canvas'),scale=Math.min(1,256/Math.max(img.width,img.height));
         canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
         canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
         const data=canvas.toDataURL('image/jpeg',.77);
         URL.revokeObjectURL(url);resolve(data);
       }catch(err){URL.revokeObjectURL(url);reject(err)}
     };
     img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Imagem inválida'))};img.src=url;
   });
   if(!Accounts.photoValid(dataUrl))return notify('Foto muito grande após compressão.');
   if(await mutate(()=>{db.profile.photo=dataUrl}))notify('Foto salva no cofre.');
 }catch{notify('Não foi possível processar a foto.')}
}

async function unlockWithBiometric(){
 const error=$('#vaultError');
 try{
   if(!ACCOUNT||!vault)throw Error('Nenhum cofre associado ao perfil.');
   const password=await Accounts.unlock(localStorage,ACCOUNT.id);
   const key=await deriveVaultKey(password,from64(vault.salt));
   const restored=await openVault(vault,key);
   if(restored.ownerId!==ACCOUNT.id||restored.profile?.id!==ACCOUNT.id)throw Error('Cofre pertence a outro perfil.');
   db=restored;vaultKey=key;$('#vaultDialog').close();render();
 }catch(err){error.textContent=err.message||'Biometria indisponível. Use a senha.'}
}

async function toggleBiometricEnable(){
 const status=$('#accountBioStatus'),password=$('#accountBioPassword')?.value||'';
 try{
   if(!ACCOUNT||!vault)throw Error('Cofre não está ativo.');
   const key=await deriveVaultKey(password,from64(vault.salt));
   const verified=await openVault(vault,key);
   if(verified.ownerId!==ACCOUNT.id)throw Error('Perfil incorreto.');
   await Accounts.enroll(localStorage,ACCOUNT.id,password);
   $('#accountBioPassword').value='';
   status.textContent='Biometria configurada. A senha continua como alternativa.';
   render();
 }catch(err){status.textContent=err.message||'Dispositivo não compatível com a biometria criptográfica.'}
}


document.addEventListener('cancel',event=>{if(event.target?.id==='accountDialog'&&!ACCOUNT&&!GUEST)event.preventDefault()});
document.addEventListener('submit',event=>{
 if(event.target.id==='accountForm')void createAccount(event);
 if(event.target.id==='profileForm')void saveProfileForm(event);
});
document.addEventListener('change',event=>{
 if(event.target.id==='accountPhotoInput')void handleProfilePhoto(event.target.files?.[0]);
});
document.addEventListener('click',event=>{
 if(event.target.closest('#accountCreateMore')||event.target.closest('#guestCreateProfile'))showAccountDialog();
 if(event.target.closest('#accountSkip')){
   if(ACCOUNT)return;
   try{
     localStorage.setItem('reserva.guest.enabled.v1','true');
     GUEST=true;
     $('#accountDialog')?.close();
     document.body.classList.remove('reserve-locked');
     if(vault&&!vaultKey){showVaultDialog('unlock');return}
     render();
   }catch{const el=$('#accountError');if(el)el.textContent='Não foi possível iniciar o modo sem cadastro neste navegador.'}
 }
 if(event.target.closest('#accountSwitch')){
   const id=$('#accountSelect')?.value;
   if(id&&id!==ACCOUNT?.id){Accounts.select(localStorage,id);document.body.classList.add('reserve-locked');location.reload()}
 }
 if(event.target.closest('#accountLock')){document.body.classList.add('reserve-locked');location.reload()}
 if(event.target.closest('#accountEnableBio'))void toggleBiometricEnable();
 if(event.target.closest('#accountDisableBio')&&ACCOUNT){
   if(confirm('Remover biometria deste perfil? A senha continuará funcionando.')){Accounts.disableBiometric(localStorage,ACCOUNT.id);render()}
 }
 if(event.target.closest('#accountRemovePhoto'))void mutate(()=>{db.profile.photo=''});
 if(event.target.closest('#accountBioUnlock'))void unlockWithBiometric();
});

