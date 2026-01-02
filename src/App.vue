<script setup lang="ts">
import { onMounted } from 'vue';

// App.vue now serves as the root layout shell
onMounted(() => {
  // 1. Check LocalStorage
  const storedTheme = localStorage.getItem('collab-note-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (storedTheme === 'dark' || (!storedTheme && systemPrefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // 2. Listen for System Changes (only if no manual override)
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', (e) => {
    if (!localStorage.getItem('collab-note-theme')) {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
});
</script>

<template>
  <div class="min-h-screen flex flex-col font-sans text-slate-900">
    <router-view></router-view>
  </div>
</template>

<style>
/* Global scrollbar adjustments for a cleaner look */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
