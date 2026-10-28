import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

// Igual ao exigirLogin, mas NÃO recusa visitante: se houver token válido,
// preenche req.usuario; se não houver (ou for inválido), segue sem usuário.
export function loginOpcional(req, _res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (tipo === 'Bearer' && token) {
    try {
      const dados = jwt.verify(token, JWT_SECRET);
      req.usuario = { id: Number(dados.sub), papel: dados.papel };
    } catch {
      // Token inválido ou vencido: trata como visitante.
    }
  }
  next();
}