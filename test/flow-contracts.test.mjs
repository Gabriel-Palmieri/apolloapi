import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { CreateProductDto } from '../dist/modules/products/dto/create-product.dto.js';
import { UpdateProductDto } from '../dist/modules/products/dto/update-product.dto.js';
import { WeddingPackagesController } from '../dist/modules/wedding-packages/wedding-packages.controller.js';
import { WeddingPackagesService } from '../dist/modules/wedding-packages/wedding-packages.service.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';
import { DatesInterceptor } from '../dist/common/interceptors/dates.interceptor.js';
import { today } from '../dist/common/utils/dates.js';

test('create and update accept photos from the seed and reject unsafe/local paths outside produtos', async () => {
  const base = {name:'Terno',category:'Terno',rentalPriceCents:100,salePriceCents:200,variants:[{size:'M',quantity:1}]};
  for (const Dto of [CreateProductDto, UpdateProductDto]) {
    for (const photoUrl of ['/produtos/terno.jpg','/produtos/feminino/vestido-esmeralda.png','/produtos/WhatsApp%20Image%202026-09-29%20at%2021.14.17%20(1).jpeg','https://example.com/foto.jpg']) {
      assert.deepEqual(await validate(plainToInstance(Dto,{...base,photoUrl})),[],photoUrl);
    }
    for (const photoUrl of ['//evil.example/foto.jpg','/produtos/../foto.jpg','/produtos/%2e%2e%2ffoto.jpg','/produtos/%5cfoto.jpg','/produtos/%252e%252e.jpg','/produtos/foto.svg','/outros/foto.jpg','http://example.com/foto.jpg','javascript:alert(1)','/produtos/%broken.jpg']) {
      assert.ok((await validate(plainToInstance(Dto,{...base,photoUrl}))).some(e=>e.property==='photoUrl'),String(photoUrl));
    }
  }
});

