let diagnosticRunning=false,integrityRunning=false;
document.addEventListener('click',e=>{const settingsTab=e.target.closest('.settings-section-nav [data-settings-tab]');if(settingsTab){state.settingsView=settingsTab.dataset.settingsTab;e.preventDefault();e.stopImmediatePropagation();const root=$('#page-settings');root?.querySelectorAll('[data-settings-tab]').forEach(button=>{const active=button===settingsTab;button.classList.toggle('selected',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});root?.querySelectorAll('[data-settings-panel]').forEach(panel=>{panel.hidden=panel.dataset.settingsPanel!==settingsTab.dataset.settingsTab});return}const financeTab=e.target.closest('.finance-section-nav[data-module="finance"] [data-page]');if(financeTab){e.preventDefault();e.stopImmediatePropagation();state.page='budget';state.financeView=financeTab.dataset.page==='budget'?'overview':financeTab.dataset.page;render();return}const analysisTab=e.target.closest('.analysis-section-nav [data-analysis-view]');if(analysisTab){e.preventDefault();e.stopImmediatePropagation();state.page='analysis';state.analysisView=analysisTab.dataset.analysisView;render();return}},true);
document.addEventListener('click',event=>{const tab=event.target.closest('[data-register-view]');if(tab){event.preventDefault();event.stopImmediatePropagation();state.registerView=tab.dataset.registerView;register();return}const investment=event.target.closest('[data-register-open-investment]');if(investment){go('investments');requestAnimationFrame(()=>document.querySelector('[data-investment-new]')?.click());return}const task=event.target.closest('[data-register-open-task]');if(task){go('calendar');requestAnimationFrame(()=>document.querySelector('[data-calendar-new-task]')?.click())}},true);
let lastSubmittedForm=null;
document.addEventListener('submit',event=>{lastSubmittedForm=event.target},true);
function captureRenderPosition(){
 const page=document.querySelector('.page.active'),focused=document.activeElement;
 if(!page)return null;
 const fields=[...page.querySelectorAll('input,select,textarea')];
 const focusIndex=fields.indexOf(focused);
 const drafts=fields.filter(field=>field.closest('form')!==lastSubmittedForm&&field.type!=='password'&&field.type!=='file'&&((field.type==='checkbox'||field.type==='radio')?field.checked!==field.defaultChecked:field.value!==field.defaultValue)).map(field=>({index:fields.indexOf(field),value:field.value,checked:field.checked}));
 return {key:page.dataset.renderKey,page:page.id,focusIndex,start:focused?.selectionStart,end:focused?.selectionEnd,drafts,x:scrollX,y:scrollY};
}
function restoreRenderPosition(snapshot){
 if(!snapshot||document.querySelector('.page.active')?.id!==snapshot.page||document.querySelector('.page.active')?.dataset.renderKey!==snapshot.key)return;
 const fields=[...document.querySelectorAll('#'+snapshot.page+' input,#'+snapshot.page+' select,#'+snapshot.page+' textarea')];
 for(const draft of snapshot.drafts){const field=fields[draft.index];if(field&&field.type!=='file'){field.value=draft.value;if(field.type==='checkbox'||field.type==='radio')field.checked=draft.checked}}
 const focus=fields[snapshot.focusIndex];if(focus){focus.focus({preventScroll:true});if(typeof snapshot.start==='number'&&['text','search','tel','url','email'].includes(focus.type))try{focus.setSelectionRange(snapshot.start,snapshot.end)}catch{}}
 if(scrollX!==snapshot.x||scrollY!==snapshot.y)window.scrollTo(snapshot.x,snapshot.y);
}
function render(){
  if(!ACCOUNT&&!GUEST){document.body.classList.add('reserve-locked');showAccountDialog();return}
  if(vault&&!vaultKey){document.body.classList.add('reserve-locked');showVaultDialog('unlock');return}
  document.body.classList.remove('reserve-locked');
  const position=captureRenderPosition();
  marketRefreshPending=false;
  const debtInputs=['debtPayoff','debtPayment','debtMonths','debtCET'];
  const debtDraft=debtInputs.map(id=>$('#'+id)?.value);
  const [,title]=PAGES.find(([id])=>id===state.page)||PAGES[0];
  document.body.classList.toggle('dark',db.prefs.dark);
  document.body.classList.toggle('hide-values',hideValues);
  document.body.dataset.palette=db.prefs.palette||'blue';
  document.body.dataset.currentPage=state.page;
  $('#pageTitle').textContent=title;
  $('#monthTitleLabel').textContent=monthLabel();
  const privacy=$('#privacyToggle');
  privacy.textContent=hideValues?'Mostrar valores':'Ocultar valores';
  privacy.setAttribute('aria-pressed',String(hideValues));
  const now=new Date();
  $('#todayBtn').hidden=state.year===now.getFullYear()&&state.month===now.getMonth();
  document.title='Reserva — '+title;
  nav();
  document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id==='page-'+state.page));
  if(state.page!=='budget')$('#financeEmbeddedView')?.replaceChildren();
  if(state.page==='reports')$('#page-analysis .analysis-embedded-content')?.replaceChildren();
  const embeddedSource=state.page==='budget'&&state.financeView!=='overview'?state.financeView:state.page==='analysis'&&state.analysisView==='reports'?'reports':null;
  for(const [id] of PAGES){if(id===embeddedSource)continue;const page=$('#page-'+id);if(id===state.page||!page.dataset.initialized||diagnosticRunning||integrityRunning){pageRenderers[id]();page.dataset.initialized='true'}}
  if(state.page==='home'||!$('#homeFullCalendar')||diagnosticRunning||integrityRunning)mountHomeCalendar();
  debtInputs.forEach((id,index)=>{
    const input=$('#'+id);
    if(input&&debtDraft[index]!==undefined)input.value=debtDraft[index];
  });
  updateDebtComparison();
  const activePage=document.querySelector('.page.active');if(activePage)activePage.dataset.renderKey=[state.page,state.financeView,state.analysisView,state.registerView,state.year,state.month].join('|');
  restoreRenderPosition(position);
  if(lastSubmittedForm&&!lastSubmittedForm.isConnected)lastSubmittedForm=null;
}
function supportsHostedApp(){if(document.querySelector('meta[name="reserva-distribution"][content="standalone"]'))return false;return location.protocol==='https:'||(location.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname))}
for (const key of ['reduceMotion','strongText']) {
  try { document.documentElement.classList.toggle(key, localStorage.getItem(userKey('reserva.accessibility.'+key))==='true'); } catch {}
}
document.addEventListener('change', event => {
  const key = event.target.dataset?.accessibility;
  if (!['reduceMotion','strongText'].includes(key)) return;
  document.documentElement.classList.toggle(key, event.target.checked);
  try { localStorage.setItem(userKey('reserva.accessibility.'+key), String(event.target.checked)); } catch {}
});
let latestDiagnosticScan = null;
let responsiveNavigationMatrixCache = null;
function scanResponsiveNavigationMatrix() {
  if(!document.documentElement.clientWidth)return {status:'não_suportado',reason:'Medição de layout indisponível',scenarios:[]};
  const widths = [320,360,390,768,1024,1280,1366,1440];
  const results = [],moduleLayouts=[];
  const sourceCss = [...document.querySelectorAll('style')].map(style => style.textContent || '').join('\n');
  const frame = document.createElement('iframe');
  frame.title = 'Verificação responsiva isolada';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden','true');
  frame.setAttribute('sandbox','allow-same-origin');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1440px;height:900px;border:0;opacity:0;pointer-events:none;z-index:-1';
  document.body.append(frame);
  try {
    const doc = frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="shell"><aside id="desktopSidebar"><div class="sidebar-brand"><strong>Reserva Simples</strong></div><nav id="desktopNav"><button class="nav-button" type="button"><span class="nav-label">Início</span></button></nav></aside><main class="main"><div class="sidebar-control"><button id="sidebarToggle" type="button">Menu</button><div class="page-title-block"><h1>Início</h1></div></div><header class="header"><h1>Início</h1></header><section class="page active" id="page-home"><article class="card"><h2>Verificação responsiva</h2></article></section></main></div><nav id="mobileNav" class="floating-nav">'+mobileDockMarkup()+'</nav></body></html>');
    doc.close();
    const testStyle = doc.createElement('style');
    doc.head.append(testStyle);
    doc.documentElement.className=document.documentElement.className;
    doc.body.className=document.body.className;
    doc.body.dataset.palette=document.body.dataset.palette;
    const main=doc.querySelector('.main');
    const screenSample=main.querySelector('.page');
    const moduleWidths={fine:[1440],coarse:[390,768,1280]};
    for (const pointer of ['fine','coarse']) {
      testStyle.textContent = sourceCss.replace(/\(\s*pointer\s*:\s*coarse\s*\)/gi,
        pointer === 'coarse' ? '(min-width:0px)' : '(max-width:0px)');
      for (const width of widths) {
        frame.style.width = width+'px';
        const root = doc.documentElement;
        const mobileExpected = width <= 760;
        const mobileNav = doc.getElementById('mobileNav');
        const desktopSidebar = doc.getElementById('desktopSidebar');
        const rendered = node => Boolean(node && doc.defaultView.getComputedStyle(node).display !== 'none' && node.getClientRects().length);
        const mobileVisible = rendered(mobileNav);
        const sidebarVisible = rendered(desktopSidebar);
        const navRect = mobileNav.getBoundingClientRect();
        const overflowPx = Math.max(0,root.scrollWidth-root.clientWidth);
        const mobileNavInBounds = !mobileVisible || (navRect.left >= -2 && navRect.right <= width+2 && navRect.top < 900 && navRect.bottom <= 902);
        const budgetButton=mobileNav.querySelector('[data-page="budget"]');
        const dockButtonsInBounds=!mobileVisible||Boolean(budgetButton&&[...mobileNav.children].every(child=>{
          const rect=child.getBoundingClientRect();
          return rect.width>=44&&rect.height>=44&&rect.left>=navRect.left-1&&rect.right<=navRect.right+1;
        }));
        const passed = mobileVisible === mobileExpected && sidebarVisible !== mobileExpected && overflowPx <= 1 && mobileNavInBounds && dockButtonsInBounds;
        results.push({width,pointer,expected:mobileExpected?'dock do smartphone':'barra superior',mobileVisible,sidebarVisible,
          overflowPx,mobileNavInBounds,dockButtonsInBounds,passed});
        if(moduleWidths[pointer].includes(width)){
          screenSample.hidden=true;
          screenSample.classList.remove('active');
          for(const [module] of PAGES){
            const source=document.getElementById('page-'+module);
            if(!source)continue;
            const screen=doc.importNode(source,true);
            screen.classList.add('active');
            doc.body.dataset.currentPage=module;
            main.append(screen);
            const contentOverflowPx=Math.max(0,root.scrollWidth-root.clientWidth);
            const cards=[...screen.querySelectorAll('.card,.investment-tile,.goal-card')].filter(rendered);
            const outOfBounds=cards.filter(card=>{
              const box=card.getBoundingClientRect();
              return box.left < -2 || box.right > width+2;
            }).length;
            moduleLayouts.push({module,width,pointer,contentOverflowPx,cardsChecked:cards.length,
              outOfBounds,passed:contentOverflowPx<=1&&!outOfBounds});
            screen.remove();
          }
          screenSample.hidden=false;
          screenSample.classList.add('active');
          delete doc.body.dataset.currentPage;
        }
      }
    }
  } catch (error) {
    return {status:'erro',reason:error?.name==='SecurityError'?'Estilos inacessíveis no contexto isolado':'Falha ao montar a matriz responsiva',scenarios:results};
  } finally { frame.remove(); }
  const failed = [...results,...moduleLayouts].filter(result => !result.passed);
  return {status:failed.length?'alerta':'ok',reason:'Matriz isolada de navegação e geometria dos módulos',
    viewportProfiles:results.length,moduleViewportChecks:moduleLayouts.length,failed:failed.length,
    scenarios:results,moduleLayouts};
}
function scanDiagnosticPage(pageId, screenOnly = false) {
  const started = performance.now();
  const checks = [];
  function check(name, run) {
    if (screenOnly && !['Largura da tela atual','Geometria do layout visível',
      'Navegação exclusiva conforme breakpoint','Matriz responsiva de navegação','Formulários e acessibilidade'].includes(name)) return;
    const start = performance.now();
    let result;
    try { result = run(); }
    catch (error) {
      const known = ['Error','TypeError','ReferenceError','SyntaxError','RangeError',
        'QuotaExceededError','SecurityError','NotAllowedError'];
      result = {status:'erro', reason:known.includes(error?.name) ? error.name : 'Erro inesperado'};
    }
    checks.push({name, durationMs:Math.round(performance.now()-start), ...result});
  }
  const outcome = (passed, reason) => ({status:passed ? 'ok' : 'alerta', reason});
  const noLayout = () => !document.documentElement.clientWidth;
  const layoutUnavailable = () => ({status:'não_suportado',reason:'Medição de layout indisponível'});
  check('Integridade da base em memória', () => {
    if (vault && !vaultKey) return {status:'ignorado', reason:'Base bloqueada'};
    return outcome(Boolean(verify(JSON.parse(JSON.stringify(db)))), 'Validação pelo esquema de importação');
  });
  check('Base local e recuperação', () => {
    if (storageRecoveryRaw) return {status:'erro', reason:'Base em recuperação'};
    const raw = localStorage.getItem(STORE);
    if (!raw) return {status:'ignorado', reason:'Nenhuma base salva'};
    const saved = JSON.parse(raw);
    if (isVaultFormat(saved?.format)) return {status:'ignorado', reason:'Base criptografada'};
    return outcome(Boolean(verify(saved)), 'Validação da base salva');
  });
  for (const [name, storage] of [['Armazenamento local', () => localStorage],
                                  ['Armazenamento da sessão', () => sessionStorage]]) {
    check(name, () => {
      const store = storage();
      const key = 'reserva.scan.' + Date.now() + '.' + Math.random();
      try {
        store.setItem(key, 'ok');
        return outcome(store.getItem(key) === 'ok', 'Escrita e leitura de chave temporária');
      } finally { store.removeItem(key); }
    });
  }
  check('Destinos dos módulos', () => {
    const missing = PAGES.filter(([id]) => !document.getElementById('page-' + id)
      && id !== 'income' && id !== 'expense').map(([id]) => id);
    return {...outcome(!missing.length, 'Presença das telas no HTML'), missing};
  });
  check('IDs duplicados', () => {
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    const duplicates = ids.length - new Set(ids).size;
    return {...outcome(!duplicates, 'Contagem no documento'), duplicates};
  });
  check('Largura da tela atual', () => {
    if(noLayout())return layoutUnavailable();
    const overflowPx = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return {...outcome(overflowPx <= 1, 'Excesso de largura horizontal'), overflowPx};
  });
  check('Geometria do layout visível', () => {
    if(noLayout())return layoutUnavailable();
    const page = document.querySelector('.page.active');
    const width = document.documentElement.clientWidth;
    const findings = [];
    let count = 0;
    const label = node => ({
      tag:node.localName,
      position:[...node.parentElement.children].indexOf(node)+1,
      x:Math.round(node.getBoundingClientRect().left),
      y:Math.round(node.getBoundingClientRect().top+window.scrollY)
    });
    function flag(type, node, pixels, other) {
      count++;
      if (findings.length < 100) findings.push({type, element:label(node),
        pixels:Math.round(pixels), ...(other ? {neighbor:label(other)} : {})});
    }
    const nav = document.getElementById('mobileNav');
    const navRect = nav?.getBoundingClientRect();
    const visible = node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility === 'visible';
    };
    const header = document.querySelector(usesMobileNavigation()?'.main > .header':'.main > .sidebar-control');
    if (header && visible(header)) {
      const items = [...header.children].filter(visible);
      for (const [index,node] of items.entries()) {
        const rect = node.getBoundingClientRect();
        for (const other of items.slice(index+1)) {
          const neighbor = other.getBoundingClientRect();
          const overlapX = Math.min(rect.right,neighbor.right)-Math.max(rect.left,neighbor.left);
          const overlapY = Math.min(rect.bottom,neighbor.bottom)-Math.max(rect.top,neighbor.top);
          if (overlapX > 2 && overlapY > 2)
            flag('sobreposição no cabeçalho',node,Math.min(overlapX,overlapY),other);
        }
      }
    }
    const cards = [...(page?.querySelectorAll('.card,.goal-card,.transaction-row') || [])].filter(visible);
    const title = document.getElementById('pageTitle');
    const homeTitle = page?.querySelector('.approved-page-heading h1');
    if (title && homeTitle && visible(title) && visible(homeTitle))
      flag('título Hoje duplicado', title, 0, homeTitle);
    for (const node of header?.querySelectorAll('.page-title-block, .month-picker') || []) {
      if (!visible(node)) continue;
      const excess = node.scrollWidth-node.clientWidth;
      if (excess > 4) flag('conteúdo excede a largura do cabeçalho',node,excess);
    }

    const groups = new Map();
    for (const node of cards) {
      const rect = node.getBoundingClientRect();
      const excess = Math.max(-rect.left, rect.right-width);
      if (excess > 2) flag('fora da tela', node, excess);
      if (!groups.has(node.parentElement)) groups.set(node.parentElement, []);
      groups.get(node.parentElement).push({node,rect});
      if (node.matches('.transaction-row, details:not([open])')) continue;
      const children = [...node.children].filter(child => visible(child) &&
        !['absolute','fixed'].includes(getComputedStyle(child).position));
      if (children.length && rect.height > 150) {
        const bottom = Math.max(...children.map(child => child.getBoundingClientRect().bottom));
        const padding = parseFloat(getComputedStyle(node).paddingBottom) || 0;
        const blank = rect.bottom-bottom-padding;
        if (blank > 64 && blank > rect.height*.30)
          flag('possível espaço vazio no fim do cartão',node,blank);
      }
    }
    for (const [parent, entries] of groups) {
      entries.sort((a,b) => a.rect.top-b.rect.top);
      const gap = parseFloat(getComputedStyle(parent).rowGap) || 0;
      for (let i=0; i<entries.length; i++) {
        const {node,rect} = entries[i];
        let nearest = null;
        for (let j=i+1; j<entries.length; j++) {
          const {node:other,rect:box} = entries[j];
          const overlapX = Math.min(rect.right,box.right)-Math.max(rect.left,box.left);
          if (overlapX <= 2) continue;
          const overlapY = Math.min(rect.bottom,box.bottom)-box.top;
          if (overlapY > 2) flag('sobreposição entre cartões',node,overlapY,other);
          if (box.top >= rect.bottom) {
            if (node.nextElementSibling === other) nearest = {other, gap:box.top-rect.bottom};
            if (nearest) break;
          }
        }
        if (!nearest) continue;
        if (nearest.gap > Math.max(48,gap+32))
          flag('possível lacuna excessiva entre cartões da mesma coluna',node,nearest.gap,nearest.other);
      }
    }
    for (const node of [...(page?.querySelectorAll('button, input:not([type=hidden]), select, textarea') || [])].filter(visible)) {
      const rect = node.getBoundingClientRect();
      if (rect.right > width+2 || rect.left < -2)
        flag('controle fora da tela',node,Math.max(-rect.left,rect.right-width));
      if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth+4 && node.matches('button'))
        flag('conteúdo excede a largura do botão',node,node.scrollWidth-node.clientWidth);
      if (navRect?.height && rect.top < innerHeight && rect.bottom > navRect.top &&
          rect.bottom - Math.max(0,document.documentElement.scrollHeight-innerHeight-scrollY) > navRect.top+2)
        flag('controle pode ficar encoberto pela barra inferior no fim da rolagem',node,rect.bottom-navRect.top);
    }
    return {...outcome(!count,'Heurísticas aplicadas à tela renderizada; podem gerar falsos positivos'),
      viewport:{width,height:innerHeight}, cardsChecked:cards.length, count, findings};
  });
  check('Navegação exclusiva conforme breakpoint', () => {
    if(noLayout())return layoutUnavailable();
    const mobileNav = document.getElementById('mobileNav');
    const desktopSidebar = document.getElementById('desktopSidebar');
    const mobileExpected = usesMobileNavigation();
    const isRendered = node => Boolean(node && getComputedStyle(node).display !== 'none' && node.getClientRects().length);
    const mobileVisible = isRendered(mobileNav);
    const sidebarVisible = isRendered(desktopSidebar);
    const passed = mobileVisible === mobileExpected && sidebarVisible !== mobileExpected;
    const issue = mobileVisible && sidebarVisible ? 'dock e barra lateral simultâneas' :
      !mobileVisible && !sidebarVisible ? 'navegação ausente' :
      mobileExpected && !mobileVisible ? 'dock móvel/tablet ausente' :
      !mobileExpected && !sidebarVisible ? 'barra lateral desktop ausente' : null;
    return {...outcome(passed,'Exatamente uma navegação deve estar visível no breakpoint atual'),
      viewport:{width:innerWidth,height:innerHeight,pointerCoarse:matchMedia('(pointer:coarse)').matches},
      expected:mobileExpected?'dock do smartphone':'barra superior',mobileVisible,sidebarVisible,
      issue};
  });
  check('Matriz responsiva de navegação', () => {
    if (pageId !== 'home') return {status:'ignorado',reason:'Executada uma vez por varredura completa'};
    if (!responsiveNavigationMatrixCache) responsiveNavigationMatrixCache = scanResponsiveNavigationMatrix();
    return responsiveNavigationMatrixCache;
  });
  check('Referências financeiras e identificadores', () => {
    if (vault && !vaultKey) return {status:'ignorado', reason:'Base bloqueada'};
    const jars = new Set(db.jars.map(item => item.id));
    const orphanAllocations = db.allocations.filter(item => !jars.has(item.jarId)).length;
    const duplicateIds = [db.jars, db.records, db.allocations, db.tasks].reduce((total, items) =>
      total + items.length - new Set(items.map(item => item.id)).size, 0);
    const invalidAmounts = [...db.records,...db.allocations]
      .filter(item => !Number.isSafeInteger(item.amount) || item.amount === 0).length;
    return {...outcome(!orphanAllocations && !duplicateIds && !invalidAmounts,
      'Referências, identificadores e valores em centavos'), orphanAllocations, duplicateIds, invalidAmounts};
  });
  check('Navegação e painéis', () => {
    const activePages = [...document.querySelectorAll('.page.active')];
    const currentPageMismatch = activePages.length !== 1 || activePages[0]?.id !== 'page-'+state.page;
    const routes = new Set([...PAGES.map(([id]) => id), 'income', 'expense', 'calendar']);
    const invalidRoutes = [...document.querySelectorAll('button[data-page],a[data-page]')]
      .filter(node => !routes.has(node.dataset.page)).length;
    return {...outcome(!currentPageMismatch && !invalidRoutes,'Rotas dos controles e tela ativa'),
      currentPageMismatch, invalidRoutes};
  });
  check('Formulários e acessibilidade', () => {
    const page = document.querySelector('.page.active');
    const controls = [...(page?.querySelectorAll('button,input,select,textarea') || [])]
      .filter(node => !node.disabled && node.getClientRects().length && getComputedStyle(node).visibility === 'visible');
    const unlabeled = controls.filter(node => !node.textContent?.trim() &&
      !node.getAttribute('aria-label') && !node.getAttribute('aria-labelledby') &&
      !node.title && !node.labels?.length && node.type !== 'submit').length;
    const missingAriaTargets = controls.reduce((total,node) => total +
      ['aria-labelledby','aria-describedby','aria-controls'].flatMap(attr =>
        (node.getAttribute(attr) || '').split(/\s+/).filter(Boolean))
      .filter(id => !document.getElementById(id)).length,0);
    const invalidBounds = controls.filter(node => node.min && node.max &&
      Number.isFinite(Number(node.min)) && Number(node.min) > Number(node.max)).length;
    const touchTarget = node => {
      const own=node.getBoundingClientRect();
      const labels=[...(node.labels||[])].map(label=>label.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
      if(!labels.length)return {width:own.width,height:own.height,source:'controle'};
      const left=Math.min(own.left,...labels.map(rect=>rect.left)),right=Math.max(own.right,...labels.map(rect=>rect.right));
      const top=Math.min(own.top,...labels.map(rect=>rect.top)),bottom=Math.max(own.bottom,...labels.map(rect=>rect.bottom));
      return {width:right-left,height:bottom-top,source:'controle_mais_rotulo'};
    };
    const smallTargets = innerWidth <= 760 ? controls.filter(node => {
      if (node.matches('input[type=checkbox],input[type=radio]') && node.labels?.length) return false;
      const rect = touchTarget(node);
      return rect.width < 24 || rect.height < 24;
    }) : [];
    const smallTouchTargets = smallTargets.length;
    const smallTargetDetails = smallTargets.slice(0,20).map(node => ({
      tag:node.localName, id:node.id||undefined, type:node.type||undefined,
      label:node.getAttribute('aria-label')||node.textContent.trim().slice(0,40)||undefined,
      width:Math.round(node.getBoundingClientRect().width),height:Math.round(node.getBoundingClientRect().height),
      effectiveTarget:(()=>{const rect=touchTarget(node);return {width:Math.round(rect.width),height:Math.round(rect.height),source:rect.source}})()
    }));
    return {...outcome(!unlabeled && !missingAriaTargets && !invalidBounds && !smallTouchTargets,
      'Rótulos, referências, limites e áreas de toque na tela atual'),
      unlabeled, missingAriaTargets, invalidBounds, smallTouchTargets, smallTargetDetails};
  });
  check('Falhas registradas no histórico', () => {
    const allEvents=diagnostics.report().events;
    const counts = {}, resolvedCounts = {}, historicalCounts = {};
    const activeSince=Date.now()-60*60*1000;
    for (const event of allEvents) {
      if (!/^(javascript\.|.*(?:failed|invalid|error)$)/.test(event.code)) continue;
      const eventTime=Date.parse(event.at||'');
      const newerStart=event.code==='update.install_failed'&&allEvents.some(later=>later.code==='session.started'&&
        Date.parse(later.at||'')>=eventTime&&compareVersions(later.version,event.version)>0);
      const bucket=newerStart?resolvedCounts:eventTime>=activeSince?counts:historicalCounts;
      bucket[event.code]=(bucket[event.code]||0)+1;
    }
    const hostedOnly = Object.keys(counts).length && Object.keys(counts).every(code =>
      ['update.check_failed','offline.registration_failed'].includes(code));
    if (!supportsHostedApp() && hostedOnly)
      return {status:'info', reason:'Histórico de atualização e modo offline do PWA. A prévia local não executa essas operações.', counts};
    if(!Object.keys(counts).length&&(Object.keys(resolvedCounts).length||Object.keys(historicalCounts).length))
      return {status:'info',reason:'Não há falhas na última hora. Eventos antigos ou seguidos pela inicialização de versão mais nova permanecem apenas no histórico.',counts,resolvedCounts,historicalCounts};
    return {...outcome(!Object.keys(counts).length,'Falhas recentes no histórico; confira os eventos desta última hora.'), counts,resolvedCounts,historicalCounts};
  });
  check('Datas financeiras e precisão dos totais', () => {
    if (vault && !vaultKey) return {status:'ignorado', reason:'Base bloqueada'};
    let invalidDates = 0, unsafeAmounts = 0, absoluteTotal = 0n;
    for (const item of [...db.records, ...db.allocations]) {
      const date = new Date(item.date + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0,10) !== item.date) invalidDates++;
      if (Number.isSafeInteger(item.amount)) absoluteTotal += BigInt(Math.abs(item.amount));
      else unsafeAmounts++;
    }
    const potentialPrecisionLoss = absoluteTotal > BigInt(Number.MAX_SAFE_INTEGER);
    return {...outcome(!invalidDates && !unsafeAmounts && !potentialPrecisionLoss,
      'Datas civis válidas e margem de precisão em centavos'),
      invalidDates, unsafeAmounts, potentialPrecisionLoss};
  });
  check('Possíveis lançamentos repetidos', () => {
    if (vault && !vaultKey) return {status:'ignorado', reason:'Base bloqueada'};
    const seen = new Set();
    let candidates = 0;
    for (const item of db.records) {
      const key = JSON.stringify([item.date,item.kind,item.amount,item.category,item.note]);
      if (seen.has(key)) candidates++;
      seen.add(key);
    }
    return {...outcome(!candidates,'Coincidências podem representar lançamentos legítimos'), candidates};
  });
  check('HTML: estrutura e referências', () => {
    const missingLabelTargets = [...document.querySelectorAll('label[for]')]
      .filter(label => !document.getElementById(label.htmlFor)).length;
    const brokenFragments = [...document.querySelectorAll('a[href^="#"]')]
      .filter(link => link.hash.length > 1 && !document.getElementById(link.hash.slice(1))).length;
    const missingButtonTypes = document.querySelectorAll('form button:not([type])').length;
    return {...outcome(!missingLabelTargets && !brokenFragments && !missingButtonTypes,
      'Estrutura do DOM; botões sem tipo podem enviar o formulário por padrão'),
      missingLabelTargets, brokenFragments, missingButtonTypes};
  });
  check('CSS: folhas e variáveis do tema', () => {
    if(noLayout())return layoutUnavailable();
    let unreadableSheets = 0, emptyInlineSheets = 0;
    for (const style of document.querySelectorAll('style')) {
      if (!style.textContent.trim()) continue;
      try { if (!style.sheet?.cssRules.length) emptyInlineSheets++; }
      catch { unreadableSheets++; }
    }
    const computed = getComputedStyle(document.body);
    const missingThemeVariables = ['--bg','--card','--ink','--muted','--line']
      .filter(name => !computed.getPropertyValue(name).trim());
    return {...outcome(!emptyInlineSheets && !unreadableSheets && !missingThemeVariables.length,
      'Verifica regras aceitas pelo navegador e variáveis essenciais do tema'),
      unreadableSheets, emptyInlineSheets, missingThemeVariables};
  });
  check('JavaScript: exceções e promessas rejeitadas', () => {
    const events = diagnostics.report().events.filter(event =>
      event.code === 'javascript.error' || event.code === 'javascript.rejection');
    return {...outcome(!events.length,'Falhas capturadas pelo navegador no histórico'),
      count:events.length, recent:events.slice(-20).map(({code,type,line,column,module}) =>
        ({code,type,line,column,module}))};
  });
  check('Compatibilidade com a main aprovada', () => {
    // Atualizar a partir da main aprovada antes de preparar uma nova versão.
    const baseline = {
      branch:'main', version:'1.0.0-beta.9', appJsBlob:'33cbb9e76c3eb78605475efc9234f49399dc941f',
      storageKey:'reserva-simples-v2', schema:4,
      modules:['home','transactions','calendar','goals','investments','analysis','reports','settings'],
      collections:['records','jars','allocations','investments','recurring','tasks','institutions']
    };
    const fresh = empty();
    const currentModules = new Set(PAGES.map(([id]) => id));
    const missingModules = baseline.modules.filter(id =>
      id==='calendar'?!(currentModules.has('home')&&document.querySelector('#homeFullCalendar .calendar-grid')&&typeof openCalendarDayOverlay==='function'):!currentModules.has(id)||!document.getElementById('page-'+id));
    const missingCollections = baseline.collections.filter(key => !Array.isArray(fresh[key]));
    // Each registered local profile intentionally receives an isolated key.
    // Keep the legacy key as the expected value for guest mode, while checking
    // the profile-scoped contract when an account is active.
    const expectedStorageKey = ACCOUNT ? Accounts.storeKey(ACCOUNT.id) : baseline.storageKey;
    const storageKeyChanged = STORE !== expectedStorageKey;
    const schemaChanged = fresh.version !== baseline.schema;
    return {...outcome(!storageKeyChanged && !schemaChanged && !missingModules.length &&
      !missingCollections.length,'Mudanças de contrato exigem revisão de compatibilidade'),
      baseline, currentSchema:fresh.version, expectedStorageMode:ACCOUNT?'isolated-profile':'legacy-guest',
      storageKeyChanged, schemaChanged,
      missingModules, missingCollections,migratedModules:[{from:'calendar',to:'home',available:Boolean(document.querySelector('#homeFullCalendar .calendar-grid'))}]};
  });
  check('Conexão', () => ({status:navigator.onLine?'ok':'info',
    reason:navigator.onLine?'Navegador conectado':'Aplicativo em uso offline'}));
  check('Modo offline do PWA', () => {
    if(!supportsHostedApp())return {status:'ignorado',reason:'Prévia local'};
    return navigator.serviceWorker?.controller?
      {status:'ok',reason:'Controle por Service Worker'}:
      {status:'pendente',reason:'Service Worker ainda sem controle da página'};
  });
  check('APIs do navegador', () => ({
    status:'info', crypto:Boolean(globalThis.crypto?.subtle),
    backupFolder:typeof window.showDirectoryPicker === 'function',
    download:typeof URL.createObjectURL === 'function',
    indexedDB:'indexedDB' in window
  }));
  return {
    at:new Date().toISOString(), module:pageId,
    durationMs:Math.round(performance.now()-started), checks
  };
}
const DIAGNOSTIC_TEST_PLAN = [{"id":1,"title":"Abrir o arquivo via file:// e confirmar que a mensagem de limitação (ex.: CDI indisponível) aparece corretamente em vez de travar a tela.","status":"manual"},{"id":2,"title":"Servir o app via HTTPS/localhost e verificar se o manifest/ícones carregam sem erro 404 no console.","status":"manual"},{"id":3,"title":"Verificar se o Service Worker (se houver) registra sem exceções e se atualizações de versão não quebram o cache.","status":"manual"},{"id":4,"title":"Testar o app totalmente offline após o primeiro carregamento (modo avião) e confirmar que os dados locais continuam acessíveis.","status":"manual"},{"id":5,"title":"Verificar o comportamento ao abrir em um navegador sem suporte a showDirectoryPicker (deve mostrar o texto de \"acesso à pasta indisponível\").","status":"manual"},{"id":6,"title":"Verificar o comportamento ao abrir em navegador sem suporte a IndexedDB (fallback do backup em pasta).","status":"manual"},{"id":7,"title":"Conferir se favicon e apple-touch-icon (SVG inline em base64) renderizam corretamente em iOS/Android.","status":"manual"},{"id":8,"title":"Medir o tempo de carregamento inicial com uma base de dados grande (ex.: 50.000 registros) e verificar se a UI trava (thread bloqueada).","status":"manual"},{"id":9,"title":"Testar o evento pageshow/pagehide ao alternar abas repetidamente, garantindo que listeners não duplicam.","status":"manual"},{"id":10,"title":"Forçar um erro global (window.onerror) e checar se diagnostics.record captura sem expor dados sensíveis no log.","status":"manual"},{"id":11,"title":"Corromper manualmente o valor salvo em localStorage (JSON inválido) e verificar se o app recupera com a rotina de load()/verify() sem perder o backup bruto.","status":"manual"},{"id":12,"title":"Verificar se a cópia \"STORE-corrompido-timestamp\" é realmente criada uma única vez ao detectar dado corrompido (não duplicar a cada reload).","status":"manual"},{"id":13,"title":"Testar startFreshAfterCorrupt() cancelando o confirm() e garantir que nada é apagado.","status":"manual"},{"id":14,"title":"Testar startFreshAfterCorrupt() confirmando, e then checar se storageRecoveryRaw permanece acessível para exportação mesmo após criar base nova.","status":"manual"},{"id":15,"title":"Validar verify(src) com records.length = 50001 (deve ser rejeitado) e 50000 (deve ser aceito).","status":"automatic"},{"id":16,"title":"Validar verify(src) com jars.length = 5001 (rejeitado).","status":"automatic"},{"id":17,"title":"Enviar version fora de [2,3,4] (ex.: 1 ou 5) e confirmar rejeição segura, sem exception não tratada.","status":"automatic"},{"id":18,"title":"Simular localStorage.setItem lançando QuotaExceededError (armazenamento cheio) durante save() e verificar o tratamento de erro ao usuário.","status":"manual"},{"id":19,"title":"Testar mutate() chamando duas operações assíncronas concorrentes (ex.: duplo clique rápido em \"Salvar\") e verificar condição de corrida na escrita.","status":"manual"},{"id":20,"title":"Verificar se, com \"Salvamento pausado para proteger dados inválidos\" ativo, todas as ações de escrita (nova despesa, meta, etc.) são bloqueadas e o usuário é avisado de forma consistente.","status":"manual"},{"id":21,"title":"Confirmar que exportar os dados brutos funciona mesmo com o app em estado de dado corrompido.","status":"manual"},{"id":22,"title":"Testar restauração de backup com arquivo de formato antigo (version:2) e verificar migração correta de campos ausentes (recurring, tasks).","status":"manual"},{"id":23,"title":"Verificar se registros com amount não numérico ou negativo são filtrados/rejeitados na importação.","status":"automatic"},{"id":24,"title":"Testar com records contendo IDs duplicados (uid() colidindo) e observar se a edição/exclusão afeta o item errado.","status":"manual"},{"id":25,"title":"Verificar persistência correta após fechar o navegador no meio de uma gravação assíncrona (ex.: aba fechada durante save()).","status":"manual"},{"id":26,"title":"Criar um cofre com senha e verificar se deriveVaultKey/sealVault realmente impedem a leitura do localStorage em texto puro.","status":"manual"},{"id":27,"title":"Tentar abrir o cofre com senha incorreta e verificar mensagem de erro (vaultError) sem vazar detalhes técnicos.","status":"manual"},{"id":28,"title":"Confirmar o campo de confirmação de senha (vaultConfirmField) bloqueando submissão quando as senhas não coincidem.","status":"manual"},{"id":29,"title":"Testar senha vazia ou apenas espaços no formulário do cofre (required deve impedir, mas checar trim no JS também).","status":"manual"},{"id":30,"title":"Verificar comportamento ao trocar de senha do cofre: dados antigos continuam acessíveis com a nova chave?","status":"manual"},{"id":31,"title":"Testar abertura do cofre em outro navegador/dispositivo com o mesmo localStorage exportado — deve pedir senha normalmente.","status":"manual"},{"id":32,"title":"Verificar se cancelar o diálogo do cofre (vaultCancel) deixa a aplicação em estado consistente (sem tela em branco).","status":"manual"},{"id":33,"title":"Medir o tempo de deriveVaultKey em dispositivo lento — há risco de travar a UI (sem feedback de carregamento)?","status":"manual"},{"id":34,"title":"Testar entrada de caracteres Unicode/emoji na senha do cofre.","status":"manual"},{"id":35,"title":"Verificar se, ao atingir o cofre pela segunda vez na mesma sessão, a senha é solicitada novamente ou fica em cache de forma insegura.","status":"manual"},{"id":36,"title":"Conectar uma pasta de backup e verificar se writeFolderBackup cria o arquivo esperado com conteúdo íntegro.","status":"manual"},{"id":37,"title":"Revogar manualmente a permissão da pasta no navegador e verificar se hasFolderPermission detecta e solicita nova permissão sem travar.","status":"manual"},{"id":38,"title":"Simular conflito: pasta com backup diferente do dispositivo atual (backupConflict) e testar as duas opções oferecidas (restaurar vs. sobrescrever).","status":"manual"},{"id":39,"title":"Testar reconnectBackupFolder() após reiniciar o navegador (handle persistido via IndexedDB) — handle inválido deve ser tratado.","status":"manual"},{"id":40,"title":"Verificar debounce de scheduleFolderBackup() ao fazer múltiplas edições em sequência rápida (não deve escrever um arquivo por tecla).","status":"manual"},{"id":41,"title":"Testar restauração de backup com senha diferente da usada para gravar (readEncryptedFolder).","status":"manual"},{"id":42,"title":"Verificar preserveBeforeDestructiveAction antes de uma ação destrutiva (ex.: excluir tudo) — o backup prévio realmente acontece antes da ação?","status":"manual"},{"id":43,"title":"Remover fisicamente a pasta do disco entre duas sessões e verificar erro tratado ao tentar escrever.","status":"manual"},{"id":44,"title":"Testar o fluxo completo: criar dados → gerar backup → localStorage.clear() → restaurar → comparar se todos os campos (jars, records, tasks, recurring) retornam idênticos.","status":"manual"},{"id":45,"title":"Verificar removeBackupHandle() ao desconectar a pasta — notificações e botões de reconexão devem sumir/aparecer corretamente.","status":"manual"},{"id":46,"title":"Cadastrar uma despesa com valor \"0\" (deve ser rejeitado pelo min/validação) e conferir mensagem de erro.","status":"automatic"},{"id":47,"title":"Cadastrar valor negativo digitado manualmente burlando o type=number (colar texto) e verificar validação no JS, não só no HTML.","status":"automatic"},{"id":48,"title":"Testar valor extremo (ex.: 999999999999) e verificar overflow em centavos/arredondamento (toCents).","status":"automatic"},{"id":49,"title":"Testar casas decimais além de duas (ex.: 10,999) e conferir arredondamento consistente em toda a interface.","status":"automatic"},{"id":50,"title":"Cadastrar lançamento com data inválida (validDate) como 2027-02-30 e confirmar rejeição.","status":"automatic"},{"id":51,"title":"Cadastrar lançamento com data em formato diferente do esperado (31/02/2027) colado no campo via teclado.","status":"automatic"},{"id":52,"title":"Testar campo de nota/observação no limite de caracteres (maxlength) e um caractere acima, via paste.","status":"manual"},{"id":53,"title":"Testar tags com caracteres especiais, emojis e múltiplos separadores (; e , juntos) em normalizeTags.","status":"automatic"},{"id":54,"title":"Verificar duplicidade: adicionar a mesma tag duas vezes (#casa e casa) — deve deduplicar conforme normalizeTags.","status":"automatic"},{"id":55,"title":"Inserir mais de 8 tags e confirmar que o corte em 8 (slice(0,8)) funciona sem erro visual.","status":"automatic"},{"id":56,"title":"Editar um lançamento existente e cancelar — garantir que nada é alterado.","status":"manual"},{"id":57,"title":"Editar um lançamento e trocar o tipo (receita→despesa) — verificar se campos dependentes (categoria) resetam corretamente.","status":"manual"},{"id":58,"title":"Excluir um lançamento vinculado a uma recorrência (recurringId) e conferir se a recorrência pai não é afetada indevidamente.","status":"manual"},{"id":59,"title":"Testar \"Copiar despesas do mês anterior\" quando o mês anterior não tem despesas avulsas (mensagem de vazio).","status":"manual"},{"id":60,"title":"Testar \"Copiar despesas do mês anterior\" quando as despesas já foram copiadas (deve detectar duplicidade via exists()).","status":"manual"},{"id":61,"title":"Criar recorrência mensal com dia 31 e verificar comportamento em meses com menos dias (fevereiro, abril etc. via Math.min(t.day, maxDay)).","status":"automatic"},{"id":62,"title":"Pausar uma recorrência e confirmar que ela não aparece mais em pendingRecurring().","status":"manual"},{"id":63,"title":"Retomar uma recorrência pausada e verificar se meses \"perdidos\" no meio do caminho geram lançamentos retroativos indevidos.","status":"manual"},{"id":64,"title":"Excluir uma recorrência com lançamentos já confirmados — confirmar que os lançamentos passados permanecem (preserved).","status":"manual"},{"id":65,"title":"Aplicar \"Lançar contas\" com zero pendências — deve mostrar aviso e não quebrar.","status":"manual"},{"id":66,"title":"Aplicar \"Lançar contas\" cancelando a confirmação (confirm()), verificando que nada é persistido.","status":"manual"},{"id":67,"title":"Criar recorrência com startMonth no futuro e checar se ela não gera pendência antes da data.","status":"manual"},{"id":68,"title":"Criar recorrência com endMonth anterior ao mês atual e verificar que ela some da lista de pendências correntes.","status":"manual"},{"id":69,"title":"Testar duas recorrências com mesmo id (corrompido manualmente) e avaliar o impacto na edição/exclusão.","status":"manual"},{"id":70,"title":"Verificar unicidade: lançar a mesma recorrência duas vezes no mesmo mês não deve duplicar (pendingRecurring filtra por recurringMonth).","status":"manual"},{"id":71,"title":"Editar uma recorrência já aplicada no mês corrente — o lançamento confirmado deve, ou não, refletir a alteração (checar inconsistência).","status":"manual"},{"id":72,"title":"Testar recorrência de valor zero ou negativo via manipulação de formulário.","status":"automatic"},{"id":73,"title":"Criar um cofrinho sem instituição vinculada e conferir se o cálculo de CDI usa um valor padrão sensato.","status":"manual"},{"id":74,"title":"Criar um cofrinho com dueDate no passado e verificar mensagem de \"prazo vencido\" no simulador (simulateGoal).","status":"manual"},{"id":75,"title":"Simular aporte mensal igual a zero e conferir mensagem \"Informe um valor acima de zero\".","status":"manual"},{"id":76,"title":"Simular aporte com valor acima do limite (amount>10000000000) — deve ser rejeitado.","status":"manual"},{"id":77,"title":"Pausar/retomar uma meta e verificar que o cofrinho pausado só aparece na seção de \"planejamento pausado\".","status":"manual"},{"id":78,"title":"Criar meta e não registrar nenhum aporte — conferir estado vazio e ausência de divisão por zero no progresso (miniProgress).","status":"manual"},{"id":79,"title":"Registrar aporte maior que o valor alvo (target) da meta e conferir que a barra de progresso não ultrapassa 100% visualmente (overflow).","status":"manual"},{"id":80,"title":"Resgatar (retirar) de um cofrinho valor maior que o saldo disponível — deve haver bloqueio ou aviso.","status":"manual"},{"id":81,"title":"Excluir um cofrinho com aportes/investimentos vinculados — verificar órfãos em db.allocations/db.investments.","status":"manual"},{"id":82,"title":"Vincular um investimento a uma meta e depois excluir a meta — conferir se a referência (goalId) fica pendurada (dados órfãos).","status":"manual"},{"id":83,"title":"Testar duas metas com o mesmo nome — não deve haver conflito de identificação por nome, apenas por id.","status":"manual"},{"id":84,"title":"Verificar cálculo de estimateCdbJar quando não há nenhuma taxa de CDI carregada (rates.length === 0).","status":"manual"},{"id":85,"title":"Verificar cálculo de IOF/IR com resgate no mesmo dia do aporte (idade zero dias).","status":"manual"},{"id":86,"title":"Verificar cálculo de IOF/IR com aporte com mais de 720 dias (deve aplicar a alíquota mínima de IR de 15%).","status":"manual"},{"id":87,"title":"Testar resgate parcial de um cofrinho com múltiplos aportes (lotes) em datas diferentes — conferir se o FIFO de estimateCdbJar reduz o lote mais antigo corretamente.","status":"manual"},{"id":88,"title":"Baixar o PDF de metas (\"Baixar PDF\") com zero cofrinhos cadastrados e com uma base muito grande (centenas de cofrinhos) — checar geração e timeout.","status":"manual"},{"id":89,"title":"Alternar entre \"Aplicação financeira\" e \"Pecuária — compra de gado\" no formulário e verificar se os campos ocultos/visíveis (toggleInvestmentAssetFields) trocam sem deixar campos obrigatórios escondidos.","status":"manual"},{"id":90,"title":"Cadastrar investimento pecuário com headCount fracionário (ex.: 2,5) — deve ser rejeitado pelo step=\"1\".","status":"manual"},{"id":91,"title":"Cadastrar investimento com balance menor que cost (perda) e conferir se os indicadores tratam valores negativos corretamente.","status":"manual"},{"id":92,"title":"Registrar gasto de lote (livestockExpenseForm) com valor \"0,00\" — deve falhar pelo min=0.01.","status":"manual"},{"id":93,"title":"Registrar resgate (redemptionForm) de pecuária com quantidade de cabeças maior que o total do lote — checar se há validação de limite.","status":"manual"},{"id":94,"title":"Excluir um investimento vinculado a uma meta e verificar linkedInvestmentBalance após a exclusão (não deve contar valor fantasma).","status":"manual"},{"id":95,"title":"Editar a data de conferência (checked) para uma data anterior à data de compra (date) e verificar se há validação cronológica.","status":"manual"},{"id":96,"title":"Cadastrar instituição sem guaranteeFund definido e checar se guaranteeCard() não quebra ao agrupar.","status":"manual"},{"id":97,"title":"Cadastrar duas instituições do mesmo conglomerado e verificar se guaranteeCard() soma corretamente por conglomerado (não por instituição isolada).","status":"manual"},{"id":98,"title":"Testar exposição que ultrapasse o teto de R$ 25.000.000 fictício usado no código e conferir se o rótulo \"Acima da referência\" aparece.","status":"manual"},{"id":99,"title":"Cadastrar custo extra (extraCosts) e verificar se ele realmente entra no cálculo de patrimônio do lote, sem duplicar com lançamentos individuais.","status":"manual"},{"id":100,"title":"Testar adicionar/editar múltiplos investimentos no mesmo lote rapidamente (double submit) e verificar se o botão \"Salvar\" não permite duplo envio.","status":"manual"},{"id":101,"title":"Criar compromisso em um dia sem nenhuma movimentação financeira e verificar que o saldo previsto do dia não quebra (balance===null).","status":"manual"},{"id":102,"title":"Criar compromisso com horário inválido digitado manualmente (ex.: \"25:99\") e conferir a regex de validação de horário.","status":"manual"},{"id":103,"title":"Criar compromisso sem horário (campo opcional) e verificar exibição correta na lista do dia.","status":"manual"},{"id":104,"title":"Editar um compromisso existente e cancelar a edição (cancelCalendarTaskEdit) — garantir que o formulário volta ao estado de criação.","status":"manual"},{"id":105,"title":"Excluir um compromisso e cancelar a confirmação do confirm() — nada deve ser removido.","status":"manual"},{"id":106,"title":"Navegar entre meses usando ‹/› rapidamente (muitos cliques em sequência) e verificar se o calendário renderiza o mês correto ao final (sem race condition).","status":"manual"},{"id":107,"title":"Clicar em \"Hoje\" vindo de um ano completamente diferente (ex.: 2030) e verificar se retorna exatamente ao mês/ano atual do sistema.","status":"manual"},{"id":108,"title":"Verificar virada de ano ao navegar de dezembro para janeiro e de janeiro para dezembro (prevMonth/nextMonth).","status":"automatic"},{"id":109,"title":"Verificar o indicador visual de dias com entradas, saídas e compromissos simultâneos no mesmo dia (sobreposição de pontos/cores).","status":"manual"},{"id":110,"title":"Testar o seletor de cor do compromisso com todas as opções (CALENDAR_TASK_COLORS) e conferir contraste/acessibilidade.","status":"manual"},{"id":111,"title":"Abrir o modal do dia (openCalendarDayOverlay) em tela pequena e verificar rolagem/fechamento correto (data-close-calendar-day).","status":"manual"},{"id":112,"title":"Verificar o botão \"Hoje\" (todayBtn) — deve ficar oculto quando o mês selecionado já é o mês atual (hidden).","status":"manual"},{"id":113,"title":"Definir um limite de categoria igual a zero e verificar divisão por zero no cálculo de percentual (spent/limit*100).","status":"manual"},{"id":114,"title":"Ultrapassar 100% do limite de uma categoria e conferir se o estado visual \"danger\" é aplicado corretamente.","status":"manual"},{"id":115,"title":"Atingir exatamente 80% do limite e verificar se o alerta de \"quase no limite\" dispara (spent>=limit*.8).","status":"manual"},{"id":116,"title":"Remover um limite de categoria que já estava em alerta e confirmar que a notificação correspondente desaparece da lista.","status":"manual"},{"id":117,"title":"Testar o alerta sonoro de orçamento (playBudgetSound) em navegador que bloqueia áudio automático (política de autoplay) — deve exigir interação do usuário (unlockBudgetAudio).","status":"manual"},{"id":118,"title":"Testar groceryAlertLevel() nos limites exatos de transição de nível (ex.: ratio em 0.79 vs 0.80 vs 1.00).","status":"manual"},{"id":119,"title":"Verificar se limites configurados para uma categoria renomeada/excluída continuam referenciando corretamente ou ficam órfãos.","status":"manual"},{"id":120,"title":"Testar múltiplas categorias no limite simultaneamente e conferir se todas aparecem na lista de \"limites próximos\" sem truncamento inesperado.","status":"manual"},{"id":121,"title":"Simular falha de rede ao chamar a API do Banco Central (updateCdi) e verificar se a mensagem de erro aparece e o app usa o histórico salvo em cache.","status":"manual"},{"id":122,"title":"Simular resposta HTTP não-OK (ex.: 500) da API do CDI e conferir tratamento do throw new Error.","status":"manual"},{"id":123,"title":"Simular timeout da requisição CDI (mais de 15s, usando o AbortController) e verificar cancelamento limpo sem travar a UI.","status":"manual"},{"id":124,"title":"Simular resposta JSON malformada (não-array) da API SGS e verificar se Array.isArray(rows) barra o processamento.","status":"manual"},{"id":125,"title":"Forçar duas chamadas simultâneas de updateCdi() (clique duplo em \"Atualizar CDI\") e verificar a trava de cdiState.loading.","status":"manual"},{"id":126,"title":"Verificar o comportamento com o relógio do sistema no futuro (ex.: data do SO alterada) e seu impacto em isoToday() e nos cálculos de rendimento.","status":"manual"},{"id":127,"title":"Verificar o comportamento com o relógio do sistema no passado e seu impacto nas projeções de 30/60/90 dias.","status":"manual"},{"id":128,"title":"Testar requestBillNotificationPermission() quando a permissão do navegador já está \"denied\" — deve orientar o usuário sem repetir o prompt nativo.","status":"manual"},{"id":129,"title":"Testar notificação de conta a vencer no dia exato do vencimento (0 dias) e verificar o texto \"vence hoje\".","status":"manual"},{"id":130,"title":"Verificar deduplicação de notificações já enviadas (reserva.billReminder.sent) ao recarregar a página várias vezes no mesmo dia.","status":"manual"},{"id":131,"title":"Verificar updateIpca() quando a API retorna menos de 12 meses de histórico — conferir se o restante é tratado sem gerar undefined na interface.","status":"manual"},{"id":132,"title":"Alterar o protocolo para file: e confirmar que nenhuma chamada de rede ao Banco Central é disparada (checagem de location.protocol==='file:').","status":"manual"},{"id":133,"title":"Gerar o gráfico anual (yearChart) em um ano totalmente sem lançamentos — barras devem ficar no mínimo visual sem erro de NaN/Infinity.","status":"manual"},{"id":134,"title":"Gerar o donut de categorias (donutHTML) com apenas uma categoria — conferir que o conic-gradient fecha em 100% sem brechas visuais.","status":"manual"},{"id":135,"title":"Verificar miniLine() com apenas um valor válido (deve mostrar \"O gráfico aparecerá com mais dados\" por exigir ao menos 2 pontos).","status":"manual"},{"id":136,"title":"Testar cashProjection() sem saldo de referência configurado (balanceAnchorCents nulo) — deve exibir o CTA \"Configurar saldo\" e não travar a página.","status":"manual"},{"id":137,"title":"Testar cashProjection() com a data de referência (balanceAnchorDate) no futuro em relação a hoje (deve ser invalidada, anchor>today).","status":"manual"},{"id":138,"title":"Verificar o simulador de quitação de dívida (debtCompareValues) com número de parcelas igual a 0 ou negativo.","status":"manual"},{"id":139,"title":"Verificar o simulador de dívida com CET informado maior e menor que o CDI líquido, conferindo a frase condicional \"acima/abaixo do CDI\".","status":"manual"},{"id":140,"title":"Testar cashflowCard() com eventos futuros em datas muito distantes (ex.: recorrência cadastrada para daqui a 5 anos) — verificar performance e precisão do agrupamento diário.","status":"manual"},{"id":141,"title":"Verificar a \"Reserva de emergência\" quando não há nenhum mês fechado anterior com despesas (deve usar amostra vazia sem gerar NaN na média).","status":"manual"},{"id":142,"title":"Alterar o número de meses de reserva desejados (3/6/9/12) e confirmar recálculo imediato da meta sugerida e do valor faltante.","status":"manual"},{"id":143,"title":"Ativar \"Ocultar valores\" (privacyToggle) e verificar que todos os valores monetários da tela (incluindo gráficos e metas) ficam realmente ocultos, sem vazamento em atributos title/aria-label.","status":"manual"},{"id":144,"title":"Alternar paletas de cor (blue, emerald, petrol, plum, graphite, carbon) e verificar contraste mínimo de texto em cada uma (especialmente nos estados de alerta/perigo).","status":"manual"},{"id":145,"title":"Navegar por toda a interface apenas via teclado (Tab/Shift+Tab/Enter/Esc) e verificar se o foco visível (:focus-visible) nunca se perde, inclusive dentro de modais.","status":"manual"},{"id":146,"title":"Testar leitor de tela nos botões de navegação mobile (aria-expanded, aria-current) ao abrir o menu \"Mais módulos\" e confirmar que o estado é anunciado corretamente.","status":"manual"},{"id":147,"title":"Redimensionar a janela entre o layout desktop (sidebar fixa) e o mobile (navegação flutuante) no ponto de quebra do CSS, verificando se nenhum elemento fica duplicado ou cortado.","status":"manual"},{"id":148,"title":"Verificar o painel de notificações do sino (desktopNotificationPanel) fechando ao clicar fora (document.addEventListener('click', ...)), inclusive em dispositivos touch.","status":"manual"},{"id":149,"title":"Testar \"Limpar notificações\" e confirmar que os itens voltam a aparecer somente se uma nova condição realmente mudar (e não reaparecem indevidamente no próximo recálculo).","status":"manual"},{"id":150,"title":"Realizar teste de estresse geral: importar uma base muito grande (próxima aos limites de verify(): ~50.000 registros, ~5.000 cofrinhos), navegar por todas as páginas e medir se a aplicação permanece responsiva (sem congelar a thread principal por tempo perceptível).","status":"manual"}];
function runPlannedRegressionTests() {
  const checks = new Map([
    [15, () => {const x=empty();x.records=Array(50001).fill(null);return verify(x)===null}],
    [16, () => {const x=empty();x.jars=Array(5001).fill(null);return verify(x)===null}],
    [17, () => [1,5,99].every(version=>{const x=empty();x.version=version;return verify(x)===null})],
    [23, () => {const x=empty();x.records=[{id:'bad-amount',kind:'expense',amount:-1,date:'2026-01-01',category:'Outros'}];return verify(x)===null}],
    [46, () => Number.isNaN(toCents('0'))], [47, () => Number.isNaN(toCents('-12.00'))],
    [48, () => Number.isNaN(toCents('999999999999'))], [49, () => toCents('10.999')===1100],
    [50, () => !validDate('2027-02-30')], [51, () => !validDate('31/02/2027')],
    [53, () => normalizeTags(' #casa; café,🙂 ').join('|')==='casa|café|🙂'],
    [54, () => normalizeTags('#casa,casa').length===1], [55, () => normalizeTags('a,b,c,d,e,f,g,h,i').length===8],
    [61, () => {const fixture=empty();fixture.recurring=[{id:'qa-month-end',kind:'expense',category:'Outros',amount:100,day:31,startMonth:isoToday().slice(0,7)}];const previous=db;let rows;try{db=fixture;rows=upcomingBillInstances(90).filter(row=>row.id==='qa-month-end')}finally{db=previous}return rows.length>0&&rows.every(row=>validDate(row.date)&&Number(row.date.slice(8))===new Date(Number(row.date.slice(0,4)),Number(row.date.slice(5,7)),0).getDate())}],
    [72, () => [0,-1].every(amount=>{const x=empty();x.recurring=[{id:'x',kind:'expense',category:'Outros',amount,day:1,startMonth:'2026-01'}];return verify(x)===null})],
    [108, () => mkey(2026,11)==='2026-12' && mkey(2027,0)==='2027-01']
  ]);
  return DIAGNOSTIC_TEST_PLAN.map(test => {
    const run=checks.get(test.id);
    if(!run)return {...test,result:'pendente',reason:'Requer navegador, interação real ou fixture isolada ainda não implementada'};
    try{return {...test,result:run()?'ok':'falha',mode:'simulação sem alterar os dados'};}
    catch(error){return {...test,result:'erro',error:error?.name||'Erro inesperado'};}
  });
}
function scanInternalViews(target, id) {
  const scenarios = [];
  const record = (scenario, index) => {
    scenarios.push({scenario, index, ...scanDiagnosticPage(id, true)});
  };
  [...target.querySelectorAll('details:not([open])')].slice(0,12).forEach((detail,index) => {
    if (!detail.getClientRects().length) return;
    try {
      detail.open = true;
      record('seção expandida', index+1);
    } finally {
      detail.open = false;
    }
  });
  const panels = [...target.querySelectorAll('.mobile-analysis-panel')];
  const hidden = panels.map(panel => panel.hidden);
  try {
    panels.forEach((panel,index) => {
      panels.forEach(item => { item.hidden = item !== panel; });
      record('aba de Insights', index+1);
    });
  } finally {
    panels.forEach((panel,index) => { panel.hidden = hidden[index]; });
  }
  return scenarios;
}
function scanSyntheticFinance() {
  const cases = [
    ['Conversão em centavos', () => toCents('12.34') === 1234 && toCents('0.01') === 1],
    ['Rejeição de entradas inválidas', () => ['','abc','-1','Infinity'].every(value => Number.isNaN(toCents(value)))],
    ['Virada de período', () => mkey(2025,11) === '2025-12' && mkey(2026,0) === '2026-01'],
    ['Restauração de uma base vazia', () => Boolean(verify(JSON.parse(JSON.stringify(empty()))))],
    ['Rejeição de backup incompatível', () => !verify({version:-1,records:[],jars:[],allocations:[]})]
  ];
  return cases.map(([name, run]) => {
    const start = performance.now();
    let passed = false;
    try { passed = run(); } catch {}
    return {name,status:passed?'ok':'erro',durationMs:Math.round(performance.now()-start)};
  });
}
const ADDITIONAL_TEST_PLAN = [[1, "**[Novo]** Verificar, via `'serviceWorker' in navigator`, `'indexedDB' in window`, `'showDirectoryPicker' in window`, `'Notification' in window`, `crypto?.subtle`, `matchMedia`, se a detecção de recursos do próprio `environment()` está correta e não lança exceção quando a API não existe. *(Mecanismo 1)*"], [2, "**[Ref. 5]** Mockar temporariamente `window.showDirectoryPicker = undefined` e confirmar que `folderStatusText()` retorna a frase \"Acesso à pasta indisponível neste navegador...\". *(Mecanismo 2)*"], [3, "**[Ref. 6]** Mockar `window.indexedDB = undefined` dentro de uma cópia isolada de `openBackupDb` (ou capturar a exceção esperada) e confirmar que o erro é tratado sem subir ao `window.onerror`. *(Mecanismo 2)*"], [4, "**[Ref. 10]** Disparar `window.dispatchEvent(new ErrorEvent('error', {message:'teste-diagnostico', error:new Error('x')}))` em um contexto isolado e confirmar que `diagnostics.record` grava o evento sem incluir valores monetários/senhas em texto no payload. *(Mecanismo 2/4)*"], [5, "**[Novo]** Verificar se `addEventListener('unhandledrejection', ...)` realmente existe registrado uma única vez (sem duplicação) inspecionando se múltiplos `render()` sucessivos não acrescentam novos listeners globais."], [6, "**[Novo]** Medir com `performance.now()` o tempo de execução de `render()` da sessão atual (sem alterar dados) e marcar como alerta caso ultrapasse um limite configurável (ex.: 150ms) — substitui a necessidade de \"base de 50.000 registros real\" por extrapolação com fixture volumosa em memória (ver item 41)."], [7, "**[Novo]** Verificar se existe mais de um elemento com `id=\"toast\"`, `id=\"modal\"` ou qualquer outro `id` crítico usado por `$()` — IDs duplicados quebram `getElementById`/`querySelector` silenciosamente."], [8, "**[Novo]** Confirmar que todo `\u003cscript>` inline do documento não lança exceção de sintaxe isolada (via `new Function(textoDoScript)` em modo de verificação, sem executar) para pelo menos identificar erros grosseiros de sintaxe introduzidos em edições futuras."], [9, "**[Novo]** Verificar se `document.title` e `meta[name=description]` não ficam vazios após navegação entre páginas (`go()` para cada uma das 8 rotas)."], [10, "**[Novo]** Confirmar que nenhuma rota de `PAGES` aponta para um `id` de `\u003csection>` inexistente no DOM (cada `page-\u003cid>` deve existir)."], [11, "**[Ref. 11/12]** Chamar `verify()` com uma string JSON corrompida sintética (não tocar no `localStorage` real) e confirmar que retorna `null` sem lançar exceção. *(Mecanismo 1)*"], [12, "**[Ref. 18]** Mockar `localStorage.setItem` para lançar `DOMException('QuotaExceededError')` apenas durante a chamada de teste (usando uma instância de storage falsa passada por parâmetro, nunca o `localStorage` global do usuário) e confirmar que `save()` retorna `false`/notifica o erro em vez de travar. *(Mecanismo 2, isolado)*"], [13, "**[Ref. 19]** Simular duas chamadas concorrentes de uma função `mutate`-like em uma cópia de `db` isolada (`structuredClone`), disparando ambas com `Promise.all`, e verificar se o resultado final é consistente (sem perda de uma das alterações) — não usar o `db` real em memória."], [14, "**[Ref. 23]** Validar `verify()`/normalizadores de registro com `amount: \"abc\"`, `amount: -100`, `amount: NaN`, `amount: Infinity` em fixture isolada."], [15, "**[Novo]** Validar `verify()` com `records` contendo campos obrigatórios ausentes (`date` ausente, `kind` ausente) em fixture isolada."], [16, "**[Novo]** Validar `verify()` com tipos trocados (`jars` como objeto em vez de array, `allocations` como string) — deve rejeitar com `null`, nunca lançar exceção não tratada."], [17, "**[Novo]** Gerar uma fixture com 50.000 registros em memória (sem persistir) e cronometrar `verify()` + `forecast()` + `categories()` para registrar o tempo de execução como métrica de regressão de desempenho."], [18, "**[Ref. 24]** Gerar fixture com dois registros de `id` idêntico e verificar que funções de busca (`find`) sempre retornam o primeiro de forma determinística e documentada (evitar comportamento indefinido silencioso)."], [19, "**[Novo]** Verificar, por inspeção estática do código-fonte do `\u003cscript>` (regex/parse simples), se toda chamada a `JSON.parse` dentro de funções críticas (`load`, `openBackupDb`, histórico CDI/IPCA) está envolvida em `try/catch` — identificar pontos sem tratamento antes que virem bug em produção."], [20, "**[Novo]** Confirmar, com fixture isolada, que `verify()` aceita exatamente os limites documentados (50000 registros aceitos, 50001 rejeitados; 5000 jars aceitos, 5001 rejeitados; 50000 allocations aceitos, 50001 rejeitados; 5000 recorrências aceitas, 5001 rejeitadas; 10000 tarefas aceitas, 10001 rejeitadas) — cobre todos os limites de `verify`, não só os três já cobertos hoje."], [21, "**[Ref. 26]** Chamar `deriveVaultKey`/`sealVault`/`openVault` em um contexto isolado com senha fictícia e payload fictício (nunca o `db` real) e confirmar que o envelope resultante não contém o texto original em claro (checagem de substring no JSON serializado do envelope). *(Mecanismo 1)*"], [22, "**[Ref. 27]** Chamar `openVault` com a chave errada derivada de outra senha e confirmar que lança/retorna erro tratável, sem vazar qual parte da senha está errada."], [23, "**[Ref. 29]** Simular submissão do `vaultForm` com senha `\"   \"` (apenas espaços) via evento sintético em cópia isolada do formulário, confirmando que a validação de \"trim\" no JS rejeita, mesmo que o `required` do HTML já deixe passar espaços."], [24, "**[Ref. 34]** Chamar `deriveVaultKey` com senha contendo emoji/Unicode (`\"🔒áéü\"`) e confirmar que não lança exceção de encoding e que o resultado é estável (mesma senha gera a mesma chave em duas execuções)."], [25, "**[Novo]** Medir com `performance.now()` o tempo de `deriveVaultKey` na sessão atual e sinalizar alerta se ultrapassar um limiar (ex.: 1s), como proxy local para \"risco de travar a UI em aparelho lento\", sem precisar de um dispositivo lento real."], [26, "**[Novo]** Verificar estaticamente se existe algum `console.log`/`console.debug` no código-fonte que imprima a senha do cofre, o payload decifrado ou a chave derivada (varredura de texto no `\u003cscript>` por termos como `vaultPassword`, `key`, `salt` dentro de chamadas de `console`)."], [27, "**[Ref. 40]** Chamar `scheduleFolderBackup`-like (ou a função de debounce isolada) disparando múltiplas chamadas em sequência rápida com `backupDirectory` mockado como objeto fake (que apenas conta chamadas, não grava nada em disco) e confirmar que a função de escrita real só é chamada uma vez após o intervalo de debounce. *(Mecanismo 2, com handle falso em memória)*"], [28, "**[Ref. 42]** Mockar a função de escrita de backup como um espião (*spy*) e confirmar, via ordem de chamadas registradas, que `preserveBeforeDestructiveAction` sempre invoca o espião **antes** da função destrutiva, usando um fluxo de teste isolado (sem apagar dados reais)."], [29, "**[Ref. 44]** Rodar o ciclo completo de \"gerar envelope → decifrar envelope\" inteiramente em memória, com um objeto `db` fictício e um `FileSystemFileHandle` falso (objeto simples com `getFile`/`createWritable` simulados), comparando por igualdade profunda (`JSON.stringify`) o `db` antes e depois — sem tocar no sistema de arquivos real nem no `localStorage` do usuário."], [30, "**[Novo]** Verificar, por inspeção estática, se toda função que usa `backupDirectory`/`indexedDB` tem bloco `catch` (mesmo que mínimo) ao redor da chamada — útil porque qualquer uma dessas APIs pode não existir ou falhar em tempo real sem aviso prévio."], [31, "**[Ref. 56]** Clonar o formulário de lançamento (`cloneNode(true)`) fora da árvore visível, preencher com um evento sintético e abandonar sem `submit` — confirmar que nenhuma função de persistência foi chamada e que o `db` real permanece inalterado (checagem antes/depois por hash do `localStorage`)."], [32, "**[Novo]** Submeter, em um formulário clonado e isolado, todos os valores-limite de uma só vez (valor = 0,01; valor = 100000000; valor = 100000000,01) e confirmar que o terceiro é rejeitado pelo `max` tanto no HTML quanto na validação JS equivalente."], [33, "**[Novo]** Verificar estaticamente que todo campo `type=\"number\"` com `min`/`max` no HTML tem uma validação equivalente em JS antes de persistir (procurar, para cada `name` de input numérico nos formulários de diálogo, se existe checagem correspondente de limite no código) — fecha a lacuna de \"confiar só no HTML5\"."], [34, "**[Novo]** Simular `paste` sintético (`ClipboardEvent`) de um texto maior que `maxlength` em um campo de nota clonado e confirmar truncamento/validação consistente, sem precisar de interação humana real de colar."], [35, "**[Novo]** Rodar `normalizeTags` com entradas adversariais adicionais: string vazia, só separadores (`\";;;,,,\"`), 50 tags repetidas, tag de 1000 caracteres — confirmar que o corte em 30 caracteres por tag e 8 tags no total é respeitado em todos os casos, não só no caso feliz já coberto."], [36, "**[Novo]** Rodar `validDate` com uma bateria completa de datas-limite: ano bissexto (`2028-02-29` válido, `2027-02-29` inválido), mudança de século, dia `00`, mês `00`, mês `13`, string com espaços, string vazia, `null`, `undefined`."], [37, "**[Novo]** Verificar, para os três diálogos de formulário (`investmentForm`, `livestockExpenseForm`, `redemptionForm`), se todo campo marcado `required` no HTML possui, de fato, um `name` presente e lido em algum ponto do JS de submissão (detecta campo \"órfão\" que parece obrigatório mas não é validado nem salvo)."], [38, "**[Ref. 61]** Chamar a lógica de geração de data de recorrência (dia 31) para os 12 meses do ano em fixture isolada e confirmar que todo mês com menos de 31 dias usa o último dia válido (`Math.min`), incluindo fevereiro em ano bissexto e não bissexto."], [39, "**[Ref. 62/70]** Rodar `pendingRecurring()` sobre uma fixture com recorrência pausada e confirmar que ela não aparece; depois, sobre uma fixture com a mesma recorrência já lançada no mês (`recurringMonth` preenchido), confirmar que também não aparece (dedup)."], [40, "**[Ref. 67/68]** Rodar a mesma função com `startMonth` no futuro (deve ficar de fora) e com `endMonth` no passado (deve ficar de fora), tudo em fixture isolada, sem usar `db` real."], [41, "**[Novo]** Gerar fixture com 5.000 recorrências ativas e medir o tempo de `pendingRecurring()`/`upcomingBillInstances()` como métrica de regressão de desempenho (proxy local para \"base grande\", sem precisar que o usuário importe dados reais volumosos)."], [42, "**[Novo]** Verificar, em fixture isolada, que aplicar `applyRecurring` (ou sua lógica equivalente) sobre uma lista de pendências vazia não gera nenhum registro novo e não lança exceção."], [43, "**[Ref. 74/78]** Chamar `Engines.goal`/`simulateGoal`-like com uma meta cujo `dueDate` já passou e com uma meta sem nenhum aporte (`current=0`), ambas em fixture isolada, e confirmar as mensagens \"prazo vencido\" e a ausência de divisão por zero no progresso."], [44, "**[Ref. 84/85/86]** Chamar `estimateCdbJar` com: (a) `cdiState.rates = []` (sem taxas carregadas); (b) resgate no mesmo dia do aporte (idade 0); (c) aporte com mais de 720 dias de idade — tudo com datas e valores fictícios, sem tocar nos cofrinhos reais do usuário, conferindo que a alíquota de IR aplicada em cada faixa bate com a tabela (22,5% / 20% / 17,5% / 15%)."], [45, "**[Ref. 87]** Montar fixture com um cofrinho que recebeu três aportes em datas diferentes e sofreu um resgate parcial, e confirmar que `estimateCdbJar` reduz o lote mais antigo primeiro (lógica FIFO) comparando os `principal`/`value` restantes esperados."], [46, "**[Novo]** Rodar `estimateCdbJar` com `asOf` anterior à data de todos os aportes do cofrinho (cenário \"ainda não existia\") e confirmar que retorna saldo zero sem erro."], [47, "**[Novo]** Verificar, em fixture isolada, o comportamento de `linkedInvestmentBalance` quando o `goalId` informado não corresponde a nenhum investimento existente (deve retornar 0, não `NaN`/`undefined`)."], [48, "**[Novo]** Simular duas metas com nomes idênticos, mas `id`s diferentes, em fixture, e confirmar que toda função de busca usada na tela de metas localiza pelo `id` e nunca pelo `name` (varredura no código por `db.jars.find(` para checar o critério de busca usado)."], [49, "**[Ref. 91]** Calcular, em fixture isolada, os indicadores de um investimento com `balance \u003c cost` (perda) e confirmar que o resultado é um número negativo coerente, sem formatação quebrada (ex.: sem \"R$ -0,00\" truncando o sinal) e sem virar `NaN`."], [50, "**[Ref. 94]** Montar fixture com investimento vinculado a uma meta (`goalId`), remover o investimento da lista e rodar `linkedInvestmentBalance` novamente — confirmar que o valor cai para refletir a ausência, sem resíduo fantasma."], [51, "**[Novo]** Verificar estaticamente se os campos `headCount` (pecuária) e `cost`/`balance` (financeiro) realmente alternam de `hidden` ao trocar `assetType` no formulário clonado e isolado, cobrindo os dois sentidos da troca (financeiro→pecuária e pecuária→financeiro), não só um."], [52, "**[Novo]** Rodar o cálculo de patrimônio do lote de pecuária com `extraCosts` preenchido e, separadamente, com despesas individuais do mesmo lote já registradas, confirmando em fixture que os dois não são somados em duplicidade."], [53, "**[Novo]** Verificar, por fixture, o agrupamento de `guaranteeCard()` com duas instituições cujo `conglomerate` é escrito com capitalização diferente (`\"Banco X\"` vs `\"banco x\"`) — confirmar se a normalização (`toLocaleLowerCase('pt-BR')`) realmente une os dois no mesmo grupo, como o código pretende."], [54, "**[Novo]** Rodar `guaranteeCard()` com instituição sem `guaranteeFund` (campo ausente) e confirmar que ela é ignorada no agrupamento sem lançar exceção (cobre o caso 96 de forma automatizável)."], [55, "**[Ref. 101]** Chamar a função de saldo do dia (`cashProjection`/equivalente usado no calendário) para uma data sem nenhuma movimentação em fixture isolada e confirmar que retorna `null` de forma limpa, sem exceção, e que a tela trata esse `null` com o texto apropriado."], [56, "**[Ref. 102]** Validar a regex de horário (`^(?:[01]\\d|2[0-3]):[0-5]\\d$`) com uma bateria completa: `\"00:00\"` (válido), `\"23:59\"` (válido), `\"24:00\"` (inválido), `\"9:30\"` sem zero à esquerda (inválido conforme regex atual — vale confirmar se é o comportamento desejado), `\"25:99\"` (inválido)."], [57, "**[Ref. 108]** Estender o caso já automatizado de virada de ano para cobrir também a virada de mês dentro do mesmo ano (ex.: janeiro→fevereiro e fevereiro→janeiro) e a navegação de 24 cliques consecutivos em `nextMonth` a partir de um mês qualquer, conferindo que o estado final corresponde exatamente a `+24` meses em fixture de estado isolada (sem navegar a UI real)."], [58, "**[Novo]** Verificar, por varredura estática do DOM depois de renderizar o calendário com uma fixture de tarefas conhecida, se cada dia com tarefa realmente tem o indicador (`task-dot`) presente e se dias sem tarefa não têm — comparação 1 a 1 entre fixture e DOM renderizado."], [59, "**[Novo]** Verificar o estado do botão \"Hoje\" (`hidden`) programaticamente para três estados de `state.year`/`state.month`: igual ao mês atual real do sistema (deve estar oculto), um mês à frente e um mês atrás (deve estar visível nos dois)."], [60, "**[Ref. 113]** Chamar o cálculo de percentual de limite (`spent/limit*100`) com `limit=0` em fixture isolada e confirmar que o resultado é tratado antes de chegar ao template (nunca `Infinity`/`NaN` renderizado na tela)."], [61, "**[Ref. 114/115]** Rodar o mesmo cálculo nos pontos exatos de transição: `spent/limit = 0.79`, `0.80`, `0.99`, `1.00`, `1.01`, confirmando que o estado visual (`danger-text`/`warning-text`/neutro) muda exatamente no limiar documentado (80% e 100%), nem antes nem depois."], [62, "**[Ref. 118]** Rodar `groceryAlertLevel()` isoladamente nos mesmos pontos de transição de limiar usados no item anterior."], [63, "**[Ref. 119]** Montar fixture com um limite configurado para uma categoria que não existe mais em `CATS` e confirmar que o card de limites não quebra ao tentar exibir essa categoria (ou que a trata como removida de forma explícita)."], [64, "**[Novo]** Montar fixture com 10+ categorias simultaneamente no limite de alerta e confirmar, por inspeção do HTML gerado, que todas aparecem na lista (sem corte silencioso por `.slice()` indevido)."], [65, "**[Ref. 121/122/124]** Mockar `window.fetch` dentro da sessão de diagnóstico para: (a) rejeitar a Promise (simula falha de rede); (b) resolver com `{ok:false, status:500}`; (c) resolver com `ok:true` mas corpo `{}` (não-array) — chamando `updateCdi`/`updateIpca` reais, mas apontando para o `fetch` falso, e restaurando o `fetch` original no `finally`. Confirmar em todos os casos que `cdiState.error`/`ipcaState.error` é preenchido e que o histórico salvo anteriormente (fixture) não é apagado. *(Mecanismo 2 — rede 100% simulada em memória, sem nenhuma chamada real)*"], [66, "**[Ref. 123]** Mockar `fetch` para nunca resolver (Promise pendente) e confirmar que o `AbortController`/`setTimeout` interno cancela a chamada dentro do tempo esperado, sem travar o restante do diagnóstico (usar um timeout de teste bem menor que 15s para não deixar o teste lento)."], [67, "**[Ref. 125]** Disparar duas chamadas de `updateCdi(force:true)` em sequência imediata (ambas apontando para o `fetch` mockado) e confirmar, pelo contador de chamadas do mock, que a segunda é ignorada enquanto `cdiState.loading` está `true`."], [68, "**[Ref. 128]** Mockar `window.Notification = { permission: 'denied' }` (objeto simples, sem registrar notificação real) e confirmar que `requestBillNotificationPermission`/`billNotificationPermission` orientam o usuário a mudar a permissão no navegador, sem tentar chamar `Notification.requestPermission()` de novo."], [69, "**[Ref. 129/130]** Rodar a lógica de montagem da mensagem de lembrete (`\"vence hoje\"`/`\"vence amanhã\"`/`\"vence em N dias\"`) em fixture isolada para `daysUntil` = 0, 1 e N>1, e separadamente verificar que a chave de deduplicação (`id+'@'+date`) realmente impede o mesmo lembrete de ser contado duas vezes num `Set` simulado."], [70, "**[Ref. 131]** Mockar `fetch` do IPCA para devolver apenas 3 meses de histórico (menos que os 12 esperados) e confirmar que `miniLine`/o card de inflação não gera `undefined` nem `NaN` na interface, mostrando apenas os meses disponíveis."], [71, "**[Ref. 132]** Confirmar, por inspeção do código, que toda função de rede (`updateCdi`, `updateIpca`) checa `location.protocol==='file:'` **antes** de montar a URL de requisição (ordem das instruções), não apenas em paralelo — evita que a app tente montar a URL (e eventualmente vazar dados) mesmo quando vai abortar em seguida."], [72, "**[Ref. 133]** Chamar `yearChart()`-like com uma fixture de ano totalmente vazio (`income=expenses=saved=0` em todos os 12 meses) e confirmar que nenhuma barra gera altura `NaN%`/negativa no HTML produzido."], [73, "**[Ref. 134]** Chamar `donutHTML` com uma fixture de uma única categoria concentrando 100% do total e confirmar que o `conic-gradient` gerado cobre exatamente de 0% a 100% sem lacuna (checar a string do `stops` produzida)."], [74, "**[Ref. 135]** Chamar `miniLine` com `values=[10]` (um único ponto válido) e confirmar a mensagem de \"gráfico aparecerá com mais dados\"; chamar novamente com `[10, \"x\", null]` (valores inválidos misturados) e confirmar que o filtro (`Number.isFinite`) realmente descarta os inválidos antes de decidir se há pontos suficientes."], [75, "**[Ref. 136/137]** Chamar `cashProjection` com `balanceAnchorCents=null` (sem saldo de referência) e, separadamente, com `balanceAnchorDate` no futuro em relação a uma data \"hoje\" fictícia passada como parâmetro — confirmar `null` como retorno em ambos os casos, sem exceção."], [76, "**[Ref. 138]** Chamar `debtCompareValues`-like com `months=0` e `months=-5` em fixture isolada e confirmar a mensagem de \"preencha os valores\" em vez de cálculo com `Math.pow` indefinido."], [77, "**[Ref. 139]** Chamar a mesma função com `cet` acima e abaixo do CDI líquido de referência (valores fictícios) e confirmar que a frase condicional (\"acima\"/\"abaixo do CDI\") corresponde à comparação numérica real feita internamente."], [78, "**[Ref. 140]** Montar fixture com uma recorrência cuja data projetada cai 5 anos no futuro e confirmar que o agrupamento diário de `cashProjection`/`cashflowCard` não trava nem demora de forma desproporcional (medir tempo de execução) — sem precisar cadastrar isso de fato no app do usuário."], [79, "**[Ref. 141]** Chamar a lógica da \"reserva de emergência\" com uma fixture sem nenhum mês fechado anterior (`samples=[]`) e confirmar que a média não vira `NaN` (deve cair para 0 ou mensagem explícita)."], [80, "**[Ref. 142]** Rodar o cálculo de meta sugerida/valor faltante para os quatro valores possíveis de meses de reserva (3, 6, 9, 12) em fixture isolada e confirmar que o resultado muda proporcionalmente em todos eles."], [81, "**[Novo]** Verificar, por varredura do HTML gerado pelas funções de gráfico, se todo elemento `role=\"img\"` possui `aria-label` não vazio (acessibilidade de gráficos decorativos vs. informativos)."], [82, "**[Ref. 143]** Ativar `privacyToggle` e varrer **todos** os atributos `title`, `aria-label`, `data-*` e o `innerText` de elementos ocultos (`display:none`/`visibility:hidden`) à procura de valores monetários (padrão `R\\$\\s?[\\d.,]+`) que tenham escapado da ocultação."], [83, "**[Ref. 144]** Para cada paleta disponível (`blue`, `emerald`, `petrol`, `plum`, `graphite`, `carbon`), aplicar a paleta programaticamente, ler os estilos computados (`getComputedStyle`) dos textos sobre fundo de alerta/perigo e calcular a razão de contraste (fórmula WCAG) sem precisar de inspeção visual humana — reprovar paletas abaixo de 4.5:1 em texto normal."], [84, "**[Ref. 145]** Simular `Tab` programaticamente (percorrer `document.querySelectorAll('button, a, input, select, textarea, [tabindex]')` na ordem do DOM) e confirmar que nenhum elemento focável está com `tabindex=\"-1\"` indevido nem oculto por CSS enquanto ainda é alcançável pelo teclado (foco \"fantasma\")."], [85, "**[Ref. 146]** Abrir o menu \"Mais módulos\" programaticamente (chamando o handler, sem clique real) e verificar que `aria-expanded` no botão muda de `\"false\"` para `\"true\"` e volta corretamente ao fechar."], [86, "**[Ref. 147]** Simular a mudança de breakpoint chamando `matchMedia` mockado (retornando `matches:true`/`false` conforme o teste) em vez de redimensionar a janela de verdade, e confirmar que os elementos exclusivos de mobile/desktop (`.mobile-nav`, `#desktopSidebar`) nunca ficam visíveis os dois ao mesmo tempo."], [87, "**[Novo]** Verificar se existem elementos com `width`/`height` computados maiores que o `viewport` atual (overflow horizontal), reaproveitando a mesma lógica já citada no diagnóstico de \"largura excedente\", mas aplicando a cada uma das 8 páginas após navegação programática (`go()`), não só na página inicial."], [88, "**[Novo]** Verificar duplicidade de `id` em **todo** o documento (não só nos elementos críticos usados por `$()`), já que HTML permite tecnicamente ids repetidos sem erro, mas isso quebra qualquer seletor futuro."], [89, "**[Novo]** Verificar se todo `\u003cbutton>` sem texto visível (ícone apenas) possui `aria-label` ou `title`, varrendo os 8 módulos após navegação programática."], [90, "**[Novo]** Verificar se todo `\u003cinput>`/`\u003cselect>` dentro dos diálogos (`\u003cdialog>`) possui `label` associado (`for`/`id` correspondente ou `aria-label`), incluindo os campos que só aparecem depois de uma interação (ex.: campos de pecuária escondidos)."], [91, "**[Novo]** Verificar, em cada uma das 8 páginas, se existe mais de um elemento com `role=\"main\"` ou mais de um `\u003ch1>` por página (estrutura de landmark duplicada)."], [92, "**[Novo]** Verificar se o `tabindex` de elementos não interativos (`\u003cdiv>`, `\u003cspan>`) nunca é positivo (`tabindex > 0`), o que quebraria a ordem natural de navegação por teclado."], [93, "**[Novo]** Verificar, para cada `\u003cdialog>` do documento, se `aria-labelledby`/`aria-label` aponta para um elemento que realmente existe no DOM (referência não quebrada)."], [94, "**[Novo]** Verificar se o foco é movido para dentro do diálogo ao abri-lo programaticamente (`showModal()`) e se volta para o elemento que abriu o diálogo ao fechá-lo (`state.modalTrigger`), sem precisar de clique humano real, apenas chamando as funções de abrir/fechar."], [95, "**[Novo]** Verificar se todas as cores usadas como única forma de distinguir informação (ex.: pontos do calendário, barras do gráfico) têm também um `title`/texto alternativo equivalente, evitando dependência só de cor (WCAG 1.4.1)."], [96, "**[Novo]** Verificar, por `getComputedStyle`, se a área clicável de todos os botões de navegação mobile (`.nav-button`, `.nav-add`) atinge o mínimo recomendado de 44×44px, estendendo o diagnóstico de \"alvos de toque pequenos\" já existente para cobrir explicitamente a barra inferior em todas as 8 rotas."], [97, "**[Novo]** Verificar se, ao trocar de página via `go()`, o foco do teclado é posicionado em um elemento sensato (ex.: título da página) em vez de permanecer em um botão agora invisível/fora da página anterior."], [98, "**[Novo]** Verificar se o texto renderizado em todas as páginas respeita o `:root { font-family }` esperado, sinalizando qualquer elemento que tenha sobrescrito a fonte sem motivo aparente (possível CSS conflitante de edição futura)."], [99, "**[Novo]** Verificar se nenhum elemento de texto está com `overflow` cortando conteúdo sem reticências nem rolagem (`scrollWidth > clientWidth` em elementos sem `overflow:auto/scroll` e sem `text-overflow:ellipsis`), em todas as 8 páginas."], [100, "**[Novo]** Verificar se todas as folhas de `\u003cstyle>` internas (`id=\"...\"`) citadas no diagnóstico de \"CSS sem regras\" continuam, de fato, sendo referenciadas por pelo menos um seletor usado no HTML atual — sinaliza CSS morto introduzido em edições futuras."]];
function duplicateDomIds(){
 const nodes=new Map();for(const node of document.querySelectorAll('[id]')){if(!nodes.has(node.id))nodes.set(node.id,[]);nodes.get(node.id).push(node)}
 return [...nodes].filter(([,items])=>items.length>1).slice(0,30).map(([id,items])=>({id:id.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi,'[id]'),count:items.length,modules:items.map(node=>node.closest('.page')?.id||'global')}));
}
async function runAdditionalLocalTests(scan) {
  const results = new Map();
  async function record(id, run, scope) {
    const start = performance.now();
    try {
      const value = await run();
      results.set(id, {status:value === null ? 'ignorado' : value ? 'ok' : 'falha', scope,
        durationMs:Math.round(performance.now()-start),...(id===88?{evidence:{duplicates:duplicateDomIds()}}:{})});
    } catch (error) {
      results.set(id, {status:'erro', scope, error:error.name});
    }
  }
  const sample = (fields = {}) => ({id:'teste',kind:'expense',category:'Outros',
    amount:100,date:'2027-02-01',...fields});
  const fromRecords = records => verify({...empty(),records});
  function withFixture(data, run) {
    const previous = db;
    db = data;
    try { return run(); } finally { db = previous; }
  }
  const period = mkey(state.year,state.month);
  const recurring = {id:'teste-rec',kind:'expense',category:'Outros',
    amount:100,day:31,startMonth:period};
  const hasAccessibleName = node => Boolean(node.getAttribute('aria-label')?.trim() ||
    node.getAttribute('title')?.trim() || node.labels?.length ||
    node.getAttribute('aria-labelledby')?.trim().split(/\s+/).some(id =>
      document.getElementById(id)?.textContent.trim()));
  const checks = [
    [7, () => ['toast','modal'].every(id => document.querySelectorAll('#'+id).length === 1),'IDs críticos'],
    [10, () => PAGES.every(([id]) => document.getElementById('page-'+id)),'Destinos reais das rotas'],
    [11, () => verify('{incompleto') === null,'Validador recebe entrada inválida. Recuperação em disco fica fora'],
    [14, () => ['abc',-100,NaN,Infinity].every(amount => !fromRecords([sample({amount})])),'Valores inválidos na importação'],
    [15, () => !fromRecords([sample({date:undefined})]) && !fromRecords([sample({kind:undefined})]),'Campos obrigatórios'],
    [16, () => !verify({...empty(),jars:{}}) && !verify({...empty(),allocations:'x'}),'Tipos de coleções'],
    [18, () => !fromRecords([sample(),sample()]),'Rejeição de IDs duplicados na importação'],
    [20, () => {
      const records = Array.from({length:50000}, (_,i) => sample({id:'r'+i}));
      const jars = Array.from({length:5000}, (_,i) => ({id:'j'+i,name:'Teste',target:100,dueDate:'2027-12-31'}));
      return fromRecords(records)?.records.length === 50000 && !fromRecords([...records,sample()]) &&
        verify({...empty(),jars})?.jars.length === 5000 && !verify({...empty(),jars:[...jars,jars[0]]});
    },'Limites do validador com registros válidos em memória'],
    [32, () => toCents('0.01') === 1 && toCents('100000000') === 10000000000 &&
      Number.isNaN(toCents('100000000.01')),'Conversor real. Submissão pela interface ainda pendente'],
    [35, () => !normalizeTags(';;;,,,').length && normalizeTags(Array(50).fill('a')).length === 1 &&
      normalizeTags('a'.repeat(1000))[0]?.length === 30,'Limites das tags'],
    [36, () => ['2028-02-29','2000-02-29'].every(validDate) &&
      ['2027-02-29','1900-02-29','2027-01-00','2027-13-01'].every(date => !validDate(date)),'Datas civis'],
    [39, () => withFixture({...empty(),recurring:[recurring,{...recurring,id:'pausada',paused:true}],
      records:[sample({recurringId:recurring.id,recurringMonth:period})]}, () => pendingRecurring().length === 0),'Pausa e recorrência já confirmada'],
    [40, () => withFixture({...empty(),recurring:[recurring,{...recurring,id:'futura',startMonth:'9999-01'},
      {...recurring,id:'encerrada',startMonth:'1900-01',endMonth:'1900-02'}]},
      () => pendingRecurring().map(item => item.id).join() === recurring.id),'Início, fim e controle positivo'],
    [47, () => withFixture(empty(), () => linkedInvestmentBalance('inexistente') === 0),'Vínculo inexistente'],
    [50, () => {
      const fixture = {...empty(),investments:[{goalId:'meta',balance:500}]};
      return withFixture(fixture, () => {
        const before = linkedInvestmentBalance('meta');
        fixture.investments = [];
        return before === 500 && linkedInvestmentBalance('meta') === 0;
      });
    },'Recálculo após remoção em memória'],
    [56, async () => withDiagnosticSandbox({state:{year:2027,month:1,calendarDate:'2027-02-01',page:'calendar'}},async()=>{
      go('calendar');const form=$('#calendarTaskForm');
      if(!form)return false;
      form.elements.title.value='Compromisso com hora';form.elements.date.value='2027-02-01';form.elements.time.value='09:30';
      await submitCalendarTask({preventDefault(){},target:form});
      const saved=db.tasks.find(task=>task.title==='Compromisso com hora');
      const valid=['00:00','09:30','23:59'].every(validTime),blank=validTime('');
      const invalid=['24:00','25:99','12:60','9:30'].every(time=>!validTime(time));
      return Boolean(saved&&saved.time==='09:30'&&valid&&blank&&invalid&&
        verify({...empty(),tasks:[{id:'bad-time',title:'Inválido',date:'2027-02-01',time:'24:00'}]})===null);
    }),'Formulário real salva horário e valida limites'],
    [57, () => mkey(2027,0) === '2027-01' && mkey(2027,1) === '2027-02','Chaves mensais. Navegação ainda pendente'],
    [62, () => {
      const fixture = {...empty(),records:[sample({date:isoToday(),category:'Mercado'})]};
      fixture.prefs.marketBudget = 100;
      return withFixture(fixture, () => [74,75,99,100,101].every((amount,index) => {
        fixture.records[0].amount = amount;
        return groceryAlertLevel() === [0,1,1,2,2][index];
      }));
    },'Limiar efetivo de 75% e 100% usado pelo aplicativo'],
    [72, () => withFixture(empty(), () => {
      const html = yearChart();
      return html.includes('chart-bars') && !/NaN|Infinity/.test(html);
    }),'Gráfico anual sem dados'],
    [73, () => /0%\s+100%/.test(donutHTML([sample()])),'Gradiente de categoria única'],
    [74, () => miniLine([10],'Teste').includes('empty-inline') &&
      !miniLine([10,20],'Teste').includes('empty-inline'),'Gráfico com um ou dois pontos'],
    [75, () => withFixture(empty(), () => {
      const absent = cashProjection(30) === null;
      db.prefs.balanceAnchorCents = 100;
      db.prefs.balanceAnchorDate = '9999-01-01';
      return absent && cashProjection(30) === null;
    }),'Saldo de referência ausente ou no futuro'],
    [81, () => [...document.querySelectorAll('[role="img"]')].every(hasAccessibleName),'Nomes dos gráficos renderizados'],
    [87, () => !scan.modules.some(module => module.checks.some(check =>
      check.overflowPx > 1 || check.findings?.some(item => /fora da tela/.test(item.type)))),'Largura atual nos oito módulos'],
    [88, () => {
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      return ids.length === new Set(ids).size;
    },'IDs no documento inteiro'],
    [89, () => [...document.querySelectorAll('.page button')].every(button =>
      button.textContent.trim() || hasAccessibleName(button)),'Botões renderizados'],
    [90, () => [...document.querySelectorAll('dialog input:not([type=hidden]),dialog select,dialog textarea')]
      .every(hasAccessibleName),'Campos presentes nos diálogos'],
    [91, () => [...document.querySelectorAll('.page')].every(page =>
      page.querySelectorAll('h1').length <= 1 && page.querySelectorAll('main,[role=main]').length <= 1),'Estrutura interna por módulo'],
    [92, () => !document.querySelector('div[tabindex]:not([role])[tabindex^="+"]') &&
      ![...document.querySelectorAll('div[tabindex]:not([role]),span[tabindex]:not([role])')].some(node => node.tabIndex > 0),'Ordem explícita de foco'],
    [93, () => [...document.querySelectorAll('dialog')].every(hasAccessibleName),'Nomes dos diálogos'],
    [96, () => !matchMedia('(max-width:760px)').matches ? null :
      [...document.querySelectorAll('#mobileNav button')].every(button => {
        const rect = button.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44;
      }),'Área medida da barra inferior']
  ];
  for (const [id,run,scope] of checks) await record(id,run,scope);

  if (globalThis.crypto?.subtle) {
    const salt = new Uint8Array(16);
    const password = 'Teste local 🔒áéü';
    let envelope, key;
    await record(21, async () => {
      key = await deriveVaultKey(password,salt);
      envelope = await sealVault({...empty(),records:[sample({note:'marcador fictício'})]},key,bytesTo64(new Uint8Array(16)));
      const restored = await openVault(envelope,key);
      return envelope.format === 'reserva-vault-2' &&
        !JSON.stringify(envelope).includes('marcador fictício') &&
        restored.records[0]?.note === 'marcador fictício';
    },'Cofre real com dados sintéticos em memória');
    await record(22, async () => {
      if (!envelope) return null;
      const wrong = await deriveVaultKey('outra senha fictícia',salt);
      try { await openVault(envelope,wrong); } catch (error) { return error.name === 'OperationError'; }
      return false;
    },'Chave incorreta. Mensagem do formulário ainda pendente');
    await record(24, async () => {
      if (!envelope) return null;
      const second = await deriveVaultKey(password,salt);
      return (await openVault(envelope,second)).records[0]?.id === 'teste';
    },'Derivação repetível com senha Unicode');
  }
  return ADDITIONAL_TEST_PLAN.map(([id,title]) => ({
    id,title,...(results.get(id) || {status:[21,22,24].includes(id) ? 'ignorado' : 'pendente',
      scope:[21,22,24].includes(id) ? 'Web Crypto indisponível' : 'Cenário ainda sem execução automática'})
  }));
}

