// Dinheiro sempre em centavos inteiros. Nada de 0.1 + 0.2.

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarCentavos(centavos) {
  if (centavos === null || centavos === undefined) {
    return '—';
  }
  return formatador.format(centavos / 100);
}

// 60050 -> "600,50" (para preencher um campo de texto)
export function centavosParaTexto(centavos) {
  const reais = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  return `${reais},${resto}`;
}

// "1.250,50" -> 125050 | "600.5" -> 60050 | "abc" -> null
export function textoParaCentavos(texto) {
  let limpo = String(texto).replace(/R\$|\s/g, '');

  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '');
  } else if (/^\d+\.\d{1,2}$/.test(limpo)) {
    limpo = limpo.replace('.', ',');
  } else {
    limpo = limpo.replace(/\./g, '');
  }

  const partes = /^(\d{1,9})(?:,(\d{1,2}))?$/.exec(limpo);
  if (!partes) {
    return null;
  }

  const reais = Number(partes[1]);
  const centavos = Number((partes[2] ?? '').padEnd(2, '0'));
  return reais * 100 + centavos;
}
