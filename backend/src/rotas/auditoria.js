import { Router } from 'express';
import { pool } from '../db/pool.js';
import { calcularHash, HASH_INICIAL } from '../lances/hash.js';

const rotas = Router();

// GET /lotes/:id/auditoria  (pública, sem login)
rotas.get('/:id/auditoria', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'Identificador de lote inválido.', codigo: 'LOTE_INVALIDO' });
  }
  const loteId = Number(req.params.id);

  // 1) O lote (o cancelado não aparece em lugar nenhum, igual à sala).
  const { rows: [lote] } = await pool.query(
    `SELECT id, titulo, status, lance_atual_centavos, lider_id
       FROM lotes
      WHERE id = $1`,
    [loteId]
  );
  if (!lote || lote.status === 'cancelado') {
    return res.status(404).json({ erro: 'Lote não encontrado.', codigo: 'LOTE_NAO_ENCONTRADO' });
  }

  // 2) Todos os lances, do primeiro ao último, com o apelido (nunca o id).
  const { rows: lances } = await pool.query(
    `SELECT lances.sequencia, lances.usuario_id, lances.valor_centavos,
            lances.criado_em, lances.hash_anterior, lances.hash,
            usuarios.apelido
       FROM lances
       JOIN usuarios ON usuarios.id = lances.usuario_id
      WHERE lances.lote_id = $1
      ORDER BY lances.sequencia ASC`,
    [loteId]
  );

  // 3) Recalcula a cadeia lance a lance.
  let hashEsperado = HASH_INICIAL;
  let primeiraQuebra = null;

  const historico = lances.map((l, i) => {
    const problemas = [];

    if (l.sequencia !== i + 1) problemas.push('SEQUENCIA_FORA_DE_ORDEM');
    if (l.hash_anterior !== hashEsperado) problemas.push('ELO_QUEBRADO');

    const recalculado = calcularHash({
      loteId,
      sequencia: l.sequencia,
      usuarioId: l.usuario_id,
      valorCentavos: l.valor_centavos,
      criadoEm: l.criado_em,
      hashAnterior: l.hash_anterior,
    });
    if (recalculado !== l.hash) problemas.push('HASH_NAO_CONFERE');

    hashEsperado = l.hash;

    const integro = problemas.length === 0;
    if (!integro && primeiraQuebra === null) primeiraQuebra = l.sequencia;

    return {
      sequencia: l.sequencia,
      apelido: l.apelido,
      valor_centavos: l.valor_centavos,
      criado_em: l.criado_em,
      hash: l.hash,
      integro,
      problemas,
    };
  });

  // 4) Conferências cruzadas: pegam o que a cadeia sozinha não vê
  //    (por exemplo, apagar o ÚLTIMO lance).
  const inconsistencias = [];
  const ultimo = lances[lances.length - 1];

  if (!ultimo) {
    if (lote.lance_atual_centavos !== null || lote.lider_id !== null) {
      inconsistencias.push('LOTE_TEM_LANCE_MAS_HISTORICO_VAZIO');
    }
  } else {
    if (ultimo.valor_centavos !== lote.lance_atual_centavos) {
      inconsistencias.push('ULTIMO_LANCE_DIFERE_DO_LANCE_ATUAL');
    }
    if (ultimo.usuario_id !== lote.lider_id) {
      inconsistencias.push('ULTIMO_LANCE_DIFERE_DO_LIDER');
    }
  }

  const { rows: [arremate] } = await pool.query(
    `SELECT valor_centavos, vencedor_id FROM arremates WHERE lote_id = $1`,
    [loteId]
  );
  if (arremate) {
    if (!ultimo || arremate.valor_centavos !== ultimo.valor_centavos) {
      inconsistencias.push('ARREMATE_DIFERE_DO_ULTIMO_LANCE');
    }
    if (!ultimo || arremate.vencedor_id !== ultimo.usuario_id) {
      inconsistencias.push('ARREMATE_DIFERE_DO_VENCEDOR');
    }
  }

  const integro = primeiraQuebra === null && inconsistencias.length === 0;

  res.json({
    lote_id: lote.id,
    titulo: lote.titulo,
    veredito: integro ? 'integro' : 'adulterado',
    total_lances: lances.length,
    primeira_quebra_sequencia: primeiraQuebra,
    inconsistencias,
    ultimo_hash: ultimo ? ultimo.hash : null,
    historico,
  });
});

export default rotas;