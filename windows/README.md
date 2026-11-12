# Reserva Simples para Windows

Prévia técnica 0.1.1 com interface nativa em WPF e .NET 10. Hoje mostra o resumo mensal. Lançamentos permite cadastrar receitas e despesas e consultar o histórico local.

O banco SQLite fica em `%LocalAppData%\ReservaSimples\reserva.db`. Esta prévia ainda grava sem criptografia. Use dados fictícios até que o cofre e a restauração estejam implementados e validados.

## Compilar

Em Windows com SDK .NET 10:

```powershell
dotnet publish windows/ReservaSimples.csproj -c Release -r win-x64 --self-contained true -o artifacts/win-x64
```

O GitHub Actions disponibiliza apenas o instalador Reserva-Simples-Setup-x64.exe. O aplicativo permite navegar por mês e criar cópias SQLite com nomes separados.

O aplicativo ainda não tem importação do PWA, cofre cifrado, restauração de backup, metas, carteira ou PDF. O PWA segue como projeto independente.
