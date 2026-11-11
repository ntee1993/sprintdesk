<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { addProjectMember, getProjectMembers, type ProjectMember } from '@/services/projects-api'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const auth = useAuthStore()
const name = ref('')
const selectedProjectId = ref<number | null>(null)
const selectedProject = computed(() =>
  projectStore.projects.find((project) => project.id === selectedProjectId.value),
)
const members = ref<ProjectMember[]>([])
const membersLoading = ref(false)
const membersError = ref<string | null>(null)
const memberEmail = ref('')
const memberRole = ref<'EDITOR' | 'VIEWER'>('EDITOR')
const addingMember = ref(false)
let latestMembersRequestId = 0
let selectionId = 0

async function loadMembers(projectId: number) {
  const requestId = ++latestMembersRequestId
  membersLoading.value = true
  membersError.value = null

  try {
    const result = await getProjectMembers(projectId)
    if (requestId === latestMembersRequestId) members.value = result
  } catch (error) {
    if (requestId === latestMembersRequestId) {
      membersError.value = error instanceof Error ? error.message : 'Failed to load members'
    }
  } finally {
    if (requestId === latestMembersRequestId) membersLoading.value = false
  }
}

watch(
  selectedProjectId,
  (projectId) => {
    selectionId++
    latestMembersRequestId++
    members.value = []
    membersError.value = null
    membersLoading.value = false
    addingMember.value = false
    if (projectId !== null) void loadMembers(projectId)
  },
  { flush: 'sync' },
)

onBeforeUnmount(() => {
  selectionId++
  latestMembersRequestId++
})

onMounted(() => {
  void projectStore.fetchProjects().catch(() => {
    // The store exposes the error to the UI.
  })
})

async function handleCreate() {
  if (!name.value.trim()) return

  try {
    await projectStore.addProject(name.value.trim())
    name.value = ''
  } catch {
    // The store exposes the error to the UI.
  }
}

async function handleAddMember() {
  const projectId = selectedProjectId.value
  const email = memberEmail.value.trim()
  const currentSelectionId = selectionId
  if (projectId === null || !email || addingMember.value) return

  addingMember.value = true
  membersError.value = null
  try {
    await addProjectMember(projectId, email, memberRole.value)
    if (currentSelectionId === selectionId) {
      memberEmail.value = ''
      await loadMembers(projectId)
    }
  } catch (error) {
    if (currentSelectionId === selectionId) {
      membersError.value = error instanceof Error ? error.message : 'Failed to add member'
    }
  } finally {
    if (currentSelectionId === selectionId) addingMember.value = false
  }
}
</script>

<template>
  <main>
    <h1>Projects</h1>

    <form @submit.prevent="handleCreate">
      <label for="project-name">Project name</label>
      <input id="project-name" v-model="name" type="text" required />
      <button type="submit" :disabled="projectStore.loading">Create project</button>
    </form>

    <p v-if="projectStore.loading">Loading...</p>
    <p v-if="projectStore.error" role="alert">{{ projectStore.error }}</p>
    <ul v-if="projectStore.projects.length > 0">
      <li v-for="project in projectStore.projects" :key="project.id">{{ project.name }}</li>
    </ul>
    <p v-else-if="!projectStore.loading && !projectStore.error">No projects yet.</p>

    <section v-if="projectStore.projects.length > 0">
      <h2>Project members</h2>
      <label for="members-project">Project</label>
      <select id="members-project" v-model="selectedProjectId">
        <option :value="null" disabled>Select a project</option>
        <option v-for="project in projectStore.projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>

      <template v-if="selectedProject">
        <p v-if="membersLoading" role="status">Loading members...</p>
        <p v-if="membersError" role="alert">{{ membersError }}</p>
        <ul v-if="members.length > 0">
          <li v-for="member in members" :key="member.userId">
            {{ member.name }} — {{ member.email }} — {{ member.role }}
          </li>
        </ul>

        <form v-if="auth.user?.id === selectedProject.ownerId" @submit.prevent="handleAddMember">
          <label for="member-email">Email</label>
          <input id="member-email" v-model="memberEmail" type="email" required />
          <label for="member-role">Role</label>
          <select id="member-role" v-model="memberRole">
            <option value="EDITOR">EDITOR</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button type="submit" :disabled="addingMember">Add member</button>
          <p v-if="addingMember" role="status">Adding member...</p>
        </form>
      </template>
    </section>
  </main>
</template>
