# Tech Stack Layered Diagram

This class diagram delegates structural responsibilities across the application's technology selections, distinctly mapping the UI frameworks, the CRDT engine, and the transport pipelines.

```mermaid
classDiagram
    direction TB
    
    class Interface {
        <<Framework>>
        Vue 3 (Composition API)
        Lucide-Vue (Icons)
    }
    class DesignSystem {
        <<Styling>>
        TailwindCSS v3
        PostCSS Autoprefixer
    }
    class EditorEngine {
        <<Content Container>>
        Tiptap Core
        ProseMirror State
        Markdown Transformers
    }
    class ConflictEngine {
        <<Data Layer>>
        Yjs Document
    }
    class Transports {
        <<Data Piping>>
        y-webrtc (WebSockets Fallback)
        y-supabase (Planned WebSocket Edge)
    }
    class BuildLayer {
        <<Deployment>>
        Vite
        TypeScript
    }

    Interface --|> DesignSystem: Formats elements
    Interface *-- EditorEngine: Mounts headless
    EditorEngine --* ConflictEngine: Synchronizes model
    ConflictEngine --> Transports: Pumps deltas
    BuildLayer ..> Interface: Bundles
```
