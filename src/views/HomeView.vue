<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
// @ts-ignore
import { ArrowRight, Globe, Loader2, Moon, Sun, Eye, EyeOff, X, Clock, Ghost } from 'lucide-vue-next';

interface RoomRecord {
  name: string;
  timestamp: number;
}

const router = useRouter();
const roomName = ref('');
const bgLoaded = ref(false);
const bgUrl = ref('');
const shakeInput = ref(false);
const isLoading = ref(true);
const isDark = ref(false);
const isIncognito = ref(false); // Functions as "Incognito Mode" (No History)
const recentRooms = ref<RoomRecord[]>([]);

// Simple Time Ago Formatter
const timeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};

onMounted(() => {
  const img = new Image();
  // Using Bing Official Mirror
  const url = 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN';
  
  img.onload = () => {
    bgUrl.value = url;
    bgLoaded.value = true;
    isLoading.value = false;
  };
  img.onerror = () => {
    isLoading.value = false;
  }
  img.src = url;

  // Initial Theme Check
  isDark.value = document.documentElement.classList.contains('dark');

  // Load Recent Rooms with Migration
  try {
    const stored = localStorage.getItem('collab-recent-rooms');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migration: Convert string[] to object[]
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
        recentRooms.value = parsed.map((name: string) => ({ 
          name, 
          timestamp: Date.now() 
        }));
        // Save migrated structure immediately
        localStorage.setItem('collab-recent-rooms', JSON.stringify(recentRooms.value));
      } else {
        recentRooms.value = parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load history', e);
  }
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

const joinRoom = (name?: string) => {
  const targetName = name || roomName.value.trim();
  if (!targetName) {
    shakeInput.value = true;
    setTimeout(() => shakeInput.value = false, 500);
    return;
  }

  // Only save history if Incognito is OFF using the user rule
  if (!isIncognito.value) {
    const filtered = recentRooms.value.filter(r => r.name !== targetName);
    
    // We only store simple records
    const newEntry: RoomRecord = { 
      name: targetName, 
      timestamp: Date.now()
    };
    
    const newHistory = [newEntry, ...filtered].slice(0, 50);
    recentRooms.value = newHistory;
    localStorage.setItem('collab-recent-rooms', JSON.stringify(newHistory));
  }

  router.push('/' + encodeURIComponent(targetName));
};

const removeHistoryObj = (roomName: string) => {
  recentRooms.value = recentRooms.value.filter(r => r.name !== roomName);
  localStorage.setItem('collab-recent-rooms', JSON.stringify(recentRooms.value));
};

const createRandomRoom = () => {
  const randomRoom = Math.random().toString(36).substring(2, 8);
  joinRoom(randomRoom);
};
</script>

<template>
  <div class="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-sans text-slate-900 transition-colors duration-500">
    
    <div class="fixed inset-0 bg-[#0f172a] z-[-2]"></div>

    <div 
      class="fixed inset-0 bg-cover bg-center transition-opacity duration-700 z-[-1]"
      :class="bgLoaded ? 'opacity-100' : 'opacity-0'"
      :style="bgLoaded ? { backgroundImage: `url(${bgUrl})` } : {}"
    >
      </div>

    <!-- Theme Toggle (Top Right) -->
    <button 
      @click="toggleTheme" 
      class="fixed top-6 right-6 z-50 p-3 rounded-full bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all duration-300 shadow-lg ring-1 ring-white/10"
      title="Toggle Theme"
    >
      <Sun v-if="!isDark" class="w-5 h-5" />
      <Moon v-else class="w-5 h-5" />
    </button>

      <!-- 3. Central Content Wrapper (Ultra-Clear Optical Glass) -->
      <div 
        class="w-full max-w-2xl backdrop-blur-xl border rounded-[2rem] p-10 md:p-14 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col items-center animate-fade-in-up transition-all duration-700 relative overflow-hidden bg-white/10 dark:bg-slate-950/30 border-white/20 dark:border-white/10 hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
      >
        
        <div class="text-center space-y-6 mb-10 w-full relative z-10">
          <!-- Logo Container -->
          <div 
            class="inline-flex items-center justify-center w-16 h-16 rounded-3xl backdrop-blur-md border shadow-lg transition-all duration-500 bg-white/20 dark:bg-white/10 border-white/20 dark:border-white/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-white/30 dark:ring-white/5"
          >
            <Globe class="w-8 h-8" />
          </div>
          
          <!-- H1 Text -->
          <h1 class="text-5xl md:text-6xl font-bold text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            即刻协作
          </h1>
          <p class="text-lg text-slate-100/90 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
             无需注册，输入房间名即可开始
          </p>
        </div>

        <div class="w-full max-w-md flex items-stretch gap-3 relative z-10" :class="{ 'animate-shake': shakeInput }">
            
          <div class="relative flex-1 group">
            <!-- Private Mode: Persistent Ghost Icon (Left Side) -->
            <Ghost 
              v-if="isIncognito" 
              class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 animate-pulse"
            />
            <input 
              v-model="roomName"
              @keydown.enter="joinRoom()"
              type="text" 
              :placeholder="isIncognito ? '正在进入私密空间...' : '请输入笔记本名称'"
              class="w-full h-14 pr-12 backdrop-blur-md border rounded-2xl focus:outline-none focus:ring-2 transition-all duration-300 shadow-inner bg-white/20 dark:bg-black/20 text-slate-800 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:bg-white/40 dark:focus:bg-black/40"
              :class="[
                isIncognito 
                  ? 'pl-12 border-purple-500/50 focus:ring-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                  : 'pl-6 border-white/20 dark:border-white/5 focus:ring-cyan-500/50 dark:focus:ring-cyan-400/50'
              ]"
              autofocus
            />
            
            <!-- Incognito Toggle Inside Input (Right Side) -->
            <button 
              @click="isIncognito = !isIncognito"
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors"
              :class="isIncognito ? 'text-purple-400 bg-purple-500/20 ring-1 ring-purple-500/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'"
              :title="isIncognito ? '无痕模式已开启 (不记录历史)' : '开启无痕模式'"
            >
              <component :is="isIncognito ? Ghost : Eye" class="w-5 h-5" />
            </button>
          </div>
          
          <button 
            @click="joinRoom()"
            class="h-14 px-8 backdrop-blur-xl border border-white/20 text-white font-semibold rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 whitespace-nowrap bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600/80 dark:hover:bg-cyan-500/80"
          >
            <span v-if="!isLoading">进入</span>
            <ArrowRight v-if="!isLoading" class="w-5 h-5" />
            <Loader2 v-else class="w-5 h-5 animate-spin" />
          </button>
        </div>

        <!-- History List (Fade In) -->
        <div v-if="recentRooms.length > 0" class="w-full max-w-md mt-6 animate-fade-in-up" style="animation-delay: 0.1s">
          <div class="flex items-center gap-2 text-xs font-semibold mb-2 px-2 transition-colors text-slate-500 dark:text-slate-400">
            <Clock class="w-3 h-3" />
            <span>最近访问</span>
          </div>
          <div class="flex flex-col gap-2">
            <div 
              v-for="room in recentRooms" 
              :key="room.name"
              class="group flex items-center justify-between p-3 rounded-xl border border-transparent transition-all cursor-pointer bg-white/5 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 hover:border-white/10"
              @click="joinRoom(room.name)"
            >
              <span class="font-medium truncate max-w-[180px] text-slate-700 dark:text-slate-200">{{ room.name }}</span>
              <div class="flex items-center gap-3">
                <span class="text-xs transition-colors text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300">{{ timeAgo(room.timestamp) }}</span>
                <button 
                  @click.stop="removeHistoryObj(room.name)"
                  class="opacity-0 group-hover:opacity-100 p-1 transition-all text-slate-400 hover:text-rose-500"
                  title="Remove"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-8 transition-opacity duration-300 opacity-70 hover:opacity-100">
          <button @click="createRandomRoom" class="text-sm text-slate-200 hover:text-white underline decoration-dashed underline-offset-4 drop-shadow-sm">
            没有灵感？随机创建一个
          </button>
        </div>

      </div>

      <!-- Hidden Easter Egg Trigger (Bottom Left Corner) -->
      <div 
        class="fixed bottom-0 left-0 w-20 h-20 z-50 group cursor-pointer"
        @click="isIncognito = !isIncognito"
        title="发现了秘密入口..."
      >
        <!-- Ghost Icon: Invisible by default, fades in after 2s hover -->
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity delay-[2000ms] duration-700">
          <div class="p-3 rounded-full bg-purple-500/20 backdrop-blur-md border border-purple-500/30 shadow-lg shadow-purple-500/20">
            <Ghost class="w-6 h-6 text-purple-400" />
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.animate-shake {
  animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
}
.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
