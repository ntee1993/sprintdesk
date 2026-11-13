import { Test } from '@nestjs/testing';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { SessionService } from '../src/auth/session.service.js';
import cookieParser from 'cookie-parser';
import { TaskCommentsController } from '../src/tasks/task-comments.controller.js';
import { TaskCommentsService } from '../src/tasks/task-comments.service.js';

describe('Task comments HTTP', () => {
  let app: INestApplication;
  const service = {
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TaskCommentsController],
      providers: [
        { provide: TaskCommentsService, useValue: service },
        {
          provide: SessionService,
          useValue: {
            validateSession: vi.fn().mockResolvedValue({
              id: 7,
              name: 'Tester',
              email: 'test@example.test',
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without a session', async () => {
    await request(app.getHttpServer()).get('/tasks/1/comments').expect(401);
  });

  it('takes author from the session and rejects extra authorId', async () => {
    service.create.mockResolvedValueOnce({
      id: 1,
      taskId: 1,
      authorId: 7,
      content: 'Hello',
      author: { id: 7, name: 'Tester' },
    });
    const response = await request(app.getHttpServer())
      .post('/tasks/1/comments')
      .set('Cookie', 'sprintdesk_session=test')
      .send({ content: 'Hello' })
      .expect(201);
    expect(response.body.authorId).toBe(7);
    expect(service.create).toHaveBeenCalledExactlyOnceWith(1, 7, 'Hello');
    await request(app.getHttpServer())
      .post('/tasks/1/comments')
      .set('Cookie', 'sprintdesk_session=test')
      .send({ content: 'Hello', authorId: 2 })
      .expect(400);
    expect(service.create).toHaveBeenCalledOnce();
  });

  it('returns comments for a viewer', async () => {
    const comment = {
      id: 3,
      taskId: 1,
      authorId: 7,
      content: 'Hello',
      author: { id: 7, name: 'Tester' },
    };
    service.findAll.mockResolvedValueOnce([comment]);
    const response = await request(app.getHttpServer())
      .get('/tasks/1/comments')
      .set('Cookie', 'sprintdesk_session=test')
      .expect(200);
    expect(response.body).toEqual([comment]);
    expect(service.findAll).toHaveBeenCalledExactlyOnceWith(1, 7);
  });

  it('allows a viewer to create a comment', async () => {
    const comment = {
      id: 3,
      taskId: 1,
      authorId: 7,
      content: 'Viewer comment',
      author: { id: 7, name: 'Tester' },
    };
    service.create.mockResolvedValueOnce(comment);
    const response = await request(app.getHttpServer())
      .post('/tasks/1/comments')
      .set('Cookie', 'sprintdesk_session=test')
      .send({ content: 'Viewer comment' })
      .expect(201);
    expect(response.body).toEqual(comment);
    expect(service.create).toHaveBeenCalledExactlyOnceWith(
      1,
      7,
      'Viewer comment',
    );
  });

  it('updates a comment as its author', async () => {
    const comment = {
      id: 3,
      taskId: 1,
      authorId: 7,
      content: 'Updated',
      author: { id: 7, name: 'Tester' },
    };
    service.update.mockResolvedValueOnce(comment);
    const response = await request(app.getHttpServer())
      .patch('/tasks/1/comments/3')
      .set('Cookie', 'sprintdesk_session=test')
      .send({ content: 'Updated' })
      .expect(200);
    expect(response.body).toEqual(comment);
    expect(service.update).toHaveBeenCalledExactlyOnceWith(1, 3, 7, 'Updated');
  });

  it('deletes a comment as its author', async () => {
    const comment = {
      id: 3,
      taskId: 1,
      authorId: 7,
      content: 'Removed',
      author: { id: 7, name: 'Tester' },
    };
    service.remove.mockResolvedValueOnce(comment);
    const response = await request(app.getHttpServer())
      .delete('/tasks/1/comments/3')
      .set('Cookie', 'sprintdesk_session=test')
      .expect(200);
    expect(response.body).toEqual(comment);
    expect(service.remove).toHaveBeenCalledExactlyOnceWith(1, 3, 7);
  });

  it.each(['findAll', 'create', 'update', 'remove'] as const)(
    'returns 404 when a non-member calls %s',
    async (operation) => {
      service[operation].mockRejectedValueOnce(
        new NotFoundException('Task not found'),
      );
      const client = request(app.getHttpServer());
      const req =
        operation === 'findAll'
          ? client.get('/tasks/1/comments')
          : operation === 'create'
            ? client.post('/tasks/1/comments').send({ content: 'Hello' })
            : operation === 'update'
              ? client.patch('/tasks/1/comments/3').send({ content: 'Hello' })
              : client.delete('/tasks/1/comments/3');
      await req.set('Cookie', 'sprintdesk_session=test').expect(404);
      expect(service[operation]).toHaveBeenCalledOnce();
    },
  );

  it.each(['update', 'remove'] as const)(
    'returns 404 when a non-author calls %s',
    async (operation) => {
      service[operation].mockRejectedValueOnce(
        new NotFoundException('Comment not found'),
      );
      const client = request(app.getHttpServer());
      const req =
        operation === 'update'
          ? client.patch('/tasks/1/comments/3').send({ content: 'Hello' })
          : client.delete('/tasks/1/comments/3');
      await req.set('Cookie', 'sprintdesk_session=test').expect(404);
      expect(service[operation]).toHaveBeenCalledOnce();
    },
  );
  it.each(['', '   ', 'x'.repeat(2001)])(
    'rejects invalid content',
    async (content) => {
      await request(app.getHttpServer())
        .post('/tasks/1/comments')
        .set('Cookie', 'sprintdesk_session=test')
        .send({ content })
        .expect(400);
      expect(service.create).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .patch('/tasks/1/comments/3')
        .set('Cookie', 'sprintdesk_session=test')
        .send({ content })
        .expect(400);
      expect(service.update).not.toHaveBeenCalled();
    },
  );
  it.each([
    '/tasks/0/comments',
    '/tasks/abc/comments',
    '/tasks/1/comments/0',
    '/tasks/1/comments/abc',
  ])('rejects invalid IDs', async (path) => {
    const req =
      path.split('/').length === 4
        ? request(app.getHttpServer()).get(path)
        : request(app.getHttpServer()).delete(path);
    await req.set('Cookie', 'sprintdesk_session=test').expect(400);
  });
});
