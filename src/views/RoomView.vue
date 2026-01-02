<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import * as Y from 'yjs';
// @ts-ignore - y-supabase missing types
// import SupabaseProvider from 'y-supabase';
// @ts-ignore
import { WebrtcProvider } from 'y-webrtc';
// @ts-ignore
import { IndexeddbPersistence } from 'y-indexeddb';
import Header from '../components/Header.vue';
import Editor from '../components/Editor.vue';

// --- Constants ---
const SIGNALING_PORT = 4444;

// --- Router ---
const route = useRoute();
const roomId = route.params.roomId as string;

// --- State ---
// --- State ---
const ydoc = new Y.Doc();
const provider = shallowRef<any>(null);
const persistence = ref<any>(null);
const status = ref<'connected' | 'disconnected' | 'connecting'>('connecting');
const users = ref<Array<{ id: number; name: string; color: string }>>([]);

// Load user from localStorage or generate new
const USER_STORAGE_KEY = 'collaboration-user';
const storedUser = localStorage.getItem(USER_STORAGE_KEY);
const initialUser = storedUser ? JSON.parse(storedUser) : {
  name: `User ${Math.floor(Math.random() * 1000)}`,
  color: '#' + Math.floor(Math.random()*16777215).toString(16)
};

const currentUser = ref(initialUser);

// Update user function (called by Header)
const updateUser = (newUser: { name: string; color: string }) => {
  currentUser.value = newUser;
  // Watcher will handle persistence 'user_info' -> USER_STORAGE_KEY and awareness
};

// Save user to localStorage whenever it changes
watch(currentUser, (newUser) => {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
  provider.value?.awareness.setLocalStateField('user', newUser);
}, { deep: true });

// Room Meta (Shared State)
const roomMeta = ydoc.getMap('meta');
const isLocked = ref(false);
const roomHasPassword = ref(false);
const isAuthorized = ref(false); // Default to false, will be set to true if no password or after unlock
const unlockInput = ref('');
const passwordError = ref(false);
const isCheckingPassword = ref(true); // True until initial sync completes

const toggleLock = () => {
  const currentLockState = roomMeta.get('locked') as boolean;
  roomMeta.set('locked', !currentLockState);
};

// --- Crypto Helper ---
async function hashPassword(message: string) {
  // 1. 优先尝试 Web Crypto API (生产环境/HTTPS/Localhost)
  if (window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn("Secure crypto failed, falling back...");
    }
  }

  // 2. 降级方案 (局域网 HTTP 开发环境)
  // 注意：此方案仅用于非安全上下文的简单验证，不具备强加密性
  console.log("Using simple hash fallback due to insecure context");
  let hash = 0;
  if (message.length === 0) return '0';
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  // 添加前缀以区分 Hash 类型
  return 'dev-' + Math.abs(hash).toString(16);
}

const handleSetPassword = async (password: string) => {
  const hash = await hashPassword(password);
  roomMeta.set('passwordHash', hash);
  isAuthorized.value = true; // Auto auth the creator
  alert('密码已设置。下次进入此房间需输入密码。');
};

const handleRemovePassword = () => {
  if (confirm('确定要移除密码吗？房间将变为公开。')) {
    roomMeta.set('passwordHash', null); // Setting to null removes keys in Y.Map usually
    // or roomMeta.delete('passwordHash');
    roomMeta.delete('passwordHash');
  }
};

const attemptUnlock = async () => {
  if (!unlockInput.value) return;
  const hash = await hashPassword(unlockInput.value);
  const correctHash = roomMeta.get('passwordHash') as string;
  
  if (hash === correctHash) {
    isAuthorized.value = true;
    passwordError.value = false;
  } else {
    passwordError.value = true;
    unlockInput.value = '';
    setTimeout(() => passwordError.value = false, 500);
  }
};

// --- History Visibility (Auto-Hide for Locked Rooms) ---
const updateHistoryVisibility = (isLocked: boolean) => {
  try {
    const key = 'recent-rooms';
    const raw = localStorage.getItem(key);
    if (!raw) {
      // 如果没有历史记录，无需处理
      if (!isLocked) {
        // 但是如果房间没锁，需要添加到历史
        localStorage.setItem(key, JSON.stringify([{ name: roomId, timestamp: Date.now() }]));
        console.log(`[Privacy] No history existed. Created with current room.`);
      }
      return;
    }
    
    let history = JSON.parse(raw);
    const originalLength = history.length;
    
    if (isLocked) {
      // 隐身逻辑：发现有锁，立即剔除
      history = history.filter((r: any) => r.name !== roomId);
      console.log(`[Privacy] Room is locked. Removing from history. (Count: ${originalLength} -> ${history.length})`);
    } else {
      // 正常逻辑：确保存在（如果被错误移除了，加回来）
      const existingIndex = history.findIndex((r: any) => r.name === roomId);
      if (existingIndex > -1) {
        history.splice(existingIndex, 1); // 移除旧的
      }
      history.unshift({ name: roomId, timestamp: Date.now() }); // 加到开头
      history = history.slice(0, 10); // 限制长度
      console.log(`[Privacy] Room is unlocked. Ensuring in history.`);
    }
    
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.error('[Privacy] Failed to update history:', e);
  }
};

// 监听密码状态变化，一旦检测到有密码，立即执行隐身操作
watch(roomHasPassword, (hasPwd) => {
  console.log(`[Privacy] roomHasPassword changed to: ${hasPwd}`);
  updateHistoryVisibility(hasPwd);
}, { immediate: true });

