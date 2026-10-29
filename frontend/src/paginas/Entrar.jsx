import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useSessao } from '../sessao.jsx';

const CONTAS_DE_TESTE = [
  { email: 'leiloeiro@leilao.test', rotulo: 'Leiloeiro' },
  { email: 'licitante1@leilao.test', rotulo: 'Licitante 1' },
  { email: 'licitante2@leilao.test', rotulo: 'Licitante 2' },
];
const SENHA_DE_TESTE = 'Leilao@2026';

export default function Entrar() {
  const { usuario, entrar, cadastrar } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();

  const [modo, setModo] = useState('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState('licitante');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  if (usuario && !enviando) {
    return <Navigate to="/" replace />;
  }

  function destinoPara(quem) {
    if (local.state?.de) {
      return local.state.de;
    }
    return quem.papel === 'leiloeiro' ? '/painel' : '/';
  }

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const quem = modo === 'entrar' ? await entrar(email, senha) : await cadastrar(email, senha, papel);
      navegar(destinoPara(quem), { replace: true });
    } catch (falha) {
      setErro(falha.message);
      setEnviando(false);
    }
  }

  function usarConta(conta) {
    setModo('entrar');
    setEmail(conta.email);
    setSenha(SENHA_DE_TESTE);
    setErro(null);
  }

  return (
    <div className="entrar">
      <div className="entrar__cartao">
        <div className="segmentos segmentos--largo" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'entrar'}
            className={modo === 'entrar' ? 'segmentos__item segmentos__item--ativo' : 'segmentos__item'}
            onClick={() => setModo('entrar')}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'cadastro'}
            className={modo === 'cadastro' ? 'segmentos__item segmentos__item--ativo' : 'segmentos__item'}
            onClick={() => setModo('cadastro')}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={enviar} className="pilha">
          <label className="campo">
            <span className="campo__rotulo">E-mail</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Senha</span>
            <input
              type="password"
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              minLength={modo === 'cadastro' ? 8 : undefined}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            {modo === 'cadastro' && <span className="campo__ajuda">Pelo menos 8 caracteres.</span>}
          </label>

          {modo === 'cadastro' && (
            <fieldset className="papeis">
              <legend className="campo__rotulo">Como você vai usar?</legend>
              <label className={papel === 'licitante' ? 'papel papel--ativo' : 'papel'}>
                <input type="radio" name="papel" value="licitante" checked={papel === 'licitante'} onChange={() => setPapel('licitante')} />
                <strong>Licitante</strong>
                <span>Deposita saldo e dá lances.</span>
              </label>
              <label className={papel === 'leiloeiro' ? 'papel papel--ativo' : 'papel'}>
                <input type="radio" name="papel" value="leiloeiro" checked={papel === 'leiloeiro'} onChange={() => setPapel('leiloeiro')} />
                <strong>Leiloeiro</strong>
                <span>Cria e gerencia lotes.</span>
              </label>
            </fieldset>
          )}

          {erro && (
            <p className="aviso aviso--erro" role="alert">
              {erro}
            </p>
          )}

          <button type="submit" className="botao botao--primario botao--largo" disabled={enviando}>
            {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>

      <aside className="entrar__teste">
        <p className="campo__rotulo">Contas de demonstração</p>
        <p className="texto-suave">Senha de todas: {SENHA_DE_TESTE}</p>
        <div className="entrar__contas">
          {CONTAS_DE_TESTE.map((conta) => (
            <button key={conta.email} type="button" className="botao botao--secundario botao--pequeno" onClick={() => usarConta(conta)}>
              {conta.rotulo}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
