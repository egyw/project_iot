'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, removeToken } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/users', label: 'Users', icon: '👥' },
  { href: '/dashboard/assets', label: 'Assets', icon: '📦' },
  { href: '/dashboard/assets/types', label: 'Asset Types', icon: '🏷️' },
  { href: '/dashboard/sessions', label: 'Sessions', icon: '📋' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

const pageTitles = {
  '/dashboard': 'Dashboard Overview',
  '/dashboard/users': 'User Management',
  '/dashboard/assets': 'Asset Management',
  '/dashboard/assets/types': 'Asset Types',
  '/dashboard/sessions': 'Borrow Sessions',
  '/dashboard/settings': 'Settings',
};

function getPageTitle(pathname) {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith('/dashboard/users/')) return 'User Detail';
  if (pathname.startsWith('/dashboard/sessions/')) return 'Session Detail';
  return 'SmartLab Admin';
}

function isNavActive(href, pathname) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  if (href === '/dashboard/assets/types') return pathname === '/dashboard/assets/types';
  if (href === '/dashboard/assets') return pathname === '/dashboard/assets';
  return pathname.startsWith(href);
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
  },
  /* ===== SIDEBAR ===== */
  sidebar: {
    width: '240px',
    background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 50,
    boxShadow: '4px 0 20px rgba(0, 0, 0, 0.15)',
  },
  sidebarHeader: {
    padding: '24px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  logoSub: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 500,
    marginTop: '1px',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '11px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.6)',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    position: 'relative',
  },
  navLinkActive: {
    background: 'rgba(37, 99, 235, 0.2)',
    color: '#fff',
    fontWeight: 600,
  },
  navLinkHover: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '3px',
    height: '20px',
    background: 'var(--primary)',
    borderRadius: '0 4px 4px 0',
  },
  sidebarFooter: {
    padding: '16px 12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '11px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.6)',
    width: '100%',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
  },
  /* ===== MAIN ===== */
  main: {
    flex: 1,
    marginLeft: '240px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  topbar: {
    height: '64px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 32px',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    boxShadow: 'var(--shadow-sm)',
  },
  topbarTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  content: {
    flex: 1,
    padding: '28px 32px',
  },
  loadingScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg)',
  },
};

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
    } else {
      setAuthChecked(true);
    }
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.replace('/login');
  };

  const currentTitle = getPageTitle(pathname);

  if (!authChecked) {
    return (
      <div style={styles.loadingScreen}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>🔬</div>
            <div>
              <div style={styles.logoText}>SmartLab</div>
              <div style={styles.logoSub}>Admin Panel</div>
            </div>
          </div>
        </div>

        <nav style={styles.nav}>
          {navItems.map((item) => {
            const isActive = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : {}),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    Object.assign(e.currentTarget.style, styles.navLinkHover);
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                  }
                }}
              >
                {isActive && <span style={styles.activeIndicator} />}
                <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <button
            onClick={handleLogout}
            style={styles.logoutBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.15)';
              e.currentTarget.style.color = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            }}
          >
            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <header style={styles.topbar}>
          <h1 style={styles.topbarTitle}>{currentTitle}</h1>
        </header>
        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}
