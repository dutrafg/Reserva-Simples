# Histórico de alterações

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
