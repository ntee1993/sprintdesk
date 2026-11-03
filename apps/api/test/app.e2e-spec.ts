import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

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

const prismaError = new Prisma.PrismaClientKnownRequestError(
  'Record not found',
  {
    code: 'P2025',
    clientVersion: '7.10.1',
  },
);

const foreignKeyError = new Prisma.PrismaClientKnownRequestError(
  'Foreign key constraint failed',
  {
    code: 'P2003',
    clientVersion: '7.10.1',
  },
);

// -----------------------------------------------------------------------------
// E2E Tests
// -----------------------------------------------------------------------------

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let createMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let deleteMock: ReturnType<typeof vi.fn>;

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

    updateMock = vi.fn().mockResolvedValue({
      ...mockTasks[0],
      status: 'done',
    });

    deleteMock = vi.fn().mockResolvedValue({
      ...mockTasks[0],
    });

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
          update: updateMock,
          delete: deleteMock,
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

    it('creates a task and assign to user ID 1', async () => {
      const assignedTaskInput = {
        title: 'Learn Prisma Relations',
        status: 'todo',
        priority: 'high',
        projectId: 1,
        assigneeId: 1,
      };

      createMock.mockResolvedValueOnce({
        id: 5,
        ...assignedTaskInput,
      });

      const response = await request(app.getHttpServer())
        .post('/tasks')
        .send(assignedTaskInput)
        .expect(201);

      expect(response.body).toEqual({
        id: 5,
        ...assignedTaskInput,
      });

      expect(createMock).toHaveBeenCalledExactlyOnceWith({
        data: assignedTaskInput,
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

      it('rejects non-exist assignee ID', async () => {
        const input = {
          ...validTaskInput,
          assigneeId: 999999,
        };
        createMock.mockRejectedValueOnce(foreignKeyError);
        const response = await request(app.getHttpServer())
          .post('/tasks')
          .send(input)
          .expect(400);

        expect(response.body.message).toBe('Invalid task relation');
        expect(createMock).toHaveBeenCalledExactlyOnceWith({ data: input });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /tasks/:id
  // ---------------------------------------------------------------------------

  describe('PATCH /tasks/:id', () => {
    it('updates a task successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch('/tasks/1')
        .send({ status: 'done' })
        .expect(200);

      expect(updateMock).toHaveBeenCalledExactlyOnceWith({
        where: { id: 1 },
        data: { status: 'done' },
      });
      expect(response.body).toEqual({
        ...mockTasks[0],
        status: 'done',
      });
    });

    it('updates a task assignee ID successfully', async () => {
      updateMock.mockResolvedValueOnce({
        ...mockTasks[0],
        assigneeId: 1,
      });
      const response = await request(app.getHttpServer())
        .patch('/tasks/1')
        .send({ assigneeId: 1 })
        .expect(200);

      expect(updateMock).toHaveBeenCalledExactlyOnceWith({
        where: { id: 1 },
        data: { assigneeId: 1 },
      });
      expect(response.body).toEqual({
        ...mockTasks[0],
        assigneeId: 1,
      });
    });

    it('unassigns a task', async () => {
      updateMock.mockResolvedValueOnce({
        ...mockTasks[0],
        assigneeId: null,
      });
      const response = await request(app.getHttpServer())
        .patch('/tasks/1')
        .send({ assigneeId: null })
        .expect(200);

      expect(updateMock).toHaveBeenCalledExactlyOnceWith({
        where: { id: 1 },
        data: { assigneeId: null },
      });
      expect(response.body).toEqual({
        ...mockTasks[0],
        assigneeId: null,
      });
    });

    describe('Invalid Input', () => {
      it('rejects invalid value', async () => {
        await request(app.getHttpServer())
          .patch('/tasks/1')
          .send({ status: 'invalid' })
          .expect(400);

        expect(updateMock).not.toHaveBeenCalled();
      });

      it('rejects non-white-listed field', async () => {
        await request(app.getHttpServer())
          .patch('/tasks/1')
          .send({ projectId: 1 })
          .expect(400);

        expect(updateMock).not.toHaveBeenCalled();
      });

      it('rejects invalid task ID', async () => {
        await request(app.getHttpServer())
          .patch('/tasks/hello')
          .send({ status: 'done' })
          .expect(400);

        expect(updateMock).not.toHaveBeenCalled();
      });

      it('rejects non-exist task ID', async () => {
        updateMock.mockRejectedValueOnce(prismaError);
        const response = await request(app.getHttpServer())
          .patch('/tasks/999')
          .send({ status: 'done' })
          .expect(404);

        expect(response.body.message).toBe('Task not found');
        expect(updateMock).toHaveBeenCalledExactlyOnceWith({
          where: { id: 999 },
          data: { status: 'done' },
        });
      });

      it('rejects non-exist assignee ID', async () => {
        updateMock.mockRejectedValueOnce(foreignKeyError);
        const response = await request(app.getHttpServer())
          .patch('/tasks/3')
          .send({ assigneeId: 999999 })
          .expect(400);

        expect(response.body.message).toBe('Invalid task relation');
        expect(updateMock).toHaveBeenCalledExactlyOnceWith({
          where: { id: 3 },
          data: { assigneeId: 999999 },
        });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /tasks/:id
  // ---------------------------------------------------------------------------

  describe('DELETE /tasks/:id', () => {
    it('deletes a task successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete('/tasks/1')
        .expect(200);

      expect(deleteMock).toHaveBeenCalledExactlyOnceWith({
        where: { id: 1 },
      });
      expect(response.body).toEqual({
        ...mockTasks[0],
      });
    });

    describe('Invalid Input', () => {
      it('rejects non-exist task ID', async () => {
        deleteMock.mockRejectedValueOnce(prismaError);
        const response = await request(app.getHttpServer())
          .delete('/tasks/999')
          .expect(404);

        expect(response.body.message).toBe('Task not found');
        expect(deleteMock).toHaveBeenCalledExactlyOnceWith({
          where: { id: 999 },
        });
      });

      it('rejects invalid task ID', async () => {
        await request(app.getHttpServer()).delete('/tasks/abc').expect(400);

        expect(deleteMock).not.toHaveBeenCalled();
      });
    });
  });
});
