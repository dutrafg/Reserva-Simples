# Reserva Simples — Android híbrido Capacitor

Versão base: **0.38.17** do Reserva Simples. Reaproveita os módulos originais e seus motores financeiros.

## APK de teste

Abra GitHub > Actions > **Android — Reserva Simples Capacitor (APK beta)** > execução bem-sucedida mais recente > **Artifacts** > `Reserva-Simples-Android-Capacitor-Beta`. Extraia o ZIP e instale `app-debug.apk`.

O APK debug é apenas para testes. Não pressupõe assinatura persistente entre compilações. Antes de substituir ou desinstalar, exporte um backup dos registros.

## Correção da sobreposição Android

O `MainActivity` configura o modo edge-to-edge do Android, mas aplica os insets reais da barra de status, da barra de gestos/navegação e dos recortes da tela ao contêiner da WebView. O `WindowInsets` de teclado é mantido para que formulários reajam normalmente.

No HTML do APK, regras CSS específicas posicionam a dock flutuante acima da área segura, preservam rolagem, cabeçalho e diálogos. Nenhuma dessas alterações muda a versão web da `main`.

## Atualizador Android em Ajustes

A ponte `ReservaUpdater` é implementada em Java e exposta no JavaScript por meio do Capacitor. O fluxo:

1. Na abertura do app e a cada seis horas, consultar `https://api.github.com/repos/dutrafg/Reserva-Simples/releases?per_page=30`.
2. Selecionar a versão estável mais recente com tag `android-vMAJOR.MINOR.PATCH` e APK com nome exato `reserva-simples-android.apk`. Releases de Windows e prereleases não são oferecidas.
3. Na página **Ajustes**, mostrar a versão encontrada e o botão **Atualizar agora**.
4. Baixar por HTTPS dentro do armazenamento privado de cache Android, com barra de progresso real.
5. Comparar bytes e SHA-256 com o valor `digest` do asset da release no GitHub. Antes da instalação, conferir também identidade do pacote Android, versão, versionCode e assinatura compatível com a já instalada.
6. O Android exige permissão para instalar aplicativos desta origem, quando necessária, e exibe a confirmação final. O app nunca instala silenciosamente.

Se ainda não existir uma release Android assinada, a consulta informará que não há versão publicada. O atualizador não usa Service Worker, PWA ou o `version.json` da Vercel.

## Configurar assinatura persistente das próximas versões

É **necessário** configurar um keystore com uma chave privada estável nos *Actions secrets* do repositório. Nomes exigidos:

- `RESERVA_ANDROID_KEYSTORE_BASE64`: conteúdo do keystore Java/PKCS12 codificado em Base64.
- `RESERVA_ANDROID_STORE_PASSWORD`: senha do keystore.
- `RESERVA_ANDROID_KEY_ALIAS`: alias da chave de assinatura.
- `RESERVA_ANDROID_KEY_PASSWORD`: senha da chave.

**Nunca commitar a chave nem o arquivo de keystore.** Guardar uma cópia segura fora do GitHub e registrar seu alias e senha. Se a chave for perdida, não será possível assinar atualizações compatíveis com aquela instalação sem um procedimento de rotação de chave.

A ação no GitHub Actions, executada manualmente na branch `android/capacitor-beta` com `publish_release=true`, compila um APK *release* assinado e publica uma GitHub Release `android-v0.38.17` com o asset `reserva-simples-android.apk`. O GitHub calcula o SHA-256 do asset, lido pelo atualizador.

Para futuras versões, aumentar `version.json` e o `APP_VERSION` do aplicativo **de maneira coordenada** antes da publicação (o versionCode nativo é derivado da versão). Publicar uma nova release somente após passar pelo QA. Ações comuns na branch geram apenas APKs debug e não publicam releases automaticamente.

**Migração debug para assinado:** o APK debug atual não possui a mesma assinatura de uma futura versão release. O Android poderá exigir a remoção do debug antes de instalar a primeira versão assinada, o que apaga seu armazenamento local. Faça um backup verificável antes da migração. Depois de instalada a primeira release assinada, as atualizações assinadas com a mesma chave podem preservar os dados.

## Compilação local

Requisitos: Node.js 22, JDK 21 e Android SDK.

```bash
npm install --no-package-lock
node android-capacitor/prepare.mjs
npx esbuild android-capacitor/native-updater-bridge.js --bundle --format=iife --platform=browser --outfile=www/android-updater-bridge.js
node android-capacitor/verify.mjs
npx cap add android
npx cap sync android
node android-capacitor/patch-native.mjs
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Limitações do beta

- O app mantém `localStorage` dentro da WebView Android, separado do navegador/PWA. Migrar via backup/restauração.
- Exportação de backups, acesso a pasta, PDFs e notificações em segundo plano dependem de testes em aparelho real e podem exigir integrações nativas adicionais.
- Taxas CDI/IPCA dependem de rede; os cálculos financeiros locais e a interface são incluídos no APK.
- A compilação automatizada verifica a sintaxe, o pacote, o código nativo e a geração do APK; não substitui testes de posicionamento em diferentes aparelhos/versões do Android.
- A `main` do Reserva Simples permanece intacta.
