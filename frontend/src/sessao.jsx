// Guarda "quem está logado" e oferece entrar, cadastrar e sair para o app inteiro.

import { createContext, useContext, useEffect, useState } from 'react';
import { api, lerToken, quandoSessaoExpirar, salvarToken } from './lib/api.js';

const ContextoSessao = createContext(null);

export function ProvedorSessao({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [pronto, setPronto] = useState(() => !lerToken());

  useEffect(() => {
    quandoSessaoExpirar(() => {
      salvarToken(null);
      setUsuario(null);
    });

    if (!lerToken()) {
      return;
    }

    api('/auth/eu')
      .then((resposta) => setUsuario(resposta.usuario))
      .catch((erro) => {
        if (erro.status === 401 || erro.status === 404) {
          salvarToken(null);
        }
      })
      .finally(() => setPronto(true));
  }, []);

  async function entrar(email, senha) {
    salvarToken(null);
    const resposta = await api('/auth/login', { metodo: 'POST', corpo: { email, senha } });
    salvarToken(resposta.token);
    setUsuario(resposta.usuario);
    return resposta.usuario;
  }

  async function cadastrar(email, senha, papel) {
    salvarToken(null);
    const resposta = await api('/auth/cadastro', { metodo: 'POST', corpo: { email, senha, papel } });
    salvarToken(resposta.token);
    setUsuario(resposta.usuario);
    return resposta.usuario;
  }

  function sair() {
    salvarToken(null);
    setUsuario(null);
  }

  return (
    <ContextoSessao.Provider value={{ usuario, pronto, entrar, cadastrar, sair }}>
      {children}
    </ContextoSessao.Provider>
  );
}

export function useSessao() {
  return useContext(ContextoSessao);
}
