// Cadeia de hashes dos lances.
// Cada lance guarda o hash do lance anterior (hash_anterior) e o seu próprio hash.
// O hash é uma "impressão digital" dos dados do lance: se qualquer dado mudar
// Depois, a impressão recalculada deixa de bater com a gravada.
import { createHash } from 'node:crypto';
 
// Hash "de partida": usado como hash_anterior do primeiro lance de cada lote.
export const HASH_INICIAL = '0'.repeat(64);
 
export function calcularHash({ loteId, sequencia, usuarioId, valorCentavos, criadoEm, hashAnterior }) {
  const texto = [
    loteId,
    sequencia,
    usuarioId,
    valorCentavos,
    criadoEm.toISOString(),
    hashAnterior,
  ].join('|');
 
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}
 