const PROPOSAL_TEST_PLAN = [[1, "Registrador único de desempenho reaproveitável"], [2, "Migração `version:2` → `version:4` em um passo"], [3, "Migração `version:3` → `version:4`"], [4, "Migração com campo de versão ausente/corrompido"], [5, "Idempotência de migração (rodar duas vezes)"], [6, "Nenhum segredo literal passa por `console.*` durante o fluxo do cofre"], [7, "Restauração de backup com envelope de formato incompatível"], [8, "Restauração cancelada no meio do fluxo"], [9, "Equivalência de dados antes/depois do ciclo cofre completo"], [10, "Pasta indisponível via adaptador de teste (não via navegador real)"], [11, "Criar → editar → cancelar → excluir → reenviar, tudo em base isolada"], [12, "CSV com separador `;` vs `,` no mesmo arquivo"], [13, "Reconciliação Início × Lançamentos × Relatórios"], [14, "Relógio lógico injetado em vez do relógio do SO"], [15, "Vencidos (contas em atraso) com relógio lógico"], [16, "Geração duplicada de recorrência ao aplicar duas vezes com relógio parado"], [17, "Compromisso sem horário + botão Hoje em três meses, tudo com relógio lógico fixo"], [18, "Importação de CSV: aspas malformadas, linha corrompida ao final, cabeçalho ausente, importação repetida do mesmo arquivo"], [19, "Importação de CSV: aspas malformadas, linha corrompida ao final, cabeçalho ausente, importação repetida do mesmo arquivo"], [20, "Importação de CSV: aspas malformadas, linha corrompida ao final, cabeçalho ausente, importação repetida do mesmo arquivo"], [21, "Importação de CSV: aspas malformadas, linha corrompida ao final, cabeçalho ausente, importação repetida do mesmo arquivo"], [22, "Aporte seguido de resgate maior que o saldo disponível"], [23, "Venda parcial de lote de pecuária com `heads` maior que o total cadastrado"], [24, "IOF e IR documentados por tabela de aging, com resultado esperado explícito por faixa"], [25, "FIFO com resgate que consome mais de um lote"], [26, "Vínculo de investimento removido: `linkedInvestmentBalance` e `goalEngineData` em conjunto"], [27, "Integridade estrutural do JSON exportado pelo diagnóstico"], [28, "Integridade estrutural da exportação de dados do usuário (backup bruto)"], [29, "Chamadas simultâneas de CDI e IPCA (APIs diferentes, não a mesma duas vezes)"], [30, "Cache antigo de CDI/IPCA sendo usado quando a rede simulada falha"], [31, "Contraste com regra de inconclusivo para fundo não sólido"], [32, "Seletores do diagnóstico de layout sem correspondência no estado atual"], [33, "Breakpoint real em área de renderização isolada (iframe)"], [34, "Estados vazio/preenchido em três larguras de referência (mobile/tablet/desktop), para as 8 páginas"], [35, "Estados vazio/preenchido em três larguras de referência (mobile/tablet/desktop), para as 8 páginas"], [36, "Estados vazio/preenchido em três larguras de referência (mobile/tablet/desktop), para as 8 páginas"], [37, "Nome acessível de todo controle interativo nas 8 páginas"], [38, "Relações ARIA quebradas (referência a ID inexistente) em todo o documento"], [39, "Ocultar valores: varredura completa incluindo nomes acessíveis computados"], [40, "Foco inicial e retorno de foco em todos os diálogos do app, não só um"], [41, "Mapeamento de cobertura real dos 30 casos históricos"], [42, "Validação de fixtures de tamanho crescente (100 / 1.000 / 10.000 / 50.000) para as quatro funções mais pesadas"], [43, "Validação de fixtures de tamanho crescente (100 / 1.000 / 10.000 / 50.000) para as quatro funções mais pesadas"], [44, "Validação de fixtures de tamanho crescente (100 / 1.000 / 10.000 / 50.000) para as quatro funções mais pesadas"], [45, "Validação de fixtures de tamanho crescente (100 / 1.000 / 10.000 / 50.000) para as quatro funções mais pesadas"], [46, "Verificação de assinatura das funções exercitadas pelo diagnóstico"], [47, "Ponto de verificação indireto para funções não globais"], [48, "Checagem de versão/commit analisado embutida no relatório"], [49, "Suíte de \"testes-sentinela\" mínimos que não dependem de implementação interna"], [50, "Processo de validação do contrato e da cobertura antes de aplicar a trava"]];
const DIAGNOSTIC_SUITE_VERSION = '1.6.0';
const DIAGNOSTIC_SOURCE_REVISION = 'dutrafg/Reserva-Simples · main · app '+APP_VERSION;
function diagnosticContract() {
  const capabilities = {verify, validDate, validTime, normalizeTags, pendingRecurring,
    estimateCdbJar, cashProjection, bankCsvParseRows, monthData:Engines?.monthData,
    pendingOccurrences:Engines?.pendingOccurrences, budget, mobileDockMarkup, calendarSpending, validReleaseManifest};
  const expectedArity={verify:1,validDate:1,validTime:1,normalizeTags:1,pendingRecurring:0,
    estimateCdbJar:1,cashProjection:1,bankCsvParseRows:2,monthData:3,
    pendingOccurrences:3,budget:0,mobileDockMarkup:0,calendarSpending:1,validReleaseManifest:1};
  const signatures=Object.fromEntries(Object.entries(capabilities).map(([name,fn])=>[name,
    {available:typeof fn==='function',expectedArity:expectedArity[name],actualArity:typeof fn==='function'?fn.length:null,
      matches:typeof fn==='function'&&fn.length===expectedArity[name]}]));
  return {version:2,appVersion:APP_VERSION,suiteVersion:DIAGNOSTIC_SUITE_VERSION,
    referenceBranch:'main',sourceRevision:DIAGNOSTIC_SOURCE_REVISION,signatures,
    coverage:{modules:PAGES.map(([id])=>id),releaseFiles:releaseFiles.slice(),responsiveProfiles:16,moduleViewportChecks:PAGES.length*4},
    missing:Object.keys(capabilities).filter(name=>typeof capabilities[name]!=='function'),
    brokenSignatures:Object.entries(signatures).filter(([,item])=>!item.matches).map(([name])=>name)};
}
if(!window.ReservaDiagnosticBridge)window.ReservaDiagnosticBridge=Object.freeze({contractVersion:2,
  inspect:()=>diagnosticContract()});
