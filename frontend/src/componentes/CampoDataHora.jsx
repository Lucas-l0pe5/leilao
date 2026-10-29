// Campo de data e hora em duas partes: o calendário do navegador para o dia e
// um campo de texto onde se DIGITA a hora (ex.: 14:37). Substitui o
// "datetime-local", cujo seletor de horas e minutos em colunas obrigava a rolar.
// Aceita qualquer horário do dia, minuto a minuto. O valor continua no formato
// "AAAA-MM-DDTHH:mm", então quem usa o campo não precisa mudar a conversão para ISO.

import { useEffect, useId, useRef, useState } from 'react';

const AVISO_RECUSA_MS = 2500; // o mesmo tempo do aviso dos campos de valor

// "1437" -> "14:37" | "14" -> "14" | "143" -> "14:3". Só dígitos, no máximo 4.
// O ":" é colocado sozinho, então basta digitar os números.
export function mascararHora(texto) {
  const digitos = texto.replace(/\D/g, '').slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos;
}

// Hora completa e válida: 00:00 até 23:59.
export function horaValida(hora) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

export default function CampoDataHora({ rotulo, valor, aoMudar, erro, min }) {
  const id = useId();
  const [dia = '', hora = ''] = valor.split('T');
  // Enquanto a pessoa ainda está digitando a hora, não acusa "formato inválido".
  const [digitando, setDigitando] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const temporizador = useRef(null);

  // Ao sair da tela, cancela o temporizador pendente.
  useEffect(() => () => clearTimeout(temporizador.current), []);

  function mudarHora(evento) {
    const digitado = evento.target.value;
    // Letra ou símbolo (fora o ":") digitado? Avisa por alguns segundos,
    // mesmo que a próxima tecla seja válida, e segue só com os números.
    if (/[^\d:]/.test(digitado)) {
      setRecusado(true);
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setRecusado(false), AVISO_RECUSA_MS);
    }
    aoMudar(`${dia}T${mascararHora(digitado)}`);
  }

  const incompleta = digitando && !horaValida(hora);
  const mensagem = recusado ? 'Use só números (ex.: 14:37).' : incompleta ? null : erro;

  return (
    <fieldset className={mensagem ? 'campo campo-data campo--erro' : 'campo campo-data'}>
      <legend className="campo__rotulo">{rotulo}</legend>
      <div className="campo-data__partes">
        <input
          type="date"
          value={dia}
          min={min}
          onChange={(e) => aoMudar(`${e.target.value}T${hora}`)}
          aria-label={`${rotulo}: data`}
          aria-invalid={Boolean(mensagem)}
          aria-describedby={mensagem ? `${id}-erro` : undefined}
          required
        />
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH:mm"
          maxLength={5}
          value={hora}
          onChange={mudarHora}
          onFocus={() => setDigitando(true)}
          onBlur={() => setDigitando(false)}
          aria-label={`${rotulo}: horário (HH:mm)`}
          aria-invalid={Boolean(mensagem)}
          aria-describedby={mensagem ? `${id}-erro` : undefined}
          required
        />
      </div>
      {mensagem && (
        <span id={`${id}-erro`} className="campo__erro" role="alert">
          {mensagem}
        </span>
      )}
    </fieldset>
  );
}
