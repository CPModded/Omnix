'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from './DashboardShell';
import { MODULE_DETAILS } from './types';
import { OmnixIcon } from './OmnixIcon';

type Props = { guildId: string; moduleId: string };
type Field = { key: string; label: string; hint?: string; type?: 'text' | 'textarea' | 'number' | 'boolean'; placeholder?: string };

const MODULE_FIELDS: Record<string, Field[]> = {
  goodbye: [
    { key: 'channelId', label: 'Salon de départ' },
    { key: 'title', label: 'Titre du message' },
    { key: 'message', label: 'Message de départ', type: 'textarea' },
    { key: 'color', label: 'Couleur de l’embed', placeholder: '#8B5CF6' },
    { key: 'embed', label: 'Utiliser un embed', type: 'boolean' },
  ],
  welcome: [
    { key: 'channelId', label: 'Salon de bienvenue', hint: 'Identifiant du salon Discord.' },
    { key: 'title', label: 'Titre du message' },
    { key: 'message', label: 'Message de bienvenue', type: 'textarea', hint: 'Le texte du message envoyé aux nouveaux membres.' },
    { key: 'color', label: 'Couleur de l’embed', placeholder: '#8B5CF6' },
    { key: 'imageUrl', label: 'Image personnalisée', placeholder: 'https://…' },
    { key: 'mentionUser', label: 'Mentionner le membre', type: 'boolean' },
    { key: 'embed', label: 'Utiliser un embed', type: 'boolean' },
  ],
  moderation: [
    { key: 'logChannelId', label: 'Salon des logs de modération' },
    { key: 'muteRoleId', label: 'Rôle de modération / muet' },
    { key: 'defaultReason', label: 'Raison par défaut', type: 'textarea' },
    { key: 'autoModeration', label: 'Activer la modération automatique', type: 'boolean' },
    { key: 'deleteCommandMessages', label: 'Supprimer les messages de commande', type: 'boolean' },
  ],
  tickets: [
    { key: 'panelChannelId', label: 'Salon du panneau de tickets' },
    { key: 'categoryId', label: 'Catégorie Discord' },
    { key: 'supportRoleId', label: 'Rôle du support' },
    { key: 'transcriptChannelId', label: 'Salon des transcriptions' },
    { key: 'logChannelId', label: 'Salon des logs' },
    { key: 'maxOpenPerUser', label: 'Tickets ouverts maximum par membre', type: 'number' },
    { key: 'panelText', label: 'Texte du panneau', type: 'textarea' },
  ],
  automod: [
    { key: 'badWords', label: 'Mots interdits', type: 'textarea', hint: 'Un mot ou une expression par ligne.' },
    { key: 'maxMentions', label: 'Mentions maximum', type: 'number' },
    { key: 'maxCapsPercentage', label: 'Pourcentage maximum de majuscules', type: 'number' },
    { key: 'antiInvites', label: 'Bloquer les invitations Discord', type: 'boolean' },
    { key: 'antiRepeat', label: 'Bloquer les messages répétitifs', type: 'boolean' },
    { key: 'deleteMessages', label: 'Supprimer les messages détectés', type: 'boolean' },
  ],
  'anti-raid': [
    { key: 'threshold', label: 'Nombre de comptes', type: 'number' },
    { key: 'timeWindow', label: 'Fenêtre de détection (ms)', type: 'number' },
    { key: 'action', label: 'Action (alert / kick / ban)' },
  ],
  'anti-spam': [
    { key: 'maxMessages', label: 'Messages maximum', type: 'number' },
    { key: 'timeWindow', label: 'Fenêtre de temps (ms)', type: 'number' },
    { key: 'muteDuration', label: 'Durée de restriction (ms)', type: 'number' },
  ],
  'anti-link': [
    { key: 'whitelist', label: 'Domaines autorisés', type: 'textarea', hint: 'Un domaine par ligne.' },
    { key: 'action', label: 'Action (delete / warn / block)' },
  ],
  security: [
    { key: 'level', label: 'Niveau (low / normal / high / maximum)' },
    { key: 'lockdown', label: 'Verrouillage du serveur', type: 'boolean' },
  ],
  verification: [
    { key: 'channelId', label: 'Salon de vérification' },
    { key: 'verifiedRoleId', label: 'Rôle vérifié' },
    { key: 'logChannelId', label: 'Salon des logs' },
  ],
  honeypot: [{ key: 'channelId', label: 'Salon Honeypot' }],
  'auto-role': [
    { key: 'roleId', label: 'Rôle à attribuer' },
    { key: 'botRoleId', label: 'Rôle pour les bots' },
    { key: 'humanOnly', label: 'Membres humains uniquement', type: 'boolean' },
  ],
  suggestions: [
    { key: 'channelId', label: 'Salon des suggestions' },
    { key: 'staffChannelId', label: 'Salon du staff' },
    { key: 'allowAnonymous', label: 'Autoriser les suggestions anonymes', type: 'boolean' },
  ],
  polls: [{ key: 'channelId', label: 'Salon des sondages' }],
  giveaways: [
    { key: 'logChannelId', label: 'Salon des logs' },
    { key: 'defaultDuration', label: 'Durée par défaut (ms)', type: 'number' },
  ],
  levels: [
    { key: 'xpPerMessage', label: 'XP par message', type: 'number' },
    { key: 'cooldown', label: 'Temps entre gains XP (ms)', type: 'number' },
    { key: 'levelUpChannelId', label: 'Salon des passages de niveau' },
    { key: 'levelUpMessage', label: 'Message de niveau supérieur', type: 'textarea' },
  ],
  counting: [{ key: 'channelId', label: 'Salon du compteur' }],
  statistics: [
    { key: 'channelId', label: 'Salon des statistiques' },
    { key: 'updateInterval', label: 'Intervalle de mise à jour (ms)', type: 'number' },
  ],
  ping: [{ key: 'channelId', label: 'Salon du statut' }],
  economy: [
    { key: 'currencyName', label: 'Nom de la monnaie' },
    { key: 'currencySymbol', label: 'Symbole de la monnaie' },
    { key: 'startingBalance', label: 'Solde de départ', type: 'number' },
    { key: 'dailyReward', label: 'Récompense quotidienne', type: 'number' },
    { key: 'weeklyReward', label: 'Récompense hebdomadaire', type: 'number' },
  ],
  shop: [{ key: 'currencyName', label: 'Monnaie utilisée' }],
  ai: [
    { key: 'channelId', label: 'Salon de l’assistant IA' },
    { key: 'model', label: 'Modèle IA' },
    { key: 'maxTokens', label: 'Limite de tokens', type: 'number' },
    { key: 'maxHistoryMessages', label: 'Messages de contexte', type: 'number' },
    { key: 'systemPrompt', label: 'Instructions de l’assistant', type: 'textarea' },
  ],
  backups: [
    { key: 'automatic', label: 'Sauvegardes automatiques', type: 'boolean' },
    { key: 'interval', label: 'Intervalle (ms)', type: 'number' },
    { key: 'retention', label: 'Nombre de sauvegardes conservées', type: 'number' },
  ],
  logs: [
    { key: 'joins', label: 'Arrivées', type: 'boolean' },
    { key: 'leaves', label: 'Départs', type: 'boolean' },
    { key: 'moderation', label: 'Modération', type: 'boolean' },
    { key: 'tickets', label: 'Tickets', type: 'boolean' },
    { key: 'security', label: 'Sécurité', type: 'boolean' },
    { key: 'errors', label: 'Erreurs', type: 'boolean' },
    { key: 'bot', label: 'Activité du bot', type: 'boolean' },
  ],
};

