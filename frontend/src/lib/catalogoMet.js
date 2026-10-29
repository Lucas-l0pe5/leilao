// Ponte de idioma entre o leiloeiro (português) e o catálogo do Met (inglês).
// A API do Met só entende termos em inglês. Aqui traduzimos a BUSCA antes de
// enviar ("violino" -> "violin") e damos um rótulo em português aos RESULTADOS.
// É um dicionário fechado de instrumentos: rápido, sem custo e sem depender de
// outra API. Palavras fora dele seguem como foram digitadas (marcas, nomes próprios).

import { normalizar } from './lotes.js';

// [como se escreve em português, termo em inglês]. Expressões de mais de uma
// palavra ficam no topo, para "flauta doce" não virar "flute doce".
const DICIONARIO = [
  ['gaita de foles', 'bagpipe'],
  ['flauta doce', 'recorder'],
  ['flauta transversal', 'flute'],
  ['violino', 'violin'],
  ['viola', 'viola'],
  ['violoncelo', 'cello'],
  ['contrabaixo', 'double bass'],
  ['violão', 'guitar'],
  ['guitarra', 'guitar'],
  ['bandolim', 'mandolin'],
  ['alaúde', 'lute'],
  ['harpa', 'harp'],
  ['cítara', 'zither'],
  ['lira', 'lyre'],
  ['banjo', 'banjo'],
  ['cavaquinho', 'ukulele'],
  ['sitar', 'sitar'],
  ['flauta', 'flute'],
  ['pífano', 'fife'],
  ['clarinete', 'clarinet'],
  ['oboé', 'oboe'],
  ['fagote', 'bassoon'],
  ['saxofone', 'saxophone'],
  ['trompete', 'trumpet'],
  ['trombone', 'trombone'],
  ['trompa', 'horn'],
  ['corneta', 'cornet'],
  ['tuba', 'tuba'],
  ['gaita', 'harmonica'],
  ['acordeão', 'accordion'],
  ['sanfona', 'accordion'],
  ['piano', 'piano'],
  ['cravo', 'harpsichord'],
  ['órgão', 'organ'],
  ['teclado', 'keyboard'],
  ['tambor', 'drum'],
  ['bateria', 'drum'],
  ['pandeiro', 'tambourine'],
  ['sino', 'bell'],
  ['xilofone', 'xylophone'],
  ['gongo', 'gong'],
  ['castanholas', 'castanets'],
  ['chocalho', 'rattle'],
  ['cordas', 'string'],
  ['sopro', 'wind'],
  ['metais', 'brass'],
  ['percussão', 'percussion'],
  ['instrumentos', 'instrument'],
  ['instrumento', 'instrument'],
];

const EXPRESSOES = DICIONARIO.filter(([pt]) => pt.includes(' ')).map(([pt, en]) => [normalizar(pt), en]);
const PALAVRAS = new Map(DICIONARIO.filter(([pt]) => !pt.includes(' ')).map(([pt, en]) => [normalizar(pt), en]));

// "Violino antigo" -> { termo: 'violin', traduzido: true }
// Quando alguma palavra é traduzida, as outras ("antigo", "de", "cauda") saem:
// em português, elas só fariam o Met não achar nada. Sem nenhuma tradução,
// o texto vai como foi digitado (pode ser inglês ou um nome, como "Stradivari").
export function traduzirBusca(texto) {
  let resto = normalizar(texto);
  const partes = [];
  let traduzido = false;

  for (const [pt, en] of EXPRESSOES) {
    if (resto.includes(pt)) {
      partes.push(en);
      resto = resto.replace(pt, ' ');
      traduzido = true;
    }
  }

  for (const palavra of resto.split(/\s+/).filter(Boolean)) {
    const en = PALAVRAS.get(palavra);
    if (en) {
      partes.push(en);
      traduzido = true;
    }
  }

  return traduzido ? { termo: [...new Set(partes)].join(' '), traduzido } : { termo: texto.trim(), traduzido };
}

// Inglês -> português, para rotular os resultados. Termos mais longos primeiro
// ("double bass" antes de "bass"); se dois nomes em português dão o mesmo termo
// em inglês, vale o primeiro da lista ("guitar" -> "Violão").
const PARA_PORTUGUES = [];
// Palavras soltas primeiro: "flute" vira "Flauta", e não "Flauta transversal".
const PALAVRAS_ANTES = [...DICIONARIO].sort((a, b) => a[0].includes(' ') - b[0].includes(' '));
for (const [pt, en] of PALAVRAS_ANTES) {
  if (!PARA_PORTUGUES.some(([existente]) => existente === en) && en !== 'instrument') {
    PARA_PORTUGUES.push([en, pt, new RegExp(`\\b${en}s?\\b`)]);
  }
}
PARA_PORTUGUES.sort((a, b) => b[0].length - a[0].length);

// "Violin, Stainer model" -> "Violino" | sem correspondência -> null
export function rotuloEmPortugues(tituloEmIngles) {
  const titulo = normalizar(tituloEmIngles);
  const achado = PARA_PORTUGUES.find(([, , padrao]) => padrao.test(titulo));
  return achado ? achado[1].charAt(0).toUpperCase() + achado[1].slice(1) : null;
}
