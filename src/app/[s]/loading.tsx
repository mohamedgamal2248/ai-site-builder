/** Shown instantly on every navigation while the next page's data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="skeleton skeleton-title" />
      <div className="card">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton" style={{ width: "38%" }} />
            <div className="skeleton" style={{ width: "22%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
