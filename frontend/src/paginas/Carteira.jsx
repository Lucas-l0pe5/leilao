import { useState } from 'react';
import { api } from '../lib/api.js';
import { useConsulta } from '../lib/useConsulta.js';
import { formatarCentavos, textoParaCentavos } from '../lib/dinheiro.js';
import { useSessao } from '../sessao.jsx';
import { Carregando, Falha } from '../componentes/Estado.jsx';
import CampoDinheiro from '../componentes/CampoDinheiro.jsx';

const ATALHOS = [10000, 50000, 100000];
const LIMITE_DEPOSITO_CENTAVOS = 100000000; // o mesmo limite do back-end: R$ 1.000.000,00

// Mensagem de erro do campo de depósito, ou null se está tudo certo.
function validarDeposito(texto, centavos, tocado) {
  if (texto !== '' && centavos === null) {
    return 'Valor inválido. Use o formato 1.000,00.';
  }
  if (centavos > LIMITE_DEPOSITO_CENTAVOS) {
    return `O depósito máximo é ${formatarCentavos(LIMITE_DEPOSITO_CENTAVOS)}.`;
  }
  if (tocado && (texto === '' || centavos === 0)) {
    return 'Digite um valor maior que zero.';
  }
  return null;
}

export default function Carteira() {
  const { usuario } = useSessao();
  const { dados: saldo, erro, carregando, recarregar } = useConsulta(() => api('/carteira'), usuario.id, 5000);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState(null);
  const [tocado, setTocado] = useState(false);

  const centavos = textoParaCentavos(texto);
  const erroDoCampo = validarDeposito(texto, centavos, tocado);

  async function depositar(evento) {
    evento.preventDefault();
    setTocado(true);
    if (validarDeposito(texto, centavos, true)) {
      return; // o campo já mostra o motivo, com a borda vermelha
    }
    setEnviando(true);
    setRetorno(null);
    try {
      await api('/carteira/deposito', { metodo: 'POST', corpo: { valor_centavos: centavos } });
      await recarregar();
      setRetorno({ tipo: 'sucesso', texto: `Depósito de ${formatarCentavos(centavos)} feito.` });
      setTexto('');
      setTocado(false);
    } catch (falha) {
      setRetorno({ tipo: 'erro', texto: falha.message });
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <Carregando texto="Abrindo a carteira…" />;
  }
  if (!saldo) {
    return <Falha erro={erro} aoTentar={recarregar} />;
  }

  return (
    <div className="estreita">
      <h1 className="titulo-pagina">Carteira</h1>

      <div className="saldo">
        <div className="saldo__principal">
          <span className="saldo__rotulo">Disponível para lances</span>
          <span className="saldo__valor numero">{formatarCentavos(saldo.disponivel)}</span>
        </div>
        <dl className="saldo__detalhes">
          <div>
            <dt>Total</dt>
            <dd className="numero">{formatarCentavos(saldo.total)}</dd>
          </div>
          <div>
            <dt>Comprometido</dt>
            <dd className="numero">{formatarCentavos(saldo.comprometido)}</dd>
          </div>
        </dl>
        <p className="texto-suave">
          Comprometido é o valor dos lotes em que você está ganhando. Se alguém cobrir seu lance, ele volta na hora para o disponível.
        </p>
      </div>

      {usuario.papel === 'licitante' ? (
        <form className="bloco pilha" onSubmit={depositar}>
          <h2>Depósito simulado</h2>
          <div className="atalhos">
            {ATALHOS.map((valor) => (
              <button key={valor} type="button" className="botao botao--secundario botao--pequeno" onClick={() => setTexto(String(valor / 100))}>
                {formatarCentavos(valor)}
              </button>
            ))}
          </div>
          <CampoDinheiro
            rotulo="Valor"
            valor={texto}
            aoMudar={setTexto}
            erro={erroDoCampo}
            placeholder="1.000,00"
            onBlur={() => texto !== '' && setTocado(true)}
          />
          <button type="submit" className="botao botao--primario" disabled={enviando}>
            {enviando ? 'Depositando…' : centavos ? `Depositar ${formatarCentavos(centavos)}` : 'Depositar'}
          </button>
          {retorno && (
            <p key={retorno.texto} className={`aviso aviso--${retorno.tipo}`} role="status">
              {retorno.texto}
            </p>
          )}
        </form>
      ) : (
        <p className="aviso aviso--neutro">Os valores dos lotes arrematados entram aqui automaticamente quando o lote encerra.</p>
      )}
    </div>
  );
}
