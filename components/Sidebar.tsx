interface Conversation {
  id: string;
  title: string;
}

interface SidebarProps {
  conversations: Conversation[];
  currentConvoId: string | null;
  clarityConnected: boolean | null;
  onNewChat: () => void;
  onLoadConvo: (id: string) => void;
}

export default function Sidebar({
  conversations,
  currentConvoId,
  clarityConnected,
  onNewChat,
  onLoadConvo,
}: SidebarProps) {
  const dotClass =
    clarityConnected === null
      ? 'status-dot loading'
      : clarityConnected
      ? 'status-dot'
      : 'status-dot offline';

  const statusText =
    clarityConnected === null
      ? 'Checking connection…'
      : clarityConnected
      ? 'Clarity connected'
      : 'Clarity API error';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div>
            <div className="logo-text">Clarity AI</div>
            <div className="logo-sub">Hire Overseas</div>
          </div>
        </div>
        <button className="new-chat-btn" onClick={onNewChat}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          New conversation
        </button>
      </div>

      <div className="sidebar-section">Recent</div>

      <div className="chat-history">
        {conversations.length === 0 ? (
          <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-light)' }}>
            No conversations yet
          </div>
        ) : (
          [...conversations].reverse().map((c) => (
            <div
              key={c.id}
              className={`history-item${c.id === currentConvoId ? ' active' : ''}`}
              onClick={() => onLoadConvo(c.id)}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
              {c.title}
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="api-status">
          <div className={dotClass} />
          <div>
            <div className="status-text">{statusText}</div>
            <div className="status-label">hireoverseas.com</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
