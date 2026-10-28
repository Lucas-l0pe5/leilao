import { Router } from 'express';
import { pool } from '../db/pool.js';
import { SITUACAO_SQL } from '../lotes/situacao.js';
import { loginOpcional } from '../middleware/autenticacao-opcional.js';

const rotas = Router();

const MAX_HISTORICO = 200;

// GET /lotes/:id  (pública; se vier token, devolve também a posição do usuário)
rotas.get('/:id', loginOpcional, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'Identificador de lote inválido.', codigo: 'LOTE_INVALIDO' });
  }
  const loteId = Number(req.params.id);
  const usuarioId = req.usuario?.id ?? null;

  const { rows: lotes } = await pool.query(
    `SELECT lotes.id, lotes.titulo, lotes.imagem_url, lotes.atributos,
            lotes.lance_inicial_centavos, lotes.incremento_minimo_centavos,
            lotes.lance_atual_centavos, lotes.inicio_em, lotes.fim_original_em, lotes.fim_em,
            lotes.lider_id,
            ${SITUACAO_SQL} AS situacao,
            leiloeiro.apelido AS leiloeiro_apelido,
            lider.apelido AS lider_apelido,
            (SELECT count(*) FROM lances WHERE lances.lote_id = lotes.id) AS total_lances,
            EXISTS (SELECT 1 FROM lances
                    WHERE lances.lote_id = lotes.id AND lances.usuario_id = $2::bigint) AS ja_dei_lance,
            clock_timestamp() AS agora
     FROM lotes
     JOIN usuarios AS leiloeiro ON leiloeiro.id = lotes.leiloeiro_id
     LEFT JOIN usuarios AS lider ON lider.id = lotes.lider_id
     WHERE lotes.id = $1`,
    [loteId, usuarioId]
  );
  const lote = lotes[0];

  if (!lote || lote.situacao === 'cancelado') {
    return res.status(404).json({ erro: 'Lote não encontrado.', codigo: 'LOTE_NAO_ENCONTRADO' });
  }

  const { rows: historico } = await pool.query(
    `SELECT lances.sequencia, lances.valor_centavos, lances.criado_em, usuarios.apelido
     FROM lances
     JOIN usuarios ON usuarios.id = lances.usuario_id
     WHERE lances.lote_id = $1
     ORDER BY lances.sequencia DESC
     LIMIT $2`,
    [loteId, MAX_HISTORICO]
  );

  const encerrado = lote.situacao === 'encerrado';
  let posicao = 'visitante';
  if (req.usuario?.papel === 'leiloeiro') {
    posicao = 'leiloeiro';
  } else if (req.usuario?.papel === 'licitante') {
    if (lote.lider_id === usuarioId) {
      posicao = encerrado ? 'venceu' : 'ganhando';
    } else if (lote.ja_dei_lance) {
      posicao = encerrado ? 'perdeu' : 'superado';
    } else {
      posicao = 'sem_lance';
    }
  }

  const proximoMinimo =
    lote.lance_atual_centavos === null
      ? lote.lance_inicial_centavos
      : lote.lance_atual_centavos + lote.incremento_minimo_centavos;

  const { lider_id, ja_dei_lance, agora, ...publico } = lote;

  return res.json({
    ...publico,
    hora_servidor: agora,
    proximo_minimo_centavos: proximoMinimo,
    posicao_usuario: posicao,
    historico,
  });
});

export default rotas;