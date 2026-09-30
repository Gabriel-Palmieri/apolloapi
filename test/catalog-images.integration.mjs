import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { configureApp } from '../dist/common/config/configure-app.js';

test('as 10 imagens femininas são públicas e permitem uso em outra origem', async () => {
  const module = await Test.createTestingModule({
    providers: [{ provide: ConfigService, useValue: new ConfigService({ FRONTEND_URL: 'http://localhost:5173' }) }],
  }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  try {
    const files = (await readdir(new URL('../public/produtos/feminino/', import.meta.url))).filter((name) => name.endsWith('.png'));
    assert.equal(files.length, 10);
    for (const file of files) {
      const response = await request(app.getHttpServer())
        .get(`/produtos/feminino/${file}`)
        .expect(200)
        .expect('Content-Type', /image\/png/)
        .expect('Cross-Origin-Resource-Policy', 'cross-origin');
      assert.equal(response.body.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
    await request(app.getHttpServer()).get('/produtos/feminino/inexistente.png').expect(404);
    await request(app.getHttpServer()).get('/produtos/feminino/.env').expect(404);
  } finally {
    await app.close();
  }
});
