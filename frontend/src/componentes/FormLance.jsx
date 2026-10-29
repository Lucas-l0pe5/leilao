// Formulário de lance com proteção contra duplo clique e reenvio (Idempotency-Key).

import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api.js';
import { centavosParaTexto, formatarCentavos, textoParaCentavos } from '../lib/dinheiro.js';

function mensagemDoErro(erro) {
  const dados = erro.dados ?? {};

  switch (erro.codigo) {
    case 'LANCE_ABAIXO_DO_MINIMO':
      return `Lance abaixo do mínimo. Agora o mínimo é ${formatarCentavos(dados.minimo_centavos)}.`;
    case 'SALDO_INSUFICIENTE':
      return `Saldo insuficiente. Você tem ${formatarCentavos(dados.disponivel_centavos)} disponíveis.`;
    case 'JA_ESTA_GANHANDO':
      return 'Você já está ganhando este lote. Não é preciso cobrir o próprio lance.';
    case 'LOTE_NAO_INICIADO':
      return 'Este lote ainda não começou. Os lances abrem no horário de início.';
    case 'LOTE_ENCERRADO':
      return 'Este lote já encerrou. Não é mais possível dar lances.';
    case 'LOTE_CANCELADO':
      return 'Este lote foi cancelado pelo leiloeiro.';
    case 'TENTE_NOVAMENTE':
      return 'Muitos lances ao mesmo tempo. Tente de novo em instantes.';
    default:
      return erro.message;
  }
}

function novaChave() {
  return crypto.randomUUID();
}

// Atalhos de valor: 1, 2 e 5 incrementos acima do lance atual.
// Sem lances ainda, o primeiro atalho é o próprio lance inicial.
function atalhosDeLance(lote) {
  const atual = lote.lance_atual_centavos;
  const incremento = lote.incremento_minimo_centavos;

  return [1, 2, 5].map((vezes) => {
    if (atual !== null) {
      return { valor: atual + vezes * incremento, rotulo: `+ ${formatarCentavos(vezes * incremento)}` };
    }
    const extra = (vezes - 1) * incremento;
    return {
      valor: lote.lance_inicial_centavos + extra,
      rotulo: extra === 0 ? 'Lance inicial' : `+ ${formatarCentavos(extra)}`,
    };
  });
}

export default function FormLance({ lote, aoAtualizar }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const tentativa = useRef({ valor: null, chave: null });

  const minimo = lote.proximo_minimo_centavos;
  const centavos = textoParaCentavos(texto);

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) {
      return;
    }
    if (centavos === null || centavos <= 0) {
      setAviso({ tipo: 'erro', texto: 'Digite um valor válido, por exemplo 650,00.' });
      return;
    }

    if (tentativa.current.valor !== centavos) {
      tentativa.current = { valor: centavos, chave: novaChave() };
    }

    setEnviando(true);
    setAviso(null);

    try {
      const resposta = await api(`/lotes/${lote.id}/lances`, {
        metodo: 'POST',
        corpo: { valor_centavos: centavos },
        cabecalhos: { 'Idempotency-Key': tentativa.current.chave },
      });

      tentativa.current = { valor: null, chave: null };
      setTexto('');
      setAviso({
        tipo: 'sucesso',
        texto: resposta.lote?.prorrogado
          ? 'Lance aceito! Faltavam menos de 2 minutos, então o fim foi prorrogado.'
          : 'Lance aceito! Você está ganhando.',
      });
      aoAtualizar?.();
    } catch (erro) {
      setAviso({
        tipo: 'erro',
        codigo: erro.codigo,
        texto: mensagemDoErro(erro),
        minimo: erro.dados?.minimo_centavos,
      });
      if (erro.codigo === 'LANCE_ABAIXO_DO_MINIMO') {
        aoAtualizar?.();
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-lance" onSubmit={enviar} noValidate>
      <div className="atalhos-lance" role="group" aria-label="Valores rápidos">
        {atalhosDeLance(lote).map((atalho) => (
          <button
            key={atalho.valor}
            type="button"
            className="atalho-lance"
            aria-pressed={centavos === atalho.valor}
            onClick={() => setTexto(centavosParaTexto(atalho.valor))}
          >
            <span className="atalho-lance__rotulo">{atalho.rotulo}</span>
            <span className="atalho-lance__valor numero">{formatarCentavos(atalho.valor)}</span>
          </button>
        ))}
      </div>

      <label className="campo">
        <span className="campo__rotulo">Seu lance</span>
        <span className="campo__moeda">
          <span aria-hidden="true">R$</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder={centavosParaTexto(minimo)}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-describedby="dica-lance"
          />
        </span>
      </label>

      <p id="dica-lance" className="form-lance__dica">
        Mínimo agora: <strong className="numero">{formatarCentavos(minimo)}</strong>
        <span aria-hidden="true">·</span>
        incremento de {formatarCentavos(lote.incremento_minimo_centavos)}
      </p>

      <button type="submit" className="botao botao--primario botao--largo" disabled={enviando}>
        {enviando
          ? 'Enviando…'
          : centavos
            ? `Dar lance de ${formatarCentavos(centavos)}`
            : 'Dar lance'}
      </button>

      {aviso && (
        <div key={aviso.texto} className={`aviso aviso--${aviso.tipo}`} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>
          <p>{aviso.texto}</p>
          {aviso.codigo === 'SALDO_INSUFICIENTE' && <Link to="/carteira">Depositar na carteira</Link>}
          {aviso.codigo === 'LANCE_ABAIXO_DO_MINIMO' && aviso.minimo && (
            <button type="button" className="link-botao" onClick={() => setTexto(centavosParaTexto(aviso.minimo))}>
              Preencher com {formatarCentavos(aviso.minimo)}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
