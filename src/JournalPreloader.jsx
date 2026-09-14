import React from 'react';
import './journal-preloader.css';

// A rippling orbit, like the light trails in the supplied recording.
const orbit = Array.from({ length: 241 }, (_, i) => {
  const angle = i / 240 * Math.PI * 2;
  const radius = 68 + Math.sin(angle * 9) * 3.5;
  return `${i ? 'L' : 'M'}${80 + Math.cos(angle) * radius},${80 + Math.sin(angle) * radius}`;
}).join(' ') + 'Z';

export default function JournalPreloader({ theme = 'dark', waiting = false }) {
  return <div className={`journal-preloader ${theme === 'light' ? 'journal-preloader-light' : ''}`}>
    <div className="journal-preloader-content">
      <div className="journal-preloader-emblem" aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <path className="journal-orbit-track" d={orbit}/>
          <path className="journal-orbit-trail" d={orbit} pathLength="100"/>
          <path className="journal-orbit-trail journal-orbit-secondary" d={orbit} pathLength="100"/>
        </svg>
        <img src={`/brand/logo-${theme === 'light' ? 'light' : 'dark'}.png`} alt="" width="96" height="96"/>
      </div>
      <h1>AAICOREFX</h1>
      <p className="journal-preloader-status" role="status">{waiting ? 'Still preparing your journal…' : 'Preparing your journal…'}</p>
      <blockquote>“One disciplined decision today.<br/>A stronger trader tomorrow.”</blockquote>
    </div>
  </div>;
}
