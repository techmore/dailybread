import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import {
  ArrowRight,
  Box,
  CalendarDays,
  ChefHat,
  Factory,
  Layers3,
  PackageCheck,
  Play,
  Pause,
  RotateCcw,
  School,
  Scissors,
  Waves,
} from 'lucide-react';
import './styles.css';

const flourCostPerG = 11.34 / (12 * 453.592);
const saltCostPerG = 3.39 / (53 * 28.3495);

const recipes = {
  artisan: { label: '650g sourdough loaf', flourG: 360, waterG: 270, starterG: 70, saltG: 8, bakeMin: 38 },
  sliced: { label: '750g sliced school loaf', flourG: 420, waterG: 300, starterG: 80, saltG: 10, bakeMin: 42 }
};

const defaultAssumptions = {
  electricityRate: 0.17,
  laborRate: 22,
  schoolSlicedPrice: 3.15,
  schoolLoafPrice: 3.45,
  retailSlicedPrice: 5.75,
  retailLoafPrice: 6.5,
  slicedBagCost: 0.18,
  artisanBagCost: 0.11,
  ovenCapacity: 18,
  ovenKwhPerBatch: 3.2,
  utilityKwhPerScale: 2.4,
  dailyOverheadPerScale: 6,
  cleaningBaseL: 18,
  cleaningPerScaleL: 9,
  cleaningCycleL: 12,
  robotCleanHours: 4,
  deckOvenCost: 6000,
  robotArmCost: 799,
  endEffectorsCost: 2400,
  containerBuildoutCost: 22000,
  mixerPackageCost: 18500,
  controlsInstallCost: 14000
};

const dayStartMinutes = 6 * 60;

const workflowTemplates = [
  { id: 'mix', name: 'Mix', minutes: 20, detail: 'Flour, starter, water, and salt meter into the mixer.' },
  { id: 'proof', name: 'Bulk Proof', minutes: 180, detail: 'Dough tubs move to controlled proofing racks.' },
  { id: 'shape', name: 'Shape + Load', minutes: 25, detail: 'Robot arm stages trays and builds oven-ready loads.' },
  { id: 'bake', name: 'Bake', getMinutes: (model) => Math.max(52, Math.round(model.bakeHours * 60)), detail: (model) => `Atlas decks run ${model.batches} oven load${model.batches === 1 ? '' : 's'} at about ${Math.min(model.ovenCapacity, model.targetLoaves)} loaves per load.` },
  { id: 'cool', name: 'Cool', minutes: 90, detail: 'Finished loaves accumulate through cooling rack lanes.' },
  { id: 'slice', name: 'Slice + Bag', minutes: 40, detail: 'School loaves are sliced, bagged, and staged for delivery.' },
  { id: 'clean', name: 'Clean', minutes: 15, detail: 'Food-safe tools run a timed washdown cycle.' }
];

const ingredientFeed = [
  { label: 'Flour', short: 'F', color: '#efe3bf' },
  { label: 'Water', short: 'H2O', color: '#8fb3c7' },
  { label: 'Starter', short: 'S', color: '#d0a85c' },
  { label: 'Salt', short: 'NaCl', color: '#f7f7ef' }
];

const pages = ['overview', 'model', 'automation'];
const assumptionStorageKey = 'dailybreadAssumptions';

const assumptionMinimums = {
  electricityRate: 0,
  laborRate: 0,
  schoolSlicedPrice: 0,
  schoolLoafPrice: 0,
  retailSlicedPrice: 0,
  retailLoafPrice: 0,
  slicedBagCost: 0,
  artisanBagCost: 0,
  ovenCapacity: 1,
  ovenKwhPerBatch: 0,
  utilityKwhPerScale: 0,
  dailyOverheadPerScale: 0,
  cleaningBaseL: 0,
  cleaningPerScaleL: 0,
  cleaningCycleL: 0,
  robotCleanHours: 0.25,
  deckOvenCost: 0,
  robotArmCost: 0,
  endEffectorsCost: 0,
  containerBuildoutCost: 0,
  mixerPackageCost: 0,
  controlsInstallCost: 0
};

const sceneStations = [
  { id: 'mixer', label: 'MIX', position: [-3.45, 0.55, -0.7], size: [1.05, 1.1, 1.45], color: '#243235', labelPosition: [-3.45, 1.62, -0.72] },
  { id: 'proof', label: 'PROOF', position: [-2.05, 0.42, 0.85], size: [1.2, 0.75, 0.9], color: '#c99f4f', labelPosition: [-2.05, 1.25, 0.9] },
  { id: 'oven', label: 'OVEN', position: [-0.45, 0.38, -0.85], size: [1.35, 0.75, 0.75], color: '#b45435', labelPosition: [-0.45, 1.22, -0.9] },
  { id: 'cool', label: 'COOL', position: [1.35, 0.65, -0.85], size: [1.25, 1.3, 0.7], color: '#526169', labelPosition: [1.35, 1.55, -0.9] },
  { id: 'slice', label: 'SLICE', position: [3, 0.42, 0.8], size: [1.05, 0.85, 1.25], color: '#6f805d', labelPosition: [3, 1.25, 0.85] },
  { id: 'bag', label: 'BAG', position: [4, 0.35, -0.65], size: [0.75, 0.7, 0.95], color: '#aeb7b6', labelPosition: [4, 1.05, -0.65] }
];

const scenePathPoints = [
  [-3.45, 0.35, -0.1],
  [-2.05, 0.35, 0.75],
  [-0.45, 0.35, -0.55],
  [1.35, 0.35, -0.55],
  [3, 0.35, 0.65],
  [4, 0.35, -0.45]
];

const robotArmPositions = [-0.95, 1.8];

const formatMoney = (n) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const formatSmallMoney = (n) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format1 = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const formatUnitMoney = (n) => (n > 0 && n < 1 ? formatSmallMoney(n) : formatMoney(n));

