interface WelcomeScreenProps {
  onSuggestion: (text: string) => void;
}

const suggestions = [
  { icon: '📊', text: 'How is my virtual assistant page performing this week?' },
  { icon: '🔥', text: 'Where are users clicking most on my site?' },
  { icon: '📉', text: 'Why are visitors leaving without taking action?' },
  { icon: '💡', text: 'Give me 3 things I can improve on my site right now' },
];

export default function WelcomeScreen({ onSuggestion }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <div className="welcome-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      </div>
      <h1>What&apos;s happening on your site?</h1>
      <p>
        Ask me anything about your Hire Overseas website performance. I&apos;ll pull your
        Clarity data and explain it in plain English.
      </p>
      <div className="suggestions">
        {suggestions.map(({ icon, text }) => (
          <button
            key={text}
            className="suggestion-chip"
            onClick={() => onSuggestion(text)}
          >
            <span className="chip-icon">{icon}</span>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
