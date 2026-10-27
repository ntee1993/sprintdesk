import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/tasks (GET)', () => {
    return request(app.getHttpServer())
      .get('/tasks')
      .expect(200)
      .expect([
        {
          id: 1,
          title: 'Learn NestJS',
          status: 'todo',
          priority: 'high',
        },
        {
          id: 2,
          title: 'Build Tasks API',
          status: 'in_progress',
          priority: 'urgent',
        },
      ]);
  });

  it('/tasks (POST)', async () => {
    const input = {
      title: 'Learn Dependency Injection',
      status: 'todo',
      priority: 'high',
    };
    const postResponse = await request(app.getHttpServer())
      .post('/tasks')
      .send(input)
      .expect(201);
    expect(postResponse.body).toEqual({ id: 3, ...input });

    const getResponse = await request(app.getHttpServer())
      .get('/tasks')
      .expect(200);
    expect(getResponse.body).toHaveLength(3);
    expect(getResponse.body).toContainEqual({ id: 3, ...input });
  });

  afterEach(async () => {
    await app.close();
  });
});
