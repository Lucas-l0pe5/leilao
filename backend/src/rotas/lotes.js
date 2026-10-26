// Vitrine pública: qualquer pessoa vê os lotes, sem login.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { SITUACAO_SQL } from '../lotes/situacao.js';

const rotas = Router();

const SITUACOES_VALIDAS = ['ao_vivo', 'agendado', 'encerrado'];

rotas.get('/', async (req, res) => {
  const situacao = req.query.situacao;

  if (situacao !== undefined && !SITUACOES_VALIDAS.includes(situacao)) {
    return res.status(400).json({ erro: 'Situação inválida. Use ao_vivo, agendado ou encerrado.' });
  }

  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT lotes.id,
              lotes.titulo,
              lotes.imagem_url,
              lotes.atributos,
              lotes.lance_inicial_centavos,
              lotes.incremento_minimo_centavos,
              lotes.lance_atual_centavos,
              lotes.inicio_em,
              lotes.fim_em,
              ${SITUACAO_SQL} AS situacao,
              leiloeiro.apelido AS leiloeiro_apelido,
              lider.apelido AS lider_apelido
       FROM lotes
       JOIN usuarios AS leiloeiro ON leiloeiro.id = lotes.leiloeiro_id
       LEFT JOIN usuarios AS lider ON lider.id = lotes.lider_id
       WHERE lotes.status <> 'cancelado'
     ) AS vitrine
     WHERE ($1::text IS NULL OR situacao = $1::text)
     ORDER BY CASE situacao WHEN 'ao_vivo' THEN 1 WHEN 'agendado' THEN 2 ELSE 3 END,
              CASE WHEN situacao = 'ao_vivo' THEN fim_em
                   WHEN situacao = 'agendado' THEN inicio_em END ASC,
              fim_em DESC
     LIMIT 200`,
    [situacao ?? null]
  );

  return res.json(rows);
});

export default rotas;