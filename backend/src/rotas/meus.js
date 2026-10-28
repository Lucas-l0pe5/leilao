import { Router } from 'express';
import { pool } from '../db/pool.js';
import { exigirLogin, exigirPapel } from '../middleware/autenticacao.js';
import { SITUACAO_SQL } from '../lotes/situacao.js';

const rotas = Router();

// Tudo aqui é só do licitante logado.
rotas.use(exigirLogin, exigirPapel('licitante'));

// GET /meus/lances  -> lotes em que eu dei lance, com a minha posição
rotas.get('/lances', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT lotes.id AS lote_id, lotes.titulo, lotes.imagem_url,
            lotes.lance_atual_centavos, lotes.fim_em,
            ${SITUACAO_SQL} AS situacao,
            COALESCE(lotes.lider_id = $1, false) AS sou_lider,
            meus.meu_maior_lance_centavos,
            arremates.codigo_comprovante
     FROM lotes
     JOIN (SELECT lote_id, MAX(valor_centavos) AS meu_maior_lance_centavos
           FROM lances WHERE usuario_id = $1 GROUP BY lote_id) AS meus
       ON meus.lote_id = lotes.id
     LEFT JOIN arremates
       ON arremates.lote_id = lotes.id AND arremates.vencedor_id = $1
     ORDER BY lotes.fim_em DESC
     LIMIT 100`,
    [req.usuario.id]
  );

  const lances = rows.map(({ sou_lider, ...lote }) => {
    const encerrado = lote.situacao === 'encerrado';
    let posicao;
    if (sou_lider) {
      posicao = encerrado ? 'venceu' : 'ganhando';
    } else {
      posicao = encerrado ? 'perdeu' : 'superado';
    }
    return { ...lote, posicao };
  });

  return res.json(lances);
});

// GET /meus/arremates  -> lotes que eu venci, com comprovante
rotas.get('/arremates', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT arremates.codigo_comprovante, arremates.valor_centavos, arremates.encerrado_em,
            lotes.id AS lote_id, lotes.titulo, lotes.imagem_url
     FROM arremates
     JOIN lotes ON lotes.id = arremates.lote_id
     WHERE arremates.vencedor_id = $1
     ORDER BY arremates.encerrado_em DESC`,
    [req.usuario.id]
  );

  const arremates = rows.map((a) => ({
    ...a,
    caminho_publico: `/comprovantes/${a.codigo_comprovante}`,
  }));

  return res.json(arremates);
});

export default rotas;