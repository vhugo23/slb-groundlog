interface StatusBadgeProps {
  status: 'clean' | 'flagged'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isClean = status === 'clean'
  return (
    <span className={`gl-badge ${isClean ? 'gl-badge-clean' : 'gl-badge-flagged'}`}>
      <span className="gl-badge-dot" aria-hidden="true" />
      {isClean ? 'Clean' : 'Flagged'}
    </span>
  )
}
