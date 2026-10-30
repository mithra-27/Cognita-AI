import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BrainCircuit, Check, ChevronRight, Info, LockKeyhole, Palette, RotateCcw, Save, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import './Settings.css';

const STORAGE_KEY = 'cognita_settings';
const DEFAULT_SETTINGS = { explanationStyle: 'simple', notifications: { training: true, progress: true, assessment: true }, appearance: 'purple' };
const DIMENSIONS = [
  ['Anumāna', 'Logical / inferential reasoning'],
  ['Arthāpatti', 'Abductive reasoning / problem solving'],
  ['Upamāna', 'Analogical reasoning'],
  ['Pratyakṣa', 'Observation / visual reasoning'],
  ['Śabda', 'Reading comprehension / interpretation'],
  ['Anupalabdhi', 'Absence / contradiction / elimination reasoning'],
];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return { ...DEFAULT_SETTINGS, ...(saved || {}), notifications: { ...DEFAULT_SETTINGS.notifications, ...(saved?.notifications || {}) } };
  } catch { return DEFAULT_SETTINGS; }
}
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map(p => p[0].toUpperCase()).join('') : 'C';
}

export default function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(loadSettings);
  const [activeSection, setActiveSection] = useState('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.me();
        if (mounted) setProfile(data?.data ?? data);
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : 'Unable to load your account details.');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const displayName = useMemo(() => profile?.name || profile?.full_name || profile?.username || 'Cognita Student', [profile]);
  const email = profile?.email || 'Email not available';
  const updateSetting = (key, value) => { setSettings(s => ({ ...s, [key]: value })); setMessage(''); setError(''); };
  const updateNotification = (key, value) => { setSettings(s => ({ ...s, notifications: { ...s.notifications, [key]: value } })); setMessage(''); setError(''); };
  const saveSettings = () => {
    setSaving(true); setMessage(''); setError('');
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); window.dispatchEvent(new Event('cognita-settings-updated')); setMessage('Your settings have been saved.'); }
    catch { setError('Unable to save settings on this device.'); }
    finally { setSaving(false); }
  };
  const resetSettings = () => { setSettings(DEFAULT_SETTINGS); localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)); window.dispatchEvent(new Event('cognita-settings-updated')); setMessage('Settings restored to the Cognita defaults.'); setError(''); };
  const sections = [
    { id: 'account', label: 'Account', icon: UserRound }, { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'learning', label: 'Learning Preferences', icon: SlidersHorizontal }, { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette }, { id: 'about', label: 'About Cognita', icon: Info },
  ];

  return <div className="settings-page"><div className="settings-shell">
    <header className="settings-hero"><div className="settings-hero-icon"><SlidersHorizontal size={23} /></div><div><p className="settings-eyebrow">PERSONAL CONTROL CENTER</p><h1>Settings</h1><p>Manage your account, learning preferences and Cognita experience.</p></div></header>
    {message && <div className="settings-alert success"><Check size={17} /><span>{message}</span></div>}
    {error && <div className="settings-alert error"><Info size={17} /><span>{error}</span></div>}
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <div className="settings-profile-mini"><div className="settings-avatar">{getInitials(displayName)}</div><div><strong>{displayName}</strong><span>{email}</span></div></div>
        <nav className="settings-nav" aria-label="Settings sections">{sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activeSection === id ? 'active' : ''} onClick={() => setActiveSection(id)}><Icon size={17} /><span>{label}</span><ChevronRight size={15} /></button>)}</nav>
        <div className="settings-sidebar-note"><BrainCircuit size={18} /><span>Cognita uses transparent scoring and RAG-based reasoning support.</span></div>
      </aside>
      <main className="settings-content">
        {activeSection === 'account' && <section className="settings-section"><SectionHeading icon={UserRound} title="Account" description="Your Cognita account information." /><div className="account-card"><div className="large-avatar">{getInitials(displayName)}</div><div className="account-main"><span className="field-caption">Student name</span><h2>{loading ? 'Loading…' : displayName}</h2><span className="account-email">{email}</span></div></div><div className="info-grid"><InfoField label="Name" value={loading ? 'Loading…' : displayName} /><InfoField label="Email" value={loading ? 'Loading…' : email} /><InfoField label="Account status" value="Active" /><InfoField label="Learning framework" value="Six reasoning dimensions" /></div><div className="settings-note"><Info size={17} /><p>Account identity is managed by Cognita authentication. Use the Security section if you need to reset your password.</p></div></section>}
        {activeSection === 'security' && <section className="settings-section"><SectionHeading icon={ShieldCheck} title="Security" description="Keep your Cognita account protected." /><div className="settings-option-card"><div className="option-icon"><LockKeyhole size={19} /></div><div className="option-copy"><strong>Password</strong><span>Reset your password using email verification and OTP.</span></div><button type="button" className="secondary-action" onClick={() => navigate('/forgot-password')}>Reset password<ChevronRight size={16} /></button></div><div className="settings-note"><ShieldCheck size={17} /><p>Cognita's password reset flow verifies the registered email before allowing a new password to be created.</p></div></section>}
        {activeSection === 'learning' && <section className="settings-section"><SectionHeading icon={SlidersHorizontal} title="Learning Preferences" description="Choose how Cognita should present explanations to you." /><div className="preference-group"><label>Explanation style</label><p>Choose the style used when you work with the AI Tutor.</p><div className="choice-grid">{[['simple','Simple & clear','Beginner-friendly explanations with short examples.'],['balanced','Balanced','Clear explanations with moderate detail and examples.'],['detailed','Detailed','More structured explanation with deeper reasoning.']].map(([value,title,description]) => <button key={value} type="button" className={`choice-card ${settings.explanationStyle === value ? 'selected' : ''}`} onClick={() => updateSetting('explanationStyle', value)}><span className="choice-radio">{settings.explanationStyle === value && <span />}</span><span><strong>{title}</strong><small>{description}</small></span></button>)}</div></div><div className="settings-note"><BrainCircuit size={17} /><p>These preferences affect presentation style only. Cognita's assessment and transparent scoring logic remains unchanged.</p></div></section>}
        {activeSection === 'notifications' && <section className="settings-section"><SectionHeading icon={Bell} title="Notifications" description="Control which learning updates you want to receive." /><div className="toggle-list"><ToggleRow title="Training reminders" description="Receive reminders related to cognitive training activity." checked={settings.notifications.training} onChange={v => updateNotification('training', v)} /><ToggleRow title="Progress updates" description="Receive updates when your learning progress changes." checked={settings.notifications.progress} onChange={v => updateNotification('progress', v)} /><ToggleRow title="Assessment reminders" description="Receive reminders about available assessment activities." checked={settings.notifications.assessment} onChange={v => updateNotification('assessment', v)} /></div><div className="settings-note"><Info size={17} /><p>Notification preferences are stored locally in this version. They do not change assessment, scoring or training behavior.</p></div></section>}
        {activeSection === 'appearance' && <section className="settings-section"><SectionHeading icon={Palette} title="Appearance" description="Keep the Cognita visual experience consistent." /><div className="theme-preview-card"><div className="theme-preview-glow" /><div className="theme-preview-content"><div className="theme-preview-brand"><div><BrainCircuit size={20} /></div><span>Cognita AI</span></div><strong>Deep Purple Glass</strong><p>Current Cognita interface theme</p></div><div className="theme-selected"><Check size={16} />Active</div></div><div className="settings-note"><Palette size={17} /><p>The current purple/glassmorphism theme is the primary Cognita visual identity and is preserved across the application.</p></div></section>}
        {activeSection === 'about' && <section className="settings-section"><SectionHeading icon={Info} title="About Cognita" description="Project information and the reasoning framework behind Cognita." /><div className="about-card"><div className="about-brand"><div className="about-logo"><BrainCircuit size={25} /></div><div><h2>Cognita AI</h2><p>Understand Your Thinking. Improve Your Reasoning.</p></div></div><div className="about-title">Mīmāṃsā-Inspired RAG-Based AI Framework for Cognitive Assessment and Adaptive Cognitive Skill Enhancement</div><div className="dimension-list">{DIMENSIONS.map(([principle, skill]) => <div key={principle} className="dimension-row"><strong>{principle}</strong><span>{skill}</span></div>)}</div><div className="settings-note"><Info size={17} /><p>Cognita uses modern reasoning datasets mapped to computational cognitive dimensions inspired by selected Mīmāṃsā principles. The framework does not treat these modern datasets as traditional Mīmāṃsā datasets.</p></div></div></section>}
        <footer className="settings-actions"><button type="button" className="reset-action" onClick={resetSettings}><RotateCcw size={16} />Restore defaults</button><button type="button" className="save-action" onClick={saveSettings} disabled={saving}><Save size={16} />{saving ? 'Saving…' : 'Save settings'}</button></footer>
      </main>
    </div>
  </div></div>;
}
function SectionHeading({ icon: Icon, title, description }) { return <div className="section-heading"><div className="section-heading-icon"><Icon size={19} /></div><div><h2>{title}</h2><p>{description}</p></div></div>; }
function InfoField({ label, value }) { return <div className="info-field"><span>{label}</span><strong>{value}</strong></div>; }
function ToggleRow({ title, description, checked, onChange }) { return <div className="toggle-row"><div><strong>{title}</strong><span>{description}</span></div><button type="button" className={`toggle ${checked ? 'on' : ''}`} aria-pressed={checked} onClick={() => onChange(!checked)}><span /></button></div>; }
