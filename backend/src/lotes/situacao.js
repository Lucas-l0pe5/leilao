// Fragmento de SQL que calcula a situação do lote comparando a hora do banco com inicio_em e fim_em.
// O banco só grava 'aberto', 'encerrado' ou 'cancelado'; "agendado" e "ao_vivo" são sempre calculados.

export const SITUACAO_SQL = `
  CASE
    WHEN lotes.status = 'cancelado' THEN 'cancelado'
    WHEN lotes.status = 'encerrado' THEN 'encerrado'
    WHEN clock_timestamp() < lotes.inicio_em THEN 'agendado'
    WHEN clock_timestamp() < lotes.fim_em THEN 'ao_vivo'
    ELSE 'encerrado'
  END
`;