// Painel de filtros da vitrine (componente controlado: quem guarda os valores
// é a página; aqui só desenhamos e avisamos as mudanças por "aoMudar").
// As opções de época e origem vêm dos próprios lotes, então só aparece o que existe.

import { useId } from 'react';
import { MENSAGEM_RECUSA, useCampoNumerico } from './CampoDinheiro.jsx';
import { textoParaCentavos } from '../lib/dinheiro.js';

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

// Campo compacto de valor da faixa de preço: mesma limpeza do CampoDinheiro
// (só números, vírgula e ponto), com borda vermelha quando algo é recusado
// ou quando o filtro está inválido.
function CampoPrecoMini({ rotulo, rotuloAcessivel, valor, aoMudar, invalido, idErro, placeholder }) {
  const { recusado, mudar } = useCampoNumerico(aoMudar);
  const comErro = recusado || invalido;
  return (
    <label className={comErro ? 'campo-mini campo-mini--erro' : 'campo-mini'}>
      <span>{rotulo}</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={valor}
        onChange={mudar}
        aria-label={rotuloAcessivel}
        aria-invalid={comErro}
        aria-describedby={comErro ? idErro : undefined}
      />
      {recusado && (
        <span className="campo__erro" role="alert">
          {MENSAGEM_RECUSA}
        </span>
      )}
    </label>
  );
}

// Erro da faixa de preço como um todo, ou null.
function erroDaFaixa(minimo, maximo) {
  const de = textoParaCentavos(minimo);
  const ate = textoParaCentavos(maximo);
  if ((minimo !== '' && de === null) || (maximo !== '' && ate === null)) {
    return { texto: 'Valor inválido. Use o formato 1.250,50.', minimo: minimo !== '' && de === null, maximo: maximo !== '' && ate === null };
  }
  if (de !== null && ate !== null && minimo !== '' && maximo !== '' && de > ate) {
    return { texto: 'O valor mínimo está maior que o máximo.', minimo: true, maximo: true };
  }
  return null;
}

export default function FiltrosVitrine({ filtros, aoMudar, contagens, epocas, origens, aoLimpar, aberto }) {
  const id = useId();
  const mudar = (campo) => (valor) => aoMudar({ ...filtros, [campo]: valor });
  const idErroFaixa = `${id}-faixa`;
  const faixa = erroDaFaixa(filtros.minimo, filtros.maximo);
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
          <CampoPrecoMini
            rotulo="De R$"
            rotuloAcessivel="Valor mínimo em reais"
            placeholder="0"
            valor={filtros.minimo}
            aoMudar={mudar('minimo')}
            invalido={Boolean(faixa?.minimo)}
            idErro={idErroFaixa}
          />
          <span aria-hidden="true" className="filtros__traco">–</span>
          <CampoPrecoMini
            rotulo="Até R$"
            rotuloAcessivel="Valor máximo em reais"
            placeholder="sem limite"
            valor={filtros.maximo}
            aoMudar={mudar('maximo')}
            invalido={Boolean(faixa?.maximo)}
            idErro={idErroFaixa}
          />
        </div>
        {faixa && (
          <p id={idErroFaixa} className="campo__erro" role="alert">
            {faixa.texto}
          </p>
        )}
      </fieldset>

      {algumAtivo && (
        <button type="button" className="link-botao filtros__limpar" onClick={aoLimpar}>
          Limpar filtros
        </button>
      )}
    </aside>
  );
}
