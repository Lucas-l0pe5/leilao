// Adaptador do catálogo reserva: lê o JSON local e devolve o mesmo formato do Met.

import { PORT } from '../config.js';
import dados from './reserva.json' with { type: 'json' };

const MAX_ITENS = 12;

const URL_BASE = (process.env.URL_PUBLICA ?? `http://localhost:${PORT}`).replace(/\/$/, '');

function normalizar(texto) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export async function buscarNaReserva(termo) {
  const alvo = normalizar(termo.trim());

  return dados
    .filter((item) => {
      const texto = normalizar(
        [item.titulo, ...item.palavras_chave, ...Object.values(item.atributos)].join(' ')
      );
      return texto.includes(alvo);
    })
    .slice(0, MAX_ITENS)
    .map((item) => ({
      fonte: 'reserva',
      item_externo_id: item.id,
      titulo: item.titulo,
      imagem_url: `${URL_BASE}${item.imagem}`,
      atributos: item.atributos,
    }));
}