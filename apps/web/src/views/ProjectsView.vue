<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
  type ProjectMember,
} from '@/services/projects-api'
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
const managingMember = ref(false)
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
    managingMember.value = false
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
  if (projectId === null || !email || addingMember.value || managingMember.value) return

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

async function handleRoleChange(member: ProjectMember, event: Event) {
  const select = event.target as HTMLSelectElement
  const role = select.value
  select.value = member.role
  const projectId = selectedProjectId.value
  const currentSelectionId = selectionId

  if (
    projectId === null ||
    member.role === 'OWNER' ||
    auth.user?.id !== selectedProject.value?.ownerId ||
    member.userId === auth.user?.id ||
    (role !== 'EDITOR' && role !== 'VIEWER') ||
    role === member.role ||
    managingMember.value ||
    addingMember.value
  ) {
    return
  }

  managingMember.value = true
  membersError.value = null
  try {
    await updateProjectMemberRole(projectId, member.userId, role)
    if (currentSelectionId === selectionId) await loadMembers(projectId)
  } catch (error) {
    if (currentSelectionId === selectionId) {
      membersError.value = error instanceof Error ? error.message : 'Failed to update member role'
    }
  } finally {
    if (currentSelectionId === selectionId) managingMember.value = false
  }
}

async function handleRemoveMember(member: ProjectMember) {
  const projectId = selectedProjectId.value
  const currentSelectionId = selectionId
  if (
    projectId === null ||
    member.role === 'OWNER' ||
    auth.user?.id !== selectedProject.value?.ownerId ||
    member.userId === auth.user?.id ||
    managingMember.value ||
    addingMember.value
  ) {
    return
  }

  managingMember.value = true
  membersError.value = null
  try {
    await removeProjectMember(projectId, member.userId)
    if (currentSelectionId === selectionId) await loadMembers(projectId)
  } catch (error) {
    if (currentSelectionId === selectionId) {
      membersError.value = error instanceof Error ? error.message : 'Failed to remove member'
    }
  } finally {
    if (currentSelectionId === selectionId) managingMember.value = false
  }
}
</script>

<template>
  <main id="main-content" tabindex="-1" class="page projects-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">YOUR WORKSPACE</p>
        <h1>Projects</h1>
        <p class="page-description">Organize your work and collaborate with your team.</p>
      </div>
    </div>

    <div class="project-layout">
      <div class="project-main">
        <div class="project-list-heading">
          <div>
            <p class="eyebrow">YOUR PROJECTS</p>
            <h2>Projects</h2>
            <p>Choose a project to manage its members.</p>
          </div>
        </div>
        <form class="project-create" @submit.prevent="handleCreate">
          <label for="project-name">Project name</label>
          <input id="project-name" v-model="name" type="text" required />
          <button type="submit" :disabled="projectStore.loading">Create project</button>
        </form>

        <p v-if="projectStore.loading" role="status">Loading projects...</p>
        <p v-if="projectStore.error" role="alert">{{ projectStore.error }}</p>
        <ul v-if="projectStore.projects.length > 0" class="project-list">
          <li v-for="project in projectStore.projects" :key="project.id" class="project-item">
            <span class="project-icon" aria-hidden="true">{{
              project.name.charAt(0).toUpperCase()
            }}</span>
            <div class="project-item-text">
              <strong>{{ project.name }}</strong
              ><span>{{ auth.user?.id === project.ownerId ? 'Owner' : 'Member' }}</span>
            </div>
            <button
              type="button"
              :aria-label="`Manage members for ${project.name}`"
              @click="selectedProjectId = project.id"
            >
              Manage members <span aria-hidden="true">→</span>
            </button>
          </li>
        </ul>
        <p v-else-if="!projectStore.loading && !projectStore.error">No projects yet.</p>
      </div>
      <section v-if="projectStore.projects.length > 0" class="members-panel">
        <p class="eyebrow">COLLABORATION</p>
        <h2>Project members</h2>
        <p class="members-description">View the people working on a project.</p>
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
          <ul v-if="members.length > 0" class="member-list">
            <li v-for="member in members" :key="member.userId" class="member-row">
              {{ member.name }} — {{ member.email }} — {{ member.role }}
              <template
                v-if="
                  auth.user?.id === selectedProject.ownerId &&
                  member.userId !== auth.user.id &&
                  member.role !== 'OWNER'
                "
              >
                <label :for="`member-role-${member.userId}`">Role for {{ member.name }}</label>
                <select
                  :id="`member-role-${member.userId}`"
                  :value="member.role"
                  :disabled="managingMember || addingMember || membersLoading"
                  @change="handleRoleChange(member, $event)"
                >
                  <option value="EDITOR">EDITOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
                <button
                  type="button"
                  :disabled="managingMember || addingMember || membersLoading"
                  @click="handleRemoveMember(member)"
                >
                  Remove
                </button>
              </template>
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
            <button type="submit" :disabled="addingMember || managingMember || membersLoading">
              Add member
            </button>
            <p v-if="addingMember" role="status">Adding member...</p>
          </form>
        </template>
      </section>
    </div>
  </main>
</template>

<style scoped>
.project-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.9fr);
  gap: 22px;
  align-items: start;
}
.project-main,
.members-panel {
  min-width: 0;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-card);
}
.project-list-heading h2,
.members-panel h2 {
  margin: 0;
}
.project-list-heading p:not(.eyebrow),
.members-description {
  margin: 6px 0 0;
  color: var(--color-muted);
  font-size: 13px;
}
.project-create {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
  padding: 18px 0;
  border-bottom: 1px solid var(--color-border);
}
.project-create label {
  flex-basis: 100%;
  margin: 0;
}
.project-create input {
  flex: 1;
  min-width: 140px;
}
.project-list,
.member-list {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
}
.project-list .project-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  margin: 0;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
}
.project-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: 12px;
  font-weight: 750;
}
.project-item-text {
  flex: 1;
  min-width: 0;
  display: grid;
  overflow-wrap: anywhere;
}
.project-item-text span {
  color: var(--color-muted);
  font-size: 12px;
}
.project-item button {
  flex: none;
  font-size: 12px;
}
.members-panel {
  margin-top: 0 !important;
}
.members-panel select {
  max-width: 100%;
  margin: 0;
}
.member-row {
  overflow-wrap: anywhere;
  font-size: 13px;
}
.member-row label {
  display: block;
}
.members-panel form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.members-panel form label {
  flex-basis: 100%;
  margin: 0;
}
.members-panel form input {
  min-width: 0;
}
.members-panel form select {
  max-width: 160px;
}
@media (max-width: 1000px) {
  .project-layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  .project-main,
  .members-panel {
    padding: 18px;
  }
  .project-item {
    flex-wrap: wrap;
  }
  .project-item-text {
    flex-basis: calc(100% - 54px);
  }
  .project-item button {
    margin-left: 54px;
  }
}
</style>
