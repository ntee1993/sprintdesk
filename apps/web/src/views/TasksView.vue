<template>
  <main>
    <h1>SprintDesk — Project Management</h1>
    <p v-if="projectStore.loading" role="status">Loading projects...</p>
    <p v-if="projectStore.error" role="alert">{{ projectStore.error }}</p>
    <p v-if="!projectStore.loading && !projectStore.error && projectStore.projects.length === 0">
      Create a project first
    </p>
    <template v-if="selectedProjectId !== null">
      <label for="project-select">Project:</label>
      <select id="project-select" v-model="selectedProjectId">
        <option v-for="project in projectStore.projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
      <TaskDetailsModal v-if="detailsTask" :task="detailsTask" @close="detailsTaskId = null" />
      <EditTaskModal
        v-if="selectedTask !== undefined"
        @close="closeEditTask"
        @save="updateTask"
        :task="selectedTask"
        :members="members"
        :key="selectedTask.id"
      />
      <p v-if="isLoading" role="status">Loading tasks...</p>
      <p v-if="fetchError" role="alert">{{ fetchError }}</p>
      <p v-if="membersError" role="alert">{{ membersError }}</p>
      <template v-if="tasksReady">
        <TaskSummary :tasks="tasks" />

        <button
          @click="selectedView = 'list'"
          type="button"
          :aria-pressed="selectedView === 'list'"
        >
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

          <button type="button" @click="resetFilters" :disabled="!hasActiveFilters">
            Reset Filters
          </button>

          <p v-if="filteredTasks.length === 0">No tasks found for the selected filters.</p>
          <TaskCard
            v-for="task in filteredTasks"
            :key="task.id"
            :task="task"
            :assignee-name="getAssigneeName(task)"
            @details="detailsTaskId = $event"
            @edit="handleEditTask"
            @delete="deleteTask"
          />
        </section>

        <section class="task-board" v-show="selectedView === 'kanban'">
          <h2>Kanban Board</h2>
          <div class="column">
            <h3>Todo ({{ todoTasks.length }})</h3>
            <p v-if="todoTasks.length === 0">No tasks in this column.</p>
            <TaskCard
              v-for="task in todoTasks"
              :key="task.id"
              :task="task"
              :assignee-name="getAssigneeName(task)"
              @details="detailsTaskId = $event"
              @edit="handleEditTask"
              @delete="deleteTask"
            />
          </div>

          <div class="column">
            <h3>In Progress ({{ inProgressTasks.length }})</h3>
            <p v-if="inProgressTasks.length === 0">No tasks in this column.</p>
            <TaskCard
              v-for="task in inProgressTasks"
              :key="task.id"
              :task="task"
              :assignee-name="getAssigneeName(task)"
              @details="detailsTaskId = $event"
              @edit="handleEditTask"
              @delete="deleteTask"
            />
          </div>

          <div class="column">
            <h3>Done ({{ doneTasks.length }})</h3>
            <p v-if="doneTasks.length === 0">No tasks in this column.</p>
            <TaskCard
              v-for="task in doneTasks"
              :key="task.id"
              :task="task"
              :assignee-name="getAssigneeName(task)"
              @details="detailsTaskId = $event"
              @edit="handleEditTask"
              @delete="deleteTask"
            />
          </div>
        </section>
      </template>

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

        <label for="task-assignee">Assignee:</label>
        <select id="task-assignee" v-model="selectedAssigneeId">
          <option :value="null">Unassigned</option>
          <option v-for="member in members" :key="member.userId" :value="member.userId">
            {{ member.name }} ({{ member.role }})
          </option>
        </select>

        <button type="submit" :disabled="isLoading">Add Task</button>
      </form>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Task, TaskPriority, TaskStatus, TaskChanges } from '@/types/task'
import { getProjectMembers, type ProjectMember } from '@/services/projects-api'
import TaskCard from '@/components/TaskCard.vue'
import TaskSummary from '@/components/TaskSummary.vue'
import EditTaskModal from '@/components/EditTaskModal.vue'
import TaskDetailsModal from '@/components/TaskDetailsModal.vue'
import { useTaskFilters } from '@/composables/useTaskFilters.ts'
import { useTaskStore } from '@/stores/task.ts'
import { useProjectStore } from '@/stores/project'
import { storeToRefs } from 'pinia'