const MODULE_KEYS: Record<string, string> = { automod: 'autoMod', 'anti-raid': 'antiRaid', 'anti-spam': 'antiSpam', 'anti-link': 'antiLink', 'auto-role': 'autoRole', 'reaction-roles': 'reactionRoles', 'auto-reactions': 'autoReactions', 'scheduled-messages': 'scheduledMessages', 'custom-commands': 'customCommands' };

export default function ModulePage({ guildId, moduleId }: Props) {
  const detail = MODULE_DETAILS[moduleId] || MODULE_DETAILS.general;
  const moduleKey = MODULE_KEYS[moduleId] || moduleId;
  const [guild, setGuild] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [general, setGeneral] = useState<Record<string, any>>({ locale: 'fr', prefix: '/', maintenance: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/guilds/${encodeURIComponent(guildId)}`, { credentials: 'same-origin', cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Serveur inaccessible'); return d; }),
      fetch(`/api/guilds/${encodeURIComponent(guildId)}/config`, { credentials: 'same-origin', cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok || d.success === false) throw new Error(d.error || 'Configuration inaccessible'); return d; }),
    ]).then(([serverData, config]) => {
      if (!alive) return;
      setGuild(serverData.guild || null);
      const moduleData = config?.modules?.[moduleKey] || {};
      setForm({ ...moduleData, badWords: Array.isArray(moduleData.badWords) ? moduleData.badWords.join('\n') : (moduleData.badWords || ''), whitelist: Array.isArray(moduleData.whitelist) ? moduleData.whitelist.join('\n') : (moduleData.whitelist || '') });
      setGeneral({ locale: config?.locale || 'fr', prefix: config?.prefix || '/', maintenance: Boolean(config?.maintenance) });
    }).catch(e => { if (alive) setError(e.message || 'Erreur de chargement.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [guildId, moduleKey]);

  const fields = MODULE_FIELDS[moduleId] || [];
  const suggestions = useMemo(() => { const items = Object.entries(MODULE_DETAILS).filter(([id]) => id !== moduleId); for (let i = items.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items.slice(0, 4); }, [moduleId]);
  const isGeneral = moduleId === 'general' || moduleId === 'settings';
  const updateField = (key: string, value: any) => setForm(current => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      let payload: any;
      if (isGeneral) payload = general;
      else {
        const normalized = { ...form };
        if (moduleId === 'automod' && typeof normalized.badWords === 'string') normalized.badWords = normalized.badWords.split('\n').map((v: string) => v.trim()).filter(Boolean);
        if (moduleId === 'anti-link' && typeof normalized.whitelist === 'string') normalized.whitelist = normalized.whitelist.split('\n').map((v: string) => v.trim()).filter(Boolean);
        if (moduleId === 'security') delete normalized.enabled;
        payload = { modules: { [moduleKey]: normalized } };
      }
      const response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}/config`, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(result.error || 'La sauvegarde a échoué.');
      if (result.config?.modules?.[moduleKey]) setForm(current => ({ ...current, ...result.config.modules[moduleKey], badWords: Array.isArray(result.config.modules[moduleKey].badWords) ? result.config.modules[moduleKey].badWords.join('\n') : current.badWords }));
      setSuccess('Modifications enregistrées.');
    } catch (e: any) { setError(e.message || 'Impossible d’enregistrer les modifications.'); }
    finally { setSaving(false); }
  };

  const enabled = Boolean(form.enabled);
  const statusLabel = useMemo(() => enabled ? 'Activé' : 'Désactivé', [enabled]);

  return <DashboardShell guildId={guildId}>
    <div className="page-heading module-heading"><div><div className="eyebrow"><Link href={`/dashboard/${guildId}`}>SERVEUR</Link><span> / </span>{detail.category.toUpperCase()}</div><h1>{detail.title}</h1><p>{detail.description}</p></div><div className="heading-actions"><Link className="outline-button" href={`/dashboard/${guildId}`}><OmnixIcon name="home" size={14}/> Accueil du serveur</Link><Link className="outline-button" href="/dashboard"><OmnixIcon name="grid" size={14}/> Liste des serveurs</Link></div></div>
    {error && <div className="notice error-notice"><strong>Une erreur est survenue</strong><span>{error}</span></div>}
    {success && <div className="notice success-notice"><strong>Enregistré</strong><span>{success}</span></div>}
    {loading ? <div className="module-panel"><div className="loading-line"/><div className="loading-line short"/></div> : <>
      {!guild?.botPresent && <div className="notice warning-notice"><strong>Omnix n’est pas connecté à ce serveur</strong><span>Ajoutez le bot pour activer ses modules et appliquer les réglages.</span>{guild?.inviteUrl && <a href={guild.inviteUrl}>Ajouter Omnix ↗</a>}</div>}
      <section className="module-panel"><div className="module-panel-top"><div><div className="panel-kicker">CONFIGURATION DU MODULE</div><h2>{isGeneral ? (guild?.name || 'Serveur') : detail.title}</h2><p>{isGeneral ? 'Informations et réglages généraux de ce serveur.' : 'Les modifications sont enregistrées dans la configuration Omnix existante.'}</p></div>{!isGeneral && moduleId !== 'security' && <label className={`module-pill ${enabled ? 'enabled' : 'disabled'}`}><i/>{statusLabel}<input className="visually-hidden" type="checkbox" checked={enabled} onChange={e => updateField('enabled', e.target.checked)}/></label>}</div>
        {isGeneral ? <div className="form-grid"><div className="form-field"><label>Préfixe</label><input value={general.prefix} maxLength={10} onChange={e => setGeneral(v => ({...v,prefix:e.target.value}))}/></div><div className="form-field"><label>Langue</label><select value={general.locale} onChange={e => setGeneral(v => ({...v,locale:e.target.value}))}><option value="fr">Français</option><option value="en">English</option><option value="de">Deutsch</option></select></div><div className="form-field full"><label className="check-field"><input type="checkbox" checked={general.maintenance} onChange={e => setGeneral(v => ({...v,maintenance:e.target.checked}))}/> Maintenance du serveur</label></div><div className="server-meta"><span>Identifiant Discord</span><code>{guildId}</code><span>État du bot</span><strong>{guild?.botPresent ? 'Connecté' : 'Non connecté'}</strong></div></div> : <div className="form-grid">{fields.map(field => <div className={`form-field ${field.type === 'textarea' ? 'full' : ''}`} key={field.key}>{field.type === 'boolean' ? <label className="check-field"><input type="checkbox" checked={Boolean(form[field.key])} onChange={e => updateField(field.key,e.target.checked)}/>{field.label}</label> : <><label>{field.label}</label>{field.type === 'textarea' ? <textarea rows={4} value={String(form[field.key] ?? '')} placeholder={field.placeholder || ''} onChange={e => updateField(field.key,e.target.value)}/> : <input type={field.type === 'number' ? 'number' : 'text'} value={form[field.key] ?? ''} placeholder={field.placeholder || ''} onChange={e => updateField(field.key,field.type === 'number' ? Number(e.target.value) : e.target.value)}/>}</>}{field.hint && <small>{field.hint}</small>}</div>)}</div>}
        <div className="form-actions"><span>Les droits et limites Premium restent contrôlés côté serveur.</span><button className="primary-button" onClick={() => void save()} disabled={saving || !guild?.botPresent}>{saving ? <><span className="button-spinner"/> Enregistrement…</> : <>Enregistrer les modifications <OmnixIcon name="arrow" size={15}/></>}</button></div>
      </section>
      <section className="module-shortcuts"><h2>Autres modules</h2><div className="shortcut-grid">{suggestions.map(([id, item]) => <Link key={id} href={`/dashboard/${guildId}/${id}`} className="shortcut-card"><span>{item.category}</span><strong>{item.title}</strong><i><OmnixIcon name="arrow" size={15}/></i></Link>)}</div></section>
    </>}
  </DashboardShell>;
}