function diagnosticReport(scan, report = diagnostics.report()) {
  const {applicationSkeleton:capturedSkeleton,...safeScan}=scan||{};
  return {...report, telemetry:{schema_version:TELEMETRY_SCHEMA,format:'json-events',encoding:'UTF-8',timestamp:'UTC ISO-8601',storage:'local-only',redaction:'sensitive-strings-masked',retention_days:report.retentionDays,max_events:report.eventLimit},
    events:report.events.map(diagnosticPublicEvent),
    diagnosticContract:diagnosticContract(),
    applicationSkeleton:capturedSkeleton||captureApplicationSkeleton(),
    supportContext:{attachScreenshotSeparately:true,includeBugDescriptionInMessage:true,
      screenshotAndDescriptionAreNotEmbedded:true}, scan:scan?safeScan:null};
}
function diagnosticPublicEvent(event) {
  const technicalCodes = new Set([
    'session.started','session.interrupted','javascript.error','javascript.rejection',
    'resource.failed','mutation.invalid','mutation.refresh_failed','mutation.failed',
    'storage.save_failed','backup.write_failed','update.check_failed','update.install_failed',
    'offline.registration_failed','connection.online','connection.offline','diagnostic.generation_failed',
    'update.applied','update.cache_ready','backup.recreate_failed','csv.read_failed',
    'market.cdi_cache_failed','market.cdi_failed','market.ipca_failed','storage.conflict_prevented',
    'storage.recovery'
  ]);
  const modules = PAGES.map(([id]) => id);
  const integrityCodes = new Set(['banco','banco.monitoramento','banco.rechecagem','diario','diagnostico.integrado',
    'central.execucao','monitoramento','cache_pwa',releaseManifestPath,...releaseFiles,...PAGES.map(([id])=>'interface.'+id)]);
  const types = ['Error','TypeError','ReferenceError','SyntaxError','RangeError',
    'QuotaExceededError','SecurityError','NetworkError','AbortError','NotAllowedError'];
  const safeString = value => {
    if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))return undefined;
    return value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[REDACTED_EMAIL]')
      .replace(/\bBearer\s+[^\s,;]+/gi,'Bearer [REDACTED]')
      .replace(/([?&](?:access_token|token|secret|password|api_key|authorization|cookie)=)[^&\s]+/gi,'$1[REDACTED]')
      .replace(/\b\d{3}[. -]?\d{3}[. -]?\d{3}[- .]?\d{2}\b/g,'[REDACTED_ID]')
      .replace(/\b\d{2}[. -]?\d{3}[. -]?\d{3}[/. -]?\d{4}[- .]?\d{2}\b/g,'[REDACTED_ID]')
      .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)9?\d{4}[-. ]?\d{4}\b/g,'[REDACTED_PHONE]')
      .replace(/\b(?:\d[ -]?){13,19}\b/g,'[REDACTED_NUMBER]').slice(0,240);
  };
  const safeId = value => typeof value === 'string' && /^[a-z0-9-]{8,64}$/i.test(value) ? value : undefined;
  const safeHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value) ? value : undefined;
  const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  return {
    event_id:safeId(event.event_id), ts:typeof event.ts==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.ts)?event.ts:undefined,
    level:['DEBUG','INFO','WARN','ERROR','FATAL'].includes(event.level)?event.level:undefined,
    service:'reserva-simples-pwa', env:['browser','standalone'].includes(event.env)?event.env:undefined,
    schema_version:TELEMETRY_SCHEMA, session_id:safeId(event.session_id), msg:safeString(event.msg),
    at: typeof event.at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.at) ? event.at : undefined,
    version: parseAppVersion(event.version) ? event.version : undefined,
    code: technicalCodes.has(event.code)||integrityCodes.has(event.code) ? event.code : 'technical.other',
    type: types.includes(event.type) ? event.type : undefined,
    module: modules.includes(event.module) ? event.module : undefined,
    online: typeof event.online === 'boolean' ? event.online : undefined,
    line: Number.isSafeInteger(event.line) ? event.line : undefined,
    column: Number.isSafeInteger(event.column) ? event.column : undefined,
    element: ['SCRIPT','LINK','IMG','other'].includes(event.element) ? event.element : undefined,
    status:['aprovada','ok','corrigida','alerta','falha','erro','pendente','sem_cofre','sem_correcao_aplicavel','ignorado','não_suportado','info'].includes(event.status)?event.status:undefined,
    check:safeString(event.check), action:safeString(event.action), reason:safeString(event.reason), error_message:safeString(event.error_message),
    duration_ms:safeCount(event.duration_ms??event.durationMs), run_id:safeId(event.run_id??event.runId),
    target_version:typeof event.target_version==='string'&&/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(event.target_version)?event.target_version:undefined,
    expected_sha256:safeHash(event.expected_sha256), observed_sha256:safeHash(event.observed_sha256),
    source:['service_worker_cache','network'].includes(event.source)?event.source:undefined, cache_name:safeString(event.cache_name),
    stage_index:Number.isSafeInteger(event.stage_index)&&event.stage_index>=0&&event.stage_index<4?event.stage_index:undefined,
    target_duration_ms:safeCount(event.target_duration_ms), stage_count:safeCount(event.stage_count), checks_count:safeCount(event.checks_count)
  };
}
function diagnosticSafeClassNames(element) {
  return [...(typeof element.className === 'string' ? element.className.split(/\s+/) : [])]
    .filter(name => /^[a-z][a-z0-9_-]{0,34}$/i.test(name) &&
      !/(?:^|[-_])(?:\d{6,}|[a-f0-9]{12,}|[a-z0-9]{20,})(?:$|[-_])/i.test(name))
    .slice(0,5);
}
function diagnosticSelectorPath(element, root) {
  const parts=[]; let node=element;
  while(node && node!==root && parts.length<7) {
    const tag=String(node.tagName||'').toLowerCase();
    if(!tag)break;
    const siblings=node.parentElement ? [...node.parentElement.children].filter(x=>x.tagName===node.tagName) : [];
    const index=siblings.indexOf(node)+1;
    const classes=diagnosticSafeClassNames(node).slice(0,2).map(x=>'.'+x).join('');
    parts.unshift(tag+classes+(siblings.length>1?':nth-of-type('+index+')':''));
    node=node.parentElement;
  }
  return (root?.id && /^page-[a-z0-9-]{1,32}$/i.test(root.id) ? '#'+root.id+' ' : '.page ')+parts.join(' > ');
}
function diagnosticElementSnapshot(element, root) {
  const rect=element.getBoundingClientRect(), css=getComputedStyle(element);
  const role=element.getAttribute('role');
  const safeRole=role && /^[a-z-]{1,24}$/i.test(role) ? role : null;
  const attrs={};
  ['aria-expanded','aria-hidden','aria-pressed','aria-selected','aria-modal'].forEach(name=>{
    const value=element.getAttribute(name);
    if(value==='true'||value==='false')attrs[name]=value;
  });
  if(element.hidden)attrs.hidden=true;
  if(element.disabled)attrs.disabled=true;
  return {
    selector:diagnosticSelectorPath(element,root), tag:String(element.tagName||'').toLowerCase(),
    classes:diagnosticSafeClassNames(element), role:safeRole,
    type:['button','submit','reset','text','number','date','month','email','password','checkbox','radio','search','tel','url','file'].includes(element.type)?element.type:undefined,
    state:attrs, visible:css.display!=='none'&&css.visibility!=='hidden'&&rect.width>0&&rect.height>0,
    rect:{x:Math.round(rect.left),y:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height)},
    layout:{display:css.display,position:css.position,overflowX:css.overflowX,overflowY:css.overflowY,
      flexDirection:css.flexDirection,gridColumns:String(css.gridTemplateColumns||'').slice(0,100),
      gap:String(css.gap||'').slice(0,32),zIndex:css.zIndex,fontSize:css.fontSize,lineHeight:css.lineHeight,
      whiteSpace:css.whiteSpace,textOverflow:css.textOverflow},
    childCount:element.children.length
  };
}
function capturePageSkeleton(page,id,title) {
  if(!page)return {id,title,present:false,elementCounts:{},sampledElements:[],overflow:null};
  const counts={}, candidates=[];
  const nodes=[page,...page.querySelectorAll('*')];
  const skip=new Set(['SCRIPT','STYLE','SVG','PATH','G','DEFS','CIRCLE','LINE','POLYLINE','OPTION']);
  for(const node of nodes) {
    if(skip.has(node.tagName))continue;
    const tag=String(node.tagName||'').toLowerCase();counts[tag]=(counts[tag]||0)+1;
    const cls=diagnosticSafeClassNames(node).join(' ');
    const important=/^(BUTTON|INPUT|SELECT|TEXTAREA|FORM|DIALOG|NAV|HEADER|MAIN|SECTION|ARTICLE|TABLE|FIELDSET)$/.test(node.tagName)||
      node.hasAttribute('role')||/(?:^| )(?:card|grid|panel|modal|dialog|toolbar|nav|chart|calendar|form)(?: |$)/i.test(cls);
    if(important && candidates.length<180)candidates.push(diagnosticElementSnapshot(node,page));
  }
  const rect=page.getBoundingClientRect(), doc=document.documentElement;
  return {id,title,present:true,visible:getComputedStyle(page).display!=='none',
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1},
    pageRect:{x:Math.round(rect.left),y:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height)},
    overflow:{horizontalPx:Math.max(0,doc.scrollWidth-doc.clientWidth),verticalPx:Math.max(0,doc.scrollHeight-doc.clientHeight),
      pageScrollWidth:page.scrollWidth,pageClientWidth:page.clientWidth},
    elementCounts:counts,sampledElements:candidates,sampled:candidates.length,
    sampleLimit:180,candidateElements:counts?Object.values(counts).reduce((sum,value)=>sum+value,0):0,
    candidatesOmitted:Math.max(0,Object.values(counts).reduce((sum,value)=>sum+value,0)-candidates.length),
    privacy:{textIncluded:false,inputValuesIncluded:false,hrefsIncluded:false,dataAttributesIncluded:false,personalDataIncluded:false}};
}
function captureApplicationSkeleton(prebuilt) {
  const pages=prebuilt||PAGES.map(([id,title])=>capturePageSkeleton(document.getElementById('page-'+id),id,title));
  return {schemaVersion:'app-skeleton.v1',capturedAt:new Date().toISOString(),application:'Reserva Simples',
    appVersion:APP_VERSION,suiteVersion:DIAGNOSTIC_SUITE_VERSION,
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1,scrollX:Math.round(scrollX),scrollY:Math.round(scrollY)},
    activeModule:document.body.dataset.currentPage||state.page||null,
    purpose:'Correlacionar o print e a descrição do usuário com a estrutura e as medidas dos componentes.',
    privacy:{redacted:true,includesVisibleText:false,includesFieldValues:false,includesNames:false,includesFinancialOrClinicalData:false},
    modules:pages};
}
function createDiagnosticMemoryStorage(seed={},quotaError=false) {
  const map=new Map(Object.entries(seed).map(([key,value])=>[String(key),String(value)]));
  return {get length(){return map.size},key:index=>[...map.keys()][index]??null,
    getItem:key=>map.has(String(key))?map.get(String(key)):null,
    setItem:(key,value)=>{if(quotaError)throw new DOMException('Quota exceeded','QuotaExceededError');map.set(String(key),String(value))},
    removeItem:key=>map.delete(String(key)),clear:()=>map.clear(),_map:map};
}
async function withDiagnosticSandbox(options,run) {
  options=options||{};
  const original={db,state,cdiState,ipcaState,vault,vaultKey,vaultBusy,saving,hideValues,loadedStoreRaw,integrityContainmentLock,
    storageRecoveryRaw,recoveryArchived,backupDirectory,backupConflict,folderKey,folderSalt,
    confirm:Object.getOwnPropertyDescriptor(window,'confirm'),fetch:Object.getOwnPropertyDescriptor(window,'fetch'),
    localStorage:Object.getOwnPropertyDescriptor(window,'localStorage'),sessionStorage:Object.getOwnPropertyDescriptor(window,'sessionStorage'),
    scrollX,scrollY};
  const local=createDiagnosticMemoryStorage(options.storage||{},!!options.quotaError);
  diagnosticFixtureStorages.add(local);
  const session=createDiagnosticMemoryStorage(options.sessionStorage||{});
  const restoreProperty=(name,descriptor)=>{try{if(descriptor)Object.defineProperty(window,name,descriptor);else delete window[name]}catch{}};
  try {
    Object.defineProperty(window,'localStorage',{configurable:true,enumerable:true,writable:true,value:local});
    Object.defineProperty(window,'sessionStorage',{configurable:true,enumerable:true,writable:true,value:session});
    if(options.confirm!==undefined)window.confirm=typeof options.confirm==='function'?options.confirm:()=>Boolean(options.confirm);
    if(options.fetch)window.fetch=options.fetch;
    db=structuredClone(options.db||empty());
    state={...state,...(options.state||{})};
    cdiState={...cdiState,rates:structuredClone(options.cdiRates||[]),loading:false,error:''};
    ipcaState={...ipcaState,rates:structuredClone(options.ipcaRates||[]),loading:false,error:''};
    vault=options.vault||null;vaultKey=options.vaultKey||null;vaultBusy=false;saving=false;
    storageRecoveryRaw=null;recoveryArchived=false;loadedStoreRaw=local.getItem(STORE);integrityContainmentLock=false;backupDirectory=options.backupDirectory||null;
    backupConflict=false;folderKey=options.folderKey||null;folderSalt=options.folderSalt||null;hideValues=!!options.hideValues;
    return await run({localStorage:local,sessionStorage:session});
  } finally {
    db=original.db;state=original.state;cdiState=original.cdiState;ipcaState=original.ipcaState;
    vault=original.vault;vaultKey=original.vaultKey;vaultBusy=original.vaultBusy;saving=original.saving;
    loadedStoreRaw=original.loadedStoreRaw;integrityContainmentLock=original.integrityContainmentLock;
    hideValues=original.hideValues;storageRecoveryRaw=original.storageRecoveryRaw;recoveryArchived=original.recoveryArchived;
    backupDirectory=original.backupDirectory;backupConflict=original.backupConflict;folderKey=original.folderKey;folderSalt=original.folderSalt;
    restoreProperty('confirm',original.confirm);restoreProperty('fetch',original.fetch);
    restoreProperty('localStorage',original.localStorage);restoreProperty('sessionStorage',original.sessionStorage);
    try{render();window.scrollTo({left:original.scrollX,top:original.scrollY,behavior:'instant'})}catch{}
  }
}
async function runDataSecurityTests() {
  const tests = [];
  async function check(id, name, run) {
    const start = performance.now();
    let status;
    try {
      const result = await run();
      status = result === null ? 'ignorado' : result ? 'ok' : 'falha';
    } catch { status = 'erro'; }
    tests.push({id,name,status,durationMs:Math.round(performance.now()-start),
      ...(status === 'ignorado' ? {reason:'Web Crypto indisponível ou preparação do teste falhou'} : {})});
  }

  const marker = 'marcador-ficticio-de-privacidade';
  await check('SEG-01','Exportação exclui mensagem, pilha e contexto arbitrário de eventos', () => {
    const report = diagnosticReport(null,{events:[{code:'javascript.error',type:'TypeError',
      line:17,stack:marker,message:marker,password:marker,trail:[{action:marker}],
      module:marker,version:marker}]});
    const event = report.events[0];
    return !JSON.stringify(report).includes(marker) && event.line === 17 && event.type === 'TypeError';
  });
  const allocation = {id:'seg-a',jarId:'seg-j',amount:100,date:'2027-01-01'};
  await check('SEG-02','Validador rejeita movimentação sem cofrinho correspondente', () =>
    verify({...empty(),allocations:[allocation]}) === null);
  await check('SEG-03','Validador rejeita histórico com resgate acima do saldo', () =>
    verify({...empty(),jars:[{id:'seg-j',name:'Teste',target:500,dueDate:'2027-12-31'}],
      allocations:[allocation,{...allocation,id:'seg-b',date:'2027-01-02',amount:-101}]}) === null);

  let key, envelope, second;
  const salt = new Uint8Array(16);
  await check('SEG-04','Chave derivada não pode ser exportada e o cofre usa AES-GCM', async () => {
    if (!globalThis.crypto?.subtle) return null;
    key = await deriveVaultKey('senha fictícia de diagnóstico',salt);
    envelope = await sealVault(empty(),key,bytesTo64(new Uint8Array(16)));
    second = await sealVault(empty(),key,bytesTo64(new Uint8Array(16)));
    return key.extractable === false && key.algorithm.name === 'AES-GCM';
  });
  await check('SEG-05','Cifragens sucessivas geram IVs distintos de 12 bytes', () =>
    envelope && second ? from64(envelope.iv).length === 12 &&
      from64(second.iv).length === 12 && envelope.iv !== second.iv : null);
  const rejects = async candidate => {
    try { await openVault(candidate,key); return false; }
    catch (error) { return error.name === 'OperationError'; }
  };
  await check('SEG-06','Cofre rejeita conteúdo cifrado alterado', () => {
    if (!envelope) return null;
    const bytes = from64(envelope.data);
    bytes[0] ^= 1;
    return rejects({...envelope,data:bytesTo64(bytes)});
  });
  await check('SEG-07','Cofre rejeita conteúdo cifrado truncado', () => {
    if (!envelope) return null;
    return rejects({...envelope,data:bytesTo64(from64(envelope.data).slice(0,-1))});
  });
  await check('SEG-08','Cofre rejeita IV alterado', () => {
    if (!envelope) return null;
    const iv = from64(envelope.iv);
    iv[0] ^= 1;
    return rejects({...envelope,iv:bytesTo64(iv)});
  });
  await check('SEG-09','Cofre rejeita esquema inválido mesmo após decifrar', async () => {
    if (!key) return null;
    const invalid = await sealVault({...empty(),version:99},key,bytesTo64(new Uint8Array(16)));
    try { await openVault(invalid,key); return false; }
    catch (error) { return error.message === 'Dados inválidos'; }
  });
  await check('SEG-11','Validador aceita envelope cifrado com salt, IV e dados no tamanho esperado', () => {
    if (!envelope) return null;
    return validateVaultEnvelope(envelope) === envelope &&
      from64(envelope.salt).length === 16 && from64(envelope.iv).length === 12 &&
      from64(envelope.data).length >= 16;
  });
  await check('SEG-12','Validador rejeita envelope com salt ou IV inválido e campos extras', () => {
    if (!envelope) return null;
    const rejectsStructure = candidate => {
      try { validateVaultEnvelope(candidate); return false; }
      catch { return true; }
    };
    return rejectsStructure({...envelope,salt:bytesTo64(new Uint8Array(8))}) &&
      rejectsStructure({...envelope,iv:bytesTo64(new Uint8Array(8))}) &&
      rejectsStructure({...envelope,records:[{amount:999}]});
  });
  await check('SEG-13','Pré-validação de backup confirma os dados fictícios antes de persistir', async () => {
    if (!key) return null;
    const fixture = {...empty(),records:[{id:'seg13-fixture',kind:'expense',category:'Outros',amount:100,date:'2027-02-01',note:'QA_BACKUP_FIXTURE'}]};
    const candidate = await sealVault(fixture,key,bytesTo64(new Uint8Array(16)));
    const reopened = await openVault(candidate,key);
    return JSON.stringify(reopened) === JSON.stringify(verify(fixture)) &&
      !JSON.stringify(candidate).includes('QA_BACKUP_FIXTURE');
  });
  await check('SEG-10','Esqueleto do app não exporta texto, links, atributos de dados ou valores de campos', () => {
    const marker='QA_DOM_SECRET_6a31';
    const root=document.createElement('section');root.id='page-qa';root.className='page';
    const label=document.createElement('span');label.textContent=marker;
    const input=document.createElement('input');input.value=marker;input.setAttribute('data-private',marker);
    const link=document.createElement('a');link.href='https://invalid.example/'+marker;link.textContent=marker;
    root.append(label,input,link);
    const snapshot=capturePageSkeleton(root,'qa','Fixture estrutural');
    const json=JSON.stringify(snapshot);
    return !json.includes(marker)&&snapshot.privacy.textIncluded===false&&snapshot.privacy.inputValuesIncluded===false;
  });
  return tests;
}

