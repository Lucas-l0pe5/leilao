import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import rotasAutenticacao from './rotas/autenticacao.js';
import rotasCarteira from './rotas/carteira.js';
import catalogoRotas from './rotas/catalogo.js';
import rotasLotes from './rotas/lotes.js';
import rotasLances from './rotas/lances.js';
import rotasSala from './rotas/sala.js';
import rotasMeus from './rotas/meus.js';
import rotasComprovantes from './rotas/comprovantes.js';
import rotasAuditoria from './rotas/auditoria.js';
import rotasLeiloeiro from './rotas/leiloeiro.js';
import rotasLeiloeiroResumo from './rotas/leiloeiro-resumo.js';
import helmet from 'helmet';

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

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
app.use('/lotes', rotasLotes);
app.use('/lotes', rotasLances);
app.use('/lotes', rotasSala);
app.use('/lotes', rotasAuditoria);
app.use('/meus', rotasMeus);
app.use('/comprovantes', rotasComprovantes);
app.use('/leiloeiro', rotasLeiloeiroResumo);
app.use('/leiloeiro', rotasLeiloeiro);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use((erro, req, res, next) => {
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo do pedido.' });
  }
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});