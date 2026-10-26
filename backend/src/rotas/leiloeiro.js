// Painel do leiloeiro: criar lote, listar os próprios lotes e cancelar lote sem lances.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { exigirLogin, exigirPapel } from '../middleware/autenticacao.js';
import { SITUACAO_SQL } from '../lotes/situacao.js';

const rotas = Router();

rotas.use(exigirLogin, exigirPapel('leiloeiro'));

const LIMITE_VALOR_CENTAVOS = 100000000;
const FONTES_VALIDAS = ['met', 'reserva'];
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function lerData(valor) {
  if (typeof valor !== 'string' || !FORMATO_DATA.test(valor)) {
    return null;
  }
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function centavosValidos(valor) {
  return Number.isInteger(valor) && valor > 0 && valor <= LIMITE_VALOR_CENTAVOS;
}

function atributosValidos(atributos) {
  if (atributos === null || typeof atributos !== 'object' || Array.isArray(atributos)) {
    return false;
  }
  const entradas = Object.entries(atributos);
  return (
    entradas.length <= 20 &&
    entradas.every(
      ([nome, valor]) => nome.length <= 60 && typeof valor === 'string' && valor.length <= 300
    )
  );
}

rotas.post('/lotes', async (req, res) => {
  const corpo = req.body ?? {};
  const titulo = typeof corpo.titulo === 'string' ? corpo.titulo.trim() : '';
  const itemExternoId = typeof corpo.item_externo_id === 'string' ? corpo.item_externo_id.trim() : '';
  const atributos = corpo.atributos ?? {};
  const inicio = lerData(corpo.inicio_em);
  const fim = lerData(corpo.fim_em);

  if (!FONTES_VALIDAS.includes(corpo.fonte)) {
    return res.status(400).json({ erro: 'Fonte do item inválida. Use "met" ou "reserva".' });
  }
  if (itemExternoId === '' || itemExternoId.length > 100) {
    return res.status(400).json({ erro: 'Informe o item_externo_id do item escolhido.' });
  }
  if (titulo === '' || titulo.length > 200) {
    return res.status(400).json({ erro: 'O título é obrigatório e deve ter até 200 caracteres.' });
  }
  if (
    corpo.imagem_url !== undefined &&
    corpo.imagem_url !== null &&
    (typeof corpo.imagem_url !== 'string' ||
      corpo.imagem_url.length > 500 ||
      !/^https?:\/\//.test(corpo.imagem_url))
  ) {
    return res.status(400).json({ erro: 'A imagem deve ser uma URL http(s) de até 500 caracteres.' });
  }
  if (!atributosValidos(atributos)) {
    return res.status(400).json({
      erro: 'Os atributos devem ser um objeto com até 20 campos de texto.',
    });
  }
  if (!centavosValidos(corpo.lance_inicial_centavos)) {
    return res.status(400).json({
      erro: 'O lance inicial deve ser um inteiro de centavos, maior que zero e de até R$ 1.000.000,00.',
    });
  }
  if (!centavosValidos(corpo.incremento_minimo_centavos)) {
    return res.status(400).json({
      erro: 'O incremento mínimo deve ser um inteiro de centavos, maior que zero e de até R$ 1.000.000,00.',
    });
  }
  if (!inicio || !fim) {
    return res.status(400).json({
      erro: 'Informe inicio_em e fim_em em formato ISO com fuso, ex.: 2026-10-30T20:00:00-03:00.',
    });
  }
  if (fim <= inicio) {
    return res.status(400).json({ erro: 'O fim deve ser depois do início.' });
  }

  const { rows: relogio } = await pool.query('SELECT clock_timestamp() AS agora');
  if (fim <= relogio[0].agora) {
    return res.status(400).json({ erro: 'O fim do lote precisa estar no futuro.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO lotes
       (leiloeiro_id, fonte, item_externo_id, titulo, imagem_url, atributos,
        lance_inicial_centavos, incremento_minimo_centavos, inicio_em, fim_original_em, fim_em)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $10)
     RETURNING lotes.*, ${SITUACAO_SQL} AS situacao`,
    [
      req.usuario.id, corpo.fonte,
      itemExternoId,
      titulo,
      corpo.imagem_url ?? null,
      JSON.stringify(atributos),
      corpo.lance_inicial_centavos,
      corpo.incremento_minimo_centavos,
      inicio.toISOString(),
      fim.toISOString(),
    ]
  );

  return res.status(201).json(rows[0]);
});

rotas.get('/lotes', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT lotes.id,
            lotes.titulo,
            lotes.imagem_url,
            lotes.atributos,
            lotes.lance_inicial_centavos,
            lotes.incremento_minimo_centavos,
            lotes.lance_atual_centavos,
            lotes.inicio_em,
            lotes.fim_em,
            ${SITUACAO_SQL} AS situacao,
            (SELECT count(*) FROM lances WHERE lances.lote_id = lotes.id) AS total_lances
     FROM lotes
     WHERE lotes.leiloeiro_id = $1
     ORDER BY lotes.id DESC`,
    [req.usuario.id]
  );

  const lotes = rows.map((lote) => ({
    ...lote,
    pode_cancelar:
      (lote.situacao === 'agendado' || lote.situacao === 'ao_vivo') && lote.total_lances === 0,
  }));

  return res.json(lotes);
});

rotas.post('/lotes/:id/cancelar', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'Identificador de lote inválido.' });
  }
  const loteId = Number(req.params.id);

  const cliente = await pool.connect();

  async function recusar(codigo, mensagem) {
    await cliente.query('ROLLBACK');
    return res.status(codigo).json({ erro: mensagem });
  }

  try {
    await cliente.query('BEGIN');

    const { rows } = await cliente.query(
      `SELECT leiloeiro_id, status, fim_em, clock_timestamp() AS agora
       FROM lotes
       WHERE id = $1
       FOR UPDATE`,
      [loteId]
    );
    const lote = rows[0];

    if (!lote) {
      return await recusar(404, 'Lote não encontrado.');
    }
    if (lote.leiloeiro_id !== req.usuario.id) {
      return await recusar(403, 'Este lote pertence a outro leiloeiro.');
    }
    if (lote.status === 'cancelado') {
      return await recusar(409, 'Este lote já foi cancelado.');
    }
    if (lote.status === 'encerrado' || lote.fim_em <= lote.agora) {
      return await recusar(409, 'Este lote já encerrou e não pode ser cancelado.');
    }

    const { rows: busca } = await cliente.query(
      'SELECT EXISTS (SELECT 1 FROM lances WHERE lote_id = $1) AS tem_lances',
      [loteId]
    );
    if (busca[0].tem_lances) {
      return await recusar(409, 'Lotes que já receberam lances não podem ser cancelados.');
    }

    await cliente.query("UPDATE lotes SET status = 'cancelado' WHERE id = $1", [loteId]);
    await cliente.query('COMMIT');

    return res.json({ id: loteId, situacao: 'cancelado' });
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
});

export default rotas;