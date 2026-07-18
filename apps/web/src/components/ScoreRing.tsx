export function ScoreRing({ score, label }: { score: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div
      className="score-ring"
      style={{
        background: `conic-gradient(var(--accent-teal) ${clamped * 3.6}deg, var(--border) 0deg)`
      }}
      aria-label={`${label}: ${score}`}
    >
      <div className="score-ring-inner">
        <strong>{score}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
