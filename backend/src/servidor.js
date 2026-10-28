import { PORT } from './config.js';
import { app } from './app.js';
import { iniciarEncerrador } from './lotes/encerramento.js';

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

iniciarEncerrador();