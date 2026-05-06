import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import {
  ArrowRight,
  Box,
  CalendarDays,
  ChefHat,
  Factory,
  Gauge,
  Layers3,
  PackageCheck,
  RotateCcw,
  School,
  Scissors,
  Timer,
  Truck,
  Waves,
  Zap
} from 'lucide-react';
import './styles.css';

const flourCostPerG = 11.34 / (12 * 453.592);
const saltCostPerG = 3.39 / (53 * 28.3495);

const recipes = {
  artisan: { label: '650g sourdough loaf', doughG: 650, flourG: 360, waterG: 270, starterG: 70, saltG: 8, bakeMin: 38 },
  sliced: { label: '750g sliced school loaf', doughG: 750, flourG: 420, waterG: 300, starterG: 80, saltG: 10, bakeMin: 42 }
};

const formatMoney = (n) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const format1 = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

function computeModel({ loaves, multiplier, school, sliced }) {
  const targetLoaves = loaves * multiplier;
  const recipe = sliced ? recipes.sliced : recipes.artisan;
  const bakeCapacity = 18;
  const batches = Math.ceil(targetLoaves / bakeCapacity);
  const bakeHours = (batches * recipe.bakeMin + 14 * batches) / 60;
  const flourKg = (recipe.flourG * targetLoaves) / 1000;
  const waterL = (recipe.waterG * targetLoaves) / 1000;
  const starterKg = (recipe.starterG * targetLoaves) / 1000;
  const saltKg = (recipe.saltG * targetLoaves) / 1000;
  const flourCost = recipe.flourG * targetLoaves * flourCostPerG;
  const saltCost = recipe.saltG * targetLoaves * saltCostPerG;
  const electricityKwh = batches * 3.2 + 2.4 * multiplier;
  const electricityCost = electricityKwh * 0.17;
  const packagingCost = targetLoaves * (sliced ? 0.18 : 0.11);
  const cleaningWater = 18 + multiplier * 9 + Math.ceil(bakeHours / 4) * 12;
  const laborHours = school ? 1.8 + multiplier * 0.5 : 2.4 + multiplier * 0.7;
  const laborCost = laborHours * 22;
  const dailyCost = flourCost + saltCost + electricityCost + packagingCost + laborCost + 6 * multiplier;
  const unitCost = dailyCost / targetLoaves;
  const price = school ? (sliced ? 3.15 : 3.45) : (sliced ? 5.75 : 6.5);
  const revenue = price * targetLoaves * (school ? 5 : 1);
  const weeklyCost = dailyCost * (school ? 5 : 1);
  const gross = revenue - weeklyCost;
  const ovenUtilization = Math.min(100, (targetLoaves / (batches * bakeCapacity)) * 100);
  return { targetLoaves, recipe, batches, bakeHours, flourKg, waterL, starterKg, saltKg, flourCost, saltCost, electricityKwh, electricityCost, packagingCost, cleaningWater, laborHours, laborCost, dailyCost, unitCost, price, revenue, weeklyCost, gross, ovenUtilization };
}

function App() {
  const [page, setPage] = useState('overview');
  const [loaves, setLoaves] = useState(50);
  const [multiplier, setMultiplier] = useState(1);
  const [school, setSchool] = useState(true);
  const [sliced, setSliced] = useState(true);
  const model = useMemo(() => computeModel({ loaves, multiplier, school, sliced }), [loaves, multiplier, school, sliced]);

  return (
    <main>
      <Nav page={page} setPage={setPage} />
      {page === 'overview' && <Overview model={model} setPage={setPage} />}
      {page === 'model' && <Model model={model} loaves={loaves} setLoaves={setLoaves} multiplier={multiplier} setMultiplier={setMultiplier} school={school} setSchool={setSchool} sliced={sliced} setSliced={setSliced} />}
      {page === 'automation' && <Automation model={model} multiplier={multiplier} setMultiplier={setMultiplier} />}
      <Footer />
    </main>
  );
}

function Nav({ page, setPage }) {
  return <header className="nav"><button className="brand" onClick={() => setPage('overview')}><ChefHat size={22} /> DailyBread Pilot</button><nav>{[['overview','Project'],['model','Model'],['automation','Automation']].map(([id,label]) => <button className={page === id ? 'active' : ''} onClick={() => setPage(id)} key={id}>{label}</button>)}</nav></header>;
}

