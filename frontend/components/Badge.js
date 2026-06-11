const colorPresets = {
  primary: {
    background: 'rgba(37, 99, 235, 0.1)',
    color: 'var(--primary)',
    border: 'rgba(37, 99, 235, 0.2)',
  },
  success: {
    background: 'rgba(22, 163, 74, 0.1)',
    color: 'var(--success)',
    border: 'rgba(22, 163, 74, 0.2)',
  },
  warning: {
    background: 'rgba(217, 119, 6, 0.1)',
    color: 'var(--warning)',
    border: 'rgba(217, 119, 6, 0.2)',
  },
  danger: {
    background: 'rgba(220, 38, 38, 0.1)',
    color: 'var(--danger)',
    border: 'rgba(220, 38, 38, 0.2)',
  },
  muted: {
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    border: 'var(--border)',
  },
};

export default function Badge({ text, color = 'primary' }) {
  const preset = colorPresets[color] || colorPresets.primary;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: 1.5,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        background: preset.background,
        color: preset.color,
        border: `1px solid ${preset.border}`,
      }}
    >
      {text}
    </span>
  );
}
