<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Lock, Unlock, User, Settings, Cloud, CloudOff, Feather, Sun, Moon, Download, Shield } from 'lucide-vue-next';

interface Props {
  status: 'connected' | 'disconnected' | 'connecting';
  users?: Array<{ id: number; name: string; color: string }>; // Optional with default
  currentUser: { name: string; color: string };
  isLocked: boolean;
  hasPassword?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  users: () => [],
  hasPassword: false
});
const emit = defineEmits(['update:user', 'toggle-lock', 'export-markdown', 'set-password', 'remove-password']);

// Popover States
const showSettingsMenu = ref(false);
const isDark = ref(false);

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark');
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('collab-note-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('collab-note-theme', 'light');
  }
};

const editUserName = () => {
  const newName = window.prompt('请输入新昵称:', props.currentUser.name);
  if (newName && newName.trim()) {
    emit('update:user', { ...props.currentUser, name: newName.trim() });
  }
};

const newPassword = ref('');
const handleSetPassword = () => {
  if (newPassword.value) {
    emit('set-password', newPassword.value);
    newPassword.value = '';
  }
};

const statusColor = computed(() => {
  switch (props.status) {
    case 'connected': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    case 'disconnected': return 'bg-rose-500';
    case 'connecting': return 'bg-amber-500 animate-pulse';
  }
});

const statusText = computed(() => {
  switch (props.status) {
    case 'connected': return '🟡 P2P 模式'; // Updated UI Feedback
    case 'disconnected': return '离线';
    case 'connecting': return '连接中...';
  }
});
</script>

<template>
  <header class="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 border-b border-slate-200/50 dark:bg-slate-900/90 dark:border-white/10 dark:text-white transition-all duration-300">
    <div class="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
      <!-- Left: Title & Lock Status -->
      <div class="flex items-center gap-4">
        <!-- Logo -->
        <div class="flex items-center gap-2 group cursor-pointer" @click="$router.push('/')">
            <Feather class="w-6 h-6 text-cyan-500 group-hover:-rotate-12 transition-transform duration-300" />
            <h1 class="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Collab Note</h1>
        </div>

        <div class="h-4 w-px bg-slate-200 dark:bg-white/10 hidden sm:block"></div>

        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-slate-500 dark:text-slate-400 hidden sm:block">Untitled Document</span>
        </div>
        
        <!-- Lock Badge (Visible if locked) -->
        <div v-if="isLocked" class="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-md border border-amber-100/50 dark:border-amber-500/20">
          <Lock class="w-3 h-3" />
          <span class="text-xs font-medium">只读模式</span>
        </div>
      </div>

      <!-- Right: Controls & Presence -->
      <div class="flex items-center gap-4">
        
        <!-- Theme Toggle -->
        <button 
          @click="toggleTheme" 
          class="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white rounded-full transition-colors"
          title="Toggle Theme"
        >
          <Sun v-if="!isDark" class="w-5 h-5" />
          <Moon v-else class="w-5 h-5" />
        </button>

        <!-- Room Settings (Lock Toggle) -->
        <div class="relative">
          <button 
            @click="showSettingsMenu = !showSettingsMenu"
            class="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white rounded-full transition-colors"
            :class="{ 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white': showSettingsMenu }"
          >
            <Settings class="w-5 h-5" />
          </button>

          <!-- Glassmorphism Settings Popover -->
          <div v-if="showSettingsMenu" class="absolute top-12 right-0 w-72 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl rounded-xl p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
            <h3 class="text-sm font-semibold text-slate-900 dark:text-white px-1">房间设置</h3>
            
            <!-- Room Lock Toggle -->
            <div class="flex items-center justify-between w-full p-2">
              <div class="flex items-center gap-2">
                <component :is="isLocked ? Lock : Unlock" class="w-4 h-4 text-slate-500" />
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {{ isLocked ? '锁定房间' : '解锁房间' }}
                  </span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    {{ isLocked ? '仅只读 (ReadOnly)' : '允许所有人编辑' }}
                  </span>
                </div>
              </div>
              
              <button 
                @click="emit('toggle-lock')"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 shrink-0"
                :class="isLocked ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'"
              >
                <span 
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm"
                  :class="isLocked ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
            </div>
            
            <div class="h-px bg-slate-100 dark:bg-white/10 my-1"></div>

            <!-- Export Button -->
            <div class="flex items-center justify-between w-full p-2">
               <div class="flex items-center gap-2">
                 <Download class="w-4 h-4 text-cyan-500" />
                 <span class="text-sm font-medium text-slate-700 dark:text-slate-200">导出 Markdown</span>
               </div>
               <button 
                 @click="emit('export-markdown')"
                 class="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded transition-colors"
               >
                 下载
               </button>
            </div>

            <div class="h-px bg-slate-100 dark:bg-white/10 my-1"></div>
            
            <!-- Security Section -->
            <div class="px-2 pt-2 pb-1">
              <h4 class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">安全设置</h4>
              
              <!-- State: Protected -->
              <div v-if="props.hasPassword" class="flex items-center justify-between w-full p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <div class="flex items-center gap-2">
                  <Shield class="w-4 h-4 text-emerald-500" />
                  <span class="text-sm font-medium text-emerald-600 dark:text-emerald-400">已加密</span>
                </div>
                <button 
                  @click="emit('remove-password')"
                  class="px-2 py-1 text-xs text-rose-500 hover:text-white hover:bg-rose-500 font-medium rounded transition-colors"
                >
                  移除密码
                </button>
              </div>
              
              <!-- State: Not Protected -->
              <div v-else class="flex gap-2">
                <input 
                  v-model="newPassword"
                  type="password"
                  placeholder="设置访问密码"
                  class="flex-1 w-full px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  @keyup.enter="handleSetPassword"
                />
                <button 
                  @click="handleSetPassword"
                  class="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 transition-colors"
                  :disabled="!newPassword"
                  title="加密房间"
                >
                  <Lock class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div class="h-6 w-px bg-slate-200 dark:bg-white/10"></div>

        <!-- Current User (Click to Edit) -->
          <!-- User Edit (Simple Prompt) -->
          <button 
            @click="editUserName"
            class="flex items-center gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 p-1 pl-2 rounded-full transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title="点击修改昵称"
          >
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ currentUser.name }}</span>
            <div 
              class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-700"
              :style="{ backgroundColor: currentUser.color }"
            >
              <User class="w-4 h-4" />
            </div>
          </button>

        <!-- Other Users Avatars -->
        <div class="flex -space-x-3" v-if="users && users.length > 0">
          <div 
            v-for="user in users" 
            :key="user.id"
            class="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-black/5"
            :style="{ backgroundColor: user.color }"
            :title="user.name"
          >
            {{ user.name.charAt(0).toUpperCase() }}
          </div>
          <div v-if="users.length > 4" class="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-400 shadow-sm">
            +{{ users.length - 4 }}
          </div>
        </div>
        <div v-else class="text-sm text-slate-400 italic hidden sm:block">在线协作</div>

        <!-- Connection Status -->
        <div class="flex items-center gap-2 ml-2" :title="statusText">
          <div class="relative flex h-2.5 w-2.5">
            <span v-if="status === 'connected'" class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300" :class="statusColor"></span>
          </div>
          <component :is="status === 'disconnected' ? CloudOff : Cloud" class="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
    
    <!-- Backdrop for closing popovers -->
    <div 
      v-if="showSettingsMenu" 
      @click="showSettingsMenu = false" 
      class="fixed inset-0 z-[-1]"
    ></div>
  </header>
</template>
