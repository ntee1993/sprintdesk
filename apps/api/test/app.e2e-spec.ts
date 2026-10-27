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
    let response = await request(app.getHttpServer())
      .post('/tasks')
      .send(input)
      .expect(201);
    expect(response.body).toEqual({ id: 3, ...input });

    response = await request(app.getHttpServer()).get('/tasks').expect(200);
    expect(response.body).toHaveLength(3);
    expect(response.body).toContainEqual({ id: 3, ...input });
  });

  it('rejects invalid task data', async () => {
    const invalidInput = {
      title: 123,
      status: 'flying',
      priority: 'banana',
    };
    let response = await request(app.getHttpServer())
      .post('/tasks')
      .send(invalidInput)
      .expect(400);
    expect(response.body.message).toBeInstanceOf(Array);
    expect(response.body.message.length).toBeGreaterThan(0);

    response = await request(app.getHttpServer()).get('/tasks').expect(200);
    expect(response.body).toHaveLength(2);
  });

  it('rejects unexpected properties', async () => {
    const unexpectedInput = {
      title: 'Learn Validation',
      status: 'todo',
      priority: 'high',
      userId: 999,
    };
    let response = await request(app.getHttpServer())
      .post('/tasks')
      .send(unexpectedInput)
      .expect(400);
    expect(response.body.message).toContain('property userId should not exist');

    response = await request(app.getHttpServer()).get('/tasks').expect(200);
    expect(response.body).toHaveLength(2);
  });

  afterEach(async () => {
    await app.close();
  });
});