function Overview({ model, setPage }) {
  return <><section className="hero"><div className="heroText"><p className="eyebrow">From dough to cadence</p><h1>A practical operating model for daily sourdough production.</h1><p>Plan ingredients, baking time, oven capacity, cleaning cycles, school pricing, slicing, and container-scale automation from the same control surface.</p><div className="actions"><button onClick={() => setPage('model')}>Open calculator <ArrowRight size={18} /></button><button className="secondary" onClick={() => setPage('automation')}>View container model</button></div><div className="chips"><span>50 loaf lunch target</span><span>Atlas Craft 3 oven</span><span>School delivery mode</span></div></div><Dashboard model={model} /></section><section className="band"><h2>Baking work organized into a repeatable operating model.</h2><div className="grid3"><Feature icon={CalendarDays} title="Daily Production" text="Mix, bulk ferment, proof, bake, cool, slice, bag, and stage delivery against a lunch deadline." /><Feature icon={PackageCheck} title="Supply Ledger" text="Flour, salt, water, starter, bags, electricity, labor, and cleaning water scale with the loaf target." /><Feature icon={Factory} title="Automation Path" text="Compare 20 ft and 40 ft container layouts with robot handling, oven position, racks, sink, and staging zones." /></div></section></>;
}

function Dashboard({ model }) {
  return <aside className="dash"><div className="dashHead"><span>Bakery cadence</span><b>Active</b></div><div className="big">{model.targetLoaves}</div><p>loaves planned</p><div className="metrics"><Metric label="Batches" value={model.batches} /><Metric label="Bake time" value={`${format1(model.bakeHours)}h`} /><Metric label="Unit cost" value={formatMoney(model.unitCost)} /><Metric label="Water" value={`${format1(model.waterL + model.cleaningWater)}L`} /></div></aside>;
}

