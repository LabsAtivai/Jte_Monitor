# JTe Monitor

Plataforma SaaS para monitorar processos trabalhistas sem polo passivo — TRT-2 São Paulo (Zonas Central, Norte e Oeste).

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Estrutura do projeto](#3-estrutura-do-projeto)
4. [Banco de dados](#4-banco-de-dados)
5. [Redis](#5-redis)
6. [Backend (API)](#6-backend-api)
7. [Worker paralelo](#7-worker-paralelo)
8. [Frontend](#8-frontend)
9. [Nginx + HTTPS](#9-nginx--https)
10. [Cron de produção](#10-cron-de-produção)
11. [Tiers free e premium](#11-tiers-free-e-premium)
12. [Referência de endpoints](#12-referência-de-endpoints)
13. [Variáveis de ambiente](#13-variáveis-de-ambiente)
14. [Comandos úteis](#14-comandos-úteis)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Visão geral

```
JTe TRT-2 (fonte pública)
        │
        ▼
  Scraper Playwright ──► Fila Redis (BullMQ) ──► 4 Workers paralelos
                                                        │
                                                        ▼
                                                   MySQL (processos)
                                                        │
                                         ┌──────────────┴─────────────┐
                                         ▼                            ▼
                                    API NestJS                  Alertas e-mail
                                    (porta 4000)                (tier premium)
                                         │
                                         ▼
                                  Frontend Next.js
                                    (porta 3000)
```

**Fluxo diário:**
1. Cron dispara o worker às 06h (seg–sex)
2. Worker lista todas as varas e gera jobs vara+data para os próximos 6 meses
3. 4 workers paralelos processam em ~30–40 min (vs. horas em sequencial)
4. Sistema verifica alertas premium e envia e-mails automaticamente

---

## 2. Pré-requisitos

**Servidor recomendado:** Ubuntu 22.04 ou Debian 12, 2 GB RAM mínimo (4 GB ideal para workers).

### Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
node -v    # v20.x
npm -v     # 10.x
```

### MySQL 8.0

```bash
# Via Docker (recomendado — mais simples)
docker run -d \
  --name jte-mysql \
  --restart unless-stopped \
  -e MYSQL_ROOT_PASSWORD=rootsecret \
  -p 127.0.0.1:3306:3306 \
  -v jte_mysql_data:/var/lib/mysql \
  mysql:8.0 --character-set-server=utf8mb4

# Ou instalação direta
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
```

### Docker (opcional, mas facilita muito)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # permite rodar sem sudo
```

---

## 3. Estrutura do projeto

```
jte-monitor/
├── database/
│   ├── 000_init.sql          ← cria banco + usuários MySQL (root)
│   ├── 001_users.sql         ← users + refresh_tokens
│   ├── 002_processos.sql     ← processos_sem_polo_passivo + execucoes
│   └── 003_alertas.sql       ← alertas + notificacoes
├── backend/
│   ├── src/
│   │   ├── main.ts                      ← bootstrap NestJS porta 4000
│   │   ├── app.module.ts                ← módulo raiz
│   │   ├── auth/auth.service.ts         ← login, register, JWT, refresh, logout
│   │   ├── auth/auth.controller.ts      ← POST /api/auth/*
│   │   ├── users/users.service.ts       ← CRUD usuários + tier
│   │   ├── processos/processos.controller.ts  ← GET /api/processos
│   │   ├── alertas/alertas.controller.ts      ← GET|POST|DELETE /api/alertas
│   │   └── common/
│   │       ├── db.service.ts            ← pool MySQL singleton
│   │       └── guards/index.ts          ← JwtAuthGuard, TierGuard, CurrentUser
│   ├── worker/index.js        ← worker BullMQ + Playwright paralelo
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/lib/auth.js        ← AuthContext (login, logout, authFetch, tier)
│   └── src/app/
│       ├── layout.js          ← AuthProvider global
│       ├── page.js            ← redirect → /dashboard
│       ├── login/page.js      ← login + registro
│       ├── dashboard/page.js  ← painel com filtros, tabela, alertas premium
│       └── upgrade/page.js    ← comparação de planos
├── migrate.js                 ← roda migrations 001→003 em ordem
└── README.md
```

---

## 4. Banco de dados

### Passo 1 — Editar as senhas antes de criar

Abra `database/000_init.sql` e troque:
- `TROQUE_AQUI` → senha do usuário `jte` (use no `.env` como `DB_PASS`)
- `TROQUE_RO_AQUI` → senha do usuário `jte_ro` (opcional, para consultas externas)

### Passo 2 — Criar banco e usuários (execute como root)

```bash
# Se MySQL está no Docker
docker exec -i jte-mysql mysql -u root -prootsecret < database/000_init.sql

# Se MySQL está instalado diretamente
mysql -u root -p < database/000_init.sql
```

### Passo 3 — Configurar o .env do backend

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Preencha pelo menos:
- `DB_PASS` — a senha que você colocou no `000_init.sql`
- `JWT_SECRET` — gere com: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — para envio de e-mails

### Passo 4 — Rodar as migrations

```bash
# Na raiz do projeto (não dentro de /backend)
node migrate.js
```

Saída esperada:
```
🗄️  Rodando 3 migration(s)...
  ✅ 001_users.sql
  ✅ 002_processos.sql
  ✅ 003_alertas.sql
✅ Migrations concluídas!
```

### Tabelas criadas

| Tabela | Descrição |
|---|---|
| `users` | Usuários com tier (free / premium / admin) |
| `refresh_tokens` | Tokens de refresh JWT rotativos |
| `processos_sem_polo_passivo` | Processos coletados pelo scraper |
| `execucoes` | Log de cada run do worker |
| `alertas` | Filtros salvos por usuários premium |
| `notificacoes` | Histórico de e-mails (evita reenvio) |

---

## 5. Redis

Necessário para a fila BullMQ do worker paralelo.

```bash
docker run -d \
  --name jte-redis \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine

# Verificar
redis-cli ping
# Resposta: PONG
```

Sem Docker:
```bash
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping
```

---

## 6. Backend (API)

### Instalar dependências e compilar

```bash
cd backend
npm install
npm run build
```

Os arquivos compilados ficam em `backend/dist/`.

### Iniciar

```bash
# Produção
npm start

# Desenvolvimento (hot-reload, sem build)
npm run dev
```

Teste rápido (sem autenticação):
```bash
curl http://localhost:4000/api/processos/stats
# {"total":0,"totalVaras":0,"dataMin":null,"dataMax":null,"ultimaExecucao":null}
```

### Instalar como serviço systemd

```bash
sudo nano /etc/systemd/system/jte-api.service
```

```ini
[Unit]
Description=JTe Monitor — API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/jte-monitor/backend
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/jte-monitor/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now jte-api
sudo systemctl status jte-api
```

---

## 7. Worker paralelo

### Passo 1 — Instalar Playwright (uma vez por servidor)

```bash
cd backend
npx playwright install chromium --with-deps
```

Instala o Chromium e dependências de sistema (~300 MB). Pode demorar alguns minutos.

### Passo 2 — Teste com poucas varas

Antes da carga completa, teste com 2 varas e 1 mês para confirmar que está funcionando:

```bash
cd backend
CONCURRENCY=2 MESES=1 node worker/index.js
```

Saída esperada:
```
🚀 Worker JTe | concorrência: 2 | meses: 1
✅ MySQL
📦 Listando varas...
   52 varas × 22 dias = 1144 jobs  (só 2 varas serão processadas com CONCURRENCY=2)
   17/05/2026 → 17/06/2026

   1144/1144
✅ 45s | 312 processos | 0 erros
```

Se aparecerem processos no banco, tudo certo:
```bash
mysql -u jte -p jte -e "SELECT COUNT(*) FROM processos_sem_polo_passivo;"
```

### Passo 3 — Carga inicial completa (6 meses)

Use `screen` ou `tmux` para não perder se a SSH cair:

```bash
screen -S carga-jte

cd /opt/jte-monitor/backend
node worker/index.js
# Leva ~30–40 minutos com CONCURRENCY=4

# Ctrl+A, D  → desanexar (continua rodando em background)
# screen -r carga-jte  → reconectar
```

### Modos disponíveis

```bash
# Completo: lista varas → enfileira → processa
node worker/index.js

# Só enfileirar (debug)
node worker/index.js --only-queue

# Só processar fila existente
node worker/index.js --only-work

# Ajustar via env
CONCURRENCY=6 MESES=3 node worker/index.js
```

---

## 8. Frontend

### Configurar

```bash
cd frontend
cp .env.local.example .env.local
nano .env.local
```

```env
# Localhost para desenvolvimento
NEXT_PUBLIC_API_URL=http://localhost:4000

# Produção (mesma origem — Nginx faz o proxy)
NEXT_PUBLIC_API_URL=https://seudominio.com.br
```

### Buildar e iniciar

```bash
npm install
npm run build
npm start    # porta 3000
```

Acesse `http://localhost:3000` → redireciona para `/login` → crie uma conta → faça login.

### Instalar como serviço systemd

```bash
sudo nano /etc/systemd/system/jte-frontend.service
```

```ini
[Unit]
Description=JTe Monitor — Frontend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/jte-monitor/frontend
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=5
Environment=PORT=3000
Environment=NODE_ENV=production
EnvironmentFile=/opt/jte-monitor/frontend/.env.local

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now jte-frontend
```

---

## 9. Nginx + HTTPS

### Instalar Nginx

```bash
sudo apt install -y nginx
```

### Configurar proxy reverso

```bash
sudo nano /etc/nginx/sites-available/jte-monitor
```

```nginx
server {
    listen 80;
    server_name seudominio.com.br;

    # Frontend
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade       $http_upgrade;
        proxy_set_header   Connection    "upgrade";
        proxy_set_header   Host          $host;
        proxy_set_header   X-Real-IP     $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # API (cookies precisam de proxy_set_header Cookie)
    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host      $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   Cookie    $http_cookie;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/jte-monitor /etc/nginx/sites-enabled/
sudo nginx -t                   # verifica sintaxe
sudo systemctl reload nginx
```

### HTTPS gratuito (Let's Encrypt)

Seu domínio precisa já estar apontando para o IP do servidor.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br

# Testar renovação automática
sudo certbot renew --dry-run
```

Após o HTTPS, atualize no `.env` da API:
```env
FRONTEND_URL=https://seudominio.com.br
```

E no `.env.local` do frontend:
```env
NEXT_PUBLIC_API_URL=https://seudominio.com.br
```

Rebuild e restart:
```bash
cd backend  && npm run build && sudo systemctl restart jte-api
cd frontend && npm run build && sudo systemctl restart jte-frontend
```

---

## 10. Cron de produção

```bash
mkdir -p /var/log/jte
crontab -e
```

Adicione:
```cron
# Worker JTe: seg–sex às 06h
0 6 * * 1-5 cd /opt/jte-monitor/backend && node worker/index.js >> /var/log/jte/worker.log 2>&1
```

Verifique:
```bash
crontab -l                          # lista os crons
tail -f /var/log/jte/worker.log     # acompanha o log em tempo real
```

---

## 11. Tiers free e premium

### Estado atual

Todos os usuários autenticados veem todos os processos. O tier `free` não tem restrição de quantidade agora — só faltam os recursos exclusivos premium (alertas e filtros salvos).

### Diferenças de tier

| Recurso | Free | Premium |
|---|---|---|
| Ver processos | ✅ Todos | ✅ Todos |
| Filtros por vara, data, número, reclamada | ✅ | ✅ |
| Paginação | ✅ | ✅ |
| Alertas por e-mail | ❌ | ✅ |
| Filtros salvos | ❌ | ✅ |

### Promover usuário para premium

```bash
mysql -u jte -p jte
```

```sql
UPDATE users SET tier = 'premium' WHERE email = 'usuario@email.com';
SELECT id, nome, email, tier FROM users;
```

### Ativar limite de quantidade para free (quando quiser)

Edite `backend/src/processos/processos.controller.ts`, linha 7:

```typescript
// De (sem limite):
const FREE_LIMIT = 999999;

// Para (5 processos):
const FREE_LIMIT = 5;
```

```bash
cd backend && npm run build && sudo systemctl restart jte-api
```

---

## 12. Referência de endpoints

### Auth

| Método | Endpoint | Body | Autenticação |
|---|---|---|---|
| POST | `/api/auth/register` | `{nome, email, senha}` | — |
| POST | `/api/auth/login` | `{email, senha}` | — |
| POST | `/api/auth/refresh` | — | Cookie `jte_refresh` |
| POST | `/api/auth/logout` | — | Cookie `jte_refresh` |
| GET  | `/api/auth/me` | — | Bearer JWT |

### Processos

| Método | Endpoint | Query | Autenticação |
|---|---|---|---|
| GET | `/api/processos` | `vara, dataInicio, dataFim, numero, reclamada, pagina` | Bearer JWT |
| GET | `/api/processos/stats` | — | — |

### Alertas (premium)

| Método | Endpoint | Body | Autenticação |
|---|---|---|---|
| GET    | `/api/alertas` | — | Bearer JWT + tier premium |
| POST   | `/api/alertas` | `{nome, vara?, reclamada?}` | Bearer JWT + tier premium |
| DELETE | `/api/alertas/:id` | — | Bearer JWT + tier premium |
| PATCH  | `/api/alertas/:id/toggle` | — | Bearer JWT + tier premium |

---

## 13. Variáveis de ambiente

### `backend/.env`

| Variável | Obrigatório | Default | Descrição |
|---|---|---|---|
| `DB_HOST` | — | `127.0.0.1` | Host MySQL |
| `DB_PORT` | — | `3306` | Porta MySQL |
| `DB_USER` | ✅ | — | Usuário MySQL |
| `DB_PASS` | ✅ | — | Senha MySQL |
| `DB_NAME` | — | `jte` | Database |
| `JWT_SECRET` | ✅ | — | Secret para JWTs (gere com crypto) |
| `JWT_ACCESS_EXPIRES` | — | `15m` | Validade do access token |
| `JWT_REFRESH_DAYS` | — | `7` | Validade do refresh token (dias) |
| `SMTP_HOST` | ✅ | — | Servidor SMTP |
| `SMTP_PORT` | — | `587` | Porta SMTP |
| `SMTP_SECURE` | — | `false` | TLS direto (porta 465) |
| `SMTP_USER` | ✅ | — | E-mail do remetente |
| `SMTP_PASS` | ✅ | — | Senha ou App Password |
| `MAIL_FROM` | — | igual a SMTP_USER | Nome + e-mail do remetente |
| `PORT` | — | `4000` | Porta da API |
| `NODE_ENV` | — | — | `production` em produção |
| `FRONTEND_URL` | ✅ | — | URL do frontend (CORS) |
| `REDIS_HOST` | — | `127.0.0.1` | Host Redis |
| `REDIS_PORT` | — | `6379` | Porta Redis |
| `CONCURRENCY` | — | `4` | Workers paralelos |
| `MESES` | — | `6` | Meses à frente para coletar |

### `frontend/.env.local`

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL da API (visível no browser) |

> **Gmail App Password:** ative verificação em 2 etapas em sua conta, depois acesse https://myaccount.google.com/apppasswords e gere uma senha de app. Use essa senha em `SMTP_PASS`.

---

## 14. Comandos úteis

### API

```bash
sudo journalctl -u jte-api -f                          # logs em tempo real
sudo systemctl restart jte-api                         # reiniciar
cd backend && npm run build && sudo systemctl restart jte-api  # rebuild + restart
```

### Frontend

```bash
sudo journalctl -u jte-frontend -f
cd frontend && npm run build && sudo systemctl restart jte-frontend
```

### Banco

```bash
# Conectar
mysql -u jte -p jte

# Últimos processos
SELECT vara, dataBR, reclamante, reclamada
FROM processos_sem_polo_passivo
ORDER BY createdAt DESC LIMIT 20;

# Contagem por vara
SELECT vara, COUNT(*) AS total
FROM processos_sem_polo_passivo
GROUP BY vara ORDER BY total DESC;

# Usuários
SELECT id, nome, email, tier, createdAt FROM users;

# Últimas execuções do worker
SELECT * FROM execucoes ORDER BY id DESC LIMIT 5;
```

### Redis

```bash
redis-cli ping                  # PONG
redis-cli LLEN bull:jte:wait   # jobs aguardando
redis-cli FLUSHDB               # limpar fila (cuidado!)
```

---

## 15. Troubleshooting

### API não inicia

```bash
# Ver erro completo
sudo journalctl -u jte-api -n 50 --no-pager

# Testar conexão com MySQL
mysql -u jte -p jte -e "SELECT 1"

# Testar conexão com Redis
redis-cli ping
```

### Worker não coleta dados

```bash
# 1. Teste com browser visível — edite worker/index.js:
#    headless: true  →  headless: false
# 2. Execute direto no terminal (não via cron) para ver output
CONCURRENCY=1 MESES=1 node worker/index.js

# 3. Verifique se o Redis está rodando
redis-cli ping
```

### E-mails não chegam

```bash
# Teste manual do SMTP
node -e "
const n = require('nodemailer');
const t = n.createTransport({
  host: 'smtp.gmail.com', port: 587,
  auth: { user: 'SEU@gmail.com', pass: 'APP_PASSWORD' }
});
t.sendMail({ from: 'SEU@gmail.com', to: 'SEU@gmail.com', subject: 'Teste JTe', text: 'ok' })
  .then(() => console.log('E-mail enviado!'))
  .catch(e => console.error('Erro:', e.message));
"
```

### Processos duplicados

Não é problema. O worker usa `ON DUPLICATE KEY UPDATE`, então re-executar é seguro — atualiza os dados existentes, nunca duplica.

### Frontend não autentica (401 em todas as requests)

```bash
# 1. Confirme que FRONTEND_URL no backend/.env bate com a URL do frontend
# 2. Confirme que o Nginx está passando o header Cookie corretamente
# 3. Verifique o CORS nos logs da API
sudo journalctl -u jte-api -n 30 | grep -i "cors\|origin"
```
