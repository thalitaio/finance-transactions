# Decisões Técnicas

## 1. Fastify em vez de Express

**Decisão:** Usar Fastify 5 como framework HTTP.

**Motivo:** Fastify oferece performance superior ao Express (benchmarks consistentes), suporte nativo a validação de schemas, sistema de plugins robusto e logging integrado via Pino. O overhead de aprendizado é mínimo para quem já conhece Express.

**Trade-off:** Ecossistema de middlewares menor que o Express, mas para este projeto não foi uma limitação.

---

## 2. PostgreSQL + Prisma (tabela de saldo separada)

**Decisão:** Manter uma tabela `UserBalance` separada, atualizada atomicamente via transação SQL, em vez de recalcular o saldo a partir do histórico completo de transações.

**Motivo:** Recalcular o saldo a cada consulta (`SUM` sobre todas as transações) se torna inviável com volume crescente. A tabela de saldo pré-computado permite leitura O(1) e escrita atômica dentro da mesma transação SQL que processa o lote.

**Trade-off:** Existe um risco de dessincronização se a lógica de atualização do saldo tiver bugs. Mitigado por: (a) tudo dentro de `$transaction` atômica do Prisma, (b) testes de integração que verificam saldo final após 100 transações.

---

## 3. Idempotência via `external_id` + UNIQUE constraint

**Decisão:** Usar o campo `id` da transação de entrada como `external_id` com UNIQUE constraint no banco, além de verificação prévia em memória.

**Motivo:** Dupla proteção: a verificação prévia (`findByExternalIds`) evita processamento desnecessário, e o UNIQUE constraint garante integridade mesmo em condições de concorrência. Duplicatas dentro do mesmo batch também são tratadas via `Set` em memória.

**Trade-off:** A verificação prévia adiciona uma query extra antes do processamento, mas é essencial para performance (evita entrar na transação SQL apenas para falhar).

---

## 4. Ordenação por timestamp antes do processamento

**Decisão:** Ordenar todas as transações válidas por `timestamp ASC` antes de processar o lote.

**Motivo:** Transações podem chegar fora de ordem. Se um saque chega antes do depósito correspondente (mas com timestamp posterior), sem ordenação o saque seria rejeitado por saldo insuficiente incorretamente. A ordenação garante que a sequência de processamento respeita a ordem cronológica real.

**Trade-off:** Apenas relevante dentro de um mesmo batch. Se dois batches separados contêm transações intercaladas, a ordenação é por batch. Para o escopo do desafio, isso é suficiente.

---

## 5. Retry com backoff exponencial (apenas para erros transitórios)

**Decisão:** Implementar retry automático apenas para erros transitórios (deadlock, connection refused, serialization failure). Erros permanentes (unique constraint, validação) falham imediatamente.

**Motivo:** Retry cego em todos os erros desperdiça recursos e pode mascarar bugs. A função `isTransientError` analisa a mensagem de erro para distinguir falhas temporárias de permanentes.

**Trade-off:** A detecção por substring na mensagem de erro é frágil — pode falhar se o Prisma/PostgreSQL mudar as mensagens. Alternativa seria usar códigos de erro do PostgreSQL (ex: `40P01` para deadlock), mas para o escopo atual a abordagem por substring é suficiente.

---

## 6. Logs estruturados com Pino

**Decisão:** Usar Pino como logger com output JSON em produção e `pino-pretty` em desenvolvimento.

**Motivo:** Logs estruturados facilitam parsing por ferramentas de observabilidade (ELK, Datadog, etc). Cada transação processada ou rejeitada gera um log de auditoria com dados relevantes.

**Trade-off:** Logs JSON puros são difíceis de ler sem formatação, por isso `pino-pretty` é usado em desenvolvimento.

---

## 7. React + Vite para o frontend

**Decisão:** Usar React 19 com Vite 6 para a interface gráfica, em vez de HTML+JS puro.

**Motivo:** React permite componentização e gerenciamento de estado (paginação, tabs, loading states) de forma mais organizada. Vite oferece HMR rápido e build otimizado. O frontend é servido como SPA estática pelo próprio Fastify em produção.

**Trade-off:** Adiciona complexidade de build e mais dependências. Para uma interface simples, HTML+JS puro seria suficiente, mas React escala melhor caso novas features sejam adicionadas.

---

## 8. Error handler global + try/catch por rota

**Decisão:** Implementar um `setErrorHandler` global no Fastify que captura qualquer erro não tratado e retorna uma resposta JSON estruturada, além de `try/catch` em cada handler de rota.

**Motivo:** Sem error handler, erros inesperados resultam em respostas 500 com corpo cru ou vazio, dificultando debug e dando uma experiência ruim ao consumidor da API. O try/catch por rota permite mensagens de erro específicas por contexto, enquanto o handler global é a rede de segurança final.

---

## 9. Separação de `app.ts` e `server.ts`

**Decisão:** Separar a construção da aplicação Fastify (`buildApp()` em `app.ts`) da inicialização do servidor (`start()` em `server.ts`).

**Motivo:** Permite que os testes de integração importem `buildApp()` e usem `app.inject()` sem iniciar o servidor HTTP real (sem abrir porta, sem conflito de porta). O `server.ts` é o entry point que conecta ao banco e faz `listen`.

**Trade-off:** Nenhum significativo — é uma prática padrão em projetos Fastify.
