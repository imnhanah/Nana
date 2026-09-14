import React, { useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';

export default function PricingDialog({ onClose, onSignup }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialog} className="pub-pricing" aria-labelledby="pricing-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="pub-pricing-close" autoFocus aria-label="Close pricing" onClick={onClose}><X size={20}/></button>
    <div className="pub-section-heading"><span className="pub-eyebrow">YOUR NEXT STEP</span><h2 id="pricing-title">A plan for your process.</h2><p>Start your journal today. More possibilities are on the way.</p></div>
    <div className="pub-pricing-grid">
      <article><h3>Free</h3><p>Build a consistent journaling routine.</p><strong className="pub-price">$0</strong><ul>{['Trade logging and screenshots', 'Dashboard and calendar', 'Markups and trade reviews', 'Performance analytics', 'Goals and risk guardrails', 'Light and dark themes'].map(text => <li key={text}><Check size={17}/>{text}</li>)}</ul><button className="pub-plan-action" onClick={onSignup}>Get Started Free</button></article>
      <article className="pub-paid"><span className="pub-coming">Coming Soon</span><h3>Paid</h3><p>More possibilities for your trading journal.</p><div className="pub-plan-soon">Something more is on the way.</div><p>Paid plan features and availability will be announced here.</p><button className="pub-plan-action" disabled>Coming Soon</button></article>
    </div>
  </dialog>;
}
