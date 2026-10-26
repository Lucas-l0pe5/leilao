// Adaptador do Met Museum: busca na API pública e converte para o formato único.

const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const BASE_BUSCA = 'https://collectionapi.metmuseum.org/public/collection/v1.1';
const DEPARTAMENTO_INSTRUMENTOS = 18;
const MAX_ITENS = 12;
const IDS_POR_BUSCA = 30;
const TIMEOUT_MS = 5000;

async function buscarJson(url, sinal) {
  const resposta = await fetch(url, { signal: sinal });
  if (!resposta.ok) {
    throw new Error(`Met respondeu ${resposta.status}`);
  }
  return resposta.json();
}

function textoOuNada(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function converterObjeto(objeto) {
  if (!objeto.isPublicDomain || !objeto.primaryImageSmall) {
    return null;
  }

  const campos = {
    'Data': textoOuNada(objeto.objectDate),
    'Período': textoOuNada(objeto.period),
    'Cultura': textoOuNada(objeto.culture),
    'País': textoOuNada(objeto.country),
    'Material': textoOuNada(objeto.medium),
    'Artista': textoOuNada(objeto.artistDisplayName),
    'Classificação': textoOuNada(objeto.classification),
  };

  const atributos = {};
  for (const [nome, valor] of Object.entries(campos)) {
    if (valor) {
      atributos[nome] = valor;
    }
  }

  return {
    fonte: 'met',
    item_externo_id: String(objeto.objectID),
    titulo: textoOuNada(objeto.title) ?? 'Sem título',
    imagem_url: objeto.primaryImageSmall,
    atributos,
  };
}

export async function buscarNoMet(termo) {
  const sinal = AbortSignal.timeout(TIMEOUT_MS);

  const parametros = new URLSearchParams({
    departmentId: String(DEPARTAMENTO_INSTRUMENTOS),
    hasImages: 'true',
    q: termo,
    offset: '0',
    limit: String(IDS_POR_BUSCA),
  });

  const busca = await buscarJson(`${BASE_BUSCA}/search?${parametros}`, sinal);
  const ids = (busca.objectIDs ?? []).slice(0, IDS_POR_BUSCA);

  if (ids.length === 0) {
    return [];
  }

  const resultados = await Promise.allSettled(
    ids.map((id) => buscarJson(`${BASE}/objects/${id}`, sinal))
  );

  const objetos = resultados
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  if (objetos.length === 0) {
    throw new Error('Met não devolveu os detalhes dos itens');
  }

  return objetos
    .map(converterObjeto)
    .filter((item) => item !== null)
    .slice(0, MAX_ITENS);
}