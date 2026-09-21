import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, CalendarDays, BookOpen, ShieldCheck, Sun, Moon, X, Maximize2, ArrowUp, Landmark, Upload, RefreshCw } from 'lucide-react';
import AuthPage from './AuthPage';
import './public-site.css';
import LandingGallery from './LandingGallery';
import LandingHelp from './LandingHelp';
import PricingDialog from './PricingDialog';
import { useSiteTheme } from './siteTheme';

const galleries = {
  dashboard: ['dashboard.png', 'dashboard-detail.png'],
  reviews: ['reviews.png', 'annual-review.png'],
  analytics: ['analytics.png', 'analytics-detail.png', 'daily-growth.png', 'monthly-pnl.png', 'instruments.png'],
  rhythm: ['rhythm.png', 'rhythm-detail.png'],
};

const features = [
  ['dashboard', 'Your performance, in perspective.', 'A clear view of every trading day.', 'Bring your calendar, recent trades, equity curve, and core metrics together. See the bigger picture without losing sight of the details.', ['Daily P&L calendar', 'Performance flow', 'Equity and consistency'], 'dashboard.png'],
  ['trades', 'Every execution. Every detail.', 'Trade logging that goes deeper.', 'Keep your entries, risk, costs, screenshots, and outcomes in one place. Filter your history and revisit the decisions behind each result.', ['Net results after costs', 'Entry models and confluences', 'Linked trade reviews'], 'trades.png'],
  ['markups', 'Prepare with purpose.', 'Connect your plan to your trades.', 'Capture your market bias, key levels, and chart analysis before you trade. Link the execution to its original idea and review what actually happened.', ['Pre-session analysis', 'Chart screenshots', 'Plan-to-trade tracking'], 'markups.png'],
  ['reviews', 'Make reflection a routine.', 'Turn your history into learning.', 'Review individual trades, then step back for monthly, quarterly, and yearly reflections. Keep the lessons alongside the numbers.', ['Trade-by-trade reflection', 'Monthly and quarterly reviews', 'A full-year perspective'], 'reviews.png'],
  ['analytics', 'Understand your edge.', 'Analytics with the full context.', 'Explore equity growth, results by instrument, and the entry models behind your performance. Find patterns in your own trading history.', ['Equity growth', 'Entry model breakdowns', 'Instrument performance'], 'analytics.png'],
  ['rhythm', 'Find your trading rhythm.', 'Know when you perform best.', 'Compare weekdays, sessions, and recent weeks. Understand how consistency and execution quality develop over time.', ['Session comparisons', 'Weekly performance', 'Core score breakdown'], 'rhythm.png'],
  ['insights', 'Protect your progress.', 'Keep risk in the picture.', 'Follow your growth, drawdown, and reward quality. Use account goals and guardrails to keep your next decision grounded in your trading plan.', ['Risk and drawdown', 'Monthly growth', 'Actionable recommendations'], 'insights.png'],
  ['challenge', 'One step at a time.', 'Make every milestone count.', 'Follow a 30-level compounding plan, track your progress, and keep notes along the way. Enable the challenge from your account settings when you are ready.', ['Automatic progress saving', 'Milestones at levels 10, 20, and 30', 'Optional account challenge'], 'challenge-clean.png'],
  ['accounts', 'Your journal. Your rules.', 'An account built around you.', 'Organize your account currency, starting balance, journal defaults, and optional goals in one place. Set risk guardrails and choose the tools that fit your routine.', ['Separate account settings', 'Optional goals and loss limits', 'Position size calculator'], 'accounts-clean.png'],
];
features.push(
  ['psychology', 'Understand the trader behind the trade.', 'Make room for your mindset.', 'Record emotional states and mistakes alongside your trades. Look for patterns in behavior and build a more deliberate trading routine.', ['Mood tracking', 'Mistake patterns', 'Execution clarity'], 'psychology.png'],
  ['guardrails', 'Give your goals boundaries.', 'Stay aware of your limits.', 'Keep monthly and yearly goals alongside daily and monthly loss limits. See your remaining buffer before your next decision.', ['Goal progress', 'Daily loss buffer', 'Monthly loss limits'], 'guardrails.png'],
);
const faqs = [
  ['Which instruments can I journal?', 'Track major forex pairs, gold, silver, US indices, Bitcoin, and Ethereum. Your instrument picker keeps the available markets organized.'],
  ['How is net P&L calculated?', 'Your journal subtracts commission and swap costs from gross P&L, so the net result reflects the costs entered for each trade.'],
  ['Can I keep separate trading accounts?', 'Yes. Switch between accounts in the account center. Each account keeps its own trades, starting balance, and settings.'],
  ['Can I import trades from my broker?', 'Yes. Create an import account or upload history from Account Settings. MetaTrader 4/5 HTML reports and cTrader HTML or CSV statements are read into the same journal, with duplicate protection for repeat uploads.'],
  ['How does Finance work?', 'Finance keeps deposits, withdrawals, and savings transfers separate from trading statistics. Imported deposits can establish the account base, while your net trading P&L stays focused on trade performance.'],
  ['Can I attach charts and review my trades?', 'Yes. Attach screenshots to trades and markups, connect executions to their plans, and save trade and period reviews.'],
  ['Can I use it on my phone?', 'The journal adapts to smaller screens with stacked cards, compact navigation, and forms that fit the available space.'],
  ['What do the screenshots show?', 'These are screenshots from the journal. The demonstration account contains synthetic trading data for exploring the tools; its results are not a promise of future performance.'],
];

