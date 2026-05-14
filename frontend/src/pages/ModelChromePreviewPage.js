/**
 * /dev/model-chrome — preview page for Sprint 7 / 8 / 9 shell surfaces.
 *
 * Pure visual preview of the three new model-chrome components so Meg
 * can see them in-app before mc-fe-wiring binds them to live endpoints.
 *
 *   <AutoModelToggle>      — Sprint 9, the chat-header Auto switch
 *   <WhyThisModelBadge>    — Sprint 7, "why this model" chip
 *   <QuotaGauge>           — Sprint 8, real-time quota dial
 *
 * No fetches, no WS. Local state only.
 */
import React, { useState } from "react";
import { Sparkles, MessageSquare, Gauge } from "lucide-react";
import {
  AutoModelToggle,
  WhyThisModelBadge,
  QuotaGauge,
} from "@/components/model";

function Section({ title, sprint, icon: Icon, children }) {
  return (
    <section
      style={{
        marginBottom: 28,
        padding: 22,
        background: "var(--mc-bg-1)",
        border: "1px solid var(--mc-line)",
        borderRadius: "var(--mc-radius-lg, 14px)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <header style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--mc-accent-soft)",
            color: "var(--mc-accent)",
            border: "1px solid var(--mc-line)",
          }}
        >
          {Icon ? <Icon size={14} /> : null}
        </span>
        <div>
          <div
            style={{
              fontFamily: "var(--mc-font-display, inherit)",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--mc-fg)",
              letterSpacing: -0.2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "var(--mc-tracking-wide, 0.06em)",
              textTransform: "uppercase",
              color: "var(--mc-fg-3)",
              fontWeight: 600,
            }}
          >
            {sprint}
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}

export default function ModelChromePreviewPage() {
  const [auto, setAuto] = useState(true);

  return (
    <div
      style={{
        padding: "28px 36px 64px",
        maxWidth: 1080,
        margin: "0 auto",
        overflowY: "auto",
        height: "100%",
        color: "var(--mc-fg)",
      }}
    >
      <header style={{ marginBottom: 22 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--mc-font-display, inherit)",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -0.5,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              background:
                "linear-gradient(135deg, var(--mc-accent) 0%, var(--mc-accent-2) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Model Chrome
          </span>
          <Sparkles size={20} style={{ color: "var(--mc-accent)" }} />
        </h1>
        <p style={{ marginTop: 6, fontSize: 13, color: "var(--mc-fg-2)" }}>
          Preview of the Sprint 7 / 8 / 9 shells that the chat surface will adopt
          once mc-fe-wiring binds them. Theme-locked, prop-driven, no fetches.
        </p>
      </header>

      {/* Sprint 9 — Auto toggle */}
      <Section title="Auto Model Toggle" sprint="Sprint 9 — Auto pick" icon={Sparkles}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
          <AutoModelToggle value={auto} onChange={setAuto} />
          <AutoModelToggle value={false} onChange={() => {}} />
          <AutoModelToggle value disabled onChange={() => {}} />
          <span style={{ fontSize: 12, color: "var(--mc-fg-2)" }}>
            current: <strong style={{ color: "var(--mc-accent)" }}>{auto ? "AUTO" : "MANUAL"}</strong>
          </span>
        </div>
      </Section>

      {/* Sprint 7 — Why this model */}
      <Section title="Why This Model Badge" sprint="Sprint 7 — Classifier" icon={MessageSquare}>
        <p style={{ fontSize: 12, color: "var(--mc-fg-2)", marginTop: 0, marginBottom: 12 }}>
          Click any chip to expand the reasoning tooltip. Shows model / provider,
          one-line reason, confidence, classifier name, and considered alternatives.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <WhyThisModelBadge
            model="claude-opus-4"
            provider="Anthropic"
            reason="long-context"
            confidence={0.92}
            classifier="heuristic"
            alternatives={[
              { model_id: "claude-sonnet-4.6", score: 0.71 },
              { model_id: "gpt-55", score: 0.55 },
              { model_id: "gemini-3.1-pro", score: 0.40 },
            ]}
          />
          <WhyThisModelBadge
            model="qwen3-coder"
            provider="Ollama"
            reason="code"
            confidence={0.74}
            classifier="llm-classify"
            alternatives={[
              { model_id: "opencode-go", score: 0.62 },
            ]}
          />
          <WhyThisModelBadge
            model="glm-4.6"
            provider="Z.ai"
            reason="cheap"
            confidence={0.41}
            classifier="heuristic"
          />
          <WhyThisModelBadge model={null} />
        </div>
      </Section>

      {/* Sprint 8 — Quota gauge */}
      <Section title="Quota Gauge" sprint="Sprint 8 — Quota" icon={Gauge}>
        <p style={{ fontSize: 12, color: "var(--mc-fg-2)", marginTop: 0, marginBottom: 12 }}>
          Quota types match the picker contract: fixed, flat-with-overage,
          capped, pay-per-call, unavailable, unlimited. Ring tone escalates
          ok → warn → err as usage approaches the cap.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <QuotaGauge
            provider="Venice"
            kind="flat-with-overage"
            used={1240}
            limit={5000}
            unit="reqs"
            resetAt={Date.now() + 3 * 86400000}
          />
          <QuotaGauge
            provider="Anthropic"
            kind="capped"
            used={920}
            limit={1000}
            unit="msgs"
            resetAt={Date.now() + 5 * 3600000}
          />
          <QuotaGauge
            provider="OpenRouter"
            kind="pay-per-call"
            unit="USD"
          />
          <QuotaGauge
            provider="Ollama (local)"
            kind="unlimited"
          />
          <QuotaGauge
            provider="HuggingFace"
            kind="unavailable"
            error="no-key"
          />
          <QuotaGauge
            provider="OpenAI"
            kind="fixed"
            loading
          />
        </div>
      </Section>

      <footer
        style={{
          padding: "14px 16px",
          background: "var(--mc-bg-1)",
          border: "1px dashed var(--mc-line-strong)",
          borderRadius: "var(--mc-radius-md, 10px)",
          fontSize: 11,
          color: "var(--mc-fg-3)",
        }}
      >
        Shells only — endpoints (`GET /api/v2/models/classify`, `GET /api/v2/quota`)
        are owned by mc-be-builder. mc-fe-wiring will mount these in chat
        header / message rows / Settings once those routes land.
      </footer>
    </div>
  );
}
