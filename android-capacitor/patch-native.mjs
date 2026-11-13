/**
 * Adapta apenas o projeto Android gerado no CI.
 * Controles de edge-to-edge, plugin do atualizador e versionamento nativo.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const android = join(root, 'android', 'app', 'src', 'main');
const pkg = join(android, 'java', 'br', 'com', 'reservasimples', 'app');
const resources = join(android, 'res', 'xml');
const manifestPath = join(android, 'AndroidManifest.xml');
const gradlePath = join(root, 'android', 'app', 'build.gradle');
mkdirSync(pkg, { recursive: true });
mkdirSync(resources, { recursive: true });
for (const name of ['MainActivity.java', 'ReservaUpdaterPlugin.java']) {
  copyFileSync(join(root, 'android-capacitor', 'native', name), join(pkg, name));
}
copyFileSync(join(root, 'android-capacitor', 'native', 'apk_paths.xml'), join(resources, 'reserva_apk_paths.xml'));

let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('</application>') || !manifest.includes('<manifest')) {
  throw new Error('AndroidManifest.xml mudou: necessário rever integração nativa.');
}
if (!manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
  manifest = manifest.replace(/<application\b/, '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <application');
}
const provider = [
  '        <provider',
  '            android:name="androidx.core.content.FileProvider"',
  '            android:authorities="' + '$' + '{applicationId}.updates.provider"',
  '            android:exported="false"',
  '            android:grantUriPermissions="true">',
  '            <meta-data android:name="android.support.FILE_PROVIDER_PATHS"',
  '                android:resource="@xml/reserva_apk_paths" />',
  '        </provider>'
].join('\n');
if (!manifest.includes('reserva_apk_paths')) manifest = manifest.replace('</application>', provider + '\n    </application>');
writeFileSync(manifestPath, manifest);

const version = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versão Android inválida');
const [major, minor, patch] = version.split('.').map(Number);
if (minor >= 1000 || patch >= 1000) throw new Error('Versão maior do que faixa de versionCode');
const versionCode = major * 1000000 + minor * 1000 + patch;
if (versionCode <= 0 || versionCode >= 2100000000) throw new Error('versionCode Android inválido');

let gradle = readFileSync(gradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+["'][^"']+["']/.test(gradle)) {
  throw new Error('Não foi possível localizar versionCode/versionName no Gradle.');
}
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + versionCode);
gradle = gradle.replace(/versionName\s+["'][^"']+["']/, 'versionName "' + version + '"');

const secretKeys = ['RESERVA_ANDROID_KEYSTORE_BASE64', 'RESERVA_ANDROID_STORE_PASSWORD',
                    'RESERVA_ANDROID_KEY_ALIAS', 'RESERVA_ANDROID_KEY_PASSWORD'];
const present = secretKeys.filter(k => !!process.env[k]);
if (present.length && present.length !== secretKeys.length) {
  throw new Error('Assinatura incompleta: configure os quatro secrets Android.');
}
if (present.length === secretKeys.length) {
  if (!existsSync(join(root, 'android', 'app', 'release-keystore.jks'))) {
    throw new Error('Keystore da release não encontrado.');
  }
  const signing = [
    '    signingConfigs {',
    '        reservaRelease {',
    "            storeFile file('release-keystore.jks')",
    "            storePassword System.getenv('RESERVA_ANDROID_STORE_PASSWORD')",
    "            keyAlias System.getenv('RESERVA_ANDROID_KEY_ALIAS')",
    "            keyPassword System.getenv('RESERVA_ANDROID_KEY_PASSWORD')",
    '        }',
    '    }'
  ].join('\n');
  if (!/buildTypes\s*\{/.test(gradle) || !/buildTypes\s*\{\s*release\s*\{/.test(gradle)) {
    throw new Error('Configuração Gradle buildTypes mudou.');
  }
  gradle = gradle.replace(/buildTypes\s*\{/, signing + '\n    buildTypes {');
  gradle = gradle.replace(/buildTypes\s*\{\s*release\s*\{/, 'buildTypes {\n        release {\n            signingConfig signingConfigs.reservaRelease');
}
writeFileSync(gradlePath, gradle);
console.log('[Android native] Plugin e WindowInsets instalados; versionCode=' + versionCode + '; assinatura permanente=' + (present.length === 4 ? 'sim' : 'não (debug)'));
