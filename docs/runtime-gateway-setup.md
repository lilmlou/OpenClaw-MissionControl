# Runtime Gateway Setup (OpenClaw + Hermes)

## 1) Backend env
Copy `backend/.env.example` to `backend/.env` and set:

- `OPENCLAW_GATEWAY_URL`: OpenClaw gateway websocket URL.
- `HERMES_GATEWAY_URL`: Hermes gateway websocket URL.
- `OPENCLAW_API_KEY` / `HERMES_API_KEY` (optional): runtime API keys.
- `*_AUTH_HEADER` (default `Authorization`) and `*_AUTH_SCHEME` (default `Bearer`) to control auth header generation.

Header behavior:

- If API key is empty: no auth header is sent.
- If API key exists: backend sends `<AUTH_HEADER>: <AUTH_SCHEME> <API_KEY>`.
- Set `*_AUTH_SCHEME=none` to send the raw key value with no prefix.

## 2) Frontend env
Copy `frontend/.env.example` to `frontend/.env` and set:

- `REACT_APP_BACKEND_URL=http://127.0.0.1:8001` (or your backend host).

The frontend always connects websocket chat via `${REACT_APP_BACKEND_URL}/api/ws/chat`.

## 3) Runtime selection behavior

- Runtime switch (`OpenClaw` / `Hermes`) sets the default runtime for **new threads**.
- Existing thread runtime stays pinned to that thread.
- When sending a message, frontend now sends:
  - `type: "connect"` with `{ threadId, runtime }`
  - then `type: "chat.message"` with `{ threadId, runtime, id, content, model, timestamp }`
- Backend reconnects to the correct runtime gateway if runtime changes.

## 4) Websocket event contract

Frontend expects backend events:

- `chat.chunk` -> `{ runId, threadId, chunk, runtime }`
- `chat.complete` -> `{ runId, threadId, content, runtime }`
- `chat.error` -> `{ runId?, threadId?, error, runtime }`
- `tool.permission_request` -> `{ requestId, threadId, tool, parameters, reason, runtime }`

Backend normalizes common gateway formats including:

- `assistant.response.chunk` / `assistant_response_chunk` / `chat.chunk`
- `assistant.response.complete` / `assistant_response_complete` / `chat.complete`
- `assistant.error` / `assistant_error` / `chat.error`
