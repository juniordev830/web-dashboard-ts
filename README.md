# Dashboard Metrics Utilities



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

## Estrutura

```text
.
├── src/
├── jest.config.js
├── package.json
├── package-lock.json
└── README.md
```

A implementação em `src/` é a fonte da verdade para os recursos disponíveis. O README evita prometer telas, integrações ou bibliotecas que não estejam no código e nas dependências atuais.

## Fluxo recomendado

1. Crie uma alteração pequena.
2. Execute `npm run build`.
3. Execute `npm test`.
4. Atualize a documentação quando comandos ou comportamentos mudarem.

## Próximas melhorias

- Adicionar lint e formatação automática.
- Configurar CI para build e testes.
- Documentar os módulos exportados e adicionar testes para os casos de erro.

Projeto de portfólio em evolução.


> Escopo atual: biblioteca/utilitário TypeScript de linha de comando para formatar e resumir métricas; ainda não inclui uma interface web.
