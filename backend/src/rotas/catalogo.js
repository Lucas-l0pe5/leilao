// Rotas do catálogo de itens (apenas leiloeiro).

import { Router } from 'express';
import { exigirLogin, exigirPapel } from '../middleware/autenticacao.js';
import { buscarItens } from '../catalogo/index.js';

const rotas = Router();

rotas.get('/itens', exigirLogin, exigirPapel('leiloeiro'), async (req, res, next) => {
  try {
    const termo = typeof req.query.q === 'string' ? req.query.q : '';
    const resultado = await buscarItens(termo);
    res.json(resultado);
  } catch (erro) {
    next(erro);
  }
});

export default rotas;