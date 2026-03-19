# Inside — Processador de Transações Financeiras

Aplicação que processa transações financeiras (depósito, saque, transferência) com resiliência, idempotência e uma interface gráfica para visualização dos dados processados.

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Linguagem | Node.js + TypeScript |
| API | Fastify 5 |
| Banco de Dados | PostgreSQL 16 |
| ORM | Prisma 6 |
| Frontend | React 19 + Vite 6 |
| Testes | Vitest |
| Logs | Pino (estruturado) |
| Containerização | Docker + Docker Compose |

## Como Executar

### Pré-requisitos

- Docker & Docker Compose
- Node.js 22+ (para desenvolvimento local)

### Com Docker (recomendado)

```bash
docker compose up --build
```

A aplicação estará disponível em **http://localhost:3000**.

### Localmente

1. Iniciar o PostgreSQL:

```bash
docker compose up postgres -d
```

2. Instalar dependências:

```bash
npm install
cd frontend && npm install && cd ..
```

3. Executar as migrations do banco:

```bash
npx prisma migrate dev
```

4. Iniciar a API:

```bash
npm run dev
```

5. Iniciar o frontend (em outro terminal):

```bash
cd frontend && npm run dev
```

- API: http://localhost:3000
- Frontend dev: http://localhost:5173

## Deploy Gratuito (Render + Neon)

A aplicação pode ser publicada gratuitamente usando **Render** (API + frontend) e **Neon** (PostgreSQL serverless).

### 1. Criar o banco de dados no Neon

