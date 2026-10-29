# Ressonância — Casa de Leilões de Instrumentos Musicais

Leilão online de instrumentos musicais, feito como teste técnico do processo Elite Dev (Verzel). Dois papéis: o **leiloeiro** monta e gerencia lotes; o **licitante** deposita saldo, dá lances e arremata. Os itens vêm de uma API pública (Metropolitan Museum of Art), com um catálogo próprio de reserva.

## Aplicação publicada

| Recurso | Endereço |
| --- | --- |
| Aplicação (front-end) | <https://leilao-front-c6k7.onrender.com> |
| API | <https://leilao-00ol.onrender.com> |
| Repositório | <https://github.com/Lucas-l0pe5/leilao> (pastas `backend/` e `frontend/`) |

> **Antes de testar:** a API roda no plano gratuito do Render, que suspende o serviço após 15 minutos sem tráfego. A primeira requisição pode levar cerca de **1 minuto** para responder enquanto o servidor acorda. Aguarde o carregamento inicial; o site mostra um aviso quando isso acontece.

### Contas de teste (criadas pelo seed)

| Papel | E-mail | Saldo inicial |
| --- | --- | --- |
| Leiloeiro | `leiloeiro@leilao.test` | R$ 0,00 |
| Licitante 1 | `licitante1@leilao.test` | R$ 5.000,00 |
| Licitante 2 | `licitante2@leilao.test` | R$ 5.000,00 |

Senha de todas: `Leilao@2026`.

### Lotes criados pelo seed

| Lote | Situação | Para testar |
| --- | --- | --- |
| Violino de estudo - Alemanha | Ao vivo, com 3 lances (líder: licitante1) | Dar lance, ser superado, ver o histórico |
| Violão clássico - Espanha | Ao vivo, sem lances | Primeiro lance (mínimo = lance inicial) |
| Trompete de latão - França | Agendado (começa no dia seguinte ao seed) | Recusa por "lote ainda não iniciado" |
| Flauta transversal - Inglaterra | Encerrado e liquidado, com comprovante `ARR-5EED000001` | Comprovante, auditoria, "meus arremates" do licitante2 |

Os lotes ao vivo terminam **30 dias** depois do seed. Depois disso, rode o reset do banco (veja abaixo).

---

## O que está pronto

| Requisito do teste | Situação | Onde |
| --- | --- | --- |
| Dois papéis com permissões separadas | ✅ | `backend/src/middleware/autenticacao.js` |
| Itens vindos de API pública externa | ✅ | `backend/src/catalogo/` e `rotas/catalogo.js` |
| Vitrine (ao vivo, agendados, encerrados; cancelados ocultos) | ✅ | `GET /lotes` |
| Painel do leiloeiro (buscar item, criar, cancelar, resultados, total recebido) | ✅ | `rotas/leiloeiro.js`, `rotas/leiloeiro-resumo.js` |
| Sala do lote ao vivo, sem recarregar | ✅ | `GET /lotes/:id` + atualização periódica no front |
| Carteira (total, comprometido, disponível, depósito simulado) | ✅ | `rotas/carteira.js` |
| Meus lances e meus arremates, com comprovante e link | ✅ | `rotas/meus.js`, `rotas/comprovantes.js` |
| Auditoria pública sem login | ✅ | `rotas/auditoria.js` |
| Mensagens para lance recusado | ✅ | códigos de erro de `rotas/lances.js` |
| Regras de lance, simultaneidade, idempotência | ✅ | `rotas/lances.js` (uma transação) |
| Anti-sniping | ✅ | `rotas/lances.js` |
| Liquidação ao encerrar | ✅ | `backend/src/` (encerramento) [CONFERIR: nome do arquivo do encerrador] |
| Histórico à prova de adulteração | ✅ | `lances/hash.js` + `rotas/auditoria.js` |
| Seed (1 leiloeiro, 2 clientes, lote ao vivo com lances) | ✅ | `backend/src/db/seed.js` |
| Deploy | ✅ | Render (API e front) + Neon (banco) |

