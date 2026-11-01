import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

const mockTasks = [
  {
    id: 1,
    title: 'Learn NestJS',
    status: 'todo',
    priority: 'high',
    projectId: 1,
  },
  {
    id: 2,
    title: 'Build Tasks API',
    status: 'in_progress',
    priority: 'urgent',
    projectId: 2,
  },
];

const validTaskInput = {
  title: 'Learn Dependency Injection',
  status: 'todo',
  priority: 'high',
  projectId: 1,
};

// -----------------------------------------------------------------------------
// E2E Tests
// -----------------------------------------------------------------------------

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let createMock: ReturnType<typeof vi.fn>;

  // ---------------------------------------------------------------------------
  // Setup & Teardown
  // ---------------------------------------------------------------------------

  beforeEach(async () => {
    createMock = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 3,
        ...data,
      }),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        task: {
          findMany: vi.fn().mockResolvedValue(mockTasks),

          findUnique: vi
            .fn()
            .mockImplementation(({ where }) =>
              Promise.resolve(
                mockTasks.find((task) => task.id === where.id) ?? null,
              ),
            ),

          create: createMock,
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // App Routes
  // ---------------------------------------------------------------------------

  describe('App Routes', () => {
    it('GET / returns Hello World', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });

    it('GET /health returns healthy status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
    });
  });

  // ---------------------------------------------------------------------------
  // GET /tasks
  // ---------------------------------------------------------------------------

  describe('GET /tasks', () => {
    it('returns all tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks')
        .expect(200)
        .expect(mockTasks);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /tasks/:id
  // ---------------------------------------------------------------------------

  describe('GET /tasks/:id', () => {
    it('returns the task when ID exists', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks/1')
        .expect(200);

      expect(response.body).toEqual(mockTasks[0]);
    });

    it('returns 404 when task does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks/999')
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toBe('Task not found');
    });

    it('returns 400 when ID is invalid', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks/hello')
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /tasks
  // ---------------------------------------------------------------------------

  describe('POST /tasks', () => {
    it('creates a task and returns 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .send(validTaskInput)
        .expect(201);

      expect(response.body).toEqual({
        id: 3,
        ...validTaskInput,
      });

      expect(createMock).toHaveBeenCalledExactlyOnceWith({
        data: validTaskInput,
      });
    });

    describe('Input Validation', () => {
      it('rejects invalid task data', async () => {
        const invalidInput = {
          title: 123,
          status: 'flying',
          priority: 'banana',
          projectId: 1,
        };

        const response = await request(app.getHttpServer())
          .post('/tasks')
          .send(invalidInput)
          .expect(400);

        expect(response.body.message).toBeInstanceOf(Array);
        expect(response.body.message.length).toBeGreaterThan(0);
        expect(createMock).not.toHaveBeenCalled();
      });

      it('rejects unexpected properties', async () => {
        const unexpectedInput = {
          ...validTaskInput,
          userId: 999,
        };

        const response = await request(app.getHttpServer())
          .post('/tasks')
          .send(unexpectedInput)
          .expect(400);

        expect(response.body.message).toContain(
          'property userId should not exist',
        );

        expect(createMock).not.toHaveBeenCalled();
      });

      it('rejects missing projectId', async () => {
        const input = {
          title: 'Learn Validation',
          status: 'todo',
          priority: 'high',
        };

        await request(app.getHttpServer())
          .post('/tasks')
          .send(input)
          .expect(400);

        expect(createMock).not.toHaveBeenCalled();
      });

      it('rejects negative projectId', async () => {
        const input = {
          ...validTaskInput,
          projectId: -1,
        };

        await request(app.getHttpServer())
          .post('/tasks')
          .send(input)
          .expect(400);

        expect(createMock).not.toHaveBeenCalled();
      });
    });
  });
});
