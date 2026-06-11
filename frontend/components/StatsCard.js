const colorMap = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

const bgMap = {
  primary: 'rgba(37, 99, 235, 0.06)',
  success: 'rgba(22, 163, 74, 0.06)',
  warning: 'rgba(217, 119, 6, 0.06)',
  danger: 'rgba(220, 38, 38, 0.06)',
};

const iconMap = {
  primary: '📦',
  success: '✅',
  warning: '⏳',
  danger: '🔴',
};

const styles = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow)',
    borderLeft: '4px solid',
    transition: 'transform var(--transition), box-shadow var(--transition)',
    cursor: 'default',
    animation: 'fadeIn 0.4s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  iconBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    marginBottom: '14px',
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '6px',
  },
  value: {
    fontSize: '32px',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.1,
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
};

export default function StatsCard({ title, value, subtitle, color = 'primary' }) {
  const accentColor = colorMap[color] || colorMap.primary;
  const bgColor = bgMap[color] || bgMap.primary;
  const icon = iconMap[color] || iconMap.primary;

  return (
    <div
      style={{
        ...styles.card,
        borderLeftColor: accentColor,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}
    >
      <div style={{ ...styles.iconBadge, background: bgColor }}>
        {icon}
      </div>
      <div style={styles.title}>{title}</div>
      <div style={styles.value}>{value ?? '—'}</div>
      {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}
