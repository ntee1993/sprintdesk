<template>
  <header>
    <nav aria-label="Main navigation">
      <RouterLink to="/">Dashboard</RouterLink>
      <RouterLink to="/tasks">Tasks</RouterLink>
      <RouterLink to="/projects">Projects</RouterLink>
    </nav>
  </header>

  <RouterView />
</template>

<style scoped>
nav {
  display: flex;
  gap: 16px;
}
</style>
