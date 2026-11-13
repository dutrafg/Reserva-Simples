# Histórico de alterações

## v0.38.17

- A agenda permite editar, concluir/reabrir e excluir compromissos; alterações em lançamentos, movimentações e investimentos pedem duas confirmações com aviso de impacto nos valores.
- Lançamentos aceitam subcategorias e até oito etiquetas; etiquetas e subcategorias podem filtrar a lista e são mantidas na exportação CSV.
- A tela inicial mostra vencimentos recorrentes dos próximos dias e permite abrir a data no calendário; notificações configuráveis oferecem aviso no dia, 1, 3 ou 7 dias antes.

## v0.38.15

- Tocar em uma data abre a agenda e os lançamentos do dia em uma sobreposição, com ações para concluir ou excluir tarefas.
- O toque em um compromisso no card do Início abre a mesma data e sobreposição.

## v0.38.14

- Agenda acessível pelo cabeçalho em todos os módulos; o início exibe próximos compromissos pendentes.
- Compromissos com cores próprias destacadas no dia do calendário e na lista da agenda.
- Corrigido o contraste da data atual e sincronizado o cache do PWA.

## v0.38.7

- O relatório PDF ganhou identidade visual do Reserva Simples, cartões de resumo, tabelas alinhadas e paginação consistente.

## v0.38.6

- Corrigidos os vínculos e saldos de investimentos, metas e lotes pecuários, incluindo resgate parcial e remoção de aplicações.
- Corrigidos sinais do fluxo financeiro, importação/exportação CSV, detecção de duplicados e limites de orçamento.
- Ajustadas projeções com eventos vencidos, datas de vencimento e fluxo diário.
- Relatórios PDF agora preservam colunas tabulares, orientação paisagem e dados da carteira.
- Corrigidos controles de backup, restauração e limpeza de dados; investimentos voltaram à navegação móvel.

## v0.38.5

- O relatório financeiro é gerado na própria tela, sem abrir outra janela.
- O período é escolhido por botões e o link de download fica visível como alternativa quando o navegador móvel bloqueia o download automático.
- O relatório de cofrinhos também baixa o PDF diretamente.

## v0.38.4

- O download do PDF agora usa a aba do relatório, preservando o gesto do usuário exigido por navegadores móveis.

## v0.38.3

- Corrigido o vínculo dos botões de download nos relatórios financeiros e de cofrinhos.
- O arquivo PDF é gerado diretamente, sem depender da caixa de impressão móvel.

## v0.38.2

- Relatórios financeiros e de cofrinhos geram um arquivo PDF para download, sem depender da tela de impressão do navegador.
- Mantida a opção de imprimir quando o navegador oferece esse recurso.

## v0.38.1

- Corrigida a impressão e o salvamento em PDF dos relatórios financeiros e de cofrinhos, com acionamento pelo botão no próprio relatório para evitar bloqueios do navegador.
- Atualizado o cache do aplicativo para disponibilizar a correção instalada no PWA.

## v0.38.0

- Adicionado orçamento mensal configurável por categoria, com acompanhamento no mês selecionado e alertas ao atingir 75% ou ultrapassar o limite.
- Expandido o controle pecuário para registrar gastos individuais por data e categoria; cada gasto também entra nas despesas e nos limites de orçamento.
- Incluídas vendas parciais e totais de lotes, com quantidade vendida, custo proporcional, saldo remanescente e resultado realizado.
- Preservados os registros e lotes existentes durante a migração dos dados.


## v0.37.0

- Adicionado o ativo de pecuária à carteira, com categoria do gado, quantidade, compra, custos de manejo e valor de mercado estimado.
- Incluído registro de venda do lote, com entrada no histórico financeiro e cálculo do resultado realizado após os custos de aquisição e manejo.
- Mantidos o vínculo com metas, o armazenamento local e a abertura de dados existentes.


## v0.36.1

- Corrigida a leitura dos códigos de movimento “D” e “C” em extratos bancários CSV.


## v0.36.0

- Adicionada importação de extratos bancários CSV com reconhecimento automático de datas, valores, entradas/saídas e categorias por cabeçalho, categoria bancária e descrição.
- Incluída prévia dos lançamentos, deduplicação e importação aditiva, preservando os registros já salvos.
- Corrigidas previsões e metas para acompanhar o mês selecionado na navegação.
- Compactado o botão Ajustes no cabeçalho para celular e tablet; esclarecido o vínculo de investimentos às metas.



## v0.17.0

- Removida a interface especial da cartela de investimento/desafio.
- Metas antigas da cartela de R$ 10 mil são migradas para cofrinhos editáveis, preservando alvo, prazo, identificador e depósitos. Notas técnicas antigas passam a descrições legíveis.
- Formulário de meta atualizado para linguagem direta e prévia automática do aporte mensal estimado.
- Incluídas ações para pausar e retomar o plano de uma meta sem perder saldo ou histórico. Metas pausadas não entram no total mensal recomendado.
- Mantidos o acompanhamento de progresso, as movimentações, o simulador e o layout responsivo.

## v0.18.0

- Centralizada a ação “+” em telas pequenas e grandes; links dos módulos equilibrados à esquerda e à direita.
- Corrigido o menu “Adicionar”, que aparecia com botões nativos sem hierarquia visual. Ações agora são cartões adaptáveis com rótulos, descrições e ícones.
- Revisados espaçamentos, estados de toque, foco e cores no tema claro/escuro.

## v0.19.0

- Movido o acesso a Ajustes para o espaço superior direito do cabeçalho.
- Retirado Ajustes da dock; o cabeçalho passa a oferecer o acesso direto ao módulo.
- Reorganizada a dock com cinco colunas de mesma largura, centralizando “+” e uniformizando o espaço entre módulos.

## v0.20.0

- Substituído o símbolo antigo de Ajustes por uma engrenagem vetorial de acabamento metálico, inspirada no app Ajustes do iOS.
- Ajustado o fundo do ícone e seus estados de foco/seleção no cabeçalho.

## v0.21.0

- Cofrinhos podem ser vinculados a bancos e cooperativas cadastrados, com percentual de CDI configurável. Os cofrinhos existentes foram associados ao Banco Inter a 100% do CDI.
- Consulta automática da série diária CDI (SGS 12) do Banco Central, com atualização manual e histórico salvo localmente para uso offline.
- Estimativa de saldo bruto, rendimento acumulado e saldo líquido aproximado após IOF/IR, considerando os aportes e resgates registrados.
- Gerador de relatório imprimível em PDF para compartilhar os dados dos cofrinhos e CDBs.

## v0.22.0

- Insights passou a reunir os motores de previsão de caixa em 30/60/90 dias, reserva de emergência, comparação de quitação de dívida com CDB, cenário de inflação IPCA e monitoramento informativo FGC/FGCoop.
- Incluído saldo de referência configurável para projeções e ajuste da reserva desejada entre 3 e 12 meses.
- Adicionadas visualizações com linha de saldo projetado, barras de reserva e exposição, comparação de custos e série mensal do IPCA.
- As metas mostram o valor nominal aproximado no prazo se o IPCA recente persistir; trata-se de cenário, não previsão.
