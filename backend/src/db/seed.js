import bcrypt from 'bcrypt';
import { pool } from './pool.js';

const SENHA_PADRAO = 'Leilao@2026';

const usuariosSeed = [
  { email: 'leiloeiro@leilao.test', papel: 'leiloeiro', apelido: 'Leiloeiro #SEED01', saldo: 0 },
  { email: 'licitante1@leilao.test', papel: 'licitante', apelido: 'Licitante #SEED02', saldo: 500000 },
  { email: 'licitante2@leilao.test', papel: 'licitante', apelido: 'Licitante #SEED03', saldo: 500000 },
];

const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
const cliente = await pool.connect();

try {
  await cliente.query('BEGIN');

  for (const usuario of usuariosSeed) {
    const { rows } = await cliente.query(
      `INSERT INTO usuarios (email, senha_hash, papel, apelido)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash
       RETURNING id`,
      [usuario.email, senhaHash, usuario.papel, usuario.apelido]
    );

    await cliente.query(
      `INSERT INTO carteiras (usuario_id, saldo_total_centavos)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id) DO UPDATE SET saldo_total_centavos = EXCLUDED.saldo_total_centavos`,
      [rows[0].id, usuario.saldo]
    );
  }

  await cliente.query('COMMIT');
  console.log('Seed aplicado: 1 leiloeiro e 2 licitantes (senha: ' + SENHA_PADRAO + ').');
} catch (erro) {
  await cliente.query('ROLLBACK');
  console.error('Erro no seed:', erro.message);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}