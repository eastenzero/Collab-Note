# API Relationship Map

This map documents the boundaries between the Vue client layer and the data routing infrastructures. The application utilizes a dynamic branch model: establishing local WebRTC tunnels via the Node signaling proxy when production endpoints are omitted.

```mermaid
graph LR
    O[Vue 3 SPA]
    S[Tiptap Provider Plugin]
    P[Yjs Protocol Core] 
    
    O -->|Initializes| S
    S <-->|Listens| P
    
    subgraph "Signaling Proxy (Local Runtime)"
       NP[Node Signaling :4444]
       WS((WebSocket))
    end
    
    subgraph "Cloud Persistence (Planned Prod)"
       REST[Supabase PostgREST]
       RLS[Row Level Security]
       DB[(PostgreSQL)]
    end
    
    P --> |"fallback branch (ENV missing)"| WS
    WS <--> NP
    NP --> |"peers connection metadata"| WS
    
    P -.-> |"primary branch (Planned)"| REST
    REST -.-> |"authenticate read/write"| RLS
    RLS -.-> DB
    
    style NP fill:#e8f4f8,stroke:#1e88e5
    style DB fill:#eef2e6,stroke:#4caf50,stroke-dasharray: 5 5
```
