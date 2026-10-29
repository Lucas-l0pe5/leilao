// Único ponto do front-end que conversa com o back-end.

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CHAVE_TOKEN = 'leilao.token';

let aoSessaoExpirar = null;

export function quandoSessaoExpirar(funcao) {
  aoSessaoExpirar = funcao;
}

export function lerToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function salvarToken(token) {
  try {
    if (token) {
      localStorage.setItem(CHAVE_TOKEN, token);
    } else {
      localStorage.removeItem(CHAVE_TOKEN);
    }
  } catch {
    // Navegador sem armazenamento (aba anônima restrita): a sessão dura só até recarregar.
  }
}

export class ErroApi extends Error {
  constructor(status, corpo) {
    super(corpo?.erro ?? 'Não foi possível falar com o servidor.');
    this.status = status;
    this.codigo = corpo?.codigo ?? null;
    this.dados = corpo ?? {};
  }
}

export async function api(caminho, { metodo = 'GET', corpo, cabecalhos = {} } = {}) {
  const token = lerToken();
  const opcoes = { method: metodo, headers: { ...cabecalhos } };

  if (token) {
    opcoes.headers.Authorization = `Bearer ${token}`;
  }
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(`${BASE}${caminho}`, opcoes);
  } catch {
    throw new ErroApi(0, {
      erro: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
      codigo: 'SEM_CONEXAO',
    });
  }

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    if (resposta.status === 401 && token && aoSessaoExpirar) {
      aoSessaoExpirar();
    }
    throw new ErroApi(resposta.status, dados);
  }

  return dados;
}