**Não implementados** (eram opcionais): Docker Compose, testes automatizados em framework (veja "Testes realizados"), cancelamento com estorno automático (o cancelamento só é permitido em lote sem lances, então não há o que estornar), integração com a Reverb. [CONFERIR: busca/filtro de lotes e modo escuro; liste aqui o que o front tiver]

---

## Como rodar localmente

**Requisitos:** Node.js 22 ou superior (desenvolvido com 24), npm e um PostgreSQL local.

### 1. Back-end

```bash
cd backend
npm install
cp .env.example .env      # no Windows PowerShell: Copy-Item .env.example .env
```

Edite o `.env`:

| Variável | O que é |
| --- | --- |
| `DATABASE_URL` | Conexão do PostgreSQL, ex.: `postgresql://usuario:senha@localhost:5432/leilao` |
| `JWT_SECRET` | Segredo de assinatura do token. **Mínimo de 32 caracteres** (a API recusa subir com menos) |
| `PORT` | Opcional. Padrão: 3000 |

Gere um segredo forte com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Crie o banco, o esquema e os dados de exemplo:

```bash
npm run db:criar     # cria o banco, se ainda não existir
npm run db:reset     # APAGA tudo, recria as tabelas e aplica o seed
npm run dev          # nome do script que inicia a API
```

Teste: `http://localhost:3000/saude` deve responder `{"status":"ok", ...}`.

`npm run db:seed` aplica só o seed, sem apagar nada. `npm run db:reset` **destrói todos os dados** do banco apontado pela `DATABASE_URL`; confira o host impresso na linha "Banco alvo".

### 2. Front-end

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

No `.env.local`, defina `VITE_API_URL=http://localhost:3000`. Abra `http://localhost:5173`.

---

## Deploy

| Parte | Serviço | Configuração |
| --- | --- | --- |
| Banco | Neon (PostgreSQL) | Conexão **direta**, sem pooler, porque as transações usam `SELECT ... FOR UPDATE` |
| API | Render (Web Service) | Raiz `backend`; variáveis `DATABASE_URL` e `JWT_SECRET` no painel |
| Front | Render (Static Site) | Root `frontend`, build `npm install && npm run build`, publicação `dist`, variável `VITE_API_URL`, regra de rewrite `/*` → `/index.html` |

Cada `git push` na `main` dispara o deploy automático dos dois serviços no Render.

Para recriar o banco de produção com o seed (apaga tudo): defina `DATABASE_URL` com a conexão do Neon e `URL_PUBLICA_API` com o endereço da API (usado para montar a URL das imagens dos lotes do seed), e rode `npm run db:reset` na pasta `backend`.

---

## Stack e decisões

| Escolha | Motivo |
| --- | --- |
| Node.js + Express | Tecnologia pedida; API simples e direta |
| PostgreSQL com `pg` e **SQL puro** (sem ORM) | O núcleo do sistema depende de `SELECT ... FOR UPDATE` e de transações explícitas; SQL puro deixa isso visível |
| React + Vite + React Router | Tecnologia pedida; build estático simples de hospedar |
| `bcrypt` e JWT (8 h) | Senhas com hash; token com o id do usuário e o papel |
| Dinheiro em **centavos inteiros** (`BIGINT`) | Elimina erro de arredondamento; reais só aparecem na tela |
| Hora oficial do servidor (`clock_timestamp()`) | O relógio do navegador não decide nada; `now()` não serve porque devolve o início da transação |
| Status gravado só `aberto`, `encerrado` ou `cancelado` | "Agendado" e "ao vivo" são **calculados** comparando a hora atual com `inicio_em` e `fim_em`, então nunca ficam desatualizados |
| Atualização ao vivo por polling (sala do lote a cada 1,5 s; carteira e "meus lances" a cada 5 s; painel do leiloeiro a cada 10 s; vitrine [CONFERIR]) | Simples e robusto; o próximo pedido só começa quando o anterior termina; evita WebSocket e seus problemas de hospedagem |
| Itens copiados para o banco ao criar o lote | O leilão não depende da API externa depois da criação |

