import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConflictException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { AuthService } from '../src/auth/auth.service.js';

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
  let findManyMock: ReturnType<typeof vi.fn>;
  let createMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let deleteMock: ReturnType<typeof vi.fn>;
  let registerMock: ReturnType<typeof vi.fn>;

  // ---------------------------------------------------------------------------
  // Setup & Teardown
  // ---------------------------------------------------------------------------

  beforeEach(async () => {
    registerMock = vi.fn();

    findManyMock = vi
      .fn()
      .mockImplementation(({ where, skip = 0, take = 10, orderBy } = {}) => {
        const filteredTasks = mockTasks.filter(
          (task) =>
            (where?.status === undefined || task.status === where.status) &&
            (where?.priority === undefined || task.priority === where.priority),
        );

        const field = orderBy?.title !== undefined ? 'title' : 'id';
        const direction = orderBy?.[field] ?? 'asc';

        const sortedTasks = [...filteredTasks].sort((a, b) => {
          const comparison =
            field === 'title' ? a.title.localeCompare(b.title) : a.id - b.id;

          return direction === 'desc' ? -comparison : comparison;
        });

        const paginatedTasks = sortedTasks.slice(skip, skip + take);

        return Promise.resolve(paginatedTasks);
      });

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
          findMany: findManyMock,

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
      .overrideProvider(AuthService)
      .useValue({
        register: registerMock,
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

    it('should filter tasks by status', async () => {
      const expectedTasks = mockTasks.filter((task) => task.status === 'todo');

      const response = await request(app.getHttpServer())
        .get('/tasks?status=todo')
        .expect(200);

      expect(response.body).toEqual(expectedTasks);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'todo',
          priority: undefined,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should filter tasks by priority', async () => {
      const expectedTasks = mockTasks.filter(
        (task) => task.priority === 'urgent',
      );

      const response = await request(app.getHttpServer())
        .get('/tasks?priority=urgent')
        .expect(200);

      expect(response.body).toEqual(expectedTasks);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: 'urgent',
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should filter tasks by status and priority', async () => {
      const expectedTasks = mockTasks.filter(
        (task) => task.status === 'in_progress' && task.priority === 'urgent',
      );

      const response = await request(app.getHttpServer())
        .get('/tasks?status=in_progress&priority=urgent')
        .expect(200);

      expect(response.body).toEqual(expectedTasks);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'in_progress',
          priority: 'urgent',
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should reject an invalid status', async () => {
      await request(app.getHttpServer())
        .get('/tasks?status=invalid')
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should reject an unknown query parameter', async () => {
      await request(app.getHttpServer()).get('/tasks?unknown=test').expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should return page 1 with limit 1', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?page=1&limit=1')
        .expect(200);

      expect(response.body).toEqual([mockTasks[0]]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 0,
        take: 1,
        orderBy: { id: 'asc' },
      });
    });

    it('should return page 2 with limit 1', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?page=2&limit=1')
        .expect(200);

      expect(response.body).toEqual([mockTasks[1]]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 1,
        take: 1,
        orderBy: { id: 'asc' },
      });
    });

    it('should return an empty array for page 3 with limit 1', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?page=3&limit=1')
        .expect(200);

      expect(response.body).toEqual([]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 2,
        take: 1,
        orderBy: { id: 'asc' },
      });
    });

    it('should filter and paginate tasks', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?status=in_progress&page=1&limit=1')
        .expect(200);

      expect(response.body).toEqual([mockTasks[1]]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'in_progress',
          priority: undefined,
        },
        skip: 0,
        take: 1,
        orderBy: { id: 'asc' },
      });
    });

    it('should reject page 0', async () => {
      await request(app.getHttpServer()).get('/tasks?page=0').expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should reject a limit above 100', async () => {
      await request(app.getHttpServer()).get('/tasks?limit=101').expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should reject a non-numeric page', async () => {
      await request(app.getHttpServer()).get('/tasks?page=abc').expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should sort tasks by ID descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?sortBy=id&order=desc')
        .expect(200);

      expect(response.body).toEqual([...mockTasks].reverse());

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'desc' },
      });
    });

    it('should sort tasks by title ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?sortBy=title&order=asc')
        .expect(200);

      const expectedTasks = [...mockTasks].sort((a, b) =>
        a.title.localeCompare(b.title),
      );

      expect(response.body).toEqual(expectedTasks);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 0,
        take: 10,
        orderBy: { title: 'asc' },
      });
    });

    it('should sort by ID descending and paginate', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?sortBy=id&order=desc&page=1&limit=1')
        .expect(200);

      expect(response.body).toEqual([mockTasks[1]]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 0,
        take: 1,
        orderBy: { id: 'desc' },
      });
    });

    it('should reject an invalid sort field', async () => {
      await request(app.getHttpServer())
        .get('/tasks?sortBy=unknown')
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should reject an invalid sort direction', async () => {
      await request(app.getHttpServer()).get('/tasks?order=random').expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
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
  // POST /auth/register
  // ---------------------------------------------------------------------------

  describe('POST /auth/register', () => {
    const validRegisterInput = {
      name: 'Tester',
      email: 'tester@example.test',
      password: 'MySecurePassword123!',
    };

    it('registers a user and returns 201 without sensitive fields', async () => {
      const body = {
        name: 'Tester',
        email: 'tester@example.test',
        password: 'MySecurePassword123!',
      };

      registerMock.mockResolvedValue({
        id: 1,
        name: 'Tester',
        email: 'tester@example.test',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(body)
        .expect(201);

      expect(registerMock).toHaveBeenCalledExactlyOnceWith({
        name: 'Tester',
        email: 'tester@example.test',
        password: 'MySecurePassword123!',
      });

      expect(response.body).toEqual({
        id: 1,
        name: 'Tester',
        email: 'tester@example.test',
      });
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('rejects an invalid email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validRegisterInput,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(registerMock).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 12 characters', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validRegisterInput,
          password: '12345',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(registerMock).not.toHaveBeenCalled();
    });

    it('rejects an unexpected field', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validRegisterInput,
          role: 'admin',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(registerMock).not.toHaveBeenCalled();
    });

    it('returns 409 when the email is already registered', async () => {
      registerMock.mockRejectedValueOnce(
        new ConflictException('Email already registered'),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegisterInput)
        .expect(409);

      expect(response.body.message).toBe('Email already registered');
      expect(registerMock).toHaveBeenCalledExactlyOnceWith(validRegisterInput);
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
