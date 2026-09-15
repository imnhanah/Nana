import React from 'react';
import { Lightbulb } from 'lucide-react';
import { journalSignal } from './journalSignals';
export default function JournalSignalHeader({loginQuote, ...data}) {
  const message = journalSignal(data);
  const names = {tradelog:'Trade Log',reviews:'Review',markups:'Markups',dashboard:'Dashboard',calendar:'Calendar',challenge:'Challenge'};
  return <section className="tj-dashboard-welcome" aria-label={`${names[data.page]} journal insight`}>
    <div className="tj-dashboard-welcome-copy">{data.page === 'dashboard' && <a className="tj-dashboard-landing-link" href="/landing">AAICOREFX / DASHBOARD</a>}<h1>{message.title}<br/><span className="tj-signal-secondary">{message.subtitle}</span></h1><p>{message.detail}</p></div>
    <aside className="tj-dashboard-quote"><span className="tj-dashboard-quote-icon" aria-hidden="true"><Lightbulb size={21}/></span><div><strong>Trading Quote</strong><blockquote>“{loginQuote}”</blockquote></div></aside>
  </section>;
}
