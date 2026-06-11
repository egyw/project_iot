const typeConfig = {
  BORROW: {
    icon: '📤',
    label: 'Borrowed',
    color: 'var(--warning)',
    bg: 'rgba(217, 119, 6, 0.08)',
  },
  RETURN: {
    icon: '📥',
    label: 'Returned',
    color: 'var(--success)',
    bg: 'rgba(22, 163, 74, 0.08)',
  },
};

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

const styles = {
  container: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    animation: 'fadeIn 0.5s ease',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  badge: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    background: 'var(--bg)',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  list: {
    maxHeight: '380px',
    overflowY: 'auto',
  },
  item: {
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    borderBottom: '1px solid var(--border)',
    transition: 'background var(--transition)',
  },
  iconBubble: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  detail: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  timestamp: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  empty: {
    padding: '40px 24px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '14px',
  },
};

export default function ActivityFeed({ activities = [] }) {
  if (!activities || activities.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>Recent Activity</span>
        </div>
        <div style={styles.empty}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Recent Activity</span>
        <span style={styles.badge}>{activities.length} events</span>
      </div>
      <div style={styles.list}>
        {activities.map((activity, index) => {
          const config = typeConfig[activity.type] || typeConfig.BORROW;
          return (
            <div
              key={index}
              style={styles.item}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ ...styles.iconBubble, background: config.bg }}>
                {config.icon}
              </div>
              <div style={styles.info}>
                <div style={styles.userName}>
                  {activity.user_name || 'Unknown User'}
                </div>
                <div style={styles.detail}>
                  {config.label} {activity.item_count || 0} item{(activity.item_count || 0) !== 1 ? 's' : ''}
                  {activity.user_nrp && (
                    <span> · NRP {activity.user_nrp}</span>
                  )}
                </div>
              </div>
              <div style={styles.timestamp}>
                {formatTimestamp(activity.timestamp)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
