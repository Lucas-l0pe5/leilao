import pg from 'pg';

pg.types.setTypeParser(20, (valor) => Number(valor));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.on('error', (erro) => {
  console.error('Erro em uma conexão ociosa do banco:', erro.message);
});