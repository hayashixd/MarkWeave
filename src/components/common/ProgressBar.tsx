interface ProgressBarProps {
  value?: number;
  indeterminate?: boolean;
  label?: string;
}

export function ProgressBar({ value = 0, indeterminate = false, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="app-progress" aria-live="polite">
      {label && (
        <div className="app-progress__label">
          <span>{label}</span>
          {!indeterminate && <span>{Math.round(clamped)}%</span>}
        </div>
      )}
      <div
        className="app-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      >
        <div
          className={`app-progress__fill${indeterminate ? ' app-progress__fill--indeterminate' : ''}`}
          style={indeterminate ? undefined : { width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