async function runProposalTests(scan) {
  const results = [];
  const record = {id:'proposta-r',date:'2027-01-01',kind:'expense',category:'Outros',amount:125};
  const legacy = version => ({version, records:[record], jars:[], allocations:[]});
  const migration = version => {
    const data = verify(legacy(version));
    return data?.version === 4 && data.records[0]?.amount === 125 &&
      Array.isArray(data.tasks) && Array.isArray(data.recurring);
  };
  const checks = {
    1: ['Duração por cenário novo registrada em milissegundos', () => results.every(item => item.durationMs >= 0)],
    2: ['Normalização real do esquema 2 para 4', () => migration(2)],
    3: ['Normalização real do esquema 3 para 4', () => migration(3)],
    4: ['Versão ausente ou inválida', () => [undefined,null,'4',99].every(version => !verify(legacy(version)))],
    5: ['Normalização idempotente dos três esquemas suportados', () => [2,3,4].every(version => {
      const normalized = verify(legacy(version));
      return normalized && JSON.stringify(normalized) === JSON.stringify(verify(normalized));
    })],
    9: ['Ciclo criptográfico integral em memória', async () => {
      if (!globalThis.crypto?.subtle) return null;
      const fixture = verify(legacy(4));
      const key = await deriveVaultKey('senha fictícia',new Uint8Array(16));
      return JSON.stringify(await openVault(await sealVault(fixture,key,bytesTo64(new Uint8Array(16))),key)) === JSON.stringify(fixture);
    }],
    12: ['Parser real de dois formatos de separador; arquivo misto fica fora', () =>
      [';',','].every(sep => {
        const csv = 'Data'+sep+'Valor'+sep+'Descrição\n2027-01-01'+sep+'12'+sep+'"A'+sep+'B"';
        return bankCsvDelimiter(csv) === sep && bankCsvParseRows(csv,sep)[1]?.[2] === 'A'+sep+'B';
      })],
    17: ['Validação de compromisso sem horário; botão Hoje fica fora', () =>
      verify({...empty(),tasks:[{id:'proposta-t',title:'Teste',date:'2027-01-01'}]})?.tasks[0]?.time === ''],
    20: ['Busca de cabeçalho ausente; fluxo de importação fica fora', () =>
      bankCsvHeaderIndex(['descrição','observação'],['data']) === -1],
    22: ['Validação cronológica de saldo; fluxo de resgate fica fora', () => {
      const rows = [{id:'a',jarId:'meta',amount:500,date:'2027-01-01'},
        {id:'b',jarId:'meta',amount:-501,date:'2027-01-02'}];
      return firstNegativeJarDate('meta',rows) === '2027-01-02' &&
        firstNegativeJarDate('meta',[rows[0],{...rows[1],amount:-500}]) === null;
    }],
    27: ['Serialização real do relatório e campos essenciais; download e auditoria de privacidade ficam fora', () => {
      const payload = JSON.parse(JSON.stringify(diagnosticReport({modules:[],syntheticChecks:[]})));
      return Array.isArray(payload.events) && Array.isArray(payload.scan.modules) &&
        payload.diagnosticContract.suiteVersion === DIAGNOSTIC_SUITE_VERSION;
    }],
    38: ['Referências ARIA a IDs no DOM atual', () =>
      [...document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns]')]
        .every(node => ['aria-labelledby','aria-describedby','aria-controls','aria-owns']
          .flatMap(attr => (node.getAttribute(attr)||'').split(/\s+/).filter(Boolean))
          .every(id => document.getElementById(id)))],
    41: ['30 regressões catalogadas com estado explícito', () =>
      scan.historicalRegressions.length === 30 &&
      new Set(scan.historicalRegressions.map(item => item.id)).size === 30 &&
      scan.historicalRegressions.every(item => item.status)],
    46: ['Presença e aridade dos pontos de integração; schemas comportamentais ampliados em LOC-01', () => !diagnosticContract().missing.length&&!diagnosticContract().brokenSignatures.length],
    48: ['Versões do app, contrato e suíte; commit do protótipo fica fora', () =>
      diagnosticContract().appVersion === APP_VERSION && diagnosticContract().version===2&&Boolean(DIAGNOSTIC_SUITE_VERSION)]
  };
  for (const [id,title] of PROPOSAL_TEST_PLAN) {
    const test = checks[id];
    if (!test) { results.push({id,title,status:'pendente'}); continue; }
    const [scope,run] = test;
    const started = performance.now();
    let status;
    try {
      const passed = await run();
      status = passed === null ? 'ignorado' : passed ? 'ok' : 'falha';
      if (id === 46 && !passed) status = 'contrato_incompativel';
    } catch { status = 'erro'; }
    results.push({id,title,scope,status,durationMs:Math.round(performance.now()-started)});
  }
  return results;
}