test('wedding HTTP rejects invalid dates before writes and serializes eventDate as a day', async t => {
  const saved=[];
  const module=await Test.createTestingModule({controllers:[WeddingPackagesController],providers:[WeddingPackagesService,{provide:PrismaService,useValue:{weddingPackage:{create:async({data})=>{saved.push(data);return data;},findMany:async()=>saved}}}]}).compile();
  const app=module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalInterceptors(new DatesInterceptor());
  await app.init();
  t.after(()=>app.close());
  const body={coupleNames:'Casal Teste',expectedMembers:1,contactName:'Contato Teste',contactEmail:'test@example.invalid',contactPhone:'11999999999',participants:[]};
  for (const eventDate of ['banana','2026-02-31','2026-13-01','2020-01-01','',null,'2026-11-15T00:00:00.000Z']) {
    await request(app.getHttpServer()).post('/wedding-packages').send({...body,eventDate}).expect(400);
  }
  assert.equal(saved.length,0);
  const eventDate=today().toISOString().slice(0,10);
  const response=await request(app.getHttpServer()).post('/wedding-packages').send({...body,eventDate}).expect(201);
  assert.equal(response.body.eventDate,eventDate);
  await request(app.getHttpServer()).post('/wedding-packages').send(body).expect(201);
  assert.equal(saved[1].eventDate,null);
  const listed=await request(app.getHttpServer()).get('/wedding-packages').expect(200);
  assert.equal(listed.body[0].eventDate,eventDate);
});

 test('PATCH clears nullable product fields while rejecting null required fields', async () => {
  const pipe = new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
  const metadata = {type:'body',metatype:UpdateProductDto};
  const cleared = {collection:null,fabric:null,color:null,line:null,photoUrl:null};
  const dto = await pipe.transform(cleared, metadata);
  for (const key of Object.keys(cleared)) assert.equal(dto[key],null);
  assert.equal((await pipe.transform({}, metadata)).photoUrl,undefined);
  for (const key of ['name','category','rentalPriceCents','salePriceCents','variants']) {
    await assert.rejects(() => pipe.transform({[key]:null}, metadata));
  }
  for (const key of Object.keys(cleared)) {
    await assert.rejects(() => pipe.transform({[key]:''}, metadata));
    assert.ok((await validate(plainToInstance(CreateProductDto,{[key]:null}))).some(error=>error.property===key));
  }
});
test('product HTTP forwards explicit clears to persistence and preserves omitted values', async t => {
  const { ProductsController } = await import('../dist/modules/products/products.controller.js');
  const { ProductsService } = await import('../dist/modules/products/products.service.js');
  const { StockService } = await import('../dist/modules/stock/stock.service.js');
  const id = '10000000-0000-4000-8000-000000000001';
  const record = {id,name:'Terno',category:'Terno',collection:'Colecao',fabric:'La',color:'Azul',line:'Premium',photoUrl:'/produtos/terno.jpg',variants:[]};
  const writes = [];
  const product = {
    findUnique:async()=>record,
    findFirst:async()=>record,
    update:async({data})=>{
      writes.push(data);
      for (const [key,value] of Object.entries(data)) if (value !== undefined) record[key]=value;
      return record;
    },
  };
  const module = await Test.createTestingModule({
    controllers:[ProductsController],
    providers:[ProductsService,{provide:PrismaService,useValue:{product,atomic:async fn=>fn({product})}},{provide:StockService,useValue:{}}],
  }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  await app.init();
  t.after(()=>app.close());
  await request(app.getHttpServer()).patch('/products/'+id).send({color:null,photoUrl:null}).expect(200);
  assert.equal(writes[0].color,null);
  assert.equal(writes[0].photoUrl,null);
  const response = await request(app.getHttpServer()).get('/products/'+id).expect(200);
  assert.equal(response.body.color,null);
  assert.equal(response.body.photoUrl,null);
  assert.equal(response.body.fabric,'La');
  await request(app.getHttpServer()).patch('/products/'+id).send({name:null}).expect(400);
  assert.equal(writes.length,1);
});

test('conflict report preserves overlap and overdue rules with one reservation read', async () => {
  const { TransactionsService } = await import('../dist/modules/transactions/transactions.service.js');
  const { StockService } = await import('../dist/modules/stock/stock.service.js');
  const now = today();
  const day = offset => new Date(now.getTime() + offset * 86400000);
  const row = (id,variantId,quantity,start,end,pickedUpAt=null) => ({id,variantId,variant:{quantity},startDate:start===null?null:day(start),endDate:end===null?null:day(end),pickedUpAt});
  const rows = [
    row('late','v1',1,-5,-1,day(-5)), row('future','v1',1,1,2),
    row('first','v2',1,0,1), row('second','v2',1,1,2),
    row('capacity-a','v3',2,0,3), row('capacity-b','v3',2,0,3),
    row('separate-a','v4',1,0,0), row('separate-b','v4',1,1,1),
    row('not-picked','v5',1,-5,-1), row('next','v5',1,1,2),
    row('incomplete','v6',1,null,null),
  ];
  let reads = 0;
  const prisma = {transaction:{findMany:async query=>{
    reads++;
    assert.deepEqual(query.where,{type:'RENTAL',status:'CONFIRMED'});
    assert.deepEqual(query.select.variant,{select:{quantity:true}});
    assert.equal(query.select.payment,undefined);
    return rows;
  }}};
  const service = new TransactionsService(prisma,{availability:()=>{throw new Error('Unexpected per-reservation query');}});
  const result = await service.readConflicts();
  assert.equal(reads,1);
  assert.deepEqual(result,{
    conflicts:[
      {transactionId:'future',overdueTransactionIds:['late']},
      {transactionId:'first',overdueTransactionIds:[]},
      {transactionId:'second',overdueTransactionIds:[]},
    ],
    overdue:['late'],
  });
  // Compare with the unchanged stock service used by confirmations.
  const stock = new StockService();
  const expected = [];
  for (const item of rows) {
    if (!item.startDate || !item.endDate || item.endDate < now) continue;
    const tx = {
      variant:{findUnique:async()=>({...item.variant,product:{active:true}})},
      transaction:{findMany:async()=>rows.filter(other=>other.variantId===item.variantId)},
    };
    const previous = await stock.availability(tx,item.variantId,item.startDate,item.endDate);
    if (previous.hasConflict) expected.push({transactionId:item.id,overdueTransactionIds:previous.overdueTransactionIds});
  }
  assert.deepEqual(result.conflicts,expected);
});

test('conflict report read count stays constant for 1200 reservations and does not hide read failures', async () => {
  const { TransactionsService } = await import('../dist/modules/transactions/transactions.service.js');
  const now = today();
  const rows = Array.from({length:1200},(_,index)=>({
    id:String(index),variantId:String(Math.floor(index/10)),variant:{quantity:10},
    startDate:now,endDate:new Date(now.getTime()+86400000),pickedUpAt:null,
  }));
  let reads = 0;
  const prisma = {transaction:{findMany:async()=>{reads++;return rows;}}};
  const service = new TransactionsService(prisma,{});
  assert.deepEqual(await service.readConflicts(),{conflicts:[],overdue:[]});
  assert.equal(reads,1);
  prisma.transaction.findMany = async()=>{throw new Error('Database unavailable');};
  await assert.rejects(()=>service.readConflicts(),/Database unavailable/);
});

test('paged HTTP lists preserve filters, global totals, ordering and access boundaries', async t => {
  const { APP_GUARD } = await import('@nestjs/core');
  const { UnauthorizedException } = await import('@nestjs/common');
  const { AuthGuard } = await import('../dist/common/guards/auth.guard.js');
  const { AuthService } = await import('../dist/modules/auth/auth.service.js');
  const { ProductsController } = await import('../dist/modules/products/products.controller.js');
  const { ProductsService } = await import('../dist/modules/products/products.service.js');
  const { OrdersController } = await import('../dist/modules/orders/orders.controller.js');
  const { OrdersService } = await import('../dist/modules/orders/orders.service.js');
  const { TransactionsController } = await import('../dist/modules/transactions/transactions.controller.js');
  const { TransactionsService } = await import('../dist/modules/transactions/transactions.service.js');
  const { StockService } = await import('../dist/modules/stock/stock.service.js');
  const rows = Array.from({length:45},(_,index)=>({
    id:String(index).padStart(3,'0'),createdAt:new Date('2026-10-01T12:00:00Z'),
    name:index===0?'Especial':'Terno '+index,category:'Terno',color:'Azul',active:index%2===0,
    profileId:index%2===0?'client':'other',status:index%3===0?'APPROVED':'NEW',
    variants:[{size:'M',quantity:4}],variant:{product:{name:index===0?'Especial':'Terno '+index}},profile:{name:'Cliente'},
    coupleNames:'Casal '+index,participants:[],eventDate:new Date('2026-12-01T00:00:00Z'),
  }));
  const queries=[];
  const matches = (row, where={}) => {
    if (where.profileId && row.profileId!==where.profileId) return false;
    if (where.status && row.status!==where.status) return false;
    if (where.protocol && row.protocol!==where.protocol) return false;
    if (where.type && row.type!==where.type) return false;
    if (where.active!==undefined && row.active!==where.active) return false;
    if (where.category && row.category!==where.category) return false;
    if (where.AND) return where.AND.every(group=>group.OR ? group.OR.some(filter=>{
      if (filter.variant) return row.variant.product.name.toLowerCase().includes(filter.variant.product.name.contains.toLowerCase());
      if (filter.profile) return row.profile.name.toLowerCase().includes(filter.profile.name.contains.toLowerCase());
      return Object.entries(filter).every(([key,value])=>String(row[key]).toLowerCase().includes(value.contains.toLowerCase()));
    }) : matches(row,group));
    return true;
  };
  const delegate = name => ({
    count:async({where}={})=>rows.filter(row=>matches(row,where)).length,
    findMany:async args=>{
      queries.push({name,args});
      assert.deepEqual(args.orderBy,[{createdAt:'desc'},{id:'desc'}]);
      assert.ok(args.take<=100);
      return rows.filter(row=>matches(row,args.where)).sort((a,b)=>b.id.localeCompare(a.id)).slice(args.skip,args.skip+args.take);
    },
    groupBy:async({by,where})=>{
      const key=by[0];
      return [...new Set(rows.map(row=>row[key]))].map(value=>({[key]:value,_count:{_all:rows.filter(row=>row[key]===value&&matches(row,where)).length}}));
    },
  });
  const db={product:delegate('product'),order:delegate('order'),transaction:delegate('transaction'),weddingPackage:delegate('weddingPackage'),variant:{aggregate:async()=>({_sum:{quantity:180}})}};
  let snapshots=0;
  const prisma={...db,$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'RepeatableRead');snapshots++;return fn(db);}};
  const module=await Test.createTestingModule({
    controllers:[ProductsController,OrdersController,TransactionsController,WeddingPackagesController],
    providers:[ProductsService,OrdersService,TransactionsService,WeddingPackagesService,
      {provide:PrismaService,useValue:prisma},{provide:StockService,useValue:{}},
      {provide:AuthService,useValue:{authenticate:async token=>{
        if (!['admin','client'].includes(token)) throw new UnauthorizedException();
        return {id:token,role:token==='admin'?'ADMIN':'CLIENT'};
      }}},{provide:APP_GUARD,useClass:AuthGuard}],
  }).compile();
  const app=module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalInterceptors(new DatesInterceptor());
  await app.init();
  t.after(()=>app.close());
  const get=(path,role='admin')=>request(app.getHttpServer()).get(path).auth(role,{type:'bearer'});
  for (const path of ['/products/admin/page','/orders/page','/transactions/page','/wedding-packages/page','/orders/summary'])
    await request(app.getHttpServer()).get(path).expect(401);
  for (const path of ['/products/admin/page','/wedding-packages/page']) await get(path,'client').expect(403);
  const products=await get('/products/admin/page?page=2&limit=20').expect(200);
  assert.equal(products.body.items.length,20);
  assert.equal(products.body.items[0].id,'024');
  assert.equal(products.body.total,45);
  assert.deepEqual(products.body.summary,{modelos:45,ativos:23,inativos:22,pecas:180});
  const filtered=await get('/products/admin/page?q=especial&state=active&page=900').expect(200);
  assert.equal(filtered.body.page,1);
  assert.equal(filtered.body.total,1);
  assert.equal(filtered.body.items[0].id,'000');
  assert.equal(filtered.body.summary.modelos,45);
  const publicPage=await request(app.getHttpServer()).get('/products/page?state=inactive&category=Terno').expect(200);
  assert.equal(publicPage.body.total,23);
  assert.ok(publicPage.body.items.every(row=>row.active));
  assert.equal(publicPage.body.summary,undefined);
  const empty=await get('/products/admin/page?q=ausente').expect(200);
  assert.equal(empty.body.total,0);
  assert.equal(empty.body.pages,1);
  assert.deepEqual(empty.body.items,[]);
  const orders=await get('/orders/page?status=APPROVED&page=2&limit=3','client').expect(200);
  assert.equal(orders.body.total,8);
  assert.equal(orders.body.items.length,3);
  assert.ok(orders.body.items.every(row=>row.profileId==='client'&&row.status==='APPROVED'));
  assert.deepEqual(queries.findLast(query=>query.name==='order').args.where,{profileId:'client',status:'APPROVED'});
  assert.equal(orders.body.summary.NEW,15);
  const summary=await get('/orders/summary','client').expect(200);
  assert.equal(summary.body.APPROVED,8);
  const transactions=await get('/transactions/page?q=especial','client').expect(200);
  assert.equal(transactions.body.total,1);
  assert.equal(transactions.body.items[0].profileId,'client');
  assert.equal(queries.findLast(query=>query.name==='transaction').args.where.profileId,'client');
  const packages=await get('/wedding-packages/page?page=3&limit=20').expect(200);
  assert.equal(packages.body.items.length,5);
  assert.equal(packages.body.items[0].eventDate,'2026-12-01');
  assert.equal(packages.body.total,45);
  const before=snapshots;
  for (const query of ['page=0','page=-1','page=1.5','limit=101','limit=0','state=invalid','q='+('x'.repeat(121)),'unknown=value'])
    await get('/products/admin/page?'+query).expect(400);
  await get('/orders/page?status=PAID').expect(400);
  assert.equal(snapshots,before,'invalid queries must not access persistence');
});


