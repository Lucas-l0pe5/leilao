import { readFileSync } from 'node:fs';
import pg from 'pg';

const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log('Banco criado com sucesso.');
} catch (erro) {
  console.error('Erro ao criar o banco:', erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}