# Simplified Data Model

The data layer utilizes Yjs CRDT structures based on document-centric models. In the planned production environment, this Yjs state will persist within configured PostgreSQL tables. 

```mermaid
erDiagram
    ROOM ||--o{ USER_AWARENESS : tracks
    ROOM ||--|{ DOCUMENT_CONTENT : contains
    ROOM {
        UUID id PK
        String name "Room slug / id"
        JSONB meta "Locked, PasswordHash configs"
        Timestamp created_at "Cloud only"
    }

    DOCUMENT_CONTENT {
        bytea document "Yjs binary updates"
    }

    USER_AWARENESS {
        UUID client_id
        String name "User Display Name"
        String color "Cursor Hex Color"
        JSON cursor "Current block location"
    }
```

*Note: In the local `y-webrtc` fallback, `ROOM` and `DOCUMENT_CONTENT` exist entirely in browser memory/IndexedDB arrays mapped by room slug rather than SQL schema.*
