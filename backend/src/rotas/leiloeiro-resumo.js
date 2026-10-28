import { Router } from 'express';
import { pool } from '../db/pool.js';
import { exigirLogin, exigirPapel } from '../middleware/autenticacao.js';
import { SITUACAO_SQL } from '../lotes/situacao.js';

const rotas = Router();

rotas.use(exigirLogin, exigirPapel('leiloeiro'));

// GET /leiloeiro/resumo  -> total recebido + resultado de cada lote encerrado
rotas.get('/resumo', async (req, res) => {
  const { rows: totais } = await pool.query(
    `SELECT COALESCE(SUM(arremates.valor_centavos), 0)::bigint AS total_recebido_centavos,
            count(*) AS total_arrematados
     FROM arremates
     JOIN lotes ON lotes.id = arremates.lote_id
     WHERE lotes.leiloeiro_id = $1`,
    [req.usuario.id]
  );

  const { rows } = await pool.query(
    `SELECT lotes.id, lotes.titulo, lotes.fim_em,
            ${SITUACAO_SQL} AS situacao,
            arremates.valor_centavos AS valor_arrematado_centavos,
            arremates.codigo_comprovante,
            vencedor.apelido AS vencedor_apelido
     FROM lotes
     LEFT JOIN arremates ON arremates.lote_id = lotes.id
     LEFT JOIN usuarios AS vencedor ON vencedor.id = arremates.vencedor_id
     WHERE lotes.leiloeiro_id = $1
       AND lotes.status <> 'cancelado'
       AND (lotes.status = 'encerrado' OR lotes.fim_em <= clock_timestamp())
     ORDER BY lotes.fim_em DESC
     LIMIT 100`,
    [req.usuario.id]
  );

  const encerrados = rows.map((lote) => ({
    ...lote,
    arrematado: lote.codigo_comprovante !== null,
  }));

  return res.json({
    total_recebido_centavos: totais[0].total_recebido_centavos,
    total_arrematados: totais[0].total_arrematados,
    encerrados,
  });
});

export default rotas;