test('order idempotency replays immutable snapshots, isolates owners and rejects changed requests', async () => {
  const { OrdersService } = await import('../dist/modules/orders/orders.service.js');
  const rows = [];
  let writes = 0, reads = 0;
  const db = {
    order: {
      findUnique: async ({ where }) => rows.find(row => row.profileId === where.profileId_idempotencyKey.profileId && row.idempotencyKey === where.profileId_idempotencyKey.idempotencyKey) || null,
      create: async ({ data }) => { writes++; const row = { ...data, id: String(writes) }; rows.push(row); return row; },
    },
    variant: { findUnique: async () => { reads++; return { id: '20000000-0000-4000-8000-000000000001', product: { active: true, salePriceCents: 10000, rentalPriceCents: 5000 } }; } },
  };
  const service = new OrdersService({ ...db, atomic: fn => fn(db) });
  const user = { id: 'client-a', name: 'Ana', email: 'ana@example.test' };
  const dto = { variantId: '20000000-0000-4000-8000-000000000001', type: 'SALE', notes: 'Original' };
  const key = 'a0000000-0000-4000-8000-000000000001';
  const first = await service.create(user, dto, key);
  const retry = await service.create({ ...user, name: 'Nome alterado' }, dto, key.toUpperCase());
  assert.equal(first.id, retry.id);
  assert.equal(retry.customerName, 'Ana');
  assert.equal(writes, 1);
  assert.equal(reads, 1, 'a replay must not depend on the current catalogue');
  await assert.rejects(() => service.create(user, { ...dto, notes: 'Outro' }, key), error => error.getStatus() === 409);
  await assert.rejects(() => service.create(user, dto, 'invalid'), error => error.getStatus() === 400);
  assert.equal(writes, 1);
  assert.notEqual((await service.create({ ...user, id: 'client-b' }, dto, key)).id, first.id);
  const day = today().toISOString().slice(0, 10);
  const rental = { ...dto, type: 'RENTAL', startDate: day, endDate: day };
  const rentalKey = 'b0000000-0000-4000-8000-000000000001';
  const original = await service.create(user, rental, rentalKey);
  db.variant.findUnique = async () => { throw new Error('Catalogue unavailable'); };
  assert.equal((await service.create(user, rental, rentalKey)).id, original.id);
});

