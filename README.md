# Dashboard Metrics Utilities

Biblioteca/utilitário TypeScript de linha de comando para formatar e resumir métricas. **O projeto ainda não inclui uma interface web.**

## Tecnologias

- TypeScript
- Node.js
- ts-node para execução durante desenvolvimento
- Jest e ts-jest para testes
- TypeScript Compiler para validação/build

## Requisitos

- Node.js compatível com as dependências instaladas
- npm

## Instalação

```bash
npm install
```

## Comandos

```bash
# Executar a entrada de desenvolvimento definida no package.json
npm run dev

# Compilar TypeScript
npm run build

# Executar testes
npm test
```

## Integração contínua

O GitHub Actions executa `npm ci`, `npm run build` e `npm test` em pushes para `main` e em pull requests direcionados à `main`. O workflow está em `.github/workflows/ci.yml`.

## Estrutura

```text
.
├── src/
├── .github/workflows/ci.yml
├── jest.config.js
├── package.json
├── package-lock.json
└── README.md
```

A implementação em `src/` é a fonte da verdade para os recursos disponíveis. A documentação não promete telas, integrações ou bibliotecas que não estejam no código e nas dependências atuais.

## Fluxo recomendado

1. Crie uma alteração pequena.
2. Execute `npm run build`.
3. Execute `npm test`.
4. Atualize a documentação quando comandos ou comportamentos mudarem.

## Segurança da agregação

`calculateSummary(metrics)` aceita nomes de unidade como `USD`, `ms`,
`toString`, `constructor` e `__proto__` sem colisões com propriedades
herdadas de objetos JavaScript. Internamente a agregação usa `Map` e devolve
o mesmo contrato anterior: `totalsByUnit` é um objeto comum com as unidades
como chaves próprias. Os testes de regressão cobrem nomes especiais, unidades
repetidas, valores não finitos e overflow.

## Próximas melhorias

- Adicionar lint e formatação automática e integrá-los ao CI.
- Medir e acompanhar a cobertura dos testes.
- Documentar os módulos exportados e ampliar testes para casos de erro.

Projeto de portfólio em evolução.