---

## Regras de lance

`POST /lotes/:id/lances` (apenas licitante), corpo `{ "valor_centavos": 65000 }`, cabeçalho `Idempotency-Key` obrigatório. Tudo ocorre em **uma transação**, nesta ordem:

1. Valida o pedido (id, valor inteiro de centavos, chave) antes de abrir transação.
2. **Tranca a linha do lote** com `SELECT ... FOR UPDATE`. Quem chega depois espera na fila.
3. Idempotência: se a chave já foi usada com o mesmo lote e valor, devolve o resultado anterior sem gravar de novo.
4. Lê a hora oficial (`clock_timestamp()`), **depois** da trava.
5. Estado do lote: cancelado, encerrado (inclusive no instante exato do fim), ainda não iniciado, ou lance de quem já lidera.
6. Valor mínimo: 1º lance ≥ lance inicial; seguintes ≥ lance atual + incremento mínimo.
7. Tranca as carteiras envolvidas **em ordem de id** (evita impasse) e confere o saldo disponível (`total − comprometido`).
8. Grava o lance com o próximo número de sequência e o hash encadeado.
9. Libera o valor comprometido do líder anterior e compromete o do novo líder.
10. Anti-sniping e atualização do lote (novo líder, lance atual, fim possivelmente prorrogado).
11. `COMMIT`.

Se qualquer etapa falhar, nada é gravado (`ROLLBACK`).

### Respostas de recusa

| Código | HTTP | Significado |
| --- | --- | --- |
| `LANCE_ABAIXO_DO_MINIMO` | 422 | Abaixo do mínimo (a resposta traz `minimo_centavos`) |
| `SALDO_INSUFICIENTE` | 422 | Não cabe no disponível (traz `disponivel_centavos`) |
| `JA_ESTA_GANHANDO` | 409 | O líder não cobre o próprio lance |
| `LOTE_NAO_INICIADO` | 409 | Lote agendado |
| `LOTE_ENCERRADO` | 409 | Fim já passou ou lote encerrado |
| `LOTE_CANCELADO` | 409 | Lote cancelado |
| `CHAVE_REUTILIZADA` | 409 | Mesma chave usada em outro pedido |
| `TENTE_NOVAMENTE` | 503 | Conflito de concorrência detectado pelo banco |
| `VALOR_INVALIDO`, `CHAVE_INVALIDA`, `LOTE_INVALIDO` | 400 | Pedido malformado |

### Lances simultâneos

A trava na linha do lote transforma lances concorrentes em uma fila: um por vez, cada um enxergando o resultado do anterior. Dois lances de mesmo valor no mesmo instante: o primeiro a obter a trava é aceito, e o segundo é recusado por estar abaixo do novo mínimo.

### Duplo clique e retentativas

O front gera uma `Idempotency-Key` por tentativa e a mantém no reenvio. Reenviar a mesma requisição devolve `200` com `"repetido": true` e **não** cria outro lance. A unicidade `(usuario_id, chave_idempotencia)` no banco é a garantia final.

### Anti-sniping

Lance aceito nos últimos **2 minutos** antes do fim vigente soma **+2 minutos** ao fim vigente (fim 21:00, lance às 20:58 → novo fim 21:02). A extensão se repete em cadeia. O `fim_original_em` é preservado. Um lance no instante exato do fim é recusado.

---

## Encerramento e liquidação

O estado "encerrado" é gravado por uma verificação periódica no servidor [CONFERIR: intervalo] e também **ao ligar o servidor**. Se o servidor estava fora do ar no horário do fim, ao voltar ele encerra o lote **respeitando o horário original**: lances posteriores ao fim já eram recusados, pois a regra compara a hora do servidor com `fim_em`.