export function Brand() { return <span className="pub-brand"><span className="pub-brand-mark"><img className="pub-logo-dark" src="/brand/logo-dark.png" width="48" height="48" alt=""/><img className="pub-logo-light" src="/brand/logo-light.png" width="48" height="48" alt=""/></span>AAICOREFX</span>; }

export default function PublicSite({ onAuthed, user }) {
  const [path, setPath] = useState(window.location.pathname);
  const [theme, setTheme] = useSiteTheme();
  const light = theme === 'light';
  const [pricingOpen, setPricingOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const dialog = useRef(null);
  const site = useRef(null);
  useEffect(() => {
    const root = site.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root || !('IntersectionObserver' in window)) return;
    const elements = [...root.querySelectorAll('.pub-section-heading, .pub-overview > .pub-gallery, .pub-benefits article, .pub-integrations .pub-integration-grid, .pub-feature-copy, .pub-feature > .pub-screen, .pub-feature > .pub-gallery, .pub-faq-list')];
    const reveal = element => { element.classList.remove('pub-reveal-pending'); observer.unobserve(element); };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); }), { threshold: 0.08 });
    if (!preference.matches) elements.forEach(element => { element.classList.add('pub-reveal', 'pub-reveal-pending'); observer.observe(element); });
    const onFocus = event => { const target = event.target.closest('.pub-reveal'); if (target) reveal(target); };
    const onPreference = () => { if (preference.matches) elements.forEach(reveal); };
    root.addEventListener('focusin', onFocus);
    preference.addEventListener('change', onPreference);
    return () => { observer.disconnect(); elements.forEach(element => element.classList.remove('pub-reveal', 'pub-reveal-pending')); root.removeEventListener('focusin', onFocus); preference.removeEventListener('change', onPreference); };
  }, [path]);
  useEffect(() => { const sync = () => setPath(window.location.pathname); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  useEffect(() => { if (preview) dialog.current?.showModal(); }, [preview]);
  const navigate = (next) => { window.history.pushState({}, '', next); setPath(next); window.scrollTo(0, 0); };
  const authMode = path === '/signup' ? 'signup' : path === '/login' ? 'login' : null;
  const moveImage = event => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    element.style.setProperty('--image-x', `${((event.clientX - rect.left) / rect.width - .5) * 8}px`);
    element.style.setProperty('--image-y', `${((event.clientY - rect.top) / rect.height - .5) * 8}px`);
  };
  const imageButton = (file, title, eager = false) => <button className="pub-screen" onPointerMove={moveImage} onPointerLeave={event => { event.currentTarget.style.removeProperty('--image-x'); event.currentTarget.style.removeProperty('--image-y'); }} onClick={() => setPreview({ file, title })} aria-label={`Enlarge ${title}`}><img src={`/landing/${file}`} alt={title} width={file === 'guardrails.png' ? 1508 : 1920} height={file === 'guardrails.png' ? 316 : 1080} loading={eager ? 'eager' : 'lazy'} decoding="async"/><span className="pub-enlarge"><Maximize2 size={16}/> Enlarge</span></button>;
  return <div ref={site} className={`public-site ${light ? 'public-light' : ''}`}>
    <header className="pub-header"><a href="/landing" aria-label="Reload AAICOREFX landing page"><Brand/></a><nav aria-label="Main navigation"><a href="/landing#features">Features</a><a href="/landing#integrations">Integrations</a><a href="/landing#how-it-helps">How It Helps</a><a href="/landing#faq">FAQ</a><button onClick={() => setPricingOpen(true)}>Pricing</button>{user ? <a className="pub-signup" href="/">Go to Dashboard <ArrowUpRight size={16}/></a> : <><button onClick={() => navigate('/login')}>Sign In</button><button className="pub-signup" onClick={() => navigate('/signup')}>Sign Up</button></>}<button className="pub-theme" aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => setTheme(light ? 'dark' : 'light')}>{light ? <Moon size={18}/> : <Sun size={18}/>}</button></nav></header>
    {pricingOpen && <PricingDialog onClose={() => setPricingOpen(false)} onSignup={() => { setPricingOpen(false); if (user) window.location.assign('/'); else navigate('/signup'); }}/>}
    {authMode ? <AuthPage key={authMode} initialMode={authMode} onModeChange={(mode) => navigate(mode === 'signup' ? '/signup' : '/login')} onBack={() => navigate('/landing')} onAuthed={onAuthed}/> : <>
      <main id="top">
        <section className="pub-hero"><div className="pub-orbit pub-orbit-one"/><div className="pub-orbit pub-orbit-two"/><div className="pub-orbit pub-orbit-three"/><span className="pub-eyebrow">YOUR PROCESS. YOUR PERFORMANCE.</span><h1>Your trading journal.<br/><span>A clearer view of your edge.</span></h1><p>Plan your trades. Understand your results. Build a more intentional trading routine with your entire journal in one place.</p><a className="pub-explore" href="#features">Explore the journal <ArrowUpRight size={17}/></a></section>
        <section id="features" className="pub-overview pub-container"><div className="pub-section-heading"><span className="pub-eyebrow">THE COMPLETE PICTURE</span><h2>Your journal and analytics.<br/><span>Working together.</span></h2><p>From the first idea to the final review, keep every part of your trading process connected.</p></div>{<LandingGallery stacked files={['dashboard.png', 'analytics.png', 'trades.png', 'reviews.png', 'challenge-clean.png']} title="Journal and analytics" renderImage={imageButton}/>}<div className="pub-benefits">{[[BarChart3, 'Performance metrics', 'Follow net P&L, win rate, and your equity curve.'], [BookOpen, 'Connected journal', 'Keep trades, markups, and reviews together.'], [CalendarDays, 'Visual calendar', 'See winning, losing, and breakeven days.'], [ShieldCheck, 'Risk awareness', 'Track your goals and account guardrails.']].map(([Icon, title, body]) => <article key={title}><span><Icon size={21}/></span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
        <section id="integrations" className="pub-integrations pub-container"><div className="pub-section-heading"><span className="pub-eyebrow">IMPORTS &amp; FINANCE</span><h2>Bring in your history.<br/><span>Keep your capital clear.</span></h2><p>Import broker statements into the same journal you use for manual trades, then keep capital movements separate from trading performance.</p></div><div className="pub-integration-grid"><article className="pub-finance-card"><span className="pub-integration-icon"><Landmark size={22}/></span><div><small>FINANCE WORKSPACE</small><h3>Capital, without distorting P&amp;L.</h3><p>Record deposits, withdrawals, and savings transfers independently from your trade results. Imported deposits can establish your account base while net P&amp;L remains trade-only.</p></div><ul><li>Deposit and withdrawal ledger</li><li>Savings allocations from profit</li><li>Transfer reminders and cash history</li></ul></article><article className="pub-broker-card"><div className="pub-broker-card-head"><span className="pub-integration-icon"><Upload size={22}/></span><div><small>BROKER HISTORY IMPORT</small><h3>One journal, every execution.</h3></div></div><div className="pub-platform-list"><span><b>MT4</b><em>MetaTrader 4</em><i>HTML reports</i></span><span><b>MT5</b><em>MetaTrader 5</em><i>HTML reports</i></span><span><b>cT</b><em>cTrader</em><i>HTML &amp; CSV</i></span></div><p><RefreshCw size={15}/> Closed positions import as normal journal trades. Re-uploading the same statement skips duplicates.</p></article></div></section>
        <div className="pub-container pub-features">{features.map(([id, eyebrow, title, body, bullets, file], i) => <section id={id} className={`pub-feature ${i % 2 ? 'pub-feature-reverse' : ''}`} key={id}><div className="pub-feature-copy"><span className="pub-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{body}</p><ul>{bullets.map(text => <li key={text}>{text}</li>)}</ul></div>{galleries[id] ? <LandingGallery files={galleries[id]} title={title} renderImage={imageButton}/> : imageButton(file, title)}</section>)}</div>
        <LandingHelp renderImage={imageButton}/>
        <section id="faq" className="pub-faq pub-container"><div className="pub-section-heading"><span className="pub-eyebrow">A LITTLE MORE CLARITY</span><h2>Frequently asked questions</h2><p>Get to know your journal before you begin.</p></div><div className="pub-faq-list">{faqs.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
      </main>
      <footer className="pub-footer pub-container"><div><a href="/landing" aria-label="Reload AAICOREFX landing page"><Brand/></a><p>Your trades. Your process. Your perspective.</p></div><nav aria-label="Footer navigation"><a href="#features">Features</a><a href="#integrations">Integrations</a><a href="#how-it-helps">How It Helps</a><a href="#faq">FAQ</a>{user ? <a href="/">Go to Dashboard</a> : <button onClick={() => navigate('/login')}>Sign In</button>}<a href="#top">Back to top <ArrowUp size={14}/></a></nav><small>© {new Date().getFullYear()} AAICOREFX.</small></footer>
      <dialog ref={dialog} className="pub-lightbox" aria-label={preview?.title || 'Journal screenshot'} onCancel={() => setPreview(null)} onClick={(e) => { if (e.target === e.currentTarget) { dialog.current.close(); setPreview(null); } }}>{preview && <><button className="pub-close" autoFocus aria-label="Close screenshot" onClick={() => { dialog.current.close(); setPreview(null); }}><X/></button><img src={`/landing/${preview.file}`} alt={preview.title}/></>}</dialog>
    </>}
  </div>;
}
