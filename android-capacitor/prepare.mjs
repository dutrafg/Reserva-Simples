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
html = html.replace('</head>', '<script>window.RESERVA_ANDROID_CAPACITOR = true;</script>\n</head>');
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
  "let updateRegistration=null;\nif(window.RESERVA_ANDROID_CAPACITOR){updateInfo.notes='Nesta versão Android, as atualizações são instaladas por APK. Faça backup antes de trocar uma versão de teste.';updateInfo.status='Atualizações via APK';updateInfo.state='success';}",
  'estado da atualização');
replaceRequired('async function checkForUpdates(){',
  "async function checkForUpdates(){if(window.RESERVA_ANDROID_CAPACITOR){updateInfo.available=false;updateInfo.notes='O aplicativo Android é atualizado por instalação de APK, não pelo mecanismo PWA. Faça backup antes de atualizar.';setUpdateStatus('Atualizações Android via APK','success');return;}",
  'consulta de atualização');
replaceRequired('async function applyUpdate(){',
  "async function applyUpdate(){if(window.RESERVA_ANDROID_CAPACITOR)return notify('Atualização Android: instale o próximo APK, preservando os dados com backup.');",
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
