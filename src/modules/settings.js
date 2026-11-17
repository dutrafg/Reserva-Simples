function settings(){
 const scanProgress=$('#integrityProgressHost > .integrity-progress');
 const scanSummary=$('#integritySummary')?.textContent||'';
 const scanDisabled=$('#integrityScanBtn')?.disabled||false;
 const total=db.records.length+db.allocations.length;const institutionsCard=institutionRegistryCard();const recoveryCard=storageRecoveryRaw?`<article class="card settings-card settings-danger"><div class="settings-card-head"><span class="settings-icon">${icon('expense')}</span><div><h2>Recuperação de dados</h2><p>Os dados salvos não puderam ser lidos. O app pausou gravações para não sobrescrever o arquivo original.</p></div></div><div class="setting-actions"><button class="btn primary" id="exportCorruptBtn">Baixar cópia dos dados</button><button class="btn negative" id="startFreshAfterCorruptBtn">Iniciar base nova</button></div><p class="settings-note">${recoveryArchived?'Uma cópia também foi guardada neste navegador.':'Não foi possível arquivar a cópia automaticamente; exporte o arquivo antes de iniciar uma base nova.'}</p></article>`:'';
 $('#page-settings').innerHTML=`${heading('Configurações','Ajuste a aparência e organize seus dados.')}<div class="settings-grid">${recoveryCard}${accountSettingsCard()}<article class="card settings-card"><div class="settings-card-head"><div><h2>Central de Integridade</h2><p>Verifique o banco e gere um relatório técnico.</p></div></div><button class="btn primary" id="integrityScanBtn">Escanear</button><p id="integritySummary" role="status"></p><div id="integrityProgressHost"></div></article>${institutionsCard}
 <article class="card settings-card"><div class="settings-card-head"><span class="settings-icon">${icon('settings')}</span><div><h2>Aparência</h2><p>Escolha como o aplicativo aparece neste aparelho.</p></div></div><div class="setting-row"><div><h3>Tema escuro</h3><p>Reduz o brilho da tela.</p></div><label class="switch"><input id="darkMode" type="checkbox" ${db.prefs.dark?'checked':''}>Ativar</label></div><div class="field"><span>Paleta de cores</span><div class="theme-palette-grid" role="group" aria-label="Selecione a paleta de cores">${[['blue','Azul','#1762c4'],['emerald','Esmeralda','#16834b'],['petrol','Petróleo','#08796e'],['plum','Ameixa','#7444a5'],['graphite','Grafite','#525d70'],['carbon','Preto/amarelo','#ffd43b']].map(([id,label,color])=>`<button type="button" class="theme-palette-choice ${(db.prefs.palette||'blue')===id?'selected':''}" data-palette-pick="${id}" aria-pressed="${(db.prefs.palette||'blue')===id}" title="${label}"><i style="--palette-chip:${color}"></i><span>${label}</span></button>`).join('')}</div></div></article><article class="card settings-card"><h2>Notificações</h2><p>Som ao atingir 75% ou 100% da cota de Mercado no mês atual, com o app aberto.</p><label class="switch"><input type="checkbox" id="budgetSound" ${db.prefs.budgetSound?'checked':''}>Ativar som</label> <button type="button" class="btn small" id="testBudgetSound">Testar som</button><div class="setting-row"><div><h3>Lembretes de contas</h3><p>Usa as contas recorrentes e as datas exibidas na agenda.</p></div><label class="switch"><input type="checkbox" id="billReminders" ${db.prefs.billReminders?'checked':''}>Ativar</label></div><label class="field">Avisar com antecedência<select id="billReminderDays">${[[0,'No dia do vencimento'],[1,'1 dia antes'],[3,'3 dias antes'],[7,'7 dias antes']].map(([value,label])=>`<option value="${value}" ${db.prefs.billReminderDays===value?'selected':''}>${label}</option>`).join('')}</select></label><div class="setting-actions"><button type="button" class="btn" id="enableBillNotifications">Permitir avisos no aparelho</button></div><p class="settings-note" id="billNotificationStatus">${esc(billNotificationPermission())} Os avisos automáticos são verificados quando o app está aberto.</p></article>
 <article class="card settings-card update-card"><div class="settings-card-head"><span class="settings-icon">${icon('refresh')}</span><div><h2>Atualizações</h2><p>Consulte a versão publicada e atualize o aplicativo sem apagar seus registros.</p></div></div><div id="updateState" class="update-status" data-state="${esc(updateInfo.state)}" role="status" aria-live="polite">${esc(updateInfo.status)}</div><div class="update-metrics"><div class="update-metric"><span>VERSÃO INSTALADA</span><strong>v${APP_VERSION}</strong></div><div class="update-metric"><span>VERSÃO PUBLICADA</span><strong id="updateLatest">v${esc(updateInfo.latest)}</strong></div><div class="update-metric"><span>ÚLTIMA CONSULTA</span><strong id="updateLastCheck">${updateInfo.lastCheck?esc(new Date(updateInfo.lastCheck).toLocaleString('pt-BR')):'Ainda não consultado'}</strong></div></div><div class="setting-actions"><button class="btn" id="checkUpdatesBtn">Verificar agora</button><button class="btn primary" id="applyUpdateBtn" ${updateInfo.available?'':'hidden'}>Atualizar agora</button></div><p class="update-help" id="updateNotes">${esc(updateInfo.notes||'O app preserva o banco local. A atualização do PWA requer conexão com o endereço publicado.')}</p></article>
 <article class="card settings-card backup-panel"><div class="settings-card-head"><span class="settings-icon">${icon('wallet')}</span><div><h2>Backup e exportação</h2><p>Proteja seus registros e gere relatórios.</p></div></div><div class="backup-grid">
<section class="backup-group"><h3>Backup em pasta</h3><p>Guarde cópias cifradas e versões anteriores dos registros.</p><div class="vault-inline"><h4>Cofre local</h4><p>${vault?'Cofre ativo. Exporte uma cópia cifrada em Backup.':'Proteja os registros com uma senha. Guarde-a para poder abrir o cofre.'}</p><div class="setting-actions"><button class="btn" id="vaultAction">${vault?'Bloquear cofre':'Ativar cofre'}</button>${vault&&!ACCOUNT?'<button class="btn" id="disableVaultBtn">Desativar cofre local</button>':''}</div></div><p class="settings-note" id="folderBackupStatus" role="status">${folderStatusText()}</p><div class="setting-actions"><button class="btn primary" id="chooseBackupFolderBtn">Escolher pasta de backup</button><button class="btn" id="reconnectBackupFolderBtn" hidden>Reconectar pasta</button><button class="btn" id="saveFolderBackupBtn" ${backupDirectory?'':'disabled'}>Salvar backup agora</button><button class="btn" id="restoreFolderBackupBtn" ${backupDirectory?'':'disabled'}>Restaurar da pasta</button></div></section>
<section class="backup-group"><h3>Arquivos de backup</h3><p>Baixe uma cópia ou restaure um arquivo salvo.</p><div class="setting-actions"><button class="btn" id="exportBtn">Baixar backup</button><button class="btn" id="importBtn">Restaurar arquivo</button></div><input id="importFile" type="file" accept=".json,application/json" hidden></section>

<section class="backup-group"><h3>Importar extrato bancário</h3><p>Envie o CSV exportado pelo banco. Datas, valores e categorias são identificados automaticamente; confira a prévia antes de adicionar os lançamentos.</p><div class="setting-actions"><button class="btn primary" id="bankCsvBtn">Importar CSV do banco</button><input id="bankCsvFile" type="file" accept=".csv,text/csv,text/plain" hidden></div></section><section class="backup-group"><h3>Planilha de lançamentos</h3><p>Exporte o histórico em CSV.</p><div class="setting-actions"><button class="btn" id="csvBtn">Exportar CSV</button></div></section></div></article>
 <article class="card settings-card"><h2>Privacidade</h2><p>Controle a exibição dos valores financeiros neste aparelho.</p><div class="setting-actions"><button type="button" class="btn" id="settingsPrivacyToggle" aria-pressed="${hideValues}">${hideValues?'Mostrar valores':'Ocultar valores'}</button></div></article>
 <article class="card settings-card"><h2>Acessibilidade</h2><p>Personalize a leitura e o movimento da interface.</p><label class="switch"><input type="checkbox" data-accessibility="reduceMotion" ${document.documentElement.classList.contains('reduceMotion')?'checked':''}>Reduzir animações</label><label class="switch"><input type="checkbox" data-accessibility="strongText" ${document.documentElement.classList.contains('strongText')?'checked':''}>Aumentar contraste do texto secundário</label></article>
 <article class="card settings-card"><h2>Painel Hoje e navegação</h2><p>Escolha como o painel apresenta os resultados e como o aplicativo abre.</p><label class="field">Período do painel<select data-view-setting="reserva.home.period">${settingOptions([['today','Hoje'],['7d','Últimos 7 dias'],['month','Mês selecionado'],['12m','Últimos 12 meses'],['custom','Personalizado em Hoje']],localStorage.getItem(userKey('reserva.home.period'))||'month')}</select></label><label class="field">Gráfico por categoria em Orçamento<select data-view-setting="reserva.home.categoryView">${settingOptions([['distribution','Distribuição'],['comparison','Comparação com mês anterior']],localStorage.getItem(userKey('reserva.home.categoryView'))||'distribution')}</select></label><label class="field">Tela inicial<select data-view-setting="reserva.startPage">${settingOptions(PAGES.map(([id,label])=>[id,label]),preferredStartPage())}</select></label><label class="switch"><input type="checkbox" data-view-setting="reserva.sidebarCompact" ${sidebarCompact?'checked':''}>Menu lateral compacto no desktop</label></article>
 <article class="card settings-card diagnostic-advanced-card" hidden><div class="settings-card-head"><span class="settings-icon">${icon('report')}</span><div><h2>Diagnóstico avançado</h2><p>Ferramenta de desenvolvimento e QA, destinada a uso com orientação técnica.</p></div></div><p>Varre todos os módulos, estrutura e layout, cálculos, persistência isolada, regressões, acessibilidade, segurança e APIs locais. Os testes sintéticos preservam os registros reais. A análise pode levar até 60 segundos.</p><p>O JSON distingue falhas, erros, pendências e recursos não suportados. Inclui esqueleto técnico do DOM sem textos visíveis, valores de campos ou dados financeiros e pessoais. Para investigar um problema, envie o JSON, um print separado e a descrição do comportamento. Nada é enviado automaticamente.</p><p>${diagnostics.report().events.length} evento(s) técnico(s) no histórico local.</p><div class="setting-actions"><button type="button" class="btn primary" id="runDiagnosticScan">Executar análise completa e baixar JSON</button><button type="button" class="btn" id="exportDiagnostics">Baixar logs JSONL</button><button type="button" class="btn" id="clearDiagnostics">Limpar logs</button></div><p id="diagnosticScanStatus" role="status" aria-live="polite">A análise percorre os módulos; testes que dependem de navegador, aparelho ou serviços externos aparecem como pendentes.</p></article>
 <article class="card settings-card settings-danger"><div class="settings-card-head"><span class="settings-icon">${icon('expense')}</span><div><h2>Apagar dados</h2><p>Remove ${total} movimentações e ${db.jars.length} cofrinhos salvos neste navegador.</p></div></div><div class="setting-actions"><button class="btn negative" id="clearBtn">Apagar todos os dados</button></div></article>
 </div><div class="notice">Versão ${APP_VERSION}. Os cálculos são feitos no próprio aparelho. Mantenha backups atualizados para evitar perder seus registros.</div>`
 $('#integrityProgressHost').append(scanProgress||createIntegrityProgress());
 $('#integritySummary').textContent=scanSummary;
 $('#integrityScanBtn').disabled=scanDisabled;
 organizeSettingsNavigation();
}
function organizeSettingsNavigation(){
 const root=$('#page-settings'),grid=root?.querySelector('.settings-grid');if(!grid)return;
 const groups=[['general','Geral'],['notifications','Notificações'],['system','Sistema']];
 const nav=document.createElement('nav');nav.className='finance-section-nav settings-section-nav';nav.setAttribute('aria-label','Seções de Ajustes');
 const content=document.createElement('div');content.className='settings-tab-content';
 for(const [id,label] of groups){const button=document.createElement('button');button.type='button';button.dataset.settingsTab=id;button.textContent=label;if(id===(state.settingsView||'general')){button.classList.add('selected');button.setAttribute('aria-current','page')}nav.append(button);const panel=document.createElement('section');panel.className='settings-tab-panel';panel.dataset.settingsPanel=id;panel.hidden=id!==(state.settingsView||'general');content.append(panel)}
 for(const card of [...grid.querySelectorAll(':scope > .settings-card')]){const title=card.querySelector('h2')?.textContent?.trim().toLocaleLowerCase('pt-BR')||'';const group=/notifica|lembrete/.test(title)?'notifications':/aparência/.test(title)?'general':'system';content.querySelector(`[data-settings-panel="${group}"]`)?.append(card)}
 const systemPanel=content.querySelector('[data-settings-panel="system"]');for(const pattern of [/atualiza/,/privacidade/,/apagar dados/]){const card=[...systemPanel.querySelectorAll('.settings-card')].find(item=>pattern.test(item.querySelector('h2')?.textContent?.toLocaleLowerCase('pt-BR')||''));if(card)systemPanel.append(card)}
 grid.replaceWith(nav,content);
}
function setUpdateStatus(status,state='waiting'){updateInfo.status=status;updateInfo.state=state;const el=$('#updateState');if(el){el.textContent=status;el.dataset.state=state}const button=$('#applyUpdateBtn');if(button)button.hidden=!updateInfo.available;const latest=$('#updateLatest');if(latest)latest.textContent='v'+updateInfo.latest;const checked=$('#updateLastCheck');if(checked)checked.textContent=updateInfo.lastCheck?new Date(updateInfo.lastCheck).toLocaleString('pt-BR'):'Ainda não consultado';const notes=$('#updateNotes');if(notes)notes.textContent=updateInfo.notes||'O app preserva o banco local. A atualização do PWA requer conexão com o endereço publicado.'}
const parseAppVersion=value=>{
  if(typeof value!=='string')return null;
  const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([a-z][a-z0-9-]*)(?:\.(0|[1-9]\d*))?)?$/.exec(value);
  if(!match)return null;
  return {numbers:match.slice(1,4).map(Number),channel:match[4]||'',sequence:Number(match[5]||0)};
};
function compareVersions(a,b){
  const left=parseAppVersion(a),right=parseAppVersion(b);
  if(!left||!right)throw new Error('Versão do manifesto inválida');
  for(let i=0;i<3;i++){
    const diff=left.numbers[i]-right.numbers[i];
    if(diff)return diff;
  }
  if(!left.channel||!right.channel)return Number(!left.channel)-Number(!right.channel);
  return left.channel.localeCompare(right.channel,'en')||left.sequence-right.sequence;
}
async function checkForUpdates(){const button=$('#checkUpdatesBtn');if(button)button.disabled=true;updateInfo.available=false;setUpdateStatus('Consultando versão publicada…','checking');if(location.protocol==='file:'){updateInfo.lastCheck=new Date().toISOString();localStorage.setItem('reserva.update.checkedAt',updateInfo.lastCheck);updateInfo.notes='Abra o PWA em um endereço HTTPS para consultar e instalar atualizações. O arquivo HTML isolado não possui um servidor de versões.';setUpdateStatus('Consulta online indisponível neste modo','error');if(button)button.disabled=false;return}try{const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)throw new Error('manifesto indisponível');const release=await response.json();if(release.application!=='Reserva Simples'||!parseAppVersion(release.version))throw new Error('manifesto incompatível');updateInfo.latest=String(release.version);updateInfo.available=compareVersions(updateInfo.latest,APP_VERSION)>0;updateInfo.lastCheck=new Date().toISOString();updateInfo.notes=release.notes||'O banco de dados local permanece no aparelho durante a atualização.';localStorage.setItem('reserva.update.checkedAt',updateInfo.lastCheck);setUpdateStatus(updateInfo.available?'Nova versão disponível':'Você está usando a versão mais recente',updateInfo.available?'available':'success')}catch(err){diagnostics.record('update.check_failed',err);updateInfo.lastCheck=new Date().toISOString();localStorage.setItem('reserva.update.checkedAt',updateInfo.lastCheck);updateInfo.notes='Não foi possível consultar o manifesto de atualização. Confira sua conexão e tente novamente.';setUpdateStatus('Não foi possível verificar agora','error')}finally{if(button)button.disabled=false}}
let updateInProgress=false;
async function applyUpdate(){
 if(updateInProgress)return;
 if(saving||vaultBusy)return notify('Aguarde o salvamento antes de atualizar.');
 if($('#modal.open form')||document.querySelector('dialog[open] form'))return notify('Salve ou feche o formulário aberto antes de atualizar.');
 if(!updateInfo.available)return notify('Não há atualização disponível.');
 if(!('serviceWorker'in navigator)||location.protocol==='file:')return notify('Instale o app publicado como PWA para aplicar atualizações.');
 updateInProgress=true;diagnostics.step('update.requested');const button=$('#applyUpdateBtn');if(button)button.disabled=true;setUpdateStatus('Preparando atualização…','checking');
 const previousController=navigator.serviceWorker.controller;
 let reloaded=false,resolveActivation,rejectActivation;
 const activation=new Promise((resolve,reject)=>{resolveActivation=resolve;rejectActivation=reject});
 const reload=()=>{if(reloaded)return;reloaded=true;try{localStorage.setItem('reserva.update.pendingVersion',String(updateInfo.latest));}catch{}resolveActivation();location.reload()};
 const watch=worker=>{
  if(!worker)return;
  const onState=()=>{
   if(worker.state==='installed'||worker.state==='waiting')worker.postMessage({type:'SKIP_WAITING'});
   if(worker.state==='activated')reload();
   if(worker.state==='redundant')rejectActivation(new Error('O navegador descartou a instalação dos novos arquivos.'));
  };
  worker.addEventListener('statechange',onState);onState();
 };
 navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
 try{
  updateRegistration=await navigator.serviceWorker.getRegistration('./');
  if(!updateRegistration)throw new Error('Não encontrei o registro do PWA neste endereço.');
  updateRegistration.addEventListener('updatefound',()=>watch(updateRegistration.installing));
  await updateRegistration.update();
  if(reloaded)return;
  if(navigator.serviceWorker.controller!==previousController){reload();return;}
  watch(updateRegistration.installing);
  watch(updateRegistration.waiting);
  if(reloaded)return;
  if(!updateRegistration.installing&&!updateRegistration.waiting){
   const expectedCache='reserva-simples-v'+updateInfo.latest+'-';
   const readyCache=Boolean(globalThis.caches&&(await caches.keys()).some(name=>name.startsWith(expectedCache)));
   if(readyCache){diagnostics.record('update.cache_ready',undefined,{status:'aprovada',target_version:updateInfo.latest,reason:'Cache da versão publicada já está instalado; recarregando para confirmar a versão ativa'});reload();return;}
   throw new Error('O navegador não encontrou um Service Worker novo nem o cache da versão publicada. Feche outras janelas do Reserva Simples e tente novamente.');
  }
  setUpdateStatus('Baixando e ativando os novos arquivos…','available');
  await Promise.race([activation,new Promise((_,reject)=>setTimeout(()=>reject(new Error('O navegador não concluiu a instalação em 45 segundos. Confira a conexão e tente novamente; seus dados continuam preservados.')),45000))]);
 }catch(err){
  if(reloaded)return;
  diagnostics.record('update.install_failed',err,{error_message:err?.message||'Falha ao ativar a atualização',target_version:updateInfo.latest});updateInProgress=false;if(button)button.disabled=false;
  const msg=err?.message||'Falha ao ativar a atualização.';
  setUpdateStatus(msg,'error');
 }
}
let marketRefreshPending = false;
const editingField = () => document.activeElement?.matches?.('input, select, textarea');
function refreshMarketViews() {
  if (state.modal || editingField()) {
    marketRefreshPending = true;
    return;
  }
  render();
}
document.addEventListener('focusout', () => {
  if (marketRefreshPending) setTimeout(() => {
    if (marketRefreshPending && !state.modal && !editingField()) render();
  }, 0);
});
const pageRenderers={home,transactions,register,budget,calendar,goals,investments,analysis,reports,settings};
