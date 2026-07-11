"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ApiError, streamChat, type ChatMessage } from "@/lib/api";
import styles from "./assistant.module.css";

interface Suggestion {
  label: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: "What is a stock, in simple terms?",
    prompt: "What is a stock, in simple terms? Explain it like I'm a beginner.",
  },
  {
    label: "What is the S&P 500?",
    prompt: "What is the S&P 500 and why do people follow it?",
  },
  {
    label: "How do I read an RSI chart?",
    prompt:
      "How do I read an RSI chart, and what do overbought and oversold mean?",
  },
  {
    label: "Golden Cross vs Death Cross?",
    prompt:
      "What's the difference between a Golden Cross and a Death Cross, and why do traders watch them?",
  },
  {
    label: "What does volatility tell me?",
    prompt: "What does volatility mean for a stock, and how should I think about it?",
  },
  {
    label: "How does buying a stock work?",
    prompt: "How does buying and selling a stock actually work, step by step?",
  },
];

const GREETING =
  "Hi! I'm Axiom AI, your guide to the market. Ask me anything about how stocks work, what the indicators on this dashboard mean, or how trading works  I'll keep it clear and simple.";

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the newest message in view as content streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  // Auto-grow the textarea up to its max-height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    setError(null);
    setInput("");

    const history: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    // Add the user's turn plus an empty assistant turn we stream into.
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        history,
        (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = {
                role: "assistant",
                content: last.content + delta,
              };
            }
            return next;
          });
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User pressed stop  keep whatever streamed so far.
      } else {
        const message =
          err instanceof ApiError
            ? err.message
            : "Something went wrong reaching the assistant. Please try again.";
        setError(message);
        // Drop the empty/partial assistant bubble if nothing was produced.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0;
  const lastMsg = messages[messages.length - 1];
  const waitingFirstToken =
    streaming && lastMsg?.role === "assistant" && lastMsg.content === "";

  return (
    <main className={styles.page}>
      {/* Header */}
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <div className={styles.avatar}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
              <path d="M19 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
            </svg>
          </div>
          <div>
            <div className={styles.title}>Axiom AI Assistant</div>
            <div className={styles.subtitle}>
              Learn how stocks, indicators, and the market work
            </div>
          </div>
        </div>
        {!isEmpty && (
          <button type="button" className={styles.clearBtn} onClick={handleClear}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
            <span>New chat</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className={styles.scroll} ref={scrollRef}>
        {isEmpty ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeMark}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
                <path d="M19 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
              </svg>
            </div>
            <h1 className={styles.welcomeTitle}>How can I help you today?</h1>
            <p className={styles.welcomeText}>{GREETING}</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={styles.suggestion}
                  onClick={() => send(s.prompt)}
                >
                  <svg className={styles.suggestionIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" />
                  </svg>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.thread}>
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isLast = i === messages.length - 1;
              return (
                <div
                  key={i}
                  className={`${styles.row} ${isUser ? styles.rowUser : ""}`}
                >
                  <div
                    className={`${styles.msgAvatar} ${isUser ? styles.msgAvatarUser : styles.msgAvatarAi
                      }`}
                    aria-hidden="true"
                  >
                    {isUser ? (
                      "You"
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
                      </svg>
                    )}
                  </div>
                  <div
                    className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAi
                      }`}
                  >
                    {isUser ? (
                      m.content
                    ) : waitingFirstToken && isLast ? (
                      <span className={styles.typing}>
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      <>
                        {renderMarkdown(m.content)}
                        {streaming && isLast && (
                          <span className={styles.caret} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {error && <div className={styles.error}>{error}</div>}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className={styles.composerWrap}>
        <div className={styles.composer}>
          <textarea
            ref={textareaRef}
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about stocks, indicators, or how the market works…"
            rows={1}
          />
          {streaming ? (
            <button
              type="button"
              className={styles.stopBtn}
              onClick={handleStop}
              aria-label="Stop generating"
              title="Stop"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className={styles.sendBtn}
              onClick={() => send(input)}
              disabled={!input.trim()}
              aria-label="Send message"
              title="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
        <p className={styles.disclaimer}>
          Axiom AI is for education only and can make mistakes. This is not
          financial advice  always do your own research.
        </p>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* Minimal, safe Markdown rendering  no raw HTML injection. Handles       */
/* paragraphs, bullet/numbered lists, **bold**, and `inline code`.         */
/* ---------------------------------------------------------------------- */

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on **bold** and `code`, keeping the delimiters via capture groups.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  parts.forEach((part, idx) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={idx}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(<code key={idx}>{part.slice(1, -1)}</code>);
    } else {
      nodes.push(<Fragment key={idx}>{part}</Fragment>);
    }
  });
  return nodes;
}

function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={key++}>{renderInline(paragraph.join(" "))}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      const items = listItems.map((it, i) => (
        <li key={i}>{renderInline(it)}</li>
      ));
      blocks.push(
        listOrdered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>,
      );
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (bullet) {
      flushParagraph();
      if (listItems.length && listOrdered) flushList();
      listOrdered = false;
      listItems.push(bullet[1]);
    } else if (numbered) {
      flushParagraph();
      if (listItems.length && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(numbered[1]);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();

  return <>{blocks}</>;
}
