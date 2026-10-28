// Encerramento e liquidação de lotes.
// Roda ao ligar o servidor e depois a cada poucos segundos.
import { randomBytes } from 'node:crypto';
import { pool } from '../db/pool.js';

const INTERVALO_MS = 2000;
const MAXIMO_POR_RODADA = 50;

function gerarCodigoComprovante() {
  return `ARR-${randomBytes(5).toString('hex').toUpperCase()}`;
}

// Encerra UM lote. Devolve: 'liquidado', 'sem_lances', 'ainda_aberto' ou 'ignorado'.
export async function encerrarLote(loteId) {
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    // Mesma trava dos lances: enquanto encerramos, ninguém dá lance neste lote.
    const { rows } = await cliente.query(
      `SELECT id, leiloeiro_id, status, fim_em, lance_atual_centavos, lider_id
       FROM lotes WHERE id = $1 FOR UPDATE`,
      [loteId]
    );
    const lote = rows[0];

    if (!lote || lote.status !== 'aberto') {
      await cliente.query('ROLLBACK');
      return 'ignorado';
    }

    // O fim pode ter sido empurrado por um lance (anti-sniping) depois da busca.
    const { rows: relogio } = await cliente.query('SELECT clock_timestamp() AS agora');
    if (relogio[0].agora < lote.fim_em) {
      await cliente.query('ROLLBACK');
      return 'ainda_aberto';
    }

    // Sem lances: encerra sem vencedor.
    if (lote.lider_id === null) {
      await cliente.query("UPDATE lotes SET status = 'encerrado' WHERE id = $1", [loteId]);
      await cliente.query('COMMIT');
      return 'sem_lances';
    }

    // Trava as duas carteiras, em ordem de id (mesma ordem usada nos lances).
    await cliente.query(
      `SELECT usuario_id FROM carteiras
       WHERE usuario_id = ANY($1::bigint[])
       ORDER BY usuario_id FOR UPDATE`,
      [[lote.lider_id, lote.leiloeiro_id]]
    );

    // Debita o vencedor (total e comprometido) e credita o leiloeiro.
    await cliente.query(
      `UPDATE carteiras
       SET saldo_total_centavos = saldo_total_centavos - $1,
           saldo_comprometido_centavos = saldo_comprometido_centavos - $1
       WHERE usuario_id = $2`,
      [lote.lance_atual_centavos, lote.lider_id]
    );
    await cliente.query(
      `UPDATE carteiras
       SET saldo_total_centavos = saldo_total_centavos + $1
       WHERE usuario_id = $2`,
      [lote.lance_atual_centavos, lote.leiloeiro_id]
    );

    // Comprovante. O horário de encerramento é o fim oficial do lote, não o
    // instante em que o servidor acordou e fez a liquidação.
    await cliente.query(
      `INSERT INTO arremates (lote_id, vencedor_id, valor_centavos, codigo_comprovante, encerrado_em)
       VALUES ($1, $2, $3, $4, $5)`,
      [loteId, lote.lider_id, lote.lance_atual_centavos, gerarCodigoComprovante(), lote.fim_em]
    );

    await cliente.query("UPDATE lotes SET status = 'encerrado' WHERE id = $1", [loteId]);
    await cliente.query('COMMIT');
    return 'liquidado';
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

let rodando = false;

export async function encerrarVencidos() {
  if (rodando) {
    return;
  }
  rodando = true;

  try {
    const { rows } = await pool.query(
      `SELECT id FROM lotes
       WHERE status = 'aberto' AND fim_em <= clock_timestamp()
       ORDER BY fim_em ASC
       LIMIT $1`,
      [MAXIMO_POR_RODADA]
    );

    for (const { id } of rows) {
      try {
        const resultado = await encerrarLote(id);
        if (resultado === 'liquidado' || resultado === 'sem_lances') {
          console.log(`Lote ${id} encerrado (${resultado}).`);
        }
      } catch (erro) {
        console.error(`Falha ao encerrar o lote ${id}:`, erro.message);
      }
    }
  } catch (erro) {
    console.error('Falha ao procurar lotes vencidos:', erro.message);
  } finally {
    rodando = false;
  }
}

export function iniciarEncerrador() {
  encerrarVencidos();
  setInterval(encerrarVencidos, INTERVALO_MS);
}