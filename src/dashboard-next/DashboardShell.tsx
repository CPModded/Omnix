'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MODULES, OmnixGuild } from './types';
import { OmnixIcon } from './OmnixIcon';

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
    // Le niveau Premium vient de la configuration serveur réelle, pas d'un
    // badge supposé côté navigateur.
    fetch(`/api/guilds/${encodeURIComponent(guildId)}/config`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async r => { const data = await r.json(); if (!r.ok || data.success === false) return null; return data; })
      .then(config => { if (alive && config) setGuild(current => current ? { ...current, premium: Boolean(config.premium?.isPremium || (config.plan && config.plan !== 'free')) } : current); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [guildId]);
  const activeModule = useMemo(() => MODULES.find(m => pathname?.endsWith(`/${m.id}`))?.id || 'general', [pathname]);
  const isAdministrator = Boolean(guild?.administrator || (guild?.permissions && (BigInt(guild.permissions) & 8n) === 8n));

  return <div className="omni-app">
    {mobileOpen && <button className="sidebar-backdrop" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`omni-sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <Link href="/dashboard" className="omni-brand" onClick={() => setMobileOpen(false)}><span className="brand-mark">O</span><span><b>OMNIX</b><small>CONTROL CENTER</small></span></Link>
      <div className="sidebar-caption">ESPACE PERSONNEL</div>
      <Link href="/dashboard" className={`side-link ${!guildId ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><OmnixIcon name="grid"/> Mes serveurs</Link>
      {guildId && <>
        <div className="guild-context">
          <div className="guild-context-icon">{guild?.icon ? <img src={iconUrl(guild) || undefined} alt="" /> : (guild?.name || 'S').slice(0, 1).toUpperCase()}</div>
          <div className="guild-context-copy"><small>SERVEUR ACTUEL</small><strong>{guild?.name || 'Chargement…'}</strong><div className="role-badges">{guild?.owner ? <span className="role-badge owner"><OmnixIcon name="crown" size={11}/> OWNER</span> : isAdministrator ? <span className="role-badge admin"><OmnixIcon name="shield" size={11}/> ADMIN</span> : null}<span className={`role-badge ${guild?.premium ? 'premium' : 'free'}`}>{guild?.premium ? 'PREMIUM' : 'FREE'}</span></div></div>
        </div>
        <div className="sidebar-shortcuts"><Link href={`/dashboard/${guildId}`} onClick={() => setMobileOpen(false)}><OmnixIcon name="home" size={14}/> Accueil du serveur</Link><Link href="/dashboard" onClick={() => setMobileOpen(false)}><OmnixIcon name="grid" size={14}/> Liste des serveurs</Link></div>
        <div className="sidebar-caption">CONFIGURATION</div>
        {MODULES.map(module => <Link key={module.id} href={`/dashboard/${guildId}/${module.id}`} className={`side-link ${activeModule === module.id ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><OmnixIcon name={module.icon} size={16}/>{module.label}</Link>)}
      </>}
      <div className="sidebar-bottom"><span className="status-dot" /> Omnix opérationnel <small>V3.6.4</small></div>
    </aside>
    <div className="omni-main">
      <header className="omni-topbar"><button className="mobile-toggle" onClick={() => setMobileOpen(v => !v)} aria-label="Ouvrir le menu"><OmnixIcon name="grid" size={19}/></button><div className="breadcrumb"><Link href="/dashboard">Omnix</Link><span>/</span>{guildId ? (guild?.name || 'Serveur') : 'Mes serveurs'}</div><div className="topbar-actions"><Link className="topbar-action" href="/dashboard"><OmnixIcon name="grid" size={14}/> Serveurs</Link>{guildId && <Link className="topbar-action" href={`/dashboard/${guildId}`}><OmnixIcon name="home" size={14}/> Accueil</Link>}<a className="topbar-action" href="https://discord.com" target="_blank" rel="noreferrer">Discord <OmnixIcon name="arrow" size={13}/></a></div></header>
      <main className="omni-content">{children}</main>
    </div>
  </div>;
}
