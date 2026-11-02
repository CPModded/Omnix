'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MODULES, OmnixGuild } from './types';

const iconUrl = (guild: OmnixGuild) => guild.icon?.startsWith('http') ? guild.icon : guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : '';

export function DashboardShell({ children, guildId }: { children: React.ReactNode; guildId?: string }) {
  const pathname = usePathname();
  const [guild, setGuild] = useState<OmnixGuild | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    let alive = true;
    fetch(`/api/guilds/${encodeURIComponent(guildId)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Serveur inaccessible'); return data; })
      .then(data => { if (alive) setGuild(data.guild || null); })
      .catch(() => { if (alive) setGuild(null); });
    return () => { alive = false; };
  }, [guildId]);

  const activeModule = useMemo(() => MODULES.find(m => pathname?.endsWith(`/${m.id}`))?.id || 'general', [pathname]);

  return <div className="omni-app">
    <aside className={`omni-sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <Link href="/dashboard" className="omni-brand"><span className="brand-mark">O</span><span><b>OMNIX</b><small>CONTROL CENTER</small></span></Link>
      <div className="sidebar-caption">ESPACE DE GESTION</div>
      <Link href="/dashboard" className={`side-link ${!guildId ? 'active' : ''}`}><span>▦</span> Mes serveurs</Link>
      {guildId && <>
        <div className="guild-context">
          <div className="guild-context-icon">{guild?.icon ? <img src={iconUrl(guild) || undefined} alt="" /> : (guild?.name || 'S').slice(0, 1).toUpperCase()}</div>
          <div className="guild-context-copy"><small>SERVEUR ACTUEL</small><strong>{guild?.name || 'Chargement…'}</strong></div>
        </div>
        <div className="sidebar-caption">CONFIGURATION</div>
        {MODULES.map(module => <Link key={module.id} href={`/dashboard/${guildId}/${module.id}`} className={`side-link ${activeModule === module.id ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><span>{module.icon}</span>{module.label}</Link>)}
      </>}
      <div className="sidebar-bottom"><span className="status-dot" /> Omnix opérationnel <small>V3.6.4</small></div>
    </aside>
    <div className="omni-main">
      <header className="omni-topbar"><button className="mobile-toggle" onClick={() => setMobileOpen(v => !v)} aria-label="Ouvrir le menu">☰</button><div className="breadcrumb">Omnix <span>/</span> {guildId ? (guild?.name || 'Serveur') : 'Mes serveurs'}</div><a className="topbar-link" href="https://discord.com" target="_blank" rel="noreferrer">Discord ↗</a></header>
      <main className="omni-content">{children}</main>
    </div>
  </div>;
}