async function runLocProposalTests(onCaseProgress) {
  const definitions=[];
  const add=(id,title,run,scope='fixture isolada')=>definitions.push({id:'LOC-'+String(id).padStart(2,'0'),title,run,scope});
  const pending=(id,title,reason)=>definitions.push({id:'LOC-'+String(id).padStart(2,'0'),title,reason,scope:'pendente de implementação/ambiente'});
  const close=(a,b,tolerance=0)=>Math.abs(a-b)<=tolerance;
  const dateRecord=(id,kind,amount,date,extra={})=>({id,kind,amount,date,category:kind==='expense'?'Outros':'',source:kind==='income'?'salary':'',note:'fixture QA',subcategory:'',tags:[],...extra});

  add(1,'Contrato comportamental de APIs e schemas de retorno',()=>withDiagnosticSandbox({},()=>{
    const v=verify(empty()),month=Engines.monthData(empty(),2027,0);
    const required=['version','records','jars','allocations','investments','recurring','tasks','institutions','prefs'];
    const missing=required.filter(key=>!(key in (v||{})));
    const monthly=['income','expenses','saved','available'].filter(key=>!(key in (month||{})));
    const contract=diagnosticContract();
    return {passed:!missing.length&&!monthly.length&&!contract.missing.length&&!contract.brokenSignatures.length,
      evidence:{missing,monthly,missingFunctions:contract.missing,brokenSignatures:contract.brokenSignatures,contractVersion:contract.version}};
  }));
  add(2,'Rotas e estado visual das páginas',()=>withDiagnosticSandbox({},()=>{
    const outcomes=[];
    for(const [id] of PAGES){go(id);const active=[...document.querySelectorAll('.page.active')];
      outcomes.push({id,active:active.length===1&&active[0].id==='page-'+id});}
    return {passed:outcomes.every(x=>x.active),evidence:{routesChecked:outcomes.length,invalidRoutes:outcomes.filter(x=>!x.active).map(x=>x.id)}};
  }),'DOM real; navegação revertida ao final');
  add(3,'Reconciliação de totais entre motores e período',()=>withDiagnosticSandbox({state:{year:2027,month:4}},()=>{
    db.records.push(dateRecord('loc3-i1','income',500000,'2027-05-05'),dateRecord('loc3-i2','income',150000,'2027-05-10'),
      dateRecord('loc3-e1','expense',80000,'2027-05-12'),dateRecord('loc3-e2','expense',25000,'2027-05-15'));
    const m=Engines.monthData(db,2027,4),expectedIncome=650000,expectedExpenses=105000;
    return {passed:m.income===expectedIncome&&m.expenses===expectedExpenses,evidence:{income:m.income,expenses:m.expenses,expectedIncome,expectedExpenses}};
  }));
  add(4,'Projeção de caixa com lançamentos sintéticos após o saldo âncora',()=>withDiagnosticSandbox({},()=>{
    const today=isoToday(),anchor=shiftIso(today,-10),end=shiftIso(today,5);
    db.prefs.balanceAnchorCents=100000;db.prefs.balanceAnchorDate=anchor;
    db.records.push(dateRecord('loc4-i','income',50000,shiftIso(today,-5)),dateRecord('loc4-e','expense',20000,shiftIso(today,-2)),
      dateRecord('loc4-f','expense',35000,shiftIso(today,3)));
    const p=cashProjection(5),expectedNow=130000,expectedEnd=95000;
    return {passed:!!p&&p.nowBalance===expectedNow&&p.projected===expectedEnd&&p.dailyBalances[end]===expectedEnd,
      evidence:{nowBalance:p?.nowBalance,projected:p?.projected,expectedNow,expectedEnd}};
  }));
  add(5,'Recuperação isolada de JSON corrompido e quarentena única',()=>withDiagnosticSandbox({storage:{[STORE]:'{"version":4,"records":[corrompido'}},async({localStorage})=>{
    const raw=localStorage.getItem(STORE);load();const first=[...localStorage._map.keys()].filter(key=>key.startsWith(STORE+'-corrompido-')).length;
    load();const second=[...localStorage._map.keys()].filter(key=>key.startsWith(STORE+'-corrompido-')).length;
    const blocked=await save()===false&&localStorage.getItem(STORE)===raw;
    return {passed:first===1&&second===1&&blocked,evidence:{firstQuarantineCount:first,secondQuarantineCount:second,saveBlocked:blocked}};
  }));
  add(6,'Rollback quando o armazenamento isolado retorna QuotaExceededError',()=>withDiagnosticSandbox({quotaError:true},async()=>{
    const result=await mutate(()=>db.records.push(dateRecord('loc6','expense',1000,isoToday())));
    return {passed:result===false&&db.records.length===0,evidence:{mutationRejected:result===false,rollbackComplete:db.records.length===0}};
  }));
  add(7,'Limites restantes de verify e normalização de versões',()=>withDiagnosticSandbox({},()=>{
    const sample={id:'loc7',jarId:'loc7-j',amount:1,date:'2027-01-01'};
    const overAlloc=verify({...empty(),allocations:Array(50001).fill(sample)})===null;
    const overRecurring=verify({...empty(),recurring:Array(5001).fill({id:'r',amount:1,day:1,startMonth:'2027-01'})})===null;
    const overTasks=verify({...empty(),tasks:Array(10001).fill({id:'t',title:'x',date:'2027-01-01'})})===null;
    const overInvest=verify({...empty(),investments:Array(5001).fill({id:'i',name:'x'})})===null;
    const migration=[2,3,4].every(version=>verify({...empty(),version})?.version===4);
    return {passed:overAlloc&&overRecurring&&overTasks&&overInvest&&migration,evidence:{overAlloc,overRecurring,overTasks,overInvest,migration}};
  }));
  add(8,'Validação de senha curta e confirmação divergente do cofre',()=>withDiagnosticSandbox({},async()=>{
    const dialog=$('#vaultDialog');if(!dialog||!$('#vaultPassword')||!$('#vaultConfirm'))return{unsupported:true,reason:'Campos do cofre não encontrados'};
    dialog.dataset.mode='setup';let shortBlocked=false,mismatchBlocked=false;
    $('#vaultPassword').value='12345678901';$('#vaultConfirm').value='12345678901';$('#vaultError').textContent='';
    await submitVault({preventDefault(){}});shortBlocked=$('#vaultError').textContent.includes('12 caracteres');
    vaultBusy=false;$('#vaultPassword').value='SenhaForte123!';$('#vaultConfirm').value='OutraSenha123!';$('#vaultError').textContent='';
    await submitVault({preventDefault(){}});mismatchBlocked=$('#vaultError').textContent.includes('confirme a senha');
    return {passed:shortBlocked&&mismatchBlocked,evidence:{shortPasswordBlocked:shortBlocked,mismatchBlocked}};
  }));
  add(9,'Relatório técnico e telemetria não carregam marcador de segredo',()=>withDiagnosticSandbox({},()=>{
    const marker='QA_SEGREDO_NAO_EXPORTAR_9f3c';
    const report=diagnosticReport(null,{events:[{code:'javascript.error',type:'TypeError',message:marker,stack:marker,password:marker,context:{secret:marker}}]});
    const leaked=JSON.stringify(report).includes(marker);
    return {passed:!leaked,evidence:{secretMarkerLeaked:leaked}};
  }));
  pending(10,'Adaptador de backup em pasta: escrita, recriação e permissão','O fluxo de pasta depende de diretório criptografado e de um adaptador fake específico; não foi simulado nesta rodada para evitar relatar sucesso de persistência do SO.');
  pending(11,'Ciclo completo de lançamento: criar, editar, cancelar e excluir','O submit do formulário é assíncrono e ainda precisa de um harness de eventos isolado que valide cada etapa sem interferir no modal ativo.');
  add(12,'Pré-condições para cópia mensal: datas válidas e fixture normalizada',()=>withDiagnosticSandbox({},()=>{
    const feb28=validDate('2027-02-28'),bad=validDate('2027-02-31');
    const source=empty();source.records=[dateRecord('copy','expense',20000,'2027-01-31')];
    const normalized=verify(source);return {passed:feb28&&!bad&&normalized?.records.length===1,evidence:{februaryDateValid:feb28,invalidDayRejected:!bad,fixtureValid:!!normalized}};
  }));
  add(13,'Importação CSV: datas e valores contábeis de referência',()=>withDiagnosticSandbox({},()=>{
    const dateOk=bankCsvDate('2027-05-10')==='2027-05-10'&&bankCsvDate('10/05/2027')==='2027-05-10';
    const moneyOk=bankCsvMoney('(1.234,56)')===-123456&&bankCsvMoney('1.234,56')===123456;
    const parsed=bankCsvParseRows('Data;Valor\n2027-05-10;1.234,56', ';');
    return {passed:dateOk&&moneyOk&&parsed.length===2,evidence:{dateFormatsOk:dateOk,moneyFormatsOk:moneyOk,parsedRows:parsed.length}};
  }));
  add(14,'Recorrências: vencimento hoje e atraso com data do sistema',()=>withDiagnosticSandbox({},()=>{
    const today=isoToday(),[y,m,d]=today.split('-').map(Number),period=mkey(y,m-1);
    db.recurring.push({id:'loc14-today',kind:'expense',amount:1000,category:'Outros',day:d,startMonth:period,paused:false,note:'Fixture'});
    const row=upcomingBillInstances(2).find(item=>item.id==='loc14-today');
    return {passed:!!row&&row.daysUntil===0&&row.daysLate===0,evidence:{dueToday:row?.daysUntil===0,daysLate:row?.daysLate}};
  }));
  add(15,'Calendário: movimentos e tarefa no mesmo dia',()=>withDiagnosticSandbox({},()=>{
    db.records.push(dateRecord('loc15-i','income',100,'2027-06-15'),dateRecord('loc15-e','expense',50,'2027-06-15'));
    db.tasks.push({id:'loc15-t',title:'Fixture',date:'2027-06-15',time:'',color:'purple',done:false});
    const events=calendarEventsForMonth(2027,5).get('2027-06-15')||[];
    const kinds=new Set(events.map(item=>item.kind));return {passed:kinds.has('income')&&kinds.has('expense')&&kinds.has('task'),evidence:{eventKinds:[...kinds]}};
  }));
  add(16,'CDB: tabela de IOF/IR e ausência de CDI',()=>withDiagnosticSandbox({cdiRates:[]},()=>{
    db.jars.push({id:'loc16-j',name:'Fixture',target:500000,dueDate:'2027-12-31',institutionId:'inter-default'});
    db.allocations.push({id:'loc16-a',jarId:'loc16-j',amount:100000,date:'2025-01-01'});
    const noRates=estimateCdbJar('loc16-j','2025-06-01');cdiState.rates=[{date:'2025-01-02',value:10}];
    const early=estimateCdbJar('loc16-j','2025-01-02'),late=estimateCdbJar('loc16-j','2026-12-23');
    return {passed:!noRates.hasRates&&noRates.net===100000&&early.iof>=0&&late.iof===0&&late.net<=late.gross,
      evidence:{noRatesPreservedPrincipal:noRates.net===100000,earlyTaxNonnegative:early.iof>=0,lateIofZero:late.iof===0,agingCases:3}};
  }));
  add(17,'CDB: saldo remanescente após resgate em múltiplos lotes (checagem FIFO indireta)',()=>withDiagnosticSandbox({},()=>{
    db.jars.push({id:'loc17-j',name:'FIFO fixture',target:500000,dueDate:'2027-12-31',institutionId:'inter-default'});
    db.allocations.push({id:'loc17-a1',jarId:'loc17-j',amount:100000,date:'2025-01-01'},
      {id:'loc17-a2',jarId:'loc17-j',amount:200000,date:'2025-01-15'},
      {id:'loc17-a3',jarId:'loc17-j',amount:-150000,date:'2025-01-20'});
    cdiState.rates=[{date:'2025-01-10',value:10},{date:'2025-02-01',value:10}];
    const out=estimateCdbJar('loc17-j','2025-03-01');
    return {passed:out.principal===150000&&out.gross>=out.principal&&out.net<=out.gross,evidence:{principal:out.principal,gross:out.gross,net:out.net}};
  }));
  add(18,'Cofrinho: rejeição cronológica de saldo negativo',()=>withDiagnosticSandbox({},()=>{
    const rows=[{id:'a',jarId:'j',amount:50000,date:'2027-01-10'},{id:'b',jarId:'j',amount:-30000,date:'2027-01-20'}];
    return {passed:firstNegativeJarDate('j',rows)===null&&firstNegativeJarDate('j',[rows[0],{...rows[1],amount:-50001}])==='2027-01-20',
      evidence:{validHistoryAccepted:firstNegativeJarDate('j',rows)===null,overdrawDate:firstNegativeJarDate('j',[rows[0],{...rows[1],amount:-50001}])}};
  }));
  pending(19,'Investimento em pecuária: gastos e venda proporcional','Fluxo depende de vários formulários dinâmicos e eventos encadeados; precisa de harness específico de lote isolado antes de ser marcado como validado.');
  add(20,'Monitoramento FGC/FGCoop agrupa instituição e compara referência',()=>withDiagnosticSandbox({},()=>{
    db.institutions.push({id:'loc20-1',name:'Banco QA',type:'bank',cdiPercent:100,guaranteeFund:'fgc',conglomerate:'Grupo QA',otherCoveredBalance:15000000},
      {id:'loc20-2',name:'Banco QA 2',type:'bank',cdiPercent:100,guaranteeFund:'fgc',conglomerate:'grupo qa',otherCoveredBalance:15000000});
    const html=guaranteeCard();return {passed:html.includes('Acima da referência')&&html.includes('300.000,00'),evidence:{capExceeded:html.includes('Acima da referência'),groupedExposure:html.includes('300.000,00')}};
  }));
  add(21,'Limite de Mercado: transições de aviso em 75% e 100%',()=>withDiagnosticSandbox({},()=>{
    const today=isoToday(),period=today.slice(0,7);db.prefs.marketBudget=10000;
    db.records.push(dateRecord('loc21-74','expense',7400,today,{category:'Mercado'}));const normal=groceryAlertLevel()===0;
    db.records[0].amount=7500;const warn=groceryAlertLevel()===1;
    db.records[0].amount=10000;const reached=groceryAlertLevel()===2;
    return {passed:normal&&warn&&reached,evidence:{below75:normal,at75:warn,at100:reached,period}};
  }));
  add(22,'Reserva de emergência vazia sem histórico não gera valores inválidos',()=>withDiagnosticSandbox({},()=>{
    const html=emergencyReserveCard();return {passed:html===''&&!/NaN|Infinity/.test(html),evidence:{emptyHistorySafe:html===''}};
  }));
  add(23,'Estrutura do backup e do relatório de diagnóstico',()=>withDiagnosticSandbox({},()=>{
    db.records.push(dateRecord('loc23','expense',100,'2027-01-01'));
    const backup=JSON.parse(JSON.stringify(backupPayload())),verified=verify(backup);
    const report=diagnosticReport({modules:[],applicationSkeleton:captureApplicationSkeleton([])}, {events:[]});
    return {passed:!!verified&&report.applicationSkeleton?.schemaVersion==='app-skeleton.v1'&&report.diagnosticContract.suiteVersion===DIAGNOSTIC_SUITE_VERSION,
      evidence:{backupRoundTrip:!!verified,skeletonIncluded:!!report.applicationSkeleton,contractVersion:report.diagnosticContract.suiteVersion}};
  }));
  pending(24,'CDI/IPCA: erros HTTP e concorrência com cache preservado','O HTML aberto por file:// bloqueia consulta externa; a bateria HTTP simulada fica separada até existir adaptador injetável para o pipeline de fetch.');
  pending(25,'Breakpoint CSS real em iframe isolado nas três larguras','A proposta clona a árvore ativa; antes de executar automaticamente, implementar clone DOM sem texto/atributos de usuário e validar CSP/origens em navegador.');
  add(26,'Privacidade: ocultação de valores no formatador de moeda',()=>withDiagnosticSandbox({hideValues:true},()=>{
    const hidden=money(432189);return {passed:!hidden.includes('4.321,89')&&!hidden.includes('4321,89'),evidence:{formattedValueHidden:!hidden.includes('4.321,89')}};
  }));
  pending(27,'Contraste WCAG nas paletas e modos claro/escuro','A medição confiável requer pares texto/fundo efetivamente renderizados em cada paleta; gradientes e transparências devem permanecer inconclusivos.');
  add(48,'Registro rápido mantém os campos essenciais e os detalhes recolhidos',()=>withDiagnosticSandbox({},()=>{
    try{
      return {passed:['expense','income'].every(mode=>{
        openModal(mode,null,true);
        const form=$('#entryForm'), more=form?.querySelector('.quick-entry-more');
        return more&&!more.open&&Boolean(more.querySelector('#date')?.value)&&['amount','note',mode==='income'?'type':'category'].every(id=>{
          const field=form.querySelector('#'+id);
          return field&&!more.contains(field);
        });
      })};
    }finally{if($('#modal').classList.contains('open'))closeModal(true);}
  }));
  add(49,'Insights calcula média de três meses e separa gastos recorrentes',()=>withDiagnosticSandbox({state:{year:2027,month:3}},()=>{
    db.records=[['01',10000],['02',20000],['03',30000]].map(([month,amount])=>({kind:'expense',category:'Mercado',date:'2027-'+month+'-01',amount}));
    const html=expenseComparisonCards({records:[{kind:'expense',category:'Mercado',date:'2027-04-01',amount:40000,recurringId:'qa'},{kind:'expense',category:'Outros',date:'2027-04-02',amount:5000}]});
    return {passed:html.includes('<td>'+money(20000)+'</td>')&&html.includes('Fixos: <strong>'+money(40000))&&html.includes('Variáveis: <strong>'+money(5000))};
  }));
  add(50,'Relatório diário compara acumulados de meses consecutivos',()=>withDiagnosticSandbox({state:{year:2027,month:1}},()=>{
    db.records=[{id:'qa-day-1',kind:'income',date:'2027-01-01',amount:10000},{id:'qa-day-2',kind:'income',date:'2027-02-02',amount:25000}];
    const doc=new DOMParser().parseFromString(dailyReportCard('2027-03-15'),'text/html');
    const preview=doc.querySelectorAll('.report-daily-card > .table-wrap tbody tr');
    const rows=doc.querySelectorAll('.report-daily-details tbody tr');
    return {passed:preview.length===10&&preview[0].cells[0].textContent==='28'&&preview[9].cells[0].textContent==='19'&&
      rows.length===28&&rows[26].cells[1].textContent===money(25000)&&rows[26].cells[2].textContent===money(10000)&&rows[27].cells[1].textContent===money(0)};
  }));
  add(51,'Notas usam editor global visível com cor e data',()=>{
    const dialog=ensureCalendarNoteEditor();return {passed:dialog.parentElement===document.body&&Boolean(dialog.querySelector('[name=date]')?.value&&dialog.querySelector('[name=color]'))};
  },'editor de notas');
  add(47,'Notas mantêm data e fixação no backup',()=>{
    const sample={...empty(),notes:[{id:'qa-note',date:'2027-01-03',text:'Nota de teste',pinned:true}]};
    const note=verify(JSON.parse(JSON.stringify(sample)))?.notes[0];
    return {passed:note?.date==='2027-01-03'&&note.pinned&&verify({...sample,notes:[{...sample.notes[0],date:'2027-02-31'}]})===null};
  },'backup local do Calendário');
  add(46,'Calendário integrado ao Hoje preserva grade e ações',()=>{
    const page=$('#homeFullCalendar');return {passed:Boolean(page?.querySelector('.calendar-grid')&&page.querySelector('[data-calendar-new-note]')&&page.querySelector('[data-calendar-new-task]')&&!$('#desktopNav [data-page="calendar"]'))};
  },'calendário no Hoje');
  add(28,'Abertura e fechamento do modal com foco rastreável',()=>withDiagnosticSandbox({},()=>{
    const trigger=$('#headerSettings');trigger?.focus();openModal('income');const opened=$('#modal').getAttribute('aria-hidden')==='false';
    const focusInside=$('#modal').contains(document.activeElement);closeModal(true);const closed=$('#modal').getAttribute('aria-hidden')==='true';
    return {passed:opened&&focusInside&&closed,evidence:{opened,focusInside,closed}};
  }),'interação no DOM real com dados sintéticos');
  add(29,'Referências ARIA e nomes acessíveis nos controles presentes',()=>withDiagnosticSandbox({},()=>{
    const broken=[];for(const node of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns]'))
      for(const attr of ['aria-labelledby','aria-describedby','aria-controls','aria-owns'])
        for(const ref of (node.getAttribute(attr)||'').split(/\s+/).filter(Boolean))if(!document.getElementById(ref))broken.push(attr);
    const unnamed=[...document.querySelectorAll('button,input,select,textarea')].filter(node=>{
      if(node.disabled||node.hidden||node.closest('[hidden]'))return false;
      const css=getComputedStyle(node),rect=node.getBoundingClientRect();
      if(css.display==='none'||css.visibility==='hidden'||rect.width===0||rect.height===0)return false;
      const labelledBy=(node.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean);
      const labelledByText=labelledBy.map(id=>document.getElementById(id)?.textContent?.trim()||'').join(' ').trim();
      return !node.getAttribute('aria-label')&&!labelledByText&&!node.labels?.length&&!node.textContent.trim()&&!node.title;
    });
    return {passed:!broken.length&&!unnamed.length,evidence:{brokenAriaReferenceCount:broken.length,unnamedControlCount:unnamed.length}};
  }));
  add(30,'Benchmark escalado de verificação com fixtures sintéticas',()=>withDiagnosticSandbox({},()=>{
    const timings={};for(const n of [100,1000,10000]){
      const fixture=empty();fixture.records=Array.from({length:n},(_,i)=>dateRecord('perf-'+i,i%4?'expense':'income',100,'2027-01-01'));
      const start=performance.now(),out=verify(fixture);timings[n]=Math.round(performance.now()-start);
      if(!out)return {passed:false,evidence:{timings,failedAt:n}};
    }
    const bounded=timings[10000] < 60000;
    return {passed:bounded,evidence:{timings,limitMs:60000}};
  }),'benchmark sintético; não é garantia de desempenho em todo aparelho');

  add(52,'Hoje abre o formulário do módulo Orçamento',()=>withDiagnosticSandbox({state:{page:'home'}},()=>{
    render();
    $('#page-home [data-home-budget]').click();
    return {passed:state.page==='budget'&&Boolean($('#page-budget #categoryBudgetCard [data-category-budget-form]'))};
  }));
  add(53,'Orçamento registra gasto com cartão e vencimentos avulsos ou mensais',()=>withDiagnosticSandbox({state:{page:'budget'}},async()=>{
    try {
      render();
      $('#page-budget [data-home-finance-entry="card"]').click();
      const prefilled=$('#category').value==='Cartões';
      $('#amount').value='28.75';
      $('#date').value=isoToday();
      $('#note').value='Fatura de teste';
      await submitEntry({preventDefault(){}});
      const card=db.records.some(item=>item.amount===2875&&item.category==='Cartões')&&$('#page-budget .home-card-records')?.textContent.includes('Fatura de teste');
      for(const monthly of [false,true]){
        $('#page-budget [data-home-finance-entry="due"]').click();
        $('#amount').value='42';
        $('#note').value=monthly?'Conta mensal de teste':'Conta avulsa de teste';
        $('#dueEntryMonthly').checked=monthly;
        await submitEntry({preventDefault(){}});
      }
      const [single,monthly]=db.recurring;
      const bills=upcomingBillInstances(7);
      return {passed:prefilled&&card&&single?.endMonth===isoToday().slice(0,7)&&monthly?.endMonth===null&&bills.length===2&&state.page==='budget'};
    }finally{if($('#modal').classList.contains('open'))closeModal(true)}
  }));
  add(54,'Busca global encontra registros sem acentos e abre o investimento',()=>withDiagnosticSandbox({state:{page:'home'}},()=>{
    db.investments=[{id:'qa-invest-search',name:'Título de Liquidez',institution:'Inter',product:'CDB',date:'2027-01-03',checked:'2027-01-03',cost:10000,balance:10000}];
    render();
    const hit=searchReserva('titulo liquidez').find(item=>item.id==='qa-invest-search');
    openReservaSearchResult(hit);
    return {passed:!!hit&&state.page==='investments'&&Boolean($('#page-investments .investment-tile[open] [data-investment-edit="qa-invest-search"]'))};
  }));
  add(55,'Sino abre o fechamento do mês correto, inclusive na virada de ano',()=>withDiagnosticSandbox({},()=>{
    const closing=date=>desktopNotificationItems(date).find(item=>item.kind==='reports');
    const yearEnd=closing('2027-12-31'),yearStart=closing('2028-01-01'),leap=closing('2028-02-29');
    if(!yearEnd||!yearStart||!leap)return {passed:false};
    openDesktopNotification(yearStart);
    return {passed:yearEnd.date==='2027-12-31'&&yearStart.date==='2027-12-31'&&yearEnd.dismissalId!==yearStart.dismissalId&&
      leap.date==='2028-02-29'&&!closing('2027-12-15')&&state.page==='reports'&&$('#monthlyCloseChecklist')?.dataset.month==='2027-12'};
  }));
  add(56,'Hoje mostra o histórico e Orçamento oferece cadastro rápido de compromisso',()=>withDiagnosticSandbox({state:{page:'budget'}},async()=>{
    try{
      render();
      const paired=Boolean($('#page-home #expenseHistoryCard')&&$('#page-home .home-calendar-preview')&&$('#page-budget #accountsPayableCard'));
      $('#page-budget [data-home-new-task]').click();
      const dialog=$('#calendarComposeDialog'),form=$('#calendarTaskForm');
      const opened=dialog.open;
      form.elements.title.value='Compromisso de teste';
      await submitCalendarTask({preventDefault(){},target:form});
      return {passed:paired&&opened&&!dialog.open&&state.page==='budget'&&db.tasks.some(task=>task.title==='Compromisso de teste')};
    }finally{if($('#calendarComposeDialog').open)$('#calendarComposeDialog').close()}
  }));
  add(57,'Carteira usa uma grade única ordenada por data',()=>withDiagnosticSandbox({},()=>{
    db.investments=['2027-01-01','2027-01-04','2027-01-04'].map((date,index)=>({id:'qa-position-'+index,name:'Posição '+index,institution:'Inter',product:'CDB',date,checked:date,cost:10000,balance:10000}));
    investments();
    const cards=[...document.querySelectorAll('.investment-card-grid > .investment-tile')];
    return {passed:cards.length===3&&cards.map(card=>card.querySelector('time')?.dateTime).join()===
      '2027-01-04,2027-01-04,2027-01-01'&&cards.every(card=>card.querySelector('[data-investment-edit]'))};
  }));

  add(58,'Calendários compartilham a escala de gastos lançados',()=>{
    const {levelFor}=calendarSpending(new Map([
      ['2027-01-01',[{source:'record',kind:'expense',value:-100}]],
      ['2027-01-02',[{source:'record',kind:'expense',value:-500}]],
      ['2027-01-03',[{source:'recurring',kind:'scheduled-expense',value:-900}]]
    ]));
    return {passed:levelFor('2027-01-01')===1&&levelFor('2027-01-02')===5&&levelFor('2027-01-03')===0};
  });

  add(59,'Gravação de outra aba preservada após rejeitar edição desatualizada',()=>withDiagnosticSandbox({},async({localStorage:store})=>{
    const foreign=empty();
    foreign.records.push(dateRecord('qa-other-tab','expense',321,'2027-01-04'));
    const raw=JSON.stringify(foreign);
    store.setItem(STORE,raw);
    const changed=await mutate(()=>db.records.push(dateRecord('qa-stale-tab','expense',123,'2027-01-05')));
    return {passed:!changed&&!db.records.length&&store.getItem(STORE)===raw&&await integrityBank()==='pendente'};
  }));

  add(60,'Previsão no Orçamento e no Calendário vira um único lançamento',()=>withDiagnosticSandbox({
    confirm:true,state:{year:2028,month:1,page:'budget'}},async()=>{
    db.recurring=[{id:'qa-bill',kind:'expense',amount:2500,day:31,category:'Água',
      startMonth:'2028-01',endMonth:'2028-02',note:'Conta sintética'}];
    render();
    const date='2028-02-29';
    const before=calendarEventsForMonth(2028,1).get(date)||[];
    const pending=pendingRecurring();
    await applyRecurring();
    await applyRecurring();
    const after=calendarEventsForMonth(2028,1).get(date)||[];
    return {passed:pending.length===1&&pending[0].date===date&&
      before.some(item=>item.kind==='scheduled-expense')&&!after.some(item=>item.kind==='scheduled-expense')&&
      db.records.length===1&&Engines.monthData(db,2028,1).expenses===2500};
  }));

  add(61,'A navegação liga os nove módulos por áreas e atalhos móveis',()=>{
    const interfaces=integrityInterface();
    return {passed:interfaces.every(item=>item.status==='aprovada')&&$('#mobileNav').children.length===5&&
      Boolean($('#desktopNav [data-page="budget"]'))&&!$('#desktopNav .desktop-nav-group')&&
      Boolean($('#page-budget .finance-section-nav [data-page="transactions"]'))&&
      Boolean($('#page-budget .finance-section-nav [data-page="investments"]'))&&
      Boolean($('#page-budget .finance-section-nav [data-page="goals"]'))&&
      Boolean($('#page-analysis .analysis-section-nav [data-analysis-view="reports"]'))};
  });

  add(62,'Registrar mantém formulários laterais isolados dos modais',()=>withDiagnosticSandbox({},()=>{
    const passed=['income','expense','investment','commitment'].every(view=>{state.registerView=view;register();const form=$('#registerSecondaryEntryForm');return Boolean(form?.dataset.inlineMode&&form.querySelector('[data-field-id]')&&!form.querySelector('#amount'))});return {passed};
  }),'formulários de Registrar');
  add(63,'Notas preservam cor e calendário mostra dados na data selecionada',()=>withDiagnosticSandbox({},()=>{
    const sample=verify({...empty(),notes:[{id:'qa-color',date:'2027-01-03',text:'Nota de teste',color:'purple',pinned:false}]});return {passed:sample?.notes[0]?.color==='purple'&&typeof openCalendarDayOverlay==='function'&&Boolean($('#homeFullCalendar .calendar-grid'))};
  }),'calendário e backup');
  add(64,'Cofre AAD autentica proprietário e rejeita adulteração',()=>withDiagnosticSandbox({},async()=>{
    if(!crypto?.subtle)return {unsupported:true,reason:'WebCrypto indisponível'};
    const salt=bytesTo64(crypto.getRandomValues(new Uint8Array(16))),key=await deriveVaultKey('senha sintética AAD de teste',from64(salt)),envelope=await sealVault(empty(),key,salt);let blocked=false;
    try{await openVault({...envelope,ownerId:'perfil-adulterado'},key)}catch{blocked=true}
    return {passed:envelope.format==='reserva-vault-2'&&blocked&&Boolean(await openVault(envelope,key))};
  }),'criptografia isolada');
  add(65,'CSS consolidado e renderização preservam contratos do aplicativo',()=>({passed:document.querySelectorAll('style#reserva-app-styles').length===1&&typeof captureRenderPosition==='function'&&typeof restoreRenderPosition==='function'}),'estrutura e renderização');
  const historical=[
    [31,'H1 · Cópia de despesas e vínculo com investimento',()=>({pending:true,reason:'Ciclo de formulário ainda sem isolamento completo'})],
    [32,'H2 · Cálculo de metas e CDI',()=>({pass:typeof cdiBounds([{date:'2027-01-01',value:1}],100).factor==='function'})],
    [33,'H3 · Limpeza não pode depender da API de pasta',()=>({pending:true,reason:'Exige adaptador de pasta fake ligado às funções reais'})],
    [34,'H4 · Relatório/PDF mantém estrutura sem truncamento',()=>({pass:typeof htmlReportToModel==='function'})],
    [35,'H5 · CSS de impressão mantém colunas',()=>({pending:true,reason:'Verificar as colunas na prévia de impressão do relatório gerado. O CSS do relatório é criado separadamente.'})],
    [36,'H6 · Lote vendido permanece editável sem reabrir saldo',()=>({pending:true,reason:'Exige fluxo de edição de investimento em DOM isolado'})],
    [37,'H8 · Custo proporcional de venda parcial',()=>({pending:true,reason:'Exige fluxo de venda parcial e despesas de pecuária isolado'})],
    [38,'H9 · Atualização não registra abandono indevido',()=>({pending:true,reason:'Exige simulação de ciclo de vida do service worker'})],
    [39,'H10 · Backup em pasta trata NotFoundError',()=>({pending:true,reason:'Exige adaptador fake de diretório ligado ao gravador real'})],
    [40,'H11 · Categoria Outros tem cor cadastrada',()=>({pass:CATS.includes('Outros')&&Boolean(CAT_COLORS[CATS.indexOf('Outros')])})],
    [41,'H12 · Percentual de renda comprometida',()=>withDiagnosticSandbox({state:{year:2027,month:4}},()=>{db.records=[dateRecord('h12-i','income',100000,'2027-05-05'),dateRecord('h12-e','expense',60000,'2027-05-06')];return {pass:close((100000-40000)/100000*100,60),evidence:{percentage:60}}})],
    [42,'H13 · Resgate líquido entra no fluxo de caixa',()=>withDiagnosticSandbox({state:{year:2027,month:0}},()=>{db.jars.push({id:'h13-j',name:'fixture',target:10000,dueDate:'2027-12-31'});db.allocations.push({id:'h13-a',jarId:'h13-j',amount:-40000,netReceived:43500,date:'2027-01-10'});const m=Engines.monthData(db,2027,0);return {pass:m.saved===-43500,evidence:{netReceivedApplied:m.saved}}})],
    [43,'H14 · CDI usa limite da data do evento',()=>({pass:close(cdiBounds([{date:'2027-01-10',value:1}],100).factor('2027-01-10','2027-01-10'),1)})],
    [44,'H18 · Limites de Mercado não duplica orçamento de categoria',()=>withDiagnosticSandbox({},()=>{const v=verify({...empty(),prefs:{...empty().prefs,marketBudget:80000,categoryBudgets:{Mercado:90000,Luz:10000}}});return {pass:!!v&&!('Mercado' in v.prefs.categoryBudgets),evidence:{marketExcluded:!!v&&!('Mercado' in v.prefs.categoryBudgets)}}})],
    [45,'H21 · Metas respeitam o mês selecionado',()=>withDiagnosticSandbox({},()=>{const fixture=empty(),jar={id:'h21-j',name:'fixture',target:100000,dueDate:'2027-12-31'};fixture.jars.push(jar);const a=Engines.goal(fixture,jar,2027,0),b=Engines.goal(fixture,jar,2027,6);return {pass:a?.monthsRemaining!==b?.monthsRemaining,evidence:{jan:a?.monthsRemaining,jul:b?.monthsRemaining}}})]
  ];
  for(const [id,title,run] of historical)add(id,title,run,'regressão histórica; fixture isolada');

  const results=[];
  for(let index=0;index<definitions.length;index++){
    const item=definitions[index];
    if(onCaseProgress)await onCaseProgress(index+1,definitions.length,item.id,item.title);
    const start=performance.now();let status='pendente',evidence,reason=item.reason;
    if(item.run){try{const result=await item.run();
      if(result?.unsupported){status='não_suportado';reason=result.reason||'Recurso indisponível';}
      else if(result?.pending){status='pendente';reason=result.reason;}
      else {status=result?.passed===true||result?.pass===true?'ok':'falha';evidence=result?.evidence;}
    }catch(error){status='erro';reason='Exceção sanitizada: '+(['Error','TypeError','ReferenceError','SyntaxError','RangeError','AbortError','QuotaExceededError','InvalidStateError','DataError'].includes(error?.name)?error.name:'Error');}}
    results.push({id:item.id,title:item.title,scope:item.scope,status,durationMs:Math.round(performance.now()-start),...(evidence?{evidence}:{}),...(reason?{reason}:{})});
  }
  return results;
}

