// POST /lotes/:id/lances: o coração do sistema.
// Tudo acontece dentro de UMA transação, com o lote trancado (FOR UPDATE).
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { exigirLogin, exigirPapel } from '../middleware/autenticacao.js';
import { calcularHash, HASH_INICIAL } from '../lances/hash.js';

const rotas = Router();

const LIMITE_VALOR_CENTAVOS = 100000000;
const JANELA_ANTI_SNIPING_MS = 2 * 60 * 1000; // 2 minutos em milissegundos
const EXTENSAO_ANTI_SNIPING_MS = 2 * 60 * 1000; // 2 minutos em milissegundos
const FORMATO_CHAVE = /^[A-Za-z0-9_-]{8,100}$/;

rotas.post('/:id/lances', exigirLogin, exigirPapel('licitante'), async (req, res) => {
  // ---- 1. Validação do pedido (antes de gastar uma conexão do banco) ----
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'Identificador de lote inválido.', codigo: 'LOTE_INVALIDO' });
  }
  const loteId = Number(req.params.id);

  const valor = req.body?.valor_centavos;
  if (!Number.isInteger(valor) || valor <= 0 || valor > LIMITE_VALOR_CENTAVOS) {
    return res.status(400).json({
      erro: 'Informe um valor inteiro de centavos, maior que zero e de até R$ 1.000.000,00.',
      codigo: 'VALOR_INVALIDO',
    });
  }

  const chave = req.get('Idempotency-Key');
  if (typeof chave !== 'string' || !FORMATO_CHAVE.test(chave)) {
    return res.status(400).json({
      erro: 'Envie o cabeçalho Idempotency-Key com 8 a 100 caracteres (letras, números, _ ou -).',
      codigo: 'CHAVE_INVALIDA',
    });
  }

  // ---- 2. Transação ----
  const cliente = await pool.connect();

  async function recusar(status, codigo, mensagem, extra = {}) {
    await cliente.query('ROLLBACK');
    return res.status(status).json({ erro: mensagem, codigo, ...extra });
  }

  try {
    await cliente.query('BEGIN');

    // 2.1 Tranca a linha do lote. Quem chegar depois espera aqui (fila).
    const { rows: lotes } = await cliente.query(
      `SELECT id, status, inicio_em, fim_em, lance_inicial_centavos,
              incremento_minimo_centavos, lance_atual_centavos, lider_id
       FROM lotes WHERE id = $1 FOR UPDATE`,
      [loteId]
    );
    const lote = lotes[0];
    if (!lote) {
      return await recusar(404, 'LOTE_NAO_ENCONTRADO', 'Lote não encontrado.');
    }

    // 2.2 Idempotência (já com o lote trancado, para o retry simultâneo ver o lance do primeiro)
    const { rows: repetidos } = await cliente.query(
      `SELECT lote_id, sequencia, valor_centavos, criado_em
       FROM lances WHERE usuario_id = $1 AND chave_idempotencia = $2`,
      [req.usuario.id, chave]
    );
    if (repetidos.length > 0) {
      const anterior = repetidos[0];
      if (anterior.lote_id !== loteId || anterior.valor_centavos !== valor) {
        return await recusar(
          409,
          'CHAVE_REUTILIZADA',
          'Esta chave de idempotência já foi usada em outro pedido.'
        );
      }
      await cliente.query('COMMIT');
      return res.status(200).json({
        repetido: true,
        lance: {
          sequencia: anterior.sequencia,
          valor_centavos: anterior.valor_centavos,
          criado_em: anterior.criado_em,
        },
      });
    }

    // 2.3 Hora oficial: lida DEPOIS da trava, com clock_timestamp()
    const { rows: relogio } = await cliente.query('SELECT clock_timestamp() AS agora');
    const agora = relogio[0].agora;

    // 2.4 Regras de estado do lote
    if (lote.status === 'cancelado') {
      return await recusar(409, 'LOTE_CANCELADO', 'Este lote foi cancelado.');
    }
    if (lote.status === 'encerrado' || agora >= lote.fim_em) {
      return await recusar(409, 'LOTE_ENCERRADO', 'Este lote já encerrou.');
    }
    if (agora < lote.inicio_em) {
      return await recusar(409, 'LOTE_NAO_INICIADO', 'Este lote ainda não foi iniciado.');
    }
    if (lote.lider_id === req.usuario.id) {
      return await recusar(409, 'JA_ESTA_GANHANDO', 'Você já está ganhando este lote.');
    }

    // 2.5 Regra do valor mínimo
    const primeiroLance = lote.lance_atual_centavos === null;
    const minimo = primeiroLance
      ? lote.lance_inicial_centavos
      : lote.lance_atual_centavos + lote.incremento_minimo_centavos;
    if (valor < minimo) {
      return await recusar(
        422,
        'LANCE_ABAIXO_DO_MINIMO',
        'O lance está abaixo do mínimo permitido.',
        { minimo_centavos: minimo }
      );
    }

    // 2.6 Trava as carteiras envolvidas, sempre em ordem de id (evita deadlock)
    const envolvidos = lote.lider_id === null ? [req.usuario.id] : [req.usuario.id, lote.lider_id];
    const { rows: carteiras } = await cliente.query(
      `SELECT usuario_id, saldo_total_centavos, saldo_comprometido_centavos
       FROM carteiras WHERE usuario_id = ANY($1::bigint[])
       ORDER BY usuario_id FOR UPDATE`,
      [envolvidos]
    );
    const minhaCarteira = carteiras.find((c) => c.usuario_id === req.usuario.id);
    if (!minhaCarteira) {
      throw new Error(`Carteira não encontrada para o usuário ${req.usuario.id}`);
    }
    const disponivel = minhaCarteira.saldo_total_centavos - minhaCarteira.saldo_comprometido_centavos;
    if (valor > disponivel) {
      return await recusar(422, 'SALDO_INSUFICIENTE', 'Saldo disponível insuficiente para este lance.', {
        disponivel_centavos: disponivel,
      });
    }

    // 2.7 Próxima posição da cadeia de hashes
    const { rows: ultimos } = await cliente.query(
      `SELECT sequencia, hash FROM lances
       WHERE lote_id = $1 ORDER BY sequencia DESC LIMIT 1`,
      [loteId]
    );
    const sequencia = (ultimos[0]?.sequencia ?? 0) + 1;
    const hashAnterior = ultimos[0]?.hash ?? HASH_INICIAL;
    const hash = calcularHash({
      loteId,
      sequencia,
      usuarioId: req.usuario.id,
      valorCentavos: valor,
      criadoEm: agora,
      hashAnterior,
    });

    // 2.8 Grava o lance
    await cliente.query(
      `INSERT INTO lances
         (lote_id, sequencia, usuario_id, valor_centavos, chave_idempotencia,
          criado_em, hash_anterior, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [loteId, sequencia, req.usuario.id, valor, chave, agora, hashAnterior, hash]
    );

    // 2.9 Saldo: libera o líder anterior e compromete o novo líder
    if (lote.lider_id !== null) {
      await cliente.query(
        `UPDATE carteiras
         SET saldo_comprometido_centavos = saldo_comprometido_centavos - $1
         WHERE usuario_id = $2`,
        [lote.lance_atual_centavos, lote.lider_id]
      );
    }
    await cliente.query(
      `UPDATE carteiras
       SET saldo_comprometido_centavos = saldo_comprometido_centavos + $1
       WHERE usuario_id = $2`,
      [valor, req.usuario.id]
    );

    // 2.10 Anti-sniping
    const prorrogar = lote.fim_em.getTime() - agora.getTime() <= JANELA_ANTI_SNIPING_MS;
    const novoFim = prorrogar
      ? new Date(lote.fim_em.getTime() + EXTENSAO_ANTI_SNIPING_MS)
      : lote.fim_em;

    // 2.11 Atualiza o lote (novo líder, novo lance atual, fim possivelmente prorrogado)
    await cliente.query(
      `UPDATE lotes
       SET lance_atual_centavos = $1, lider_id = $2, fim_em = $3
       WHERE id = $4`,
      [valor, req.usuario.id, novoFim, loteId]
    );

    await cliente.query('COMMIT');

    return res.status(201).json({
      lance: { sequencia, valor_centavos: valor, criado_em: agora },
      lote: {
        id: loteId,
        lance_atual_centavos: valor,
        fim_em: novoFim,
        prorrogado: prorrogar,
      },
      situacao_usuario: 'ganhando',
    });
  } catch (erro) {
    await cliente.query('ROLLBACK');

    if (erro.code === '23505' && erro.constraint?.includes('chave_idempotencia')) {
      return res.status(409).json({
        erro: 'Esta chave de idempotência já foi usada em outro pedido.',
        codigo: 'CHAVE_REUTILIZADA',
      });
    }
    if (erro.code === '40P01' || erro.code === '40001') {
      return res.status(503).json({
        erro: 'Muitos lances ao mesmo tempo. Tente novamente.',
        codigo: 'TENTE_NOVAMENTE',
      });
    }
    throw erro;
  } finally {
    cliente.release();
  }
});

export default rotas;