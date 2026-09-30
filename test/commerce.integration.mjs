import 'dotenv/config';
import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';
import { ProductsService } from '../dist/modules/products/products.service.js';
import { OrdersService } from '../dist/modules/orders/orders.service.js';
import { TransactionsService } from '../dist/modules/transactions/transactions.service.js';
import { StockService } from '../dist/modules/stock/stock.service.js';
import { today } from '../dist/common/utils/dates.js';

// Explicit opt-in URL only: never silently runs against DATABASE_URL.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'Defina TEST_DATABASE_URL. Os testes criam e removem apenas um schema apollo_test_<uuid>.',
  );
const schema = 'apollo_test_' + randomUUID().replaceAll('-', '');
const connection = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 10000,
});
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, max: 5, connectionTimeoutMillis: 10000 },
    { schema },
  ),
});
db.atomic = PrismaService.prototype.atomic.bind(db);
const stock = new StockService();
const products = new ProductsService(db, stock);
const orders = new OrdersService(db);
const transactions = new TransactionsService(db, stock);
let client, outsider;
const date = (offset) =>
  new Date(today().getTime() + offset * 86400000).toISOString().slice(0, 10);
const fixture = async (quantity = 1) =>
  (
    await products.create({
      name: 'Terno teste',
      category: 'Terno',
      salePriceCents: 50000,
      rentalPriceCents: 10000,
      variants: [{ size: 'M', quantity }],
    })
  ).variants[0];
const draft = (variantId, type = 'RENTAL', start = 0, end = 2) =>
  transactions.create({
    profileId: client.id,
    variantId,
    type,
    ...(type === 'RENTAL'
      ? { startDate: date(start), endDate: date(end) }
      : {}),
  });
