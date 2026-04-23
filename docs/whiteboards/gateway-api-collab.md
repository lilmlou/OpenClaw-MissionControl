# Gateway/API Collaboration Whiteboard

Status: active
Project: OpenClaw Mission Control
Focus: gateway transport, API wiring, model selector session contract

## Purpose
Shared scratchpad for parallel investigation between Hermes, OpenClaw TUI, and any secondary coding agents.

## Current confirmed facts
- Frontend static build is serving on `http://127.0.0.1:4173`.
- Browser is attempting WebSocket connection to `/api/ws/chat` on the same host.
- Because only the static server is running, `/api/ws/chat` returns `404`.
- `frontend/src/lib/useGateway.js` currently opens the gateway with `threadId: "default-thread"`.
- `frontend/src/lib/useGateway.js` sends chat payloads with:
  - `threadId`
  - `content`
  - `model`
- `backend/gateway_ws.py` is corrupted / not valid source.
- `backend/runtime_adapters/openclaw.py` is still a placeholder echo adapter.
- Model listing/inventory has been resolved separately.

## Root cause summary
The UI shell is ahead of the transport layer. The app still assumes a working backend WebSocket bridge exists, but the bridge file is corrupted, so the frontend falls back into a broken path where the static server receives websocket requests.

## Auth note
Both OpenClaw and Hermes API keys were changed after earlier attempts. Treat previously observed keys/config as stale. OpenClaw and Hermes use separate API keys and they must remain separate — do not merge them, reuse them interchangeably, or assume one key satisfies both systems. Verify current gateway auth requirements and current env wiring from live services before validating `/api/ws/chat`.

## Priority order
1. Restore a valid backend transport layer for `/api/ws/chat`.
2. Replace `default-thread` handshake with active thread/runtime/model session data.
3. Unify selector/session contract across app surfaces and channel-based sessions.
4. Only after transport works, continue with Expo/mobile wrapping.

## Proposed shared session contract
```json
{
  "channel": "chat",
  "threadId": "thread-uuid",
  "sessionId": "optional-session-id",
  "runtime": "openclaw|hermes",
  "modelId": "provider/model",
  "transport": "ws"
}
```

## Frontend hotspots
- `frontend/src/lib/useGateway.js`
  - `switchModel`
  - `sendMessage`
  - `connectGateway`
- Any selector UI that currently only updates global `activeModel`

## Backend hotspots
- `backend/gateway_ws.py`
- `backend/server.py`
- `backend/runtime_adapters/openclaw.py`
- potentially any gateway/auth config once transport is restored

## Open questions
- Should `/api/ws/chat` proxy directly into OpenClaw Gateway, or first normalize payloads into an app-specific session object?
- Should model/session state live primarily in backend memory, database, or both?
- Is the same transport contract intended for Chat, Code, Cowork, Agents, and external channels?

## Working implementation target
When a user picks a model and sends a message from the app:
1. active thread/session is known
2. runtime is known
3. selected model is known
4. websocket connects or reuses a session using those values
5. backend routes to the correct runtime/model transport
6. streamed response returns to the same thread/session

## Notes from secondary agent (Codex gpt-5.4)
- Rebuild `backend/gateway_ws.py` as the single valid OpenClaw transport module.
- Make the WebSocket handshake thread-aware.
- Change `switchModel` so it updates the active channel session, not just global `activeModel`.
- Move provider/model inventory behind one source of truth.
- Add diagnostics for router import, websocket connect, and selector payload flow.

## Update log
- Created whiteboard to centralize gateway/API/model-selector findings.
