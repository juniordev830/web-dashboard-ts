# Guia de manutenção — Dashboard Metrics Utilities

## Escopo confirmado

Utilitário TypeScript de métricas em terminal, sem interface web publicada.

## Arquivos principais

`src/index.ts`, `src/statistics.ts`, `src/trends.ts`, `src/windowed.ts` e testes `src/*.test.ts`.

## Validar uma alteração

No diretório raiz, usar os comandos adequados ao ambiente: `npm ci`, `npm run build`, `npm test` e `npm run dev` (exemplo no terminal).

Registrar o resultado dos testes no PR e conferir se a execução do GitHub Actions corresponde ao commit revisado. Não presumir que a interface ou o serviço é de produção apenas porque o build passou.

## Revisão de casos críticos

Conferir datasets vazios, timestamps inválidos, janelas e tendências com amostras fora de ordem; testar arredondamentos de percentis e valores extremos.

## Limites e próxima entrega

Não chamar de dashboard web até ter interface. Próximo incremento: fixtures versionadas para séries temporais e documentação de contratos de cada função.

### Checklist para PR

- [ ] A mudança está associada a um comportamento identificável.
- [ ] Foram documentados os casos novos e os limites encontrados.
- [ ] Há teste automatizado quando o módulo comporta execução reproduzível.
- [ ] Exemplos não contêm credenciais ou dados reais.
- [ ] A branch pode ser revisada antes de qualquer merge na principal.
