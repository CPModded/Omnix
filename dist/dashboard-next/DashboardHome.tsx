'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from './DashboardShell';
import type { OmnixGuild } from './types';
import { OmnixIcon } from './OmnixIcon';

function ServerCard({ guild }: { guild: OmnixGuild }) {
  const image = guild.icon?.startsWith('http') ? guild.icon : guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : '';
  return <article className="server-card">
    <div className="server-card-head"><div className="server-avatar">{image ? <img src={image} alt="" /> : guild.name.slice(0,1).toUpperCase()}</div><div className="server-title"><h3>{guild.name}</h3><span>{Number(guild.memberCount || 0).toLocaleString('fr-FR')} membres</span></div><span className={`server-state ${guild.blacklisted ? 'danger' : guild.botPresent ? 'online' : 'offline'}`}><i />{guild.blacklisted ? 'Restreint' : guild.botPresent ? 'Connecté' : 'À connecter'}</span></div>
    <div className="server-card-foot">{guild.blacklisted ? <span className="muted">Accès limité par Omnix</span> : guild.botPresent ? <Link className="primary-button" href={`/dashboard/${guild.id}`}>Gérer le serveur <OmnixIcon name="arrow" size={15}/></Link> : <a className="primary-button" href={guild.inviteUrl || `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '')}&scope=bot%20applications.commands&guild_id=${guild.id}`}>Ajouter Omnix <OmnixIcon name="arrow" size={15}/></a>}</div>
  </article>;
}

export default function DashboardHome() {
  const [guilds, setGuilds] = useState<OmnixGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    try {
      setError('');
      const response = await fetch(`/api/guilds${refresh ? '?refresh=1' : ''}`, { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.error || 'Impossible de récupérer les serveurs.');
      setGuilds(Array.isArray(data.guilds) ? data.guilds : []);
    } catch (e: any) { setError(e?.message || 'Une erreur est survenue.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { void load(true); }, []);
  const filtered = useMemo(() => guilds.filter(g => g.name.toLowerCase().includes(query.toLowerCase())), [guilds, query]);
  const connected = guilds.filter(g => g.botPresent && !g.blacklisted).length;

  return <DashboardShell>
    <section className="page-heading"><div><div className="eyebrow">VOTRE ESPACE OMNIX</div><h1>Mes serveurs</h1><p>Retrouvez vos serveurs Discord et gérez Omnix depuis un seul endroit.</p></div><button className="outline-button" onClick={() => { setRefreshing(true); void load(true); }} disabled={refreshing}>{refreshing ? 'Actualisation…' : <><OmnixIcon name="clock" size={14}/> Actualiser</>}</button></section>
    <section className="stats-grid"><div className="stat-card"><span>Serveurs accessibles</span><strong>{loading ? '—' : guilds.length}</strong><small>Serveurs administrables</small></div><div className="stat-card"><span>Omnix connecté</span><strong>{loading ? '—' : connected}</strong><small>Bot présent sur le serveur</small></div><div className="stat-card"><span>À configurer</span><strong>{loading ? '—' : guilds.filter(g => !g.botPresent && !g.blacklisted).length}</strong><small>Ajoutez Omnix pour commencer</small></div></section>
    <section className="servers-section"><div className="section-heading"><div><h2>Vos espaces</h2><p>Sélectionnez un serveur pour ouvrir son tableau de bord.</p></div><div className="search-wrap"><OmnixIcon name="search" size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un serveur…" /></div></div>
      {error && <div className="notice error-notice"><strong>Chargement impossible</strong><span>{error}</span><button onClick={() => { setLoading(true); void load(true); }}>Réessayer</button></div>}
      {loading ? <div className="server-grid">{[1,2,3].map(n => <div className="server-skeleton" key={n}><div /><span /><span /></div>)}</div> : filtered.length ? <div className="server-grid">{filtered.map(g => <ServerCard guild={g} key={g.id} />)}</div> : <div className="empty-state"><div className="empty-icon"><OmnixIcon name="grid" size={22}/></div><h3>{query ? 'Aucun résultat' : 'Aucun serveur disponible'}</h3><p>{query ? 'Essayez un autre nom de serveur.' : 'Vérifiez que vous êtes propriétaire, administrateur ou disposez de la permission « Gérer le serveur » sur un serveur Discord.'}</p>{!query && <a className="primary-button" href="/api/auth/login">Reconnecter Discord</a>}</div>}
    </section>
  </DashboardShell>;
}
