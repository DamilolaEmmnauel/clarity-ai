interface MessageBubbleProps {
  role: 'user' | 'ai';
  html: string;
}

export default function MessageBubble({ role, html }: MessageBubbleProps) {
  const initial = role === 'ai' ? 'C' : 'H';

  return (
    <div className={`message ${role}`}>
      <div className={`avatar ${role}`}>{initial}</div>
      {/* HTML comes from our own Claude API call via the system prompt we control */}
      <div
        className="bubble"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
