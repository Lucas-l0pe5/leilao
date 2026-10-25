import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

export function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }

  try {
    const dados = jwt.verify(token, JWT_SECRET);
    req.usuario = { id: Number(dados.sub), papel: dados.papel };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

export function exigirPapel(papel) {
  return (req, res, next) => {
    if (req.usuario?.papel !== papel) {
      return res.status(403).json({ erro: `Apenas ${papel} pode fazer isto.` });
    }
    next();
  };
}