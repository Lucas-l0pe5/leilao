// A hora oficial é a do servidor. Guardamos a diferença entre o relógio dele e o nosso.

let deslocamentoMs = 0;

export function ajustarRelogio(horaServidor) {
  const servidor = new Date(horaServidor).getTime();
  if (!Number.isNaN(servidor)) {
    deslocamentoMs = servidor - Date.now();
  }
}

export function agoraServidor() {
  return Date.now() + deslocamentoMs;
}

export function formatarRestante(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const dias = Math.floor(total / 86400);
  const horas = Math.floor((total % 86400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dois = (n) => String(n).padStart(2, '0');

  if (dias > 0) {
    return `${dias}d ${dois(horas)}h ${dois(minutos)}min`;
  }
  return `${dois(horas)}:${dois(minutos)}:${dois(segundos)}`;
}

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const formatoHora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });

export function formatarDataHora(iso) {
  return iso ? formatoDataHora.format(new Date(iso)) : '—';
}

export function formatarHora(iso) {
  return iso ? formatoHora.format(new Date(iso)) : '—';
}

// Date -> "2026-10-30T20:00" (o formato que o <input type="datetime-local"> entende)
export function paraCampoDataHora(data) {
  const dois = (n) => String(n).padStart(2, '0');
  return (
    `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}` +
    `T${dois(data.getHours())}:${dois(data.getMinutes())}`
  );
}
