// Campo de valor em reais. Só aceita números, vírgula e ponto: letras e
// símbolos são descartados ao digitar e ao colar ("R$ 1.250,50" colado vira
// "1.250,50"). Quando algo é recusado ou o valor está fora das regras, a borda
// fica vermelha e uma mensagem explica o porquê.

import { useEffect, useId, useRef, useState } from 'react';

const TAMANHO_MAXIMO = 14;
// Quanto tempo o aviso "caractere recusado" fica na tela depois da última tecla inválida.
const AVISO_RECUSA_MS = 2500;

// Mantém só dígitos, vírgula e ponto.
export function limparValor(texto) {
  return texto.replace(/[^\d.,]/g, '').slice(0, TAMANHO_MAXIMO);
}

// O que foi digitado e não é número nem separador? Espaços e "R$" não contam:
// são comuns ao colar um valor e não indicam erro de quem digitou.
export function temCaractereRecusado(texto) {
  return texto.replace(/R\$|\s|[\d.,]/g, '').length > 0;
}

export const MENSAGEM_RECUSA = 'Use só números, com vírgula para os centavos (ex.: 1.250,50).';

// Lógica comum a todo campo de valor: limpa o texto digitado ou colado e,
// se algo foi recusado, liga o aviso por alguns segundos. Usada por este
// componente e pelos campos compactos da faixa de preço da vitrine.
export function useCampoNumerico(aoMudar) {
  const [recusado, setRecusado] = useState(false);
  const temporizador = useRef(null);

  // Ao sair da tela, cancela o temporizador pendente.
  useEffect(() => () => clearTimeout(temporizador.current), []);

  function mudar(evento) {
    const digitado = evento.target.value;
    if (temCaractereRecusado(digitado)) {
      // Mostra o aviso e o mantém por um tempo, mesmo que a próxima tecla seja válida.
      setRecusado(true);
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setRecusado(false), AVISO_RECUSA_MS);
    }
    aoMudar(limparValor(digitado));
  }

  return { recusado, mudar };
}

export default function CampoDinheiro({ rotulo, valor, aoMudar, erro, ajuda, ...resto }) {
  const id = useId();
  const { recusado, mudar } = useCampoNumerico(aoMudar);

  const mensagem = recusado ? MENSAGEM_RECUSA : erro;
  const invalido = Boolean(mensagem);

  return (
    <label className={invalido ? 'campo campo--erro' : 'campo'}>
      <span className="campo__rotulo">{rotulo}</span>
      <span className="campo__moeda">
        <span aria-hidden="true">R$</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={mudar}
          aria-invalid={invalido}
          aria-describedby={mensagem ? `${id}-erro` : undefined}
          {...resto}
        />
      </span>
      {mensagem && (
        <span id={`${id}-erro`} key={mensagem} className="campo__erro" role="alert">
          {mensagem}
        </span>
      )}
      {ajuda}
    </label>
  );
}
