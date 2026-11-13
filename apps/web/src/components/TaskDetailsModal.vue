<template>
  <BaseModal title="Task Details" @close="emit('close')">
    <h3>{{ task.title }}</h3>
    <p>{{ task.status }}</p>
    <section aria-label="Comments">
      <h3>Comments ({{ comments.length }})</h3>
      <p v-if="loading" role="status">Loading comments...</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="!loading && !error && comments.length === 0">No comments yet.</p>
      <ul>
        <li v-for="comment in comments" :key="comment.id">
          <strong>{{ comment.author.name }}</strong>
          <time :datetime="comment.createdAt">{{
            new Date(comment.createdAt).toLocaleString()
          }}</time>
          <template v-if="editingId === comment.id">
            <form @submit.prevent="saveEdit(comment.id)">
              <label :for="`edit-comment-${comment.id}`">Edit comment</label>
              <textarea
                :id="`edit-comment-${comment.id}`"
                v-model="editContent"
                maxlength="2000"
                required
              />
              <button type="submit" :disabled="busy || !editContent.trim()">Save comment</button>
              <button type="button" :disabled="busy" @click="editingId = null">Cancel</button>
            </form>
          </template>
          <p v-else>{{ comment.content }}</p>
          <template v-if="comment.authorId === auth.user?.id && editingId !== comment.id">
            <button type="button" :disabled="busy || loading" @click="startEdit(comment)">
              Edit comment
            </button>
            <button type="button" :disabled="busy || loading" @click="remove(comment.id)">
              Delete comment
            </button>
          </template>
        </li>
      </ul>
      <form @submit.prevent="create">
        <label for="new-comment">Write a comment</label>
        <textarea id="new-comment" v-model="content" maxlength="2000" required />
        <button type="submit" :disabled="busy || loading || !content.trim()">Add comment</button>
      </form>
    </section>
  </BaseModal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import type { Task } from '@/types/task'
import { useAuthStore } from '@/stores/auth'
import {
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  type TaskComment,
} from '@/services/task-comments-api'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ close: [] }>()
const auth = useAuthStore()
const comments = ref<TaskComment[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const content = ref('')
const editingId = ref<number | null>(null)
const editContent = ref('')
let generation = 0

watch(
  () => props.task.id,
  async (taskId) => {
    const current = ++generation
    comments.value = []
    error.value = null
    content.value = ''
    editingId.value = null
    busy.value = false
    loading.value = true
    try {
      const result = await getTaskComments(taskId)
      if (current === generation)
        comments.value = [...result].sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
        )
    } catch (err) {
      if (current === generation)
        error.value = err instanceof Error ? err.message : 'Failed to load comments'
    } finally {
      if (current === generation) loading.value = false
    }
  },
  { immediate: true, flush: 'sync' },
)

watch(
  () => auth.sessionGeneration,
  () => {
    generation++
    comments.value = []
    content.value = ''
    editingId.value = null
    error.value = null
    loading.value = false
    busy.value = false
    emit('close')
  },
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  generation++
})

async function create() {
  const text = content.value.trim()
  if (!text || busy.value || loading.value) return
  const current = generation
  const taskId = props.task.id
  busy.value = true
  error.value = null
  try {
    const result = await createTaskComment(taskId, text)
    if (current === generation) {
      comments.value = [...comments.value, result].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
      )
      content.value = ''
    }
  } catch (err) {
    if (current === generation)
      error.value = err instanceof Error ? err.message : 'Failed to create comment'
  } finally {
    if (current === generation) busy.value = false
  }
}
function startEdit(comment: TaskComment) {
  editingId.value = comment.id
  editContent.value = comment.content
}
async function saveEdit(commentId: number) {
  const text = editContent.value.trim()
  if (!text || busy.value || loading.value) return
  const current = generation
  busy.value = true
  error.value = null
  try {
    const updated = await updateTaskComment(props.task.id, commentId, text)
    if (current === generation) {
      comments.value = comments.value.map((comment) =>
        comment.id === commentId ? updated : comment,
      )
      editingId.value = null
    }
  } catch (err) {
    if (current === generation)
      error.value = err instanceof Error ? err.message : 'Failed to update comment'
  } finally {
    if (current === generation) busy.value = false
  }
}
async function remove(commentId: number) {
  if (busy.value || loading.value) return
  const current = generation
  busy.value = true
  error.value = null
  try {
    await deleteTaskComment(props.task.id, commentId)
    if (current === generation)
      comments.value = comments.value.filter((comment) => comment.id !== commentId)
  } catch (err) {
    if (current === generation)
      error.value = err instanceof Error ? err.message : 'Failed to delete comment'
  } finally {
    if (current === generation) busy.value = false
  }
}
</script>
