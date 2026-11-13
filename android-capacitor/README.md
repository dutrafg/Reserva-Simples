# Reserva Simples — Android híbrido Capacitor

**Base:** versão 0.38.17 do Reserva Simples na main; navegação, calendário, lançamentos, cofrinhos, investimentos e motores `engines.js` são reutilizados.

## Como baixar o APK
Acesse GitHub > Actions > `Android — Reserva Simples Capacitor (APK beta)` > execução bem-sucedida > **Artifacts** > `Reserva-Simples-Android-Capacitor-Beta`. Extraia o ZIP e instale `app-debug.apk`.

## Compilar localmente
Requisitos: Node.js 22, Java 21, Android SDK.

```bash
node --check app.js
node --check engines.js
node android-capacitor/prepare.mjs
node android-capacitor/verify.mjs
npm install --no-save --package-lock=false @capacitor/core@8.6.0 @capacitor/android@8.6.0 @capacitor/cli@8.6.0
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

Resultado: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Limites conhecidos do primeiro beta
- É um **APK debug**, não uma versão assinada para Play Store.
- Os dados são locais no armazenamento isolado da WebView Android; não migram do navegador automaticamente. Exporte e restaure um backup antes de confiar em registros reais.
- A opção **Escolher pasta de backup** usa a API web `showDirectoryPicker`, cuja disponibilidade é limitada na WebView. Exportação/importação de arquivos e PDFs via downloads web precisam de validação no aparelho e podem exigir plugins nativos.
- Lembretes por notificações Android em segundo plano ainda não estão integrados; a interface informa essa limitação.
- As atualizações são feitas por um **novo APK**, não por Service Worker. Builds debug gerados em runners diferentes podem ter certificados distintos e exigir desinstalação; não mantenha dados reais sem um backup verificado.
- A consulta de taxas CDI/IPCA depende de internet. O restante da interface e os cálculos locais são empacotados.
- Não altera o código PWA nem a branch main. A validação final do calendário, backup, PDF, câmera/permissões e instalação requer aparelho físico.
