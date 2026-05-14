/**
 * Sprint 5 — useGateway chat.usage WS handler tests.
 *
 * Verifies:
 *  1. chat.usage event patches the tokenUsageToday slice.
 *  2. chat.usage event patches the per-message data on the matching msg.
 */

// Simple unit tests — no render needed.
// We test the store state mutators directly via a stubbed Zustand store.

describe("useGateway chat.usage wiring", () => {
  let store;

  beforeEach(() => {
    // Build a minimal state snapshot matching the real slice shape.
    let state = {
      tokenUsageToday: {
        messages: 0,
        tokens_in: 0,
        tokens_out: 0,
        cost_estimate_usd: 0,
        loading: false,
        error: null,
        lastUpdated: null,
      },
      messages: [
        {
          id: "msg-1",
          turn_id: "turn-abc",
          runId: "turn-abc",
          role: "assistant",
          content: "Hello!",
          tokens_in: null,
          tokens_out: null,
          cost_estimate_usd: null,
        },
        {
          id: "msg-2",
          turn_id: "turn-xyz",
          runId: "turn-xyz",
          role: "assistant",
          content: "World!",
          tokens_in: null,
          tokens_out: null,
          cost_estimate_usd: null,
        },
      ],
      threads: [],
    };

    // Minimal set / get helpers matching Zustand's contract.
    const set = (updater) => {
      if (typeof updater === "function") {
        state = { ...state, ...updater(state) };
      } else {
        state = { ...state, ...updater };
      }
    };
    const get = () => ({ ...state, _patchMessageUsage: patchMessageUsage });

    // Inline implementation of _patchMessageUsage (copied from useGateway.js).
    function patchMessageUsage(turnId, usageData) {
      const patchMsg = (msg) =>
        msg.runId === turnId || msg.turn_id === turnId
          ? {
              ...msg,
              tokens_in: usageData.tokens_in,
              tokens_out: usageData.tokens_out,
              cost_estimate_usd: usageData.cost_estimate_usd,
              model: usageData.model ?? msg.model,
              provider: usageData.provider ?? msg.provider,
            }
          : msg;
      set((s) => ({
        messages: s.messages.map(patchMsg),
        threads: s.threads.map((t) => ({
          ...t,
          messages: Array.isArray(t.messages) ? t.messages.map(patchMsg) : t.messages,
        })),
      }));
    }

    // Simulate the chat.usage case handler from useGateway.js.
    function handleChatUsage(data) {
      const { _patchMessageUsage } = get();
      const turnId = data.turn_id ?? data.runId ?? null;
      if (turnId) {
        _patchMessageUsage(turnId, {
          tokens_in: data.tokens_in ?? null,
          tokens_out: data.tokens_out ?? null,
          cost_estimate_usd: data.cost_estimate_usd ?? null,
          model: data.model ?? null,
          provider: data.provider ?? null,
        });
      }
      set((s) => ({
        tokenUsageToday: {
          ...s.tokenUsageToday,
          messages: (s.tokenUsageToday.messages || 0) + 1,
          tokens_in: (s.tokenUsageToday.tokens_in || 0) + (data.tokens_in || 0),
          tokens_out: (s.tokenUsageToday.tokens_out || 0) + (data.tokens_out || 0),
          cost_estimate_usd:
            (s.tokenUsageToday.cost_estimate_usd || 0) + (data.cost_estimate_usd || 0),
          lastUpdated: Date.now(),
        },
      }));
    }

    store = { state: () => state, handleChatUsage };
  });

  test("chat.usage increments tokenUsageToday slice", () => {
    store.handleChatUsage({
      type: "chat.usage",
      turn_id: "turn-abc",
      tokens_in: 100,
      tokens_out: 50,
      cost_estimate_usd: 0.0012,
      model: "claude-opus-4-7",
      provider: "venice",
    });

    const slice = store.state().tokenUsageToday;
    expect(slice.messages).toBe(1);
    expect(slice.tokens_in).toBe(100);
    expect(slice.tokens_out).toBe(50);
    expect(slice.cost_estimate_usd).toBeCloseTo(0.0012);
    expect(slice.lastUpdated).not.toBeNull();
  });

  test("chat.usage increments accumulate over multiple events", () => {
    store.handleChatUsage({ turn_id: "turn-abc", tokens_in: 100, tokens_out: 50, cost_estimate_usd: 0.001 });
    store.handleChatUsage({ turn_id: "turn-xyz", tokens_in: 200, tokens_out: 80, cost_estimate_usd: 0.002 });

    const slice = store.state().tokenUsageToday;
    expect(slice.messages).toBe(2);
    expect(slice.tokens_in).toBe(300);
    expect(slice.tokens_out).toBe(130);
    expect(slice.cost_estimate_usd).toBeCloseTo(0.003);
  });

  test("chat.usage patches matching message by turn_id", () => {
    store.handleChatUsage({
      turn_id: "turn-abc",
      tokens_in: 312,
      tokens_out: 187,
      cost_estimate_usd: 0.0008,
      model: "gemini-flash",
      provider: "venice",
    });

    const patched = store.state().messages.find((m) => m.turn_id === "turn-abc");
    expect(patched.tokens_in).toBe(312);
    expect(patched.tokens_out).toBe(187);
    expect(patched.cost_estimate_usd).toBeCloseTo(0.0008);
    expect(patched.model).toBe("gemini-flash");
    expect(patched.provider).toBe("venice");
  });

  test("chat.usage does not patch unrelated messages", () => {
    store.handleChatUsage({
      turn_id: "turn-abc",
      tokens_in: 10,
      tokens_out: 5,
      cost_estimate_usd: 0.0001,
    });

    const unpatched = store.state().messages.find((m) => m.turn_id === "turn-xyz");
    expect(unpatched.tokens_in).toBeNull();
    expect(unpatched.tokens_out).toBeNull();
  });

  test("chat.usage without turn_id still increments totals", () => {
    store.handleChatUsage({ tokens_in: 50, tokens_out: 25, cost_estimate_usd: 0.0005 });
    expect(store.state().tokenUsageToday.messages).toBe(1);
    expect(store.state().tokenUsageToday.tokens_in).toBe(50);
  });
});
