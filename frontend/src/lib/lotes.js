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

// Os lotes do seed usam "Origem" e "Época"; os do Met trazem "País", "Cultura",
// "Período" e "Data". Estas duas funções unificam os dois formatos.
export function origemDoLote(lote) {
  const origem = atributo(lote, 'Origem') ?? atributo(lote, 'País') ?? atributo(lote, 'Cultura');
  return origem ? (PAISES[origem] ?? origem) : null;
}

// O Met escreve país ("Italy") ou cultura ("Italian") em inglês. Os mais comuns
// viram o nome do país em português, para "Itália" do seed e "Italy" do Met
// caírem na mesma opção do filtro. O que não estiver aqui aparece como veio.
const PAISES = {
  Italy: 'Itália', Italian: 'Itália',
  Germany: 'Alemanha', German: 'Alemanha',
  France: 'França', French: 'França',
  Spain: 'Espanha', Spanish: 'Espanha',
  England: 'Inglaterra', English: 'Inglaterra', British: 'Inglaterra',
  'United States': 'Estados Unidos', American: 'Estados Unidos',
  Austria: 'Áustria', Austrian: 'Áustria',
  Netherlands: 'Holanda', Dutch: 'Holanda',
  Belgium: 'Bélgica', Belgian: 'Bélgica',
  Switzerland: 'Suíça', Swiss: 'Suíça',
  Scotland: 'Escócia', Scottish: 'Escócia',
  Ireland: 'Irlanda', Irish: 'Irlanda',
  Portugal: 'Portugal', Portuguese: 'Portugal',
  Brazil: 'Brasil', Brazilian: 'Brasil',
  Mexico: 'México', Mexican: 'México',
  Peru: 'Peru', Peruvian: 'Peru',
  Japan: 'Japão', Japanese: 'Japão',
  China: 'China', Chinese: 'China',
  Korea: 'Coreia', Korean: 'Coreia',
  India: 'Índia', Indian: 'Índia',
  Indonesia: 'Indonésia', Javanese: 'Indonésia', Balinese: 'Indonésia',
  Thailand: 'Tailândia', Thai: 'Tailândia',
  Iran: 'Irã', Persian: 'Irã',
  Turkey: 'Turquia', Turkish: 'Turquia',
  Egypt: 'Egito', Egyptian: 'Egito',
  Russia: 'Rússia', Russian: 'Rússia',
  Poland: 'Polônia', Polish: 'Polônia',
  Sweden: 'Suécia', Swedish: 'Suécia',
  Hungary: 'Hungria', Hungarian: 'Hungria',
  Ghana: 'Gana', Nigeria: 'Nigéria',
};

const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

// "ca. 1750" -> "Século XVIII" | "late 19th century" -> "Século XIX"
function seculoDoTexto(texto) {
  const porSeculo = /(\d{1,2})(st|nd|rd|th)\s+century/i.exec(texto);
  const numero = porSeculo ? Number(porSeculo[1]) : null;
  if (numero) {
    return ROMANOS[numero] ? `Século ${ROMANOS[numero]}` : null;
  }
  const porAno = /\b(1\d{3}|20\d{2})\b/.exec(texto);
  if (porAno) {
    // Contagem do dia a dia: 1700 a 1799 = século XVIII.
    const seculo = Math.floor(Number(porAno[1]) / 100) + 1;
    return ROMANOS[seculo] ? `Século ${ROMANOS[seculo]}` : null;
  }
  return null;
}

export function epocaDoLote(lote) {
  const epoca = atributo(lote, 'Época');
  if (epoca) {
    return epoca;
  }
  // Datas sem ano reconhecível ("undated") ficam de fora do filtro.
  const data = atributo(lote, 'Data') ?? atributo(lote, 'Período');
  return data ? seculoDoTexto(data) : null;
}

// "Alemanha · Século XIX" (só o que existir)
export function procedencia(lote) {
  return [origemDoLote(lote), epocaDoLote(lote)].filter(Boolean).join(' · ');
}

export function encerraEm24h(lote, agora = agoraServidor()) {
  const restante = new Date(lote.fim_em).getTime() - agora;
  return lote.situacao === 'ao_vivo' && restante > 0 && restante <= DIA_MS;
}

export function arrematado(lote) {
  return lote.situacao === 'encerrado' && temLance(lote);
}

// Lote em destaque: o ao vivo que encerra primeiro (o mais urgente).
// Sem nenhum ao vivo, o próximo a abrir.
export function escolherDestaque(lotes) {
  return proximoAEncerrar(lotes) ?? proximoAAbrir(lotes);
}

export function proximoAAbrir(lotes) {
  return (
    lotes
      .filter((lote) => lote.situacao === 'agendado')
      .sort((a, b) => new Date(a.inicio_em) - new Date(b.inicio_em))[0] ?? null
  );
}

// O ao vivo que termina primeiro (para a faixa "ao vivo" do topo).
export function proximoAEncerrar(lotes) {
  return lotes
    .filter((lote) => lote.situacao === 'ao_vivo')
    .sort((a, b) => new Date(a.fim_em) - new Date(b.fim_em))[0] ?? null;
}

// Valores distintos calculados por uma função (origem, época...), em ordem
// alfabética. Como vêm dos próprios lotes, um lote novo do Met com outro país
// já aparece no filtro na próxima atualização da lista.
export function valoresDistintos(lotes, extrair) {
  const valores = new Set();
  for (const lote of lotes) {
    const valor = extrair(lote);
    if (valor) {
      valores.add(valor);
    }
  }
  return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

// Busca sem acento e sem diferenciar maiúsculas: "violao" acha "Violão".
export function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