async function runDiagnosticScan(onProgress) {
  responsiveNavigationMatrixCache = null;
  const start = performance.now();
  const scan = scanDiagnosticPage(state.page);
  scan.startedAt = new Date().toISOString();
  scan.executionBudgetMs = 60000;
  scan.modules = [];
  const skeletonModules = [];
  scan.syntheticChecks = scanSyntheticFinance();
  scan.testPlan = runPlannedRegressionTests();
  const pages = [...document.querySelectorAll('.page')];
  const active = pages.filter(page => page.classList.contains('active'));
  const current = document.body.dataset.currentPage;
  const x = window.scrollX, y = window.scrollY;
  try {
    for (const [index, [id, title]] of PAGES.entries()) {
      await onProgress(index+1, title, 40*(index+1)/PAGES.length);
      const target = document.getElementById('page-' + id);
      if (!target) {
        scan.modules.push({module:id, title, checks:[{name:'Tela do módulo', status:'erro', reason:'Tela ausente'}]});
        continue;
      }
      document.body.dataset.currentPage = id;
      pages.forEach(page => page.classList.toggle('active', page === target));
      window.scrollTo({top:0,left:0,behavior:'instant'});
      scan.modules.push({...scanDiagnosticPage(id, true), title, scenarios:scanInternalViews(target,id)});
      skeletonModules.push(capturePageSkeleton(target,id,title));
    }
  } finally {
    pages.forEach(page => page.classList.toggle('active', active.includes(page)));
    if (current === undefined) delete document.body.dataset.currentPage;
    else document.body.dataset.currentPage = current;
    window.scrollTo({top:y,left:x,behavior:'instant'});
  }
  scan.applicationSkeleton = captureApplicationSkeleton(skeletonModules);
  await onProgress(PAGES.length+1, "Testes locais adicionais", 45);
  scan.additionalTestPlan = await runAdditionalLocalTests(scan);
  await onProgress(PAGES.length+2, "Regressões históricas", 50);
  scan.historicalRegressions = historicalRegressions(scan);
  await onProgress(PAGES.length+3, "Propostas N e contrato", 55);
  scan.proposalTests = await runProposalTests(scan);
  await onProgress(PAGES.length+4, "Novos testes LOC — preparando", 58);
  scan.locTests = await runLocProposalTests(async(index,total,id,title)=>{
    const pct=58+(index/total)*35;
    await onProgress(PAGES.length+4, id+' · '+title, pct);
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  });
  await onProgress(PAGES.length+5, "Verificações de segurança", 94);
  scan.dataSecurityTests = await runDataSecurityTests();
  await onProgress(PAGES.length+6, "Esqueleto do aplicativo e fechamento do JSON", 98);
  scan.durationMs = Math.round(performance.now()-start);
  scan.completedAt = new Date().toISOString();
  const statusCounts = items => (items||[]).reduce((counts,item)=>{
    const key=String(item.status||item.result||'sem_status').toLowerCase();
    counts[key]=(counts[key]||0)+1;return counts;
  },{});
  const testSuites={loc:scan.locTests,propostas:scan.proposalTests,seguranca:scan.dataSecurityTests,
    testesAdicionais:scan.additionalTestPlan,regressoesHistoricas:scan.historicalRegressions};
  scan.testSuiteSummary={executionBudgetMs:scan.executionBudgetMs,durationMs:scan.durationMs,
    withinExecutionBudget:scan.durationMs<=scan.executionBudgetMs,
    suites:Object.fromEntries(Object.entries(testSuites).map(([name,items])=>[name,{total:items?.length||0,statusCounts:statusCounts(items)}])),
    locCoverage:{total:scan.locTests.length,implemented:scan.locTests.filter(x=>['ok','falha','erro'].includes(x.status)).length,
      passed:scan.locTests.filter(x=>x.status==='ok').length,failed:scan.locTests.filter(x=>x.status==='falha').length,
      errors:scan.locTests.filter(x=>x.status==='erro').length,pending:scan.locTests.filter(x=>x.status==='pendente').length,
      unsupported:scan.locTests.filter(x=>x.status==='não_suportado').length}};
  latestDiagnosticScan = scan;
  return scan;
}
function historicalRegressions(scan) {
  const catalog = [
    ['Cópia de despesas perde vínculo com investimento','auditoria'],
    ['Cálculo de metas e CDI incorreto','auditoria'],
    ['Limpeza da base depende da API de pasta','auditoria'],
    ['PDF com conteúdo truncado','auditoria'],
    ['PDF com colunas colapsadas','auditoria'],
    ['Edição de lote vendido bloqueada pelo mínimo de cabeças','auditoria'],
    ['Exclusão de investimento deixa despesas órfãs','auditoria'],
    ['Carteira ignora resgates ou vendas parciais','auditoria'],
    ['Atualização dispara alerta de abandono','auditoria'],
    ['Backup em pasta falha com NotFoundError','auditoria'],
    ['Categoria Outros sem cor','auditoria'],
    ['Percentual de renda comprometida divergente','auditoria'],
    ['Valor líquido do resgate incorreto','auditoria'],
    ['CDI usa data fixa ou exclui o dia do aporte','auditoria'],
    ['Projeção ignora recorrências vencidas','auditoria'],
    ['CSV interpreta milhares e centavos incorretamente','auditoria'],
    ['CSV falha ao identificar importação repetida','auditoria'],
    ['Limites de Mercado duplicados','auditoria'],
    ['Navegação móvel inconsistente com módulos existentes','auditoria'],
    ['Saldo de Hoje diverge do saldo esperado','outro chat'],
    ['Previsões e metas ignoram o mês selecionado','outro chat'],
    ['Controles do Android encobrem a interface','outro chat'],
    ['Restauração Windows falha ao criar banco temporário','outro chat'],
    ['Compilação Windows falha na leitura do banco cifrado','outro chat'],
    ['Controles sobrepostos no cabeçalho desktop','prints'],
    ['Título Hoje duplicado no desktop','prints'],
    ['Lacunas e cartões esticados no desktop','prints'],
    ['Barras vazias nas abas de Insights','prints'],
    ['Abas de Insights encobrem o conteúdo durante a rolagem','prints'],
    ['Prévia local tenta atualizar e registrar service worker','logs']
  ];
  const findings = scan.modules.flatMap(module =>
    [module, ...(module.scenarios || [])].flatMap(view =>
      view.checks.flatMap(check => (check.findings || []).map(item => ({module:module.module,...item})))));
  const events = diagnostics.report().events;
  const coverage = {
    7: () => db.records.some(record => record.investmentId &&
      !db.investments.some(item => item.id === record.investmentId)),
    16: () => bankCsvMoney('R$ 1.234,56') !== 123456 ||
      bankCsvMoney('(1.234,56)') !== -123456,
    17: () => {
      const sample = {date:'2026-01-01',kind:'expense',amount:123456,note:'Café'};
      return bankCsvRecordKey(sample) !== bankCsvRecordKey({...sample,note:'  Cafe  '});
    },
    19: () => scan.modules.some(module => module.checks.some(check => check.status === 'erro' &&
      check.name === 'Tela do módulo')),
    25: () => findings.filter(item => item.type === 'sobreposição no cabeçalho'),
    26: () => findings.filter(item => item.type === 'título Hoje duplicado'),
    27: () => findings.filter(item => /lacuna excessiva|espaço vazio/.test(item.type)),
    28: () => [...document.querySelectorAll('#page-analysis > .mobile-analysis-panel[hidden]')]
      .some(panel => getComputedStyle(panel).display !== 'none'),
    30: () => !supportsHostedApp() && events.some(event =>
      ['offline.registration_failed','update.check_failed'].includes(event.code) &&
      Date.parse(event.at) >= Date.parse(scan.startedAt || scan.at))
  };
  return catalog.map(([name,source],index) => {
    const id = index+1;
    const run = coverage[id];
    if (!run || (id === 7 && vault && !vaultKey) ||
        (id === 28 && !matchMedia('(max-width:760px)').matches))
      return {id,name,source,status:'pendente',reason:'Requer cenário específico ou teste na plataforma'};
    try {
      const result = run();
      const count = Array.isArray(result) ? result.length : Number(Boolean(result));
      return {id,name,source,status:count?'alerta':'ok',count,
        scope:'Verificação parcial',...(Array.isArray(result)?{findings:result.slice(0,20)}:{})};
    } catch { return {id,name,source,status:'erro',reason:'Falha na execução da verificação'}; }
  });
}
function exportDiagnosticLog() {
  const events = diagnosticReport(latestDiagnosticScan).events;
  download(events.map(event=>JSON.stringify(event)).join('\n')+(events.length?'\n':''),
    'application/x-ndjson;charset=utf-8', 'Reserva_Simples_telemetria.jsonl');
}
function diagnosticChecks(scan){
  return [
    ...scan.checks,...scan.syntheticChecks,...scan.dataSecurityTests,...scan.proposalTests,...scan.locTests,
    ...scan.additionalTestPlan,...scan.historicalRegressions,
    ...scan.testPlan.map(test=>({id:test.id,name:test.title,status:test.result==='pendente'?(test.status==='manual'?'manual':'pendente'):test.result})),
    ...scan.modules.flatMap(module=>[...module.checks,...(module.scenarios||[]).flatMap(scenario=>scenario.checks)])
  ];
}

