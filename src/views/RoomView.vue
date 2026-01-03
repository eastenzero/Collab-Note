<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import * as Y from 'yjs';

import Header from '../components/Header.vue';
import Editor from '../components/Editor.vue';



// --- Router ---
const route = useRoute();
const roomId = route.params.roomId as string;

function withQueuedChannelSend(
  base: any,
  onStatus?: (info: { channel: string; status: any; err: any }) => void,
) {
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === 'channel') {
        return (name: string, opts?: any) => {
          const ch = target.channel(name, opts);
          const originalSend = ch.send.bind(ch);
          const originalSubscribe = ch.subscribe.bind(ch);
          let subscribed = false;
          let failed = false;
          const queue: Array<{ payload: any; resolve: (v: any) => void; reject: (e: any) => void }> = [];

          ch.send = (payload: any) => {
            if (subscribed) return originalSend(payload);
            if (failed) return Promise.reject(new Error('Realtime channel is not subscribed'));
            return new Promise((resolve, reject) => {
              queue.push({ payload, resolve, reject });
            });
          };

          ch.subscribe = (callback?: any) => {
            return originalSubscribe((status: any, err: any) => {
              if (onStatus) onStatus({ channel: name, status, err });
              if (status === 'SUBSCRIBED') {
                subscribed = true;
                const pending = queue.splice(0, queue.length);
                pending.forEach(({ payload, resolve, reject }) => {
                  originalSend(payload).then(resolve).catch(reject);
                });
              }

              if (!subscribed && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) {
                failed = true;
                const pending = queue.splice(0, queue.length);
                pending.forEach(({ reject }) => reject(err || new Error(status)));
              }

              if (callback) callback(status, err);
            });
          };

          return ch;
        };
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') return value.bind(target);
      return value;
    },
  });
}

// --- State ---
const ydoc = new Y.Doc();
const provider = shallowRef<any>(null);
const status = ref<'connected' | 'disconnected' | 'connecting'>('connecting');
const providerReady = ref(false);
const initialAwarenessSent = ref(false);
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
  if (providerReady.value) {
    provider.value?.awareness.setLocalStateField('user', newUser);
  }
}, { deep: true });

// Room Meta (Shared State)
const roomMeta = ydoc.getMap('meta');
const isLocked = ref(false);
const roomHasPassword = ref(false);
const isAuthorized = ref(false); // Default to false, will be set to true if no password or after unlock
const unlockInput = ref('');
const passwordError = ref(false);
const isCheckingPassword = ref(true); // True until initial sync completes
const didInitialCheck = ref(false);
const connectionFailure = ref<string | null>(null);

const retryConnection = () => {
  window.location.reload();
};

const completeInitialCheck = () => {
  if (didInitialCheck.value) return;
  const hash = roomMeta.get('passwordHash') as string;
  roomHasPassword.value = !!hash;
  if (!hash) {
    isAuthorized.value = true;
  }
  isCheckingPassword.value = false;
  didInitialCheck.value = true;
};

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

const handleClearColors = () => {
  editorRef.value?.clearUserColors?.();
};

// --- Lifecycle ---
// --- Supabase Provider ---
import SupabaseProvider from 'y-supabase';
import { supabase } from '../utils/supabase';

// ... (Header imports remain same)

// --- Constants ---
// const SIGNALING_PORT = 4444; // Removed

// ... (Router, State init remain same)

onMounted(async () => {
  // Listen to room lock changes (key: 'locked')
  roomMeta.observe(() => {
    isLocked.value = !!roomMeta.get('locked');
    
    // Check for password
    const hash = roomMeta.get('passwordHash') as string;
    roomHasPassword.value = !!hash;
    
    // Gatekeeper Rule: If hash exists and we are not authorized, LOCK IT.
    if (hash && !isAuthorized.value) {
      // Logic handled by v-if in template, state is right
    } else if (!hash) {
      // If password removed, everyone authorized
      isAuthorized.value = true;
    }
  });
  
  // --- Supabase Provider ---
  console.log('Starting Supabase Provider...');
  const { data: existingRoom, error: existingRoomError } = await supabase
    .from('rooms')
    .select('name')
    .eq('name', roomId)
    .maybeSingle();

  if (existingRoomError) {
    console.error('Failed to check room row:', existingRoomError);
  }

  if (!existingRoom) {
    let { error: ensureRoomError } = await supabase
      .from('rooms')
      .insert({ name: roomId, document: [] as any });

    if (ensureRoomError) {
      ({ error: ensureRoomError } = await supabase
        .from('rooms')
        .insert({ name: roomId, document: '\\x' } as any));
    }

    if (ensureRoomError && (ensureRoomError as any).code !== '23505') {
      console.error('Failed to ensure room row exists:', ensureRoomError);
    }
  }

  const supabaseForProvider = withQueuedChannelSend(supabase, ({ channel, status, err }) => {
    console.log('Realtime Channel Status:', channel, status);
    if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !providerReady.value) {
      connectionFailure.value = String(status);
      console.error('Realtime Channel Error:', err);
    }
  });
  
  // Initialize Supabase Provider
  const p = new SupabaseProvider(ydoc, supabaseForProvider, {
    channel: roomId,
    tableName: 'rooms',
    columnName: 'document',
    idName: 'name',   // TELL provider to use 'name' column as ID
    id: roomId,        // Provide the string room ID
    resyncInterval: false
  });
  
  provider.value = p;

  setTimeout(() => {
    if (!providerReady.value && !connectionFailure.value) {
      connectionFailure.value = 'TIMEOUT';
    }
  }, 15000);

  // Listen for status changes
  p.on('status', (event: any) => {
    // Adapter for local status variable
    const nextStatus = Array.isArray(event) ? event[0]?.status : event?.status;
    if (nextStatus === 'connected' || nextStatus === 'connecting' || nextStatus === 'disconnected') {
      status.value = nextStatus;
      providerReady.value = nextStatus === 'connected';
      if (!providerReady.value) {
        initialAwarenessSent.value = false;
      }
    }
    console.log('Supabase Provider Status:', nextStatus);
  });

  p.on('error', (err: any) => {
    console.error('Supabase Provider Error:', err);
  });

  watch(providerReady, (ready) => {
    if (!ready) return;
    connectionFailure.value = null;
    completeInitialCheck();
    if (initialAwarenessSent.value) return;
    provider.value?.awareness.setLocalStateField('user', {
      name: currentUser.value.name,
      color: currentUser.value.color,
    });
    initialAwarenessSent.value = true;
  });
  
  // Wait for sync to check password state
  p.on('synced', () => {
     console.log('Content loaded from Supabase');
    completeInitialCheck();
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
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ connectionFailure ? '连接失败' : '正在加载...' }}</h2>
          <p class="text-slate-500 dark:text-slate-400 mt-2 text-sm">{{ connectionFailure ? 'Realtime 订阅未成功，请检查 Supabase Realtime 设置或刷新重试。' : '正在同步房间数据，请稍候。' }}</p>
        </div>
        <button
          v-if="connectionFailure"
          @click="retryConnection"
          class="w-full h-12 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
        >
          刷新重试
        </button>
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
        @clear-colors="handleClearColors"
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
          :editable="!isLocked && providerReady"
        />
      </main>
    </div>
  </div>
</template>
