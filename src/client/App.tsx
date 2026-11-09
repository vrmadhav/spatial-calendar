import { useEffect, useRef, useState } from 'react';
import { calendarSourceSchema, externalAccountSchema, householdSnapshotSchema, sessionResponseSchema, type CalendarEvent, type HouseholdSnapshot, type SessionResponse } from '../shared/contracts';
import { request } from './api';
import { Dialog } from './Dialog';
import { Timeline } from './Timeline';
import { conflictIds, dateLabel, dayNumber, distanceLabel, eventBounds, eventTimeLabel } from './time';

function initials(name: string) { return name.split(' ').slice(0, 2).map((part) => part[0]).join(''); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }

export function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [snapshot, setSnapshot] = useState<HouseholdSnapshot | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    async function load() {
      try {
        const nextSession = await request('/session', sessionResponseSchema, { signal: controller.signal });
        if (!nextSession.households[0]) throw new Error('No household is available for this demo identity.');
        const nextSnapshot = await request(`/households/${nextSession.households[0].id}/snapshot`, householdSnapshotSchema, { signal: controller.signal });
        if (!controller.signal.aborted) { setSession(nextSession); setSnapshot(nextSnapshot); setError(''); }
      } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure)); }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  const base = snapshot ? `/households/${snapshot.household.id}` : '';
  async function mutate(path: string, method: string, body: unknown, kind: 'account' | 'source' | 'delete', success: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    const signal = lifetime.current?.signal;
    let failureMessage = '';
    try {
      if (kind === 'source') await request(base + path, calendarSourceSchema, { method, body, signal });
      else if (kind === 'account') await request(base + path, externalAccountSchema, { method, body, signal });
      else await request(base + path, null, { method, signal });
    } catch (failure) { failureMessage = errorMessage(failure); }
    // Failed sync changes account status, so refresh after both outcomes.
    try {
      const next = await request(`${base}/snapshot`, householdSnapshotSchema, { signal });
      if (!signal?.aborted) setSnapshot(next);
    } catch (failure) { failureMessage = `${failureMessage ? `${failureMessage} ` : ''}Could not refresh the calendar: ${errorMessage(failure)} Your last loaded calendar is still shown.`; }
    if (!signal?.aborted) { setBusy(false); if (failureMessage) setError(failureMessage); else setNotice(success); }
  }
  if (!snapshot || !session) return <main className="loading-screen"><div className="brand-mark">s<span>·</span></div><h1>Space for your family.</h1>{error ? <><p role="alert">{error}</p><button className="primary-button" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Try again</button></> : <p role="status">Bringing your calendars together…</p>}</main>;
  const selected = snapshot.sources.filter((source) => source.selected).length;
  const upcoming = snapshot.events.map((item) => ({ event: item, start: eventBounds(item, snapshot.household.timeZone)[0] })).filter((item) => item.start >= dayNumber(snapshot.today)).sort((a, b) => a.start - b.start).slice(0, 4);
  const conflicts = conflictIds(snapshot.events);
  const eventSource = event ? snapshot.sources.find((source) => source.id === event.sourceId) : null;
  const eventAccount = snapshot.accounts.find((account) => account.id === eventSource?.accountId);
  const canManage = (owner: string) => snapshot.membership.role === 'owner' || (snapshot.membership.role === 'editor' && owner === session.user.id);
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#calendar"><span className="brand-mark">s<span>·</span></span><span>spatial<small>A family calendar</small></span></a>
      <div className="household-label"><span className="household-symbol">⌂</span><div><strong>{snapshot.household.name}</strong><small>Your shared space</small></div><span className="household-caret">⌄</span></div>
      <div className="sidebar-heading"><h2>Your calendars</h2><span>{selected}</span></div>
      <p className="sidebar-description">Different days. One family.</p>
      <div className="source-list">{snapshot.accounts.map((account, index) => <section className="account-sources" key={account.id}>
        <div className="person-heading"><span className={`avatar avatar-${index % 3}`}>{initials(account.displayName)}</span><div><strong>{account.displayName.split(' ')[0]}</strong><small>Google Calendar · Demo</small></div>{account.syncStatus === 'error' && <span className="sync-warning" title={account.error ?? 'Sync failed'} aria-label="Sync needs attention">!</span>}</div>
        {snapshot.sources.filter((source) => source.accountId === account.id).map((source) => <label className="source-option" key={source.id}>
          <input type="checkbox" aria-label={source.name} checked={source.selected} disabled={busy || !snapshot.permissions.canSelectSources} style={{ accentColor: source.color }} onChange={() => void mutate(`/sources/${source.id}`, 'PATCH', { selected: !source.selected }, 'source', 'Calendar selection updated.')} /><span>{source.name}</span>
        </label>)}
      </section>)}</div>
      <button className="connect-button" onClick={() => setAccountsOpen(true)}><span>＋</span> Manage accounts</button>
      <div className="sidebar-note"><span className="orbit-art" aria-hidden="true"><i /><b>✳</b></span><strong>A shared view.<br />A little more headspace.</strong><p>All the moving parts of family life, in one place.</p></div>
      <div className="sidebar-bottom"><span className="avatar avatar-0">{initials(session.user.name)}</span><div><strong>{session.user.name}</strong><small>Demo {snapshot.membership.role}</small></div></div>
    </aside>
    <main id="calendar" className="main-content">
      <header className="page-header"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Toggle calendars" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button><span>YOUR SHARED SPACE</span></div><div className="header-right"><span className="demo-badge"><i />Demo data</span><div className="member-stack" aria-label="Household members">{snapshot.members.slice(0, 3).map((member, i) => <span title={member.name} className={`avatar avatar-${i % 3}`} key={member.id}>{initials(member.name)}</span>)}</div></div></header>
      <section className="page-intro"><div><p className="eyebrow">A LITTLE PERSPECTIVE GOES A LONG WAY</p><h1>Life, all together.</h1><p>Your people. Your plans. Room to see what’s ahead.</p></div><div className="today-summary"><span>{dateLabel(dayNumber(snapshot.today), { weekday: 'long' })}</span><strong>{dateLabel(dayNumber(snapshot.today), { month: 'long', day: 'numeric' })}</strong><small>Make space for a good day.</small></div></section>
      <div className="feedback-area" aria-live="polite">{busy && <p className="feedback" role="status">Updating your shared calendar…</p>}{notice && !busy && <p className="feedback success" role="status">✓ {notice}</p>}{error && <div className="feedback error" role="alert"><span>{error}</span><button onClick={() => { setError(''); setAttempt((value) => value + 1); }} disabled={busy}>Refresh calendar</button></div>}</div>
      <Timeline snapshot={snapshot} onOpen={setEvent} />
      <section className="horizon-section"><div className="section-heading"><h2>On the horizon</h2><span>The next little things, and the big ones.</span></div><div className="upcoming-list">{upcoming.map(({ event: item, start }) => <button className="upcoming-event" key={item.id} onClick={() => setEvent(item)}><span className={`upcoming-icon category-${item.category}`} aria-hidden="true">{item.category === 'travel' ? '↗' : item.category === 'school' ? '▤' : '◇'}</span><span className="upcoming-copy"><strong>{item.title}</strong><small>{dateLabel(start, { weekday: 'short', month: 'short', day: 'numeric' })}{conflicts.has(item.id) ? ' · Overlap' : ''}</small></span><span className="distance-badge">{distanceLabel(start, snapshot.today)}</span><span className="upcoming-arrow" aria-hidden="true">↗</span></button>)}{!upcoming.length && <p className="empty-upcoming">Nothing coming up in your selected calendars. Choose another source or connect a demo account.</p>}</div></section>
      <footer className="page-footer"><span><i className="small-dot" /> {snapshot.accounts.length} accounts · {selected} calendars in view</span><span>Simulated accounts and travel details. Changes reset when the server restarts.</span></footer>
    </main>
    {event && <Dialog title={event.title} onClose={() => setEvent(null)}><div className={`detail-category category-${event.category}`}>{event.category} {conflicts.has(event.id) && ' · Scheduling overlap'}</div><p className="detail-distance">{distanceLabel(eventBounds(event, snapshot.household.timeZone)[0], snapshot.today)}</p><dl className="event-details"><dt>When</dt><dd>{eventTimeLabel(event, snapshot.household.timeZone)}<small>{snapshot.household.timeZone}</small></dd><dt>Where</dt><dd>{event.location || 'No location added'}</dd><dt>Who’s going</dt><dd>{event.participantIds.map((id) => snapshot.members.find((member) => member.id === id)?.name ?? 'Household member').join(', ') || 'No participants added'}</dd><dt>Calendar</dt><dd>{eventSource?.name ?? 'Calendar unavailable'}<small>{eventAccount?.displayName ?? 'Account unavailable'} · Simulated Google account</small></dd><dt>Notes</dt><dd className="notes-text">{event.notes || 'No notes added'}</dd></dl>{event.travel && <section className="travel-details"><p className="eyebrow">SIMULATED TRAVEL DETAILS · {event.travel.kind}</p><h3>{event.travel.summary}</h3><p>{event.travel.details}</p>{event.travel.confirmationCode && <p className="confirmation">Confirmation <strong>{event.travel.confirmationCode}</strong></p>}</section>}<button className="primary-button full-width" onClick={() => setEvent(null)}>Back to the calendar</button></Dialog>}
    {accountsOpen && <Dialog title="A place for every calendar." onClose={() => setAccountsOpen(false)}><p className="dialog-intro">Bring your household together with simulated Google accounts. No sign-in or real data is used.</p><div aria-live="polite">{busy && <p role="status" className="feedback">Updating account…</p>}{error && <p role="alert" className="feedback error">{error}</p>}{notice && !busy && <p role="status" className="feedback success">{notice}</p>}</div><div className="manage-accounts">{session.profiles.map((profile) => {
      const account = snapshot.accounts.find((item) => item.profileId === profile.id);
      const allowed = canManage(profile.ownerUserId);
      return <section className="manage-account" key={profile.id}><div className="person-heading"><span className="avatar avatar-1">{initials(profile.name)}</span><div><strong>{profile.name}</strong><small>{profile.email}</small></div><span className={`account-status ${account?.syncStatus === 'error' ? 'failed' : ''}`}>{account ? account.syncStatus === 'error' ? 'Needs attention' : 'Connected' : 'Available'}</span></div>{account ? <><p className="sync-description">{account.error ?? (account.lastSyncedAt ? `Last synced ${new Intl.DateTimeFormat('en-US', { timeZone: snapshot.household.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(account.lastSyncedAt))}` : 'Ready to sync')}</p><div className="account-actions"><button disabled={busy || !allowed} onClick={() => void mutate(`/accounts/${account.id}/sync`, 'POST', {}, 'account', `${profile.name.split(' ')[0]}’s calendars are up to date.`)}>{account.syncStatus === 'error' ? 'Retry sync' : 'Sync now'}</button><button className="subtle-button" disabled={busy || !allowed} onClick={() => void mutate(`/accounts/${account.id}`, 'DELETE', undefined, 'delete', `${profile.name.split(' ')[0]}’s account disconnected.`)}>Disconnect</button></div><details className="demo-tools"><summary>Demo tools</summary><button disabled={busy || !allowed} onClick={() => void mutate(`/accounts/${account.id}/sync`, 'POST', { simulateFailure: true }, 'account', 'Sync complete.')}>Simulate sync failure</button></details></> : <button className="primary-button" disabled={busy || !snapshot.permissions.canConnectAccounts || !allowed} onClick={() => void mutate('/accounts', 'POST', { profileId: profile.id }, 'account', `${profile.name.split(' ')[0]}’s account connected.`)}>Connect {profile.name.split(' ')[0]}’s demo account</button>}</section>;
    })}</div><p className="account-footnote">Source selection is shared with your household. Disconnecting removes that account’s calendars and events; you can reconnect anytime.</p></Dialog>}
  </div>;
}
