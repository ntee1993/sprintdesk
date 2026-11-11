import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { AuthService } from '../src/auth/auth.service.js';
import { ProjectAuthorizationService } from '../src/auth/project-authorization.service.js';
import { SessionService } from '../src/auth/session.service.js';

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

const mockProjectAccess: Record<
  number,
  { ownerId: number; memberIds: number[] }
> = {
  1: { ownerId: 1, memberIds: [] },
  2: { ownerId: 2, memberIds: [1] },
};

function matchesProjectPermission(task: { projectId: number }, project: any) {
  const conditions = project?.is?.OR;

  if (!Array.isArray(conditions)) {
    return false;
  }

  const access = mockProjectAccess[task.projectId];

  if (!access) {
    return false;
  }

  return conditions.some((condition) => {
    if (condition.ownerId !== undefined) {
      return access.ownerId === condition.ownerId;
    }

    const membership = condition.memberships?.some;

    return (
      membership !== undefined && access.memberIds.includes(membership.userId)
    );
  });
}

const validTaskInput = {
  title: 'Learn Dependency Injection',
  status: 'todo',
  priority: 'high',
  projectId: 1,
};

const authenticatedSessionCookie =
  'sprintdesk_session=authenticated-session-token';

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
  let createProjectMock: ReturnType<typeof vi.fn>;
  let findProjectsMock: ReturnType<typeof vi.fn>;
  let findProjectMembersMock: ReturnType<typeof vi.fn>;
  let findUserMock: ReturnType<typeof vi.fn>;
  let createMemberMock: ReturnType<typeof vi.fn>;
  let registerMock: ReturnType<typeof vi.fn>;
  let loginWithSessionMock: ReturnType<typeof vi.fn>;
  let validateSessionMock: ReturnType<typeof vi.fn>;
  let revokeSessionMock: ReturnType<typeof vi.fn>;
  let getProjectRoleMock: ReturnType<typeof vi.fn>;

  // ---------------------------------------------------------------------------
  // Setup & Teardown
  // ---------------------------------------------------------------------------

  beforeEach(async () => {
    registerMock = vi.fn();
    loginWithSessionMock = vi.fn();
    validateSessionMock = vi.fn();
    revokeSessionMock = vi.fn();
    getProjectRoleMock = vi.fn();
    createProjectMock = vi.fn().mockResolvedValue({
      id: 1,
      name: 'My First Project',
      ownerId: 1,
    });
    findProjectsMock = vi.fn().mockResolvedValue([]);
    findProjectMembersMock = vi.fn().mockResolvedValue({
      owner: { id: 1, name: 'Owner', email: 'owner@example.test' },
      memberships: [
        {
          role: 'EDITOR',
          user: { id: 2, name: 'Editor', email: 'editor@example.test' },
        },
        {
          role: 'VIEWER',
          user: { id: 3, name: 'Viewer', email: 'viewer@example.test' },
        },
      ],
    });
    findUserMock = vi.fn().mockResolvedValue({ id: 2 });
    createMemberMock = vi.fn().mockResolvedValue({
      projectId: 1,
      userId: 2,
      role: 'EDITOR',
    });
    validateSessionMock.mockResolvedValue({
      id: 1,
      name: 'Tester',
      email: 'tester@example.test',
    });
    getProjectRoleMock.mockResolvedValue('OWNER');

    findManyMock = vi
      .fn()
      .mockImplementation(
        ({ where, skip = 0, take = 10, orderBy }: any = {}) => {
          const filteredTasks = mockTasks.filter(
            (task) =>
              (where?.status === undefined || task.status === where.status) &&
              (where?.priority === undefined ||
                task.priority === where.priority) &&
              (where?.projectId === undefined ||
                task.projectId === where.projectId) &&
              matchesProjectPermission(task, where?.project),
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
        },
      );

    createMock = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 3,
        ...data,
      }),
    );

    updateMock = vi.fn().mockResolvedValue([
      {
        ...mockTasks[0],
        status: 'done',
      },
    ]);

    deleteMock = vi.fn().mockResolvedValue({ count: 1 });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        project: {
          create: createProjectMock,
          findMany: findProjectsMock,
          findFirst: findProjectMembersMock,
        },
        user: { findUnique: findUserMock },
        projectMember: { create: createMemberMock },
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
          updateManyAndReturn: updateMock,
          findFirst: vi
            .fn()
            .mockImplementation(({ where }: any) =>
              Promise.resolve(
                mockTasks.find(
                  (task) =>
                    task.id === where.id &&
                    matchesProjectPermission(task, where.project),
                ) ?? null,
              ),
            ),
          deleteMany: deleteMock,
        },
      })
      .overrideProvider(AuthService)
      .useValue({
        register: registerMock,
        loginWithSession: loginWithSessionMock,
      })
      .overrideProvider(SessionService)
      .useValue({
        validateSession: validateSessionMock,
        revokeSession: revokeSessionMock,
      })
      .overrideProvider(ProjectAuthorizationService)
      .useValue({
        getProjectRole: getProjectRoleMock,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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
  // Projects
  // ---------------------------------------------------------------------------

  describe('/projects', () => {
    it('creates a project using the owner ID from the session', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('Cookie', authenticatedSessionCookie)
        .send({ name: 'My First Project' })
        .expect(201);

      expect(createProjectMock).toHaveBeenCalledExactlyOnceWith({
        data: { name: 'My First Project', ownerId: 1 },
      });
      expect(response.body).toEqual({
        id: 1,
        name: 'My First Project',
        ownerId: 1,
      });
    });

    it('rejects an owner ID supplied in the request body', async () => {
      await request(app.getHttpServer())
        .post('/projects')
        .set('Cookie', authenticatedSessionCookie)
        .send({ name: 'My First Project', ownerId: 99 })
        .expect(400);

      expect(createProjectMock).not.toHaveBeenCalled();
    });

    it('queries projects owned by or shared with the session user', async () => {
      await request(app.getHttpServer())
        .get('/projects')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(findProjectsMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          OR: [{ ownerId: 1 }, { memberships: { some: { userId: 1 } } }],
        },
        orderBy: { id: 'asc' },
      });
    });

    it('rejects project requests without a session', async () => {
      await request(app.getHttpServer()).get('/projects').expect(401);
      await request(app.getHttpServer())
        .post('/projects')
        .send({ name: 'My First Project' })
        .expect(401);

      expect(findProjectsMock).not.toHaveBeenCalled();
      expect(createProjectMock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /projects/:projectId/members
  // ---------------------------------------------------------------------------

  describe('GET /projects/:projectId/members', () => {
    const expectedMembers = [
      { userId: 1, name: 'Owner', email: 'owner@example.test', role: 'OWNER' },
      { userId: 2, name: 'Editor', email: 'editor@example.test', role: 'EDITOR' },
      { userId: 3, name: 'Viewer', email: 'viewer@example.test', role: 'VIEWER' },
    ];

    it('allows the owner to see the owner and members', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects/1/members')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual(expectedMembers);
      expect(getProjectRoleMock).toHaveBeenCalledExactlyOnceWith(1, 1);
      expect(findProjectMembersMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          id: 1,
          OR: [{ ownerId: 1 }, { memberships: { some: { userId: 1 } } }],
        },
        select: {
          owner: { select: { id: true, name: true, email: true } },
          memberships: {
            select: {
              role: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    it('allows editors and viewers to see members', async () => {
      for (const [id, role] of [
        [2, 'EDITOR'],
        [3, 'VIEWER'],
      ] as const) {
        validateSessionMock.mockResolvedValueOnce({
          id,
          name: role,
          email: `${role.toLowerCase()}@example.test`,
        });
        getProjectRoleMock.mockResolvedValueOnce(role);

        const response = await request(app.getHttpServer())
          .get('/projects/1/members')
          .set('Cookie', authenticatedSessionCookie)
          .expect(200);

        expect(response.body).toEqual(expectedMembers);
        expect(getProjectRoleMock).toHaveBeenLastCalledWith(1, id);
      }
    });

    it('returns 404 to a non-member', async () => {
      getProjectRoleMock.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .get('/projects/1/members')
        .set('Cookie', authenticatedSessionCookie)
        .expect(404);

      expect(response.body.message).toBe('Project not found');
      expect(findProjectMembersMock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // POST /projects/:projectId/members
  // ---------------------------------------------------------------------------

  describe('POST /projects/:projectId/members', () => {
    const input = { email: 'bob@example.com', role: 'EDITOR' };

    it('allows an owner to add an editor', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/1/members')
        .set('Cookie', authenticatedSessionCookie)
        .send(input)
        .expect(201);

      expect(getProjectRoleMock).toHaveBeenCalledExactlyOnceWith(1, 1);
      expect(findUserMock).toHaveBeenCalledExactlyOnceWith({
        where: { email: input.email },
        select: { id: true },
      });
      expect(createMemberMock).toHaveBeenCalledExactlyOnceWith({
        data: { projectId: 1, userId: 2, role: 'EDITOR' },
      });
      expect(response.body).toEqual({ projectId: 1, userId: 2, role: 'EDITOR' });
    });

    it('rejects an editor attempting to add a member', async () => {
      getProjectRoleMock.mockResolvedValueOnce('EDITOR');

      await request(app.getHttpServer())
        .post('/projects/1/members')
        .set('Cookie', authenticatedSessionCookie)
        .send(input)
        .expect(403);

      expect(findUserMock).not.toHaveBeenCalled();
      expect(createMemberMock).not.toHaveBeenCalled();
    });

    it('returns 404 when the email is not registered', async () => {
      findUserMock.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .post('/projects/1/members')
        .set('Cookie', authenticatedSessionCookie)
        .send(input)
        .expect(404);

      expect(createMemberMock).not.toHaveBeenCalled();
    });

    it('returns 409 when the user is already a member', async () => {
      createMemberMock.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.1',
        }),
      );

      await request(app.getHttpServer())
        .post('/projects/1/members')
        .set('Cookie', authenticatedSessionCookie)
        .send(input)
        .expect(409);
    });

    it('rejects requests without a session', async () => {
      await request(app.getHttpServer())
        .post('/projects/1/members')
        .send(input)
        .expect(401);

      expect(getProjectRoleMock).not.toHaveBeenCalled();
      expect(findUserMock).not.toHaveBeenCalled();
      expect(createMemberMock).not.toHaveBeenCalled();
    });

    it('rejects invalid project IDs and request bodies', async () => {
      for (const projectId of ['abc', '0', '-1']) {
        await request(app.getHttpServer())
          .post(`/projects/${projectId}/members`)
          .set('Cookie', authenticatedSessionCookie)
          .send(input)
          .expect(400);
      }

      for (const body of [
        { ...input, email: 'invalid-email' },
        { ...input, role: 'OWNER' },
        { ...input, extra: true },
      ]) {
        await request(app.getHttpServer())
          .post('/projects/1/members')
          .set('Cookie', authenticatedSessionCookie)
          .send(body)
          .expect(400);
      }

      expect(getProjectRoleMock).not.toHaveBeenCalled();
      expect(findUserMock).not.toHaveBeenCalled();
      expect(createMemberMock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /tasks
  // ---------------------------------------------------------------------------

  describe('GET /tasks', () => {
    it('rejects requests without a valid session', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks')
        .expect(401);

      expect(response.body.message).toBe('Unauthenticated');
      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('returns no tasks from projects outside the user permission scope', async () => {
      validateSessionMock.mockResolvedValueOnce({
        id: 99,
        name: 'Non-member',
        email: 'non-member@example.test',
      });

      const response = await request(app.getHttpServer())
        .get('/tasks')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([]);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
          projectId: undefined,
          project: {
            is: {
              OR: [{ ownerId: 99 }, { memberships: { some: { userId: 99 } } }],
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('returns all tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200)
        .expect(mockTasks);
    });

    it('returns tasks belonging to the requested project', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?projectId=1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([mockTasks[0]]);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
          projectId: 1,
          project: {
            is: {
              OR: [{ ownerId: 1 }, { memberships: { some: { userId: 1 } } }],
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('rejects a non-numeric project ID', async () => {
      await request(app.getHttpServer())
        .get('/tasks?projectId=abc')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('returns no tasks for a project the user cannot access', async () => {
      validateSessionMock.mockResolvedValueOnce({
        id: 99,
        name: 'Non-member',
        email: 'non-member@example.test',
      });

      const response = await request(app.getHttpServer())
        .get('/tasks?projectId=1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([]);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
          projectId: 1,
          project: {
            is: {
              OR: [{ ownerId: 99 }, { memberships: { some: { userId: 99 } } }],
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should filter tasks by status', async () => {
      const expectedTasks = mockTasks.filter((task) => task.status === 'todo');

      const response = await request(app.getHttpServer())
        .get('/tasks?status=todo')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual(expectedTasks);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: 'todo',
          priority: undefined,
        }),
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
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual(expectedTasks);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: undefined,
          priority: 'urgent',
        }),
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
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual(expectedTasks);
      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: 'in_progress',
          priority: 'urgent',
        }),
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should reject an invalid status', async () => {
      await request(app.getHttpServer())
        .get('/tasks?status=invalid')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should reject an unknown query parameter', async () => {
      await request(app.getHttpServer())
        .get('/tasks?unknown=test')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should return page 1 with limit 1', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?page=1&limit=1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([mockTasks[0]]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: undefined,
          priority: undefined,
        }),
        skip: 0,
        take: 1,
        orderBy: { id: 'asc' },
      });
    });

    it('should return page 2 with limit 1', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?page=2&limit=1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([mockTasks[1]]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: undefined,
          priority: undefined,
        }),
        skip: 1,
        take: 1,
        orderBy: { id: 'asc' },
      });
    });

    it('should return an empty array for page 3 with limit 1', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?page=3&limit=1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: undefined,
          priority: undefined,
        }),
        skip: 2,
        take: 1,
        orderBy: { id: 'asc' },
      });
    });

    it('should filter and paginate tasks', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?status=in_progress&page=1&limit=1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([mockTasks[1]]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: 'in_progress',
          priority: undefined,
        }),
        skip: 0,
        take: 1,
        orderBy: { id: 'asc' },
      });
    });

    it('should reject page 0', async () => {
      await request(app.getHttpServer())
        .get('/tasks?page=0')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should reject a limit above 100', async () => {
      await request(app.getHttpServer())
        .get('/tasks?limit=101')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should reject a non-numeric page', async () => {
      await request(app.getHttpServer())
        .get('/tasks?page=abc')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should sort tasks by ID descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?sortBy=id&order=desc')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([...mockTasks].reverse());

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: undefined,
          priority: undefined,
        }),
        skip: 0,
        take: 10,
        orderBy: { id: 'desc' },
      });
    });

    it('should sort tasks by title ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?sortBy=title&order=asc')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      const expectedTasks = [...mockTasks].sort((a, b) =>
        a.title.localeCompare(b.title),
      );

      expect(response.body).toEqual(expectedTasks);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: undefined,
          priority: undefined,
        }),
        skip: 0,
        take: 10,
        orderBy: { title: 'asc' },
      });
    });

    it('should sort by ID descending and paginate', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks?sortBy=id&order=desc&page=1&limit=1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual([mockTasks[1]]);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: expect.objectContaining({
          status: undefined,
          priority: undefined,
        }),
        skip: 0,
        take: 1,
        orderBy: { id: 'desc' },
      });
    });

    it('should reject an invalid sort field', async () => {
      await request(app.getHttpServer())
        .get('/tasks?sortBy=unknown')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

      expect(findManyMock).not.toHaveBeenCalled();
    });

    it('should reject an invalid sort direction', async () => {
      await request(app.getHttpServer())
        .get('/tasks?order=random')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

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
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(response.body).toEqual(mockTasks[0]);
    });

    it('returns 404 when task does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks/999')
        .set('Cookie', authenticatedSessionCookie)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toBe('Task not found');
    });

    it('hides a task from a non-member with 404', async () => {
      validateSessionMock.mockResolvedValueOnce({
        id: 99,
        name: 'Non-member',
        email: 'non-member@example.test',
      });

      const response = await request(app.getHttpServer())
        .get('/tasks/1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(404);

      expect(response.body.message).toBe('Task not found');
    });

    it('returns 400 when ID is invalid', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks/hello')
        .set('Cookie', authenticatedSessionCookie)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /tasks
  // ---------------------------------------------------------------------------

  describe('POST /tasks', () => {
    it('allows an owner to create a task', async () => {
      getProjectRoleMock.mockResolvedValueOnce('OWNER');

      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('Cookie', authenticatedSessionCookie)
        .send(validTaskInput)
        .expect(201);

      expect(response.body).toEqual({
        id: 3,
        ...validTaskInput,
      });

      expect(createMock).toHaveBeenCalledExactlyOnceWith({
        data: validTaskInput,
      });
      expect(getProjectRoleMock).toHaveBeenCalledExactlyOnceWith(1, 1);
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
        .set('Cookie', authenticatedSessionCookie)
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

    it('allows an editor to create a task', async () => {
      const input = {
        ...validTaskInput,
        title: 'Editor Created Task',
      };
      getProjectRoleMock.mockResolvedValueOnce('EDITOR');

      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('Cookie', authenticatedSessionCookie)
        .send(input)
        .expect(201);

      expect(response.body).toEqual({ id: 3, ...input });
      expect(getProjectRoleMock).toHaveBeenCalledExactlyOnceWith(1, 1);
      expect(createMock).toHaveBeenCalledExactlyOnceWith({ data: input });
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .send(validTaskInput)
        .expect(401);

      expect(response.body.message).toBe('Unauthenticated');
      expect(getProjectRoleMock).not.toHaveBeenCalled();
      expect(createMock).not.toHaveBeenCalled();
    });

    it('rejects a viewer from creating a task', async () => {
      getProjectRoleMock.mockResolvedValueOnce('VIEWER');

      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('Cookie', authenticatedSessionCookie)
        .send(validTaskInput)
        .expect(403);

      expect(response.body.message).toBe('Insufficient project permission');
      expect(createMock).not.toHaveBeenCalled();
    });

    it('rejects a non-member from creating a task', async () => {
      getProjectRoleMock.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('Cookie', authenticatedSessionCookie)
        .send(validTaskInput)
        .expect(403);

      expect(response.body.message).toBe('Insufficient project permission');
      expect(createMock).not.toHaveBeenCalled();
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
          .set('Cookie', authenticatedSessionCookie)
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
          .set('Cookie', authenticatedSessionCookie)
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
          .set('Cookie', authenticatedSessionCookie)
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
          .set('Cookie', authenticatedSessionCookie)
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
          .set('Cookie', authenticatedSessionCookie)
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
  // POST /auth/login
  // ---------------------------------------------------------------------------

  describe('POST /auth/login', () => {
    it('logs in successfully and returns 200', async () => {
      const body = {
        email: 'tester@example.test',
        password: 'MySecurePassword123!',
      };

      loginWithSessionMock.mockResolvedValue({
        user: {
          id: 1,
          name: 'Tester',
          email: body.email,
        },
        token: 'test-session-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(body)
        .expect(200);

      expect(loginWithSessionMock).toHaveBeenCalledExactlyOnceWith(body);
      expect(response.body).toEqual({
        id: 1,
        name: 'Tester',
        email: body.email,
      });
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('token');
      expect(response.body).not.toHaveProperty('expiresAt');
      expect(response.headers['set-cookie']?.[0]).toContain(
        'sprintdesk_session=test-session-token',
      );
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    });

    it('rejects an invalid login email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'MySecurePassword123!',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(loginWithSessionMock).not.toHaveBeenCalled();
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('rejects an empty password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'tester@example.test',
          password: '',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(loginWithSessionMock).not.toHaveBeenCalled();
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('returns 401 for an unknown email', async () => {
      const credentials = {
        email: 'unknown@example.test',
        password: 'MySecurePassword123!',
      };

      loginWithSessionMock.mockRejectedValueOnce(
        new UnauthorizedException('Invalid email or password'),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
      expect(loginWithSessionMock).toHaveBeenCalledExactlyOnceWith(credentials);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('returns 401 for an incorrect password', async () => {
      const credentials = {
        email: 'tester@example.test',
        password: 'IncorrectPassword123!',
      };

      loginWithSessionMock.mockRejectedValueOnce(
        new UnauthorizedException('Invalid email or password'),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
      expect(loginWithSessionMock).toHaveBeenCalledExactlyOnceWith(credentials);
      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /auth/me
  // ---------------------------------------------------------------------------

  describe('GET /auth/me', () => {
    it('returns the user for a valid session cookie', async () => {
      const user = {
        id: 1,
        name: 'Tester',
        email: 'tester@example.test',
      };
      validateSessionMock.mockResolvedValue(user);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'sprintdesk_session=test-session-token')
        .expect(200);

      expect(validateSessionMock).toHaveBeenCalledExactlyOnceWith(
        'test-session-token',
      );
      expect(response.body).toEqual(user);
    });

    it('rejects requests without a session cookie', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      expect(response.body.message).toBe('Unauthenticated');
      expect(validateSessionMock).not.toHaveBeenCalled();
    });

    it('rejects an invalid session token', async () => {
      validateSessionMock.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'sprintdesk_session=invalid-session-token')
        .expect(401);

      expect(response.body.message).toBe('Unauthenticated');
      expect(validateSessionMock).toHaveBeenCalledExactlyOnceWith(
        'invalid-session-token',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /auth/logout
  // ---------------------------------------------------------------------------

  describe('POST /auth/logout', () => {
    it('revokes the session and clears its cookie', async () => {
      revokeSessionMock.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', 'sprintdesk_session=test-session-token')
        .expect(204);

      expect(revokeSessionMock).toHaveBeenCalledExactlyOnceWith(
        'test-session-token',
      );
      expect(response.headers['set-cookie']?.[0]).toContain(
        'sprintdesk_session=;',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /tasks/:id
  // ---------------------------------------------------------------------------

  describe('PATCH /tasks/:id', () => {
    it('updates a task successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch('/tasks/1')
        .set('Cookie', authenticatedSessionCookie)
        .send({ status: 'done' })
        .expect(200);

      expect(updateMock).toHaveBeenCalledOnce();
      expect(response.body).toEqual({
        ...mockTasks[0],
        status: 'done',
      });
    });

    it('updates a task assignee ID successfully', async () => {
      updateMock.mockResolvedValueOnce([{ ...mockTasks[0], assigneeId: 1 }]);
      const response = await request(app.getHttpServer())
        .patch('/tasks/1')
        .set('Cookie', authenticatedSessionCookie)
        .send({ assigneeId: 1 })
        .expect(200);

      expect(updateMock).toHaveBeenCalledOnce();
      expect(response.body).toEqual({
        ...mockTasks[0],
        assigneeId: 1,
      });
    });

    it('unassigns a task', async () => {
      updateMock.mockResolvedValueOnce([{ ...mockTasks[0], assigneeId: null }]);
      const response = await request(app.getHttpServer())
        .patch('/tasks/1')
        .set('Cookie', authenticatedSessionCookie)
        .send({ assigneeId: null })
        .expect(200);

      expect(updateMock).toHaveBeenCalledOnce();
      expect(response.body).toEqual({
        ...mockTasks[0],
        assigneeId: null,
      });
    });

    it('rejects a viewer from updating a task', async () => {
      getProjectRoleMock.mockResolvedValueOnce('VIEWER');

      const response = await request(app.getHttpServer())
        .patch('/tasks/1')
        .set('Cookie', authenticatedSessionCookie)
        .send({ status: 'done' })
        .expect(403);

      expect(response.body.message).toBe('Insufficient project permission');
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('hides a task from a non-member attempting to update it', async () => {
      validateSessionMock.mockResolvedValueOnce({
        id: 99,
        name: 'Non-member',
        email: 'non-member@example.test',
      });

      const response = await request(app.getHttpServer())
        .patch('/tasks/1')
        .set('Cookie', authenticatedSessionCookie)
        .send({ status: 'done' })
        .expect(404);

      expect(response.body.message).toBe('Task not found');
      expect(updateMock).not.toHaveBeenCalled();
    });

    describe('Invalid Input', () => {
      it('rejects invalid value', async () => {
        await request(app.getHttpServer())
          .patch('/tasks/1')
          .set('Cookie', authenticatedSessionCookie)
          .send({ status: 'invalid' })
          .expect(400);

        expect(updateMock).not.toHaveBeenCalled();
      });

      it('rejects non-white-listed field', async () => {
        await request(app.getHttpServer())
          .patch('/tasks/1')
          .set('Cookie', authenticatedSessionCookie)
          .send({ projectId: 1 })
          .expect(400);

        expect(updateMock).not.toHaveBeenCalled();
      });

      it('rejects invalid task ID', async () => {
        await request(app.getHttpServer())
          .patch('/tasks/hello')
          .set('Cookie', authenticatedSessionCookie)
          .send({ status: 'done' })
          .expect(400);

        expect(updateMock).not.toHaveBeenCalled();
      });

      it('rejects non-exist task ID', async () => {
        const response = await request(app.getHttpServer())
          .patch('/tasks/999')
          .set('Cookie', authenticatedSessionCookie)
          .send({ status: 'done' })
          .expect(404);

        expect(response.body.message).toBe('Task not found');
        expect(updateMock).not.toHaveBeenCalled();
      });

      it('rejects non-exist assignee ID', async () => {
        const response = await request(app.getHttpServer())
          .patch('/tasks/3')
          .set('Cookie', authenticatedSessionCookie)
          .send({ assigneeId: 999999 })
          .expect(404);

        expect(response.body.message).toBe('Task not found');
        expect(updateMock).not.toHaveBeenCalled();
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
        .set('Cookie', authenticatedSessionCookie)
        .expect(200);

      expect(deleteMock).toHaveBeenCalledOnce();
      expect(response.body).toEqual({
        ...mockTasks[0],
      });
    });

    it('rejects a viewer from deleting a task', async () => {
      getProjectRoleMock.mockResolvedValueOnce('VIEWER');

      const response = await request(app.getHttpServer())
        .delete('/tasks/1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(403);

      expect(response.body.message).toBe('Insufficient project permission');
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('hides a task from a non-member attempting to delete it', async () => {
      validateSessionMock.mockResolvedValueOnce({
        id: 99,
        name: 'Non-member',
        email: 'non-member@example.test',
      });

      const response = await request(app.getHttpServer())
        .delete('/tasks/1')
        .set('Cookie', authenticatedSessionCookie)
        .expect(404);

      expect(response.body.message).toBe('Task not found');
      expect(deleteMock).not.toHaveBeenCalled();
    });

    describe('Invalid Input', () => {
      it('rejects non-exist task ID', async () => {
        const response = await request(app.getHttpServer())
          .delete('/tasks/999')
          .set('Cookie', authenticatedSessionCookie)
          .expect(404);

        expect(response.body.message).toBe('Task not found');
        expect(deleteMock).not.toHaveBeenCalled();
      });

      it('rejects invalid task ID', async () => {
        await request(app.getHttpServer())
          .delete('/tasks/abc')
          .set('Cookie', authenticatedSessionCookie)
          .expect(400);

        expect(deleteMock).not.toHaveBeenCalled();
      });
    });
  });
});