function formatDuration(minutes) {
  const rounded = Math.max(1, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (!hours) {
    return `${rounded} min`;
  }
  return remainder ? `${hours}h ${remainder}m` : `${hours} hr`;
}

function formatClock(offsetMinutes) {
  const minutesFromMidnight = (dayStartMinutes + Math.round(offsetMinutes)) % (24 * 60);
  const hour24 = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function getWorkflowSchedule(model) {
  const rawStages = workflowTemplates.map((template) => {
    const minutes = template.getMinutes ? template.getMinutes(model) : template.minutes;
    return {
      ...template,
      minutes,
      duration: formatDuration(minutes),
      detail: typeof template.detail === 'function' ? template.detail(model) : template.detail
    };
  });
  const totalMinutes = rawStages.reduce((sum, stage) => sum + stage.minutes, 0);
  let cursor = 0;
  const stages = rawStages.map((stage) => {
    const startMinute = cursor;
    cursor += stage.minutes;
    return {
      ...stage,
      startMinute,
      endMinute: cursor,
      startLabel: formatClock(startMinute),
      endLabel: formatClock(cursor),
      share: stage.minutes / totalMinutes
    };
  });

  return { stages, totalMinutes };
}

function getStageIndexForPhase(schedule, phase) {
  const currentMinute = (clampNumber(phase, 0, 0, 100) / 100) * schedule.totalMinutes;
  const index = schedule.stages.findIndex((stage) => currentMinute >= stage.startMinute && currentMinute < stage.endMinute);
  return index === -1 ? schedule.stages.length - 1 : index;
}

function getWorkflowTelemetry(model, schedule, phase, stageIndex) {
  const currentMinute = (clampNumber(phase, 0, 0, 100) / 100) * schedule.totalMinutes;
  const currentStage = schedule.stages[stageIndex] || schedule.stages[0];
  const bakeStage = schedule.stages.find((stage) => stage.id === 'bake');
  const bakeElapsed = bakeStage ? clampNumber(currentMinute - bakeStage.startMinute, 0, 0, bakeStage.minutes) : 0;
  const activeBatch = bakeStage && currentMinute >= bakeStage.startMinute
    ? Math.min(model.batches, Math.max(1, Math.ceil((bakeElapsed / bakeStage.minutes) * model.batches)))
    : 0;
  const completedLoaves = Math.min(model.targetLoaves, Math.round((currentMinute / schedule.totalMinutes) * model.targetLoaves));

  return {
    clock: formatClock(currentMinute),
    stageWindow: `${currentStage.startLabel}-${currentStage.endLabel}`,
    activeBatch,
    completedLoaves,
    cleanStatus: currentStage.id === 'clean' ? 'Washdown running' : 'Queued after packout'
  };
}

function clampNumber(value, fallback, min = 0, max = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function clampInteger(value, fallback, min, max) {
  return Math.round(clampNumber(value, fallback, min, max));
}

function sanitizeAssumptions(input = {}) {
  return Object.fromEntries(
    Object.entries(defaultAssumptions).map(([key, fallback]) => [
      key,
      clampNumber(input[key], fallback, assumptionMinimums[key] ?? 0)
    ])
  );
}

function readSavedAssumptions() {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    return JSON.parse(window.localStorage.getItem(assumptionStorageKey)) || {};
  } catch {
    return {};
  }
}

function readInitialState() {
  if (typeof window === 'undefined') {
    return {
      page: 'overview',
      loaves: 50,
      multiplier: 1,
      school: true,
      sliced: true,
      assumptions: defaultAssumptions
    };
  }

  const params = new URLSearchParams(window.location.search);
  const page = pages.includes(params.get('page')) ? params.get('page') : 'overview';
  return {
    page,
    loaves: clampInteger(params.get('loaves'), 50, 10, 10000),
    multiplier: clampInteger(params.get('scale'), 1, 1, 100),
    school: params.get('school') === null ? true : params.get('school') !== '0',
    sliced: params.get('sliced') === null ? true : params.get('sliced') !== '0',
    assumptions: sanitizeAssumptions({ ...defaultAssumptions, ...readSavedAssumptions() })
  };
}

function persistScenario({ page, loaves, multiplier, school, sliced }) {
  if (typeof window === 'undefined') {
    return;
  }
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('loaves', String(loaves));
  params.set('scale', String(multiplier));
  params.set('school', school ? '1' : '0');
  params.set('sliced', sliced ? '1' : '0');
  const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
}

function getEquipmentUnits(multiplier) {
  return Math.max(1, Math.ceil(multiplier / 3));
}

function getEquipmentRows(multiplier, assumptions) {
  const equipmentUnits = getEquipmentUnits(multiplier);
  const ovenQty = Math.max(1, Math.ceil(multiplier / 4));

  return [
    ['Atlas Craft 3 steam deck oven', ovenQty, assumptions.deckOvenCost, 'Midpoint of $5k-$7k quote'],
    ['Elephant Robotics mechArm Pi', 2 * equipmentUnits, assumptions.robotArmCost, 'Compact 6-axis arm reference'],
    ['Food-safe grippers, peel/end effectors, guards', equipmentUnits, assumptions.endEffectorsCost, 'Robot tooling and guarding allowance'],
    ['Insulated 20 ft container buildout', equipmentUnits, assumptions.containerBuildoutCost, 'Shell, paneling, HVAC, washable interior'],
    ['Mixer, racks, slicer, bagger, sink package', equipmentUnits, assumptions.mixerPackageCost, 'Micro-bakery production package'],
    ['Controls, sensors, drains, electrical install', equipmentUnits, assumptions.controlsInstallCost, 'Integration, safety, utility allowance']
  ];
}

function computeModel({ loaves, multiplier, school, sliced, assumptions }) {
  const safeAssumptions = sanitizeAssumptions(assumptions);
  const safeLoaves = clampInteger(loaves, 50, 1, 10000);
  const safeMultiplier = clampInteger(multiplier, 1, 1, 100);
  const targetLoaves = safeLoaves * safeMultiplier;
  const recipe = sliced ? recipes.sliced : recipes.artisan;
  const batches = Math.ceil(targetLoaves / safeAssumptions.ovenCapacity);
  const bakeHours = (batches * recipe.bakeMin + 14 * batches) / 60;
  const flourKg = (recipe.flourG * targetLoaves) / 1000;
  const waterL = (recipe.waterG * targetLoaves) / 1000;
  const starterKg = (recipe.starterG * targetLoaves) / 1000;
  const saltKg = (recipe.saltG * targetLoaves) / 1000;
  const flourCost = recipe.flourG * targetLoaves * flourCostPerG;
  const saltCost = recipe.saltG * targetLoaves * saltCostPerG;
  const electricityKwh = batches * safeAssumptions.ovenKwhPerBatch + safeAssumptions.utilityKwhPerScale * safeMultiplier;
  const electricityCost = electricityKwh * safeAssumptions.electricityRate;
  const bagCost = sliced ? safeAssumptions.slicedBagCost : safeAssumptions.artisanBagCost;
  const packagingCost = targetLoaves * bagCost;
  const cleaningWater = safeAssumptions.cleaningBaseL + safeMultiplier * safeAssumptions.cleaningPerScaleL + Math.ceil(bakeHours / safeAssumptions.robotCleanHours) * safeAssumptions.cleaningCycleL;
  const laborHours = school ? 1.8 + safeMultiplier * 0.5 : 2.4 + safeMultiplier * 0.7;
  const laborCost = laborHours * safeAssumptions.laborRate;
  const dailyCost = flourCost + saltCost + electricityCost + packagingCost + laborCost + safeAssumptions.dailyOverheadPerScale * safeMultiplier;
  const unitCost = dailyCost / targetLoaves;
  const price = school ? (sliced ? safeAssumptions.schoolSlicedPrice : safeAssumptions.schoolLoafPrice) : (sliced ? safeAssumptions.retailSlicedPrice : safeAssumptions.retailLoafPrice);
  const revenue = price * targetLoaves * (school ? 5 : 1);
  const weeklyCost = dailyCost * (school ? 5 : 1);
  const gross = revenue - weeklyCost;
  const ovenUtilization = Math.min(100, (targetLoaves / (batches * safeAssumptions.ovenCapacity)) * 100);

  return {
    targetLoaves,
    recipe,
    ovenCapacity: safeAssumptions.ovenCapacity,
    batches,
    bakeHours,
    flourKg,
    waterL,
    starterKg,
    saltKg,
    flourCost,
    saltCost,
    electricityKwh,
    electricityCost,
    packagingCost,
    cleaningWater,
    laborHours,
    laborCost,
    dailyCost,
    unitCost,
    price,
    revenue,
    weeklyCost,
    gross,
    ovenUtilization
  };
}

function App() {
  const initialState = useMemo(() => readInitialState(), []);
  const [page, setPage] = useState(initialState.page);
  const [loaves, setLoaves] = useState(initialState.loaves);
  const [multiplier, setMultiplier] = useState(initialState.multiplier);
  const [school, setSchool] = useState(initialState.school);
  const [sliced, setSliced] = useState(initialState.sliced);
  const [assumptions, setAssumptions] = useState(initialState.assumptions);
  const safeAssumptions = useMemo(() => sanitizeAssumptions(assumptions), [assumptions]);
  const model = useMemo(() => computeModel({ loaves, multiplier, school, sliced, assumptions: safeAssumptions }), [loaves, multiplier, school, sliced, safeAssumptions]);
  const overviewModel = useMemo(() => computeModel({ loaves: 50, multiplier: 1, school: true, sliced: true, assumptions: safeAssumptions }), [safeAssumptions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(assumptionStorageKey, JSON.stringify(safeAssumptions));
    } catch {
      // Private browsing or locked-down demo devices can block storage.
    }
  }, [safeAssumptions]);

  useEffect(() => {
    persistScenario({ page, loaves, multiplier, school, sliced });
  }, [page, loaves, multiplier, school, sliced]);

  return (
    <main>
      <Nav page={page} setPage={setPage} />
      {page === 'overview' && <Overview model={overviewModel} setPage={setPage} />}
      {page === 'model' && (
        <Model
          model={model}
          loaves={loaves}
          setLoaves={setLoaves}
          multiplier={multiplier}
          setMultiplier={setMultiplier}
          school={school}
          setSchool={setSchool}
          sliced={sliced}
          setSliced={setSliced}
          assumptions={safeAssumptions}
          setAssumptions={setAssumptions}
        />
      )}
      {page === 'automation' && <Automation model={model} multiplier={multiplier} setMultiplier={setMultiplier} assumptions={safeAssumptions} />}
      <Footer />
    </main>
  );
}

function Nav({ page, setPage }) {
  return (
    <header className="nav">
      <button className="brand" onClick={() => setPage('overview')}>
        <ChefHat size={22} /> DailyBread Pilot
      </button>
      <nav>
        {[
          ['overview', 'Project'],
          ['model', 'Model'],
          ['automation', 'Automation']
        ].map(([id, label]) => (
          <button className={page === id ? 'active' : ''} onClick={() => setPage(id)} key={id}>
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function Overview({ model, setPage }) {
  return (
    <>
      <section className="hero">
        <div className="heroText">
          <p className="eyebrow">From dough to cadence</p>
          <h1>A practical operating model for daily sourdough production.</h1>
          <p>Plan ingredients, baking time, oven capacity, cleaning cycles, school pricing, slicing, and container-scale automation from the same control surface.</p>
          <div className="actions">
            <button onClick={() => setPage('model')}>
              Open calculator <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => setPage('automation')}>
              View container model
            </button>
          </div>
          <div className="chips">
            <span>50 loaf lunch target</span>
            <span>Atlas Craft 3 oven</span>
            <span>School delivery mode</span>
          </div>
        </div>
        <Dashboard model={model} />
      </section>
      <section className="band">
        <h2>Baking work organized into a repeatable operating model.</h2>
        <div className="grid3">
          <Feature icon={CalendarDays} title="Daily Production" text="Mix, bulk ferment, proof, bake, cool, slice, bag, and stage delivery against a lunch deadline." />
          <Feature icon={PackageCheck} title="Supply Ledger" text="Flour, salt, water, starter, bags, electricity, labor, and cleaning water scale with the loaf target." />
          <Feature icon={Factory} title="Automation Path" text="Compare 20 ft and 40 ft container layouts with robot handling, oven position, racks, sink, and staging zones." />
        </div>
      </section>
    </>
  );
}

function Dashboard({ model }) {
  return (
    <aside className="dash">
      <div className="dashHead">
        <span>Bakery cadence</span>
        <b>Active</b>
      </div>
      <div className="big">{model.targetLoaves}</div>
      <p>loaves planned</p>
      <div className="metrics">
        <Metric label="Batches" value={model.batches} />
        <Metric label="Bake time" value={`${format1(model.bakeHours)}h`} />
        <Metric label="Unit cost" value={formatMoney(model.unitCost)} />
        <Metric label="Water" value={`${format1(model.waterL + model.cleaningWater)}L`} />
      </div>
    </aside>
  );
}

function Model(props) {
  const { model, loaves, setLoaves, multiplier, setMultiplier, school, setSchool, sliced, setSliced, assumptions, setAssumptions } = props;
  const rows = [
    ['Flour', `${format1(model.flourKg)} kg`, formatMoney(model.flourCost)],
    ['Salt', `${format1(model.saltKg)} kg`, formatMoney(model.saltCost)],
    ['Starter', `${format1(model.starterKg)} kg`, 'tracked culture'],
    ['Dough water', `${format1(model.waterL)} L`, 'municipal'],
    ['Cleaning water', `${format1(model.cleaningWater)} L`, `${assumptions.robotCleanHours}h robot washdown`],
    ['Electricity', `${format1(model.electricityKwh)} kWh`, formatSmallMoney(model.electricityCost)],
    ['Packaging', `${model.targetLoaves} bags`, formatMoney(model.packagingCost)],
    ['Labor oversight', `${format1(model.laborHours)} h`, formatMoney(model.laborCost)]
  ];

  return (
    <section className="page">
      <div className="pageHead">
        <p className="eyebrow">Spreadsheet logic</p>
        <h1>Production, cost, and school delivery model.</h1>
      </div>
      <div className="modelLayout">
        <Panel title="Controls">
          <Control label="Base loaves" value={loaves} min="10" max="250" onChange={setLoaves} />
          <label>Scale multiplier</label>
          <div className="segments">
            {[1, 2, 3, 4, 5, 6, 8, 10].map((x) => (
              <button className={x === multiplier ? 'selected' : ''} onClick={() => setMultiplier(x)} key={x}>
                x{x}
              </button>
            ))}
          </div>
          <Toggle icon={School} label="Monday-Friday school pricing" value={school} setValue={setSchool} />
          <Toggle icon={Scissors} label="Sliced and bagged" value={sliced} setValue={setSliced} />
        </Panel>
        <Panel title="Daily Output">
          <div className="kpiRow">
            <Metric label="Target" value={model.targetLoaves} />
            <Metric label="Oven batches" value={model.batches} />
            <Metric label="Bake window" value={`${format1(model.bakeHours)}h`} />
            <Metric label="Atlas fill" value={`${format1(model.ovenUtilization)}%`} />
          </div>
          <table>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  <th>{r[0]}</th>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Financial Readout">
          <div className="finance">
            <Metric label={school ? 'Weekly revenue' : 'Daily revenue'} value={formatMoney(model.revenue)} />
            <Metric label={school ? 'Weekly cost' : 'Daily cost'} value={formatMoney(model.weeklyCost)} />
            <Metric label="Gross margin" value={formatMoney(model.gross)} />
            <Metric label="Cost per loaf" value={formatSmallMoney(model.unitCost)} />
          </div>
          <p className="note">The readout above is driven by the itemized reference inputs below. Adjust the editable assumptions to test local pricing, labor, utility rates, or alternate equipment quotes.</p>
        </Panel>
        <Panel title="Reference Inputs">
          <ReferenceInputs assumptions={assumptions} />
        </Panel>
        <Panel title="Editable Assumptions">
          <AssumptionEditor assumptions={assumptions} setAssumptions={setAssumptions} />
        </Panel>
      </div>
    </section>
  );
}

function ReferenceInputs({ assumptions }) {
  const groups = [
    {
      title: 'Ingredient References',
      items: [
        'King Arthur Baking Company Unbleached Bread Flour, 12 lb bag: $11.34, about $0.06/oz.',
        'Morton Coarse Kosher Salt, 53 oz: $3.39.',
        'Sliced school loaf recipe basis: 750g dough, 420g flour, 300g water, 80g starter, 10g salt.',
        'Artisan loaf recipe basis: 650g dough, 360g flour, 270g water, 70g starter, 8g salt.'
      ]
    },
    {
      title: 'Equipment References',
      items: [
        `Atlas Craft 3 steam deck oven: ${formatMoney(assumptions.deckOvenCost)} midpoint from the $5k-$7k quote.`,
        `${assumptions.ovenCapacity} loaves per oven batch based on 3 decks and 18 total 650g loaf capacity.`,
        `Elephant Robotics mechArm Pi compact 6-axis robot arm: ${formatMoney(assumptions.robotArmCost)} per unit, modeled as two arms per container unit.`,
        `20 ft insulated container buildout allowance: ${formatMoney(assumptions.containerBuildoutCost)} per container unit.`,
        `Mixer, racks, slicer, bagger, sink package allowance: ${formatMoney(assumptions.mixerPackageCost)} per container unit.`,
        `Controls, sensors, drains, and electrical install allowance: ${formatMoney(assumptions.controlsInstallCost)} per container unit.`
      ]
    },
    {
      title: 'Operating Assumptions',
      items: [
        `Electricity modeled at ${formatSmallMoney(assumptions.electricityRate)}/kWh.`,
        `Oven consumption modeled at ${format1(assumptions.ovenKwhPerBatch)} kWh per batch plus ${format1(assumptions.utilityKwhPerScale)} kWh per scale unit.`,
        `Labor oversight modeled at ${formatMoney(assumptions.laborRate)}/hr.`,
        `Robot cleaning mode modeled every ${assumptions.robotCleanHours} hours, using ${assumptions.cleaningCycleL} L per clean cycle.`,
        `Daily overhead allowance modeled at ${formatMoney(assumptions.dailyOverheadPerScale)} per scale unit.`
      ]
    },
    {
      title: 'Sales and Packaging',
      items: [
        `School sliced price: ${formatSmallMoney(assumptions.schoolSlicedPrice)} per loaf, Monday-Friday mode.`,
        `School whole loaf price: ${formatSmallMoney(assumptions.schoolLoafPrice)} per loaf.`,
        `Retail sliced price: ${formatSmallMoney(assumptions.retailSlicedPrice)} per loaf.`,
        `Retail whole loaf price: ${formatSmallMoney(assumptions.retailLoafPrice)} per loaf.`,
        `Packaging modeled at ${formatSmallMoney(assumptions.slicedBagCost)} per sliced bag and ${formatSmallMoney(assumptions.artisanBagCost)} per artisan bag.`
      ]
    }
  ];

  return (
    <div className="referenceGrid">
      {groups.map((group) => (
        <section className="referenceGroup" key={group.title}>
          <h3>{group.title}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AssumptionEditor({ assumptions, setAssumptions }) {
  const update = (key, value) => setAssumptions((current) => sanitizeAssumptions({ ...current, [key]: value }));
  const fields = [
    ['electricityRate', 'Electricity $/kWh', 0.01, 0],
    ['laborRate', 'Labor $/hr', 1, 0],
    ['schoolSlicedPrice', 'School sliced price', 0.05, 0],
    ['retailSlicedPrice', 'Retail sliced price', 0.05, 0],
    ['slicedBagCost', 'Sliced bag cost', 0.01, 0],
    ['ovenCapacity', 'Oven loaves/batch', 1, 1],
    ['ovenKwhPerBatch', 'Oven kWh/batch', 0.1, 0],
    ['robotCleanHours', 'Clean cycle hours', 0.5, 0.25],
    ['deckOvenCost', 'Atlas oven cost', 100, 0],
    ['robotArmCost', 'Robot arm cost', 25, 0],
    ['containerBuildoutCost', '20 ft buildout cost', 500, 0],
    ['controlsInstallCost', 'Controls/install cost', 500, 0]
  ];

  return (
    <div className="assumptionGrid">
      {fields.map(([key, label, step, min]) => (
        <NumberInput key={key} label={label} value={assumptions[key]} step={step} min={min} onChange={(value) => update(key, value)} />
      ))}
    </div>
  );
}

function Automation({ model, multiplier, setMultiplier, assumptions }) {
  const containers = multiplier <= 2 ? 'One 20 ft container' : multiplier <= 5 ? 'Two 20 ft containers sharing oven/service spine' : 'One 40 ft container plus staging annex';
  const capex = getEquipmentRows(multiplier, assumptions).reduce((sum, [, qty, unit]) => sum + qty * unit, 0);

  return (
    <section className="page">
      <div className="pageHead">
        <p className="eyebrow">Automated concept</p>
        <h1>Container bakery with robotic dough and oven handling.</h1>
      </div>
      <div className="pitchStrip">
        <Metric label="Lunch output" value={`${model.targetLoaves} loaves`} />
        <Metric label="Bake cycle" value={`${model.batches} batches`} />
        <Metric label="Concept CAPEX" value={formatMoney(capex)} />
        <Metric label="Water/day" value={`${format1(model.waterL + model.cleaningWater)} L`} />
      </div>
      <section className="workflowShowcase">
        <div className="workflowHeader">
          <div>
            <p className="eyebrow">Production line in motion</p>
            <h2>Watch ingredients become a staged school lunch run.</h2>
            <div className="ingredientLegend">
              {ingredientFeed.map((item) => (
                <span key={item.label}>
                  <b style={{ background: item.color }}>{item.short}</b>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="segments">
            {[1, 2, 3, 4, 5, 8].map((x) => (
              <button className={x === multiplier ? 'selected' : ''} onClick={() => setMultiplier(x)} key={x}>
                x{x}
              </button>
            ))}
          </div>
        </div>
        <ContainerScene model={model} multiplier={multiplier} />
      </section>
      <div className="autoGrid">
        <Panel title="Recommended Configuration">
          <div className="stack">
            <Metric label="Configuration" value={containers} />
            <Metric label="Robot wash cycle" value={`Every ${assumptions.robotCleanHours}h`} />
            <Metric label="Unit cost" value={formatSmallMoney(model.unitCost)} />
          </div>
          <CostTable multiplier={multiplier} assumptions={assumptions} />
        </Panel>
        <Panel title="Batch Timing Detail">
          <div className="timingGrid">
            <Metric label="Mix + shape" value="45 min" />
            <Metric label="Bulk/proof time" value="3 hr" />
            <Metric label="Oven loads" value={model.batches} />
            <Metric label="Bake window" value={`${format1(model.bakeHours)}h`} />
          </div>
          <p className="note">The animated line compresses the day into a loop: ingredient metering, mix, proof, robotic loading, bake, cool, slice, bag, and clean. The financial model still uses the loaf count and oven batch math above.</p>
        </Panel>
      </div>
      <Panel title="Purchase List and Pricing Assumptions">
        <PurchaseList model={model} multiplier={multiplier} assumptions={assumptions} />
      </Panel>
      <section className="band slim">
        <h2>Automation modules</h2>
        <div className="grid4">
          <Feature icon={Box} title="Mix and Bulk" text="Spiral mixer, dough tub lift, fermentation rack, flour bin, starter fridge." />
          <Feature icon={Layers3} title="Proof and Stage" text="Mobile rack lanes hold shaped loaves while the oven cycles through 18-loaf loads." />
          <Feature icon={RotateCcw} title="Robot Handling" text="Compact 6-axis arms move trays, score loaves, load decks, unload cooling racks, and enter cleaning mode." />
          <Feature icon={Waves} title="Steam and Clean" text="Steam deck oven, floor drain, food-safe end effectors, and washdown schedule." />
        </div>
      </section>
    </section>
  );
}

function ContainerScene({ model, multiplier }) {
  const mount = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [sceneError, setSceneError] = useState(false);
  const schedule = useMemo(() => getWorkflowSchedule(model), [model]);
  const currentStage = schedule.stages[stageIndex] || schedule.stages[0];
  const telemetry = getWorkflowTelemetry(model, schedule, phase, stageIndex);
  const playingRef = useRef(playing);
  const phaseRef = useRef(0);
  const stageRef = useRef(0);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const el = mount.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f7f2e8');
    const camera = new THREE.PerspectiveCamera(30, el.clientWidth / el.clientHeight, 0.1, 100);
    const cameraTarget = new THREE.Vector3(0, 0.55, 0);
    camera.position.set(6.8, 5.35, 8.05);
    camera.lookAt(cameraTarget);

    const rendererCanvas = document.createElement('canvas');
    const contextOptions = { antialias: true };
    const webglContext = rendererCanvas.getContext('webgl2', contextOptions) || rendererCanvas.getContext('webgl', contextOptions);
    if (!webglContext) {
      setSceneError(true);
      return undefined;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: rendererCanvas, context: webglContext, antialias: true });
      setSceneError(false);
    } catch {
      setSceneError(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7b6a52, 2.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    const addBox = (x, y, z, w, h, d, color, opacity = 1) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.68, transparent: opacity < 1, opacity });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    };

    const addLabel = (text, x, y, z) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(27, 34, 31, 0.88)';
      ctx.roundRect(18, 18, 476, 78, 18);
      ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.font = '700 42px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(text, 256, 70);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(1.5, 0.38, 1);
      scene.add(sprite);
      return sprite;
    };

    const addDimensionLabel = (text, x, y, z) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255, 250, 240, 0.94)';
      ctx.roundRect(18, 18, 476, 78, 18);
      ctx.fill();
      ctx.strokeStyle = '#9c442e';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = '#1a2421';
      ctx.font = '800 38px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(text, 256, 70);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(1.55, 0.38, 1);
      scene.add(sprite);
      return sprite;
    };

    const addDimensionLine = (start, end, label, labelPosition, tickAxis = 'y') => {
      const material = new THREE.LineBasicMaterial({ color: '#9c442e', linewidth: 2 });
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      scene.add(new THREE.Line(geometry, material));

      const tickSize = 0.22;
      const tickBox = (point) => {
        const dimensions = tickAxis === 'x' ? [tickSize, 0.04, 0.04] : tickAxis === 'z' ? [0.04, 0.04, tickSize] : [0.04, tickSize, 0.04];
        addBox(point.x, point.y, point.z, dimensions[0], dimensions[1], dimensions[2], '#9c442e');
      };

      tickBox(start);
      tickBox(end);
      addDimensionLabel(label, labelPosition.x, labelPosition.y, labelPosition.z);
    };

    const addIngredientBadge = (item, x, y, z) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(128, 112, 72, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a2421';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = '#1a2421';
      ctx.font = item.short.length > 1 ? '800 44px Arial' : '900 76px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.short, 128, 130);
      ctx.font = '700 24px Arial';
      ctx.fillText(item.label, 128, 218);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(0.72, 0.72, 1);
      scene.add(sprite);
      return sprite;
    };

    const floorW = multiplier > 5 ? 12.4 : 10.4;
    const moduleCount = multiplier <= 2 ? 1 : multiplier <= 5 ? 2 : 3;
    const laneCount = Math.min(4, Math.max(1, Math.ceil(multiplier / 2)));
    const ovenQueueCount = Math.min(6, Math.max(1, model.batches));
    addBox(0, -0.08, 0, floorW, 0.12, 3.6, '#d8c89f');
    addBox(0, 1.05, -1.92, floorW, 2.35, 0.05, '#d8c89f', 0.28);
    addBox(-floorW / 2, 1.05, 0, 0.05, 2.35, 3.6, '#d8c89f', 0.22);
    addBox(floorW / 2, 1.05, 0, 0.05, 2.35, 3.6, '#d8c89f', 0.22);
    for (let i = 1; i < moduleCount; i += 1) {
      const x = -floorW / 2 + (floorW / moduleCount) * i;
      addBox(x, 0.03, 0, 0.04, 0.18, 3.45, '#9c442e', 0.65);
      addLabel(`MODULE ${i + 1}`, x + 0.42, 0.42, 1.62);
    }
    addDimensionLine(
      new THREE.Vector3(-floorW / 2, 0.05, 2.08),
      new THREE.Vector3(floorW / 2, 0.05, 2.08),
      multiplier > 5 ? '40 ft length' : '20 ft length',
      new THREE.Vector3(0, 0.34, 2.28),
      'z'
    );
    addDimensionLine(
      new THREE.Vector3(-floorW / 2 + 0.75, 0.06, -1.8),
      new THREE.Vector3(-floorW / 2 + 0.75, 0.06, 1.8),
      '8 ft width',
      new THREE.Vector3(-floorW / 2 + 1.15, 0.42, 0.25),
      'x'
    );
    addDimensionLine(
      new THREE.Vector3(-floorW / 2 - 0.32, -0.02, -1.82),
      new THREE.Vector3(-floorW / 2 - 0.32, 2.28, -1.82),
      '8.5 ft height',
      new THREE.Vector3(-floorW / 2 - 0.68, 1.24, -1.82),
      'x'
    );

    const stationMeshes = Object.fromEntries(
      sceneStations.map((station) => {
        const [x, y, z] = station.position;
        const [w, h, d] = station.size;
        return [station.id, addBox(x, y, z, w, h, d, station.color)];
      })
    );
    sceneStations.forEach((station) => addLabel(station.label, ...station.labelPosition));

    const mixer = stationMeshes.mixer;
    const mixerDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.78, 28), new THREE.MeshStandardMaterial({ color: '#f0e0b5', roughness: 0.82 }));
    mixerDrum.rotation.x = Math.PI / 2;
    mixerDrum.position.set(-3.45, 0.68, -0.7);
    scene.add(mixerDrum);

    for (let lane = 0; lane < laneCount; lane += 1) {
      const z = 1.48 - lane * 0.36;
      for (let i = 0; i < Math.min(7, multiplier + 2); i += 1) {
        addBox(-3.6 + i * 1.15, 0.22, z, 0.48, 0.28, 0.58, lane === 0 ? '#caa15a' : '#d6b56f');
      }
    }
    if (multiplier > 2) {
      addBox(-0.45, 0.08, -1.46, 2.35, 0.1, 0.16, '#9c442e', 0.8);
      addLabel('SHARED OVEN SPINE', -0.45, 1.62, -1.5);
    }
    for (let i = 0; i < ovenQueueCount; i += 1) {
      addBox(-1.2 + i * 0.28, 0.14, -1.28, 0.18, 0.12, 0.28, '#e2b84f');
    }

    addLabel('INGREDIENT FEED', -4.75, 1.2, 0.9);

    const ingredientSources = ingredientFeed.map((item, index) => ({
      item,
      start: new THREE.Vector3(-5.05, 0.72 + index * 0.03, -1.35 + index * 0.58),
      end: new THREE.Vector3(-3.58, 0.9, -0.72),
      badge: addIngredientBadge(item, -5.05, 0.72 + index * 0.03, -1.35 + index * 0.58)
    }));

    const pathPoints = scenePathPoints.map((point) => new THREE.Vector3(...point));
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, 0.025, 8),
      new THREE.MeshStandardMaterial({ color: '#8fa765', emissive: '#314200', emissiveIntensity: 0.15 })
    );
    scene.add(tube);

    const createTray = (index) => {
      const trayGroup = new THREE.Group();
      const trayBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.08, 0.34),
        new THREE.MeshStandardMaterial({ color: index === 0 ? '#9b6b38' : '#b98246', roughness: 0.68 })
      );
      trayGroup.add(trayBase);
      for (let i = 0; i < 3; i += 1) {
        const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12), new THREE.MeshStandardMaterial({ color: '#c9823b', roughness: 0.9 }));
        loaf.scale.set(1.35, 0.55, 0.8);
        loaf.position.set(-0.2 + i * 0.2, 0.12, 0);
        trayGroup.add(loaf);
      }
      scene.add(trayGroup);
      return trayGroup;
    };
    const trayGroups = Array.from({ length: Math.min(10, Math.max(3, model.batches + moduleCount)) }, (_, index) => createTray(index));

    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: '#e2b84f', emissive: '#c88e17', emissiveIntensity: 0.7 }));
    scene.add(pulse);

    const armGroups = robotArmPositions.map((x) => {
      const group = new THREE.Group();
      group.position.set(x, 0.12, 0.05);
      const mat = new THREE.MeshStandardMaterial({ color: '#e0ad3f', metalness: 0.25, roughness: 0.42 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.18), mat);
      group.add(base);
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), mat);
      lower.position.set(0.24, 0.55, 0);
      lower.rotation.z = -0.45;
      group.add(lower);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.14), mat);
      upper.position.set(0.62, 0.92, 0);
      upper.rotation.z = 0.7;
      group.add(upper);
      scene.add(group);
      return { group, lower, upper };
    });

    let raf;
    let lastPhaseUiUpdate = 0;
    let lastElapsed = 0;
    const startedAt = performance.now();
    const armPoses = {
      mix: [{ y: -0.65, z: -0.08, lower: -0.72, upper: 0.98 }, { y: -0.2, z: 0.04, lower: -0.45, upper: 0.72 }],
      proof: [{ y: -0.48, z: 0.02, lower: -0.5, upper: 0.84 }, { y: 0.2, z: 0.04, lower: -0.36, upper: 0.64 }],
      shape: [{ y: -0.2, z: -0.04, lower: -0.42, upper: 0.7 }, { y: -0.75, z: -0.1, lower: -0.76, upper: 1.04 }],
      bake: [{ y: -0.05, z: 0.02, lower: -0.34, upper: 0.62 }, { y: -0.95, z: -0.14, lower: -0.82, upper: 1.12 }],
      cool: [{ y: 0.15, z: 0.04, lower: -0.34, upper: 0.62 }, { y: 0.72, z: 0.08, lower: -0.5, upper: 0.82 }],
      slice: [{ y: 0.4, z: 0.04, lower: -0.36, upper: 0.66 }, { y: 0.92, z: 0.1, lower: -0.62, upper: 0.94 }],
      clean: [{ y: 0, z: 0.18, lower: -0.2, upper: 0.35 }, { y: 0, z: -0.18, lower: -0.2, upper: 0.35 }]
    };
    const applyPhase = (t, elapsed) => {
      trayGroups.forEach((trayGroup, index) => {
        const trayT = clampNumber(t - index * 0.035, 0, 0, 0.99);
        const pos = curve.getPointAt(trayT);
        pos.z += (index % laneCount) * 0.18 - 0.08;
        pos.y += Math.floor(index / Math.max(1, laneCount)) * 0.03;
        trayGroup.position.copy(pos);
        trayGroup.visible = index === 0 || t > index * 0.035;
      });
      pulse.position.copy(curve.getPointAt((t + 0.08) % 1));
      pulse.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.22);
      mixer.rotation.y = Math.sin(elapsed * 5) * 0.03;
      mixerDrum.rotation.z = elapsed * 2.8;
      scene.rotation.y = Math.sin(elapsed * 0.18) * 0.12;
      ingredientSources.forEach(({ start, end, badge }, index) => {
        const feedT = (t * 1.6 + index * 0.19) % 1;
        const eased = feedT < 0.78 ? feedT / 0.78 : 0;
        badge.position.lerpVectors(start, end, eased);
        badge.position.y += Math.sin(feedT * Math.PI) * 0.28;
        badge.material.opacity = feedT < 0.82 ? 1 : 0.25;
      });
      const nextStage = getStageIndexForPhase(schedule, t * 100);
      const poseSet = armPoses[schedule.stages[nextStage]?.id] || armPoses.mix;
      armGroups.forEach((arm, index) => {
        const pose = poseSet[index] || poseSet[0];
        arm.group.rotation.y = pose.y + Math.sin(elapsed * 2 + index) * 0.04;
        arm.group.rotation.z = pose.z;
        arm.lower.rotation.z = pose.lower;
        arm.upper.rotation.z = pose.upper;
      });
      if (stageRef.current !== nextStage) {
        stageRef.current = nextStage;
        setStageIndex(nextStage);
      }
    };

    const animate = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const delta = Math.max(0, elapsed - lastElapsed);
      lastElapsed = elapsed;
      let t = phaseRef.current / 100;
      if (playingRef.current) {
        const nextPhase = (phaseRef.current + delta * 8) % 100;
        phaseRef.current = nextPhase;
        t = nextPhase / 100;
        if (elapsed - lastPhaseUiUpdate > 0.1) {
          setPhase(Math.round(nextPhase));
          lastPhaseUiUpdate = elapsed;
        }
      }
      applyPhase(t, elapsed);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      camera.lookAt(cameraTarget);
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [multiplier, model.batches, model.targetLoaves, model.ovenCapacity, schedule]);

  const updatePhase = (value) => {
    const nextPhase = clampNumber(value, 0, 0, 100);
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    setPlaying(false);
  };

  return (
    <div>
      <div className={`scene ${sceneError ? 'sceneFallback' : ''}`} ref={mount}>
        {sceneError && (
          <div>
            <strong>3D renderer unavailable</strong>
            <span>The workflow model still runs below; open this page in a browser with WebGL enabled to view the animated container.</span>
          </div>
        )}
      </div>
      <div className="sceneControls">
        <button onClick={() => setPlaying((current) => !current)}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <div>
          <strong>{currentStage.name} · {telemetry.stageWindow}</strong>
          <span>{currentStage.detail}</span>
        </div>
        <label className="phaseScrubber">
          <span>{telemetry.clock} · {Math.round(phase)}%</span>
          <input type="range" min="0" max="100" step="1" value={phase} onChange={(event) => updatePhase(event.target.value)} />
        </label>
      </div>
      <div className="sceneTelemetry">
        <Metric label="Active batch" value={`${telemetry.activeBatch}/${model.batches}`} />
        <Metric label="Oven load" value={`${Math.min(model.ovenCapacity, model.targetLoaves)} loaves`} />
        <Metric label="Loaves through line" value={`${telemetry.completedLoaves}/${model.targetLoaves}`} />
        <Metric label="Water + clean" value={`${format1(model.waterL + model.cleaningWater)} L`} />
        <Metric label="Clean status" value={telemetry.cleanStatus} />
      </div>
      <div className="stageTimeline">
        {schedule.stages.map((stage, index) => (
          <div className={index === stageIndex ? 'current' : ''} key={stage.name} style={{ flexGrow: stage.minutes }}>
            <b>{stage.name}</b>
            <span>{stage.startLabel}-{stage.endLabel}</span>
            <span>{stage.duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostTable({ multiplier, assumptions }) {
  const rows = getEquipmentRows(multiplier, assumptions);
  const total = rows.reduce((sum, [, qty, unit]) => sum + qty * unit, 0);
  return (
    <table>
      <tbody>
        {rows.map(([name, qty, unit]) => (
          <tr key={name}>
            <th>{name}</th>
            <td>{formatMoney(qty * unit)}</td>
          </tr>
        ))}
        <tr className="total">
          <th>Concept CAPEX</th>
          <td>{formatMoney(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function PurchaseList({ model, multiplier, assumptions }) {
  const supplies = [
    ['King Arthur bread flour, 12 lb bag', Math.ceil((model.flourKg * 2.20462) / 12), 11.34, 'User-provided current price'],
    ['Morton coarse kosher salt, 53 oz', Math.ceil((model.saltKg * 35.274) / 53), 3.39, 'User-provided current price'],
    ['Bread bags / sliced loaf bags', model.targetLoaves, model.recipe.label.includes('sliced') ? assumptions.slicedBagCost : assumptions.artisanBagCost, 'Editable consumable'],
    ['Electricity allowance', Math.ceil(model.electricityKwh), assumptions.electricityRate, 'Editable utility rate']
  ];
  const equipment = getEquipmentRows(multiplier, assumptions);
  return (
    <div className="purchaseGrid">
      <PurchaseTable title="Daily Consumables" rows={supplies} />
      <PurchaseTable title="Automation Equipment" rows={equipment} />
    </div>
  );
}

function PurchaseTable({ title, rows }) {
  const total = rows.reduce((sum, [, qty, unit]) => sum + qty * unit, 0);
  return (
    <div>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Subtotal</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([item, qty, unit, note]) => (
            <tr key={item}>
              <th>{item}</th>
              <td>{qty}</td>
              <td>{formatUnitMoney(unit)}</td>
              <td>{formatMoney(qty * unit)}</td>
              <td>{note}</td>
            </tr>
          ))}
          <tr className="total">
            <th>Total</th>
            <td></td>
            <td></td>
            <td>{formatMoney(total)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <article className="feature">
      <Icon size={24} />
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Control({ label, value, min, max, onChange }) {
  return (
    <div>
      <label>{label}</label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b>{value}</b>
    </div>
  );
}

function NumberInput({ label, value, step, min, onChange }) {
  return (
    <label className="numberInput">
      <span>{label}</span>
      <input type="number" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Toggle({ icon: Icon, label, value, setValue }) {
  return (
    <button className={`toggle ${value ? 'on' : ''}`} onClick={() => setValue(!value)}>
      <Icon size={18} />
      {label}
      <span>{value ? 'On' : 'Off'}</span>
    </button>
  );
}

function Footer() {
  return (
    <footer>
      <b>DailyBread Pilot</b>
      <span>Concept model for planning only. Validate with local code, health department, fire, electrical, and food safety requirements before purchasing equipment.</span>
    </footer>
  );
}

const rootElement = document.getElementById('root');
const root = window.__dailybreadRoot ?? createRoot(rootElement);
window.__dailybreadRoot = root;
root.render(<App />);
