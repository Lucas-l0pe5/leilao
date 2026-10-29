// Auditoria pública: o servidor recalcula a cadeia de hashes e diz se algo foi adulterado.

import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../lib/api.js';
import { useConsulta } from '../lib/useConsulta.js';
import { formatarCentavos } from '../lib/dinheiro.js';
import { formatarHora, formatarDataHora } from '../lib/tempo.js';
import { Carregando, Falha, Girador } from '../componentes/Estado.jsx';

const PROBLEMAS = {
  SEQUENCIA_FORA_DE_ORDEM: 'Número de sequência fora de ordem (lance removido ou inserido).',
  ELO_QUEBRADO: 'O hash anterior não bate com o lance de trás (a corrente foi cortada).',
  HASH_NAO_CONFERE: 'Os dados deste lance foram alterados depois de gravados.',
  LOTE_TEM_LANCE_MAS_HISTORICO_VAZIO: 'O lote tem lance atual, mas o histórico está vazio.',
  ULTIMO_LANCE_DIFERE_DO_LANCE_ATUAL: 'O último lance não bate com o lance atual do lote.',
  ULTIMO_LANCE_DIFERE_DO_LIDER: 'O autor do último lance não é o líder registrado no lote.',
  ARREMATE_DIFERE_DO_ULTIMO_LANCE: 'O valor do arremate não bate com o último lance.',
  ARREMATE_DIFERE_DO_VENCEDOR: 'O vencedor do arremate não é o autor do último lance.',
};

// Tempo mínimo com o girador à mostra. Sem isso, numa resposta rápida o botão
// "pisca" e a pessoa não sabe se a verificação aconteceu.
const MINIMO_VISIVEL_MS = 450;

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

// Botão "Verificar de novo": gira enquanto o servidor recalcula a cadeia e,
// no fim, diz o horário da última verificação.
function BotaoVerificar({ aoVerificar }) {
  const [verificando, setVerificando] = useState(false);
  const [verificadoEm, setVerificadoEm] = useState(null);

  async function verificar() {
    setVerificando(true);
    await Promise.all([aoVerificar(), esperar(MINIMO_VISIVEL_MS)]);
    setVerificando(false);
    setVerificadoEm(new Date().toISOString());
  }

  return (
    <div className="verificar">
      <button type="button" className="botao botao--secundario botao--pequeno" onClick={verificar} disabled={verificando}>
        {verificando && <Girador />}
        {verificando ? 'Verificando…' : 'Verificar de novo'}
      </button>
      {verificadoEm && !verificando && (
        <span key={verificadoEm} className="verificar__retorno" role="status">
          Cadeia recalculada às {formatarHora(verificadoEm)}
        </span>
      )}
    </div>
  );
}

function encurtar(hash) {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export default function Auditoria() {
  const { id } = useParams();
  const { dados: a, erro, carregando, recarregar } = useConsulta(() => api(`/lotes/${id}/auditoria`), id);

  if (carregando) {
    return <Carregando texto="Recalculando a cadeia de hashes…" />;
  }
  if (!a) {
    return <Falha erro={erro} aoTentar={recarregar} />;
  }

  const integro = a.veredito === 'integro';

  return (
    <div className="auditoria">
      <Link to={`/lotes/${a.lote_id}`} className="link-voltar">
        Voltar para a sala
      </Link>
      <h1 className="titulo-pagina">Auditoria · {a.titulo}</h1>

      <div className={integro ? 'veredito veredito--integro' : 'veredito veredito--adulterado'} role="status">
        <strong>{integro ? 'Histórico íntegro' : 'Histórico adulterado'}</strong>
        <span>
          {integro
            ? `Os ${a.total_lances} lances conferem, um a um, com a cadeia de hashes.`
            : a.primeira_quebra_sequencia
              ? `A cadeia quebra a partir do lance #${a.primeira_quebra_sequencia}.`
              : 'A cadeia de lances confere, mas os dados do lote não batem com ela.'}
        </span>
        <BotaoVerificar aoVerificar={recarregar} />
      </div>

      {a.inconsistencias.length > 0 && (
        <ul className="aviso aviso--erro">
          {a.inconsistencias.map((codigo) => (
            <li key={codigo}>{PROBLEMAS[codigo] ?? codigo}</li>
          ))}
        </ul>
      )}

      <details className="explicacao">
        <summary>Como funciona a verificação</summary>
        <p>
          Cada lance guarda uma impressão digital (hash SHA-256) calculada com os dados dele e com o hash do lance anterior.
          Mudar, apagar ou inserir um lance direto no banco faz o hash recalculado deixar de bater, e a corrente quebra
          naquele ponto. O primeiro lance usa 64 zeros como hash anterior.
        </p>
      </details>

      {a.historico.length === 0 ? (
        <p className="texto-suave">Este lote ainda não recebeu lances.</p>
      ) : (
        <div className="tabela-rolavel">
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Licitante</th>
                <th>Valor</th>
                <th>Horário</th>
                <th>Hash</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {a.historico.map((lance) => (
                <tr key={lance.sequencia} className={lance.integro ? '' : 'tabela__linha--erro'}>
                  <td className="numero">{lance.sequencia}</td>
                  <td>{lance.apelido}</td>
                  <td className="numero">{formatarCentavos(lance.valor_centavos)}</td>
                  <td className="numero" title={formatarDataHora(lance.criado_em)}>
                    {formatarHora(lance.criado_em)}
                  </td>
                  <td className="hash" title={lance.hash}>
                    {encurtar(lance.hash)}
                  </td>
                  <td>
                    {lance.integro ? (
                      <span className="ok">Confere</span>
                    ) : (
                      <span className="texto-erro">{lance.problemas.map((p) => PROBLEMAS[p] ?? p).join(' ')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
