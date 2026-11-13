<template>
  <main id="main-content" tabindex="-1" class="page dashboard-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">YOUR WORKSPACE</p>
        <h1>Dashboard</h1>
        <p class="page-description">A snapshot of the tasks currently loaded in this session.</p>
      </div>
    </div>
    <TaskSummary :tasks="tasks" />
    <section class="dashboard-next">
      <div>
        <p class="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
        <h2>Make space for your best work.</h2>
        <p>Open a project to see its tasks, or manage the people you work with.</p>
      </div>
      <div class="dashboard-links">
        <RouterLink to="/tasks">View tasks <span aria-hidden="true">→</span></RouterLink
        ><RouterLink to="/projects">Browse projects <span aria-hidden="true">→</span></RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/stores/task.ts'
import { storeToRefs } from 'pinia'
import TaskSummary from '@/components/TaskSummary.vue'

const taskStore = useTaskStore()
const { tasks } = storeToRefs(taskStore)
</script>

<style scoped>
.dashboard-next {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  background: #f0efff;
  border: 1px solid #e4e1fc;
  border-radius: var(--radius-lg);
  padding: 28px;
  margin-top: 24px;
}
.dashboard-next h2 {
  margin: 0 0 8px;
  font-size: 19px;
}
.dashboard-next p:not(.eyebrow) {
  margin: 0;
  color: var(--color-muted);
  max-width: 440px;
}
.dashboard-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.dashboard-links a {
  display: inline-flex;
  gap: 16px;
  padding: 10px 14px;
  background: white;
  color: var(--color-primary);
  border: 1px solid #dedaf9;
  border-radius: var(--radius-sm);
  font-weight: 650;
  text-decoration: none;
}
.dashboard-links a:hover {
  background: #fafaff;
}
@media (max-width: 700px) {
  .dashboard-next {
    align-items: flex-start;
    flex-direction: column;
    padding: 22px;
  }
}
</style>