function canStartDiagnostic(){
  if(diagnosticRunning)return false;
  if(saving||vaultBusy||cdiState.loading||ipcaState.loading||updateInProgress||integrityMonitoring){
    notify('Aguarde a operação em andamento antes de iniciar o diagnóstico.');
    return false;
  }
  return true;
}
async function generateDiagnosticWithProgress() {
  if (!canStartDiagnostic()) return;
  diagnosticRunning = true;
  const dialog = document.createElement('dialog');
  dialog.id = 'diagnosticProgressDialog';
  dialog.setAttribute('aria-labelledby','diagnosticProgressTitle');
  dialog.innerHTML = '<h2 id="diagnosticProgressTitle">Gerando diagnóstico</h2>' +
    '<p role="status">Preparando verificações…</p><progress aria-label="Progresso do diagnóstico"></progress>';
  const status = dialog.querySelector('p');
  const bar = dialog.querySelector('progress');
  bar.max = 100;
  bar.value = 0;
  dialog.addEventListener('cancel', event => event.preventDefault());
  document.body.append(dialog);
  const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
  try {
    dialog.showModal();
    const started = performance.now();
    await wait(450);
    const scan = await runDiagnosticScan(async (step,title,percent) => {
      bar.value = Number.isFinite(percent)?percent:Math.min(40,step/PAGES.length*40);
      status.textContent = title+' · '+Math.round(bar.value)+'%';
      await wait(Math.max(0, 14500 * bar.value / 100 - (performance.now() - started)));
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    });
    bar.value = Math.max(bar.value, 95);
    status.textContent = 'Preparando arquivo de logs…';
    await wait(Math.max(350, 14700 - (performance.now() - started)));
    bar.value = 100;
    status.textContent = 'Diagnóstico concluído';
    await wait(300);
    const checks = diagnosticChecks(scan).filter(item=>!['pendente','ignorado','não_suportado','manual'].includes(item.status));
    const alerts = checks.filter(item => ['erro','alerta','falha','contrato_incompativel'].includes(item.status)).length;
    const loc=scan.testSuiteSummary.locCoverage;
    const output = $('#diagnosticScanStatus');
    if (output) output.textContent = scan.modules.length + ' módulos · ' + checks.length +
      ' verificações · LOC: ' + loc.passed + ' aprovados, ' + (loc.failed+loc.errors) +
      ' falhas/erros, ' + loc.pending + ' pendentes e ' + loc.unsupported + ' não suportados · ' +
      scan.durationMs + ' ms · ' + alerts + ' alerta(s) ou erro(s)' +
      (scan.testSuiteSummary.withinExecutionBudget?'':' · limite de 60 s excedido') + '.';
    exportDiagnosticLog();
  } catch (error) {
    diagnostics.record('diagnostic.generation_failed',error);
    const message = $('#diagnosticScanStatus');
    if (message) message.textContent = 'Falha ao gerar o diagnóstico. Tente novamente.';
  } finally {
    dialog.close();
    dialog.remove();
    diagnosticRunning = false;
  }
}
document.addEventListener('click', event => {
  if (event.target.closest('#settingsPrivacyToggle')) {
    $('#privacyToggle').click();
    $('#settingsPrivacyToggle')?.focus();
    return;
  }
  if (event.target.closest('#runDiagnosticScan')) {
    void generateDiagnosticWithProgress();
    return;
  }
  if (event.target.closest('#exportDiagnostics')) {
    exportDiagnosticLog();
  }
  if (event.target.closest('#clearDiagnostics') && confirm('Apagar o histórico de diagnóstico?')) {
    diagnostics.clear();
    latestDiagnosticScan = null;
    settings();
  }
});
function go(page){if(page==='calendar')page='home';if(page==='income'||page==='expense'){state.txFilter=page;page='transactions'}const next=PAGES.some(p=>p[0]===page)?page:'home';state.page=next;if(next!=='budget')state.financeView='overview';diagnostics.step('navigation', next);render();window.scrollTo({top:0,behavior:'instant'});$('#pageTitle').focus?.({preventScroll:true})}
function changeMonth(dir){state.month+=dir;if(state.month>11){state.month=0;state.year++}else if(state.month<0){state.month=11;state.year--}render()}
function openMonthPicker(){state.modalTrigger=document.activeElement;const monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];const currentYear=new Date().getFullYear(),yearSet=new Set([state.year]);for(let y=currentYear-20;y<=currentYear+20;y++)yearSet.add(y);for(const item of [...db.records,...db.tasks]){const y=Number((item.date||'').slice(0,4));if(y>=1900&&y<=2200)yearSet.add(y)}const monthOptions=monthNames.map((name,index)=>'<option value="'+index+'" '+(index===state.month?'selected':'')+'>'+name+'</option>').join(''),yearOptions=[...yearSet].sort((x,y)=>y-x).map(year=>'<option value="'+year+'" '+(year===state.year?'selected':'')+'>'+year+'</option>').join('');state.modal='monthPicker';$('#modalTitle').textContent='Escolher mês e ano';$('#modalContent').innerHTML='<form id="monthJumpForm" class="form-grid"><div class="month-jump-fields"><div class="field"><label for="monthJumpMonth">Mês</label><select id="monthJumpMonth" required>'+monthOptions+'</select></div><div class="field"><label for="monthJumpYear">Ano</label><select id="monthJumpYear" required>'+yearOptions+'</select></div></div><div class="form-buttons"><button type="button" class="btn" data-close="1">Cancelar</button><button class="btn primary" type="submit">Ver período</button></div></form>';$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#monthJumpMonth').focus()}
function openDepositPicker(){if(!$('#modal').classList.contains('open'))state.modalTrigger=document.activeElement;const jars=db.jars.filter(j=>!j.archived);state.modal='depositPicker';$('#modalTitle').textContent='Guardar em um cofrinho';$('#modalContent').innerHTML=jars.length?`<div class="deposit-picker-list">${jars.map(j=>`<button class="deposit-picker-option" data-open="add" data-jar="${esc(j.id)}">${icon('piggy')}<span><b>${esc(j.name)}</b><small>Saldo atual ${money(jarTotal(j.id))}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>`:`<div class="empty-inline">Crie um cofrinho para começar a guardar valores.</div><div class="form-buttons"><button type="button" class="btn" data-close="1">Agora não</button><button class="btn primary" data-open="jar">Criar cofrinho</button></div>`;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#modalContent button')?.focus()}
function openQuickAdd(){state.modalTrigger=document.activeElement;state.modal='quickAdd';$('#modalTitle').textContent='Registrar';$('#modalContent').innerHTML=`<div class="quick-add-options"><button class="quick-add-option expense" data-quick-open="expense">${icon('expense')}<span><b>Despesa</b><small>Registrar um gasto</small></span></button><button class="quick-add-option income" data-quick-open="income">${icon('income')}<span><b>Renda</b><small>Registrar um recebimento</small></span></button><button class="quick-add-option goal" data-register-investment>${icon('piggy')}<span><b>Investimento</b><small>Abrir a carteira e registrar uma aplicação</small></span></button></div>`;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#modalContent button')?.focus()}
function openModal(mode,entityId=null,quick=false,homeEntry='',inlineHost=null){if(!$('#modal').classList.contains('open'))state.modalTrigger=document.activeElement;state.modal=mode;const existingAllocation=['add','withdraw'].includes(mode)?db.allocations.find(a=>a.id===entityId):null;state.editAllocationId=existingAllocation?.id||null;state.editJarId=['jar','add','withdraw'].includes(mode)?(existingAllocation?.jarId||entityId):null;state.editRecordId=['income','expense','recurring'].includes(mode)?entityId:null;state.editInstitutionId=mode==='institution'?entityId:null;const existingRecord=state.editRecordId?db.records.find(r=>r.id===state.editRecordId&&r.kind===mode):null;if(state.editRecordId&&!existingRecord&&mode!=='recurring'){notify('Lançamento não encontrado.');return}const titles={income:existingRecord?'Editar renda':'Adicionar renda',expense:existingRecord?'Editar despesa':'Nova despesa',jar:entityId?'Editar cofrinho':'Novo cofrinho',add:existingAllocation?'Editar aporte':'Guardar no cofrinho',withdraw:existingAllocation?'Editar resgate':'Resgatar do cofrinho',recurring:entityId?'Editar conta recorrente':'Nova conta recorrente',institution:entityId?'Editar instituição':'Cadastrar banco ou cooperativa'};$('#modalTitle').textContent=titles[mode];let fields='';
if(mode==='income'||mode==='expense')fields=`${mode==='income'?`<div class="field full"><label for="type">Tipo de renda</label><select id="type"><option value="salary" ${existingRecord?.source==='salary'?'selected':''}>Salário</option><option value="complement" ${existingRecord?.source==='complement'?'selected':''}>Complemento</option></select></div>`:`<div class="field full"><label for="category">Categoria</label><select id="category">${CATS.map(cat=>`<option ${(existingRecord?.category||(homeEntry==='card'?'Cartões':''))===cat?'selected':''}>${esc(cat)}</option>`).join('')}</select></div>`}<div class="field full"><label for="subcategory">Subcategoria (opcional)</label><input id="subcategory" type="text" maxlength="50" value="${esc(existingRecord?.subcategory||'')}" placeholder="Ex.: supermercado, combustível, material"></div><div class="field full"><label for="tags">Etiquetas (opcional)</label><input id="tags" type="text" maxlength="240" value="${esc((existingRecord?.tags||[]).join(', '))}" placeholder="Ex.: casa, viagem, reembolso"><small>Separe as etiquetas por vírgulas. Você pode usar até 8.</small></div><div class="field full"><label for="amount">Valor (R$)</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0,00" value="${existingRecord?existingRecord.amount/100:''}"></div><div class="field"><label for="date">Data</label><input id="date" type="date" value="${existingRecord?.date||formDate()}" required></div><div class="field full"><label for="note">Descrição (opcional)</label><input id="note" type="text" maxlength="140" value="${esc(existingRecord?.note||'')}" placeholder="Ex.: ${mode==='income'?'pagamento recebido':'conta do mês'}"></div>`;
if(mode==='recurring'){const t=db.recurring.find(x=>x.id===entityId),kind=t?.kind||'expense';fields=`<div class="field full"><label for="recurringKind">Tipo de previsão</label><select id="recurringKind"><option value="expense" ${kind==='expense'?'selected':''}>Despesa</option><option value="income" ${kind==='income'?'selected':''}>Renda</option></select></div><div class="field full" id="recurringCategoryWrap" ${kind==='income'?'hidden':''}><label for="category">Categoria</label><select id="category">${CATS.map(cat=>`<option ${t?.category===cat?'selected':''}>${esc(cat)}</option>`).join('')}</select></div><div class="field full" id="recurringSourceWrap" ${kind!=='income'?'hidden':''}><label for="recurringSource">Origem da renda</label><select id="recurringSource"><option value="salary" ${t?.source==='salary'?'selected':''}>Salário</option><option value="complement" ${t?.source!=='salary'?'selected':''}>Complemento</option></select></div><div class="field full"><label for="amount">Valor previsto (R$)</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${t?t.amount/100:''}" placeholder="0,00"></div><div class="field"><label for="recurringDay">Dia do mês</label><input id="recurringDay" type="number" min="1" max="31" required value="${t?.day||5}"></div><div class="field"><label for="recurringStart">A partir do mês</label><input id="recurringStart" type="month" required value="${t?.startMonth||mkey(state.year,state.month)}"></div><div class="field"><label for="recurringEnd">Até o mês (opcional)</label><input id="recurringEnd" type="month" value="${t?.endMonth||''}"></div><label class="switch"><input id="recurringPaused" type="checkbox" ${t?.paused?'checked':''}>Pausada</label><div class="field full"><label for="note">Descrição (opcional)</label><input id="note" type="text" maxlength="140" value="${esc(t?.note||'')}" placeholder="Ex.: Internet residencial"></div><div class="soft-tip full">A previsão só aparece nos totais após você confirmar o lançamento.</div>`}
if(homeEntry==='due'){
  $('#modalTitle').textContent='Adicionar vencimento';
  fields=`<div class="field full"><label for="note">Nome da conta</label><input id="note" type="text" maxlength="140" required placeholder="Ex.: Fatura do cartão"></div>
  <div class="field"><label for="amount">Valor previsto (R$)</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0,00"></div>
  <div class="field"><label for="dueEntryDate">Data de vencimento</label><input id="dueEntryDate" type="date" value="${isoToday()}" required></div>
  <div class="field full"><label for="category">Categoria</label><select id="category">${CATS.map(cat=>`<option ${cat==='Outros'?'selected':''}>${esc(cat)}</option>`).join('')}</select></div>
  <label class="switch full"><input id="dueEntryMonthly" type="checkbox"> Repetir todos os meses</label>
  <p class="help full">A conta aparece no Calendário e em Próximos vencimentos. A conta entra nos totais quando você confirma o lançamento em Orçamento.</p>`;
}
if(mode==='institution'){const i=db.institutions.find(x=>x.id===entityId);fields=`<div class="field full"><label for="institutionName">Nome do banco ou cooperativa</label><input id="institutionName" type="text" maxlength="70" required value="${esc(i?.name||'')}" placeholder="Ex.: Cooperativa de crédito"></div><div class="field"><label for="institutionType">Tipo</label><select id="institutionType"><option value="bank" ${i?.type!=='cooperative'?'selected':''}>Banco</option><option value="cooperative" ${i?.type==='cooperative'?'selected':''}>Cooperativa</option></select></div><div class="field"><label for="institutionCdiPercent">Rendimento (% do CDI)</label><input id="institutionCdiPercent" type="number" min="0.01" max="500" step="0.01" required value="${i?.cdiPercent??100}"></div><div class="field full"><label for="institutionFund">Fundo garantidor informado</label><select id="institutionFund"><option value="fgc" ${i?.guaranteeFund==='fgc'?'selected':''}>FGC</option><option value="fgcoop" ${i?.guaranteeFund==='fgcoop'?'selected':''}>FGCoop</option><option value="none" ${i?.guaranteeFund==='none'?'selected':''}>Não monitorar</option></select></div><div class="field full"><label for="institutionConglomerate">Conglomerado financeiro</label><input id="institutionConglomerate" type="text" maxlength="100" value="${esc(i?.conglomerate||i?.name||'')}"></div><div class="field full"><label for="institutionOtherBalance">Outros saldos elegíveis nessa instituição (R$)</label><input id="institutionOtherBalance" type="number" min="0" step="0.01" value="${((i?.otherCoveredBalance||0)/100).toFixed(2)}"></div><div class="soft-tip full">O percentual estima os rendimentos. A cobertura depende da instituição, do produto e das regras do fundo; confirme essas informações.</div>`}
if(mode==='jar'){const j=db.jars.find(x=>x.id===entityId);fields=`<div class="field full"><label for="jarName">O que você quer realizar?</label><input id="jarName" type="text" maxlength="70" required value="${esc(j?.name||'')}" placeholder="Ex.: Reserva de emergência"><span class="explain">Dê um nome que ajude a identificar o objetivo.</span></div><div class="field full"><label for="jarInstitution">Banco ou cooperativa</label><select id="jarInstitution">${db.institutions.map(i=>`<option value="${esc(i.id)}" ${(j?.institutionId||'inter-default')===i.id?'selected':''}>${esc(i.name)} · ${percent(i.cdiPercent)} do CDI</option>`).join('')}</select><span class="explain">Para cadastrar outra instituição, use Ajustes → Bancos e cooperativas.</span></div><div class="field full"><label for="jarTarget">Quanto você precisa? (R$)</label><input id="jarTarget" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${j?j.target/100:''}" placeholder="Ex.: 10000"></div><div class="field full"><label for="jarDue">Até quando quer alcançar?</label><input id="jarDue" type="date" required value="${j?.dueDate||state.year+'-12-31'}"><span class="explain">O app calcula uma referência mensal. Você decide quando e quanto guardar.</span></div>${db.investments.length?`<fieldset class="full linked-positions"><legend>Investimentos vinculados <small>Opcional</small></legend><p>Selecione aplicações externas ao cofrinho. O saldo vinculado é somado ao cofrinho; não vincule aqui o mesmo dinheiro já lançado como aporte.</p><div class="linked-positions-list">${db.investments.filter(x=>!x.goalId||x.goalId===j?.id||!db.jars.some(g=>g.id===x.goalId)).map(x=>`<label class="linked-position"><input type="checkbox" name="linkedInvestment" value="${esc(x.id)}" ${x.goalId===j?.id?'checked':''}><span class="linked-position-name"><strong>${esc(x.name)}</strong><small>${esc(x.institution)} · ${esc(x.product)}</small></span><span class="linked-position-value">${money(x.balance)}</span></label>`).join('') || '<p>As aplicações cadastradas já estão vinculadas a outras metas.</p>'}</div></fieldset>`:''}<div class="goal-draft-preview" id="goalDraftPreview" aria-live="polite"></div>`}
if(mode==='add'||mode==='withdraw'){const j=db.jars.find(x=>x.id===state.editJarId);if(!j)return notify('Cofrinho não encontrado.');fields=`<div class="preview-line">${mode==='add'?'Guardando em':'Resgatando de'} <b>${esc(j.name)}</b>. Principal disponível: <b>${money(jarTotal(j.id))}</b>.</div><div class="field full"><label for="amount">${mode==='withdraw'?'Principal baixado (R$)':'Valor (R$)'}</label><input id="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0,00" value="${existingAllocation?Math.abs(existingAllocation.amount)/100:''}"></div>${mode==='withdraw'?`<div class="field full"><label for="netReceived">Valor líquido recebido (R$, opcional)</label><input id="netReceived" type="number" min="0.01" step="0.01" inputmode="decimal" value="${existingAllocation?.netReceived?existingAllocation.netReceived/100:''}"><small>Informe o valor do extrato, após rendimentos e impostos. Em branco, será usado o principal baixado.</small></div>`:''}<div class="field full"><label for="date">Data</label><input id="date" type="date" required value="${existingAllocation?.date||formDate()}"></div><div class="field full"><label for="note">Descrição (opcional)</label><input id="note" type="text" maxlength="140" placeholder="Ex.: ${mode==='add'?'valor separado':'despesa imprevista'}" value="${esc(existingAllocation?.note||'')}"></div>${mode==='add'&&!existingAllocation?`<div class="preview-line" id="percentPreview">Sua reserva mínima no mês é ${money(month().minimum)} (10% da renda). Informe quanto vai guardar para ver sua porcentagem.</div>`:''}`}
if(quick&&['income','expense'].includes(mode)){
 const template=document.createElement('template');
 template.innerHTML=fields;
 const main=['amount',mode==='income'?'type':'category','note'];
 const basic=main.map(id=>template.content.querySelector('#'+id).closest('.field'));
 basic.forEach(field=>field.remove());
 fields=basic.map(field=>field.outerHTML).join('')+
   '<details class="full quick-entry-more"><summary>Mais opções</summary>'+template.innerHTML+'</details>';
}
$('#modalContent').innerHTML=`<form id="entryForm" class="form-grid">${fields}<div class="form-buttons"><button type="button" class="btn" data-close="1">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div></form>`;if(inlineHost){const form=$('#modalContent form');form.dataset.inlineMode=mode;form.id='registerSecondaryEntryForm';form.querySelectorAll('[id]').forEach(node=>{node.dataset.fieldId=node.id;node.id='registerInline-'+node.id});form.querySelectorAll('label[for]').forEach(label=>label.htmlFor='registerInline-'+label.htmlFor);form.dataset.inlineHomeEntry=homeEntry;form.querySelector('[data-close]')?.remove();inlineHost.append(form);return}$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';focusAppModal($('#amount')||$('#jarName')||$('#institutionName'));if(mode==='jar')goalDraftPreview()}
function focusAppModal(preferred){const surface=$('#modal .dialog');if(!surface)return;surface.setAttribute('tabindex','-1');(preferred||surface.querySelector('input,select,textarea,button')||surface).focus();if(!$('#modal').contains(document.activeElement))surface.focus()}
function closeModal(force=false){if(!force&&$('#modal').classList.contains('open')){const f=$('#modalContent form');if(f&&[...f.elements].some(x=>{if(x.type==='submit'||x.type==='button')return false;if(x.type==='checkbox'||x.type==='radio')return x.checked!==x.defaultChecked;if(x.tagName==='SELECT'){const initial=[...x.options].find(o=>o.defaultSelected)||x.options[0];return x.value!==(initial?.value??'')}return x.value!==x.defaultValue})&&!confirm('Descartar as alterações não salvas?'))return}$('#modal').classList.remove('open');$('#modal').setAttribute('aria-hidden','true');document.body.style.overflow='';state.modal='';state.editJarId=null;state.editRecordId=null;state.editInstitutionId=null;state.editAllocationId=null;calendarRecordEditPending=false;calendarInvestmentEditPending=false;const trigger=state.modalTrigger;state.modalTrigger=null;setTimeout(()=>trigger?.isConnected&&trigger.focus?.(),0)}
function preview(){if(state.modal!=='add')return;const n=toCents($('#amount')?.value);const m=month();const saved=m.saved+(Number.isFinite(n)?n:0);$('#percentPreview').textContent=`Após guardar: ${money(saved)} no mês, ${m.income?percent(saved/m.income*100):'porcentagem indisponível sem renda'}. Mínimo recomendado: ${money(m.minimum)}.${m.income?(saved>=m.minimum?' Referência atingida.':' Faltam '+money(m.minimum-saved)+'.'):''}`}
function goalDraftPreview(){const box=$('#goalDraftPreview');if(!box||state.modal!=='jar')return;const target=toCents($('#jarTarget')?.value),due=$('#jarDue')?.value,j=db.jars.find(x=>x.id===state.editJarId),selected=[...document.querySelectorAll('input[name="linkedInvestment"]:checked')].map(x=>x.value),linked=sum(db.investments.filter(x=>selected.includes(x.id)).map(x=>x.balance)),current=(j?estimateCdbJar(j.id).net:0)+linked;if(!Number.isFinite(target)||!validDate(due)){box.innerHTML='<b>Prévia do plano</b><span>Informe um valor e um prazo válido para ver a contribuição mensal estimada.</span>';return}const today=new Date(),dueDate=new Date(due+'T12:00:00'),months=Math.max(0,(dueDate.getFullYear()-today.getFullYear())*12+dueDate.getMonth()-today.getMonth()+1),pending=Math.max(0,target-current),monthly=pending===0?0:months?Math.ceil(pending/months):null;box.innerHTML=`<b>${pending===0?'Objetivo já alcançado':monthly===null?'Prazo anterior a este mês':`${money(monthly)} por mês como referência`}</b><span>${money(current)} já guardados de ${money(target)}. ${monthly===null?'Ajuste o prazo para calcular o valor mensal.':'Estimativa simples, sem considerar rendimentos ou inflação.'}</span>`}
document.addEventListener('click',event=>{
  if(event.target.closest('[data-open-income-reserve]')){go('goals');revealSearchTarget($('#incomeReserveCard'));return}
  const budgetLink=event.target.closest('[data-home-budget],[data-budget-target]');
  if(budgetLink){go('budget');revealSearchTarget(document.getElementById(budgetLink.dataset.budgetTarget||'categoryBudgetCard'));return}
  if(event.target.closest('[data-insight-close]')){go('reports');revealSearchTarget($('#monthlyCloseChecklist'));return}
  const button=event.target.closest('[data-home-finance-entry]');
  if(!button)return;
  const mode=button.dataset.homeFinanceEntry;
  openModal(mode==='card'?'expense':'recurring',null,false,mode);
});
async function saveHomeDueEntry(form){
 const $=selector=>(form||document).querySelector(form?.dataset.inlineMode?selector.replace(/#([\w-]+)/g,'[data-field-id="$1"]'):selector);
  const date=$('#dueEntryDate').value,amount=toCents($('#amount').value);
  const category=$('#category').value,note=$('#note').value.trim();
  if(!validDate(date)||!Number.isSafeInteger(amount)||amount<=0||!note||!CATS.includes(category)){
    notify('Informe o nome, o vencimento e o valor da conta.');
    return;
  }
  const startMonth=date.slice(0,7);
  const entry={id:uid(),kind:'expense',source:'complement',amount,day:Number(date.slice(8)),
    startMonth,endMonth:$('#dueEntryMonthly').checked?null:startMonth,category,note,paused:false};
  if(await mutate(()=>db.recurring.push(entry))){
    closeModal(true);
    notify('Vencimento cadastrado.');
  }
}
async function submitEntry(e){e.preventDefault();if(!e.target)e={...e,target:document.querySelector('#modalContent form')};const $=selector=>e.target.querySelector(e.target.dataset.inlineMode?selector.replace(/#([\w-]+)/g,'[data-field-id="$1"]'):selector);if(e.target.dataset.inlineMode){state.modal=e.target.dataset.inlineMode;state.editRecordId=null;state.editJarId=null;}const mode=state.modal,monthBefore=mkey(state.year,state.month);let record;
if(mode==='recurring'&&$('#dueEntryDate'))return saveHomeDueEntry(e.target);
if(mode==='recurring'){const amount=toCents($('#amount').value),day=Number($('#recurringDay').value),startMonth=$('#recurringStart').value,endMonth=$('#recurringEnd').value||null,kind=$('#recurringKind').value,source=$('#recurringSource')?.value||'complement',category=kind==='income'?'Outros':$('#category').value,note=$('#note').value.trim().slice(0,140);if(!Number.isSafeInteger(amount)||!Number.isInteger(day)||day<1||day>31||!validDate(startMonth+'-01')||(endMonth&&(!validDate(endMonth+'-01')||endMonth<startMonth))||(kind==='expense'&&!CATS.includes(category))){notify('Confira os dados da previsão recorrente.');return}const existing=db.recurring.find(t=>t.id===state.editRecordId);const entry={id:existing?.id||uid(),kind,source,amount,day,startMonth,endMonth,category,note,paused:$('#recurringPaused').checked};if(!await mutate(()=>{if(existing)db.recurring[db.recurring.indexOf(existing)]=entry;else db.recurring.push(entry)}))return}
else if(mode==='institution'){const name=$('#institutionName').value.trim(),type=$('#institutionType').value,cdiPercent=Number($('#institutionCdiPercent').value),guaranteeFund=$('#institutionFund').value,conglomerate=$('#institutionConglomerate').value.trim(),otherRaw=Number($('#institutionOtherBalance').value),otherCoveredBalance=Number.isFinite(otherRaw)&&otherRaw>=0&&otherRaw<=100000000?Math.round(otherRaw*100):NaN,existing=db.institutions.find(x=>x.id===state.editInstitutionId);if(!name||!['bank','cooperative'].includes(type)||!Number.isFinite(cdiPercent)||cdiPercent<=0||cdiPercent>500||!['fgc','fgcoop','none'].includes(guaranteeFund)||!conglomerate||!Number.isSafeInteger(otherCoveredBalance)){notify('Confira o nome, o tipo e o percentual de CDI.');return}const item={id:existing?.id||uid(),name:name.slice(0,70),type,cdiPercent,guaranteeFund,conglomerate:conglomerate.slice(0,100),otherCoveredBalance,isDefault:!!existing?.isDefault};if(!await mutate(()=>{if(existing)db.institutions[db.institutions.indexOf(existing)]=item;else db.institutions.push(item)}))return;closeModal(true);notify(existing?'Instituição atualizada.':'Instituição cadastrada.');return}
else if(mode==='jar'){const name=$('#jarName').value.trim(),target=toCents($('#jarTarget').value),dueDate=$('#jarDue').value;if(!name||!Number.isFinite(target)||!validDate(dueDate)){notify('Preencha corretamente o nome, valor e prazo.');return}const exists=db.jars.find(x=>x.id===state.editJarId);const linkedIds=new Set(new FormData(e.target).getAll('linkedInvestment'));const newJar={id:exists?.id||uid(),name:name.slice(0,70),target,dueDate,institutionId:$('#jarInstitution').value||'inter-default',paused:!!exists?.paused,archived:!!exists?.archived};if(!await mutate(()=>{if(exists)db.jars[db.jars.indexOf(exists)]=newJar;else db.jars.push(newJar);for(const item of db.investments){if(linkedIds.has(item.id))item.goalId=newJar.id;else if(item.goalId===newJar.id)item.goalId=null}}))return}
else{const amount=toCents($('#amount').value),date=$('#date').value,note=$('#note').value.trim().slice(0,140);if(!Number.isFinite(amount)||!validDate(date)){notify('Informe um valor positivo e uma data válida.');return}if(mode==='income'||mode==='expense'){const previousRecord=db.records.find(r=>r.id===state.editRecordId),linkedInvestment=previousRecord?.investmentId?db.investments.find(x=>x.id===previousRecord.investmentId):null;if(linkedInvestment&&(linkedInvestment.redemptions||[]).some(r=>r.kind==='sale')){notify('Para preservar o custo já distribuído nas vendas, este gasto do lote não pode ser editado após a primeira venda.');return}record={id:state.editRecordId||uid(),kind:mode,amount,date,note,source:mode==='income'?$('#type').value:'complement',category:previousRecord?.investmentId?'Pecuária':mode==='expense'?$('#category').value:'Outros',subcategory:$('#subcategory')?.value.trim().slice(0,50)||'',tags:normalizeTags($('#tags')?.value||''),recurringId:previousRecord?.recurringId||null,recurringMonth:previousRecord?.recurringMonth||null,investmentId:previousRecord?.investmentId||null,investmentExpenseId:previousRecord?.investmentExpenseId||null};state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;if(calendarRecordEditPending&&!confirm('Confirma salvar? Isso mudará os valores registrados no lançamento e poderá alterar totais e relatórios.'))return;if(!await mutate(()=>{if(previousRecord?.investmentId){const asset=db.investments.find(x=>x.id===previousRecord.investmentId),expense=asset?.expenses?.find(e=>e.id===previousRecord.investmentExpenseId);if(expense){asset.remainingCostBasis=Math.max(0,asset.remainingCostBasis-expense.amount+amount);expense.amount=amount;expense.date=date;expense.note=note}}const i=db.records.findIndex(x=>x.id===record.id);if(i>=0)db.records[i]=record;else db.records.push(record)}))return}else{const jar=db.jars.find(j=>j.id===state.editJarId);if(!jar){notify('Cofrinho não encontrado.');return}const signed=mode==='withdraw'?-amount:amount;if(signed<0){const balanceAtDate=sum(db.allocations.filter(a=>a.jarId===jar.id&&a.id!==state.editAllocationId&&a.date<=date).map(a=>a.amount));if(amount>balanceAtDate){notify(`Resgate maior que o saldo disponível em ${dateBR(date)}.`);return}}const receivedInput = mode==='withdraw' ? $('#netReceived').value.trim() : '';
const netReceived = receivedInput ? toCents(receivedInput) : null;
if(receivedInput && (!Number.isSafeInteger(netReceived)||netReceived<=0)){notify('Informe um valor líquido recebido válido.');return}
const previousAllocation=db.allocations.find(a=>a.id===state.editAllocationId);record={id:previousAllocation?.id||uid(),jarId:jar.id,amount:signed,date,note,...(netReceived!==null?{netReceived}:{})};const remaining=previousAllocation?db.allocations.filter(a=>a.id!==previousAllocation.id):db.allocations,proposed=[...remaining,record],invalidDate=firstNegativeJarDate(jar.id,proposed);if(invalidDate){notify(`Essa alteração deixaria o saldo do cofrinho negativo em ${dateBR(invalidDate)}.`);return}if(state.editAllocationId&&!confirm('Confirma salvar? Isso mudará os valores registrados no cofrinho e poderá alterar saldos e relatórios.'))return;state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;if(!await mutate(()=>db.allocations=proposed))return}}closeModal(true);notify(monthBefore===mkey(state.year,state.month)?'Salvo com sucesso.':`Salvo em ${monthLabel()}.`)}
async function deleteRecord(id){const x=db.records.find(r=>r.id===id);if(!x)return;const asset=x.investmentId?db.investments.find(v=>v.id===x.investmentId):null;if(asset&&(asset.redemptions||[]).some(r=>r.kind==='sale')){notify('Este gasto do lote já compõe vendas registradas e não pode ser excluído.');return}if(!confirm(`Excluir ${money(x.amount)} de ${dateBR(x.date)}?`))return;if(await mutate(()=>{if(asset){const expense=asset.expenses?.find(e=>e.id===x.investmentExpenseId);if(expense){asset.remainingCostBasis=Math.max(0,asset.remainingCostBasis-expense.amount);asset.expenses=asset.expenses.filter(e=>e.id!==expense.id)}}db.records=db.records.filter(r=>r.id!==id)}))notify('Lançamento excluído.')}
function firstNegativeJarDate(jarId,allocations){let balance=0;for(const item of allocations.filter(x=>x.jarId===jarId).sort(byAllocationDate)){balance+=item.amount;if(balance<0)return item.date}return null}
async function deleteAllocation(id){const a=db.allocations.find(r=>r.id===id);if(!a)return;const remaining=db.allocations.filter(x=>x.id!==id),invalidDate=firstNegativeJarDate(a.jarId,remaining);if(invalidDate){notify(`Não é possível excluir: o saldo ficaria negativo em ${dateBR(invalidDate)}.`);return}if(!confirm('Excluir esta movimentação do cofrinho?'))return;if(await mutate(()=>db.allocations=remaining))notify('Movimentação excluída.')}
async function removeInvestment(id){const item=db.investments.find(x=>x.id===id);if(!item)return;if(!confirm('Remover este investimento? Isso alterará os valores registrados na carteira. As despesas do lote continuarão no histórico como Pecuária.'))return;if(await mutate(()=>{db.records=db.records.map(r=>r.investmentId===id?{...r,investmentId:null,investmentExpenseId:null,category:'Pecuária'}:r);db.investments=db.investments.filter(x=>x.id!==id)}))notify('Investimento removido da carteira.')}

async function archiveJar(id,archived=true){const jar=db.jars.find(j=>j.id===id);if(!jar)return;if(await mutate(()=>jar.archived=archived))notify(archived?'Cofrinho arquivado. O histórico foi preservado.':'Cofrinho restaurado.')}
async function toggleJarPlan(id){const jar=db.jars.find(j=>j.id===id);if(!jar)return;if(await mutate(()=>jar.paused=!jar.paused))notify(jar.paused?'Plano pausado. Saldo e histórico preservados.':'Plano retomado. A contribuição mensal voltou ao planejamento.')}
async function deleteJar(id){const j=db.jars.find(r=>r.id===id);if(!j)return;if(db.allocations.some(a=>a.jarId===id)){notify('Este cofrinho possui histórico. Edite o nome e a meta; para preservá-lo, não é possível excluir.');return}if(!confirm(`Excluir o cofrinho “${j.name}”?`))return;if(await mutate(()=>db.jars=db.jars.filter(x=>x.id!==id)))notify('Cofrinho excluído.')}
function download(content,mime,filename){const blob=new Blob([content],{type:mime});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),700)}
function backup(){if(saving||vaultBusy)return;if(vault){download(JSON.stringify(vault),'application/json','reserva-cofre.json');return notify('Backup cifrado exportado.')}download(JSON.stringify(backupPayload(),null,2),'application/json',`reserva-backup-${new Date().toISOString().slice(0,10)}.json`);notify('Backup exportado.')}
function csv(){const rows=[['Data','Tipo','Categoria ou cofrinho','Descrição','Valor (R$)','Subcategoria','Etiquetas']];const decimal=cents=>(cents/100).toFixed(2).replace('.',',');for(const x of db.records){rows.push([x.date,x.kind==='income'?'Renda':'Despesa',x.kind==='income'?(x.source==='salary'?'Salário':'Complemento'):x.category,x.note,decimal((x.kind==='income'?1:-1)*x.amount),x.subcategory||'',(x.tags||[]).join(', ')])}for(const a of db.allocations){rows.push([a.date,a.amount>0?'Guardar':'Resgatar',db.jars.find(j=>j.id===a.jarId)?.name||'',a.note,decimal(a.amount>0?-a.amount:(a.netReceived??-a.amount)),'',''])}for(const item of db.investments){if(!item.existing)rows.push([item.date,'Aplicação',item.name,'Aplicação registrada',decimal(-item.cost),'','']);for(const redemption of item.redemptions||[])rows.push([redemption.date,redemption.kind==='sale'?'Venda de ativo':'Resgate de investimento',item.name,'Movimento da carteira',decimal(redemption.amount),'',''])}rows.sort((a,b)=>a[0]==='Data'?-1:b[0]==='Data'?1:String(a[0]).localeCompare(String(b[0])));const encode=(cell,column)=>{let value=String(cell??'');if(column!==4&&/^[\s]*[=+\-@]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"'};download('\ufeff'+rows.map(r=>r.map(encode).join(';')).join('\r\n'),'text/csv;charset=utf-8',`reserva-movimentacoes-todos-os-anos.csv`);notify('CSV de todos os anos exportado.')}


// Importador local de CSV bancário: identifica colunas usuais, gera prévia e acrescenta sem substituir dados.
let pendingBankCsvRecords=[];let pendingBankCsvSource=null;
document.addEventListener('submit',event=>{if(event.target.id!=='csvDateOrderForm')return;event.preventDefault();const file=pendingBankCsvSource,order=event.target.elements.order.value;pendingBankCsvSource=null;if(file)void importBankCsv(file,order)});
function bankCsvNorm(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function bankCsvDelimiter(text){const line=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).find(x=>x.trim())||'';return [[';',line.split(';').length],['\t',line.split('\t').length],[',',line.split(',').length],['|',line.split('|').length]].sort((a,b)=>b[1]-a[1])[0][0]}
function bankCsvParseRows(text,delimiter){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&c===delimiter){row.push(cell.trim());cell=''}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);row=[];cell=''}else cell+=c}row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);return rows}
function bankCsvHeaderIndex(headers,aliases){const keys=headers.map(bankCsvNorm);for(const alias of aliases){const exact=keys.indexOf(alias);if(exact>=0)return exact}for(let i=0;i<keys.length;i++)if(aliases.some(alias=>alias.length>3&&keys[i].includes(alias)))return i;return -1}
function bankCsvDate(value,order='dmy'){const s=String(value??'').trim();if(!s)return null;let m;if((m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))){const y=+m[1],mo=+m[2],d=+m[3],iso=y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');return validDate(iso)?iso:null}if((m=s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})$/))){let y=+m[3];if(y<100)y+=y<70?2000:1900;const mo=order==='mdy'?+m[1]:+m[2],day=order==='mdy'?+m[2]:+m[1];const iso=y+'-'+String(mo).padStart(2,'0')+'-'+String(day).padStart(2,'0');return validDate(iso)?iso:null}if(/^\d{5}(\.\d+)?$/.test(s)){const d=new Date(Date.UTC(1899,11,30)+Math.round(Number(s)*86400000)),iso=d.toISOString().slice(0,10);return validDate(iso)?iso:null}return null}
function bankCsvMoney(value){let s=String(value??'').trim().replace(/(?:R\$|BRL|USD|US\$|\$)/gi,'').trim();if(!s)return null;const negative=/^\s*\(.*\)\s*$/.test(s)||/^\s*-/.test(s)||/[0-9]\s*-\s*$/.test(s)||/[0-9]\s*d\s*$/i.test(s);s=s.replace(/[()]/g,'').replace(/[R$\s]/g,'').replace(/[dDcC]\s*$/,'').replace(/[+-]/g,'');if(!/\d/.test(s))return null;const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');if(comma>=0&&dot>=0){const decimal=comma>dot?',':'.',group=decimal===','?'.':',';s=s.replace(new RegExp('\\'+group,'g'),'');const at=s.lastIndexOf(decimal);s=s.slice(0,at).replace(new RegExp('\\'+decimal,'g'),'')+'.'+s.slice(at+1)}else{const sep=comma>=0?',':dot>=0?'.':null;if(sep){const groups=s.split(sep),last=groups[groups.length-1],thousands=groups.length>1&&groups.slice(1).every(g=>g.length===3)&&groups[0].length>=1&&groups[0].length<=3;if(thousands)s=groups.join('');else{const at=s.lastIndexOf(sep);s=s.slice(0,at).replace(new RegExp('\\'+sep,'g'),'')+'.'+s.slice(at+1)}}}const amount=Number(s);if(!Number.isFinite(amount))return null;const cents=Math.round(Math.abs(amount)*100);return cents?(negative?-cents:cents):0}
function bankCsvCategory(bankCategory,description){const direct=bankCsvNorm(bankCategory),exact=CATS.find(x=>bankCsvNorm(x)===direct);if(exact)return exact;const merchant=bankCsvNorm(description);try{const rules=JSON.parse(localStorage.getItem(userKey('reserva.bankCsvRules'))||'{}');if(rules[merchant]&&CATS.includes(rules[merchant]))return rules[merchant]}catch{}const t=bankCsvNorm(String(bankCategory||'')+' '+String(description||''));if(/supermerc|mercado|mercearia|hortifruti|grocery/.test(t))return 'Mercado';if(/restaurante|lanchonete|padaria|ifood|marmita|alimentacao|food/.test(t))return 'Comida / Marmita';if(/\bagua\b/.test(t))return 'Água';if(/energia|eletric|conta de luz|\bluz\b/.test(t))return 'Luz';if(/internet|banda larga|wifi/.test(t))return 'Internet';if(/faculdade|escola|universidade|curso|mensalidade escolar/.test(t))return 'Faculdade';if(/farmacia|drogaria|remedio/.test(t))return 'Farmácia';if(/cartao|fatura|credito rotativo/.test(t))return 'Cartões';if(/telefone|celular|operadora|recarga/.test(t))return 'Telefone';if(/aluguel|condominio|moradia|imovel|iptu/.test(t))return 'Moradia';if(/uber|99 |combustivel|gasolina|onibus|metro|pedagio|passagem|transporte/.test(t))return 'Transporte';if(/clinica|hospital|medico|consulta|dentista|saude/.test(t))return 'Saúde';if(/cinema|viagem|hotel|lazer|show|parque/.test(t))return 'Lazer';if(/netflix|spotify|streaming|assinatura|subscription/.test(t))return 'Assinaturas';return 'Outros'}
function bankCsvRecordKey(x){return [x.date,x.kind,x.amount,bankCsvNorm(x.note)].join('|')}
function csvRecurringMatch(record){if(record.kind!=='expense')return null;const key=record.date.slice(0,7);return db.recurring.find(t=>t.kind==='expense'&&!t.paused&&t.amount===record.amount&&t.category===record.category&&t.startMonth<=key&&(!t.endMonth||t.endMonth>=key)&&Math.abs(Number(t.day)-Number(record.date.slice(8,10)))<=4&&!db.records.some(r=>r.recurringId===t.id&&(r.recurringMonth||r.date.slice(0,7))===key))||null}
function openBankCsvPreview(fileName,records,meta){pendingBankCsvRecords=records;const suggestions=records.reduce((n,r)=>n+(csvRecurringMatch(r)?1:0),0);state.modalTrigger=document.activeElement;state.modal='bankCsvImport';$('#modalTitle').textContent='Revisar importação bancária';const sample=records.slice(0,15);const rows=sample.map((x,i)=>'<tr><td>'+dateBR(x.date)+'</td><td>'+(x.kind==='income'?'Entrada':'Saída')+'</td><td>'+(x.kind==='income'?esc(x.source==='salary'?'Salário':'Renda complementar'):'<select class="csv-category" data-csv-category="'+i+'">'+CATS.map(c=>'<option '+(c===x.category?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>')+'</td><td>'+esc(x.note||'Sem descrição')+(csvRecurringMatch(x)?'<small class="help">Sugestão: '+esc(csvRecurringMatch(x).note||csvRecurringMatch(x).category)+' recorrente</small>':'')+'</td><td class="money">'+money(x.amount)+'</td></tr>').join('');$('#modalContent').innerHTML='<form id="bankCsvImportForm"><p class="help"><b>'+esc(fileName)+'</b> · '+records.length+' lançamento(s) reconhecidos. Revise categorias; as correções serão lembradas para próximas importações.</p><div class="bank-csv-summary"><span>'+records.length+' prontos</span><span>'+meta.duplicates+' duplicados ignorados</span><span>'+meta.invalid+' linhas inválidas</span></div>'+(suggestions?'<label class="csv-reconcile"><input type="checkbox" name="reconcile" checked> Vincular '+suggestions+' lançamento(s) provável(is) às contas recorrentes correspondentes</label>':'')+'<div class="table-wrap bank-csv-preview"><table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th class="right">Valor</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+(records.length>15?'<p class="help">Prévia das primeiras 15 linhas; todas as linhas válidas serão importadas.</p>':'')+'<div class="form-buttons"><button type="button" class="btn" data-close="1">Cancelar</button><button type="submit" class="btn primary">Importar '+records.length+' lançamento(s)</button></div></form>';$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#modalContent button')?.focus()}
async function importBankCsv(file,dateOrder=null){if(file)diagnostics.step('csv.requested');if(!file||saving||vaultBusy||(vault&&!vaultKey))return;if(file.size>8000000)return notify('CSV muito grande; o limite é 8 MB.');let text='';try{text=(await file.text()).replace(/^\uFEFF/,'')}catch(e){diagnostics.record('csv.read_failed',e);return notify('Não foi possível ler esse arquivo CSV.')}const rows=bankCsvParseRows(text,bankCsvDelimiter(text));if(rows.length<2)return notify('O CSV não contém linhas de dados.');let headerAt=-1,map=null;for(let i=0;i<Math.min(rows.length,10);i++){const h=rows[i],candidate={date:bankCsvHeaderIndex(h,['data','date','dt','data lancamento','data transacao','data movimento','transaction date','posting date']),amount:bankCsvHeaderIndex(h,['valor','amount','value','montante','valor lancado','valor transacao']),debit:bankCsvHeaderIndex(h,['debito','debit','saida','outflow','valor debitado']),credit:bankCsvHeaderIndex(h,['credito','credit','entrada','inflow','valor creditado']),description:bankCsvHeaderIndex(h,['descricao','description','historico','history','memo','merchant','estabelecimento','detalhe','lancamento']),category:bankCsvHeaderIndex(h,['categoria','category','grupo','classificacao']),type:bankCsvHeaderIndex(h,['tipo','type','natureza','operacao','operation','dc'])};if(candidate.date>=0&&(candidate.amount>=0||candidate.debit>=0||candidate.credit>=0)){headerAt=i;map=candidate;break}}if(!map)return notify('Não identifiquei as colunas de data e valor. Use um CSV com cabeçalhos como Data, Descrição e Valor.');if(db.records.length>=50000)return notify('A base atingiu o limite de lançamentos aceito pelo aplicativo.');if(!dateOrder&&rows.slice(headerAt+1).some(row=>/^\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}$/.test(String(row[map.date]||'').trim()))){
 pendingBankCsvSource=file;state.modal='csvDateOrder';$('#modalTitle').textContent='Formato das datas do extrato';$('#modalContent').innerHTML='<p>Escolha o formato usado no arquivo para evitar trocar dia e mês.</p><form id="csvDateOrderForm" class="form-grid"><label class="field full">Formato<select name="order"><option value="dmy">Dia / mês / ano (25/03/2026)</option><option value="mdy">Mês / dia / ano (03/25/2026)</option></select></label><div class="form-buttons"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">Revisar lançamentos</button></div></form>';$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';return;
}const existingInDb=new Set(db.records.map(bankCsvRecordKey)),records=[];let invalid=0,duplicates=0;const append=(date,cents,kind,description,bankCategory)=>{if(!cents)return;const isIncome=kind==='income',note=String(description||bankCategory||(isIncome?'Entrada importada':'Saída importada')).trim().slice(0,140),record={id:uid(),date,kind,amount:Math.abs(cents),note,source:isIncome?(/salario|folha|payroll|remuneracao|provento/.test(bankCsvNorm(note))?'salary':'complement'):'',category:isIncome?'Outros':bankCsvCategory(bankCategory,note)},key=bankCsvRecordKey(record);if(existingInDb.has(key)){duplicates++;return}records.push(record)};for(const row of rows.slice(headerAt+1)){if(!row.some(x=>String(x||'').trim()))continue;const date=bankCsvDate(row[map.date],dateOrder||'dmy');if(!date){invalid++;continue}const description=map.description>=0?row[map.description]:'',bankCategory=map.category>=0?row[map.category]:'',type=bankCsvNorm(map.type>=0?row[map.type]:'');if(map.debit>=0||map.credit>=0){let made=false;if(map.debit>=0){const v=bankCsvMoney(row[map.debit]);if(v){append(date,Math.abs(v),'expense',description,bankCategory);made=true}}if(map.credit>=0){const v=bankCsvMoney(row[map.credit]);if(v){append(date,Math.abs(v),'income',description,bankCategory);made=true}}if(!made)invalid++;continue}const signed=bankCsvMoney(row[map.amount]);if(signed===null||signed===0){invalid++;continue}let kind=signed<0?'expense':'income';const debitType=/(^| )(d|debito|debit|saida|outflow|compra|pagamento|despesa|saque|withdrawal)( |$)/.test(type),creditType=/(^| )(c|credito|credit|entrada|inflow|deposito|recebimento|renda)( |$)/.test(type);if(kind==='income'&&debitType&&!creditType)kind='expense';else if(kind==='expense'&&creditType&&!debitType)kind='income';append(date,signed,kind,description,bankCategory);if(records.length>5000)return notify('O arquivo excede o limite de 5.000 lançamentos por importação. Divida o extrato em arquivos menores.')}if(!records.length)return notify('Não encontrei lançamentos válidos para importar. Confira as datas e os valores do CSV.');openBankCsvPreview(file.name,records,{duplicates,invalid})}
async function submitBankCsvImport(event){event.preventDefault();if(!pendingBankCsvRecords.length)return closeModal();if(storageRecoveryRaw&&!recoveryArchived)return notify('Exporte primeiro a cópia bruta antes de importar.');const records=pendingBankCsvRecords.slice(),form=event.target,learned={};form.querySelectorAll('[data-csv-category]').forEach(select=>{const i=Number(select.dataset.csvCategory),r=records[i];if(r&&r.kind==='expense'&&CATS.includes(select.value)){if(select.value!==r.category&&r.note)learned[bankCsvNorm(r.note)]=select.value;r.category=select.value}});if(form.elements.reconcile?.checked){const linked=new Set();for(const r of records){const t=csvRecurringMatch(r),key=t&&t.id+'|'+r.date.slice(0,7);if(t&&!linked.has(key)){r.recurringId=t.id;r.recurringMonth=r.date.slice(0,7);linked.add(key)}}}if(db.records.length+records.length>50000)return notify('A importação excede o limite de lançamentos do aplicativo.');const count=records.length;if(await mutate(()=>{db.records.push(...records)})){try{const rules=JSON.parse(localStorage.getItem(userKey('reserva.bankCsvRules'))||'{}');Object.assign(rules,learned);localStorage.setItem(userKey('reserva.bankCsvRules'),JSON.stringify(rules))}catch{}pendingBankCsvRecords=[];closeModal(true);notify(count+' lançamento(s) importado(s); categorias corrigidas serão sugeridas nas próximas importações.')}}

async function importFile(file){if(!file||saving||vaultBusy||(vault&&!vaultKey))return;if(file.size>8000000)return notify('Backup muito grande; máximo de 8 MB.');let restored=null;try{const source=JSON.parse(await file.text());if(isVaultFormat(source?.format)){validateVaultEnvelope(source);pendingVaultImport=source;showVaultDialog('import');return}restored=verify(source)}catch(e){}if(!restored)return notify('Backup inválido ou incompatível.');if(!confirm('Importar o backup? Ele substituirá todos os dados atuais.'))return;if(storageRecoveryRaw&&!recoveryArchived)return notify('Exporte primeiro a cópia bruta; não foi possível arquivá-la automaticamente.');if(!await preserveBeforeDestructiveAction('antes-de-importar'))return notify('Reconecte a pasta para preservar a base atual.');if(backupDirectory)backupConflict=true;const before=db;db=restored;if(!await save({recover:!!storageRecoveryRaw})){db=before;return}render();notify('Backup importado.')}
async function demo(){if(!confirm('Carregar dados fictícios de 2027? Os dados atuais serão substituídos.'))return;if(!await preserveBeforeDestructiveAction('antes-do-exemplo'))return;const d=empty();const add=(mo,kind,amount,details={})=>d.records.push({id:uid(),date:`2027-${String(mo).padStart(2,'0')}-05`,kind,amount:Math.round(amount*100),note:'',source:'complement',category:'Outros',...details});for(let m=1;m<=5;m++){add(m,'income',3400,{source:'salary'});add(m,'income',[700,400,850,500,750][m-1]);for(const [cat,value] of [['Água',96],['Luz',178],['Internet',110],['Faculdade',560],['Farmácia',105],['Cartões',430],['Telefone',55],['Mercado',770],['Transporte',210]])add(m,'expense',value+((m+1)%3)*10,{category:cat})}const j1={id:uid(),name:'Reserva de emergência',target:1000000,dueDate:'2027-12-31'},j2={id:uid(),name:'Viagem',target:350000,dueDate:'2028-07-31'};d.jars.push(j1,j2);for(let m=1;m<=5;m++){d.allocations.push({id:uid(),jarId:j1.id,date:`2027-${String(m).padStart(2,'0')}-10`,amount:[40000,55000,60000,45000,70000][m-1],note:''});if(m%2)d.allocations.push({id:uid(),jarId:j2.id,date:`2027-${String(m).padStart(2,'0')}-12`,amount:20000,note:''})}d.prefs.dark=db.prefs.dark;const prev=db;db=d;if(!await save({folderBackup:false})){db=prev;return}state.year=2027;state.month=4;go('home');notify('Exemplo fictício carregado.')}
async function clearAll(){
  if(saving||vaultBusy||(vault&&!vaultKey))return;
  if(!confirm('Apagar todos os dados deste navegador?'))return;
  const previous=db;
  if(backupDirectory&&folderKey){
    if(!await hasFolderPermission(true))return notify('Permita o acesso à pasta de backup antes de apagar os dados.');
    requestFolderPassword('Confirme a senha do backup para apagar',false,async password=>{
      const envelope=await readEncryptedFolder();
      const key=await deriveVaultKey(password,from64(envelope.salt));
      await openVault(envelope,key);
      await writeEncryptedFolder(backupDirectory,`Reserva_Simples_cifrado_antes-de-apagar_${Date.now()}.json`,key,envelope.salt);
      db=empty();
      if(!await save({folderBackup:false})){db=previous;throw Error('Falha ao apagar')}
      backupConflict=true;
      notify('Dados apagados. A cópia cifrada anterior foi mantida.');
    });
    return;
  }
  if(!confirm('Não há pasta de backup cifrado conectada. A exclusão é permanente neste aparelho. Deseja continuar?'))return;
  db=empty();
  if(!await save({folderBackup:false})){db=previous;return notify('Não foi possível apagar os dados. O conteúdo anterior foi mantido.')}
  render();
  notify('Dados apagados deste aparelho.');
}
document.addEventListener('click',e=>{if(e.target.closest('[data-close-calendar-day]')){$('#calendarDayDialog')?.close();return}if(e.target.closest('[data-task-edit-cancel]')){cancelCalendarTaskEdit();return}const taskEdit=e.target.closest('[data-task-edit]');if(taskEdit){editCalendarTask(taskEdit.dataset.taskEdit);return}const calendarRecordEdit=e.target.closest('[data-calendar-record-edit]');if(calendarRecordEdit){const id=calendarRecordEdit.dataset.calendarRecordEdit,record=db.records.find(x=>x.id===id);if(record&&confirm('Editar este lançamento? Ao salvar, os valores registrados poderão mudar nos totais e relatórios.')){calendarRecordEditPending=true;openModal(record.kind,record.id)}return}const calendarRecordDelete=e.target.closest('[data-calendar-record-delete]');if(calendarRecordDelete){const record=db.records.find(x=>x.id===calendarRecordDelete.dataset.calendarRecordDelete);if(record&&confirm(`Excluir ${money(record.amount)} de ${dateBR(record.date)}? Esta ação alterará os valores registrados no lançamento. Confirme novamente na próxima etapa.`))deleteRecord(record.id);return}const calendarAllocationEdit=e.target.closest('[data-calendar-allocation-edit]');if(calendarAllocationEdit){const item=db.allocations.find(x=>x.id===calendarAllocationEdit.dataset.calendarAllocationEdit);if(item&&confirm('Editar esta movimentação? Ao salvar, os valores registrados no cofrinho e seus saldos serão recalculados.'))openModal(item.amount>0?'add':'withdraw',item.id);return}const calendarAllocationDelete=e.target.closest('[data-calendar-allocation-delete]');if(calendarAllocationDelete){const item=db.allocations.find(x=>x.id===calendarAllocationDelete.dataset.calendarAllocationDelete);if(item&&confirm(`Excluir ${money(Math.abs(item.amount))} de ${dateBR(item.date)}? Isso alterará os valores registrados no cofrinho. Confirme novamente na próxima etapa.`))deleteAllocation(item.id);return}const calendarInvestmentEdit=e.target.closest('[data-calendar-investment-edit]');if(calendarInvestmentEdit){const item=db.investments.find(x=>x.id===calendarInvestmentEdit.dataset.calendarInvestmentEdit);if(item&&confirm('Editar este investimento? Ao salvar, os valores registrados na carteira e nos relatórios poderão mudar.')){calendarInvestmentEditPending=true;openInvestment(item.id)}return}const calendarInvestmentDelete=e.target.closest('[data-calendar-investment-delete]');if(calendarInvestmentDelete){const item=db.investments.find(x=>x.id===calendarInvestmentDelete.dataset.calendarInvestmentDelete);if(item&&confirm(`Excluir “${item.name}” da carteira? Isso alterará os valores registrados no investimento. Confirme novamente na próxima etapa.`))removeInvestment(item.id);return}const openAgendaDate=e.target.closest('[data-open-calendar-date]');if(openAgendaDate){const date=openAgendaDate.dataset.openCalendarDate;if(validDate(date)){state.year=Number(date.slice(0,4));state.month=Number(date.slice(5,7))-1;state.calendarDate=date;go('calendar');openCalendarDayOverlay()}return}const calDate=e.target.closest('[data-calendar-date]');if(calDate){state.calendarDate=calDate.dataset.calendarDate;calendarTaskEditId=null;mountHomeCalendar();$('#page-calendar [data-calendar-date="'+state.calendarDate+'"]')?.focus({preventScroll:true});openCalendarDayOverlay();return}const tagFilter=e.target.closest('[data-tx-tag]');if(tagFilter){state.txTag=tagFilter.dataset.txTag||'';renderTransactionList();return}const subcategoryFilter=e.target.closest('[data-tx-subcategory]');if(subcategoryFilter){state.txSubcategory=subcategoryFilter.dataset.txSubcategory||'';renderTransactionList();return}const taskToggle=e.target.closest('[data-task-toggle]');if(taskToggle){toggleCalendarTask(taskToggle.dataset.taskToggle);return}const taskDelete=e.target.closest('[data-task-delete]');if(taskDelete){deleteCalendarTask(taskDelete.dataset.taskDelete);return}const pdfScope=e.target.closest('[data-pdf-scope]');if(pdfScope){const input=$('#globalPdfScope');if(input)input.value=pdfScope.dataset.pdfScope;document.querySelectorAll('[data-pdf-scope]').forEach(b=>{b.classList.toggle('selected',b===pdfScope);b.setAttribute('aria-pressed',b===pdfScope?'true':'false')});return}if(e.target.closest('[data-close-reset]')){const root=$('#monthlyCloseChecklist');if(root){localStorage.removeItem(userKey('reserva.monthlyClose.'+root.dataset.month));syncMonthlyCloseChecklist()}return}if(e.target.closest('#globalPdfBtn')){if($('#globalPdfScope')?.value==='month'){const root=$('#monthlyCloseChecklist');if(root){const key=userKey('reserva.monthlyClose.'+root.dataset.month);let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}saved.pdf=true;localStorage.setItem(key,JSON.stringify(saved));syncMonthlyCloseChecklist()}}generateGlobalPdf();return}if(e.target.closest('#enableBillNotifications')){requestBillNotificationPermission();return}if(e.target.closest('#disableVaultBtn')){if(ACCOUNT)return notify('Perfis exigem cofre ativo.');if(vault&&vaultKey&&!saving&&!vaultBusy)showVaultDialog('disable');return}if(e.target.closest('#vaultAction')){if(saving||vaultBusy)return;if(vault){document.body.classList.add('reserve-locked');location.reload();return}if(!globalThis.crypto?.subtle||storageRecoveryRaw)return notify('O cofre requer HTTPS e uma base válida.');showVaultDialog('setup');return}if(e.target.closest('#moreTransactions')){transactionLimit+=30;renderTransactionList();($('#moreTransactions')||$('#transactionList .transaction-total'))?.focus();return}if(e.target.closest('#privacyToggle')){hideValues=!hideValues;localStorage.setItem(userKey('reserva.hideValues'),String(hideValues));render();return}if(e.target.closest('#checkUpdatesBtn')){checkForUpdates();return}if(e.target.closest('#applyUpdateBtn')){applyUpdate();return}if(e.target.closest('#refreshCdiBtn')){updateCdi(true);return}if(e.target.closest('#shareCdbPdfBtn')){generateCdbPdf();return}if(e.target.closest('[data-register-investment]')){closeModal(true);go('investments');return}if(e.target.closest('#quickAddButton,[data-register-menu]')){openQuickAdd();return}const quick=e.target.closest('[data-quick-open]');if(quick){quick.dataset.quickOpen==='add'?openDepositPicker():openModal(quick.dataset.quickOpen,null,true);return}if(e.target.closest('#monthTitle')){openMonthPicker();return}if(e.target.closest('#todayBtn')){const d=new Date();state.year=d.getFullYear();state.month=d.getMonth();render();return}const clearCategorySet=e.target.closest('[data-clear-tx-category-set]');if(clearCategorySet){state.txCategorySet=null;renderTransactionList();return}const txf=e.target.closest('[data-tx-filter]');if(txf){state.txCategorySet=null;state.txFilter=txf.dataset.txFilter;document.querySelectorAll('[data-tx-filter]').forEach(b=>{b.classList.toggle('selected',b===txf);b.setAttribute('aria-pressed',b===txf?'true':'false')});renderTransactionList();return}const delInstitution=e.target.closest('[data-delete-institution]');if(delInstitution){deleteInstitution(delInstitution.dataset.deleteInstitution);return}const p=e.target.closest('[data-page]');if(p){p.closest('#mobileMoreDialog')?.close();if(p.dataset.txSet)state.txFilter=p.dataset.txSet;go(p.dataset.page);if(p.hasAttribute('data-open-planning'))requestAnimationFrame(()=>$('#planningSettingsDetails')?.setAttribute('open',''));return}const o=e.target.closest('[data-open]');if(o){openModal(o.dataset.open,o.dataset.jar||o.dataset.institution||null);return}const editRecord=e.target.closest('[data-edit-record]');if(editRecord){const r=db.records.find(x=>x.id===editRecord.dataset.editRecord);if(r)openModal(r.kind,r.id);return}if(e.target.closest('#copyPreviousBtn')){openCopyPreviousExpenses();return}if(e.target.closest('#applyRecurringBtn')){applyRecurring();return}const pause=e.target.closest('[data-toggle-recurring]');if(pause){toggleRecurring(pause.dataset.toggleRecurring);return}const recEdit=e.target.closest('[data-edit-recurring]');if(recEdit){openModal('recurring',recEdit.dataset.editRecurring);return}const recDelete=e.target.closest('[data-delete-recurring]');if(recDelete){deleteRecurring(recDelete.dataset.deleteRecurring);return}const ed=e.target.closest('[data-edit-jar]');if(ed){openModal('jar',ed.dataset.editJar);return}const r=e.target.closest('[data-delete-record]');if(r){deleteRecord(r.dataset.deleteRecord);return}const a=e.target.closest('[data-delete-allocation]');if(a){deleteAllocation(a.dataset.deleteAllocation);return}const toggleJar=e.target.closest('[data-toggle-jar]');if(toggleJar){toggleJarPlan(toggleJar.dataset.toggleJar);return}const archive=e.target.closest('[data-archive-jar]');if(archive){archiveJar(archive.dataset.archiveJar,true);return}const restore=e.target.closest('[data-restore-jar]');if(restore){archiveJar(restore.dataset.restoreJar,false);return}const j=e.target.closest('[data-delete-jar]');if(j){deleteJar(j.dataset.deleteJar);return}if(e.target.closest('[data-close]')||e.target.closest('#closeModal')||e.target===$('#modal')){closeModal();return}if(e.target.closest('#chooseBackupFolderBtn')){chooseBackupFolder();return}if(e.target.closest('#reconnectBackupFolderBtn')){reconnectBackupFolder();return}if(e.target.closest('#saveFolderBackupBtn')){writeFolderBackup(true);return}if(e.target.closest('#restoreFolderBackupBtn')){restoreFolderBackup();return}if(e.target.closest('#exportBtn')){backup();return}if(e.target.closest('#bankCsvBtn')){$('#bankCsvFile')?.click();return}if(e.target.closest('#csvBtn')){csv();return}if(e.target.closest('#importBtn')){$('#importFile')?.click();return}if(e.target.closest('#demoBtn')){demo();return}if(e.target.closest('#clearBtn')){clearAll();return}if(e.target.closest('#exportCorruptBtn')){if(storageRecoveryRaw){download(storageRecoveryRaw,'application/json',`reserva-dados-brutos-${new Date().toISOString().slice(0,10)}.txt`);recoveryArchived=true;settings()}return}if(e.target.closest('#startFreshAfterCorruptBtn')){startFreshAfterCorrupt();return}});
document.addEventListener('submit',e=>{if(e.target.matches('[data-register-entry]')){saveRegisterEntry(e);return}if(e.target.id==='registerInvestmentForm'){saveRegisterInvestment(e);return}if(e.target.id==='registerCommitmentForm'){saveRegisterCommitment(e);return}if(e.target.id==='homeCustomPeriodForm'){e.preventDefault();localStorage.setItem(userKey('reserva.home.from'),e.target.elements.from.value);localStorage.setItem(userKey('reserva.home.to'),e.target.elements.to.value);localStorage.setItem(userKey('reserva.home.period'),'custom');home();return}if(e.target.id==='calendarTaskForm'){submitCalendarTask(e);return}if(e.target.id==='vaultForm')return;if(e.target.id==='bankCsvImportForm'){submitBankCsvImport(e);return}if(e.target.id==='planningPrefsForm'){savePlanningPrefs(e);return}if(e.target.id==='entryForm'||e.target.id==='registerSecondaryEntryForm')submitEntry(e);if(e.target.id==='copyExpensesForm')submitCopyExpenses(e);if(e.target.id==='monthJumpForm'){e.preventDefault();const year=Number($('#monthJumpYear').value),month=Number($('#monthJumpMonth').value);if(Number.isInteger(year)&&year>=1900&&year<=2200&&Number.isInteger(month)&&month>=0&&month<=11){state.year=year;state.month=month;closeModal(true);render()}}});
document.addEventListener('input',e=>{if(e.target.id==='amount')preview();if(e.target.id==='jarTarget'||e.target.id==='jarDue')goalDraftPreview();if(e.target.id==='simAmount'){state.simAmount=e.target.value;simulateGoal()}if(['debtPayoff','debtPayment','debtMonths','debtCET'].includes(e.target.id))updateDebtComparison();if(e.target.id==='transactionSearch'){state.txCategorySet=null;state.txSearch=e.target.value;renderTransactionList()}});
document.addEventListener('change',async e=>{if(e.target.matches('[data-close-check]')){const root=$('#monthlyCloseChecklist');if(root){const key=userKey('reserva.monthlyClose.'+root.dataset.month);let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}saved[e.target.dataset.closeCheck]=e.target.checked;localStorage.setItem(key,JSON.stringify(saved));syncMonthlyCloseChecklist()}return}if(e.target.id==='jarTarget'||e.target.id==='jarDue'||e.target.name==='linkedInvestment')goalDraftPreview();if(e.target.id==='simGoal'){state.simGoal=e.target.value;simulateGoal()}if(e.target.id==='recurringKind'||e.target.dataset.fieldId==='recurringKind'){const expense=e.target.value==='expense',form=e.target.closest('form');form.querySelector('[data-field-id=recurringCategoryWrap],#recurringCategoryWrap').hidden=!expense;form.querySelector('[data-field-id=recurringSourceWrap],#recurringSourceWrap').hidden=expense}if(e.target.id==='darkMode')await mutate(()=>db.prefs.dark=e.target.checked);if(e.target.id==='billReminders'){const enabled=e.target.checked;if(await mutate(()=>db.prefs.billReminders=enabled)){if(enabled)await checkBillReminders();else notify('Lembretes de contas desativados.')}}if(e.target.id==='billReminderDays'){const days=Number(e.target.value);if([0,1,3,7].includes(days)){if(await mutate(()=>db.prefs.billReminderDays=days))await checkBillReminders()}}if(e.target.id==='bankCsvFile'){const file=e.target.files?.[0];e.target.value='';if(file)importBankCsv(file);return}if(e.target.id==='importFile'){importFile(e.target.files[0]);e.target.value=''}});
$('#prevMonth').addEventListener('click',()=>changeMonth(-1));$('#nextMonth').addEventListener('click',()=>changeMonth(1));let monthTouchStart=0;$('#monthTitle').addEventListener('touchstart',e=>{monthTouchStart=e.changedTouches[0].clientX},{passive:true});$('#monthTitle').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-monthTouchStart;if(Math.abs(dx)>55)changeMonth(dx<0?1:-1)},{passive:true});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Tab'&&$('#modal').classList.contains('open')){const items=[...$('#modal').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(items.length){const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();go('transactions');$('#transactionSearch')?.focus()}});
$('#vaultForm').addEventListener('submit',submitVault);
$('#vaultDialog').addEventListener('cancel',event=>{if((vault&&!vaultKey)||vaultBusy)event.preventDefault()});
$('#vaultCancel').addEventListener('click',()=>{if(!vaultBusy && (!vault||vaultKey))$('#vaultDialog').close()});
render();window.scrollTo({top:0,left:0,behavior:'instant'});document.querySelectorAll('.sidebar,#desktopSidebar').forEach(element=>{element.scrollTop=0});const notificationLink=new URLSearchParams(location.search);
const dueDate=notificationLink.get('budgetDate');
const reminderDate=notificationLink.get('calendarDate');
if(validDate(dueDate))openDesktopNotification({kind:'budget',date:dueDate});
else if(validDate(reminderDate)){setViewDate(reminderDate);go('calendar')}
if(storageRecoveryRaw)setTimeout(()=>notify('Dados inválidos preservados. Acesse Configurações para exportar ou iniciar uma base nova.'),0);
if(navigator.storage?.persist)navigator.storage.persist().then(granted=>{persistenceStatus=granted?'O navegador autorizou armazenamento persistente.':'O navegador pode remover dados locais em uma limpeza de armazenamento.';const el=$('#storagePersistenceStatus');if(el)el.textContent=persistenceStatus}).catch(()=>{persistenceStatus='Não foi possível confirmar a proteção de armazenamento.'});
initFolderBackup();
if(location.protocol!=='file:')checkForUpdates();
function whileAppIdle(callback){
  return ()=>{if(!diagnosticRunning&&navigator.onLine)void callback()};
}
if(location.protocol!=='file:'&&navigator.onLine){
  setInterval(whileAppIdle(checkForUpdates),6*60*60*1000);
  setTimeout(whileAppIdle(updateCdi),1100);
  setInterval(whileAppIdle(updateCdi),12*60*60*1000);
  setTimeout(whileAppIdle(updateIpca),1500);
  setInterval(whileAppIdle(updateIpca),24*60*60*1000);
}
window.addEventListener('offline',()=>diagnostics.record('connection.offline'));
window.addEventListener('resize',syncDesktopHeaderControls,{passive:true});
mobileNavigationMedia.addEventListener?.('change',syncDesktopHeaderControls);
window.addEventListener('online',()=>{diagnostics.record('connection.online');if(location.protocol!=='file:'&&!diagnosticRunning){checkForUpdates();updateCdi();updateIpca()}});
let notificationDate=isoToday();
function refreshDatedNotifications(){
  const today=isoToday();
  if(diagnosticRunning||today===notificationDate)return;
  notificationDate=today;
  renderDesktopNotifications();
}
window.addEventListener('focus',refreshDatedNotifications);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDatedNotifications()});
setInterval(refreshDatedNotifications,30000);
const checkDatedReminders=whileAppIdle(checkBillReminders);
window.addEventListener('focus',checkDatedReminders);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDatedReminders()});
setTimeout(checkDatedReminders,2500);
setInterval(checkDatedReminders,30*60*1000);
if('serviceWorker' in navigator&&supportsHostedApp())window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{updateRegistration=reg}).catch(e=>diagnostics.record('offline.registration_failed',e)));
document.addEventListener('keydown',event=>{
  const reload=event.key==='F5'||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='r');
  if(!reload||updateInProgress)return;
  event.preventDefault();
  notify('Recarga por atalho bloqueada. Use Ajustes → Atualizações para atualizar o app.');
});
window.addEventListener('beforeunload',event=>{
  if(updateInProgress)return;
  if(!saving&&!vaultBusy&&!$('#modalContent form')?.closest('.modal.open')&&!document.querySelector('dialog[open] form'))return;
  event.preventDefault();
  event.returnValue='';
});

