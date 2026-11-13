/**
 * Replica a versão da main para o APK Android, sem PWA e sem tocar na versão web.
 * O funcionamento continua local: app.js e engines.js não são reescritos.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = join(root, 'www');
const sources = ['index.html', 'app.js', 'engines.js', 'version.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
for (const name of sources) {
  if (!existsSync(join(root, name))) throw new Error('Arquivo do Reserva Simples ausente: ' + name);
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const name of sources) copyFileSync(join(root, name), join(target, name));

let html = readFileSync(join(target, 'index.html'), 'utf8');
if (!html.includes('src="./app.js"') || !html.includes('src="./engines.js"')) {
  throw new Error('Ponto de entrada do app mudou: revise o empacotamento Android.');
}
html = html.replace(/<link\s+rel=["']manifest["'][^>]*>\s*/i, '');
const nativeStyle = [
  '<style id="reserva-android-safe-areas">',
  'html.android-capacitor,html.android-capacitor body{min-height:100dvh}',
  'html.android-capacitor .main{padding-top:24px;padding-bottom:128px}',
  'html.android-capacitor .floating-nav{bottom:14px}',
  'html.android-capacitor .toast{bottom:106px}',
  'html.android-capacitor .modal{padding:16px}',
  'html.android-capacitor .dialog{max-height:calc(100dvh - 32px)}',
  'html.android-capacitor #androidDownloadProgress{display:block;width:100%;height:12px;accent-color:#2776d9;margin-top:12px}',
  '</style>'
].join('\n');
html = html.replace('</head>', nativeStyle + '\n<script>window.RESERVA_ANDROID_CAPACITOR = true;document.documentElement.classList.add("android-capacitor");</script>\n</head>');
html = html.replace('<script src="./engines.js"></script>',
  '<script src="./android-updater-bridge.js"></script>\n<script src="./engines.js"></script>');
writeFileSync(join(target, 'index.html'), html, 'utf8');

let app = readFileSync(join(target, 'app.js'), 'utf8');
function replaceRequired(oldText, newText, reason) {
  if (!app.includes(oldText)) throw new Error('Adaptador Android desatualizado: ' + reason);
  app = app.replace(oldText, newText);
}
// O APK é um pacote offline e não deve executar o serviço de cache/atualização PWA.
replaceRequired("if('serviceWorker' in navigator&&location.protocol!=='file:')",
  "if(!window.RESERVA_ANDROID_CAPACITOR&&'serviceWorker' in navigator&&location.protocol!=='file:')",
  'registro de Service Worker');
replaceRequired('let updateRegistration=null;',
  "let updateRegistration=null;\nlet nativeApkVerified=false;\nif(window.RESERVA_ANDROID_CAPACITOR){updateInfo.notes='Atualizações Android são publicadas no GitHub, com download verificado e confirmação de instalação pelo sistema.';updateInfo.status='Verificando atualização Android';updateInfo.state='checking';}",
  'estado da atualização');
replaceRequired('async function checkForUpdates(){',
  `async function checkForUpdates(){if(window.RESERVA_ANDROID_CAPACITOR){
    const api=window.ReservaNativeUpdater;
    if(!api){setUpdateStatus('Atualizador Android indisponível','error');return}
    try{
      setUpdateStatus('Consultando versões Android no GitHub…','checking');
      const result=await api.checkUpdate();
      updateInfo.available=!!result.available;
      updateInfo.latest=result.latestVersion||APP_VERSION;
      updateInfo.lastCheck=new Date().toISOString();
      localStorage.setItem('reserva.update.checkedAt',updateInfo.lastCheck);
      updateInfo.notes=result.available
        ?('Nova versão Android v'+result.latestVersion+'. '+(result.notes||'Faça backup antes de instalar.'))
        :(result.message||'Nenhuma atualização Android disponível.');
      nativeApkVerified=false;
      setUpdateStatus(result.available?'Nova versão Android disponível':'Android sem atualização disponível',result.available?'available':'success');
    }catch(e){
      updateInfo.available=false;
      updateInfo.notes=String(e?.message||e);
      setUpdateStatus('Sem conexão com as versões Android','error');
    }
    return;
  }`,
  'consulta de atualização');
