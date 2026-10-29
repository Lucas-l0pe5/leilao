// Busca do cabeçalho com sugestões (autocompletar).
// Procura por nome, origem, época, material ou número do lote ("lote 7", "#7").
// Setas navegam, Enter abre a sugestão marcada (ou filtra a vitrine), Esc fecha.

import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLotes } from '../lotes.jsx';
import { combinaComBusca, numeroLote, procedencia, valorDoLote } from '../lib/lotes.js';
import { formatarCentavos } from '../lib/dinheiro.js';
import Icone from './Icone.jsx';

const MAXIMO_SUGESTOES = 6;

export default function BuscaGlobal() {
  const { dados: lotes } = useLotes();
  const navegar = useNavigate();
  const idLista = useId();
  const [texto, setTexto] = useState('');
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(-1);

  const termo = texto.trim();
  const sugestoes = termo ? (lotes ?? []).filter((lote) => combinaComBusca(lote, termo)).slice(0, MAXIMO_SUGESTOES) : [];
  const mostrar = aberta && termo.length > 0;

  function abrirLote(lote) {
    setTexto('');
    setAberta(false);
    setAtiva(-1);
    navegar(`/lotes/${lote.id}`);
  }

  function filtrarVitrine() {
    setAberta(false);
    setAtiva(-1);
    navegar('/', { state: { busca: termo } });
  }

  function aoTeclar(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setAberta(true);
      setAtiva((atual) => Math.min(atual + 1, sugestoes.length - 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setAtiva((atual) => Math.max(atual - 1, -1));
    } else if (evento.key === 'Escape') {
      setAberta(false);
      setAtiva(-1);
    }
  }

  function aoEnviar(evento) {
    evento.preventDefault();
    if (ativa >= 0 && sugestoes[ativa]) {
      abrirLote(sugestoes[ativa]);
    } else if (termo) {
      filtrarVitrine();
    }
  }

  return (
    <form className="busca-global" role="search" onSubmit={aoEnviar}>
      <Icone nome="busca" className="busca-global__icone" />
      <input
        type="search"
        className="busca-global__campo"
        placeholder="Buscar instrumento, origem, época ou lote"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberta(true);
          setAtiva(-1);
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        onKeyDown={aoTeclar}
        role="combobox"
        aria-label="Buscar lotes"
        aria-expanded={mostrar}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={ativa >= 0 ? `${idLista}-${ativa}` : undefined}
        autoComplete="off"
      />

      {mostrar && (
        <ul id={idLista} className="sugestoes" role="listbox" aria-label="Sugestões">
          {sugestoes.length === 0 && <li className="sugestoes__vazio">Nenhum lote para “{termo}”.</li>}
          {sugestoes.map((lote, indice) => (
            <li
              key={lote.id}
              id={`${idLista}-${indice}`}
              role="option"
              aria-selected={indice === ativa}
              className={indice === ativa ? 'sugestao sugestao--ativa' : 'sugestao'}
              // mousedown (e não click) porque o click viria depois do blur, que já fechou a lista.
              onMouseDown={(e) => {
                e.preventDefault();
                abrirLote(lote);
              }}
              onMouseEnter={() => setAtiva(indice)}
            >
              <span className="sugestao__miniatura">{lote.imagem_url && <img src={lote.imagem_url} alt="" />}</span>
              <span className="sugestao__texto">
                <span className="sugestao__titulo">{lote.titulo}</span>
                <span className="sugestao__meta">
                  {numeroLote(lote.id)}
                  {procedencia(lote) && ` · ${procedencia(lote)}`}
                </span>
              </span>
              <span className="sugestao__valor numero">{formatarCentavos(valorDoLote(lote))}</span>
            </li>
          ))}
          {sugestoes.length > 0 && (
            <li className="sugestoes__rodape" aria-hidden="true">
              Enter para ver todos os resultados na vitrine
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