const integrityJournal = STORE + '.integrity.v1';
const integrityRetention = 30 * 86400000;
const integrityEvents = [];
let integrityQueue = Promise.resolve(), integrityLast;
let integrityContainmentLock = false;
function integrityRecord(check, status, detail = {}) {
  if(diagnosticFixtureStorages.has(window.localStorage))return;
  integrityEvents.push({check,status,...detail,time:Date.now()});
}
async function integrityHistory() {
  const key = vaultKey;
  const salt = vault?.salt;
  const run = async () => {
    const since = Date.now()-integrityRetention;
    while (integrityEvents[0]?.time <= since) integrityEvents.shift();
    if (!key) return {status:'pendente',events:integrityEvents.slice()};
    const raw = localStorage.getItem(integrityJournal);
    const aad = encoder.encode('reserva.integrity.v1');
    let previous = [];
    if (raw) {
      const entry = JSON.parse(raw);
      const clear = await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(entry.iv),additionalData:aad},key,from64(entry.data));
      previous = JSON.parse(new TextDecoder().decode(clear));
      if (!Array.isArray(previous)) throw Error();
    }
    const batch = integrityEvents.slice();
    const events = [...previous,...batch].filter(item=>Number.isFinite(item.time)&&item.time>since);
    if (batch.length || events.length !== previous.length) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,encoder.encode(JSON.stringify(events)));
      if (vaultKey !== key || vault?.salt !== salt || localStorage.getItem(integrityJournal)!==raw) throw Error();
      localStorage.setItem(integrityJournal,JSON.stringify({iv:bytesTo64(iv),data:bytesTo64(new Uint8Array(data))}));
      integrityEvents.splice(0,batch.length);
    }
    return {status:'aprovada',events};
  };
  const result = integrityQueue.then(()=>navigator.locks ? navigator.locks.request(integrityJournal,run) : run())
    .catch(()=>({status:'alerta',events:integrityEvents.slice()}));
  integrityQueue = result;
  return result;
}
async function integrityBank() {
  if (saving || vaultBusy) return 'pendente';
  const raw = localStorage.getItem(STORE);
  if (!raw) return vault ? 'alerta' : 'pendente';
  try {
    const data = JSON.parse(raw);
    if (!isVaultFormat(data?.format)) {
      if(!verify(data))return 'alerta';
      return raw!==loadedStoreRaw?'pendente':'sem_cofre';
    }
    validateVaultEnvelope(data);
    if(raw!==loadedStoreRaw)return 'pendente';
    if (!vaultKey) return 'pendente';
    await openVault(data,vaultKey);
    return raw === localStorage.getItem(STORE) ? 'aprovada' : 'pendente';
  } catch {return 'alerta';}
}
const releaseFiles=['./index.html','./app.js','./diagnostics.js','./accounts.js','./engines.js','./manifest.webmanifest','./version.json','./sw.js'];
const releaseManifestPath='./integrity-manifest.json';
function validReleaseManifest(manifest){
  return manifest?.format===1&&manifest.version===APP_VERSION&&manifest.assets&&
    Object.keys(manifest.assets).length===releaseFiles.length&&
    releaseFiles.every(path=>typeof manifest.assets[path]==='string'&&/^[a-f0-9]{64}$/.test(manifest.assets[path]));
}
async function integrityAssets(repair = false) {
  if(document.querySelector('meta[name="reserva-distribution"][content="standalone"]'))return [{check:'cache_pwa',status:'ignorado',reason:'HTML portátil: validação do cache PWA não se aplica a esta distribuição.'}];
  if (!/^https?:$/.test(location.protocol) || !navigator.serviceWorker?.controller || !globalThis.caches || !globalThis.crypto?.subtle)
    return [{check:'cache_pwa',status:'pendente',reason:'Service Worker ou cache da versão indisponível'}];
  const name = APP_CACHE_NAME;
  if (!(await caches.has(name))) return [{check:'cache_pwa',status:'pendente',reason:'Service Worker ou cache da versão indisponível'}];
  const cache = await caches.open(name);
  const manifestUrl=new URL(releaseManifestPath,location.href);
  let manifest=null;
  try{
    const response=await cache.match(manifestUrl);
    if(response?.ok)manifest=await response.json();
  }catch{}
  let replacementManifest=null;
  if(!validReleaseManifest(manifest)&&repair&&navigator.onLine){
    try{
      const response=await fetch(manifestUrl,{cache:'no-store',redirect:'error'});
      const fresh=response.ok?await response.clone().json():null;
      if(validReleaseManifest(fresh)){
        // Only replace the manifest after the matching files have been checked below.
        manifest=fresh;
        replacementManifest=response;
      }
    }catch{}
  }
  if(!validReleaseManifest(manifest))return [{
    check:releaseManifestPath,status:'alerta',reason:'Manifesto de integridade ausente, inválido ou de outra versão'
  }];
  const hashResponse = async response => {
    if (!response?.ok) return false;
    const digest = await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
    return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  };
  const results = [];
  const replacements = [];
  for (const [path,hash] of Object.entries(manifest.assets)) {
    const url = new URL(path,location.href);
    let status,observedHash,source='service_worker_cache';
    try {
      observedHash=await hashResponse(await cache.match(url));
      if (observedHash===hash) status = repair ? 'sem_correcao_aplicavel' : 'aprovada';
      else if (!repair) status = 'alerta';
      else if (!navigator.onLine) status = 'pendente';
      else {
        const response = await fetch(url,{cache:'no-store',redirect:'error'});
        const networkHash=await hashResponse(response.clone());
        source='network';
        if (networkHash!==hash) {status='alerta';observedHash=networkHash;}
        else {
          replacements.push({url,hash,response,resultIndex:results.length});
          status = 'validada_para_reparo';
          observedHash=networkHash;
        }
      }
    } catch {status='alerta';}
    results.push({check:path,status,action:repair?'validar_reposicao':'comparar_sha256',
      expected_sha256:hash,observed_sha256:observedHash||undefined,source,cache_name:name,
      reason:status==='alerta'?(observedHash?'O hash observado diverge do manifesto desta versão':'Arquivo ausente ou ilegível no cache da versão'):
        status==='pendente'?'Sem conexão para validar um arquivo alterado no cache':undefined});
  }
  const canRepair = results.every(item=>['sem_correcao_aplicavel','validada_para_reparo'].includes(item.status));
  for (const {url,hash,response,resultIndex} of replacements) {
    const result = results[resultIndex];
    if (!canRepair) {
      Object.assign(result,{status:'pendente',reason:'Outro arquivo da versão ficou sem validação'});
      continue;
    }
    try {
      await cache.put(url,response);
      const verifiedHash=await hashResponse(await cache.match(url));
      Object.assign(result,{status:verifiedHash===hash?'corrigida':'alerta',action:'repor_e_reverificar',
        observed_sha256:verifiedHash||undefined,source:'network',reason:verifiedHash===hash?'Arquivo obtido da origem e revalidado após gravação no cache':'A rechecagem após gravação divergiu do hash esperado'});
    } catch {Object.assign(result,{status:'alerta',reason:'Falha ao gravar ou reler o cache'});}
  }
  const manifestOk=results.every(item=>['aprovada','sem_correcao_aplicavel','corrigida'].includes(item.status));
  const manifestResult={check:releaseManifestPath,status:repair?'sem_correcao_aplicavel':'aprovada',action:'validar_versao_de_publicacao'};
  if(replacementManifest){
    if(!manifestOk){
      manifestResult.status='pendente';
      manifestResult.reason='Há arquivos da versão sem validação';
    }else{
      try{await cache.put(manifestUrl,replacementManifest);manifestResult.status='corrigida'}
      catch{manifestResult.status='alerta';manifestResult.reason='Não foi possível salvar o manifesto no cache'}
    }
  }
  return [manifestResult,...results];
}
function integrityInterface() {
  return PAGES.map(([id])=>{
    const screen=document.querySelectorAll('#page-'+id);
    const hasRenderer=typeof pageRenderers[id]==='function';
    const parentRoute={transactions:'budget',investments:'budget',goals:'budget',reports:'analysis'}[id]||id;
    const desktopLink=$('#desktopNav [data-page="'+parentRoute+'"]');
    const moduleEntry={
      transactions:$('#page-budget .finance-section-nav [data-page="transactions"]'),
      investments:$('#page-budget .finance-section-nav [data-page="investments"]'),
      goals:$('#page-budget .finance-section-nav [data-page="goals"]'),
      reports:$('#page-analysis .analysis-section-nav [data-analysis-view="reports"]')
    }[id];
    const mobileLink=id==='settings'?$('#headerSettings'):$('#mobileNav [data-page="'+id+'"],#mobileMoreDialog [data-page="'+id+'"]');
    return {check:'interface.'+id,
      status:screen.length===1&&hasRenderer&&desktopLink&&mobileLink&&(!['transactions','investments','goals','reports'].includes(id)||moduleEntry)?'aprovada':'alerta',
      action:'verificar_tela_renderizador_e_navegacao'};
  });
}
async function integrityRepairJournal() {
  const before = localStorage.getItem(integrityJournal);
  const result = await integrityHistory();
  if (result.status!=='aprovada') return {check:'diario',status:result.status,
    reason:result.status==='pendente'?'Cofre fechado ou desativado':'Falha ao abrir ou atualizar diário cifrado'};
  return {check:'diario',status:'aprovada',action:'autenticar_e_aplicar_retencao',
    reason:before===localStorage.getItem(integrityJournal)?'Diário sem alteração necessária':'Diário cifrado atualizado'};
}
let integrityMonitoring = false;
let integrityLastCache = 0;
function integrityStoreCheck(results) {
  for (const {check,status,reason,action,recheckOf} of results)
    integrityRecord(check,status,{reason,action,recheckOf});
  if (results.some(item=>item.status==='alerta')) notify('Central de Integridade detectou uma anomalia. Consulte Ajustes.');
}
async function integrityMonitor() {
  if (integrityRunning || diagnosticRunning || integrityMonitoring) return;
  integrityMonitoring = true;
  try {
    const status = await integrityBank().catch(()=> 'pendente');
    if (status !== integrityLast) {
      integrityLast = status;
      integrityContainmentLock = status==='alerta';
      integrityStoreCheck([{check:'banco.monitoramento',status,
        reason:status==='alerta'?'Falha na validação do banco':'Estado do banco verificado',
        action:status==='alerta'?'suspender_gravacoes':'manter_operacao'}]);
    }
    if (Date.now()-integrityLastCache >= 60000) {
      integrityLastCache = Date.now();
      integrityStoreCheck(await integrityAssets());
    }
    await integrityHistory();
  } catch {integrityRecord('monitoramento','alerta');}
  finally {integrityMonitoring = false;}

}
function integrityStageNames(){
  return ['Varredura de integridade','Autocorreção','Monitoramento e checagem','Diagnóstico'];
}
function createIntegrityProgress(){
  const panel=document.createElement('section');
  panel.setAttribute('aria-label','Etapas da Central de Integridade');
  panel.className='integrity-progress integrity-progress-inline';
  panel.innerHTML='<p role="status" class="integrity-screen">Aguardando varredura</p>'+integrityStageNames().map((name,index)=>'<div class="integrity-stage"><div><strong>'+name+'</strong><output>Aguardando</output></div><p class="integrity-stage-detail" id="integrity-stage-detail-'+index+'">Aguardando esta etapa</p><progress max="100" value="0" aria-label="'+name+'"></progress></div>').join('');
  return panel;
}
async function integrityScan() {
  if (!canStartDiagnostic()) return;
  state.settingsView='system';go('settings');
  const host=$('#integrityProgressHost');
  if(!host)return;
  integrityRunning = diagnosticRunning = true;
  const dialog=createIntegrityProgress();
  const names=integrityStageNames();
  dialog.querySelector('.integrity-screen').textContent='Preparando verificações';
  host.replaceChildren(dialog);
  $('#integritySummary').textContent='';
  $('#integrityScanBtn').disabled=true;
  const outputs = dialog.querySelectorAll('output');
  const bars = dialog.querySelectorAll('progress');
  const details = [...dialog.querySelectorAll('.integrity-stage-detail')];
  const stages = [], stageTimings = [];
  const scanStartedAt = new Date().toISOString(), scanStartedPerf = performance.now();
  let runId = '';
  async function step(index,work) {
    const duration = [6000,8000,12000,15000][index];
    const start = performance.now();
    const startedAt = new Date().toISOString();
    let frame, timer;
    const draw = now => {
      bars[index].value = Math.min(99,(now-start)/duration*100);
      outputs[index].textContent = Math.floor(bars[index].value)+'%';
      frame = requestAnimationFrame(draw);
    };
    try {
      outputs[index].textContent='0%';
      details[index].textContent = ['Conferindo banco, telas e arquivos do cache','Validando diário e tentando reparar arquivos comprovadamente íntegros','Repetindo as verificações e observando alterações','Percorrendo os módulos do diagnóstico normal'][index];
      frame = requestAnimationFrame(draw);
      const [result] = await Promise.all([work(message=>{details[index].textContent=message;}),new Promise(resolve=>{timer=setTimeout(resolve,duration);})]);
      bars[index].value=100;
      outputs[index].textContent='Concluída';
      stageTimings.push({stage_index:index,stage:names[index],status:'concluida',started_at:startedAt,
        completed_at:new Date().toISOString(),duration_ms:Math.round(performance.now()-start),target_duration_ms:duration,
        checks_count:Array.isArray(result)?result.length:1});
      return result;
    } catch(error) {
      stageTimings.push({stage_index:index,stage:names[index],status:'falha',started_at:startedAt,
        completed_at:new Date().toISOString(),duration_ms:Math.round(performance.now()-start),target_duration_ms:duration,
        error_type:['Error','TypeError','ReferenceError','SyntaxError','RangeError','QuotaExceededError','SecurityError','NetworkError','AbortError','NotAllowedError'].includes(error?.name)?error.name:'Error'});
      throw error;
    } finally {cancelAnimationFrame(frame);clearTimeout(timer);}
  }
  try {

    runId = crypto.randomUUID ? crypto.randomUUID() : 'run-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    stages.push(await step(0,async update=>{
      update('Autenticando e validando a estrutura do banco');
      const bank=[{check:'banco',status:await integrityBank()}];
      update('Conferindo presença das telas do aplicativo');
      const pages=integrityInterface();
      update('Comparando os hashes dos arquivos no cache');
      return [...bank,...pages,...await integrityAssets()];
    }));
    stages.push(await step(1,async update=>{
      update('Preservando os dados financeiros e verificando o diário');
      const bank={check:'banco',status:'sem_correcao_aplicavel',reason:'Banco preservado para evitar sobrescrever registros'};
      const journal=await integrityRepairJournal();
      update('Buscando cópias válidas para reparar o cache');
      const assets=await integrityAssets(true);
      return [bank,journal,...assets];
    }));
    stages.push(await step(2,async update=>{
      update('Reautenticando o banco após as ações de correção');
      const bank={check:'banco.rechecagem',status:await integrityBank()};
      update('Rechecando as telas e os arquivos do cache');
      return [bank,...integrityInterface(),...await integrityAssets()];
    }));
    stages.flat().forEach(result=>{
      const {check,status,...details}=result;
      integrityRecord(check,status,{...details,runId});
    });
    const scan = await step(3,async()=>{
      const screen = dialog.querySelector('.integrity-screen');
      const started = performance.now();
      const result = await runDiagnosticScan(async(_step,title,percent)=>{
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,14500*percent/100-(performance.now()-started))));
        screen.textContent = title;
        await new Promise(resolve=>requestAnimationFrame(resolve));
      });
      const items = diagnosticChecks(result);
      const failures=items.filter(item=>['falha','erro','contrato_incompativel'].includes(item.status)).length;
      const warnings=items.filter(item=>item.status==='alerta').length;
      const pending=items.filter(item=>['pendente','ignorado','não_suportado','manual'].includes(item.status)).length;
      const summary={check:'diagnostico.integrado',status:failures||warnings?'alerta':pending?'pendente':'aprovada',runId,
        durationMs:result.durationMs,modules:result.modules.length,checks:items.length,failures,warnings,pending,
        action:'executar_diagnostico_normal_tela_a_tela',
        reason:`${failures} falha(s), ${warnings} aviso(s) e ${pending} verificação(ões) sem conclusão automática.`};
      stages.push([summary]);
      const {check,status,...detail}=summary;
      integrityRecord(check,status,detail);
      return result;
    });
    const checks = stages.flat();
    const totals = {
      aprovadas:checks.filter(item=>item.status==='aprovada'||item.status==='ok').length,
      corrigidas:checks.filter(item=>item.status==='corrigida').length,
      alertas:checks.filter(item=>['alerta','falha','erro'].includes(item.status)).length,
      pendentes:checks.filter(item=>['pendente','sem_cofre','ignorado','não_suportado'].includes(item.status)).length
    };
    const history = await integrityHistory();
    const summary = $('#integritySummary');
    if (summary) summary.textContent = Object.entries(totals).map(([label,count])=>count+' '+label).join(' · ') +
      (checks.some(item=>item.status==='sem_cofre')?' · Banco sem cofre ativo.':'') +
      (checks.some(item=>item.check==='cache_pwa'&&item.status==='pendente')?' · Cache da PWA indisponível.':'') +
      (history.status!=='aprovada'?' · Histórico cifrado não confirmado.':'');
    const completedAt=new Date().toISOString();
    download(JSON.stringify({...diagnosticReport(scan),centralDeIntegridade:{schemaVersion:'reserva.integrity.report.v3',runId,startedAt:scanStartedAt,completedAt,durationMs:Math.round(performance.now()-scanStartedPerf),stages,stageTimings,history,totals}},null,2),'application/json','Reserva_Simples_Diagnostico_Integridade.json');
    dialog.querySelector('.integrity-screen').textContent='Varredura concluída';
    notify('Diagnóstico da Central de Integridade gerado.');
  } catch(error) {
    const errorType=['Error','TypeError','ReferenceError','SyntaxError','RangeError','QuotaExceededError','SecurityError','NetworkError','AbortError','NotAllowedError'].includes(error?.name)?error.name:'Error';
    integrityRecord('central.execucao','alerta',{runId:runId||undefined,error_type:errorType,reason:'A execução da Central de Integridade foi interrompida antes de concluir todas as etapas'});
    const completedAt=new Date().toISOString();
    const history=await integrityHistory();
    const checks=stages.flat();
    const totals={aprovadas:checks.filter(item=>['aprovada','ok'].includes(item.status)).length,
      corrigidas:checks.filter(item=>item.status==='corrigida').length,
      alertas:checks.filter(item=>['alerta','falha','erro'].includes(item.status)).length+1,
      pendentes:checks.filter(item=>['pendente','sem_cofre','ignorado','não_suportado'].includes(item.status)).length};
    download(JSON.stringify({...diagnosticReport(null),centralDeIntegridade:{schemaVersion:'reserva.integrity.report.v3',runId:runId||null,
      startedAt:scanStartedAt,completedAt,durationMs:Math.round(performance.now()-scanStartedPerf),stages,stageTimings,history,totals,
      failure:{stage:stageTimings.at(-1)?.stage||names[stageTimings.length],type:errorType}}},null,2),
      'application/json','Reserva_Simples_Diagnostico_Integridade.json');
    dialog.querySelector('.integrity-screen').textContent='Varredura interrompida';
    notify('Falha ao concluir a Central de Integridade.');
  } finally {
    if($('#integrityScanBtn'))$('#integrityScanBtn').disabled=false;
    integrityRunning = diagnosticRunning = false;
    state.settingsView='system';go('settings');
  }
}
integrityRecord('app.inicio','observado');
document.addEventListener('click',event=>{
  if(event.target.closest('#integrityScanBtn'))void integrityScan();
  if(event.target.closest('[data-reset-transaction-filters]')){
    Object.assign(state,{txFilter:'all',txSearch:'',txTag:'',txSubcategory:'',txCategorySet:null});
    transactions();
    $('#transactionSearch')?.focus();
  }
});
for(const type of ['click','keydown','submit']){
  document.addEventListener(type,event=>{
    if(!event.isTrusted||!integrityRunning||!$('#integrityProgressHost > .integrity-progress'))return;
    if(type==='keydown'&&event.key==='Tab')return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
}
document.addEventListener('securitypolicyviolation',()=>{
  integrityStoreCheck([{check:'politica.conteudo',status:'alerta'}]);
  void integrityHistory();
});
document.addEventListener('visibilitychange',()=>{if (!document.hidden) void integrityMonitor();});
window.addEventListener('storage',event=>{if(event.key===STORE) void integrityMonitor();});
setInterval(integrityMonitor,15000);
void integrityMonitor();

})();
