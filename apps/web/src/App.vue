<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Task, TaskPriority, TaskStatus } from './types/task'
import TaskCard from './components/TaskCard.vue'
import TaskSummary from './components/TaskSummary.vue'

type TaskView = 'list' | 'kanban'
const selectedView = ref<TaskView>('list')

const tasks = ref<Task[]>([
  { id: 1, title: 'Create SprintDesk', status: 'todo', priority: 'high' },
  { id: 2, title: 'Learn Vue', status: 'in_progress', priority: 'medium', assignee: 'Nashi' },
  { id: 3, title: 'Prepare for interview', status: 'done', priority: 'urgent' },
])

const inputTitle = ref<Task['title']>('')

const selectedStatus = ref<TaskStatus>('todo')
const selectedPriority = ref<TaskPriority>('high')

const titleErrorMsg = 'Task title is required.'
const titleError = ref<typeof titleErrorMsg | ''>('')

watch(inputTitle, (newValue) => {
  if (newValue.trim().length !== 0) {
    titleError.value = ''
  }
})

const searchQuery = ref('')
const selectedFilter = ref<TaskStatus | 'all'>('all')
const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const searchedTasks = tasks.value.filter((task) => task.title.toLowerCase().includes(query))

  if (selectedFilter.value === 'all') {
    return searchedTasks
  }

  return searchedTasks.filter((task) => task.status === selectedFilter.value)
})

const todoTasks = computed(() => tasks.value.filter((task) => task.status === 'todo'))
const inProgressTasks = computed(() => tasks.value.filter((task) => task.status === 'in_progress'))
const doneTasks = computed(() => tasks.value.filter((task) => task.status === 'done'))

function addTask() {
  const title = inputTitle.value.trim()

  if (title.length === 0) {
    titleError.value = titleErrorMsg
    return
  }

  const taskIds = tasks.value.map((task) => task.id)
  const maxId = taskIds.length > 0 ? Math.max(...taskIds) : 0
  const id = maxId + 1
  const status = selectedStatus.value
  const priority = selectedPriority.value

  tasks.value.push({
    id,
    title,
    status,
    priority,
  })

  titleError.value = ''
  inputTitle.value = ''
  selectedStatus.value = 'todo'
  selectedPriority.value = 'high'
}

function deleteTask(taskId: number) {
  const result = tasks.value.filter((task) => task.id !== taskId)
  tasks.value = result
}
</script>

<template>
  <main>
    <h1>SprintDesk — Project Management</h1>

    <TaskSummary :tasks="tasks" />

    <button @click="selectedView = 'list'" type="button" :aria-pressed="selectedView === 'list'">
      List View
    </button>
    <button
      @click="selectedView = 'kanban'"
      type="button"
      :aria-pressed="selectedView === 'kanban'"
    >
      Kanban View
    </button>

    <section class="task-list" v-show="selectedView === 'list'">
      <div>
        <label for="task-search">Search Tasks:</label>
        <input
          v-model="searchQuery"
          id="task-search"
          type="text"
          placeholder="Search by title..."
        />
      </div>

      <div>
        <label for="task-filter">Filter Tasks:</label>
        <select id="task-filter" v-model="selectedFilter">
          <option value="all">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      <p v-if="filteredTasks.length === 0">No tasks found for the selected filters.</p>
      <TaskCard v-for="task in filteredTasks" :key="task.id" :task="task" @delete="deleteTask" />
    </section>

    <section class="task-board" v-show="selectedView === 'kanban'">
      <h2>Kanban Board</h2>
      <div class="column">
        <h3>Todo ({{ todoTasks.length }})</h3>
        <p v-if="todoTasks.length === 0">No tasks in this column.</p>
        <TaskCard v-for="task in todoTasks" :key="task.id" :task="task" @delete="deleteTask" />
      </div>

      <div class="column">
        <h3>In Progress ({{ inProgressTasks.length }})</h3>
        <p v-if="inProgressTasks.length === 0">No tasks in this column.</p>
        <TaskCard
          v-for="task in inProgressTasks"
          :key="task.id"
          :task="task"
          @delete="deleteTask"
        />
      </div>

      <div class="column">
        <h3>Done ({{ doneTasks.length }})</h3>
        <p v-if="doneTasks.length === 0">No tasks in this column.</p>
        <TaskCard v-for="task in doneTasks" :key="task.id" :task="task" @delete="deleteTask" />
      </div>
    </section>

    <h2>Create New Task</h2>
    <form @submit.prevent="addTask">
      <label for="task-title">Task Title:</label>
      <input
        id="task-title"
        type="text"
        v-model="inputTitle"
        :aria-invalid="Boolean(titleError)"
        :aria-describedby="titleError ? 'task-title-error' : undefined"
      />
      <p v-if="titleError" id="task-title-error" role="alert">
        {{ titleError }}
      </p>

      <label for="task-status">Status:</label>
      <select id="task-status" v-model="selectedStatus">
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>

      <label for="task-priority">Priority:</label>
      <select id="task-priority" v-model="selectedPriority">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>

      <button type="submit">Add Task</button>
    </form>
  </main>
</template>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.task-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.task-board > h2 {
  grid-column: 1 / -1;
}

.column {
  border: 1px solid gray;
  padding: 16px;
}
</style>