1. Acesse [neon.tech](https://neon.tech) e crie uma conta gratuita.
2. Crie um novo projeto (ex: `inside-transactions`).
3. Copie a **connection string** fornecida. Ela terá o formato:

```
postgresql://neondb_owner:senha@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

### 2. Publicar no Render

1. Faça push do repositório para o GitHub.
2. Acesse [render.com](https://render.com) e crie uma conta gratuita.
3. Clique em **New > Web Service** e conecte o repositório GitHub.
4. O Render detectará o `render.yaml` automaticamente. Confirme as configurações:
   - **Build Command**: `npm install && cd frontend && npm install && npm run build && cd .. && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npm start`
5. Em **Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Connection string do Neon (passo anterior) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `LOG_LEVEL` | `info` |

6. Clique em **Create Web Service** e aguarde o deploy.

### Limitações do plano gratuito

| Serviço | Limite |
|---|---|
| Render Free | Dorme após 15min de inatividade; ~750h/mês |
| Neon Free | 0.5 GB de armazenamento; 190h de compute/mês |

Ambos são suficientes para demonstração e avaliação técnica.

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/transactions/batch` | Ingere e processa um lote de transações |
| GET | `/users` | Lista usuários com saldos |
| GET | `/users/:id/balance` | Retorna o saldo de um usuário |
| GET | `/users/:id/transactions` | Histórico de transações de um usuário |
| GET | `/transactions/invalid` | Lista transações inválidas/duplicadas |
| GET | `/transactions/summary` | Resumo agregado por tipo |
| GET | `/health` | Health check |

## Formato de Entrada das Transações

```json
{
  "transactions": [
    { "id": "tx-1", "type": "deposit", "amount": 100, "timestamp": "2026-01-01T10:00:00Z", "user_id": "user-1" },
    { "id": "tx-2", "type": "withdraw", "amount": 50, "timestamp": "2026-01-01T11:00:00Z", "user_id": "user-1" },
    { "id": "tx-3", "type": "transfer", "amount": 30, "timestamp": "2026-01-01T12:00:00Z", "from_user_id": "user-1", "to_user_id": "user-2" }
  ]
}
```

Upload de CSV também é suportado via interface web.

## Arquitetura e Decisões Técnicas

### Modelo de Dados

- Tabela **Transaction** armazena toda transação (válida, inválida ou duplicada) com `external_id` como chave de idempotência (UNIQUE constraint).
- Tabela **UserBalance** mantém saldos pré-computados, atualizados atomicamente dentro de transações SQL — evita recalcular a partir do histórico completo a cada consulta.

### Pipeline de Processamento

1. **Ingestão** — recebe lote via JSON ou CSV
2. **Validação** — validação de schema por tipo via Zod + regras de negócio (amount > 0, sem auto-transferência)
3. **Deduplicação** — busca por `external_id` nos registros existentes + deduplicação intra-batch
4. **Ordenação** — transações válidas ordenadas por `timestamp` ASC antes do processamento
5. **Processamento** — transação SQL atômica atualiza saldos e registra resultados
6. **Auditoria** — toda transação é salva com status + motivo do erro para rastreabilidade

### Resiliência

- **Retry com backoff exponencial** para erros transitórios do banco (deadlocks, falhas de conexão)
- Número máximo de tentativas e delay base configuráveis via variáveis de ambiente
- Erros permanentes falham imediatamente, sem retry

### Idempotência

- Campo `external_id` com UNIQUE constraint no banco
- Verificação prévia antes do processamento + `skipDuplicates` em inserções em massa
- Duplicatas são registradas com `status = duplicate` para auditoria

### Observabilidade

- Logs JSON estruturados via Pino (ciclo de vida request/response, eventos de processamento, erros)
- Toda transação processada ou rejeitada gera um registro de auditoria
- Endpoint de health check para monitoramento

## Testes Automatizados

```bash
# Testes unitários e de integração
npm test

# Com cobertura
npm run test:coverage
```

Testes unitários cobrem lógica de validação, ordenação e mecanismo de retry.
Testes de integração cobrem o ciclo completo da API (processamento em lote, detecção de duplicatas, saldo insuficiente, 100 transações fora de ordem com verificação de saldo final).

## Testando via Interface

A pasta `samples/` contém arquivos prontos para testar o fluxo completo via upload na interface web.

### Como testar

1. Acesse **http://localhost:3000** (ou http://localhost:5173 em modo dev)
2. Na aba **Upload**, clique em "Choose file..."
3. Selecione `samples/transactions.json` ou `samples/transactions.csv`
4. Clique em **Upload & Process**
5. Confira o resultado na tela (processadas, inválidas, duplicatas)
6. Navegue para as abas **Users**, **Summary** e **Invalid** para verificar os dados

### `samples/transactions.json`

Lote com 12 transações (3 usuários: alice, bob, charlie):
- 4 depósitos válidos
- 2 saques válidos
- 2 transferências válidas
- 1 depósito com valor negativo (inválida)
- 1 auto-transferência (inválida)
- 1 saque com saldo insuficiente (inválida)
- 1 transação duplicada (mesmo id que dep-001)

**Resultado esperado:** 8 processadas, 3 inválidas, 1 duplicata.

**Saldos finais esperados:**

| Usuário | Saldo |
|---------|-------|
| alice   | 1.700 |
| bob     | 550   |
| charlie | 1.700 |

### `samples/transactions.csv`

Lote com 10 transações (3 usuários: diana, eve, frank):
- 3 depósitos válidos
- 2 saques válidos
- 2 transferências válidas
- 1 depósito com valor negativo (inválida)
- 1 auto-transferência (inválida)
- 1 transação duplicada (mesmo id que dep-101)

**Resultado esperado:** 7 processadas, 2 inválidas, 1 duplicata.

**Saldos finais esperados:**

| Usuário | Saldo |
|---------|-------|
| diana   | 550   |
| eve     | 700   |
| frank   | 700   |

Os arquivos incluem propositalmente cenários de erro para demonstrar o tratamento: valor negativo, auto-transferência, saldo insuficiente e transação duplicada.

## Estrutura do Projeto

```
├── src/
│   ├── modules/
│   │   ├── transactions/    # schema, validator, processor, repository, routes
│   │   └── users/           # repository, routes
│   ├── infra/
│   │   ├── database/        # Cliente Prisma
│   │   ├── logger.ts        # Configuração Pino
│   │   └── retry.ts         # Backoff exponencial
│   ├── app.ts               # Setup Fastify
│   └── server.ts            # Entry point
├── frontend/                # React + Vite SPA
├── prisma/                  # Schema + migrations
├── tests/
│   ├── unit/                # Testes de validação + retry
│   └── integration/         # Testes de endpoints da API
├── samples/                 # Arquivos de teste (JSON + CSV)
├── docs/
│   └── decisions.md         # Decisões técnicas detalhadas
├── docker-compose.yml
├── Dockerfile
├── render.yaml              # Blueprint para deploy no Render
├── .node-version            # Versão do Node para o Render
├── AI_USAGE.md
└── README.md
```
