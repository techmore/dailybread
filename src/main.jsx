import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cog,
  HandHeart,
  Truck,
  Wheat,
} from 'lucide-react';
import './styles.css';

const phases = [
  {
    title: 'Phase 1: recurring bread supply',
    time: '1-2 weeks',
    blurb: 'Fastest path is a scheduled bakery or pickup service. This gets you actual bread availability before you invest in hardware.',
    items: ['Use a bakery subscription, CSA, or recurring local pickup.', 'Lock in 2 deliveries per week first.', 'Automate reminders and payment before automation of production.'],
  },
  {
    title: 'Phase 2: semi-automatic kitchen',
    time: '2-8 weeks',
    blurb: 'Add a repeatable recipe, timed proofing, and a human operator who handles exceptions and loading.',
    items: ['One standing recipe and one standing delivery window.', 'A backup human can swap brands, sizes, or delivery times.', 'Inventory is checked by a person once or twice a week.'],
  },
  {
    title: 'Phase 3: pan-in, pan-out automation',
    time: '2-6 months',
    blurb: 'This is the practical automation target: dosing ingredients, proofing, loading a pan, baking, and telling the user when it is ready.',
    items: ['Ingredient hopper for flour, salt, and water metering.', 'Starter section and proofing section with temperature control.', 'User loads a pan and the system announces bake-ready and done.'],
  },
];

const interventions = [
  'Refill flour, salt, water, or starter',
  'Confirm a failed bake or missed delivery',
  'Swap recipes for seasonality or demand',
  'Clean food-contact surfaces and pans',
  'Load the pan into the oven when prompted',
];

const checklist = [
  ['Demand', 'How many loaves per week, and on which days?'],
  ['Supplier', 'Who bakes them, or what machine bakes them?'],
  ['Ordering', 'Is the order recurring, or triggered by inventory?'],
  ['Ingredients', 'How do flour, water, salt, and starter get metered in?'],
  ['User step', 'Does the user only place the pan and wait for the signal?'],
  ['Exceptions', 'What happens when a batch fails or a driver no-shows?'],
];

function App() {
  return (
    <main className="pageShell">
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">Automatic bread, pragmatically</p>
          <h1>The fastest path is not full automation first. It is a reliable bread service with human backup.</h1>
          <p className="lede">
            If the goal is an individual supply of bread, even twice a week is enough to start with a system that is
            complete, available, and simple. The practical sequence is: recurring order, dependable baker, then
            machine-assisted production where the user mainly loads a pan, waits, and gets told when the bread is ready.
          </p>
          <div className="actions">
            <a href="#path" className="primaryAction">
              See the path <ArrowRight size={18} />
            </a>
            <a href="#checklist" className="secondaryAction">
              What it takes
            </a>
          </div>
        </div>

        <aside className="heroCard">
          <div className="heroStat">
            <span>Target</span>
            <strong>2 loaves / week</strong>
          </div>
          <div className="heroStat">
            <span>Fastest useful setup</span>
            <strong>Recurring order + human operator</strong>
          </div>
          <div className="heroStat">
            <span>Automation level</span>
            <strong>Scheduling first, hardware second</strong>
          </div>
          <div className="heroNote">
            <HandHeart size={18} />
            Human intervention is acceptable. The point is to reduce it to loading a pan, refilling ingredients, and handling exceptions.
          </div>
        </aside>
      </section>

      <section className="band">
        <div className="bandGrid">
          <article>
            <Clock3 size={22} />
            <h2>Start with repeatability, not robotics.</h2>
            <p>
              Bread is a timing problem before it is a hardware problem. If the supply is late, stale, or inconsistent,
              the system has failed even if the machine was impressive.
            </p>
          </article>
          <article>
            <Cog size={22} />
            <h2>Automation should remove coordination work first.</h2>
            <p>
              The first win is a standing process: order, mix, proof, bake, cool, repeat. Only then does it make
              sense to replace human steps with equipment and notifications.
            </p>
          </article>
        </div>
      </section>

      <section id="path" className="contentSection">
        <div className="sectionHeader">
          <p className="eyebrow">Fastest path</p>
          <h2>A sensible ladder from available bread to pan-based automation</h2>
        </div>

        <div className="phaseGrid">
          {phases.map((phase) => (
            <article className="phaseCard" key={phase.title}>
              <div className="phaseTop">
                <Wheat size={20} />
                <span>{phase.time}</span>
              </div>
              <h3>{phase.title}</h3>
              <p>{phase.blurb}</p>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="contentSection split">
        <article className="panel">
          <div className="sectionHeader compact">
            <p className="eyebrow">Human role</p>
            <h2>What still needs a person</h2>
          </div>
          <ul className="tickList">
            {interventions.map((item) => (
              <li key={item}>
                <CheckCircle2 size={18} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel panelAccent">
          <div className="sectionHeader compact">
            <p className="eyebrow">Minimum viable system</p>
            <h2>What it would take</h2>
          </div>
          <div className="requirements">
            {checklist.map(([label, value]) => (
              <div className="requirement" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section id="checklist" className="contentSection callout">
        <Truck size={22} />
        <div>
          <h2>If you want the least-friction version, automate the ordering loop first, then automate the bake.</h2>
          <p>
            That gets you an individual bread supply quickly, keeps quality predictable, and gives you a real target
            before you invest in machines. If the volume grows, move from scheduled human baking to ingredient dosing,
            then to a system where the user places a pan, the machine handles proof and bake, and the machine tells
            the user exactly when to remove it.
          </p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