function Model(props) {
  const { model, loaves, setLoaves, multiplier, setMultiplier, school, setSchool, sliced, setSliced } = props;
  const rows = [['Flour', `${format1(model.flourKg)} kg`, formatMoney(model.flourCost)], ['Salt', `${format1(model.saltKg)} kg`, formatMoney(model.saltCost)], ['Starter', `${format1(model.starterKg)} kg`, 'tracked culture'], ['Dough water', `${format1(model.waterL)} L`, 'municipal'], ['Cleaning water', `${format1(model.cleaningWater)} L`, '4h robot washdown'], ['Electricity', `${format1(model.electricityKwh)} kWh`, formatMoney(model.electricityCost)], ['Packaging', `${model.targetLoaves} bags`, formatMoney(model.packagingCost)], ['Labor oversight', `${format1(model.laborHours)} h`, formatMoney(model.laborCost)]];
  return <section className="page"><div className="pageHead"><p className="eyebrow">Spreadsheet logic</p><h1>Production, cost, and school delivery model.</h1></div><div className="modelLayout"><Panel title="Controls"><Control label="Base loaves" value={loaves} min="10" max="250" onChange={setLoaves} /><label>Scale multiplier</label><div className="segments">{[1,2,3,4,5,6,8,10].map(x => <button className={x === multiplier ? 'selected' : ''} onClick={() => setMultiplier(x)} key={x}>x{x}</button>)}</div><Toggle icon={School} label="Monday-Friday school pricing" value={school} setValue={setSchool} /><Toggle icon={Scissors} label="Sliced and bagged" value={sliced} setValue={setSliced} /></Panel><Panel title="Daily Output"><div className="kpiRow"><Metric label="Target" value={model.targetLoaves} /><Metric label="Oven batches" value={model.batches} /><Metric label="Bake window" value={`${format1(model.bakeHours)}h`} /><Metric label="Atlas fill" value={`${format1(model.ovenUtilization)}%`} /></div><table><tbody>{rows.map(r => <tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></Panel><Panel title="Financial Readout"><div className="finance"><Metric label={school ? 'Weekly revenue' : 'Daily revenue'} value={formatMoney(model.revenue)} /><Metric label={school ? 'Weekly cost' : 'Daily cost'} value={formatMoney(model.weeklyCost)} /><Metric label="Gross margin" value={formatMoney(model.gross)} /><Metric label="Cost per loaf" value={formatMoney(model.unitCost)} /></div><p className="note">Ingredient pricing uses King Arthur 12 lb bread flour at $11.34 and Morton 53 oz kosher salt at $3.39. Electricity is modeled at $0.17/kWh and should be replaced with the actual utility tariff.</p></Panel></div></section>;
}

function Automation({ model, multiplier, setMultiplier }) {
  const containers = multiplier <= 2 ? 'One 20 ft container' : multiplier <= 5 ? 'Two 20 ft containers sharing oven/service spine' : 'One 40 ft container plus staging annex';
  return <section className="page"><div className="pageHead"><p className="eyebrow">Automated concept</p><h1>Container bakery with robotic dough and oven handling.</h1></div><div className="autoGrid"><Panel title="3D Layout"><ContainerScene multiplier={multiplier} /><div className="segments wide">{[1,2,3,4,5,8].map(x => <button className={x === multiplier ? 'selected' : ''} onClick={() => setMultiplier(x)} key={x}>x{x}</button>)}</div></Panel><Panel title="Recommended Configuration"><div className="stack"><Metric label="Configuration" value={containers} /><Metric label="Lunch output" value={`${model.targetLoaves} loaves`} /><Metric label="Robot wash cycle" value="Every 4h" /><Metric label="Water use" value={`${format1(model.waterL + model.cleaningWater)} L/day`} /></div><CostTable multiplier={multiplier} /></Panel></div><Panel title="Purchase List and Pricing Assumptions"><PurchaseList model={model} multiplier={multiplier} /></Panel><section className="band slim"><h2>Automation modules</h2><div className="grid4"><Feature icon={Box} title="Mix and Bulk" text="Spiral mixer, dough tub lift, fermentation rack, flour bin, starter fridge." /><Feature icon={Layers3} title="Proof and Stage" text="Mobile rack lanes hold shaped loaves while the oven cycles through 18-loaf loads." /><Feature icon={RotateCcw} title="Robot Handling" text="Compact 6-axis arms move trays, score loaves, load decks, unload cooling racks, and enter cleaning mode." /><Feature icon={Waves} title="Steam and Clean" text="Steam deck oven, floor drain, spray bar, food-safe end effectors, and washdown schedule." /></div></section></section>;
}

function ContainerScene({ multiplier }) {
  const mount = useRef(null);
  useEffect(() => {
    const el = mount.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f6f3eb');
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(9, 7, 11);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x776655, 2.8));
    const addBox = (x, y, z, w, h, d, color) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .7 })); m.position.set(x, y, z); scene.add(m); return m; };
    addBox(0, -0.08, 0, multiplier > 5 ? 11 : 7.5, .12, 3.2, '#d9c9a7');
    addBox(-2.4, .55, -0.7, 1.1, 1.1, 1.5, '#27313f');
    addBox(-.7, .35, -.85, 1.6, .7, .7, '#b74d35');
    addBox(1.4, .5, -.85, 1.4, 1, .6, '#51646f');
    addBox(3.0, .45, -.7, .9, .9, 1.4, '#8b956d');
    for (let i = 0; i < Math.min(6, multiplier + 1); i++) addBox(-3 + i * 1.15, .35, .95, .55, .7, .8, '#caa15a');
    const armMat = new THREE.MeshStandardMaterial({ color: '#e8b54b', metalness: .2, roughness: .45 });
    [-1.2, 1.9].forEach(x => { const base = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, .18), armMat); base.position.set(x, .18, .05); scene.add(base); const a = new THREE.Mesh(new THREE.BoxGeometry(.18, 1.1, .18), armMat); a.position.set(x, .78, .05); a.rotation.z = -.45; scene.add(a); const b = new THREE.Mesh(new THREE.BoxGeometry(.16, .9, .16), armMat); b.position.set(x + .42, 1.18, .05); b.rotation.z = .75; scene.add(b); });
    let raf; const animate = () => { scene.rotation.y += 0.003; renderer.render(scene, camera); raf = requestAnimationFrame(animate); }; animate();
    const resize = () => { renderer.setSize(el.clientWidth, el.clientHeight); camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); el.innerHTML = ''; };
  }, [multiplier]);
  return <div className="scene" ref={mount} />;
}