Ao encerrar, em uma transação: debita o vencedor (valor comprometido vira pagamento), credita o leiloeiro e grava o **arremate** com um código de comprovante (`ARR-XXXXXXXXXX`). Lote sem lances encerra **sem vencedor** e sem movimentação financeira.

O comprovante é público em `GET /comprovantes/:codigo` e mostra apenas apelidos.

---

## Histórico à prova de adulteração (cadeia de hashes)

**Técnica.** Cada lance guarda o `hash_anterior` e o seu próprio `hash`:

```
hash = SHA-256( loteId | sequencia | usuarioId | valorCentavos | criadoEm | hashAnterior )
```

O primeiro lance de cada lote aponta para um hash inicial de 64 zeros. Alterar qualquer dado de um lance muda a sua impressão digital; e como o hash do lance seguinte inclui o anterior, a quebra se propaga pela cadeia.

**Auditoria** (`GET /lotes/:id/auditoria`, pública). Recalcula a cadeia lance a lance e confere:

| Verificação | Acusa |
| --- | --- |
| Sequência 1, 2, 3 sem buracos | `SEQUENCIA_FORA_DE_ORDEM` |
| Cada lance aponta para o hash do anterior | `ELO_QUEBRADO` |
| O hash recalculado bate com o gravado | `HASH_NAO_CONFERE` |
| Último lance = lance atual e líder do lote | `ULTIMO_LANCE_DIFERE_DO_LANCE_ATUAL`, `ULTIMO_LANCE_DIFERE_DO_LIDER` |
| Arremate = último lance e vencedor | `ARREMATE_DIFERE_DO_ULTIMO_LANCE`, `ARREMATE_DIFERE_DO_VENCEDOR` |

A resposta traz o veredito (`integro` ou `adulterado`), a primeira sequência com problema e o `ultimo_hash`.

**Por que há as conferências cruzadas.** A cadeia sozinha não vê a remoção do **último** lance, porque nenhum lance posterior aponta para ele. Comparar com o estado do lote e do arremate cobre esse caso.

**Ataques testados diretamente no banco (pgAdmin):**

| Ataque | Resultado |
| --- | --- |
| Alterar o valor de um lance | `adulterado`: `HASH_NAO_CONFERE` no lance alterado |
| Inserir um lance falso | `adulterado`: `ELO_QUEBRADO` e `HASH_NAO_CONFERE` |
| Remover o primeiro lance | `adulterado`: `SEQUENCIA_FORA_DE_ORDEM` e `ELO_QUEBRADO` |
| Remover o último lance | `adulterado`: `ULTIMO_LANCE_DIFERE_DO_LANCE_ATUAL` e `ULTIMO_LANCE_DIFERE_DO_LIDER` |
| Desfazer cada alteração | A auditoria volta a `integro` |

**Limitação assumida.** Quem tem acesso ao banco **e** conhece o algoritmo poderia recalcular a cadeia inteira. As conferências cruzadas cobrem parte desse cenário, e o `ultimo_hash` público serve de âncora: quem o guardou antes percebe se ele mudou depois. Uma melhoria futura é misturar um segredo do servidor no hash (HMAC) e publicar âncoras periódicas.

---

## Privacidade

A auditoria e o comprovante usam **apelidos** (`Licitante #XXXXXX`, `Leiloeiro #XXXXXX`), nunca e-mail nem id. O apelido é gerado automaticamente no cadastro.

---

## API externa e resiliência

A busca de itens do leiloeiro usa a API do Metropolitan Museum of Art (categoria de instrumentos musicais, sem chave) e, se ela cair, um catálogo próprio em JSON de reserva. Ao **criar o lote**, título, imagem e atributos são **copiados para o banco**. Por isso a vitrine, a sala, a auditoria e o comprovante continuam funcionando mesmo com a API externa fora do ar.

---

## Endpoints

