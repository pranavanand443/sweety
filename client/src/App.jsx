import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowDown, ArrowRight, ArrowUp, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Droplet, Heart, LayoutDashboard, LoaderCircle, LogOut, Moon, Pencil, Plus, ShieldCheck, Sun, Sunrise, Trash2, TrendingUp, X } from 'lucide-react';
import { SLOTS, isValidDate } from '../../shared/domain.js';
import { api } from './api.js';
import ReadingForm from './ReadingForm.jsx';

const SLOT_ICONS = [Sunrise, Sun, Sun, Moon];
const REPORT_TABS = [{ value: 'daily', label: 'Daily' }, { value: 'monthToDate', label: 'Month to date' }, { value: 'previousMonth', label: 'Previous month' }];

function formatDate(date, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function shiftDate(date, days) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function Brand({ compact = false }) {
  return <span className={`brand ${compact ? 'brand-small' : ''}`}><span className="brand-icon" aria-hidden="true"><Droplet size={24} strokeWidth={1.8} /><span /></span><span>sweety<span className="brand-period">.</span></span></span>;
}

function Modal({ title, description, children, onClose, busy = false, kind = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={`modal ${kind}`} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="dialog-title" aria-describedby="dialog-description" aria-busy={busy}>
    <div className="modal-header"><div className="modal-symbol"><Droplet size={22} /></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={20} /></button></div>
    <h2 id="dialog-title">{title}</h2><p className="modal-description" id="dialog-description">{description}</p>{children}
  </dialog>;
}

function Auth({ onAuthenticated }) {
  const location = useLocation();
  const signup = location.pathname === '/signup';
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await api(`/auth/${signup ? 'register' : 'login'}`, { method: 'POST', body: values });
      onAuthenticated(result);
    } catch (failure) { setError(failure.message || 'We couldn’t connect. Please try again.'); }
    finally { setBusy(false); }
  }

  function useDemo() { setValues({ name: '', email: 'demo@sweety.example', password: 'SweetyDemo123!' }); setError(''); }

  return <main className="auth-page">
    <section className="auth-form-side">
      <Link className="auth-brand" to="/login" aria-label="Sweety sign in"><Brand /></Link>
      <div className="auth-form-wrap" key={signup ? 'signup' : 'login'}>
        <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
        <h1>{signup ? 'A fresh start to\nbetter tracking.' : 'Welcome back.'}</h1>
        <p className="auth-intro">{signup ? 'Create your space for simple, everyday glucose tracking.' : 'Your daily check-in starts here. Let’s pick up where you left off.'}</p>
        <form onSubmit={submit} className="auth-form">
          {signup && <div className="field"><label htmlFor="auth-name">Full name</label><input id="auth-name" autoComplete="name" required maxLength={100} placeholder="Your name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} disabled={busy} /></div>}
          <div className="field"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required placeholder="you@example.com" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} disabled={busy} /></div>
          <div className="field"><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required placeholder={signup ? 'Create a password' : 'Enter your password'} value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} disabled={busy} />{signup && <p className="field-hint">Use at least 8 characters.</p>}</div>
          {error && <div role="alert" className="error-banner">{error}</div>}
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle size={19} className="spin" /> : null}{busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}{!busy && <ArrowRight size={18} />}</button>
        </form>
        <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Sweety?'} <Link to={signup ? '/login' : '/signup'} onClick={() => setError('')}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
        {!signup && <div className="demo-login"><span>Just taking a look?</span><button onClick={useDemo} type="button" disabled={busy}>Fill demo account <ArrowRight size={14} /></button><p>Explore with fictional sample readings.</p></div>}
      </div>
      <p className="auth-footer"><ShieldCheck size={15} /> Your readings. Your private space.</p>
    </section>
    <section className="auth-story" aria-label="About Sweety">
      <span className="story-tag"><Heart size={14} /> Made for your everyday</span>
      <div className="auth-art" aria-hidden="true">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="art-leaf leaf-one" /><div className="art-leaf leaf-two" />
        <div className="art-chart"><div className="art-chart-top"><span className="art-mini-icon"><Activity size={18} /></span><span>Your daily picture<small>One reading at a time</small></span><span className="art-dots">···</span></div><div className="art-chart-value">A clearer view<span>of your everyday</span></div><svg viewBox="0 0 320 100" fill="none"><path d="M0 80H320M0 40H320" stroke="#edf0ed" strokeDasharray="4 4"/><path d="M5 68C30 68 30 44 55 44S80 60 105 60S130 25 155 25S180 45 205 45S230 15 255 15S285 34 315 28" stroke="#2e8e79" strokeWidth="3" strokeLinecap="round"/><circle cx="255" cy="15" r="6" fill="#2e8e79" stroke="white" strokeWidth="3"/></svg><div className="art-chart-days"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div></div>
        <div className="art-saved"><span><Check size={18} /></span><div>A moment for you<small>Small habits. More clarity.</small></div></div>
        <div className="art-sun"><Sun size={34} strokeWidth={1.3} /></div>
      </div>
      <div className="story-copy"><h2>A little check-in.<br />A clearer picture.</h2><p>Simple glucose tracking that fits into your day.<br />Record your readings, see your patterns,<br />and keep moving forward.</p></div>
      <div className="story-bottom"><span className="story-dot" /> SIMPLE BY DESIGN. THOUGHTFUL BY NATURE.</div>
    </section>
  </main>;
}