test('a concurrent unique-key loser reads the committed winner after rollback', async () => {
  const { OrdersService } = await import('../dist/modules/orders/orders.service.js');
  const { Prisma } = await import('../dist/generated/prisma/client.js');
  const { createHash } = await import('node:crypto');
  const dto = { variantId: '20000000-0000-4000-8000-000000000001', type: 'SALE' };
  const winner = { id: 'only-order', requestHash: createHash('sha256').update(JSON.stringify({ variantId: dto.variantId, type: dto.type, startDate: null, endDate: null, notes: '' })).digest('hex') };
  let recovered = false;
  const service = new OrdersService({
    atomic: async () => { throw new Prisma.PrismaClientKnownRequestError('Duplicate', { code: 'P2002', clientVersion: 'test' }); },
    order: { findUnique: async () => { recovered = true; return winner; } },
  });
  assert.equal((await service.create({ id: 'client' }, dto, 'a0000000-0000-4000-8000-000000000001')).id, winner.id);
  assert.equal(recovered, true);
});

test('calendar aggregation bounds the window and binds dates as query parameters', async () => {
  const { TransactionsService } = await import('../dist/modules/transactions/transactions.service.js');
  let queries = 0;
  const service = new TransactionsService({ $queryRaw: async (sql, ...values) => {
    queries++;
    assert.ok(sql.join('?').includes('generate_series'));
    assert.equal(values.length, 2);
    assert.ok(values.every(value => value instanceof Date));
    return [{ day: '2026-10-01', nSaidas: 5000, nRetornos: 0, nAtivos: 5000 }];
  } }, {});
  const result = await service.readCalendar({ start: '2026-10-01', end: '2026-11-11' });
  assert.equal(result[0].nSaidas, 5000);
  for (const [start, end] of [['2026-10-01','2026-11-12'], ['2026-10-02','2026-10-01'], ['2026-02-30','2026-03-01']])
    await assert.rejects(() => service.readCalendar({ start, end }), error => error.getStatus() === 400);
  assert.equal(queries, 1);
});
