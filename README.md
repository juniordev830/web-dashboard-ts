# Dashboard Metrics Utilities (TypeScript)

Biblioteca/utilitário TypeScript de linha de comando para formatar e resumir métricas e **analisar tendências temporais por métrica**. O projeto ainda não inclui uma interface web, API ou coleta de telemetria real.

## Tecnologias

- TypeScript e Node.js
- Jest / ts-jest para testes
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

Agrupa valores por unidade, conta as métricas e retorna `healthStatus` conforme os estados `optimal`, `warning` e `critical`. Valores inválidos e overflow são rejeitados com `RangeError`. A agregação usa `Map`, inclusive para chaves especiais como `__proto__` e `constructor`.

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
npm test -- --runInBand
```

A suíte cobre sumários, unidades com nomes especiais, valores não finitos, overflow, séries fora de ordem, métricas isoladas, baseline zero, timestamps e concorrência de identificadores. O workflow em `.github/workflows/ci.yml` executa `npm ci`, auditoria de dependências, build e testes em mudanças direcionadas à `main`.

## Organização

```text
src/
  index.ts             # Modelo de métricas, resumo e demonstração CLI
  index.test.ts        # Testes do resumo
  trends.ts            # Análise temporal pura
  trends.test.ts       # Testes de tendências
```

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

**Limitações:** não existem notificações, persistência nem coletas em tempo real; valores e limites são fictícios e precisam ser escolhidos conforme cada aplicação. Testes Jest validam condições de fronteira, dados ausentes, valores inválidos e imutabilidade.
