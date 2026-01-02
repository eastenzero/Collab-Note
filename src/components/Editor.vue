<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
// @ts-ignore
// import { Markdown } from 'tiptap-markdown';
import * as Y from 'yjs';
// @ts-ignore
import TurndownService from 'turndown';
import { marked } from 'marked';
import { Bold, Italic, Heading1, Heading2, Quote, Code, FileText } from 'lucide-vue-next';

interface Props {
  ydoc: Y.Doc;
  provider: any; 
  user: { name: string; color: string };
  editable: boolean; 
}

const props = defineProps<Props>();

// --- Source Mode State ---
const isSourceMode = ref(false);
const sourceContent = ref('');

const editor = useEditor({
  editable: props.editable,
  extensions: [
    StarterKit.configure({
      history: false, // Y.js handles history
    }),
    BubbleMenuExtension.configure({
      pluginKey: 'bubbleMenu',
    }),
    Collaboration.configure({
      document: props.ydoc,
    }),
    CollaborationCursor.configure({
      provider: props.provider,
      user: props.user,
    }),
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-slate max-w-none dark:prose-invert focus:outline-none min-h-[800px]',
    },
  },
});

// Watch editable state
watch(() => props.editable, (val) => {
  editor.value?.setEditable(val);
});

// Watch user to update cursor presence
watch(() => props.user, (newUser) => {
  // @ts-ignore
  editor.value?.commands.updateUser(newUser);
}, { deep: true });

// Toggle Source Mode
const toggleSourceMode = async () => {
  if (!editor.value) return;

  if (isSourceMode.value) {
    // Switch back to Rich Text (Markdown -> HTML)
    try {
      const html = await marked.parse(sourceContent.value);
      editor.value.commands.setContent(html, true);
    } catch (e) {
      console.error('Markdown parse error:', e);
    }
    isSourceMode.value = false;
  } else {
    // Switch to Source Mode (HTML -> Markdown)
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    const html = editor.value.getHTML();
    sourceContent.value = turndownService.turndown(html);
    isSourceMode.value = true;
  }
};

// Export Markdown Function
const downloadMarkdown = (filename: string) => {
  if (!editor.value) return;

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });
  
  const html = editor.value.getHTML();
  const markdown = turndownService.turndown(html);
  
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

defineExpose({ downloadMarkdown });

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div class="flex-1 flex justify-center pb-32">
    <!-- A4 Paper Container -->
    <div class="w-full max-w-[850px] bg-white dark:bg-slate-900 min-h-[1100px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-none dark:ring-1 dark:ring-white/10 border border-slate-200/60 dark:border-transparent rounded-sm p-12 sm:p-16 transition-shadow duration-300 hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.12)] relative group h-auto">
      
      <!-- Source Mode Toggle (Floating Top Right) -->
      <div v-if="props.editable" class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <button 
          @click="toggleSourceMode"
          class="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white transition-colors flex items-center gap-2 text-xs font-medium"
          :title="isSourceMode ? 'Switch to Rich Text' : 'Switch to Markdown Source'"
        >
          <component :is="isSourceMode ? FileText : Code" class="w-4 h-4" />
          {{ isSourceMode ? '返回预览' : '源码模式' }}
        </button>
      </div>

      <BubbleMenu
        v-if="editor && !isSourceMode"
        :editor="editor"
        :tippy-options="{ duration: 100, animation: 'fade' }"
        class="flex items-center gap-1 p-1 bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur text-white rounded-lg shadow-xl overflow-hidden"
      >
        <button 
          @click="editor.chain().focus().toggleBold().run()" 
          :class="{ 'bg-white/20': editor.isActive('bold') }"
          class="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          <Bold class="w-4 h-4" />
        </button>
        <button 
          @click="editor.chain().focus().toggleItalic().run()" 
          :class="{ 'bg-white/20': editor.isActive('italic') }"
          class="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          <Italic class="w-4 h-4" />
        </button>
        <div class="w-px h-4 bg-white/20 mx-1"></div>
        <button 
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" 
          :class="{ 'bg-white/20': editor.isActive('heading', { level: 1 }) }"
          class="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          <Heading1 class="w-4 h-4" />
        </button>
        <button 
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" 
          :class="{ 'bg-white/20': editor.isActive('heading', { level: 2 }) }"
          class="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          <Heading2 class="w-4 h-4" />
        </button>
        <button 
          @click="editor.chain().focus().toggleBlockquote().run()" 
          :class="{ 'bg-white/20': editor.isActive('blockquote') }"
          class="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          <Quote class="w-4 h-4" />
        </button>
      </BubbleMenu>

      <EditorContent v-show="!isSourceMode" :editor="editor" />
      
      <!-- Source Mode Textarea -->
      <textarea
        v-if="isSourceMode"
        v-model="sourceContent"
        class="w-full h-[calc(100vh-300px)] resize-none font-mono text-sm leading-6 text-slate-700 dark:text-slate-200 bg-transparent border-0 focus:ring-0 p-0 outline-none"
        placeholder="# Markdown Source code..."
      ></textarea>

    </div>
  </div>
</template>

<style>
/* Custom cursor styles for collaboration */
.collaboration-cursor__caret {
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}

.collaboration-cursor__label {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 0.1rem 0.3rem;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
  z-index: 10;
}
</style>
