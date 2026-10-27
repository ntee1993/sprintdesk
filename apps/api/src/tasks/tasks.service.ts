import { Injectable, NotFoundException } from '@nestjs/common';

export type CreateTaskInput = {
  title: string;
  status: string;
  priority: string;
};

@Injectable()
export class TasksService {
  private tasks = [
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
  ];

  findAll() {
    return this.tasks;
  }

  findOne(id: number) {
    const result = this.tasks.find((task) => task['id'] === id);
    if (result === undefined) {
      throw new NotFoundException('Task not found');
    }
    return result;
  }

  create(task: CreateTaskInput) {
    const ids = this.tasks.map((task) => task['id']);
    const newId = ids.length !== 0 ? Math.max(...ids) + 1 : 1;
    const newTask = {
      id: newId,
      ...task,
    };

    this.tasks.push(newTask);

    return newTask;
  }
}
