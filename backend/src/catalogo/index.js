// Ponto único de busca de itens: tenta o Met e, se falhar, usa a reserva.

import { buscarNoMet } from './met.js';
import { buscarNaReserva } from './reserva.js';

// O Met exige o parâmetro 'q'. Se o leiloeiro não digitar nada, usamos um termo genérico.
const TERMO_PADRAO = 'instrument';

export async function buscarItens(termo) {
  const termoLimpo = (termo ?? '').trim();

  try {
    const termoMet = termoLimpo === '' ? TERMO_PADRAO : termoLimpo;
    const itens = await buscarNoMet(termoMet);
    return { fonte: 'met', itens };
  } catch (erro) {
    console.warn('Met indisponível, usando reserva:', erro.message, erro.cause);
    const itens = await buscarNaReserva(termoLimpo);
    return {
      fonte: 'reserva',
      itens,
      aviso: 'Catálogo do Met indisponível. Exibindo o catálogo reserva.',
    };
  }
}