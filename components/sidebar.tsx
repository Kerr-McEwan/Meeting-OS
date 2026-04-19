'use client';

import React from 'react';
import { Icon, Avatar } from './atoms';
import type { Page, TeamMember } from '@/lib/types';

export function Sidebar({
  page,
  setPage,
  counts,
  collapsed,
  onToggleCollapse,
  user,
}: {
  page: Page;
  setPage: (p: Page) => void;
  counts: { openActions: number; decisions: number };
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: TeamMember & { email: string };
}) {
  const items: { id: Page; label: string; icon: 'grid' | 'check' | 'lightbulb'; badge?: number }[] = [
    { id: 'horizontal', label: 'Meeting Agenda', icon: 'grid' },
    { id: 'actions',    label: 'Action Log',     icon: 'check',    badge: counts.openActions },
    { id: 'decisions',  label: 'Decision Log',   icon: 'lightbulb', badge: counts.decisions },
  ];
  const resources = [
    { icon: 'calendar' as const, label: 'Series settings' },
    { icon: 'users' as const,    label: 'Attendees' },
    { icon: 'link' as const,     label: 'Templates' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">◐</div>
        {!collapsed && (
          <div className="brand-text">
            <div className="brand-title">Meeting OS</div>
            <div className="brand-sub">M Squared · internal</div>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} className="ic sm" />
        </button>
      </div>

      <div>
        {!collapsed && <div className="nav-section-label">Pages</div>}
        <nav className="nav">
          {items.map((it) => (
            <button
              key={it.id}
              className={`nav-item ${page === it.id ? 'active' : ''}`}
              onClick={() => setPage(it.id)}
              title={collapsed ? it.label : undefined}
            >
              <Icon name={it.icon} className="ic nav-icon" />
              {!collapsed && <span>{it.label}</span>}
              {!collapsed && it.badge != null && <span className="nav-badge">{it.badge}</span>}
              {collapsed && it.badge != null && <span className="nav-badge-dot" />}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {!collapsed && <div className="nav-section-label">Resources</div>}
        <nav className="nav">
          {resources.map((r) => (
            <button key={r.label} className="nav-item" title={collapsed ? r.label : undefined}>
              <Icon name={r.icon} className="ic nav-icon" />
              {!collapsed && <span>{r.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="user">
          <Avatar person={user} size="sm" />
          {!collapsed && (
            <div>
              <div style={{ color: 'var(--text)', fontWeight: 500, fontSize: 11.5 }}>{user.name}</div>
              <div>{user.role || user.email}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="signout">Sign out</button>
          </form>
        )}
      </div>
    </aside>
  );
}

export function Topbar({ pageTitle, crumb }: { pageTitle: string; crumb: string }) {
  return (
    <div className="topbar">
      <span className="crumb">{crumb}</span>
      <span style={{ color: 'var(--text-dim)' }}>›</span>
      <h1>{pageTitle}</h1>
      <div className="spacer" />
      <span className="chip"><span className="dot" />Live · auto-saving</span>
    </div>
  );
}

export function Stats({ items }: { items: { label: string; value: React.ReactNode; delta: string; variant?: string }[] }) {
  return (
    <div className="stats">
      {items.map((s, i) => (
        <div key={i} className={`stat ${s.variant || ''}`}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value">{s.value}</div>
          <div className="stat-delta">{s.delta}</div>
        </div>
      ))}
    </div>
  );
}
