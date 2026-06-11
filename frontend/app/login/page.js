'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken, isLoggedIn } from '@/lib/auth';

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
    padding: '20px',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    animation: 'fadeIn 0.5s ease',
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
    borderRadius: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    fontSize: '24px',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '0.025em',
  },
  input: {
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    color: 'var(--text)',
    background: 'var(--bg)',
    outline: 'none',
    transition: 'border-color var(--transition), box-shadow var(--transition)',
  },
  button: {
    padding: '12px',
    background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform var(--transition), box-shadow var(--transition), opacity var(--transition)',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
    marginTop: '4px',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  errorBox: {
    padding: '12px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 'var(--radius)',
    color: 'var(--danger)',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    animation: 'fadeIn 0.3s ease',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post('/auth/login', { username, password });
      setToken(data.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>🔬</div>
          <h1 style={styles.title}>SmartLab Admin</h1>
          <p style={styles.subtitle}>Asset Borrowing System</p>
        </div>

        <form style={styles.form} onSubmit={handleSubmit}>
          {error && (
            <div style={styles.errorBox}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div style={styles.fieldGroup}>
            <label htmlFor="username" style={styles.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
              required
              autoComplete="username"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.4)';
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
