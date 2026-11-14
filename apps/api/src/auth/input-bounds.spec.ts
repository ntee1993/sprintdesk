import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { CreateProjectDto } from '../projects/dto/create-project.dto.js';
import { AddProjectMemberDto } from '../projects/dto/add-project-member.dto.js';
import { CreateTaskDto } from '../tasks/dto/create-task.dto.js';
import { UpdateTaskDto } from '../tasks/dto/update-task.dto.js';

describe('request string bounds', () => {
  it.each([
    [
      LoginDto,
      { email: 'test@example.test', password: 'x'.repeat(1025) },
      'password',
    ],
    [
      RegisterDto,
      {
        name: 'x'.repeat(121),
        email: 'test@example.test',
        password: 'LongPassword123!',
      },
      'name',
    ],
    [
      RegisterDto,
      { name: 'User', email: 'test@example.test', password: 'x'.repeat(1025) },
      'password',
    ],
    [CreateProjectDto, { name: 'x'.repeat(201) }, 'name'],
    [
      CreateTaskDto,
      {
        title: 'x'.repeat(201),
        status: 'todo',
        priority: 'high',
        projectId: 1,
      },
      'title',
    ],
    [UpdateTaskDto, { title: 'x'.repeat(201) }, 'title'],
    [
      AddProjectMemberDto,
      { email: `${'x'.repeat(250)}@example.test`, role: 'EDITOR' },
      'email',
    ],
  ])('rejects an oversized field', async (Dto, input, field) => {
    const instance = plainToInstance(Dto as new () => object, input);
    const errors = await validate(instance);
    expect(
      errors.find((error) => error.property === field)?.constraints,
    ).toHaveProperty('maxLength');
  });
  it('accepts a 1024-character password', async () => {
    const instance = plainToInstance(LoginDto, {
      email: 'test@example.test',
      password: 'x'.repeat(1024),
    });
    expect(await validate(instance)).toEqual([]);
  });
});
