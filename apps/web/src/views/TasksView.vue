<template>
  <main id="main-content" tabindex="-1" class="page tasks-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">YOUR WORKSPACE</p>
        <h1>Tasks</h1>
        <p class="page-description">Keep track of work across your projects.</p>
      </div>
    </div>
    <p v-if="projectStore.loading" role="status">Loading projects...</p>
    <p v-if="projectStore.error" role="alert">{{ projectStore.error }}</p>
    <p v-if="!projectStore.loading && !projectStore.error && projectStore.projects.length === 0">
      Create a project first
    </p>
    <template v-if="selectedProjectId !== null">
      <div class="project-picker">
        <div>
          <p class="eyebrow">CURRENT PROJECT</p>
          <label for="project-select">Project:</label>
        </div>
        <select id="project-select" v-model="selectedProjectId">
          <option v-for="project in projectStore.projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>
      <TaskDetailsModal v-if="detailsTask" :task="detailsTask" @close="detailsTaskId = null" />
      <EditTaskModal
        v-if="selectedTask !== undefined"
        @close="closeEditTask"
        @save="updateTask"
        :task="selectedTask"
        :members="members"
        :loading="updatePending"
        :error="updateError"
        :key="selectedTask.id"
      />
      <p v-if="isLoading" role="status">Loading tasks...</p>
      <p v-if="fetchError" role="alert">{{ fetchError }}</p>
      <p v-if="membersError" role="alert">{{ membersError }}</p>
      <template v-if="tasksReady">
        <TaskSummary :tasks="tasks" />

        <div class="view-switch" role="group" aria-label="Task view">
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
        </div>

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
            :can-edit="canEditTasks"
            @details="detailsTaskId = $event"
            @edit="handleEditTask"
            @delete="deleteTask"
          />
        </section>

        <section class="task-board" v-show="selectedView === 'kanban'">
          <h2>Kanban Board</h2>
          <div class="column">
            <h3>
              <span class="column-dot todo-dot"></span>Todo
              <span class="column-count">({{ todoTasks.length }})</span>
            </h3>
            <p v-if="todoTasks.length === 0">No tasks in this column.</p>
            <TaskCard
              v-for="task in todoTasks"
              :key="task.id"
              :task="task"
              :assignee-name="getAssigneeName(task)"
              :can-edit="canEditTasks"
              @details="detailsTaskId = $event"
              @edit="handleEditTask"
              @delete="deleteTask"
            />
          </div>

          <div class="column">
            <h3>
              <span class="column-dot progress-dot"></span>In Progress
              <span class="column-count">({{ inProgressTasks.length }})</span>
            </h3>
            <p v-if="inProgressTasks.length === 0">No tasks in this column.</p>
            <TaskCard
              v-for="task in inProgressTasks"
              :key="task.id"
              :task="task"
              :assignee-name="getAssigneeName(task)"
              :can-edit="canEditTasks"
              @details="detailsTaskId = $event"
              @edit="handleEditTask"
              @delete="deleteTask"
            />
          </div>

          <div class="column">
            <h3>
              <span class="column-dot done-dot"></span>Done
              <span class="column-count">({{ doneTasks.length }})</span>
            </h3>
            <p v-if="doneTasks.length === 0">No tasks in this column.</p>
            <TaskCard
              v-for="task in doneTasks"
              :key="task.id"
              :task="task"
              :assignee-name="getAssigneeName(task)"
              :can-edit="canEditTasks"
              @details="detailsTaskId = $event"
              @edit="handleEditTask"
              @delete="deleteTask"
            />
          </div>
        </section>
      </template>

      <form v-if="canEditTasks" class="create-task-panel" @submit.prevent="addTask">
        <div>
          <p class="eyebrow">NEW TASK</p>
          <h2>Create New Task</h2>
          <p>Capture the next piece of work for this project.</p>
        </div>
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
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

const taskStore = useTaskStore()
const projectStore = useProjectStore()
const auth = useAuthStore()
const { tasks, isLoading, fetchError } = storeToRefs(taskStore)
const selectedProjectId = ref<number | null>(null)
const detailsTaskId = ref<number | null>(null)
const selectedTaskId = ref<number | null>(null)
const tasksReady = ref(false)
const selectedAssigneeId = ref<number | null>(null)
const members = ref<ProjectMember[]>([])
const membersError = ref<string | null>(null)
const canEditTasks = computed(() => {
  const role = members.value.find((member) => member.userId === auth.user?.id)?.role
  return role === 'OWNER' || role === 'EDITOR'
})
const updatePending = ref(false)
const updateError = ref<string | null>(null)
let editGeneration = 0
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
    editGeneration++
    selectedTaskId.value = null
    updatePending.value = false
    updateError.value = null
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

watch(
  () => auth.sessionGeneration,
  () => {
    latestMembersRequestId++
    editGeneration++
    members.value = []
    membersError.value = null
    selectedTaskId.value = null
    detailsTaskId.value = null
    selectedProjectId.value = null
    updatePending.value = false
    updateError.value = null
  },
  { flush: 'sync' },
)

onBeforeUnmount(() => {
  latestMembersRequestId++
  editGeneration++
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

  if (projectId === null || !canEditTasks.value) return

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
  if (!canEditTasks.value) return
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
  if (!canEditTasks.value) return
  editGeneration++
  updatePending.value = false
  updateError.value = null
  selectedTaskId.value = taskId
}

function closeEditTask() {
  editGeneration++
  updatePending.value = false
  updateError.value = null
  selectedTaskId.value = null
}

async function updateTask(taskId: Task['id'], changes: TaskChanges) {
  if (updatePending.value || !canEditTasks.value) return
  const current = editGeneration
  updatePending.value = true
  updateError.value = null
  try {
    await taskStore.updateTask(taskId, changes)
    if (current === editGeneration) closeEditTask()
  } catch (error) {
    if (current === editGeneration) {
      updateError.value = error instanceof Error ? error.message : 'Failed to update task'
    }
  } finally {
    if (current === editGeneration) updatePending.value = false
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
.project-picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.project-picker .eyebrow {
  margin: 0 0 3px;
}
.project-picker select {
  width: min(100%, 300px);
}
.view-switch {
  display: inline-flex;
  padding: 4px;
  background: #edeff5;
  border-radius: 10px;
  gap: 4px;
}
.view-switch button {
  border-color: transparent !important;
  background: transparent !important;
}
.view-switch button[aria-pressed='true'] {
  color: var(--color-primary) !important;
  background: white !important;
  box-shadow: 0 1px 4px #20263c18;
}
.column h3 {
  display: flex;
  align-items: center;
  gap: 8px;
}
.column-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8793a7;
}
.progress-dot {
  background: #7566dc;
}
.done-dot {
  background: #369b78;
}
.column-count {
  margin-left: auto;
  padding: 2px 8px;
  background: white;
  border-radius: 999px;
  color: var(--color-muted);
}
.create-task-panel h2 {
  margin: 0;
}
.create-task-panel p:not(.eyebrow) {
  color: var(--color-muted);
  margin: 5px 0 12px;
}
.create-task-panel input,
.create-task-panel select {
  width: 100%;
}
.create-task-panel {
  gap: 10px;
}
@media (max-width: 500px) {
  .project-picker {
    align-items: stretch;
    flex-direction: column;
  }
  .project-picker select {
    width: 100%;
  }
}
</style>
