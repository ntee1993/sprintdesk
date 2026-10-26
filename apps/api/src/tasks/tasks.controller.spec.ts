import { Test } from '@nestjs/testing';
import { TasksController } from './tasks.controller.js';

describe('TasksController', () => {
  let tasksController: TasksController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [],
    }).compile();

    tasksController = moduleRef.get<TasksController>(TasksController);
  });

  describe('tasks', () => {
    it('should return array', () => {
      const result = tasksController.findAll();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return 2 tasks', () => {
      const result = tasksController.findAll();
      expect(result).toHaveLength(2);
    });

    it('should return tasks with id, title, status, priority field', () => {
      const result = tasksController.findAll();
      expect(result[0]).toEqual({
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
      });
    });
  });
});
