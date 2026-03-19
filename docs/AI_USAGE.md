# Uso de IA — Documentação

## Ferramenta utilizada

- **Cursor IDE** com Claude como assistente de IA (Usei o modelo Opus 4.)
- Utilizado durante todo o processo de desenvolvimento: planejamento, geração de código, revisão e documentação

---

## Como a IA foi utilizada

### Planejamento e Arquitetura
- A IA ajudou a estruturar o plano de implementação com base nos requisitos do desafio técnico
- Propôs a stack tecnológica (Fastify, Prisma, PostgreSQL, React + Vite) com justificativas para cada escolha
- Desenhou o modelo de dados (tabelas `Transaction` e `UserBalance`) e o pipeline de processamento

### Geração de Código
- Gerou o scaffolding do projeto (package.json, tsconfig, Docker, estrutura de pastas)
- Criou o schema Prisma com indexes e constraints apropriados
- Implementou o pipeline de processamento de transações (validação, deduplicação, ordenação, processamento atômico)
- Construiu o frontend React com todas as telas obrigatórias
- Gerou testes unitários e de integração

---

## O que precisou ser corrigido manualmente

### 1. Deduplicação intra-batch ausente
**Problema:** A IA gerou a lógica de deduplicação verificando apenas contra o banco de dados (`findByExternalIds`). Quando o mesmo batch continha duas transações com o mesmo `id`, a primeira era inserida com sucesso, mas a segunda falhava com `UNIQUE constraint violation` no `external_id`, causando erro 500.

**Como foi identificado:** Ao fazer upload do `sample-data.json` (que intencionalmente contém `seed-dep-1` duplicado no mesmo lote), a API retornou 500 com stack trace do Prisma.

**Correção:** Adicionei um `Set<string>` chamado `seenInBatch` no `processBatch()` que rastreia os IDs já encontrados dentro do mesmo lote. A segunda ocorrência é marcada como `duplicate` antes de chegar ao banco.

### 2. Separação de `app.ts` e `server.ts`
**Problema:** A IA gerou um único arquivo `app.ts` que exportava `buildApp()` mas também chamava `start()` no escopo do módulo. Quando os testes de integração importavam `buildApp()`, o `start()` executava automaticamente, tentando abrir a porta 3000. Isso causava `EADDRINUSE` quando o servidor de desenvolvimento já estava rodando, e o `process.exit(1)` dentro do `start()` derrubava o processo de teste.

**Como foi identificado:** Ao rodar `npx vitest run` com o servidor dev ativo, todos os testes de integração falhavam com 500 e mensagem "Engine is not yet connected" — porque o `process.exit(1)` desconectava o Prisma antes dos testes executarem.

**Correção:** Separei em dois arquivos: `app.ts` (apenas `buildApp()` puro, sem side effects) e `server.ts` (entry point que chama `connectDatabase()` + `start()`). Os testes importam apenas `app.ts`.

### 3. Schema Zod com discriminação de tipos
**Problema:** A IA inicialmente usou um único schema flat para todos os tipos de transação. Isso não validava corretamente os campos obrigatórios por tipo — um `deposit` sem `user_id` passava na validação, e um `transfer` sem `from_user_id` também.

**Correção:** Refatorei para usar `z.discriminatedUnion('type', [...])` com schemas separados para `deposit`/`withdraw` (exige `user_id`) e `transfer` (exige `from_user_id` + `to_user_id`).

### 4. Ausência de error handler global nas rotas
**Problema:** A IA não adicionou `try/catch` nos handlers de rota nem um `setErrorHandler` global no Fastify. Qualquer erro inesperado no processamento (ex: falha de conexão com o banco) resultava em uma resposta 500 com corpo cru e sem estrutura JSON, dificultando debug pelo consumidor da API.

**Como foi identificado:** Durante a revisão de código, comparando os requisitos do plano ("falhas permanentes são capturadas, logadas e tratadas") com a implementação, ficou evidente que erros não previstos borbulhavam sem tratamento.

**Correção:** Adicionei:
- `app.setErrorHandler()` global no `buildApp()` que captura qualquer erro, loga com Pino e retorna JSON estruturado `{ error, statusCode, detail }`
- `try/catch` em cada handler de rota com mensagens de erro específicas por contexto

### 5. Teste de 100 transações fora de ordem ausente
**Problema:** O plano de implementação listava explicitamente como cenário-chave: *"100 transações fora de ordem → saldo final correto"*. A IA gerou apenas um teste com 2 transações fora de ordem, que não demonstra robustez com volume.

**Como foi identificado:** Comparação direta entre a seção "Cenários-chave para testar" do plano e os testes existentes.

**Correção:** Adicionei teste de integração com 100 transações (60 depósitos, 30 saques, 10 transferências) embaralhadas aleatoriamente, verificando:
- Todas as 100 são processadas sem erro
- Saldo final do remetente = 6000 - 300 - 500 = R$ 5.200
- Saldo final do destinatário = R$ 500

### 6. Dependências não utilizadas no `package.json`
**Problema:** A IA incluiu `@fastify/multipart`, `supertest` e `@types/supertest` no `package.json`, mas nenhum deles é usado no código. O upload de arquivos é feito inteiramente no frontend (via `FileReader`), e os testes de integração usam `app.inject()` do Fastify em vez do Supertest.

**Como foi identificado:** Busca por imports de `@fastify/multipart` e `supertest` no código-fonte — nenhum resultado.

**Correção:** Removidos os três pacotes do `package.json` e executado `npm install` para atualizar o `node_modules`.

---

## Exemplo concreto de erro da IA

**Erro:** A IA gerou uma função `withRetry` que fazia retry em **todos** os erros, incluindo erros permanentes como violação de unique constraint. Isso faria o sistema tentar inserir uma transação duplicada 3 vezes antes de falhar — desperdício de recursos e delay desnecessário.

**Como foi identificado:** Durante a revisão da lógica de retry, observei que não havia distinção entre erros transitórios (deadlock, connection refused) e permanentes (unique constraint, validação). Um `UNIQUE constraint violated` nunca vai ter sucesso na segunda tentativa — o retry é inútil.

**Correção:** Criei a função `isTransientError()` que inspeciona a mensagem de erro buscando palavras-chave como `"deadlock"`, `"connection"`, `"ECONNREFUSED"` e `"serialization failure"`. Apenas esses erros transitórios ativam o retry com backoff exponencial. Erros permanentes falham imediatamente na primeira tentativa, sem retry.

```typescript
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('deadlock') ||
      message.includes('lock timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('serialization failure')
    );
  }
  return false;
}
```

Essa distinção é comprovada nos testes unitários do `retry.test.ts`, que verificam que erros transitórios são retentados (e eventualmente têm sucesso) enquanto erros permanentes como `"unique constraint violated"` falham na primeira chamada sem retry.