replaceRequired('async function applyUpdate(){',
  `async function applyUpdate(){if(window.RESERVA_ANDROID_CAPACITOR){
    const api=window.ReservaNativeUpdater;
    if(!api||!updateInfo.available)return notify('Nenhuma atualização Android pronta.');
    if(updateInProgress||saving||vaultBusy)return notify('Conclua o salvamento antes da atualização.');
    updateInProgress=true;
    const button=$('#applyUpdateBtn');
    if(button)button.disabled=true;
    let listener;
    try{
      if(!nativeApkVerified){
        const updateCard=$('#applyUpdateBtn')?.closest('article');
        let progressBar=$('#androidDownloadProgress');
        if(!progressBar&&updateCard){
          progressBar=document.createElement('progress');
          progressBar.id='androidDownloadProgress';
          progressBar.max=100;
          progressBar.value=0;
          progressBar.setAttribute('aria-label','Progresso do download do APK Android');
          const actions=$('#applyUpdateBtn')?.closest('.setting-actions');
          if(actions)actions.insertAdjacentElement('afterend',progressBar);
        }
        if(progressBar)progressBar.value=0;
        setUpdateStatus('Iniciando download seguro do APK…','checking');
        listener=await api.addListener('updateProgress',e=>{
          const percentage=Math.max(0,Math.min(100,Number(e.percent)||0));
          if(progressBar)progressBar.value=percentage;
          setUpdateStatus('Baixando atualização: '+percentage+'%','checking');
        });
        await api.downloadUpdate();
        nativeApkVerified=true;
      }
      setUpdateStatus('APK verificado. Abrindo instalador Android…','available');
      const result=await api.installUpdate();
      if(result.permissionRequired){
        updateInfo.notes='Autorize o Reserva Simples a instalar atualizações e volte a tocar em Atualizar agora. O APK já está verificado.';
        setUpdateStatus('Autorize a instalação nas configurações Android','available');
      }else if(result.installerOpened){
        updateInfo.notes='Confira o nome e versão exibidos pelo Android e confirme a instalação. Os dados só são mantidos se a assinatura do APK for compatível.';
        setUpdateStatus('Confirme a instalação no Android','available');
      }
    }catch(e){
      updateInfo.notes=String(e?.message||e);
      setUpdateStatus('Falha na atualização Android','error');
    }finally{
      if(listener)await listener.remove();
      updateInProgress=false;
      if(button)button.disabled=false;
    }
    return;
  }`,
  'aplicação de atualização');
replaceRequired('function billNotificationPermission(){',
  "function billNotificationPermission(){if(window.RESERVA_ANDROID_CAPACITOR)return 'Notificações nativas ainda não disponíveis nesta versão de teste Android.';",
  'aviso de notificações');
replaceRequired('async function requestBillNotificationPermission(){',
  "async function requestBillNotificationPermission(){if(window.RESERVA_ANDROID_CAPACITOR)return notify('Notificações em segundo plano exigem integração nativa Android.');",
  'permissões de notificações');
replaceRequired('async function checkBillReminders(){',
  'async function checkBillReminders(){if(window.RESERVA_ANDROID_CAPACITOR)return;',
  'lembretes de fundo');
writeFileSync(join(target, 'app.js'), app, 'utf8');

const version = JSON.parse(readFileSync(join(target, 'version.json'), 'utf8'));
version.channel = 'android-beta';
version.source = 'APK Capacitor offline; atualizações via APK';
writeFileSync(join(target, 'version.json'), JSON.stringify(version, null, 2) + '\n', 'utf8');
console.log('[Reserva Android] Arquivos preparados; atualização PWA desativada; versão', version.version);