// Export Logic
const editorRef = ref<any>(null);
const handleExport = () => {
  if (editorRef.value) {
    const date = new Date().toISOString().split('T')[0];
    editorRef.value.downloadMarkdown(`${roomId}_${date}`);
  }
};

// --- Lifecycle ---
onMounted(() => {
  // Listen to room lock changes (key: 'locked')
  roomMeta.observe(() => {
    isLocked.value = !!roomMeta.get('locked');
    
    // Check for password
    const hash = roomMeta.get('passwordHash') as string;
    roomHasPassword.value = !!hash;
    
    // Gatekeeper Rule: If hash exists and we are not authorized, LOCK IT.
    // Small optimization: If we just Set the password, isAuthorized is true, so no lock.
    // Note: History visibility is handled by Vue watch on roomHasPassword
    
    if (hash && !isAuthorized.value) {
      // Logic handled by v-if in template, state is right
    } else if (!hash) {
      // If password removed, everyone authorized
      isAuthorized.value = true;
    }
  });
  
  // Initial Check (important if joining an existing room)
  // Wait a tick for Yjs sync? Actually observer fires on sync.
  // But we can check straight after connect or rely on observer.

  // --- LOCAL TEST MODE: WebRTC + IndexedDB ---
  console.log('Starting Local Room Mode (WebRTC + IndexedDB)...');
  
  // 1. WebRTC Provider (P2P Sync)
  // Auto-detect signaling server on the same host (LAN IP)
  const signalingUrl = `ws://${window.location.hostname}:${SIGNALING_PORT}`;
  console.log('Connecting to Signaling Server:', signalingUrl);

  // @ts-ignore
  const p = new WebrtcProvider(roomId, ydoc, {
    signaling: [signalingUrl],
  });
  provider.value = p;

  // 2. IndexedDB Persistence (Offline Storage)
  // @ts-ignore
  const persist = new IndexeddbPersistence(roomId, ydoc);
  persistence.value = persist;

  persist.on('synced', () => {
    console.log('Content loaded from local database');
    
    // Check initial password state
    const hash = roomMeta.get('passwordHash') as string;
    roomHasPassword.value = !!hash;
    if (!hash) {
      // No password set, authorize immediately
      isAuthorized.value = true;
    }
    
    // Note: History visibility is handled by Vue watch on roomHasPassword
    // If hash exists, user must unlock via attemptUnlock()
    isCheckingPassword.value = false;
  });

  // Status Listeners (WebRTC)
  p.on('status', (event: any) => {
    status.value = event.connected ? 'connected' : 'disconnected';
    console.log('WebRTC Status:', event.connected ? 'Connected' : 'Disconnected');
  });

  // Awareness (Presence)
  p.awareness.setLocalStateField('user', {
    name: currentUser.value.name,
    color: currentUser.value.color,
  });

  p.awareness.on('change', () => {
    const states = p.awareness.getStates();
    const activeUsers: any[] = [];
    states.forEach((state: any, clientId: number) => {
      if (state.user) {
        activeUsers.push({
          id: clientId,
          ...state.user,
        });
      }
    });
    users.value = activeUsers;
  });
});

onBeforeUnmount(() => {
  provider.value?.destroy();
  persistence.value?.destroy();
  ydoc.destroy();
});
</script>

<template>
  <div class="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
    
    <!-- Loading Screen (while checking password) -->
    <div v-if="isCheckingPassword" class="fixed inset-0 z-[100] bg-slate-200/50 dark:bg-slate-900/50 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      <div class="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-white/10 text-center space-y-6">
        <div class="mx-auto w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center animate-pulse">
           <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 dark:text-slate-300 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">正在加载...</h2>
          <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm">正在同步房间数据，请稍候。</p>
        </div>
      </div>
    </div>
    
    <!-- Lock Screen Overlay (for password protected rooms) -->
    <div v-else-if="roomHasPassword && !isAuthorized" class="fixed inset-0 z-[100] bg-slate-200/50 dark:bg-slate-900/50 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      <div class="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-white/10 text-center space-y-6">
        <div class="mx-auto w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-300">
           <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">受保护的笔记本</h2>
          <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm">此房间已设置访问密码，请输入密码解锁。</p>
        </div>
        
        <div class="space-y-4">
           <input 
             v-model="unlockInput"
             type="password"
             placeholder="输入密码"
             class="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-center tracking-widest"
             :class="{'animate-pulse border-rose-500': passwordError}"
             @keyup.enter="attemptUnlock"
             autofocus
           />
           <button 
             @click="attemptUnlock"
             class="w-full h-12 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
           >
             解锁
           </button>
        </div>
      </div>
    </div>

    <!-- Main Content (Hidden until authorized) -->
    <div v-if="isAuthorized" class="flex flex-col flex-1 min-h-screen">
      <Header 
        :status="status" 
        :users="users"
        :current-user="currentUser"
        :is-locked="isLocked"
        :has-password="roomHasPassword"
        @update:user="updateUser"
        @toggle-lock="toggleLock"
        @export-markdown="handleExport"
        @set-password="handleSetPassword"
        @remove-password="handleRemovePassword"
      />
      
      <!-- Main Content Area: Allows page scroll -->
      <main class="flex-1 relative flex flex-col pt-6 bg-slate-50/50 dark:bg-slate-950">
        <div v-if="!provider" class="flex justify-center items-center h-64 text-slate-400">
          正在建立连接...
        </div>
        <Editor 
          v-else
          ref="editorRef"
          :ydoc="ydoc" 
          :provider="provider" 
          :user="currentUser"
          :editable="!isLocked"
        />
      </main>
    </div>
  </div>
</template>