const taskStore = useTaskStore()
const projectStore = useProjectStore()
const { tasks, isLoading, fetchError } = storeToRefs(taskStore)
const selectedProjectId = ref<number | null>(null)
const detailsTaskId = ref<number | null>(null)
const tasksReady = ref(false)
const selectedAssigneeId = ref<number | null>(null)
const members = ref<ProjectMember[]>([])
const membersError = ref<string | null>(null)
let latestMembersRequestId = 0

function getAssigneeName(task: Task): string | undefined {
  return members.value.find((member) => member.userId === task.assigneeId)?.name
}

onMounted(async () => {
  taskStore.clearTasks()
  try {
    await projectStore.fetchProjects()
    selectedProjectId.value = projectStore.projects[0]?.id ?? null
  } catch {
    // The store exposes the error to the UI.
  }
})

watch(
  selectedProjectId,
  (projectId) => {
    const requestId = ++latestMembersRequestId
    detailsTaskId.value = null
    selectedAssigneeId.value = null
    members.value = []
    membersError.value = null
    tasksReady.value = false
    taskStore.clearTasks()

    if (projectId !== null) {
      void taskStore.fetchTasks(projectId).then(() => {
        if (requestId === latestMembersRequestId && taskStore.fetchError === null) {
          tasksReady.value = true
        }
      })
      void getProjectMembers(projectId)
        .then((result) => {
          if (requestId === latestMembersRequestId) members.value = result
        })
        .catch((error: unknown) => {
          if (requestId === latestMembersRequestId) {
            membersError.value = error instanceof Error ? error.message : 'Failed to load members'
          }
        })
    }
  },
  { flush: 'sync' },
)

onBeforeUnmount(() => {
  latestMembersRequestId++
})

type TaskView = 'list' | 'kanban'
const selectedView = ref<TaskView>('list')

const inputTitle = ref<Task['title']>('')

const selectedStatus = ref<TaskStatus>('todo')
const selectedPriority = ref<TaskPriority>('high')

const titleErrorMsg = 'Task title is required.'
const titleError = ref('')

watch(inputTitle, (newValue) => {
  if (newValue.trim().length !== 0) {
    titleError.value = ''
  }
})

const { searchQuery, selectedFilter, filteredTasks, resetFilters, hasActiveFilters } =
  useTaskFilters(tasks)

const todoTasks = computed(() => tasks.value.filter((task) => task.status === 'todo'))
const inProgressTasks = computed(() => tasks.value.filter((task) => task.status === 'in_progress'))
const doneTasks = computed(() => tasks.value.filter((task) => task.status === 'done'))

const detailsTask = computed(() => tasks.value.find((task) => task.id === detailsTaskId.value))
const selectedTaskId = ref<number | null>(null)
const selectedTask = computed(() => {
  if (selectedTaskId.value === null) {
    return undefined
  }
  return tasks.value.find((task) => task.id === selectedTaskId.value)
})

async function addTask() {
  const title = inputTitle.value.trim()

  if (title.length === 0) {
    titleError.value = titleErrorMsg
    return
  }

  const status = selectedStatus.value
  const priority = selectedPriority.value
  const projectId = selectedProjectId.value

  if (projectId === null) return

  try {
    await taskStore.addTask({
      title,
      status,
      priority,
      projectId,
      ...(selectedAssigneeId.value !== null ? { assigneeId: selectedAssigneeId.value } : {}),
    })
    titleError.value = ''
    inputTitle.value = ''
    selectedStatus.value = 'todo'
    selectedPriority.value = 'high'
    selectedAssigneeId.value = null
  } catch {
    // The store exposes the error to the UI.
  }
}

async function deleteTask(taskId: number) {
  try {
    await taskStore.deleteTask(taskId)

    if (taskId === selectedTaskId.value) {
      selectedTaskId.value = null
    }
  } catch {
    // The store exposes the error to the UI.
  }
}

function handleEditTask(taskId: number) {
  selectedTaskId.value = taskId
}

function closeEditTask() {
  selectedTaskId.value = null
}

async function updateTask(taskId: Task['id'], changes: TaskChanges) {
  try {
    await taskStore.updateTask(taskId, changes)
    closeEditTask()
  } catch {
    // Keep the modal open when the update fails.
  }
}
</script>

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
