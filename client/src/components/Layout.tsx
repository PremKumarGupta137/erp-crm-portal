import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initials } from './ui';

interface NavEntry {
  to: string;
  label: string;
  icon: string;
  section?: string;
}

const NAV: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: '◆', section: 'Overview' },
  { to: '/customers', label: 'Customers', icon: '👥', section: 'CRM' },
  { to: '/products', label: 'Products', icon: '📦', section: 'Inventory' },
  { to: '/stock', label: 'Stock Movements', icon: '⇅' },
  { to: '/challans', label: 'Sales Challans', icon: '🧾', section: 'Sales' },
  { to: '/users', label: 'Users & Roles', icon: '🔑', section: 'Admin' },
];

const TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Dashboard', sub: 'Operations at a glance' },
  '/customers': { title: 'Customers', sub: 'CRM · leads, accounts and follow-ups' },
  '/products': { title: 'Products', sub: 'Catalogue and stock levels' },
  '/stock': { title: 'Stock Movements', sub: 'Full inventory ledger' },
  '/challans': { title: 'Sales Challans', sub: 'Dispatch documents' },
  '/users': { title: 'Users & Roles', sub: 'Access control' },
};

function currentTitle(pathname: string) {
  if (pathname.startsWith('/customers/')) return { title: 'Customer Detail', sub: 'CRM' };
  if (pathname.startsWith('/products/')) return { title: 'Product Detail', sub: 'Inventory' };
  if (pathname === '/challans/new') return { title: 'New Sales Challan', sub: 'Sales' };
  if (pathname.startsWith('/challans/')) return { title: 'Challan Detail', sub: 'Sales' };
  return TITLES[pathname] ?? { title: 'ERP · CRM', sub: '' };
}

export function Layout() {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const heading = currentTitle(pathname);

  // The Admin section is the only nav entry that is role-gated in the UI;
  // everything else is visible to all roles but write actions are gated per page.
  const visibleNav = NAV.filter((entry) => entry.to !== '/users' || can());

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">EC</div>
          <div>
            ERP<span style={{ opacity: 0.5 }}>·</span>CRM
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNav.map((entry) => (
            <div key={entry.to}>
              {entry.section && <div className="sidebar-label">{entry.section}</div>}
              <NavLink
                to={entry.to}
                end={entry.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon">{entry.icon}</span>
                {entry.label}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          Signed in as
          <div style={{ color: '#e6eaf0', marginTop: 2 }}>{user?.name}</div>
          <div style={{ fontSize: 11 }}>{user?.role}</div>
        </div>
      </aside>

      <div className={`scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button className="hamburger" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
              ☰
            </button>
            <div>
              <div className="topbar-title">{heading.title}</div>
              <div className="topbar-sub">{heading.sub}</div>
            </div>
          </div>

          <div className="topbar-user">
            <div className="avatar">{initials(user?.name ?? '')}</div>
            <button className="btn btn-secondary btn-sm" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
