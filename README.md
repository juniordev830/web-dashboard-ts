# Dashboard Metrics Utilities (TypeScript)

**Navegação** · [Tecnologias](#tecnologias) · [Instalação e comandos](#instalação-e-comandos) · [Funções disponíveis](#funções-disponíveis) · [Código e estudo](docs/ENGENHARIA_REVERSA.md)

Biblioteca/utilitário TypeScript de linha de comando para formatar e resumir métricas e **analisar tendências temporais por métrica**. O projeto ainda não inclui uma interface web, API ou coleta de telemetria real.

## Tecnologias

- TypeScript e Node.js
- Executor de testes nativo do Node.js
- TypeScript Compiler para validação/build
- Sem dependências adicionais para análise de tendências

## Instalação e comandos

Requer Node.js compatível com as dependências do projeto e npm.

```bash
npm ci
npm run build
npm test
npm run dev
```

O comando `dev` imprime um exemplo local de resumo de métricas. Não inicia servidor.

## Funções disponíveis

### `summarizeMetricDistributions(observations)`

Gera um resumo estatístico por métrica: quantidade de observações, mínimo, máximo, média, mediana e percentil 95 (**p95**). Aceita observações sem timestamp, agrupa pelo identificador e **não altera** os dados fornecidos.

```ts
import { summarizeMetricDistributions } from './src/index';

const distributions = summarizeMetricDistributions([
  { metricId: 'latency', value: 100 },
  { metricId: 'latency', value: 200 },
  { metricId: 'latency', value: 300 }
]);
// [{ metricId: 'latency', sampleCount: 3, min: 100,
//    max: 300, mean: 200, median: 200, p95: 290 }]
```

Os percentis usam interpolação linear na posição `(n - 1) * p` e não representam limites de SLA por si mesmos. IDs vazios e valores não numéricos ou não finitos são rejeitados. Amostras de um mesmo ID podem repetir valores; os dados de entrada permanecem intactos. A média utiliza cálculo incremental para evitar estouro de somas intermediárias.



### `calculateSummary(metrics)`

Agrupa valores por unidade, conta as métricas e retorna `healthStatus` como `HEALTHY`, `WARNING` ou `CRITICAL`, a partir dos estados de entrada `optimal`, `warning` e `critical`. IDs vazios, métricas malformadas, unidades ausentes, valores não numéricos e overflow são rejeitados com `RangeError`; coleções que não sejam arrays geram `TypeError`. A validação também se aplica a `calculateHealthScore(metrics)`. A agregação usa `Map`, inclusive para chaves especiais como `__proto__` e `constructor`.

### `calculateMetricTrends(samples)`

Compara o valor mais antigo com o mais recente em cada `metricId`, independentemente da ordem dos dados recebidos. Exige **timestamps UTC ISO 8601 canônicos**, com milissegundos, para evitar interpretações ambíguas.

```ts
import { calculateMetricTrends } from './src/trends';

const trends = calculateMetricTrends([
  { metricId: 'latency', timestamp: '2026-11-02T10:01:00.000Z', value: 150 },
  { metricId: 'latency', timestamp: '2026-11-02T10:00:00.000Z', value: 100 },
]);

console.log(trends[0]);
// { metricId: 'latency', sampleCount: 2,
//   firstTimestamp: '2026-11-02T10:00:00.000Z',
//   lastTimestamp: '2026-11-02T10:01:00.000Z',
//   firstValue: 100, lastValue: 150,
//   absoluteChange: 50, percentageChange: 50, direction: 'up' }
```

**Regras e limites:**

- Mantém os dados de entrada intactos; resultados são ordenados por ID.
- Ignora métricas com uma única amostra porque não permitem comparação.
- Rejeita IDs vazios, timestamps inválidos, valores não finitos, timestamps duplicados por métrica e overflow aritmético.
- Uma primeira observação igual a zero produz `percentageChange: null` (não infinito).
- Usa o valor absoluto da primeira observação como base da porcentagem; valores negativos são aceitos.
- A direção `up` ou `down` não significa necessariamente melhora ou piora — isso depende do tipo de métrica.
- Faz comparação simples de extremos observados, **não** previsão, média móvel, detecção de anomalias ou análise sazonal.

## Testes e CI

```bash
npm run build
npm test
```

A suíte cobre sumários, unidades com nomes especiais, valores não finitos, overflow, séries fora de ordem, métricas isoladas, baseline zero, timestamps e concorrência de identificadores. O workflow em `.github/workflows/ci.yml` executa `npm ci`, auditoria de dependências, build e testes em mudanças direcionadas à `main`.

## Organização

```text
src/
  index.ts             # Modelo de métricas, resumo e demonstração CLI
  index.test.ts        # Testes do resumo
  trends.ts            # Análise temporal pura
  trends.test.ts       # Testes de tendências
  statistics.ts        # Estatísticas descritivas
  statistics.test.ts   # Testes de estatísticas
  alerts.ts            # Avaliação de regras de alerta
  alerts.test.ts       # Testes de alertas
  windowed.ts          # Agregação temporal UTC
  windowed.test.ts     # Testes de janelas
```

## Pontuação de saúde e consumo da biblioteca

`calculateHealthScore(metrics)` começa em 100 e subtrai a penalidade média por métrica: 15 pontos por estado de aviso e 50 por estado crítico. O resultado é arredondado e limitado inferiormente a zero. Uma lista vazia retorna 100 por convenção; isso não comprova disponibilidade de um serviço.

Exemplo: três métricas, uma em aviso e duas ótimas, produzem pontuação 95 e estado global `WARNING`. O estado global prioriza qualquer crítico sobre qualquer aviso, independentemente da pontuação.

Após `npm run build`, o ponto de entrada definido no pacote é `dist/index.js`. As funções de tendências e alertas ficam nos respectivos módulos; estatísticas e janelas UTC também são exportadas por `src/index.ts`. O comando `npm test` já compila o projeto antes de executar os testes. A pontuação não substitui SLA, SLO ou monitoramento de disponibilidade.

## Evolução planejada

- Adicionar uma interface web responsiva e gráficos.
- Integrar a coleta com uma API real, com autenticação e limites de uso.
- Adicionar agregação por janelas temporais e visualização de tendências.
- Medir cobertura e integrar lint ao CI.

Projeto de Engenharia de Software em evolução, mantido na conta [juniordev830](https://github.com/juniordev830).


## Alertas por limites configuráveis

O módulo `src/alerts.ts` adiciona regras de monitoramento de métricas sem fazer chamadas de rede nem alterar o estado de entrada. Uma regra pode alertar quando o valor ultrapassa um limite (`above`) ou cai abaixo dele (`below`). Os limites de aviso e crítico são inclusivos, com validação de ordem, valores finitos e IDs duplicados.

```ts
import { evaluateMetricAlerts } from './src/alerts';

const report = evaluateMetricAlerts(
  [{ id: 'latency', title: 'API latency', value: 340, unit: 'ms', status: 'warning' }],
  [{ metricId: 'latency', direction: 'above', warning: 200, critical: 500 }]
);
console.log(report.alerts[0].level); // warning
```

Se houver uma regra para uma métrica sem observação, a situação será **`missing`**, nunca `ok`. O retorno inclui contadores de regras `ok`, `warning`, `critical` e `missing`. Execute `npm run dev` para ver um exemplo.

**Limitações:** não existem notificações, persistência nem coletas em tempo real; valores e limites são fictícios e precisam ser escolhidos conforme cada aplicação. Os testes validam condições de fronteira, dados ausentes, valores inválidos e imutabilidade.

## Agregação por janelas de tempo UTC

A função `bucketMetricSamples(samples, windowMinutes)`, exportada por `src/index.ts`, agrupa amostras por métrica em janelas UTC alinhadas de **1 a 1440 minutos** (padrão de 60). Cada janela começa em um múltiplo do intervalo contado a partir de **00:00 UTC do próprio dia**. Quando o intervalo não divide 24 horas (como 7 minutos), a última janela do dia é mais curta e não mistura amostras com o dia seguinte. Para cada janela o resultado fornece início ISO, quantidade, mínimo, máximo e média, sem alterar os dados de entrada. Amostras com timestamp duplicado na mesma métrica são rejeitadas. Limite de 100 mil observações por chamada.

```ts
import { bucketMetricSamples } from './src/index';
const janelas = bucketMetricSamples([
  { metricId: 'latency', timestamp: '2026-11-09T10:00:00.000Z', value: 150 },
  { metricId: 'latency', timestamp: '2026-11-09T10:20:00.000Z', value: 250 }
], 60); // uma janela com media 200
```

É uma agregação estatística local, não um pipeline de telemetria ao vivo.

## Validação e manutenção

Para revisar alterações neste projeto, consulte o [guia técnico de validação](docs/GUIA_DE_VALIDACAO.md), com comandos, cenários de regressão e próximos incrementos.

## Código e roteiro de estudo

Quando uma janela vazia deve representar ausência de dados em vez de zero? O [guia de engenharia reversa](docs/ENGENHARIA_REVERSA.md) reúne o mapa dos módulos e uma pergunta técnica baseada no projeto.
