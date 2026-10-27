import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  let tasksService: TasksService;

  beforeEach(() => {
    tasksService = new TasksService();
  });

  describe('findAll', () => {
    it('should return the initial tasks', () => {
      const tasks = tasksService.findAll();

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toEqual({
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
      });
    });
  });

  describe('findOne', () => {
    it('should return the task with ID 1', () => {
      const task = {
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
      };
      const result = tasksService.findOne(task.id);

      expect(result).toEqual(task);
    });
    it('should throw NotFoundException when task is not found', () => {
      expect(() => tasksService.findOne(999)).toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const newTask = {
      priority: 'high',
      status: 'todo',
      title: 'Learn Dependency Injection',
    };

    it('should add the new task with an ID', () => {
      const result = tasksService.create(newTask);
      expect(result).toEqual({
        id: 3,
        ...newTask,
      });
      expect(tasksService.findAll()).toHaveLength(3);
      expect(tasksService.findAll()).toContainEqual(result);
    });

    it('should assign distinct IDs to consecutive tasks', () => {
      const first = tasksService.create(newTask);
      const second = tasksService.create(newTask);

      expect(first.id).toBe(3);
      expect(second.id).toBe(4);
      expect(tasksService.findAll()).toHaveLength(4);
    });
  });
});
