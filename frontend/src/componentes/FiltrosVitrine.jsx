// Painel de filtros da vitrine (componente controlado: quem guarda os valores
// é a página; aqui só desenhamos e avisamos as mudanças por "aoMudar").
// As opções de época e origem vêm dos próprios lotes, então só aparece o que existe.

import { useId } from 'react';

export const FILTROS_INICIAIS = {
  situacao: '',
  epoca: '',
  origem: '',
  minimo: '',
  maximo: '',
};

export const SITUACOES = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'ao_vivo', rotulo: 'Ao vivo' },
  { valor: 'encerra_24h', rotulo: 'Encerram em 24h' },
  { valor: 'agendado', rotulo: 'Próximos lotes' },
  { valor: 'encerrado', rotulo: 'Encerrados' },
];

function GrupoDeOpcoes({ titulo, opcoes, valor, aoEscolher }) {
  if (opcoes.length === 0) {
    return null;
  }
  return (
    <fieldset className="filtros__grupo">
      <legend className="filtros__titulo">{titulo}</legend>
      <div className="fichas">
        {opcoes.map((opcao) => (
          <button
            key={opcao}
            type="button"
            className="ficha-filtro"
            aria-pressed={valor === opcao}
            // Clicar de novo na opção marcada desmarca.
            onClick={() => aoEscolher(valor === opcao ? '' : opcao)}
          >
            {opcao}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function FiltrosVitrine({ filtros, aoMudar, contagens, epocas, origens, aoLimpar, aberto }) {
  const id = useId();
  const mudar = (campo) => (valor) => aoMudar({ ...filtros, [campo]: valor });
  const algumAtivo = Object.keys(FILTROS_INICIAIS).some((campo) => filtros[campo] !== FILTROS_INICIAIS[campo]);

  return (
    <aside id="filtros-vitrine" className={aberto ? 'filtros filtros--aberto' : 'filtros'} aria-label="Filtros">
      <fieldset className="filtros__grupo">
        <legend className="filtros__titulo">Status do leilão</legend>
        <div className="filtros__situacoes">
          {SITUACOES.map((opcao) => (
            <label key={opcao.valor} className="situacao">
              <input
                type="radio"
                name={`${id}-situacao`}
                checked={filtros.situacao === opcao.valor}
                onChange={() => mudar('situacao')(opcao.valor)}
              />
              <span className="situacao__rotulo">{opcao.rotulo}</span>
              <span className="situacao__contador numero">{contagens[opcao.valor] ?? 0}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <GrupoDeOpcoes titulo="Época" opcoes={epocas} valor={filtros.epoca} aoEscolher={mudar('epoca')} />
      <GrupoDeOpcoes titulo="Origem" opcoes={origens} valor={filtros.origem} aoEscolher={mudar('origem')} />

      <fieldset className="filtros__grupo">
        <legend className="filtros__titulo">Faixa de preço</legend>
        <div className="filtros__preco">
          <label className="campo-mini">
            <span>De R$</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={filtros.minimo}
              onChange={(e) => mudar('minimo')(e.target.value)}
              aria-label="Valor mínimo em reais"
            />
          </label>
          <span aria-hidden="true" className="filtros__traco">–</span>
          <label className="campo-mini">
            <span>Até R$</span>
            <input
              inputMode="decimal"
              placeholder="sem limite"
              value={filtros.maximo}
              onChange={(e) => mudar('maximo')(e.target.value)}
              aria-label="Valor máximo em reais"
            />
          </label>
        </div>
      </fieldset>

      {algumAtivo && (
        <button type="button" className="link-botao filtros__limpar" onClick={aoLimpar}>
          Limpar filtros
        </button>
      )}
    </aside>
  );
}
