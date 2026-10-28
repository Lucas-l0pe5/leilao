// Teste de encerramento e liquidação (leva cerca de 2 min 20 s).
// Uso (servidor ligado em outro terminal):  node scripts/teste-encerramento.js
const BASE = process.env.API_URL ?? 'http://localhost:3000';
const SENHA = 'Leilao@2026';
const VALOR = 10000;
const execId = Date.now();

async function chamar(metodo, caminho, { corpo, token, chave } = {}) {
  const cabecalhos = { 'Content-Type': 'application/json' };
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (chave) cabecalhos['Idempotency-Key'] = chave;
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resposta.json().catch(() => ({}));
  return { status: resposta.status, dados };
}

function exigirSucesso(resposta, rotulo) {
  if (resposta.status >= 400) {
    throw new Error(`${rotulo} falhou (HTTP ${resposta.status}): ${JSON.stringify(resposta.dados)}`);
  }
  return resposta.dados;
}

async function entrar(email) {
  const r = exigirSucesso(await chamar('POST', '/auth/login', { corpo: { email, senha: SENHA } }), `Login ${email}`);
  return r.token;
}

async function criarLote(token, titulo, segundosAteOFim) {
  return exigirSucesso(
    await chamar('POST', '/leiloeiro/lotes', {
      token,
      corpo: {
        fonte: 'reserva',
        item_externo_id: `encerramento-${execId}-${titulo}`,
        titulo: `Teste de encerramento (${titulo})`,
        imagem_url: null,
        atributos: { Teste: 'encerramento' },
        lance_inicial_centavos: VALOR,
        incremento_minimo_centavos: 500,
        inicio_em: new Date(Date.now() - 60 * 1000).toISOString(),
        fim_em: new Date(Date.now() + segundosAteOFim * 1000).toISOString(),
      },
    }),
    `Criação do lote ${titulo}`
  );
}

const resultados = [];
function conferir(nome, passou, detalhe) {
  resultados.push(passou);
  console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}  ${detalhe}`);
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`API: ${BASE}\n`);
  const tokenLeiloeiro = await entrar('leiloeiro@leilao.test');
  const tokenLicitante = await entrar('licitante1@leilao.test');

  const antesLeiloeiro = (await chamar('GET', '/carteira', { token: tokenLeiloeiro })).dados;
  const antesLicitante = (await chamar('GET', '/carteira', { token: tokenLicitante })).dados;

  // Lote A: 130 s até o fim (fora da janela de 2 min do anti-sniping), com um lance.
  const loteA = await criarLote(tokenLeiloeiro, 'com-lance', 130);
  // Lote B: 10 s até o fim, sem lances.
  const loteB = await criarLote(tokenLeiloeiro, 'sem-lance', 10);
  console.log(`Lotes criados: A = ${loteA.id} (com lance), B = ${loteB.id} (sem lance)`);

  const lance = await chamar('POST', `/lotes/${loteA.id}/lances`, {
    token: tokenLicitante,
    chave: `encerramento-${execId}`,
    corpo: { valor_centavos: VALOR },
  });
  exigirSucesso(lance, 'Lance no lote A');
  console.log(`Lance aceito. O fim do lote A foi prorrogado? ${lance.dados.lote.prorrogado}\n`);

  const meio = (await chamar('GET', '/carteira', { token: tokenLicitante })).dados;
  conferir(
    'Durante o leilão: valor comprometido, saldo total intacto',
    meio.comprometido === antesLicitante.comprometido + VALOR && meio.total === antesLicitante.total,
    `(comprometido: ${meio.comprometido}, total: ${meio.total})`
  );

  console.log('Aguardando o lote A terminar (cerca de 2 min 15 s)...');
  await esperar(135 * 1000);

  const encerrados = (await chamar('GET', '/lotes?situacao=encerrado')).dados;
  const ids = encerrados.map((l) => l.id);
  conferir('Os dois lotes aparecem como encerrados na vitrine', ids.includes(loteA.id) && ids.includes(loteB.id), `(ids: ${ids.join(', ')})`);

  const depoisLicitante = (await chamar('GET', '/carteira', { token: tokenLicitante })).dados;
  const depoisLeiloeiro = (await chamar('GET', '/carteira', { token: tokenLeiloeiro })).dados;
  conferir(
    'Vencedor debitado e sem valor comprometido',
    depoisLicitante.total === antesLicitante.total - VALOR && depoisLicitante.comprometido === antesLicitante.comprometido,
    `(total: ${antesLicitante.total} -> ${depoisLicitante.total}, comprometido: ${depoisLicitante.comprometido})`
  );
  conferir(
    'Leiloeiro creditado',
    depoisLeiloeiro.total === antesLeiloeiro.total + VALOR,
    `(total: ${antesLeiloeiro.total} -> ${depoisLeiloeiro.total})`
  );

  console.log(resultados.every(Boolean) ? '\nTUDO CERTO' : '\nHÁ FALHAS');
  process.exit(resultados.every(Boolean) ? 0 : 1);
}

main().catch((erro) => {
  console.error('Erro no script:', erro.message);
  process.exit(1);
});