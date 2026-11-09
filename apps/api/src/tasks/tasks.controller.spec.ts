import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { ProjectAuthorizationService } from '../auth/project-authorization.service.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { SessionService } from '../auth/session.service.js';

describe('TasksController', () => {
  let tasksController: TasksController;
  const tasksService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const projectAuthorization = {
    getProjectRole: vi.fn(),
  };
  const authenticatedRequest = {
    user: {
      id: 1,
      name: 'Tester',
      email: 'tester@example.test',
    },
  } as AuthenticatedRequest;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: tasksService },
        {
          provide: ProjectAuthorizationService,
          useValue: projectAuthorization,
        },
        {
          provide: SessionAuthGuard,
          useValue: { canActivate: vi.fn() },
        },
        {
          provide: SessionService,
          useValue: { validateSession: vi.fn() },
        },
      ],
    }).compile();

    tasksController = moduleRef.get<TasksController>(TasksController);
  });

  describe('findAll', () => {
    it('should return the tasks from the service', () => {
      const tasks = [
        {
          id: 1,
          title: 'Learn NestJS',
          status: 'todo',
          priority: 'high',
          projectId: 1,
        },
      ];
      tasksService.findAll.mockReturnValue(tasks);

      const result = tasksController.findAll({}, authenticatedRequest);

      expect(tasksService.findAll).toHaveBeenCalledOnce();
      expect(result).toEqual(tasks);
    });

    it('should pass status filter to the service and return its result', () => {
      const query = { status: 'done' };
      const tasks = [
        {
          id: 1,
          title: 'Learn NestJS',
          status: 'done',
          priority: 'high',
          projectId: 1,
        },
      ];

      tasksService.findAll.mockReturnValue(tasks);

      const result = tasksController.findAll(query, authenticatedRequest);

      expect(tasksService.findAll).toHaveBeenCalledExactlyOnceWith(
        { status: 'done' },
        1,
      );
      expect(result).toEqual(tasks);
    });
  });

  describe('findOne', () => {
    it('should return the task with ID 1', async () => {
      const tasks = {
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      };
      tasksService.findOne.mockReturnValue(tasks);
      projectAuthorization.getProjectRole.mockResolvedValue('OWNER');

      const result = await tasksController.findOne(1, authenticatedRequest);

      expect(tasksService.findOne).toHaveBeenCalledExactlyOnceWith(1, 1);
      expect(result).toEqual(tasks);
    });
  });

  describe('create', () => {
    it('should pass the input to the service and return the created task', async () => {
      const input = {
        title: 'Learn Dependency Injection',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      };
      const createdTask = { id: 3, ...input };
      tasksService.create.mockReturnValue(createdTask);
      projectAuthorization.getProjectRole.mockResolvedValue('OWNER');

      const result = await tasksController.create(input, authenticatedRequest);

      expect(
        projectAuthorization.getProjectRole,
      ).toHaveBeenCalledExactlyOnceWith(input.projectId, 1);
      expect(tasksService.create).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toEqual(createdTask);
    });
  });

  describe('update', () => {
    it('should update correctly', async () => {
      const updatedTask = {
        id: 1,
        title: 'Learn NestJS',
        status: 'done',
        priority: 'high',
        projectId: 1,
      };
      tasksService.update.mockReturnValue(updatedTask);
      tasksService.findOne.mockReturnValue({
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      });
      projectAuthorization.getProjectRole.mockResolvedValue('OWNER');
      const result = await tasksController.update(
        1,
        { status: 'done' },
        authenticatedRequest,
      );

      expect(tasksService.update).toHaveBeenCalledExactlyOnceWith(
        1,
        { status: 'done' },
        1,
      );
      expect(result).toEqual(updatedTask);
    });
  });

  describe('remove', () => {
    it('should delete correctly', async () => {
      const deletedTask = {
        id: 1,
        title: 'Learn NestJS',
        status: 'done',
        priority: 'high',
        projectId: 1,
      };
      tasksService.remove.mockReturnValue(deletedTask);
      tasksService.findOne.mockReturnValue({
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      });
      projectAuthorization.getProjectRole.mockResolvedValue('OWNER');
      const result = await tasksController.remove(1, authenticatedRequest);

      expect(result).toEqual(deletedTask);
      expect(tasksService.remove).toHaveBeenCalledExactlyOnceWith(1, 1);
    });
  });
});