function CostTable({ multiplier }) {
  const capex = [['Atlas Craft 3 deck oven', 6000], ['Two compact 6-axis robot arms', 799 * 2], ['Food-safe end effectors and guards', 2400], ['20 ft insulated container buildout', 22000 * Math.max(1, Math.ceil(multiplier / 3))], ['Mixer, racks, slicer, bagger, sinks', 18500], ['Controls, sensors, drains, install', 14000]];
  const total = capex.reduce((s, x) => s + x[1], 0);
  return <table><tbody>{capex.map(([name, cost]) => <tr key={name}><th>{name}</th><td>{formatMoney(cost)}</td></tr>)}<tr className="total"><th>Concept CAPEX</th><td>{formatMoney(total)}</td></tr></tbody></table>;
}

function PurchaseList({ model, multiplier }) {
  const equipmentUnits = Math.max(1, Math.ceil(multiplier / 3));
  const supplies = [
    ['King Arthur bread flour, 12 lb bag', Math.ceil((model.flourKg * 2.20462) / 12), 11.34, 'User-provided current price'],
    ['Morton coarse kosher salt, 53 oz', Math.ceil((model.saltKg * 35.274) / 53), 3.39, 'User-provided current price'],
    ['Bread bags / sliced loaf bags', model.targetLoaves, model.recipe.label.includes('sliced') ? 0.18 : 0.11, 'Estimated consumable'],
    ['Electricity allowance', Math.ceil(model.electricityKwh), 0.17, 'Replace with utility tariff']
  ];
  const equipment = [
    ['Atlas Craft 3 steam deck oven', 1, 6000, 'Midpoint of $5k-$7k quote'],
    ['Elephant Robotics mechArm Pi', 2 * equipmentUnits, 799, 'Compact 6-axis arm reference'],
    ['Food-safe grippers, peel/end effectors, guards', 1 * equipmentUnits, 2400, 'Concept allowance'],
    ['Insulated 20 ft container buildout', equipmentUnits, 22000, 'Shell, paneling, HVAC allowance'],
    ['Mixer, racks, slicer, bagger, sink package', 1 * equipmentUnits, 18500, 'Micro-bakery package estimate'],
    ['Controls, sensors, drains, electrical install', 1 * equipmentUnits, 14000, 'Integration allowance']
  ];
  return <div className="purchaseGrid"><PurchaseTable title="Daily Consumables" rows={supplies} /><PurchaseTable title="Automation Equipment" rows={equipment} /></div>;
}

function PurchaseTable({ title, rows }) {
  const total = rows.reduce((sum, [, qty, unit]) => sum + qty * unit, 0);
  return <div><h3>{title}</h3><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Subtotal</th><th>Note</th></tr></thead><tbody>{rows.map(([item, qty, unit, note]) => <tr key={item}><th>{item}</th><td>{qty}</td><td>{formatMoney(unit)}</td><td>{formatMoney(qty * unit)}</td><td>{note}</td></tr>)}<tr className="total"><th>Total</th><td></td><td></td><td>{formatMoney(total)}</td><td></td></tr></tbody></table></div>;
}

function Panel({ title, children }) { return <section className="panel"><h2>{title}</h2>{children}</section>; }
function Feature({ icon: Icon, title, text }) { return <article className="feature"><Icon size={24} /><h3>{title}</h3><p>{text}</p></article>; }
function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function Control({ label, value, min, max, onChange }) { return <div><label>{label}</label><input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} /><b>{value}</b></div>; }
function Toggle({ icon: Icon, label, value, setValue }) { return <button className={`toggle ${value ? 'on' : ''}`} onClick={() => setValue(!value)}><Icon size={18} />{label}<span>{value ? 'On' : 'Off'}</span></button>; }
function Footer() { return <footer><b>DailyBread Pilot</b><span>Concept model for planning only. Validate with local code, health department, fire, electrical, and food safety requirements before purchasing equipment.</span></footer>; }

createRoot(document.getElementById('root')).render(<App />);
