# Reserva Simples — v0.38.15

Aplicativo financeiro local para registrar rendas, despesas e movimentações de metas de reserva.

## Metas

- Crie uma meta informando objetivo, valor final e prazo. O formulário mostra uma estimativa mensal imediatamente, usando o saldo já guardado.
- A tela Metas mostra progresso, saldo restante, prazo, ritmo recente e valor mensal de referência; também permite simular aportes.
- Pause e retome o plano sem apagar o saldo ou o histórico. Metas pausadas ficam fora do total mensal recomendado.
- Os aportes são registros manuais: o app não transfere dinheiro automaticamente.
- Dados antigos do desafio/cartela de R$ 10 mil são convertidos em uma meta comum; depósitos e histórico continuam preservados.

## Motores financeiros em Insights

- Previsão de caixa em 30, 60 e 90 dias com saldo de referência, contas recorrentes e lançamentos futuros cadastrados. Configure o saldo e a data em Ajustes.
- Reserva de emergência baseada na média de despesas observadas nos últimos meses fechados, com meta configurável de 3, 6, 9 ou 12 meses.
- Comparação do valor de quitação com o valor presente de parcelas, usando o rendimento líquido estimado do CDB como custo de oportunidade. Os valores dependem da proposta real da instituição.
- Cenário de metas corrigidas pelo IPCA acumulado dos últimos 12 meses, sem tratar a inflação passada como previsão futura.
- Monitoramento informativo de exposição a FGC/FGCoop por conglomerado, incluindo outros saldos declarados pelo usuário. A ferramenta não confirma elegibilidade nem calcula limites globais usados anteriormente.
- Gráficos de saldo projetado, reserva, comparação de quitação e IPCA facilitam a leitura dos resultados.

## CDB e CDI

- Cada cofrinho pode ser ligado a um banco ou cooperativa com percentual do CDI configurável. Os cofrinhos já existentes passam a usar Banco Inter, 100% do CDI.
- O aplicativo consulta a série diária SGS 12 do Banco Central ao abrir e atualiza a taxa automaticamente quando está online; o botão “Atualizar CDI” permite uma consulta manual. O histórico consultado é mantido no aparelho.
- Os saldos exibem aportes, rendimento bruto e estimativa líquida após IOF e IR se resgatados na data do cálculo. Resgates e aportes são processados pelas datas registradas. A estimativa não substitui o extrato oficial da instituição.
- “Gerar PDF” abre o relatório para imprimir ou salvar/compartilhar como PDF no navegador.

## Outros módulos

- **Hoje:** resumo de orçamento, saldo disponível, despesas por dia e metas ativas.
- **Lançamentos:** rendas, despesas, busca, filtros e contas recorrentes.
- **Calendário e agenda:** compromissos e tarefas com cores, acesso em todos os módulos e card de próximos compromissos no início.
- **Calendário e agenda:** toque em uma data para abrir a agenda do dia em sobreposição; compromissos coloridos, card de próximos compromissos no Início e acesso em todos os módulos.
- **Insights:** análises locais e projeções.
- **Configurações:** aparência, atualização, backup e restauração.

## Responsividade

A interface adapta menu, cartões, formulários e tabelas a smartphone, tablet e desktop. O menu flutuante inferior respeita as áreas seguras do aparelho.

## Backup e dados

O banco principal fica no armazenamento local do navegador. A pasta de backup recebe uma cópia exportada pelo app; ela não é sincronização entre dispositivos e os dados não são criptografados.

## Instalação e atualização

Publique esta pasta em HTTPS e instale pelo navegador. O atualizador verifica `version.json`; a versão do Service Worker e `APP_VERSION` precisam acompanhar cada release. Para testar localmente: `python3 -m http.server 8080`.

`index.html` apresenta a interface; `app.js` contém telas e interações; `engines.js` reúne cálculos locais; `sw.js`, manifesto e ícones habilitam PWA e cache offline.

## Ajustes visuais v0.18

- Botão central alinhado ao centro geométrico da pílula, com módulos distribuídos em grupos laterais responsivos.
- Menu rápido “Adicionar” com cartões de ação estilizados, ícones, descrições e estados de toque/acessibilidade.

## Cabeçalho e dock v0.19

- O acesso a Ajustes fica ao lado do título no cabeçalho mobile e junto do cabeçalho nos demais tamanhos.
- A dock mantém cinco posições uniformes; Ajustes abre pelo atalho do cabeçalho. O botão “+” ocupa a posição central exata.

## Insights v0.22

- Os cálculos usam os dados informados no aparelho e servem como estimativas para planejamento. A projeção de caixa depende do saldo de referência e dos lançamentos cadastrados.
- O cenário de inflação mantém o IPCA observado nos últimos 12 meses; não é uma previsão do índice futuro.
- O comparador de dívida não substitui o demonstrativo de quitação nem considera encargos que não foram preenchidos.
- O monitoramento FGC/FGCoop depende das escolhas de instituição e conglomerado, dos saldos externos informados e da elegibilidade do produto.

## Cálculo do CDI e relatório v0.21

- A consulta automática usa a série 12 do SGS (CDI diário, percentual ao dia) publicada pelo Banco Central.
- A estimativa de resgate desconta IOF e IR regressivos sobre o rendimento, conforme prazos. A taxa futura do CDI não é projetada nem garantida.
- O relatório em PDF contém os valores dos cofrinhos não arquivados, instituição, percentual do CDI e estimativas de impostos.

## Ícone Ajustes v0.20

- Engrenagem vetorial redesenhada com oito dentes, eixo circular, tons de aço e base prateada inspirada no ícone Ajustes do iOS.
- Mantidos contraste, tamanho de toque e rótulo acessível no cabeçalho.
