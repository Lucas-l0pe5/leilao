// Regras de apresentação dos lotes, usadas pela vitrine, pelo destaque e pela busca.
// Nada aqui chama a API: são funções puras que recebem os lotes e devolvem respostas.

import { agoraServidor } from './tempo.js';

const DIA_MS = 24 * 60 * 60 * 1000;

// 7 -> "Lote 007"
export function numeroLote(id) {
  return `Lote ${String(id).padStart(3, '0')}`;
}

export function temLance(lote) {
  return lote.lance_atual_centavos !== null && lote.lance_atual_centavos !== undefined;
}

// O valor que importa para o comprador: o lance atual ou, sem lances, o inicial.
export function valorDoLote(lote) {
  return temLance(lote) ? lote.lance_atual_centavos : lote.lance_inicial_centavos;
}

export function atributo(lote, nome) {
  return lote.atributos?.[nome] ?? null;
}

// "Alemanha · Século XIX" (só o que existir)
export function procedencia(lote) {
  return [atributo(lote, 'Origem'), atributo(lote, 'Época')].filter(Boolean).join(' · ');
}

export function encerraEm24h(lote, agora = agoraServidor()) {
  const restante = new Date(lote.fim_em).getTime() - agora;
  return lote.situacao === 'ao_vivo' && restante > 0 && restante <= DIA_MS;
}

export function arrematado(lote) {
  return lote.situacao === 'encerrado' && temLance(lote);
}

// Lote em destaque: o ao vivo mais disputado (maior lance); sem lances,
// o que encerra primeiro; sem nenhum ao vivo, o próximo a abrir.
export function escolherDestaque(lotes) {
  const aoVivo = lotes.filter((lote) => lote.situacao === 'ao_vivo');
  if (aoVivo.length > 0) {
    return aoVivo.reduce((melhor, lote) => {
      const a = melhor.lance_atual_centavos ?? -1;
      const b = lote.lance_atual_centavos ?? -1;
      if (b !== a) {
        return b > a ? lote : melhor;
      }
      return new Date(lote.fim_em) < new Date(melhor.fim_em) ? lote : melhor;
    });
  }
  return lotes.find((lote) => lote.situacao === 'agendado') ?? null;
}

// O ao vivo que termina primeiro (para a faixa "ao vivo" do topo).
export function proximoAEncerrar(lotes) {
  return lotes
    .filter((lote) => lote.situacao === 'ao_vivo')
    .sort((a, b) => new Date(a.fim_em) - new Date(b.fim_em))[0] ?? null;
}

// Valores distintos de um atributo, em ordem alfabética (para os filtros).
export function valoresDoAtributo(lotes, nome) {
  const valores = new Set();
  for (const lote of lotes) {
    const valor = atributo(lote, nome);
    if (valor) {
      valores.add(valor);
    }
  }
  return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Busca sem acento e sem diferenciar maiúsculas: "violao" acha "Violão".
export function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Procura no título, nos atributos (marca, época, origem...) e no número do lote.
export function combinaComBusca(lote, termo) {
  const alvo = normalizar(termo);
  if (!alvo) {
    return true;
  }
  const numero = alvo.replace(/^(lote\s*|#)/, '');
  if (/^\d+$/.test(numero) && Number(numero) === lote.id) {
    return true;
  }
  const texto = normalizar([lote.titulo, ...Object.values(lote.atributos ?? {})].join(' '));
  return texto.includes(alvo);
}
