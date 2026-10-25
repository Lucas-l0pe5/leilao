import { Router } from 'express';
import { pool } from '../db/pool.js';
import { exigirLogin, exigirPapel } from '../middleware/autenticacao.js';

const rotas = Router();

const LIMITE_DEPOSITO_CENTAVOS = 100000000;

const COLUNAS_SALDO = `
  saldo_total_centavos AS total,
  saldo_comprometido_centavos AS comprometido,
  saldo_total_centavos - saldo_comprometido_centavos AS disponivel
`;

rotas.get('/', exigirLogin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS_SALDO} FROM carteiras WHERE usuario_id = $1`,
    [req.usuario.id]
  );
  return res.json(rows[0]);
});

rotas.post('/deposito', exigirLogin, exigirPapel('licitante'), async (req, res) => {
  const valor = req.body?.valor_centavos;

  if (!Number.isInteger(valor) || valor <= 0 || valor > LIMITE_DEPOSITO_CENTAVOS) {
    return res.status(400).json({
      erro: 'Informe um valor inteiro de centavos, maior que zero e de até R$ 1.000.000,00.',
    });
  }

  const { rows } = await pool.query(
    `UPDATE carteiras
     SET saldo_total_centavos = saldo_total_centavos + $1
     WHERE usuario_id = $2
     RETURNING ${COLUNAS_SALDO}`,
    [valor, req.usuario.id]
  );
  return res.status(201).json(rows[0]);
});

export default rotas;