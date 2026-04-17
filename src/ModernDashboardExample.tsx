import React, { useState } from 'react';

/**
 * ModernDashboardExample - דוגמה לקונספט עיצובי חדשני
 * שימוש ב-CSS-in-JS פשוט לצורך הדגמה, Glassmorphism ו-Bento Grid.
 */
const ModernDashboardExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div style={styles.container} dir="rtl">
      {/* Sidebar - Sleek and Minimal */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>V-MEN <span style={styles.logoDot}>.</span></div>
        <nav style={styles.nav}>
          <NavItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon="📊" label="סקירה כללית" />
          <NavItem active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} icon="👥" label="אנשי קשר" />
          <NavItem active={activeTab === 'cleanup'} onClick={() => setActiveTab('cleanup')} icon="✨" label="ניקוי חכם" />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon="⚙️" label="הגדרות" />
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.userProfile}>
            <div style={styles.avatar}>AD</div>
            <span>אדמין</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>🔍</span>
            <input type="text" placeholder="חיפוש מהיר..." style={styles.searchInput} />
          </div>
          <div style={styles.headerActions}>
            <button style={styles.primaryButton}>+ איש קשר חדש</button>
          </div>
        </header>

        {/* Bento Grid Layout */}
        <section style={styles.bentoGrid}>
          <div style={{ ...styles.bentoItem, ...styles.bentoLarge }}>
            <h3 style={styles.cardTitle}>סטטיסטיקת רשימה</h3>
            <div style={styles.statsContainer}>
              <StatItem label="סהוח" value="1,248" color="#6366f1" />
              <StatItem label="כפילויות" value="42" color="#f43f5e" />
              <StatItem label="תקינים" value="96%" color="#10b981" />
            </div>
          </div>

          <div style={{ ...styles.bentoItem, ...styles.bentoMedium }}>
            <h3 style={styles.cardTitle}>פעולות מהירות</h3>
            <div style={styles.quickActions}>
              <button style={styles.actionPill}>ייבוא VCF</button>
              <button style={styles.actionPill}>גיבוי ענן</button>
              <button style={styles.actionPill}>מיזוג הכל</button>
            </div>
          </div>

          <div style={{ ...styles.bentoItem, ...styles.bentoWide }}>
            <h3 style={styles.cardTitle}>אנשי קשר אחרונים</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>שם</th>
                  <th style={styles.th}>טלפון</th>
                  <th style={styles.th}>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                <TableRow name="ישראל ישראלי" phone="050-1234567" status="תקין" />
                <TableRow name="שרה כהן" phone="052-9988776" status="כפיל" isWarning />
                <TableRow name="אברהם אבינו" phone="054-0000000" status="תקין" />
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

/* רכיבי עזר קטנים */
const NavItem = ({ active, icon, label, onClick }: any) => (
  <div onClick={onClick} style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}>
    <span style={styles.navIcon}>{icon}</span>
    <span style={styles.navLabel}>{label}</span>
  </div>
);

const StatItem = ({ label, value, color }: any) => (
  <div style={styles.statItem}>
    <span style={styles.statLabel}>{label}</span>
    <span style={{ ...styles.statValue, color }}>{value}</span>
  </div>
);

const TableRow = ({ name, phone, status, isWarning }: any) => (
  <tr style={styles.tr}>
    <td style={styles.td}>{name}</td>
    <td style={styles.td}>{phone}</td>
    <td style={styles.td}>
      <span style={{ ...styles.statusBadge, backgroundColor: isWarning ? '#fef2f2' : '#f0fdf4', color: isWarning ? '#ef4444' : '#22c55e' }}>
        {status}
      </span>
    </td>
  </tr>
);

/* Styles - Modern UI Kit */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1e293b',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem 1.5rem',
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    letterSpacing: '-1px',
    marginBottom: '3rem',
  },
  logoDot: { color: '#6366f1' },
  nav: { flex: 1 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    marginBottom: '0.5rem',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#64748b',
  },
  navItemActive: {
    backgroundColor: '#f1f5f9',
    color: '#6366f1',
    fontWeight: 600,
  },
  navIcon: { marginLeft: '12px', fontSize: '1.2rem' },
  main: { flex: 1, padding: '2rem 3rem', overflowY: 'auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '3rem',
  },
  searchWrapper: {
    position: 'relative',
    width: '400px',
  },
  searchInput: {
    width: '100%',
    padding: '0.8rem 2.8rem 0.8rem 1rem',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    outline: 'none',
    fontSize: '0.95rem',
  },
  searchIcon: { position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 },
  primaryButton: {
    backgroundColor: '#1e293b',
    color: 'white',
    padding: '0.8rem 1.5rem',
    borderRadius: '14px',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  bentoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.5rem',
  },
  bentoItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    padding: '1.5rem',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
  },
  bentoLarge: { gridColumn: 'span 2' },
  bentoMedium: { gridColumn: 'span 1' },
  bentoWide: { gridColumn: 'span 3' },
  cardTitle: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' },
  statsContainer: { display: 'flex', justifyContent: 'space-around' },
  statItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statLabel: { fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' },
  statValue: { fontSize: '2rem', fontWeight: 800 },
  quickActions: { display: 'flex', flexWrap: 'wrap', gap: '0.8rem' },
  actionPill: {
    padding: '0.6rem 1rem',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'right', padding: '1rem', color: '#64748b', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' },
  td: { padding: '1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.95rem' },
  statusBadge: {
    padding: '0.3rem 0.8rem',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 600,
  }
};

export default ModernDashboardExample;