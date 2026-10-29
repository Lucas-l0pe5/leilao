import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api.js';
import { useConsulta } from '../lib/useConsulta.js';
import { formatarCentavos } from '../lib/dinheiro.js';
import { formatarDataHora } from '../lib/tempo.js';
import Selo from '../componentes/Selo.jsx';
import CriarLote from '../componentes/CriarLote.jsx';
import { Carregando, Falha } from '../componentes/Estado.jsx';

async function buscarPainel() {
  const [lotes, resumo] = await Promise.all([api('/leiloeiro/lotes'), api('/leiloeiro/resumo')]);
  return { lotes, resumo };
}

function BotaoCancelar({ loteId, aoCancelar }) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function cancelar() {
    setEnviando(true);
    setErro(null);
    try {
      await api(`/leiloeiro/lotes/${loteId}/cancelar`, { metodo: 'POST' });
      await aoCancelar();
    } catch (falha) {
      setErro(falha.message);
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  }

  if (!confirmando) {
    return (
      <>
        <button type="button" className="botao botao--fantasma botao--pequeno" onClick={() => setConfirmando(true)}>
          Cancelar
        </button>
        {erro && <span className="texto-erro">{erro}</span>}
      </>
    );
  }
  return (
    <span className="confirmar">
      <button type="button" className="botao botao--perigo botao--pequeno" onClick={cancelar} disabled={enviando}>
        {enviando ? 'Cancelando…' : 'Confirmar cancelamento'}
      </button>
      <button type="button" className="botao botao--fantasma botao--pequeno" onClick={() => setConfirmando(false)}>
        Voltar
      </button>
    </span>
  );
}

export default function Painel() {
  const { dados, erro, carregando, recarregar } = useConsulta(buscarPainel, 'painel', 10000);

  if (carregando) {
    return <Carregando texto="Abrindo o painel…" />;
  }
  if (!dados) {
    return <Falha erro={erro} aoTentar={recarregar} />;
  }

  const { lotes, resumo } = dados;
  const ativos = lotes.filter((l) => l.situacao === 'ao_vivo' || l.situacao === 'agendado');

  return (
    <div className="painel">
      <h1 className="titulo-pagina">Painel do leiloeiro</h1>

      <div className="numeros">
        <div className="numeros__item">
          <span className="numeros__rotulo">Total recebido</span>
          <span className="numeros__valor numero">{formatarCentavos(resumo.total_recebido_centavos)}</span>
        </div>
        <div className="numeros__item">
          <span className="numeros__rotulo">Lotes arrematados</span>
          <span className="numeros__valor numero">{resumo.total_arrematados}</span>
        </div>
        <div className="numeros__item">
          <span className="numeros__rotulo">Ativos agora</span>
          <span className="numeros__valor numero">{ativos.length}</span>
        </div>
      </div>

      <CriarLote aoCriar={recarregar} />

      <section className="bloco">
        <header className="bloco__cabecalho">
          <h2>Meus lotes</h2>
          <p>Só lotes sem nenhum lance podem ser cancelados.</p>
        </header>
        {lotes.length === 0 ? (
          <p className="texto-suave">Você ainda não publicou lotes.</p>
        ) : (
          <ul className="lista">
            {lotes.map((lote) => (
              <li key={lote.id} className="lista__linha">
                {lote.imagem_url && <img className="lista__miniatura" src={lote.imagem_url} alt="" />}
                <div className="lista__texto">
                  {lote.situacao === 'cancelado' ? (
                    <strong>{lote.titulo}</strong>
                  ) : (
                    <Link to={`/lotes/${lote.id}`}>
                      <strong>{lote.titulo}</strong>
                    </Link>
                  )}
                  <span className="texto-suave">
                    #{lote.id} · {lote.total_lances} {lote.total_lances === 1 ? 'lance' : 'lances'} · fim {formatarDataHora(lote.fim_em)}
                  </span>
                </div>
                <span className="numero lista__valor">
                  {formatarCentavos(lote.lance_atual_centavos ?? lote.lance_inicial_centavos)}
                </span>
                <div className="lista__acoes">
                  <Selo tipo={lote.situacao} />
                  {lote.pode_cancelar && <BotaoCancelar loteId={lote.id} aoCancelar={recarregar} />}
                  {!lote.pode_cancelar && lote.total_lances > 0 && (lote.situacao === 'ao_vivo' || lote.situacao === 'agendado') && (
                    <span className="texto-suave" title="Lotes com lances não podem ser cancelados">
                      Com lances
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bloco">
        <header className="bloco__cabecalho">
          <h2>Resultados dos encerrados</h2>
        </header>
        {resumo.encerrados.length === 0 ? (
          <p className="texto-suave">Nenhum lote encerrado ainda.</p>
        ) : (
          <ul className="lista">
            {resumo.encerrados.map((lote) => (
              <li key={lote.id} className="lista__linha">
                <div className="lista__texto">
                  <strong>{lote.titulo}</strong>
                  <span className="texto-suave">
                    {lote.arrematado ? `Arrematado por ${lote.vencedor_apelido}` : 'Encerrado sem lances'} · {formatarDataHora(lote.fim_em)}
                  </span>
                </div>
                <span className="numero lista__valor">
                  {lote.arrematado ? formatarCentavos(lote.valor_arrematado_centavos) : '—'}
                </span>
                <div className="lista__acoes">
                  {lote.arrematado ? (
                    <Link to={`/comprovante/${lote.codigo_comprovante}`} className="botao botao--secundario botao--pequeno">
                      Comprovante
                    </Link>
                  ) : (
                    lote.situacao === 'encerrado' && <span className="texto-suave">Sem vencedor</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