| Método e caminho | Acesso | Função |
| --- | --- | --- |
| `GET /saude` | Público | Verificação de saúde e hora do banco |
| `POST /auth/cadastro`, `POST /auth/login`, `GET /auth/eu` | Público / logado | Cadastro, login, usuário atual |
| `GET /lotes` | Público | Vitrine (ao vivo, agendados, encerrados) |
| `GET /lotes/:id` | Público | Sala do lote (traz `hora_servidor`, histórico, `posicao_usuario` se logado) |
| `POST /lotes/:id/lances` | Licitante | Dar lance |
| `GET /lotes/:id/auditoria` | Público | Auditoria da cadeia de hashes |
| `GET /comprovantes/:codigo` | Público | Comprovante de arremate |
| `GET /carteira`, `POST /carteira/deposito` | Licitante | Saldo e depósito simulado (até R$ 1.000.000,00) |
| `GET /meus/lances`, `GET /meus/arremates` | Licitante | Lotes com lance e arremates |
| `GET /catalogo/itens?q=` | Leiloeiro | Busca de itens |
| `POST /leiloeiro/lotes`, `GET /leiloeiro/lotes` | Leiloeiro | Criar e listar os próprios lotes |
| `POST /leiloeiro/lotes/:id/cancelar` | Leiloeiro | Cancelar lote sem lances |
| `GET /leiloeiro/resumo` | Leiloeiro | Resultado dos encerrados e total recebido |

Erros seguem o formato `{ "erro": "mensagem", "codigo": "CODIGO" }`.

---

## Comportamentos inesperados e limitações

- **Servidor dormindo.** A primeira requisição após inatividade leva cerca de 1 minuto (plano gratuito do Render).
- **Atualização com pequeno atraso.** A sala atualiza por consulta periódica; um lance de outro usuário pode levar alguns segundos para aparecer.
- **Lotes do seed expiram em 30 dias.** Depois disso, rode `npm run db:reset`.
- **Cadastro permite escolher o papel** (leiloeiro ou licitante), para facilitar a avaliação. Em produção real isso seria restrito.
- **CORS aberto** e **senha do seed pública**, pelo mesmo motivo.
- **O depósito não tem idempotência:** um duplo clique cria dois depósitos. Ele é apenas simulado.
- **Os lotes do seed usam a mesma imagem ilustrativa.** Lotes criados pelo painel com itens do Met trazem imagens reais.
- **O líder não pode cobrir o próprio lance** (`JA_ESTA_GANHANDO`); para subir o valor, outro licitante precisa superá-lo antes.
- **Cancelamento** só vale para lote agendado ou ao vivo e **sem lances**.
- **Lote encerrado no servidor depois do horário:** entre o fim e a execução da verificação periódica, o lote já recusa lances (a regra olha a hora, não o status gravado), mas o arremate pode demorar alguns instantes para aparecer.

---

## Testes realizados

Não há suíte automatizada em framework; os testes foram executados manualmente e por script:

- **Concorrência:** script que dispara 20 lances simultâneos em um lote e confere que o histórico fica sequencial e o saldo comprometido, correto. [CONFERIR: caminho do script e o resultado que você observou]
- **Regras de lance:** abaixo do mínimo, saldo insuficiente, líder repetindo, lote não iniciado e encerrado, idempotência por reenvio.
- **Encerramento:** lote com lance (gera arremate e comprovante) e lote sem lance (encerra sem vencedor).
- **Auditoria:** os quatro ataques da tabela acima, com restauração.
- **Ponta a ponta:** vitrine, login, carteira, lance, comprovante e auditoria no link público.

---

## Como a IA foi usada

Veja o texto entregue no formulário de inscrição. Resumo: o **Claude** foi usado como apoio de estudo e desenvolvimento (explicação linha a linha, revisão e depuração), e o **Gemini**, apenas para consultas e explicações de trechos de código. [CONFERIR: ajuste conforme o que for verdade para o seu front-end]
