export function LoadingBlock({ lines = 3, height = 80 }: { lines?: number; height?: number }) {
  return (
    <div className="state-stack">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state-msg card">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--warn)" strokeWidth="1.8">
        <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
        <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round" />
      </svg>
      <p>{message ?? "Couldn't load weather data."}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ children }: { children: React.ReactNode }) {
  return <div className="state-msg card faint">{children}</div>;
}
