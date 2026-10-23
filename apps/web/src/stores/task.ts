import type { Task, TaskChanges } from '@/types/task'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([
    { id: 1, title: 'Create SprintDesk', status: 'todo', priority: 'high' },
    { id: 2, title: 'Learn Vue', status: 'in_progress', priority: 'medium', assignee: 'Nashi' },
    { id: 3, title: 'Prepare for interview', status: 'done', priority: 'urgent' },
  ])

  const addTask = (newTask: Pick<Task, 'title' | 'status' | 'priority'>) => {
    const taskIds = tasks.value.map((task) => task.id)
    const maxId = taskIds.length > 0 ? Math.max(...taskIds) : 0
    const id = maxId + 1

    tasks.value.push({
      id,
      ...newTask,
    })
  }

  const deleteTask = (taskId: Task['id']) => {
    const result = tasks.value.filter((task) => task.id !== taskId)
    tasks.value = result
  }

  const updateTask = (taskId: Task['id'], changes: TaskChanges) => {
    const updatedTask = tasks.value.map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          ...changes,
        }
      }

      return task
    })

    tasks.value = updatedTask
  }

  return { tasks, addTask, deleteTask, updateTask }
})
