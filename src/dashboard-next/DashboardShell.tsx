'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MODULES, OmnixGuild } from './types';

type CommandEvent = {
  _id: string;
  type: string;
  createdAt: string;
  metadata?: { command?: string; executionId?: string; durationMs?: number };
};

type CommandActivityRow = {
  id: string;
  command: string;
  status: 'running' | 'success' | 'blocked' | 'error' | 'stale';
  createdAt: string;
  durationMs?: number;
};

function CommandActivity({ guildId }: { guildId: string }) {
  const [events, setEvents] = useState<CommandEvent[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}/activity?scope=commands`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (alive && Array.isArray(payload.data)) setEvents(payload.data);
      } catch {
        // L’activité est informative : une panne de cette requête ne doit
        // jamais bloquer le chargement du dashboard.
      }
    };
    void load();
    const timer = setInterval(() => void load(), 3500);
    return () => { alive = false; clearInterval(timer); };
  }, [guildId]);

  const rows = useMemo<CommandActivityRow[]>(() => {
    const finals = new Map<string, CommandEvent>();
    for (const event of events) {
      if (!['command_executed', 'command_blocked', 'command_error'].includes(event.type)) continue;
      const id = String(event.metadata?.executionId || '');
      if (id && !finals.has(id)) finals.set(id, event);
    }

    return events
      .filter(event => event.type === 'command_started')
      .map(event => {
        const id = String(event.metadata?.executionId || event._id);
        const finalEvent = finals.get(id);
        const age = Date.now() - new Date(event.createdAt).getTime();
        let status: CommandActivityRow['status'] = 'running';
        if (finalEvent?.type === 'command_executed') status = 'success';
        else if (finalEvent?.type === 'command_blocked') status = 'blocked';
        else if (finalEvent?.type === 'command_error') status = 'error';
        else if (age > 60000) status = 'stale';
        return {
          id,
          command: String(event.metadata?.command || 'commande'),
          status,
          createdAt: event.createdAt,
          durationMs: finalEvent?.metadata?.durationMs,
        };
      })
      .slice(0, 5);
  }, [events]);

  if (!rows.length) return null;

  const statusLabels = { running: 'En cours', success: 'Terminée', blocked: 'Bloquée', error: 'Erreur', stale: 'État inconnu' };
  return <section className="command-activity" aria-live="polite" aria-label="Activité récente des commandes Discord">
    <div className="command-activity-heading">
      <div><span className="activity-live-dot"/><strong>Exécution des commandes</strong><small>Synchronisation en direct</small></div>
      <span className="activity-refresh-label">Actualisation automatique</span>
    </div>
    <div className="command-activity-list">
      {rows.map(row => <div className={`command-activity-row ${row.status}`} key={row.id}>
        <span className="command-activity-indicator">{row.status === 'running' ? <i className="activity-spinner"/> : row.status === 'success' ? '✓' : row.status === 'blocked' ? '!' : row.status === 'error' ? '×' : '·'}</span>
        <span className="command-activity-name">/{row.command}</span>
        <span className="command-activity-status">{statusLabels[row.status]}</span>
        <time>{new Date(row.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
      </div>)}
    </div>
  </section>;
}

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
      {guildId && <CommandActivity guildId={guildId} />}
      <main className="omni-content">{children}</main>
    </div>
  </div>;
}
