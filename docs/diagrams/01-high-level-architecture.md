# High-Level Architecture

Collab-Note implements a dual-path synchronization architecture: a local P2P WebRTC fallback for development and a planned Supabase persistence layer for production.

```mermaid
graph TD
    subgraph Client [Browser Client (Vue 3)]
        UI[Vue UI & Tailwind]
        Editor[Tiptap Editor Core]
        CRDT[Yjs Document State]
    end

    subgraph Signaling [Local Fallback (y-webrtc)]
        WSS[WebSocket Signaling Server :4444]
        WebRTC[WebRTC P2P Mesh]
    end

    subgraph Cloud [Planned Production (Supabase)]
        Realtime[Supabase Realtime]
        PG[(PostgreSQL Database)]
    end

    UI -->|Displays| Editor
    Editor -->|Binds events| CRDT
    CRDT -.->|Sync path A: Local Dev| Signaling
    CRDT -.->|Sync path B: Prod| Cloud
    
    WSS -->|Initiates handshake| WebRTC
    WebRTC -->|Binary delta exchange| CRDT
    
    Realtime -->|Database integration| PG
    Realtime -->|Managed WS broadcast| CRDT

    style Signaling fill:#f9f2f4,stroke:#333,stroke-dasharray: 5 5
    style Cloud fill:#e1f5fe,stroke:#0288d1,stroke-dasharray: 5 5
```
