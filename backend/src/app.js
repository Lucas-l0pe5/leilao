import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import rotasAutenticacao from './rotas/autenticacao.js';
import rotasCarteira from './rotas/carteira.js';
import catalogoRotas from './rotas/catalogo.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/saude', async (req, res) => {
  const { rows } = await pool.query('SELECT now() AS hora_do_banco');
  res.json({ status: 'ok', horaDoBanco: rows[0].hora_do_banco });
});

app.use('/auth', rotasAutenticacao);
app.use('/carteira', rotasCarteira);

const pastaAtual = path.dirname(fileURLToPath(import.meta.url));

app.use('/imagens', express.static(path.join(pastaAtual, '..', 'public', 'imagens')));
app.use('/catalogo', catalogoRotas);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use((erro, req, res, next) => {
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});