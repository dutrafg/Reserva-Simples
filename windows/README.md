# Reserva Simples para Windows x64

Beta 0.1.6. Aplicativo nativo em WPF e .NET 10, com instalador x64.

## Instalação

Abra a execução mais recente aprovada do [GitHub Actions](https://github.com/dutrafg/Reserva-Simples/actions/workflows/windows-native.yml) para a branch `windows-native`. Baixe o artefato `Reserva-Simples-Instalador-x64`, extraia o ZIP e execute o instalador.

## Funcionalidades

- Resumo mensal, receitas, despesas, categorias, recorrências e cota de mercado.
- Metas e cofrinhos com aportes, resgates e vínculos com a carteira.
- Investimentos com registro de posições existentes, aportes e resgates. Posições existentes não debitam o saldo mensal.
- Insights e relatório mensal com prévia e opção de imprimir ou salvar em PDF.
- Importação de dados do PWA, backup local e restauração.

O banco fica em `%LocalAppData%\ReservaSimples\reserva.db`. O banco e as cópias SQLite são cifrados. As cópias dependem da conta Windows que as criou.

## Validação do PDF no Windows

1. Com dados fictícios, cadastre uma receita, uma despesa, uma meta e um investimento vinculado.
2. Selecione o mês dos lançamentos e abra Insights.
3. Confira os totais do mês e as seções de carteira, metas e lançamentos na prévia.
4. Em **Imprimir / Salvar em PDF**, selecione **Microsoft Print to PDF**. Abra o arquivo gerado e confira acentos, margens e quebra de páginas com um relatório longo.

## Compilação

Com o SDK .NET 10 no Windows:

```powershell
dotnet publish windows/ReservaSimples.csproj -c Release -r win-x64 --self-contained true -o artifacts/win-x64
```

O GitHub Actions usa Inno Setup para gerar o instalador e executa testes de instalação, abertura e persistência.
