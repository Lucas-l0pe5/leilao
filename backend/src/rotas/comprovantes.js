import { Router } from 'express';
import { pool } from '../db/pool.js';

const rotas = Router();

const FORMATO_CODIGO = /^ARR-[0-9A-F]{10}$/;

// GET /comprovantes/:codigo  (pública, sem login; só apelidos e códigos)
rotas.get('/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();

  if (!FORMATO_CODIGO.test(codigo)) {
    return res.status(400).json({ erro: 'Código de comprovante inválido.', codigo: 'CODIGO_INVALIDO' });
  }

  const { rows } = await pool.query(
    `SELECT arremates.codigo_comprovante, arremates.valor_centavos, arremates.encerrado_em,
            lotes.id AS lote_id, lotes.titulo, lotes.imagem_url, lotes.atributos,
            vencedor.apelido AS vencedor_apelido,
            leiloeiro.apelido AS leiloeiro_apelido,
            (SELECT count(*) FROM lances WHERE lances.lote_id = lotes.id) AS total_lances
     FROM arremates
     JOIN lotes ON lotes.id = arremates.lote_id
     JOIN usuarios AS vencedor ON vencedor.id = arremates.vencedor_id
     JOIN usuarios AS leiloeiro ON leiloeiro.id = lotes.leiloeiro_id
     WHERE arremates.codigo_comprovante = $1`,
    [codigo]
  );

  if (rows.length === 0) {
    return res.status(404).json({ erro: 'Comprovante não encontrado.', codigo: 'COMPROVANTE_NAO_ENCONTRADO' });
  }

  return res.json(rows[0]);
});

export default rotas;