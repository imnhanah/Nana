import React, { useState } from 'react';
import { CheckCircle2, ArrowUpRight, Layers, Brain, BookOpen, ShieldCheck } from 'lucide-react';

const solutions = [
  ['Accounts get mixed together', 'Keep each account in its own lane.', 'Switch between journals without mixing trades, balances, or goals. Each account keeps its own settings and performance history.', 'accounts-clean.png'],
  ['My rules get lost in the moment', 'Bring your plan into the trading day.', 'Keep account goals and loss limits visible. Link trades to prepared markups so you can compare your execution with your original plan.', 'guardrails.png'],
  ['I log trades, but repeat mistakes', 'Turn a closed trade into a useful lesson.', 'Save the reasoning behind each result, then revisit it in your monthly, quarterly, and annual reviews.', 'reviews.png'],
  ['I cannot see what is working', 'Look beyond a single win or loss.', 'Compare instruments, entry models, sessions, and equity growth to find patterns worth investigating in your own history.', 'analytics.png'],
  ['Emotions go unnoticed', 'Notice the habits behind the numbers.', 'Record your mood and mistake tags alongside each trade. Review recurring behavior with the Psychology Lab.', 'psychology.png'],
];
const differences = [
  [BookOpen, 'A connected trading routine', 'Preparation, execution, and reflection stay linked—not scattered across separate notes.'],
  [Brain, 'Behavior alongside performance', 'Review emotional states and mistakes in the same journal as your trading results.'],
  [Layers, 'Room for every account', 'Keep personal, funded, and challenge journals separate while using one familiar workspace.'],
  [ShieldCheck, 'Your boundaries stay visible', 'Optional goals and loss guardrails bring your own risk limits into the daily routine.'],
];
const comparisons = [
  ['Recording a trade', 'Design and maintain your own fields', 'Structured entries, costs, tags, and screenshots'],
  ['Understanding results', 'Build and check your own calculations', 'P&L, win rate, equity, and performance breakdowns'],
  ['Connecting plan and execution', 'Cross-reference separate notes', 'Link executions directly to their markups'],
  ['Reviewing your progress', 'Organize your own review routine', 'Trade, monthly, quarterly, and annual reviews'],
  ['Keeping accounts separate', 'Maintain separate records or templates', 'Switch accounts with their own trades and settings'],
];

export default function LandingHelp({ renderImage }) {
  const [selected, setSelected] = useState(0);
  const [, title, body, file] = solutions[selected];
  return <div className="pub-container pub-help-wrap">
    <section id="how-it-helps" className="pub-help">
      <div className="pub-section-heading"><span className="pub-eyebrow">MAKE EVERY REVIEW COUNT</span><h2>Less guesswork.<br/><span>More understanding.</span></h2><p>A trading journal cannot promise better results. It can help you see your decisions more clearly—and give your next review a starting point.</p></div>
      <div className="pub-help-grid">
        <div className="pub-problems"><h3>What gets in your way?</h3>{solutions.map(([problem], index) => <button key={problem} aria-pressed={selected === index} aria-controls="help-solution" onClick={() => setSelected(index)}><span className="pub-help-number">0{index + 1}</span><span>{problem}</span><ArrowUpRight size={18}/></button>)}</div>
        <article id="help-solution" className="pub-solution" aria-live="polite"><span className="pub-eyebrow">WITH AAICOREFX</span><h3><CheckCircle2 size={22}/>{title}</h3>{renderImage(file, title)}<p>{body}</p></article>
      </div>
    </section>
    <section className="pub-audience"><div className="pub-section-heading"><span className="pub-eyebrow">YOUR STYLE. YOUR PROCESS.</span><h2>Who is AAICOREFX for?</h2><p>Traders who want a record they can learn from, whether a position lasts minutes or days.</p></div><ul>{['Intraday traders', 'Scalpers', 'Swing traders', 'Challenge traders', 'Forex, indices & crypto traders'].map(label => <li key={label}><CheckCircle2 size={17}/>{label}</li>)}</ul></section>
    <section className="pub-difference"><div className="pub-section-heading"><span className="pub-eyebrow">BUILT AROUND YOUR PROCESS</span><h2>What makes this journal different?</h2></div><div className="pub-difference-grid">{differences.map(([Icon, heading, description]) => <article key={heading}><Icon size={25}/><h3>{heading}</h3><p>{description}</p></article>)}</div></section>
    <section className="pub-comparison"><div className="pub-section-heading"><span className="pub-eyebrow">LESS SETUP. MORE REFLECTION.</span><h2>Beyond a blank spreadsheet.</h2><p>You can build a journal yourself. AAICOREFX brings these parts together from the start.</p></div><div className="pub-table-scroll" role="region" aria-label="Journaling workflow comparison" tabIndex={0}><table><thead><tr><th scope="col">Your workflow</th><th scope="col">A do-it-yourself journal</th><th scope="col">AAICOREFX</th></tr></thead><tbody>{comparisons.map(([task, manual, builtIn]) => <tr key={task}><th scope="row">{task}</th><td>{manual}</td><td>{builtIn}</td></tr>)}</tbody></table></div></section>
  </div>;
}
