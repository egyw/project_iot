'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import StatsCard from '@/components/StatsCard';
import ActivityFeed from '@/components/ActivityFeed';

const POLL_INTERVAL = 10000; // 10 seconds

const styles = {
  page: {
    animation: 'fadeIn 0.4s ease',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '28px',
  },
  activitySection: {
    marginTop: '4px',
  },
  errorContainer: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    animation: 'fadeIn 0.4s ease',
  },
  errorIcon: {
    fontSize: '40px',
  },
  errorTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--danger)',
  },
  errorMessage: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  retryBtn: {
    padding: '8px 20px',
    background: 'var(--danger)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity var(--transition)',
    marginTop: '4px',
  },
  /* Skeleton */
  skeletonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '28px',
  },
  skeletonCard: {
    height: '140px',
    borderRadius: 'var(--radius-lg)',
  },
  skeletonFeed: {
    height: '320px',
    borderRadius: 'var(--radius-lg)',
  },
  liveIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--success)',
    fontWeight: 500,
    marginBottom: '20px',
  },
  liveDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--success)',
    animation: 'pulse 2s ease-in-out infinite',
  },
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsData, activityData] = await Promise.all([
        api.get('/stats/overview'),
        api.get('/stats/activity?limit=10'),
      ]);
      setStats(statsData);
      setActivities(activityData.activities || activityData);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    fetchData();
  };

  // Skeleton loading state
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ ...styles.skeletonCard, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        <div
          className="skeleton"
          style={styles.skeletonFeed}
        />
      </div>
    );
  }

  // Error state
  if (error && !stats) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>⚠️</div>
          <div style={styles.errorTitle}>Failed to Load Dashboard</div>
          <div style={styles.errorMessage}>{error}</div>
          <button
            style={styles.retryBtn}
            onClick={handleRetry}
            onMouseEnter={(e) => { e.target.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.target.style.opacity = '1'; }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Live indicator */}
      <div style={styles.liveIndicator}>
        <span style={styles.liveDot} />
        Live — auto-refreshing every 10s
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <StatsCard
          title="Total Assets"
          value={stats?.total_assets}
          subtitle="All registered assets"
          color="primary"
        />
        <StatsCard
          title="Available"
          value={stats?.available_assets}
          subtitle="Ready to borrow"
          color="success"
        />
        <StatsCard
          title="Active Sessions"
          value={stats?.active_sessions}
          subtitle="Currently borrowed"
          color="warning"
        />
        <StatsCard
          title="Borrows Today"
          value={stats?.borrows_today}
          subtitle="Today's transactions"
          color="danger"
        />
        <StatsCard
          title="This Week"
          value={stats?.borrows_this_week}
          subtitle="Weekly borrowing total"
          color="primary"
        />
      </div>

      {/* Activity Feed */}
      <div style={styles.activitySection}>
        <ActivityFeed activities={activities} />
      </div>
    </div>
  );
}
