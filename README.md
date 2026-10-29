# Ressonância · Casa de leilões de instrumentos musicais

Leilão online de instrumentos antigos, feito para o teste técnico **Elite Dev (Verzel)**. O leiloeiro escolhe um instrumento no acervo do Metropolitan Museum, publica o lote e acompanha o resultado. Os licitantes depositam saldo simulado, disputam lances ao vivo e recebem um comprovante público ao vencer. Qualquer pessoa pode auditar o histórico de lances de um lote, sem login, e descobrir se alguém mexeu no banco.

| | Endereço |
|---|---|
| **Site (front-end)** | https://leilao-front-c6k7.onrender.com |
| **API (back-end)** | https://leilao-00ol.onrender.com |
| **Repositório** | https://github.com/Lucas-l0pe5/leilao |

> **Primeiro acesso lento.** A API roda no plano gratuito do Render, que desliga o servidor depois de 15 minutos sem uso. A primeira requisição depois disso leva cerca de 1 minuto. O site avisa "O servidor gratuito pode estar acordando" quando a resposta demora mais de 3 segundos. Depois que acorda, tudo responde normalmente.

---

## Sumário

1. [Para avaliar em 5 minutos](#1-para-avaliar-em-5-minutos)
2. [O que foi entregue](#2-o-que-foi-entregue)
3. [Como rodar localmente](#3-como-rodar-localmente)
4. [Variáveis de ambiente e scripts](#4-variáveis-de-ambiente-e-scripts)
5. [Como foi publicado](#5-como-foi-publicado)
6. [Arquitetura](#6-arquitetura)
7. [Regras de negócio e decisões](#7-regras-de-negócio-e-decisões)
8. [Auditoria: como a adulteração é detectada](#8-auditoria-como-a-adulteração-é-detectada)
9. [Banco de dados](#9-banco-de-dados)
10. [Rotas da API](#10-rotas-da-api)
11. [Front-end](#11-front-end)
12. [Testes realizados](#12-testes-realizados)
13. [Comportamentos inesperados e limitações conhecidas](#13-comportamentos-inesperados-e-limitações-conhecidas)
14. [Melhorias futuras](#14-melhorias-futuras)
15. [Uso de IA no projeto](#15-uso-de-ia-no-projeto)

---

## 1. Para avaliar em 5 minutos

### Contas de demonstração

Todas usam a senha **`Leilao@2026`**. Na tela **Entrar** há botões que preenchem cada conta com um clique.

| Papel | E-mail | Situação inicial |
|---|---|---|
| Leiloeiro | `leiloeiro@leilao.test` | Dono dos 4 lotes do seed. Já recebeu R$ 250,00 de um arremate. |
| Licitante 1 | `licitante1@leilao.test` | R$ 5.000,00 de saldo, R$ 600,00 comprometidos (lidera o violino). |
| Licitante 2 | `licitante2@leilao.test` | R$ 4.750,00 de saldo. Foi superado no violino e venceu a flauta. |

### Lotes do seed

| Lote | Situação | Para testar |
|---|---|---|
| Violino de estudo - Alemanha | Ao vivo, 3 lances | Disputa, "você está ganhando" / "você foi superado", auditoria íntegra |
| Violão clássico - Espanha | Ao vivo, sem lances | O primeiro lance (precisa ser ≥ lance inicial) |
| Trompete de latão - França | Agendado (abre 1 dia depois do seed) | Recusa "lote ainda não iniciado" |
| Flauta transversal - Inglaterra | Encerrado e liquidado | Comprovante público **`ARR-5EED000001`** |

### Roteiro sugerido

1. Abra o site sem login: vitrine, filtros, busca e a **auditoria** de qualquer lote (link "Histórico de lances auditável").
2. Entre como **Licitante 2**, abra o violino e dê um lance. Em outra aba (ou janela anônima), entre como **Licitante 1** e veja a sala trocar de "ganhando" para "superado" sozinha, sem recarregar.
3. Tente as recusas: valor abaixo do mínimo, lance de quem já lidera, lance no trompete (agendado), lance maior que o saldo.
4. Entre como **Leiloeiro**, abra o **Painel**, busque no catálogo (em português: "violino", "flauta", "harpa"), publique um lote e cancele um lote sem lances.
5. Abra `/comprovante/ARR-5EED000001` sem login: só aparecem apelidos.

---

## 2. O que foi entregue

### Requisitos obrigatórios

| Requisito | Como foi atendido |
|---|---|
| Dois papéis (leiloeiro e licitante) | Papel gravado no usuário e conferido no servidor (`exigirPapel`). Leiloeiro recebe 403 ao tentar dar lance, e o front troca o botão por "Visualizar lote". |
| Itens de uma API pública | Met Museum (departamento de instrumentos musicais). Catálogo próprio em JSON como reserva. |
| Vitrine (ao vivo, agendados, encerrados; sem cancelados) | `GET /lotes` + tela Vitrine com destaque, filtros e contadores. |
| Painel do leiloeiro | Busca no catálogo, criação de lote, cancelamento de lote sem lances, total recebido e resultado dos encerrados. |
| Sala ao vivo sem recarregar | Consulta a cada 1,5 s, contagem regressiva pela hora do servidor, posição do usuário e histórico. |
| Carteira | Total, comprometido, disponível e depósito simulado. |
| Meus arremates | Lotes em que dei lance (com posição) e lotes vencidos, com comprovante e botão de copiar o link. |
| Auditoria pública | `GET /lotes/:id/auditoria` recalcula a cadeia de hashes e responde "íntegro" ou "adulterado", apontando onde quebrou. |
| Mensagens de recusa | Cada recusa volta com um código fixo (`LANCE_ABAIXO_DO_MINIMO`, `SALDO_INSUFICIENTE`, `JA_ESTA_GANHANDO`, `LOTE_NAO_INICIADO`, `LOTE_ENCERRADO`) que o front traduz em mensagem clara. |
| Funciona com a API externa fora do ar | O lote copia título, imagem e atributos para o banco na criação. Vitrine, sala, auditoria e comprovante nunca consultam o Met. |
| Dinheiro sem erro de arredondamento | Tudo em centavos inteiros (`BIGINT`), do banco ao front. |
| Regras de lance, concorrência e idempotência | Trava de linha (`SELECT ... FOR UPDATE`) e cabeçalho `Idempotency-Key`. Detalhes na seção 7. |
| Saldo comprometido | Reservado ao liderar e devolvido na mesma transação em que o líder é superado. |
| Anti-sniping | Lance nos últimos 2 minutos soma 2 minutos ao fim vigente, em cadeia. |
| Hora oficial do servidor e recuperação após queda | `clock_timestamp()` do banco. Ao ligar, o servidor encerra o que venceu, gravando o fim original. |
| Liquidação | Debita o vencedor, credita o leiloeiro e gera o comprovante. Lote sem lances fecha sem vencedor. |
| Histórico à prova de adulteração | Cadeia de hashes SHA-256 + conferências cruzadas (seção 8). |
| Privacidade | Auditoria, sala e comprovante mostram só apelidos (`Licitante #A1B2C3`), nunca e-mail ou id. |
| Seed | 1 leiloeiro, 2 licitantes e 4 lotes, incluindo um ao vivo com lances abertos. |
| Deploy público | Front e API no Render, banco no Neon. |

### Opcionais

| Opcional | Situação |
|---|---|
| Busca e filtro de lotes | **Feito.** Busca no cabeçalho (nome, origem, época ou número do lote, com sugestões) e filtros por status, época, origem e faixa de preço. |
| Testes automatizados | **Parcial.** Dois scripts de ponta a ponta contra o banco real: concorrência/idempotência e encerramento/liquidação. Não há suíte com Jest ou similar. |
| Cancelamento com estorno automático | **Não feito.** Só lotes sem lances podem ser cancelados, então não há estorno. A seção 14 descreve a mudança necessária. |
| Docker Compose | **Não feito.** |
| Dark mode | **Não entregue.** Existiu durante o desenvolvimento e foi retirado por decisão de design (só modo claro). |

---

## 3. Como rodar localmente

Os comandos usam o PowerShell do Windows, que foi o ambiente de desenvolvimento. No Linux ou no macOS, troque `copy` por `cp`.

### Pré-requisitos

| Ferramenta | Versão usada |
|---|---|
| Node.js | 22 ou mais recente (desenvolvido no 24.14) |
| npm | 10 ou mais recente |
| PostgreSQL | 14 ou mais recente, banco com codificação **UTF8** |
| Git | qualquer versão recente |

### Passo 1: clonar

```powershell
git clone https://github.com/Lucas-l0pe5/leilao.git
cd leilao
```

### Passo 2: criar o banco vazio

No pgAdmin (botão direito em **Databases → Create → Database**) ou no terminal:

```sql
CREATE DATABASE leilao ENCODING 'UTF8';
```

Só o banco vazio. As tabelas são criadas pelo script do passo 4.

### Passo 3: configurar o back-end

```powershell
cd backend
npm install
copy .env.example .env
```

Edite o `backend/.env`:

```env
DATABASE_URL=postgres://postgres:SUA_SENHA@localhost:5432/leilao
JWT_SECRET=cole-aqui-um-segredo-com-pelo-menos-32-caracteres
URL_PUBLICA=http://localhost:3000
```

Para gerar um `JWT_SECRET` forte:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

> O servidor **se recusa a subir** se `DATABASE_URL` ou `JWT_SECRET` faltarem, ou se o segredo tiver menos de 32 caracteres. A mensagem de erro diz qual é o problema.

> Se a senha do PostgreSQL tiver `@`, `#`, `/` ou `:`, ela precisa ser codificada na URL (`@` vira `%40`).

### Passo 4: criar as tabelas e o seed

```powershell
npm run db:reset
```

O script imprime `Banco alvo: <host>` antes de apagar qualquer coisa. Confira que é `localhost:5432`. Em seguida devem aparecer "Banco criado com sucesso" e o resumo do seed.

> **Atenção:** `db:reset` **apaga todas as tabelas** do banco apontado por `DATABASE_URL` e recria tudo do zero.

### Passo 5: ligar a API

```powershell
npm run dev
```

Abra http://localhost:3000/saude. O esperado é `{"status":"ok","horaDoBanco":"..."}`. Deixe esse terminal aberto.

### Passo 6: configurar e ligar o front-end

Em **outro** terminal, a partir da raiz do repositório:

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

O `.env` do front tem uma linha só, `VITE_API_URL=http://localhost:3000`. Abra http://localhost:5173.

> O Vite só lê o `.env` ao iniciar. Se mudar o `VITE_API_URL`, pare o `npm run dev` (Ctrl+C) e rode de novo.

### Conferência rápida

- [ ] A vitrine mostra 2 lotes ao vivo, 1 agendado e 1 encerrado.
- [ ] Entrar como `licitante1@leilao.test` mostra R$ 4.400,00 disponíveis na carteira.
- [ ] A auditoria do violino responde "Histórico íntegro".
- [ ] `http://localhost:5173/comprovante/ARR-5EED000001` abre sem login.

### Se algo der errado

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "Sem conexão com o servidor" no site | API desligada ou `VITE_API_URL` errado | Confira o terminal da API e o `frontend/.env`, depois reinicie o `npm run dev` do front. |
| `JWT_SECRET precisa ter pelo menos 32 caracteres` | Segredo curto | Gere um novo com o comando do passo 3. |
| Erro de senha ao conectar no banco | `DATABASE_URL` com senha errada ou caractere especial | Corrija a senha ou codifique os caracteres especiais. |
| `sequência de bytes é inválida para codificação "UTF8"` | Banco criado em outra codificação, ou arquivo editado e salvo em outra codificação | Recrie o banco com `ENCODING 'UTF8'` e salve os arquivos em UTF-8. |
| Acentos estranhos (`PaÃ­s`) no PowerShell | Só a exibição do console | Rode `[Console]::OutputEncoding = [Text.Encoding]::UTF8`. |

---

## 4. Variáveis de ambiente e scripts

### Back-end (`backend/.env`)

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `DATABASE_URL` | Sim | Conexão com o PostgreSQL. No Neon, use a conexão **direta** (sem `-pooler`) com `?sslmode=require`. |
| `JWT_SECRET` | Sim | Assina os tokens de login. Mínimo de 32 caracteres. |
| `PORT` | Não | Porta da API (padrão 3000; o Render define sozinho). |
| `URL_PUBLICA` | Não | Endereço público da API, usado para montar a URL das imagens do **catálogo reserva** (padrão `http://localhost:3000`). |
| `URL_PUBLICA_API` | Só no seed | Endereço público da API, usado para montar a URL das imagens **dos lotes do seed**. Defina antes de rodar o seed em produção. |

> `URL_PUBLICA` e `URL_PUBLICA_API` guardam o mesmo endereço com nomes diferentes (uma é lida pelo servidor, a outra pelo script de seed). É uma inconsistência conhecida, registrada na seção 13.

### Front-end (`frontend/.env`)

| Variável | Para que serve |
|---|---|
| `VITE_API_URL` | Endereço da API, sem barra no final. O Vite grava esse valor dentro do JavaScript **na hora do build**. |

### Scripts do back-end

| Comando | O que faz |
|---|---|
| `npm run dev` | Liga a API e reinicia sozinha a cada arquivo salvo. |
| `npm start` | Liga a API sem reinício automático (usado no Render). |
| `npm run db:criar` | Apaga e recria as tabelas (`schema.sql`). |
| `npm run db:seed` | Aplica o seed. Pode rodar de novo sem duplicar usuários e lotes. |
| `npm run db:reset` | `db:criar` seguido de `db:seed`. |
| `node scripts/concorrencia.js` | Teste de lances simultâneos e idempotência (seção 12). |
| `node scripts/teste-encerramento.js` | Teste de encerramento e liquidação, leva cerca de 2 min 20 s (seção 12). |

Os dois scripts de teste aceitam `API_URL` para apontar para outro servidor. Eles criam dados, então rode-os no banco local.

### Scripts do front-end

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em http://localhost:5173. |
| `npm run build` | Gera o site em `frontend/dist`. É o comando que o Render executa. |
| `npm run preview` | Serve o `dist` localmente, para conferir o build. |

---

## 5. Como foi publicado

| Peça | Serviço | Configuração |
|---|---|---|
| Banco | **Neon** (PostgreSQL gratuito) | Conexão direta, sem pooler. |
| API | **Render**, Web Service gratuito | Root Directory `backend`, Build `npm install`, Start `npm start`, Health Check `/saude`. Variáveis `DATABASE_URL`, `JWT_SECRET` e `URL_PUBLICA`. |
| Front | **Render**, Static Site gratuito | Root Directory `frontend`, Build `npm install && npm run build`, Publish `dist`, variável `VITE_API_URL=https://leilao-00ol.onrender.com`. |

Duas configurações que não podem faltar no Static Site:

- **Regra de reescrita** `/*` → `/index.html` (ação *Rewrite*). Sem ela, abrir um link direto como `/comprovante/ARR-...` ou recarregar a sala de um lote dá "Not Found", porque quem resolve essas rotas é o React, e não o servidor de arquivos.
- **`VITE_API_URL` definida antes do build.** Se for criada ou alterada depois, é preciso um novo deploy manual.

### Recriar o seed em produção

Em um terminal novo, sem mexer no `.env`:

```powershell
cd backend
$env:DATABASE_URL = "COLE_AQUI_A_CONEXAO_DIRETA_DO_NEON"
$env:URL_PUBLICA_API = "https://leilao-00ol.onrender.com"
npm run db:reset
Remove-Item Env:DATABASE_URL
Remove-Item Env:URL_PUBLICA_API
```

A linha `Banco alvo:` precisa terminar em `neon.tech`. Se aparecer `localhost`, pare.

Cada `git push` na `main` refaz o deploy dos dois serviços.

---

## 6. Arquitetura

```
leilao/
├── backend/                     Node.js + Express 5 + PostgreSQL (driver pg, SQL puro)
│   ├── public/imagens/          Imagem usada pelo seed e pelo catálogo reserva
│   ├── scripts/                 Testes de concorrência e de encerramento
│   └── src/
│       ├── servidor.js          Liga a API e o encerrador automático
│       ├── app.js               Middlewares (helmet, cors, json), rotas e tratador de erros
│       ├── config.js            Valida as variáveis de ambiente ao subir
│       ├── catalogo/            Adaptadores do Met e da reserva (mesmo formato de item)
│       ├── db/                  schema.sql, criação, seed e pool de conexões
│       ├── lances/hash.js       Cálculo do hash da cadeia (usado no lance e na auditoria)
│       ├── lotes/               Situação calculada e encerramento/liquidação
│       ├── middleware/          Login obrigatório, login opcional e papel
│       └── rotas/               Uma rota por arquivo (lances, sala, auditoria, carteira...)
└── frontend/                    React 19 + Vite 7 + React Router 7, JavaScript e CSS puro
    └── src/
        ├── main.jsx, App.jsx    Entrada e mapa de rotas
        ├── sessao.jsx           Quem está logado (contexto)
        ├── lotes.jsx            Lista de lotes compartilhada (uma consulta para a página toda)
        ├── lib/                 api.js, dinheiro, tempo, polling, regras de apresentação, tradução do Met
        ├── componentes/         Cartão de lote, painel de lance, formulário, filtros, busca...
        ├── paginas/             Vitrine, Sala, Carteira, Meus, Painel, Comprovante, Auditoria, Entrar
        └── estilos.css          Tokens de design e estilos de todas as telas
```

Caminho de um lance:

```
Navegador (FormLance) ──POST /lotes/:id/lances + Idempotency-Key──▶ exigirLogin ▶ exigirPapel('licitante')
   ▶ transação: trava o lote ▶ confere a chave ▶ hora do banco ▶ regras ▶ trava as carteiras
   ▶ grava o lance com hash ▶ libera o líder anterior ▶ compromete o novo ▶ anti-sniping ▶ COMMIT
```

**Por que um repositório só.** Front e back são entregues juntos, um único link mostra o sistema inteiro e os dois serviços do Render apontam para pastas diferentes do mesmo repositório.

**Por que SQL puro, sem ORM.** As regras mais exigentes do teste dependem de `SELECT ... FOR UPDATE`, transações explícitas e ordem de travas. Com SQL puro, cada uma dessas decisões fica visível no código.

---

## 7. Regras de negócio e decisões

### Dinheiro

Todo valor é um inteiro de centavos (`BIGINT`): R$ 1.250,50 é `125050`. Nenhum cálculo usa ponto flutuante. O front converte o texto digitado direto para centavos (`"1.250,50"` → `125050`), sem multiplicar por 100, e formata a exibição com `Intl.NumberFormat('pt-BR')`. O driver `pg` foi configurado para devolver `BIGINT` como número.

### Tempo

A hora oficial é a do banco, `clock_timestamp()` (a hora real do instante, e não `now()`, que fica parada no início da transação). O status gravado do lote é só `aberto`, `encerrado` ou `cancelado`. "Agendado" e "ao vivo" são **calculados** a cada consulta, comparando a hora do banco com o início e o fim, então ninguém precisa "virar" o estado na hora certa.

A contagem regressiva do site usa o campo `hora_servidor` da sala para calcular a diferença entre o relógio do servidor e o do navegador. Um computador com o relógio errado vê a contagem certa, e quem decide se o lance vale é sempre o servidor.

### Regras de lance (nesta ordem)

Quando um lance viola mais de uma regra, a primeira da lista é a que aparece:

| # | Regra | Código | HTTP |
|---|---|---|---|
| 1 | Lote existe | `LOTE_NAO_ENCONTRADO` | 404 |
| 2 | Lote não cancelado | `LOTE_CANCELADO` | 409 |
| 3 | Lote não encerrado (lance **no instante exato do fim** é recusado) | `LOTE_ENCERRADO` | 409 |
| 4 | Lote já começou | `LOTE_NAO_INICIADO` | 409 |
| 5 | Quem lidera não cobre o próprio lance | `JA_ESTA_GANHANDO` | 409 |
| 6 | 1º lance ≥ lance inicial; os seguintes ≥ atual + incremento | `LANCE_ABAIXO_DO_MINIMO` (devolve o mínimo) | 422 |
| 7 | Cabe no saldo disponível | `SALDO_INSUFICIENTE` (devolve o disponível) | 422 |

### Concorrência

O lance acontece numa transação que começa com `SELECT ... FOR UPDATE` na linha do lote. Se 20 lances chegam juntos, o primeiro trava a linha e os outros esperam em fila. Cada um, na sua vez, lê o lote já atualizado pelo anterior. Dois lances iguais no mesmo instante: um é aceito, e o outro recebe "abaixo do mínimo", porque o mínimo já subiu.

As carteiras envolvidas (quem dá o lance e o líder anterior) são travadas sempre em **ordem crescente de id**. Isso impede o impasse (deadlock) em que duas transações esperam uma pela outra para sempre. O cancelamento e o encerramento usam a mesma trava do lote, então lance, cancelamento e liquidação nunca se cruzam.

### Idempotência

O front gera uma chave (`crypto.randomUUID()`) e a envia no cabeçalho `Idempotency-Key`. A chave é mantida enquanto o valor digitado não muda, então um duplo clique ou uma nova tentativa depois de falha de rede reenviam a mesma chave. O servidor confere a chave **depois** de obter a trava: o segundo pedido espera o primeiro terminar, encontra o lance já gravado e devolve o resultado original com `200` e `repetido: true`, sem criar outro. Uma restrição `UNIQUE (usuario_id, chave_idempotencia)` no banco é a segunda barreira. A mesma chave com outro valor ou outro lote é recusada (`CHAVE_REUTILIZADA`).

### Saldo comprometido

`disponível = total − comprometido`. Ao liderar, o valor do lance vai para o comprometido. Quando alguém cobre o lance, o valor volta ao disponível do líder anterior **na mesma transação** do novo lance. Restrições `CHECK` no banco impedem saldo negativo e comprometido maior que o total, mesmo que o código erre.

### Anti-sniping

Decisão registrada, porque o enunciado é ambíguo: **um lance aceito quando faltam 2 minutos ou menos soma 2 minutos ao fim vigente.** Fim às 21:00 e lance às 20:58 → novo fim às 21:02. A regra vale em cadeia: um lance às 21:01 empurra o fim para 21:04. O `fim_original_em` nunca muda e fica registrado. A sala mostra o selo "Prorrogado" e o fim original.

### Encerramento e recuperação após queda

Um verificador roda **ao ligar o servidor** e depois **a cada 2 segundos**, procurando lotes abertos cujo fim já passou (no máximo 50 por rodada). Cada lote é encerrado em sua própria transação, com a mesma trava do lance, e o fim é conferido de novo depois da trava, para não encerrar um lote que acabou de ser prorrogado.

Se o servidor estava desligado na hora do fim, ao voltar ele encerra o lote e grava como horário de encerramento o **fim do lote**, e não a hora em que voltou.

### Liquidação

Numa única transação: o valor sai do total **e** do comprometido do vencedor, entra no total do leiloeiro, o arremate é gravado com um código aleatório (`ARR-` + 10 caracteres hexadecimais) e o lote passa a `encerrado`. Lote sem lances fecha sem vencedor e sem movimentar dinheiro. `UNIQUE (lote_id)` em `arremates` impede liquidar duas vezes.

### API externa (Met Museum)

- A busca usa o departamento 18 (instrumentos musicais), pede até 30 objetos e devolve até 12 com imagem e em domínio público. Tempo máximo total: 5 segundos.
- Se o Met falhar, demorar ou não devolver detalhes, a busca usa o **catálogo reserva** (12 instrumentos em `backend/src/catalogo/reserva.json`) e avisa o leiloeiro. O front tenta o Met de novo sozinho, uma vez, 2 segundos depois.
- Ao criar o lote, título, imagem e atributos são **copiados para o banco**. Depois disso, o Met não é consultado nunca mais para aquele lote.

### Segurança

- Senhas com `bcrypt` (custo 10). Login com JWT de 8 horas, enviado como `Authorization: Bearer`.
- Mensagem igual para e-mail inexistente e senha errada.
- `helmet` para os cabeçalhos de segurança. Todo SQL usa parâmetros (`$1`, `$2`), nunca texto concatenado.
- Erros inesperados respondem `500` genérico, sem detalhes internos. JSON malformado responde `400`.

---

## 8. Auditoria: como a adulteração é detectada

### A cadeia de hashes

Cada lance guarda dois campos: `hash_anterior` (o hash do lance anterior do mesmo lote) e `hash`, calculado assim:

```
SHA-256( lote_id | sequencia | usuario_id | valor_centavos | criado_em (ISO, UTC) | hash_anterior )
```

O primeiro lance de cada lote usa 64 zeros como `hash_anterior`. Como cada hash inclui o anterior, os lances formam uma corrente: mexer em um elo muda o hash dele e desconecta o seguinte.

A rota pública `GET /lotes/:id/auditoria` relê os lances em ordem e, para cada um, confere:

| Verificação | Código | O que detecta |
|---|---|---|
| A sequência é 1, 2, 3... sem buracos | `SEQUENCIA_FORA_DE_ORDEM` | Lance removido ou inserido no meio |
| `hash_anterior` é igual ao hash do lance de trás | `ELO_QUEBRADO` | Corrente cortada |
| O hash recalculado com os dados gravados bate com o `hash` gravado | `HASH_NAO_CONFERE` | Valor, usuário ou horário alterados |

A cadeia sozinha não vê a remoção do **último** lance, porque nenhum lance depois dele aponta para ele. Por isso há conferências cruzadas entre o histórico, o lote e o arremate:

| Conferência | Código |
|---|---|
| O lote tem lance atual, mas o histórico está vazio | `LOTE_TEM_LANCE_MAS_HISTORICO_VAZIO` |
| O último lance não é o lance atual do lote | `ULTIMO_LANCE_DIFERE_DO_LANCE_ATUAL` |
| O autor do último lance não é o líder do lote | `ULTIMO_LANCE_DIFERE_DO_LIDER` |
| O valor do arremate não é o do último lance | `ARREMATE_DIFERE_DO_ULTIMO_LANCE` |
| O vencedor do arremate não é o autor do último lance | `ARREMATE_DIFERE_DO_VENCEDOR` |

O veredito é "íntegro" só quando nenhum problema aparece. A tela de auditoria marca em vermelho a linha onde a cadeia quebrou. A resposta da API inclui o último hash (`ultimo_hash`), que serve de âncora: quem anotar esse valor consegue notar depois se o histórico foi reescrito.

### Como reproduzir os ataques

Use o **banco local** e um lote com pelo menos 2 lances (por exemplo, o violino do seed, id 1). Depois de cada ataque, abra a auditoria do lote no site ou chame `GET /lotes/1/auditoria`.

```sql
-- Antes de tudo, uma cópia para restaurar depois
CREATE TABLE lances_backup AS SELECT * FROM lances WHERE lote_id = 1;

-- Ataque 1: alterar um valor (esperado: HASH_NAO_CONFERE no lance 2)
UPDATE lances SET valor_centavos = valor_centavos + 1 WHERE lote_id = 1 AND sequencia = 2;
UPDATE lances SET valor_centavos = valor_centavos - 1 WHERE lote_id = 1 AND sequencia = 2;  -- desfaz

-- Ataque 2: remover o primeiro lance (esperado: SEQUENCIA_FORA_DE_ORDEM e ELO_QUEBRADO)
DELETE FROM lances WHERE lote_id = 1 AND sequencia = 1;
INSERT INTO lances OVERRIDING SYSTEM VALUE SELECT * FROM lances_backup WHERE sequencia = 1;  -- desfaz

-- Ataque 3: remover o último lance (esperado: só a conferência cruzada acusa)
DELETE FROM lances WHERE lote_id = 1 AND sequencia = (SELECT MAX(sequencia) FROM lances WHERE lote_id = 1);
INSERT INTO lances OVERRIDING SYSTEM VALUE
  SELECT * FROM lances_backup WHERE sequencia = (SELECT MAX(sequencia) FROM lances_backup);  -- desfaz

-- Ataque 4: inserir um lance falso (esperado: ELO_QUEBRADO e HASH_NAO_CONFERE na nova sequência)
INSERT INTO lances (lote_id, sequencia, usuario_id, valor_centavos, chave_idempotencia, criado_em, hash_anterior, hash)
VALUES (1, (SELECT MAX(sequencia) + 1 FROM lances WHERE lote_id = 1),
        (SELECT id FROM usuarios WHERE email = 'licitante1@leilao.test'),
        999999, 'ataque-falso-001', clock_timestamp(), repeat('0', 64), repeat('f', 64));
DELETE FROM lances WHERE lote_id = 1 AND chave_idempotencia = 'ataque-falso-001';  -- desfaz

DROP TABLE lances_backup;
```

O `OVERRIDING SYSTEM VALUE` é necessário porque o `id` dos lances é gerado pelo banco (`GENERATED ALWAYS`). Depois de cada "desfaz", a auditoria volta a "íntegro".

| Ataque | Quem detecta |
|---|---|
| Alterar dados de um lance | Hash recalculado |
| Inserir lance falso | Elo e hash |
| Remover o primeiro ou um do meio | Sequência e elo |
| Remover o último | Conferência cruzada com o lote |

A limitação desta técnica está na seção 13.

---

## 9. Banco de dados

O esquema completo está em `backend/src/db/schema.sql`.

| Tabela | Conteúdo |
|---|---|
| `usuarios` | E-mail (único), hash da senha, papel (`leiloeiro` ou `licitante`) e apelido público (único). |
| `carteiras` | Uma por usuário: saldo total e saldo comprometido, em centavos. |
| `lotes` | Dono, fonte e id do item, cópia de título, imagem e atributos (JSONB), lance inicial, incremento, início, fim original, fim atual, status, lance atual e líder. |
| `lances` | Lote, sequência no lote, autor, valor, chave de idempotência, horário, hash anterior e hash. |
| `arremates` | Lote (único), vencedor, valor, código do comprovante (único) e horário de encerramento. |

O lance atual e o líder ficam no próprio lote de propósito: assim existe **uma linha** para travar com `FOR UPDATE` em cada lance.

### Garantias no próprio banco

| Garantia | Como |
|---|---|
| Sem saldo negativo | `CHECK (saldo_total_centavos >= 0)` e `CHECK (saldo_comprometido_centavos >= 0)` |
| Comprometido nunca passa do total | `CHECK (saldo_comprometido_centavos <= saldo_total_centavos)` |
| Valores positivos | `CHECK (... > 0)` em lance inicial, incremento, lance e arremate |
| Fim depois do início, e fim atual nunca antes do original | `CHECK (fim_original_em > inicio_em)` e `CHECK (fim_em >= fim_original_em)` |
| Dois lances não ocupam a mesma posição | `UNIQUE (lote_id, sequencia)` |
| Requisição repetida não vira dois lances | `UNIQUE (usuario_id, chave_idempotencia)` |
| Um arremate por lote | `UNIQUE (lote_id)` em `arremates` |
| Papéis e status válidos | `CHECK (papel IN (...))` e `CHECK (status IN (...))` |

---

## 10. Rotas da API

Erros respondem `{ "erro": "mensagem" }`. As rotas de lance, sala, auditoria e comprovante acrescentam um `codigo` fixo para o front.

| Método e rota | Acesso | O que faz |
|---|---|---|
| `GET /saude` | Público | Confirma API e banco no ar |
| `POST /auth/cadastro` | Público | Cria usuário (e-mail, senha de 8+ caracteres, papel) e carteira |
| `POST /auth/login` | Público | Devolve usuário e token |
| `GET /auth/eu` | Logado | Quem é o dono do token |
| `GET /lotes` | Público | Vitrine (filtro opcional `?situacao=ao_vivo\|agendado\|encerrado`) |
| `GET /lotes/:id` | Público (login opcional) | Sala: lote, histórico, próximo mínimo, hora do servidor e posição do usuário |
| `GET /lotes/:id/auditoria` | Público | Veredito da cadeia de hashes |
| `POST /lotes/:id/lances` | Licitante | Dá um lance (corpo `{ valor_centavos }`, cabeçalho `Idempotency-Key`) |
| `GET /carteira` | Logado | Total, comprometido e disponível |
| `POST /carteira/deposito` | Licitante | Depósito simulado (até R$ 1.000.000,00) |
| `GET /meus/lances` | Licitante | Lotes em que dei lance, com minha posição |
| `GET /meus/arremates` | Licitante | Lotes vencidos, com código do comprovante |
| `GET /comprovantes/:codigo` | Público | Comprovante com apelidos |
| `GET /catalogo/itens?q=` | Leiloeiro | Busca no Met (ou na reserva) |
| `POST /leiloeiro/lotes` | Leiloeiro | Cria lote (datas em ISO com fuso) |
| `GET /leiloeiro/lotes` | Leiloeiro | Meus lotes, com total de lances e se pode cancelar |
| `POST /leiloeiro/lotes/:id/cancelar` | Leiloeiro | Cancela lote sem lances, antes do fim |
| `GET /leiloeiro/resumo` | Leiloeiro | Total recebido e resultado dos encerrados |

---

## 11. Front-end

| Tela | Endereço | Destaques |
|---|---|---|
| Vitrine | `/` | Lote em destaque (o ao vivo que encerra primeiro), filtros com contadores, ordenação e painel lateral de lance rápido |
| Sala do lote | `/lotes/:id` | Placar, contagem, posição, atalhos de valor (+1, +2 e +5 incrementos) e histórico |
| Auditoria | `/lotes/:id/auditoria` | Veredito, tabela de lances e botão "Verificar de novo" |
| Comprovante | `/comprovante/:codigo` | Público, com botão de copiar o link |
| Entrar | `/entrar` | Login, cadastro e botões das contas de demonstração |
| Carteira | `/carteira` | Saldos e depósito simulado |
| Meus lances | `/meus` | Posição em cada lote e arremates |
| Painel | `/painel` | Catálogo, criação de lote, cancelamento e resultados |

### Atualização sem recarregar

Por consulta periódica (*polling*): o navegador pergunta ao servidor de tempos em tempos. A próxima consulta só começa quando a anterior termina, e as consultas pausam com a aba escondida.

| Onde | Intervalo |
|---|---|
| Sala do lote e painel lateral de lance | 1,5 s |
| Carteira e "Meus lances" | 5 s |
| Vitrine, faixa "ao vivo", destaque e painel do leiloeiro | 10 s |
| Auditoria e comprovante | Carregam uma vez (a auditoria tem o botão "Verificar de novo") |

### Decisões de interface

- **Formulários de valor** aceitam só números, vírgula e ponto (letras são descartadas ao digitar e ao colar). Valores inválidos ou fora das regras deixam a borda vermelha, com a explicação abaixo do campo.
- **Leiloeiro** vê "Visualizar lote" no lugar dos botões de lance.
- **Busca do catálogo em português**: o front traduz o termo para o inglês do Met antes de enviar (seção 13).
- **Acessibilidade**: foco visível, rótulos para leitores de tela, painel de lance com foco preso e fechamento por Esc, e contraste das cores conferido. Quem pede ao sistema "menos movimento" não vê animações decorativas, mas os indicadores de carregamento continuam girando.
- **Visual**: só modo claro, paleta de pergaminho e bronze, tipografia Playfair Display e Inter, CSS puro sem biblioteca de componentes.

---

## 12. Testes realizados

Não há suíte automatizada (Jest ou similar). Os testes foram feitos com dois scripts contra o banco real e com roteiros manuais.

### Scripts

**`node scripts/concorrencia.js`** (com a API ligada em outro terminal). Cria 20 licitantes e um lote.

| Teste | Resultado obtido |
|---|---|
| A. 20 licitantes dão o mesmo lance ao mesmo tempo | 1 aceito (201) e 19 recusados com `LANCE_ABAIXO_DO_MINIMO` |
| B. Um licitante envia a mesma requisição 20 vezes ao mesmo tempo | 1 lance criado (201) e 19 respostas `repetido` (200) |
| C. Soma do saldo comprometido de todos | Só o líder tem valor comprometido, igual ao seu lance |

**`node scripts/teste-encerramento.js`** (cerca de 2 min 20 s). Cria um lote com lance e outro sem.

| Verificação | Resultado obtido |
|---|---|
| Durante o leilão, o valor fica comprometido e o total não muda | Passou |
| Os dois lotes encerram sozinhos | Passou |
| Vencedor: total cai pelo valor do lance e o comprometido volta | Passou |
| Leiloeiro: total sobe pelo valor do lance | Passou |
| O lote sem lances fecha sem arremate | Passou (conferido no banco) |

### Roteiros manuais

| Área | O que foi conferido |
|---|---|
| Autenticação | Cadastro, e-mail duplicado (409), senha curta (400), senha errada (401), licitante em rota de leiloeiro (403), JSON malformado (400) |
| Carteira | Depósito válido, valor fracionado e negativo recusados, leiloeiro não deposita (403) |
| Catálogo | Login obrigatório, licitante recusado, busca sem resultado, termo vazio, **Met fora do ar** (endereço trocado de propósito) caindo na reserva |
| Lotes | Criação ao vivo e agendada, validações de valor, datas e fonte, cancelamento, cancelamento repetido (409), lote inexistente (404), id inválido (400) |
| Sala, meus lances, comprovante e resumo | Posição de visitante, vencedor e de quem nunca deu lance; comprovante só com apelidos; código inexistente (404) e inválido (400); total recebido como número |
| Auditoria | Os 4 ataques da seção 8, cada um detectado e desfeito, voltando a "íntegro" |
| Produção | Seed no Neon, vitrine, auditorias "íntegro", comprovante e carteira na URL pública; fluxo completo no site publicado |
| Front-end | Navegação de ponta a ponta contra uma API simulada (lances recusados, duplo clique, prorrogação, depósito, comprovante, auditoria adulterada, painel do leiloeiro, celular) e depois no site publicado |

---

## 13. Comportamentos inesperados e limitações conhecidas

### Hospedagem

- **Primeira resposta lenta.** O servidor gratuito do Render dorme após 15 minutos sem tráfego e leva cerca de 1 minuto para acordar.
- **Lote vencido com o servidor dormindo.** Enquanto o servidor dorme, nada é liquidado. A vitrine já mostra o lote como encerrado (a situação é calculada pela hora), mas o débito, o crédito e o comprovante só acontecem quando o servidor acorda. O horário gravado no comprovante é o do fim do lote.
- **Lotes do seed expiram.** Os dois lotes ao vivo do seed terminam 30 dias depois do seed. Depois disso, rode `npm run db:reset` de novo para ter lotes abertos.

### Imagens

- **Imagens do Met cortadas ou em baixa resolução (não corrigido).** A API usa o campo `primaryImageSmall` do Met, que é uma versão reduzida da foto, e algumas imagens aparecem pequenas, pixeladas ou com a borda do instrumento cortada na vitrine, principalmente as fotos verticais (violinos, harpas). Usar a imagem em tamanho original (`primaryImage`) melhoraria a qualidade, mas deixaria as páginas bem mais pesadas. Ficou para depois, por causa do prazo.
- **Lotes do seed com a mesma imagem.** Os quatro lotes do seed usam o mesmo desenho genérico (`instrumento.svg`). Lotes criados pelo painel com itens do Met têm fotos reais.

### Catálogo do Met

- **O Met pode falhar no primeiro acesso.** A busca pede até 30 objetos com limite total de 5 segundos. Com o servidor acordando, o Met costuma estourar esse tempo e a reserva aparece. O front tenta o Met de novo sozinho uma vez e, se ainda falhar, mostra o botão "Tentar o Met de novo".
- **Nomes em inglês.** O acervo do Met só existe em inglês. O front traduz a **busca** com um dicionário de cerca de 50 instrumentos ("violão antigo" vira `guitar`) e mostra uma etiqueta em português sobre cada resultado ("Double Bass" ganha "Contrabaixo"). Palavras fora do dicionário são descartadas quando alguma outra foi traduzida. Instrumentos fora da lista precisam ser buscados em inglês. O título do lote é preenchido em inglês, e o leiloeiro pode editá-lo antes de publicar.
- **Países e épocas do Met.** Os atributos do Met vêm em inglês (`País: Italy`, `Data: ca. 1720`). O filtro da vitrine traduz os países mais comuns e converte a data em século ("Século XVIII"). Países fora da lista aparecem em inglês, e datas sem ano reconhecível ficam fora do filtro de época.
- **"Guitar" vira "Violão".** O Met usa a mesma palavra para violão e guitarra, então a etiqueta em português sempre diz "Violão".

### Regras e simplificações

- **Cadastro escolhe o papel.** Qualquer pessoa pode se cadastrar como leiloeiro. Foi uma simplificação para a avaliação.
- **Cancelamento só sem lances, sem estorno.** O back-end recusa cancelar um lote que já recebeu lances (409). Por isso o estorno automático (opcional) não existe: nunca há líder a estornar.
- **Depósito e criação de lote sem idempotência.** Só o lance tem a chave de idempotência, como o enunciado exige. O front desativa os botões durante o envio, mas a API, sozinha, criaria dois depósitos com duas requisições iguais.
- **Atraso de atualização.** Um lance de outra pessoa leva até 1,5 s (mais o tempo de rede) para aparecer na sala, e até 10 s na vitrine.
- **Limites de listagem.** A vitrine devolve no máximo 200 lotes, e a sala mostra os 200 lances mais recentes (a posição do usuário considera todos).
- **Validação do valor no front.** O lance abaixo do mínimo é barrado no próprio formulário, com base no último mínimo recebido. Se outro lance entrar nesse meio tempo, o servidor ainda recusa e o front mostra o novo mínimo.

### Segurança

- **CORS aberto** para qualquer origem.
- **Senha do seed pública** (`Leilao@2026`), de propósito, para a avaliação.
- **Token no `localStorage`.** Funciona e expira em 8 horas, mas um script malicioso na página conseguiria lê-lo. Um cookie `HttpOnly` seria mais seguro.
- **Limite da cadeia de hashes.** Quem tem acesso de escrita ao banco **e** conhece o algoritmo pode recalcular a cadeia inteira depois de alterar um lance, e ela continuaria parecendo íntegra. As conferências cruzadas cobrem parte disso, e o último hash devolvido pela auditoria serve de âncora para quem o anotou antes. A proteção completa exigiria um segredo do servidor no cálculo (HMAC) ou publicar o último hash em outro lugar.

### Ambiente

- **Duas variáveis para o mesmo endereço** (`URL_PUBLICA` na API e `URL_PUBLICA_API` no seed). Se a do seed não for definida em produção, as imagens dos lotes do seed apontam para `localhost`.
- **Scripts de teste criam dados.** O `concorrencia.js` cria 20 usuários a cada execução. Rode no banco local e use `db:reset` depois.
- **PowerShell 5.1.** Nos testes manuais pelo terminal, os acentos podem aparecer trocados na tela. É só a exibição; o navegador mostra certo.

---

## 14. Melhorias futuras

- **Cancelamento com estorno.** Permitir cancelar lote com lances: na mesma transação, descontar o lance atual do comprometido do líder e marcar o lote como cancelado.
- **Imagens em alta resolução**, com a imagem original do Met no destaque e na sala, e a reduzida só nos cartões.
- **Atualização por WebSocket ou SSE** no lugar do polling, para lances aparecerem na hora.
- **HMAC na cadeia de hashes**, com um segredo do servidor, para que nem quem tem acesso ao banco consiga reescrever a cadeia.
- **Suíte de testes automatizados** (Jest + banco de teste) cobrindo regras de lance, concorrência e auditoria.
- **Docker Compose** com API, front e PostgreSQL.
- **Tradução dos atributos do Met** ampliada, ou uma API de tradução no back-end para títulos.
- **Idempotência também no depósito e na criação de lote.**

---

## 15. Uso de IA no projeto

### Ferramentas

- **Claude (Anthropic)**: ferramenta principal, em várias conversas ao longo da semana, no chat do claude.ai e em um ambiente de trabalho com acesso a arquivos.
- **Gemini (Google)**: só consultas e explicações de linhas de código e de suas funções. Não gerou código para o projeto.

### Como a IA foi usada, por etapa

- **Entendimento do enunciado e planejamento**: separar em tópicos o que o PDF pedia, com exemplos, antes de escolher qualquer tecnologia; montar e remontar o plano de 7 dias conforme o prazo e as horas disponíveis; prioridades do que não podia ser cortado.
- **Escolhas técnicas**: comparação de APIs públicas de instrumentos (Met Museum, Reverb, MusicBrainz, Discogs); comparação entre MySQL e PostgreSQL (escolhido o PostgreSQL pela hospedagem gratuita e pelo tratamento de horário); escolha de Node + Express, SQL puro sem ORM, bcrypt + JWT, React + Vite; hospedagem no Neon e no Render.
- **Código do back-end**: arquitetura e regras de negócio (autenticação, carteira, lances com anti-sniping/idempotência e auditoria via cadeia de hashes) projetadas e implementadas com auxílio de IA para aceleração do código e documentação.
- **Código do front-end**: construção de componentes e telas com suporte de IA para produtividade, aliada a um ciclo contínuo de testes funcionais e correção de bugs reportados durante o uso.
- **Depuração**: erros de codificação no seed, erro de URI inválida no PowerShell, comandos de restauração no banco, build e deploy.
- **Documentação**: rascunho deste README.

### Decisões que foram minhas

- Tema (instrumentos musicais) e as fontes de dados.
- Interpretação do anti-sniping: os 2 minutos somam ao fim já estabelecido, em cadeia, e lance no instante exato do fim é recusado.
- Ordem das recusas de lance.
- Trocar MySQL por PostgreSQL antes de escrever código.
- Política de Commits: Validação obrigatória através de evidências (logs de terminal ou capturas de tela) para cada alteração enviada.
- Visual e correções do front: os prompts com a direção de design, a lista de correções (spinner parado, validação dos campos, regras do leiloeiro, filtros, catálogo do Met em português).

### O que eu revisei, testei e ajustei

- Rodei todos os testes manuais da seção 12 no meu computador e mandei as saídas antes de cada commit.
- Rodei o script de concorrência (20 lances simultâneos) e o de encerramento, local e em produção.
- Fiz os quatro ataques de adulteração direto no pgAdmin e conferi a auditoria antes e depois de desfazer cada um.
- Simulei o Met fora do ar trocando o endereço da API, e conferi que a reserva assumia.
- Configurei o Neon e o Render (API e site), as variáveis de ambiente, o health check e a regra de reescrita, e rodei o seed em produção conferindo o host do banco.
- Testei o site publicado de ponta a ponta antes das correções finais.
- Fiz perguntas sobre trechos que não entendi (por exemplo, por que o parâmetro `res` fica na função mesmo sem uso).