before(async () => {
  await connection.connect();
  await connection.query('CREATE SCHEMA "' + schema + '"');
  await connection.query('SET search_path TO "' + schema + '"');
  const sql = (
    await readFile(
      new URL(
        '../prisma/migrations/20260923010000_initial/migration.sql',
        import.meta.url,
      ),
      'utf8',
    )
  ).replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
  await connection.query(sql);
  client = await db.profile.create({
    data: {
      authUserId: randomUUID(),
      name: 'Cliente teste',
      email: 'test@example.invalid',
    },
  });
  outsider = await db.profile.create({
    data: {
      authUserId: randomUUID(),
      name: 'Outro cliente',
      email: 'other@example.invalid',
    },
  });
});
after(async () => {
  await db.$disconnect();
  // The identifier is generated internally, validated, and never accepts user input.
  if (!/^apollo_test_[0-9a-f]{32}$/.test(schema))
    throw new Error('Schema de teste inválido.');
  try {
    await connection.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
  } finally {
    await connection.end();
  }
});
test('pedido/rascunho não reserva; duas aprovações criam uma transação', async () => {
  const v = await fixture();
  const order = await orders.create(client, {
    variantId: v.id,
    type: 'RENTAL',
    startDate: date(1),
    endDate: date(3),
  });
  const approved = await Promise.all([
    orders.transition(order.id, 'approve'),
    orders.transition(order.id, 'approve'),
  ]);
  assert.equal(approved[0].transaction.id, approved[1].transaction.id);
  assert.equal(await db.transaction.count({ where: { orderId: order.id } }), 1);
  assert.equal(
    (await stock.availability(db, v.id, today(), null)).available,
    1,
  );
});
test('duas confirmações concorrentes disputam a última unidade', async () => {
  const v = await fixture();
  const a = await draft(v.id),
    b = await draft(v.id);
  const results = await Promise.allSettled([
    transactions.confirm(a.id),
    transactions.confirm(b.id),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    await db.transaction.count({
      where: { variantId: v.id, status: 'CONFIRMED' },
    }),
    1,
  );
});
test('reservas não simultâneas reutilizam unidade e limites inclusivos conflitam', async () => {
  const v = await fixture();
  await transactions.confirm((await draft(v.id, 'RENTAL', 1, 3)).id);
  await transactions.confirm((await draft(v.id, 'RENTAL', 4, 6)).id);
  assert.equal((await stock.availability(db, v.id, today(), null)).reserved, 1);
  const overlap = await draft(v.id, 'RENTAL', 3, 4);
  await assert.rejects(transactions.confirm(overlap.id), /disponibilidade/);
});
test('venda protege reservas futuras e quantidade física', async () => {
  const v = await fixture();
  await transactions.confirm((await draft(v.id, 'RENTAL', 10, 12)).id);
  const sale = await draft(v.id, 'SALE');
  await assert.rejects(transactions.confirm(sale.id), /disponibilidade/);
  assert.equal(
    (await db.variant.findUnique({ where: { id: v.id } })).quantity,
    1,
  );
});
test('checkout e cancelamento repetidos não duplicam efeitos', async () => {
  const v = await fixture();
  const sale = await draft(v.id, 'SALE');
  await transactions.confirm(sale.id);
  const payments = await Promise.all([
    transactions.checkout(sale.id, client),
    transactions.checkout(sale.id, client),
  ]);
  assert.equal(payments[0].id, payments[1].id);
  assert.equal(payments[0].simulated, true);
  await Promise.all([
    transactions.cancel(sale.id),
    transactions.cancel(sale.id),
  ]);
  assert.equal(
    (await db.variant.findUnique({ where: { id: v.id } })).quantity,
    1,
  );
  assert.equal(
    (await db.payment.findUnique({ where: { transactionId: sale.id } })).status,
    'REFUNDED',
  );
});
test('retirada sem pagamento e devolução parcial do acervo são permitidas', async () => {
  const v = await fixture(2);
  const rental = await draft(v.id);
  await transactions.confirm(rental.id);
  await transactions.pickup(rental.id);
  await assert.rejects(transactions.cancel(rental.id), /retirada/);
  await transactions.complete(rental.id, 'return', 'Sem avarias');
  await transactions.complete(rental.id, 'return', 'Não sobrescrever');
  assert.equal(
    (await stock.availability(db, v.id, today(), null)).available,
    2,
  );
  assert.equal(
    (await transactions.readOne(rental.id, client)).damageNotes,
    'Sem avarias',
  );
  assert.equal((await transactions.checkout(rental.id, client)).status, 'PAID');
});
test('cliente não acessa nem paga operação alheia', async () => {
  const sale = await draft((await fixture()).id, 'SALE');
  await transactions.confirm(sale.id);
  await assert.rejects(
    transactions.readOne(sale.id, outsider),
    /não encontrada/,
  );
  await assert.rejects(
    transactions.checkout(sale.id, outsider),
    /não encontrada/,
  );
});
test('atraso bloqueia novas reservas e sinaliza conflito com reserva anterior', async () => {
  const v = await fixture();
  const late = await draft(v.id);
  await transactions.confirm(late.id);
  await transactions.pickup(late.id);
  const future = await draft(v.id, 'RENTAL', 4, 6);
  await transactions.confirm(future.id);
  await db.transaction.update({
    where: { id: late.id },
    data: { startDate: new Date(date(-3)), endDate: new Date(date(-1)) },
  });
  const extra = await draft(v.id, 'RENTAL', 8, 9);
  await assert.rejects(transactions.confirm(extra.id), /disponibilidade/);
  const result = await transactions.readConflicts();
  assert.ok(
    result.conflicts.some(
      (c) =>
        c.transactionId === future.id &&
        c.overdueTransactionIds.includes(late.id),
    ),
  );
  await transactions.complete(late.id, 'return');
  await transactions.confirm(extra.id);
});
test('edição de quantidade não invalida reservas; produto desativado não confirma', async () => {
  const v = await fixture();
  await transactions.confirm((await draft(v.id)).id);
  await assert.rejects(
    products.update(v.productId, { variants: [{ size: 'M', quantity: 0 }] }),
    /reservas/,
  );
  const another = await draft(v.id, 'RENTAL', 5, 6);
  await products.deactivate(v.productId);
  await assert.rejects(transactions.confirm(another.id), /disponibilidade/);
});
test('venda pode ser entregue antes do pagamento e não pode ser cancelada depois', async () => {
  const sale = await draft((await fixture()).id, 'SALE');
  await transactions.confirm(sale.id);
  await transactions.complete(sale.id, 'deliver');
  await transactions.complete(sale.id, 'deliver');
  await assert.rejects(transactions.cancel(sale.id), /entregue/);
  assert.equal((await transactions.checkout(sale.id, client)).status, 'PAID');
});
test('tabelas comerciais têm RLS e não concedem acesso público', async () => {
  const tables = await connection.query(
    'SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind=$2',
    [schema, 'r'],
  );
  assert.equal(tables.rows.length, 8);
  assert.ok(tables.rows.every((t) => t.relrowsecurity));
});
