export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Task = {
  id: number
  title: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId?: number | null
  assignee?: string
  dueDate?: string
}

export type TaskChanges = Pick<Task, 'title' | 'status' | 'priority' | 'assigneeId'>