function DatePicker({ date, today, onChange }) {
  return <div className="date-picker"><button className="icon-button" aria-label="Previous day" onClick={() => onChange(shiftDate(date, -1))}><ChevronLeft size={17} /></button><label className="date-label"><CalendarDays size={17} /><span>{date === today ? 'Today' : formatDate(date, { day: 'numeric', month: 'short' })}<small>{formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })}</small></span><input aria-label="Selected date" type="date" value={date} max={today} onChange={(event) => { if (isValidDate(event.target.value) && event.target.value <= today) onChange(event.target.value); }} /></label><button className="icon-button" aria-label="Next day" disabled={date >= today} onClick={() => onChange(shiftDate(date, 1))}><ChevronRight size={17} /></button></div>;
}

function ReadingTable({ readings, onEdit, onDelete, onAdd, readOnly = false }) {
  if (!readings.length) return <div className="empty-state"><span className="empty-icon"><ClipboardList size={26} strokeWidth={1.5} /></span><h3>A fresh page for your day</h3><p>Your readings will appear here once you add them.<br />Start with a small check-in.</p>{onAdd && <button className="button button-secondary" onClick={onAdd}><Plus size={16} /> Add your first reading</button>}</div>;
  return <div className="table-wrap"><table className="reading-table"><thead><tr><th>TIME SLOT</th><th>GLUCOSE</th><th>DATE</th>{!readOnly && <th><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{readings.map((reading) => { const index = SLOTS.findIndex((item) => item.value === reading.slot); const Icon = SLOT_ICONS[index]; return <tr key={reading.id}><td><span className="table-slot"><span className={`tiny-slot slot-color-${index}`}><Icon size={17} /></span><span>{SLOTS[index].label}</span></span></td><td><strong>{reading.value}</strong> <span className="unit">mg/dl</span></td><td className="table-date">{formatDate(reading.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>{!readOnly && <td><div className="row-actions"><button className="icon-button" aria-label={`Edit ${SLOTS[index].label} reading`} onClick={() => onEdit(reading)}><Pencil size={16} /></button><button className="icon-button delete-action" aria-label={`Delete ${SLOTS[index].label} reading`} onClick={() => onDelete(reading)}><Trash2 size={16} /></button></div></td>}</tr>; })}</tbody></table></div>;
}

function Dashboard({ user, date, today, readings, onAdd, onEdit, onDelete, onDateChange }) {
  const count = readings.length;
  return <>
    <div className="page-heading"><div><div className="eyebrow">YOUR DAILY CHECK-IN</div><h1>Hello, {user.name.split(' ')[0]}<span className="greeting-dot">.</span></h1><p>A little consistency goes a long way. Here’s your day at a glance.</p></div><DatePicker date={date} today={today} onChange={onDateChange} /></div>
    <section className="daily-overview"><div className="overview-main"><span className="overview-icon"><Activity size={23} /></span><div><h2>{count === 4 ? 'Your day, all recorded.' : 'Every reading tells a little more.'}</h2><p>{count === 4 ? 'All four time slots are complete. You can edit any reading below.' : 'Build a clearer picture with up to four readings a day.'}</p></div></div><div className="daily-progress"><div><span>Daily progress</span><strong>{count}<span> / 4</span></strong></div><div className="progress-segments" aria-label={`${count} of 4 readings recorded`}>{SLOTS.map((slot) => <span key={slot.value} className={readings.some((reading) => reading.slot === slot.value) ? 'filled' : ''} />)}</div></div></section>
    <section className="slots-section" aria-labelledby="slots-heading"><div className="section-heading"><h2 id="slots-heading">Your daily rhythm</h2><span>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span></div><div className="slot-grid">{SLOTS.map((slot, index) => { const reading = readings.find((entry) => entry.slot === slot.value); const Icon = SLOT_ICONS[index]; return <article className={`slot-card ${reading ? 'slot-recorded' : ''}`} key={slot.value}><div className="slot-card-top"><span className={`slot-icon slot-color-${index}`}><Icon size={21} strokeWidth={1.65} /></span>{reading ? <span className="recorded-badge"><Check size={12} /> Recorded</span> : <span className="pending-label">Not added yet</span>}</div><h3>{slot.label}</h3><p>{slot.description}</p><div className={`slot-value ${reading ? '' : 'slot-value-empty'}`}>{reading ? reading.value : '—'}<span>mg/dl</span></div><button className={`slot-button ${reading ? 'slot-button-edit' : ''}`} onClick={() => reading ? onEdit(reading) : onAdd(slot.value)}>{reading ? <Pencil size={14} /> : <Plus size={16} />}{reading ? 'Edit reading' : 'Add reading'}</button></article>; })}</div></section>
    <section className="panel log-panel"><div className="panel-heading"><div><h2>Reading log</h2><p>All your check-ins for the selected day.</p></div><span className="count-pill">{count} {count === 1 ? 'reading' : 'readings'}</span></div><ReadingTable readings={readings} onEdit={onEdit} onDelete={onDelete} onAdd={() => onAdd()} /></section>
    <div className="gentle-note"><span><Heart size={18} strokeWidth={1.6} /></span><p><strong>One small habit, a little more clarity.</strong> Your reports bring these everyday readings together.</p><Link to={`/reports?date=${date}`}>View reports <ArrowRight size={15} /></Link></div>
  </>;
}

function Reports({ date, today, reports, onDateChange, onAdd, tab, setTab }) {
  const report = reports?.[tab];
  const dateRange = report ? report.startDate === report.endDate ? formatDate(report.startDate) : `${formatDate(report.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(report.endDate)}` : '';
  const stats = [{ label: 'Average reading', value: report?.average == null ? '—' : Number(report.average).toFixed(1), unit: 'mg/dl', icon: Activity, note: 'Across recorded readings', style: 'stat-featured' }, { label: 'Highest reading', value: report?.max ?? '—', unit: 'mg/dl', icon: ArrowUp, note: 'Highest in this period' }, { label: 'Lowest reading', value: report?.min ?? '—', unit: 'mg/dl', icon: ArrowDown, note: 'Lowest in this period' }, { label: 'Readings recorded', value: report?.count ?? 0, unit: 'total', icon: ClipboardList, note: 'Every check-in counts' }];
  return <>
    <div className="page-heading"><div><div className="eyebrow">THE BIGGER PICTURE</div><h1>Your reports<span className="greeting-dot">.</span></h1><p>Turn your daily check-ins into a clearer view over time.</p></div><DatePicker date={date} today={today} onChange={onDateChange} /></div>
    <div className="report-controls"><div className="report-tabs" role="tablist" aria-label="Report period">{REPORT_TABS.map((item) => <button key={item.value} role="tab" id={`tab-${item.value}`} aria-selected={tab === item.value} aria-controls="report-panel" onClick={() => setTab(item.value)}>{item.label}</button>)}</div><span className="report-range"><CalendarDays size={15} />{dateRange}</span></div>
    <div id="report-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}><div className="stat-grid">{stats.map((stat) => { const Icon = stat.icon; return <article className={`stat-card ${stat.style || ''}`} key={stat.label}><div className="stat-top"><span>{stat.label}</span><Icon size={18} /></div><div className="stat-value">{stat.value}<span>{stat.unit}</span></div><p>{stat.note}</p></article>; })}</div>
    <section className="panel report-detail"><div className="panel-heading"><div><h2>{tab === 'daily' ? 'Your day in detail' : tab === 'monthToDate' ? 'This month so far' : 'Your previous month'}</h2><p>{dateRange}</p></div><span className="panel-symbol"><TrendingUp size={20} /></span></div>{tab === 'daily' ? <ReadingTable readings={report?.readings || []} onAdd={onAdd} readOnly /> : report?.count ? <div className="period-summary"><div className="summary-mark"><Activity size={34} strokeWidth={1.4} /></div><h3>{report.count} {report.count === 1 ? 'reading' : 'readings'}. One clearer picture.</h3><p>Your average was <strong>{Number(report.average).toFixed(1)} mg/dl</strong>, with readings from <strong>{report.min}</strong> to <strong>{report.max} mg/dl</strong> during this period.</p><span className="summary-rule">Every recorded reading contributes equally to your average.</span></div> : <div className="empty-state"><span className="empty-icon"><TrendingUp size={26} strokeWidth={1.5} /></span><h3>No readings in this period yet</h3><p>Choose another date, or add a reading to start<br />building your personal picture.</p><button className="button button-secondary" onClick={onAdd}><Plus size={16} />Add a reading</button></div>}</section>
    <div className="report-explanation"><span className="explanation-icon"><CalendarDays size={19} /></span><div><strong>A note on your reports</strong><p>{tab === 'daily' ? 'Daily shows readings for the selected date.' : tab === 'monthToDate' ? 'Month to date starts on the first of the selected month and ends on your selected date.' : 'Previous month covers the entire calendar month before your selected date.'} Averages are rounded to one decimal place.</p></div></div></div>
  </>;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [config, setConfig] = useState(null);
  const [reportState, setReportState] = useState({});
  const [reportTab, setReportTab] = useState('daily');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const requestedDate = new URLSearchParams(location.search).get('date');
  const today = config?.today;
  const date = requestedDate && isValidDate(requestedDate) && requestedDate <= today ? requestedDate : today;
  const isReports = location.pathname === '/reports';
  const requestKey = `${session?.id || ''}:${date || ''}:${revision}`;
  const reports = reportState.key === requestKey ? reportState.reports : null;
  const loading = reportState.key !== requestKey;
  const loadError = reportState.key === requestKey ? reportState.error : '';

  const clearSessionUi = useCallback(() => {
    setEditor(null); setDeleting(null); setDeleteError(''); setNotice(''); setReportState({}); setReportTab('daily');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function bootstrap() {
      try {
        const publicConfig = await api('/config', { signal: controller.signal });
        setConfig(publicConfig);
        try { const result = await api('/auth/me', { signal: controller.signal }); setSession(result.user); setConfig({ today: result.today, timeZone: result.timeZone }); }
        catch (failure) { if (failure.status !== 401) throw failure; }
      } catch (failure) { if (failure.name !== 'AbortError') setBootError('We couldn’t reach Sweety. Please check that the server is running and try again.'); }
      finally { if (!controller.signal.aborted) setBooting(false); }
    }
    bootstrap();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!session || !date) return;
    const controller = new AbortController();
    let active = true;
    api(`/reports?date=${encodeURIComponent(date)}`, { signal: controller.signal }).then((result) => { if (active) { setReportState({ key: requestKey, reports: result, error: '' }); setConfig({ today: result.today, timeZone: result.timeZone }); } }).catch((failure) => { if (active && failure.name !== 'AbortError') { if (failure.status === 401) { setSession(null); clearSessionUi(); navigate('/login', { replace: true }); } else setReportState({ key: requestKey, reports: null, error: failure.message || 'We couldn’t load your readings. Please try again.' }); } });
    return () => { active = false; controller.abort(); };
  }, [session, date, requestKey, navigate, clearSessionUi]);

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);

  const changeDate = useCallback((next) => navigate(`${isReports ? '/reports' : '/app'}?date=${next}`), [navigate, isReports]);
  function authenticated(result) { clearSessionUi(); setSession(result.user); setConfig({ today: result.today, timeZone: result.timeZone }); navigate('/app', { replace: true }); }
  function add(slot) { const firstAvailable = SLOTS.find((entry) => !reports?.daily?.readings?.some((reading) => reading.slot === entry.value)); setEditor({ slot: slot || firstAvailable?.value || SLOTS[0].value }); }
  async function save(payload) {
    setSaveBusy(true);
    try { await api(editor.reading ? `/readings/${editor.reading.id}` : '/readings', { method: editor.reading ? 'PATCH' : 'POST', body: payload }); setEditor(null); setRevision((value) => value + 1); setNotice(editor.reading ? 'Reading updated. Your reports are up to date.' : 'Reading saved. A little more clarity for your day.'); if (payload.date !== date) changeDate(payload.date); }
    finally { setSaveBusy(false); }
  }
  async function remove() { if (deleteBusy) return; setDeleteBusy(true); setDeleteError(''); try { await api(`/readings/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); setRevision((value) => value + 1); setNotice('Reading deleted. Your reports are up to date.'); } catch (failure) { setDeleteError(failure.message || 'We couldn’t delete this reading. Please try again.'); } finally { setDeleteBusy(false); } }
  async function logout() { try { await api('/auth/logout', { method: 'POST' }); setSession(null); clearSessionUi(); navigate('/login', { replace: true }); } catch { setNotice('We couldn’t sign you out. Please try again.'); } }

  if (booting) return <main className="full-loading"><Brand /><LoaderCircle className="spin" size={23} /><p>Making room for your day…</p></main>;
  if (bootError) return <main className="full-loading"><Brand /><p role="alert">{bootError}</p><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!session) return <Auth onAuthenticated={authenticated} />;

  const readings = reports?.daily?.readings || [];
  return <div className="app-shell"><aside className="sidebar"><Link className="sidebar-brand" to={`/app?date=${date}`} aria-label="Sweety home"><Brand /></Link><p className="nav-label">YOUR SPACE</p><nav aria-label="Main navigation"><Link to={`/app?date=${date}`} aria-current={!isReports ? 'page' : undefined}><LayoutDashboard size={19} />Today<span className="nav-active-dot" /></Link><Link to={`/reports?date=${date}`} aria-current={isReports ? 'page' : undefined}><TrendingUp size={19} />Reports<span className="nav-active-dot" /></Link></nav><div className="sidebar-bottom"><div className="sidebar-note"><span><Heart size={20} strokeWidth={1.5} /></span><h3>Little steps.<br />Lasting habits.</h3><p>A moment each day<br />to see the bigger picture.</p></div><div className="user-area"><span className="avatar">{session.name.slice(0, 1).toUpperCase()}</span><div><strong>{session.name}</strong><span>{session.email === 'demo@sweety.example' ? 'Demo account' : 'Personal account'}</span></div><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={17} /></button></div></div></aside>
    <div className="workspace"><header className="topbar"><span className="breadcrumb">My workspace <ChevronRight size={13} /><strong>{isReports ? 'Reports' : 'Daily overview'}</strong></span><span className="privacy-note"><ShieldCheck size={15} />Your readings stay private</span></header><main className="main-content">{loadError ? <div className="load-error" role="alert"><Activity size={30} /><h1>Let’s try that again.</h1><p>{loadError}</p><button className="button button-primary" onClick={() => setRevision((value) => value + 1)}>Reload readings</button></div> : loading ? <div className="dashboard-skeleton" role="status" aria-label="Loading readings"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-text" /><div className="skeleton skeleton-banner" /><div className="skeleton-grid">{SLOTS.map((slot) => <div className="skeleton skeleton-card" key={slot.value} />)}</div><div className="skeleton skeleton-table" /><span className="sr-only">Loading your readings…</span></div> : isReports ? <Reports date={date} today={today} reports={reports} onDateChange={changeDate} onAdd={() => add()} tab={reportTab} setTab={setReportTab} /> : <Dashboard user={session} date={date} today={today} readings={readings} onAdd={add} onEdit={(reading) => setEditor({ reading })} onDelete={(reading) => { setDeleting(reading); setDeleteError(''); }} onDateChange={changeDate} />}<footer className="workspace-footer"><span><Brand compact /> A little clarity, every day.</span><span>Dates follow {config.timeZone === 'Asia/Kolkata' ? 'India Standard Time (IST)' : config.timeZone} · mg/dl</span></footer></main></div>
    {notice && <div className="toast" role="status"><span><Check size={16} /></span>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {editor && <Modal title={editor.reading ? 'Edit your reading' : 'A quick check-in'} description={editor.reading ? 'Make a correction. Your reports will update automatically.' : 'Add your glucose reading. We’ll take care of the bigger picture.'} busy={saveBusy} onClose={() => { if (!saveBusy) setEditor(null); }}><ReadingForm reading={editor.reading} date={date} slot={editor.slot} today={today} onSave={save} onCancel={() => setEditor(null)} /></Modal>}
    {deleting && <Modal title="Delete this reading?" description={`This will remove your ${SLOTS.find((slot) => slot.value === deleting.slot).label.toLowerCase()} reading of ${deleting.value} mg/dl for ${formatDate(deleting.date)}. Your reports will update too.`} onClose={() => { if (!deleteBusy) setDeleting(null); }} busy={deleteBusy} kind="delete-modal">{deleteError && <div className="error-banner" role="alert">{deleteError}</div>}<div className="form-actions"><button className="button button-secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Keep reading</button><button className="button button-danger" disabled={deleteBusy} onClick={remove}>{deleteBusy && <LoaderCircle size={16} className="spin" />}{deleteBusy ? 'Deleting…' : 'Delete reading'}</button></div></Modal>}
  </div>;
}
