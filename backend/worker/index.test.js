const test = require("node:test");
const assert = require("node:assert/strict");
const { agoraNacional, datasNacionais, paginaDetalheInconclusiva } = require("./index");

test("agenda o próximo dia útil após sexta-feira", () => {
  const anterior = process.env.NATIONAL_DATE;
  delete process.env.NATIONAL_DATE;
  try { assert.deepEqual(datasNacionais("2026-10-23"), ["26/10/2026"]); }
  finally { if (anterior === undefined) delete process.env.NATIONAL_DATE; else process.env.NATIONAL_DATE = anterior; }
});

test("aceita data explícita e rejeita data inexistente", () => {
  const anterior = process.env.NATIONAL_DATE;
  try {
    process.env.NATIONAL_DATE = "22/10/2026";
    assert.deepEqual(datasNacionais("2026-10-21"), ["22/10/2026"]);
    process.env.NATIONAL_DATE = "31/02/2026";
    assert.throws(() => datasNacionais("2026-10-21"), /válida/);
  } finally { if (anterior === undefined) delete process.env.NATIONAL_DATE; else process.env.NATIONAL_DATE = anterior; }
});

test("usa o calendário de São Paulo para escolher a execução", () => {
  assert.deepEqual(agoraNacional(new Date("2026-10-20T02:30:00Z")), { dia: "2026-10-19", hora: "23:30" });
});

test("não classifica aviso de autenticação como ausência de advogado", () => {
  assert.equal(paginaDetalheInconclusiva("Para realizar essa ação é necessário estar autenticado\nDeseja se autenticar agora?"), true);
  assert.equal(paginaDetalheInconclusiva("Polo Passivo\nAdvogado: Maria Silva OAB 1234"), false);
});
