DROP TABLE IF EXISTS arremates, lances, lotes, carteiras, usuarios CASCADE;

CREATE TABLE usuarios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('leiloeiro', 'licitante')),
  apelido TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE carteiras (
  usuario_id BIGINT PRIMARY KEY REFERENCES usuarios(id),
  saldo_total_centavos BIGINT NOT NULL DEFAULT 0 CHECK (saldo_total_centavos >= 0),
  saldo_comprometido_centavos BIGINT NOT NULL DEFAULT 0 CHECK (saldo_comprometido_centavos >= 0),
  CHECK (saldo_comprometido_centavos <= saldo_total_centavos)
);

CREATE TABLE lotes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  leiloeiro_id BIGINT NOT NULL REFERENCES usuarios(id),
  fonte TEXT NOT NULL,
  item_externo_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  imagem_url TEXT,
  atributos JSONB NOT NULL DEFAULT '{}',
  lance_inicial_centavos BIGINT NOT NULL CHECK (lance_inicial_centavos > 0),
  incremento_minimo_centavos BIGINT NOT NULL CHECK (incremento_minimo_centavos > 0),
  inicio_em TIMESTAMPTZ NOT NULL,
  fim_original_em TIMESTAMPTZ NOT NULL,
  fim_em TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'encerrado', 'cancelado')),
  lance_atual_centavos BIGINT,
  lider_id BIGINT REFERENCES usuarios(id),
  CHECK (fim_original_em > inicio_em),
  CHECK (fim_em >= fim_original_em)
);

CREATE TABLE lances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id BIGINT NOT NULL REFERENCES lotes(id),
  sequencia INT NOT NULL,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  chave_idempotencia TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  hash_anterior TEXT NOT NULL,
  hash TEXT NOT NULL,
  UNIQUE (lote_id, sequencia),
  UNIQUE (usuario_id, chave_idempotencia)
);

CREATE TABLE arremates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id BIGINT NOT NULL UNIQUE REFERENCES lotes(id),
  vencedor_id BIGINT NOT NULL REFERENCES usuarios(id),
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  codigo_comprovante TEXT NOT NULL UNIQUE,
  encerrado_em TIMESTAMPTZ NOT NULL
);