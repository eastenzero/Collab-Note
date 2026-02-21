# Collaboration Edit Sync Path

This diagram maps a keystroke's event path from the Vue DOM through the Tiptap core, its conversion into a Yjs CRDT operation, and the subsequent binary serialization for over-the-wire broadcast.

```mermaid
sequenceDiagram
    actor User A
    participant DOM as Vue DOM (Tiptap)
    participant Yjs as Local Y.Doc
    participant Net as y-provider (WebRTC Fallback)
    participant Peer as Network Node B

    User A->>DOM: Type character "H"
    activate DOM
    DOM->>Yjs: Convert to CRDT operation (InsertAt: 10, 'H')
    deactivate DOM
    
    activate Yjs
    Yjs-->>Yjs: Apply locally (Optimistic update)
    Yjs->>Net: Serialize binary update (Uint8Array)
    deactivate Yjs
    
    activate Net
    Net->>Peer: Broadcast over WebSocket/WebRTC DataChannel
    deactivate Net
    
    activate Peer
    Peer-->>Peer: Decode binary to Yjs op
    Peer-->>Peer: Resolve merge conflict (if any)
    Peer->>DOM: Dispatch Vue Reactivity (Update Tiptap Text)
    deactivate Peer
```
