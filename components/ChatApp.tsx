'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import WelcomeScreen from './WelcomeScreen';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

interface Message {
  id: string;
  role: 'user' | 'ai';
  html: string;
  raw: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvoId, setCurrentConvoId] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [clarityConnected, setClarityConnected] = useState<boolean | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesWrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable refs to avoid stale closures in async handlers
  const currentConvoIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  currentConvoIdRef.current = currentConvoId;
  conversationsRef.current = conversations;

  // Load persisted conversations
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clarity_convos');
      if (saved) setConversations(JSON.parse(saved));
    } catch {
      // ignore corrupt storage
    }

    // Check Clarity API connectivity
    fetch('/api/clarity')
      .then((res) => setClarityConnected(res.ok))
      .catch(() => setClarityConnected(false));
  }, []);

  // GSAP entrance animations
  useEffect(() => {
    import('gsap').then(({ gsap }) => {
      gsap.from('.sidebar',         { x: -20, opacity: 0, duration: 0.5, ease: 'power2.out' });
      gsap.from('.topbar',          { y: -10, opacity: 0, duration: 0.4, delay: 0.1, ease: 'power2.out' });
      gsap.from('.welcome',         { y: 20,  opacity: 0, duration: 0.6, delay: 0.2, ease: 'power2.out' });
      gsap.from('.suggestion-chip', { y: 12,  opacity: 0, stagger: 0.08, duration: 0.4, delay: 0.35, ease: 'power2.out' });
      gsap.from('.input-area',      { y: 10,  opacity: 0, duration: 0.4, delay: 0.15, ease: 'power2.out' });
    });
  }, []);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    setTimeout(() => {
      if (messagesWrapRef.current) {
        messagesWrapRef.current.scrollTo({
          top: messagesWrapRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 50);
  }, [messages, streamingContent]);

  const persistConvos = (convos: Conversation[]) => {
    setConversations(convos);
    localStorage.setItem('clarity_convos', JSON.stringify(convos));
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setShowWelcome(false);
    setIsStreaming(true);
    setStreamingContent('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      html: escapeHtml(text),
      raw: text,
    };

    // Snapshot current state (stable because isStreaming gate prevents re-entry)
    const prevMessages = messages;
    const prevConvoId = currentConvoIdRef.current;
    const allMessages = [...prevMessages, userMsg];
    setMessages(allMessages);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message: text,
          pageFilter,
          history: prevMessages.map((m) => ({ role: m.role, raw: m.raw })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamingContent(accumulated);
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        html: accumulated,
        raw: accumulated,
      };

      const finalMessages = [...allMessages, aiMsg];
      setMessages(finalMessages);

      // Persist to conversation history
      const convos = conversationsRef.current;
      let convoId = prevConvoId;

      if (!convoId) {
        convoId = (Date.now() + 2).toString();
        setCurrentConvoId(convoId);
        persistConvos([
          ...convos,
          {
            id: convoId,
            title: text.slice(0, 42) + (text.length > 42 ? '…' : ''),
            messages: finalMessages,
          },
        ]);
      } else {
        persistConvos(
          convos.map((c) => (c.id === convoId ? { ...c, messages: finalMessages } : c))
        );
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        html: `<p>Sorry, something went wrong: ${(err as Error).message}. Please check your environment variables.</p>`,
        raw: 'Error',
      };
      setMessages((prev) => [...prev, errMsg]);
    }

    setStreamingContent('');
    setIsStreaming(false);
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    setCurrentConvoId(null);
    setMessages([]);
    setShowWelcome(true);
    setStreamingContent('');
    setIsStreaming(false);
  };

  const handleLoadConvo = (id: string) => {
    const convo = conversationsRef.current.find((c) => c.id === id);
    if (!convo) return;
    setCurrentConvoId(id);
    setMessages(convo.messages);
    setShowWelcome(false);
  };

  const handlePageFilter = () => {
    const p = window.prompt(
      'Filter to a specific page path (e.g. /hire/virtual-assistant)\nLeave blank for all pages:',
      pageFilter
    );
    if (p === null) return;
    setPageFilter(p.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitFromTextarea();
    }
  };

  const submitFromTextarea = () => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value.trim();
    if (!text) return;
    textareaRef.current.value = '';
    textareaRef.current.style.height = 'auto';
    handleSend(text);
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        conversations={conversations}
        currentConvoId={currentConvoId}
        clarityConnected={clarityConnected}
        onNewChat={handleNewChat}
        onLoadConvo={handleLoadConvo}
      />

      <main className="main">
        {/* TOP BAR */}
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">Website Analytics Chat</div>
            <div className="topbar-badge">Powered by Clarity + Claude</div>
          </div>
          <div className="page-filter" onClick={handlePageFilter}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>{pageFilter || 'All pages'}</span>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="messages-wrap" ref={messagesWrapRef}>
          <div className="messages-inner">
            {showWelcome && messages.length === 0 ? (
              <WelcomeScreen onSuggestion={handleSend} />
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} role={msg.role} html={msg.html} />
                ))}
                {isStreaming &&
                  (streamingContent ? (
                    <MessageBubble role="ai" html={streamingContent} />
                  ) : (
                    <TypingIndicator />
                  ))}
              </>
            )}
          </div>
        </div>

        {/* INPUT */}
        <div className="input-area">
          <div className="input-wrap">
            <div className="input-box">
              <textarea
                ref={textareaRef}
                placeholder="Ask about your website performance…"
                rows={1}
                onKeyDown={handleKeyDown}
                onChange={handleInput}
                disabled={isStreaming}
              />
              <button
                className="send-btn"
                disabled={isStreaming}
                onClick={submitFromTextarea}
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7"/>
                </svg>
              </button>
            </div>
            <div className="input-hint">
              Clarity data · Last 3 days · hireoverseas.com
              {pageFilter ? ` · ${pageFilter}` : ''}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
