<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const name = ref('')

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
  </main>
</template>
