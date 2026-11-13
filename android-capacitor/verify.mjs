/**
 * QA estático mínimo antes de enviar o pacote ao Android WebView.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const dir = resolve(import.meta.dirname, '..', 'www');
const get = p => readFileSync(join(dir, p), 'utf8');
for (const name of ['index.html', 'app.js', 'engines.js', 'version.json', 'android-updater-bridge.js']) assert(existsSync(join(dir, name)), 'Falta: '+name);
for (const icon of ['icon.svg', 'icon-192.png', 'icon-512.png']) assert(existsSync(join(dir, icon)), 'Falta ícone: '+icon);
assert(!existsSync(join(dir, 'sw.js')), 'Service worker não pode ser enviado ao APK');
assert(!existsSync(join(dir, 'manifest.webmanifest')), 'Manifesto PWA não pode ser enviado ao APK');
const html = get('index.html'), app = get('app.js'), engines = get('engines.js'), version = JSON.parse(get('version.json'));
assert(html.includes('RESERVA_ANDROID_CAPACITOR = true'), 'Falta marcador Android no HTML');
assert(html.includes('src="./engines.js"') && html.includes('src="./app.js"'), 'Ordem dos scripts mudou');
assert(html.indexOf('src="./engines.js"') < html.indexOf('src="./app.js"'), 'Motores precisam carregar antes do app');
assert(!/rel\s*=\s*["']manifest["']/i.test(html), 'Não enviar manifesto PWA');
assert(app.includes('!window.RESERVA_ANDROID_CAPACITOR&&'), 'Service worker deve estar desativado no Android');
assert(app.includes('Atualizações Android via APK'), 'Atualizador deve explicar instalação por APK');
assert(app.includes('const STORE=') && app.includes('const PAGES='), 'Módulos/armazenamento não foram mantidos');
assert(app.includes('const APP_VERSION=') && app.includes(version.version), 'Versões divergem');
assert(engines.includes('ReservaEngines'), 'Motor financeiro ausente');
assert(html.includes('reserva-android-safe-areas') && html.includes('html.android-capacitor .floating-nav{bottom:14px}'), 'CSS safe area da dock ausente');
assert(html.includes('src="./android-updater-bridge.js"'), 'Ponte JavaScript/Android ausente');
assert(app.includes('window.ReservaNativeUpdater') && app.includes('updateProgress'), 'Atualizador Android ou progresso ausente');
assert(app.includes('Confirme a instalação no Android'), 'Confirmação de instalação nativa ausente');
assert(readFileSync(join(dir, 'android-updater-bridge.js'), 'utf8').includes('ReservaUpdater'), 'Plugin não vinculado no JavaScript');
console.log('[Reserva Android QA] OK: interface, motores, assets, versão e isolamento do PWA.');
