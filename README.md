# Dashboard Metrics Utilities (TypeScript)

Biblioteca/utilitário TypeScript de linha de comando para formatar e resumir métricas e **analisar tendências e agregar amostras por dia UTC**. O projeto ainda não inclui uma interface web, API ou coleta de telemetria real.

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

### `summarizeDailyMetrics(samples)`

Agrupa observações pelo par **métrica + data UTC**, devolvendo contagem, menor valor, maior valor e média aritmética para cada dia. A implementação usa atualização incremental da média para evitar a soma direta de números extremos; não altera a entrada. Os resultados são ordenados por data, depois pelo ID da métrica.

```ts
import { summarizeDailyMetrics } from './src/trends';

const daily = summarizeDailyMetrics([
  { metricId: 'latency', timestamp: '2026-11-02T10:00:00.000Z', value: 10 },
  { metricId: 'latency', timestamp: '2026-11-02T11:00:00.000Z', value: 30 },
]);
// [{ metricId: 'latency', date: '2026-11-02', count: 2,
//    minimum: 10, maximum: 30, average: 20 }]
```

Regras: timestamp UTC canônico com milissegundos; valores finitos; ID não vazio; nenhum timestamp repetido para a mesma métrica. As datas são agrupadas em UTC, sem converter para o fuso local. Não representa média ponderada por duração ou coleta de dados em tempo real.

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
  trends.ts            # Análise temporal e resumos diários
  trends.test.ts       # Testes de tendências e agrupamentos
```

## Evolução planejada

- Adicionar uma interface web responsiva e gráficos.
- Integrar a coleta com uma API real, com autenticação e limites de uso.
- [x] Agregação por dia UTC (mínimo, máximo, contagem e média) no núcleo TypeScript.
- [ ] Adicionar agregação por janelas configuráveis e visualização de tendências.
- Medir cobertura e integrar lint ao CI.

Projeto de Engenharia de Software em evolução, mantido na conta [juniordev830](https://github.com/juniordev830).
