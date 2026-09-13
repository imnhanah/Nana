import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, BookOpen, TrendingUp, Trophy, LayoutDashboard } from 'lucide-react';

const captions = {
  'dashboard.png': [LayoutDashboard, 'See the Bigger Picture', 'Let a clear view of your progress guide your next step.'],
  'analytics.png': [BarChart3, 'Discover Your Edge', 'Study the patterns. Build on what your own results teach you.'],
  'trades.png': [TrendingUp, 'Make Every Trade Count', 'Record the decision, not just the outcome.'],
  'reviews.png': [BookOpen, 'Turn Reflection into Progress', 'Every honest review is a step toward a stronger process.'],
  'challenge-clean.png': [Trophy, 'Build One Step at a Time', 'Small, disciplined steps can lead to meaningful milestones.'],
};

export default function LandingGallery({ files, title, renderImage, stacked = false }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const root = useRef(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { threshold: .1 });
    observer.observe(root.current);
    return () => { observer.disconnect(); preference.removeEventListener('change', update); };
  }, []);
  const playing = visible && !paused && !focused && !reduced;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !document.querySelector('.pub-lightbox[open]')) setActive(value => (value + 1) % files.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [playing, files.length, active]);
  const [Icon, heading, quote] = captions[files[active]] || captions['analytics.png'];
  return <div ref={root} className={`pub-gallery ${stacked ? 'pub-gallery-stacked' : ''}`} data-playing={playing} role="region" aria-roledescription="carousel" aria-label={`${title} screenshots`} onFocus={event => { if (event.target.matches(':focus-visible')) setFocused(true); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <button className="pub-gallery-pause" onClick={() => setPaused(!paused)}>{paused ? 'Resume slideshow' : 'Pause slideshow'}</button>
    <div className="pub-gallery-stage">
      {files.map((file, index) => <div key={file} className="pub-gallery-slide" data-position={(index - active + files.length) % files.length} aria-hidden={index !== active} inert={index !== active ? '' : undefined}>{renderImage(file, `${title} — ${index + 1}`, stacked && index === 0)}</div>)}
      {stacked && <div className="pub-gallery-caption" key={files[active]}><Icon aria-hidden="true"/><h3>{heading}</h3><p>{quote}</p></div>}
    </div>
    <div className="pub-gallery-controls">
      {files.map((file, index) => <button key={file} className="pub-gallery-dot" aria-label={`Show ${title} screenshot ${index + 1}`} aria-current={active === index ? 'true' : undefined} onClick={() => setActive(index)}><span key={active === index ? `active-${active}` : 'idle'}/></button>)}
    </div>
  </div>;
}
