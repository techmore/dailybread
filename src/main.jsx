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
const homeDayStartMinutes = 18 * 60;

const recipes = {
  artisan: { label: '650g sourdough loaf', flourG: 360, waterG: 270, starterG: 70, saltG: 8, bakeMin: 38 },
  sliced: { label: '750g sliced school loaf', flourG: 420, waterG: 300, starterG: 80, saltG: 10, bakeMin: 42 }
};

const homeCellDefaults = {
  ovenCost: 349.95,
  ovenWatts: 1800,
  robotArmCost: 799,
  counterCellCost: 950,
  starterStationCost: 85,
  ingredientHopperCost: 260,
  toolDockCost: 165,
  proofDrawerCost: 220,
  controlsCost: 420,
  cleaningDockCost: 180,
  ovenKwhPerLoaf: 1.35,
  idleKwhPerDay: 0.08,
  utilityKwhPerBake: 0.2,
  cleaningWaterPerBakeL: 2.5,
  starterFeedFlourG: 30,
  starterFeedWaterMl: 30,
  parchmentBagCost: 0.1
};

const homeDimensionRows = [
  ['Countertop micro-cell footprint', '~60 in W x 30 in D x 34 in H', 'Concept envelope for the starter tower, hoppers, mixer, proof drawer, oven, cooling shelf, robot reach, and rinse tray.'],
  ['Breville BOV860 oven body', '18.9 in W x 15.9 in D x 10.9 in H', 'Manufacturer-published Smart Oven Air Fryer dimensions.'],
  ['Damson Blue retailer listing', '18.75 in W x 13.25 in D x 11 in H', 'Retail listing for BOV860DBL1BUS1; use as a purchase-specific check.'],
  ['Starter and hopper tower', '~16 in W x 14 in D x 28 in H', 'Estimated vertical module for flour, water, salt, starter jar, load cell, and lid handling.'],
  ['Mixer, proof, and arm zone', '~24 in W x 24 in D x 28 in H', 'Estimated clear working volume for bowl access, timed folds, proof drawer, and arm swing.'],
  ['Cooling and rinse zone', '~18 in W x 24 in D x 16 in H', 'Estimated side module for loaf cooling, removable crumb tray, rinse pan, and tool dock.']
];

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
  { id: 'bake', name: 'Bake', getMinutes: (model) => Math.max(52, Math.round(model.bakeHours * 60)), detail: (model) => `Atlas decks run ${model.ovenLoads} load${model.ovenLoads === 1 ? '' : 's'} across ${model.ovenUnits} oven${model.ovenUnits === 1 ? '' : 's'}, or ${model.bakeRounds} bake round${model.bakeRounds === 1 ? '' : 's'}.` },
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

const homeWorkflowTemplates = [
  { id: 'feed', name: 'Feed Starter', minutes: 10, detail: 'Flour and water dose into the starter jar for the next-day bake.' },
  { id: 'starter', name: 'Starter Peak', minutes: 480, detail: 'The jar tracks rise height, warmth, and activity until the culture peaks.' },
  { id: 'mix', name: 'Dose + Mix', minutes: 25, detail: 'Flour, water, starter, and salt meter into a compact mixing bowl.' },
  { id: 'bulk', name: 'Bulk + Folds', minutes: 220, detail: 'Dough rests while the arm performs timed folds without manual handling.' },
  { id: 'proof', name: 'Final Proof', minutes: 135, detail: 'A covered proof drawer holds the loaf until the oven is ready.' },
  { id: 'bake', name: 'Bake', getMinutes: (model) => model.bakeMinutes, detail: (model) => `Breville oven runs ${model.ovenCycles} one-loaf bake cycle${model.ovenCycles === 1 ? '' : 's'} at countertop scale.` },
  { id: 'cool', name: 'Cool', minutes: 75, detail: 'The arm moves finished bread to a small cooling rack before slicing or storage.' },
  { id: 'clean', name: 'Rinse Tools', minutes: 12, detail: 'Tools return to a rinse dock and the crumb tray is staged for cleanup.' }
];

const homeStageFocus = {
  feed: { station: 'starter', callout: 'Feed starter culture' },
  starter: { station: 'starter', callout: 'Watch starter rise' },
  mix: { station: 'mixer', callout: 'Dose ingredients + mix' },
  bulk: { station: 'mixer', callout: 'Timed folds during bulk' },
  proof: { station: 'proof', callout: 'Covered proof drawer' },
  bake: { station: 'oven', callout: 'Countertop bake cycle' },
  cool: { station: 'cool', callout: 'Cool before handling' },
  clean: { station: 'clean', callout: 'Rinse dock cleanup' }
};

const homeStations = [
  { id: 'starter', label: 'STARTER', position: [-2.25, 0.55, 0.68], size: [0.62, 0.95, 0.62], color: '#d0a85c', labelPosition: [-2.25, 1.45, 0.68] },
  { id: 'hoppers', label: 'HOPPERS', position: [-2.2, 0.72, -0.55], size: [0.9, 1.05, 0.55], color: '#efe3bf', labelPosition: [-2.2, 1.55, -0.55] },
  { id: 'mixer', label: 'MIX', position: [-0.9, 0.4, -0.2], size: [0.82, 0.56, 0.78], color: '#596a70', labelPosition: [-0.9, 1.02, -0.2] },
  { id: 'proof', label: 'PROOF', position: [0.15, 0.36, 0.75], size: [0.95, 0.44, 0.66], color: '#71865c', labelPosition: [0.15, 0.95, 0.75] },
  { id: 'oven', label: 'BREVILLE', position: [1.4, 0.6, -0.33], size: [1.25, 0.9, 0.82], color: '#516171', labelPosition: [1.4, 1.42, -0.33] },
  { id: 'cool', label: 'COOL', position: [2.28, 0.32, 0.72], size: [0.8, 0.32, 0.7], color: '#9c442e', labelPosition: [2.28, 0.88, 0.72] },
  { id: 'clean', label: 'RINSE', position: [0.55, 0.27, -1.02], size: [0.9, 0.34, 0.46], color: '#8fb3c7', labelPosition: [0.55, 0.82, -1.02] }
];

const homePathPoints = [
  [-2.25, 0.36, 0.58],
  [-0.9, 0.35, -0.1],
  [0.15, 0.35, 0.68],
  [1.4, 0.35, -0.35],
  [2.28, 0.35, 0.7],
  [0.55, 0.35, -0.95]
];

const pages = ['overview', 'model', 'automation', 'home'];
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

const stageFocus = {
  mix: { station: 'mixer', callout: 'Meter ingredients + mix dough' },
  proof: { station: 'proof', callout: 'Hold fermentation racks' },
  shape: { station: 'oven', callout: 'Shape, score, build oven loads' },
  bake: { station: 'oven', callout: 'Steam bake by oven round' },
  cool: { station: 'cool', callout: 'Accumulate cooling racks' },
  slice: { station: 'slice', callout: 'Slice, bag, stage delivery' },
  clean: { station: 'bag', callout: 'Food-safe washdown cycle' }
};

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
  return formatWallClock(minutesFromMidnight);
}

function formatWallClock(minutesFromMidnight) {
  const normalizedMinutes = ((Math.round(minutesFromMidnight) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
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

function getHomeWorkflowSchedule(model) {
  const rawStages = homeWorkflowTemplates.map((template) => {
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
      startLabel: formatWallClock(homeDayStartMinutes + startMinute),
      endLabel: formatWallClock(homeDayStartMinutes + cursor),
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
  const activeRound = bakeStage && currentMinute >= bakeStage.startMinute
    ? Math.min(model.bakeRounds, Math.max(1, Math.ceil((bakeElapsed / bakeStage.minutes) * model.bakeRounds)))
    : 0;
  const loadStart = activeRound ? (activeRound - 1) * model.ovenUnits + 1 : 0;
  const loadEnd = activeRound ? Math.min(model.ovenLoads, activeRound * model.ovenUnits) : 0;
  const completedLoaves = Math.min(model.targetLoaves, Math.round((currentMinute / schedule.totalMinutes) * model.targetLoaves));

  return {
    clock: formatClock(currentMinute),
    stageWindow: `${currentStage.startLabel}-${currentStage.endLabel}`,
    activeRound,
    activeLoadLabel: activeRound ? (loadStart === loadEnd ? `${loadStart}` : `${loadStart}-${loadEnd}`) : 'Queued',
    completedLoaves,
    cleanStatus: currentStage.id === 'clean' ? 'Washdown running' : 'Queued after packout'
  };
}

function getAutomationInsights(model, schedule, multiplier) {
  const packoutStage = schedule.stages.find((stage) => stage.id === 'slice') || schedule.stages.at(-1);
  const longestStage = schedule.stages.reduce((longest, stage) => (stage.minutes > longest.minutes ? stage : longest), schedule.stages[0]);
  const lunchTargetOffset = 5.5 * 60;
  const minutesLate = Math.round(packoutStage.endMinute - lunchTargetOffset);
  const requiredStart = (11 * 60 + 30) - packoutStage.endMinute;
  const requiredStartLabel = requiredStart < 0 ? `${formatWallClock(requiredStart)} previous day` : formatWallClock(requiredStart);
  const layout = multiplier <= 2 ? 'Single 20 ft module' : multiplier <= 5 ? 'Two 20 ft modules with shared oven spine' : '40 ft / annex layout';
  const lunchFit = minutesLate <= 0 ? 'Fits 11:30 AM lunch' : `${formatDuration(minutesLate)} past 11:30 AM`;
  const recommendation = minutesLate <= 0
    ? 'Current cadence clears lunch without an earlier start.'
    : `Start around ${requiredStartLabel} or add overnight proof / oven capacity.`;

  return [
    ['Packout ETA', packoutStage.endLabel, `Slice + bag complete after ${formatDuration(packoutStage.endMinute)} from start.`],
    ['Lunch fit', lunchFit, recommendation],
    ['Main constraint', longestStage.name, `${longestStage.name} consumes ${formatDuration(longestStage.minutes)} of the modeled day.`],
    ['Oven strategy', `${model.ovenUnits} oven${model.ovenUnits === 1 ? '' : 's'}`, `${model.ovenLoads} loads collapse into ${model.bakeRounds} bake rounds.`],
    ['Layout', layout, `${model.targetLoaves} loaves across x${multiplier} scale.`]
  ];
}

function getHomeTelemetry(model, schedule, phase, stageIndex) {
  const currentMinute = (clampNumber(phase, 0, 0, 100) / 100) * schedule.totalMinutes;
  const currentStage = schedule.stages[stageIndex] || schedule.stages[0];
  const starterStage = schedule.stages.find((stage) => stage.id === 'starter');
  const bakeStage = schedule.stages.find((stage) => stage.id === 'bake');
  const starterProgress = starterStage
    ? clampNumber((currentMinute - starterStage.startMinute) / starterStage.minutes, currentMinute > starterStage.endMinute ? 1 : 0, 0, 1)
    : 0;
  const bakeProgress = bakeStage
    ? clampNumber((currentMinute - bakeStage.startMinute) / bakeStage.minutes, currentMinute > bakeStage.endMinute ? 1 : 0, 0, 1)
    : 0;
  const completedLoaves = currentMinute < bakeStage?.startMinute
    ? 0
    : Math.min(model.loavesPerBake, Math.max(0, Math.ceil(bakeProgress * model.loavesPerBake)));

  return {
    clock: formatWallClock(homeDayStartMinutes + currentMinute),
    stageWindow: `${currentStage.startLabel}-${currentStage.endLabel}`,
    starterRise: `${Math.round(starterProgress * 100)}%`,
    completedLoaves,
    bakeCycle: currentStage.id === 'bake' ? `${Math.max(1, Math.ceil(bakeProgress * model.ovenCycles))}/${model.ovenCycles}` : `0/${model.ovenCycles}`,
    cleanStatus: currentStage.id === 'clean' ? 'Rinse dock active' : 'Queued'
  };
}

function getHomeInsights(model, schedule) {
  const coolStage = schedule.stages.find((stage) => stage.id === 'cool');
  const cleanStage = schedule.stages.find((stage) => stage.id === 'clean');
  return [
    ['Ready window', coolStage.endLabel, `Cooling finishes at ${cleanStage.startLabel}; cleanup wraps at ${cleanStage.endLabel}.`],
    ['Weekly output', `${model.weeklyLoaves} loaves`, `${model.bakesPerWeek} bake day${model.bakesPerWeek === 1 ? '' : 's'} per week at ${model.loavesPerBake} loaf${model.loavesPerBake === 1 ? '' : 's'} per day.`],
    ['Counter space', '~5 ft wide', 'Modeled as a countertop cell with ingredient hoppers, jar station, proof drawer, oven, and rinse dock.'],
    ['Main constraint', 'Starter time', 'Most of the schedule is passive fermentation; the robotic work is short but precisely timed.'],
    ['Cost signal', formatSmallMoney(model.unitCost), `Ingredient and energy cost per loaf before equipment payback.`]
  ];
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

function getOvenUnits(multiplier) {
  return Math.max(1, Math.ceil(multiplier / 4));
}

function getEquipmentRows(multiplier, assumptions) {
  const equipmentUnits = getEquipmentUnits(multiplier);
  const ovenQty = getOvenUnits(multiplier);

  return [
    ['Atlas Craft 3 steam deck oven', ovenQty, assumptions.deckOvenCost, 'Midpoint of $5k-$7k quote'],
    ['Elephant Robotics mechArm Pi', 2 * equipmentUnits, assumptions.robotArmCost, 'Compact 6-axis arm reference'],
    ['Food-safe grippers, peel/end effectors, guards', equipmentUnits, assumptions.endEffectorsCost, 'Robot tooling and guarding allowance'],
    ['Insulated 20 ft container buildout', equipmentUnits, assumptions.containerBuildoutCost, 'Shell, paneling, HVAC, washable interior'],
    ['Mixer, racks, slicer, bagger, sink package', equipmentUnits, assumptions.mixerPackageCost, 'Micro-bakery production package'],
    ['Controls, sensors, drains, electrical install', equipmentUnits, assumptions.controlsInstallCost, 'Integration, safety, utility allowance']
  ];
}

function getHomeEquipmentRows() {
  return [
    ['Breville BOV860DBL Smart Oven Air Fryer', 1, homeCellDefaults.ovenCost, 'Damson Blue countertop oven reference; model BOV860DBL1BUS1.'],
    ['Compact 6-axis robot arm allowance', 1, homeCellDefaults.robotArmCost, 'Elephant Robotics mechArm Pi reference price basis.'],
    ['Countertop enclosure and washable workcell', 1, homeCellDefaults.counterCellCost, 'Food-safe panels, guards, tray rails, and under-cell cable management.'],
    ['Starter jar station with load cell', 1, homeCellDefaults.starterStationCost, 'Culture jar, scale, lid actuator, rise marker, and temperature sensor allowance.'],
    ['Ingredient hoppers and micro-dosing augers', 1, homeCellDefaults.ingredientHopperCost, 'Flour, salt, starter, and water dosing concept.'],
    ['Food-safe tool dock and end effectors', 1, homeCellDefaults.toolDockCost, 'Scraper, gripper, peel, and jar-lid tool allowance.'],
    ['Compact proof drawer / humidity insert', 1, homeCellDefaults.proofDrawerCost, 'Covered proofing drawer inside the cell.'],
    ['Sensors, controls, pumps, and safety interlocks', 1, homeCellDefaults.controlsCost, 'Controller, recipe logic, water pump, door sensing, and status lighting.'],
    ['Rinse tray and crumb-management dock', 1, homeCellDefaults.cleaningDockCost, 'Low-water tool rinse, removable crumb tray, and drain-pan allowance.']
  ];
}

function computeModel({ loaves, multiplier, school, sliced, assumptions }) {
  const safeAssumptions = sanitizeAssumptions(assumptions);
  const safeLoaves = clampInteger(loaves, 50, 1, 10000);
  const safeMultiplier = clampInteger(multiplier, 1, 1, 100);
  const targetLoaves = safeLoaves * safeMultiplier;
  const recipe = sliced ? recipes.sliced : recipes.artisan;
  const ovenUnits = getOvenUnits(safeMultiplier);
  const ovenLoads = Math.ceil(targetLoaves / safeAssumptions.ovenCapacity);
  const bakeRounds = Math.ceil(ovenLoads / ovenUnits);
  const bakeMinutesPerLoad = recipe.bakeMin + 14;
  const bakeHours = (bakeRounds * bakeMinutesPerLoad) / 60;
  const flourKg = (recipe.flourG * targetLoaves) / 1000;
  const waterL = (recipe.waterG * targetLoaves) / 1000;
  const starterKg = (recipe.starterG * targetLoaves) / 1000;
  const saltKg = (recipe.saltG * targetLoaves) / 1000;
  const flourCost = recipe.flourG * targetLoaves * flourCostPerG;
  const saltCost = recipe.saltG * targetLoaves * saltCostPerG;
  const electricityKwh = ovenLoads * safeAssumptions.ovenKwhPerBatch + safeAssumptions.utilityKwhPerScale * safeMultiplier;
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
  const ovenUtilization = Math.min(100, (targetLoaves / (ovenLoads * safeAssumptions.ovenCapacity)) * 100);

  return {
    targetLoaves,
    recipe,
    ovenCapacity: safeAssumptions.ovenCapacity,
    batches: ovenLoads,
    ovenLoads,
    ovenUnits,
    bakeRounds,
    bakeMinutesPerLoad,
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

function computeHomeModel({ loavesPerBake, bakesPerWeek, assumptions }) {
  const safeAssumptions = sanitizeAssumptions(assumptions);
  const safeLoavesPerBake = clampInteger(loavesPerBake, 1, 1, 2);
  const safeBakesPerWeek = clampInteger(bakesPerWeek, 4, 1, 7);
  const recipe = recipes.artisan;
  const weeklyLoaves = safeLoavesPerBake * safeBakesPerWeek;
  const ovenCycles = safeLoavesPerBake;
  const bakeMinutes = ovenCycles * (recipe.bakeMin + 22);
  const flourG = recipe.flourG * weeklyLoaves + homeCellDefaults.starterFeedFlourG * 7;
  const saltG = recipe.saltG * weeklyLoaves;
  const starterG = recipe.starterG * weeklyLoaves;
  const doughWaterL = (recipe.waterG * weeklyLoaves) / 1000;
  const starterFeedWaterL = (homeCellDefaults.starterFeedWaterMl * 7) / 1000;
  const cleaningWaterL = homeCellDefaults.cleaningWaterPerBakeL * safeBakesPerWeek;
  const waterL = doughWaterL + starterFeedWaterL + cleaningWaterL;
  const flourCost = flourG * flourCostPerG;
  const saltCost = saltG * saltCostPerG;
  const electricityKwh = weeklyLoaves * homeCellDefaults.ovenKwhPerLoaf
    + safeBakesPerWeek * homeCellDefaults.utilityKwhPerBake
    + 7 * homeCellDefaults.idleKwhPerDay;
  const electricityCost = electricityKwh * safeAssumptions.electricityRate;
  const packagingCost = weeklyLoaves * homeCellDefaults.parchmentBagCost;
  const weeklyCost = flourCost + saltCost + electricityCost + packagingCost;
  const unitCost = weeklyCost / weeklyLoaves;
  const equipmentRows = getHomeEquipmentRows();
  const capex = equipmentRows.reduce((sum, [, qty, unit]) => sum + qty * unit, 0);

  return {
    loavesPerBake: safeLoavesPerBake,
    bakesPerWeek: safeBakesPerWeek,
    weeklyLoaves,
    recipe,
    ovenCycles,
    bakeMinutes,
    flourKg: flourG / 1000,
    saltG,
    starterG,
    doughWaterL,
    starterFeedWaterL,
    cleaningWaterL,
    waterL,
    flourCost,
    saltCost,
    electricityKwh,
    electricityCost,
    packagingCost,
    weeklyCost,
    unitCost,
    capex,
    equipmentRows
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
      {page === 'home' && <HomeDailyBread assumptions={safeAssumptions} />}
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
          ['automation', 'Automation'],
          ['home', 'Home Daily Bread']
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
            <button className="secondary" onClick={() => setPage('home')}>
              Explore home cell
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
        <Metric label="Oven loads" value={model.ovenLoads} />
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
            <Metric label="Oven loads" value={model.ovenLoads} />
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

function HomeDailyBread({ assumptions }) {
  const [loavesPerBake, setLoavesPerBake] = useState(1);
  const [bakesPerWeek, setBakesPerWeek] = useState(4);
  const model = useMemo(() => computeHomeModel({ loavesPerBake, bakesPerWeek, assumptions }), [loavesPerBake, bakesPerWeek, assumptions]);
  const schedule = useMemo(() => getHomeWorkflowSchedule(model), [model]);
  const insights = getHomeInsights(model, schedule);
  const weeklyRows = [
    ['Flour', `${format1(model.flourKg)} kg`, formatSmallMoney(model.flourCost)],
    ['Salt', `${format1(model.saltG)} g`, formatSmallMoney(model.saltCost)],
    ['Starter culture used', `${format1(model.starterG)} g`, 'maintained daily'],
    ['Dough water', `${format1(model.doughWaterL)} L`, 'ingredient water'],
    ['Starter feed water', `${format1(model.starterFeedWaterL)} L`, 'daily refresh'],
    ['Cleaning water', `${format1(model.cleaningWaterL)} L`, `${model.bakesPerWeek} rinse cycles`],
    ['Electricity', `${format1(model.electricityKwh)} kWh`, formatSmallMoney(model.electricityCost)],
    ['Parchment / storage bags', `${model.weeklyLoaves} uses`, formatSmallMoney(model.packagingCost)]
  ];
  const supplies = [
    ['King Arthur bread flour, 12 lb bag', Math.max(1, Math.ceil((model.flourKg * 2.20462) / 12)), 11.34, `${format1(model.flourKg)} kg/week including starter feed`],
    ['Morton coarse kosher salt, 53 oz', Math.max(1, Math.ceil((model.saltG / 28.3495) / 53)), 3.39, `${format1(model.saltG)} g/week`],
    ['Electricity allowance', Math.ceil(model.electricityKwh), assumptions.electricityRate, 'Editable utility rate from the main model'],
    ['Parchment or bread bag allowance', model.weeklyLoaves, homeCellDefaults.parchmentBagCost, 'Small consumable for storage or gifting']
  ];

  return (
    <section className="page homePage">
      <div className="pageHead">
        <p className="eyebrow">Home Daily Bread</p>
        <h1>Countertop sourdough micro-cell for starter, proof, bake, and cleanup.</h1>
        <p>Model a home-sized automated unit built around a Breville BOV860DBL Smart Oven Air Fryer, a compact robotic arm, ingredient hoppers, a starter jar station, proof drawer, rinse dock, timing, water, electricity, and weekly ingredient cost.</p>
      </div>
      <div className="pitchStrip">
        <Metric label="Weekly output" value={`${model.weeklyLoaves} loaves`} />
        <Metric label="Ready window" value={schedule.stages.find((stage) => stage.id === 'cool')?.endLabel || 'Modeled'} />
        <Metric label="Concept CAPEX" value={formatMoney(model.capex)} />
        <Metric label="Cost / loaf" value={formatSmallMoney(model.unitCost)} />
      </div>
      <section className="workflowShowcase homeShowcase">
        <div className="workflowHeader">
          <div>
            <p className="eyebrow">Countertop cell in motion</p>
            <h2>Watch starter feeding, timed folds, proofing, baking, cooling, and rinse mode.</h2>
            <div className="ingredientLegend">
              {ingredientFeed.map((item) => (
                <span key={item.label}>
                  <b style={{ background: item.color }}>{item.short}</b>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="homeControls">
            <Control label="Loaves per bake day" value={loavesPerBake} min="1" max="2" onChange={setLoavesPerBake} />
            <Control label="Bake days per week" value={bakesPerWeek} min="1" max="7" onChange={setBakesPerWeek} />
          </div>
        </div>
        <HomeBreadScene model={model} schedule={schedule} />
        <AutomationInsights insights={insights} />
      </section>
      <div className="autoGrid">
        <Panel title="Weekly Home Operating Logic">
          <div className="kpiRow">
            <Metric label="Oven cycles" value={`${model.ovenCycles}/day`} />
            <Metric label="Bake window" value={formatDuration(model.bakeMinutes)} />
            <Metric label="Water/week" value={`${format1(model.waterL)} L`} />
            <Metric label="Electricity/week" value={`${format1(model.electricityKwh)} kWh`} />
          </div>
          <table>
            <tbody>
              {weeklyRows.map((row) => (
                <tr key={row[0]}>
                  <th>{row[0]}</th>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Micro-Cell Timing">
          <div className="timingGrid">
            {schedule.stages.map((stage) => (
              <Metric key={stage.id} label={stage.name} value={`${stage.startLabel}-${stage.endLabel}`} />
            ))}
          </div>
          <p className="note">The timing assumes an evening starter feed and a next-day loaf. The robotic arm is not doing work for the full schedule; most of the value is consistent dosing, reminders, folds, transfer, oven staging, and cleanup prompts.</p>
        </Panel>
      </div>
      <Panel title="Estimated Physical Dimensions">
        <table>
          <tbody>
            {homeDimensionRows.map(([item, dimension, note]) => (
              <tr key={item}>
                <th>{item}</th>
                <td>{dimension}</td>
                <td>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">These are planning dimensions, not fabrication drawings. The oven footprint, side/rear clearance, heat shielding, door swing, food-safe guards, and robot reach envelope still need mechanical design validation before prototyping.</p>
      </Panel>
      <Panel title="Home Cell References and Purchase List">
        <div className="referenceGrid">
          <section className="referenceGroup">
            <h3>Reference Items</h3>
            <ul>
              <li>Breville BOV860DBL Smart Oven Air Fryer, Damson Blue: modeled at {formatSmallMoney(homeCellDefaults.ovenCost)}.</li>
              <li>Retailer listing reference: model BOV860DBL1BUS1, SKU 6514381, 0.8 cu ft capacity, 120 V, 1800 W.</li>
              <li>Manufacturer dimensions reference: 18.9 x 15.9 x 10.9 in; retailer listing also reports Damson Blue dimensions of 18.75 W x 13.25 D x 11 H in.</li>
              <li>Elephant Robotics mechArm Pi compact 6-axis arm reference: {formatMoney(homeCellDefaults.robotArmCost)} as the robotic handling allowance.</li>
              <li>King Arthur Unbleached Bread Flour, 12 lb bag: $11.34; Morton Coarse Kosher Salt, 53 oz: $3.39.</li>
            </ul>
          </section>
          <section className="referenceGroup">
            <h3>Design Assumptions</h3>
            <ul>
              <li>One countertop oven cycle per sourdough loaf; two-loaf days run two oven cycles.</li>
              <li>Daily starter maintenance adds {homeCellDefaults.starterFeedFlourG}g flour and {homeCellDefaults.starterFeedWaterMl}ml water per day.</li>
              <li>Cleaning mode uses {format1(homeCellDefaults.cleaningWaterPerBakeL)} L per bake day for a rinse tray and removable tool dock.</li>
              <li>Energy assumes {format1(homeCellDefaults.ovenKwhPerLoaf)} kWh per loaf plus sensor, pump, and idle allowance.</li>
              <li>The home cell is a concept model only; food-safe robotics, oven-door actuation, and unattended baking require engineering and safety validation.</li>
            </ul>
          </section>
        </div>
        <div className="purchaseGrid wide">
          <PurchaseTable title="Weekly Consumables" rows={supplies} />
          <PurchaseTable title="Countertop Micro-Cell Equipment" rows={model.equipmentRows} />
        </div>
      </Panel>
    </section>
  );
}

function HomeBreadScene({ model, schedule }) {
  const mount = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [sceneError, setSceneError] = useState(false);
  const currentStage = schedule.stages[stageIndex] || schedule.stages[0];
  const telemetry = getHomeTelemetry(model, schedule, phase, stageIndex);
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
    scene.position.x = -0.36;
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 100);
    const cameraTarget = new THREE.Vector3(0.12, 0.62, 0);
    const positionCamera = () => {
      const aspect = el.clientWidth / Math.max(1, el.clientHeight);
      const z = aspect < 0.75 ? 12.4 : aspect < 1 ? 10.4 : aspect < 1.35 ? 7.8 : 6.9;
      const y = aspect < 0.75 ? 3.75 : 3.3;
      camera.position.set(0.34, y, z);
      camera.lookAt(cameraTarget);
    };
    positionCamera();

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
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      setSceneError(false);
    } catch {
      setSceneError(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d6a50, 2.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const addBox = (x, y, z, w, h, d, color, opacity = 1) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.66, transparent: opacity < 1, opacity });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = opacity >= 0.6;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const addCylinder = (x, y, z, radius, height, color, opacity = 1) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.58, transparent: opacity < 1, opacity });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = opacity >= 0.6;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const addRoundedBox = (x, y, z, w, h, d, color, radius = 0.06, options = {}) => {
      const shape = new THREE.Shape();
      const r = Math.min(radius, w / 2, h / 2);
      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: true,
        bevelThickness: options.bevelThickness ?? 0.025,
        bevelSize: options.bevelSize ?? 0.025,
        bevelSegments: options.bevelSegments ?? 4
      });
      geometry.translate(0, 0, -d / 2);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.52,
        metalness: options.metalness ?? 0.08,
        transparent: (options.opacity ?? 1) < 1,
        opacity: options.opacity ?? 1,
        emissive: options.emissive ?? '#000000',
        emissiveIntensity: options.emissiveIntensity ?? 0
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = (options.opacity ?? 1) >= 0.45;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const addTextPanel = (text, x, y, z, w, h, fill = '#101817', ink = '#dfead1') => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = fill;
      ctx.roundRect(18, 18, 476, 120, 22);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = '800 42px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(text, 256, 88);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(w, h, 1);
      scene.add(sprite);
      return sprite;
    };

    const addLabel = (text, x, y, z, accent = '#203734', scale = [1.15, 0.32, 1]) => {
      const canvas = document.createElement('canvas');
      canvas.width = 560;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255, 250, 240, 0.94)';
      ctx.roundRect(18, 18, 524, 88, 18);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.fillStyle = '#1a2421';
      ctx.font = '800 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(text, 280, 76);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(...scale);
      scene.add(sprite);
      return sprite;
    };

    const addDimensionLine = (start, end, label, labelPosition, tickAxis = 'z') => {
      const material = new THREE.LineBasicMaterial({ color: '#9c442e' });
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), material));
      const tickSize = 0.18;
      [start, end].forEach((point) => {
        const dims = tickAxis === 'x' ? [tickSize, 0.035, 0.035] : tickAxis === 'y' ? [0.035, tickSize, 0.035] : [0.035, 0.035, tickSize];
        addBox(point.x, point.y, point.z, dims[0], dims[1], dims[2], '#9c442e');
      });
      addLabel(label, labelPosition.x, labelPosition.y, labelPosition.z, '#9c442e', [1.25, 0.34, 1]);
    };

    const addIngredientBadge = (item, x, y, z) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(128, 108, 68, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a2421';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = '#1a2421';
      ctx.font = item.short.length > 1 ? '800 42px Arial' : '900 72px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.short, 128, 126);
      ctx.font = '700 24px Arial';
      ctx.fillText(item.label, 128, 214);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(0.48, 0.48, 1);
      scene.add(sprite);
      return sprite;
    };

    const addTube = (points, color, radius = 0.014, opacity = 1) => {
      const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 36, radius, 10),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.12, transparent: opacity < 1, opacity })
      );
      mesh.castShadow = opacity >= 0.55;
      scene.add(mesh);
      return mesh;
    };

    const createStarterStation = (x, y, z) => {
      addRoundedBox(x, 0.19, z, 0.78, 0.14, 0.68, '#d8d1c2', 0.055, {
        metalness: 0.2,
        roughness: 0.42
      });
      addRoundedBox(x, 0.29, z, 0.56, 0.08, 0.48, '#263330', 0.035, {
        metalness: 0.22,
        roughness: 0.28
      });
      addTextPanel('128g', x + 0.16, 0.33, z + 0.27, 0.22, 0.08, '#102523', '#dff6ef');

      const glass = addCylinder(x, y, z, 0.26, 0.86, '#ffffff', 0.28);
      glass.material.metalness = 0.02;
      glass.material.roughness = 0.05;
      const fill = addCylinder(x, 0.36, z, 0.21, 0.24, '#d0a85c', 0.9);
      fill.material.roughness = 0.86;

      const ringMaterial = new THREE.MeshStandardMaterial({ color: '#d8d1c2', roughness: 0.24, metalness: 0.35 });
      [0.28, 1.06].forEach((ringY) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.258, 0.012, 8, 42), ringMaterial);
        ring.position.set(x, ringY, z);
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = true;
        scene.add(ring);
      });
      const lid = addCylinder(x, 1.12, z, 0.27, 0.07, '#596a70');
      addCylinder(x, 1.18, z, 0.19, 0.035, '#d8d1c2');

      for (let i = 0; i < 5; i += 1) {
        const width = i % 2 === 0 ? 0.14 : 0.09;
        addBox(x - 0.2 + width / 2, 0.43 + i * 0.105, z + 0.265, width, 0.012, 0.008, '#596a70', 0.78);
      }
      addTextPanel('STARTER', x, 0.7, z + 0.31, 0.5, 0.16, '#fffaf0', '#203734');

      const bubbles = Array.from({ length: 14 }, (_, index) => {
        const bubble = new THREE.Mesh(
          new THREE.SphereGeometry(0.018 + (index % 3) * 0.006, 12, 8),
          new THREE.MeshStandardMaterial({ color: '#f7f2e8', roughness: 0.2, transparent: true, opacity: 0.78 })
        );
        const angle = index * 1.85;
        bubble.userData = {
          angle,
          radius: 0.07 + (index % 4) * 0.032,
          baseY: 0.36 + (index % 7) * 0.052,
          speed: 0.7 + (index % 5) * 0.15
        };
        bubble.position.set(x + Math.cos(angle) * bubble.userData.radius, bubble.userData.baseY, z + Math.sin(angle) * bubble.userData.radius);
        scene.add(bubble);
        return bubble;
      });

      return { glass, fill, lid, bubbles };
    };

    const createIngredientHoppers = (x, y, z) => {
      const hoppers = [
        { label: 'F', color: '#efe3bf', x: x - 0.32 },
        { label: 'H2O', color: '#8fb3c7', x },
        { label: 'NaCl', color: '#f7f7ef', x: x + 0.32 }
      ];

      hoppers.forEach((hopper) => {
        addRoundedBox(hopper.x, y, z, 0.26, 0.48, 0.28, hopper.color, 0.04, {
          opacity: 0.62,
          roughness: 0.18,
          metalness: 0.05
        });
        addRoundedBox(hopper.x, y + 0.28, z, 0.3, 0.055, 0.3, '#d8d1c2', 0.02, {
          metalness: 0.35,
          roughness: 0.24
        });
        const funnel = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, 0.22, 4),
          new THREE.MeshStandardMaterial({ color: hopper.color, roughness: 0.58, transparent: true, opacity: 0.82 })
        );
        funnel.position.set(hopper.x, y - 0.35, z);
        funnel.rotation.y = Math.PI / 4;
        funnel.castShadow = true;
        scene.add(funnel);
        addTextPanel(hopper.label, hopper.x, y + 0.02, z + 0.18, 0.2, 0.08, 'rgba(255,250,240,0.9)', '#203734');
      });

      addTube([[x - 0.32, y - 0.46, z], [-2.25, 1.1, 0.68]], '#d8d1c2', 0.012, 0.82);
      addTube([[x, y - 0.46, z], [-0.9, 0.95, -0.2]], '#8fb3c7', 0.012, 0.82);
      addTube([[x + 0.32, y - 0.46, z], [-0.88, 0.96, -0.08]], '#f7f7ef', 0.012, 0.82);
    };

    const createMixerStation = (x, y, z) => {
      addRoundedBox(x, 0.28, z, 0.88, 0.16, 0.72, '#4e6067', 0.06, {
        metalness: 0.15,
        roughness: 0.38
      });
      addRoundedBox(x - 0.35, 0.62, z + 0.06, 0.16, 0.62, 0.28, '#4e6067', 0.055, {
        metalness: 0.16,
        roughness: 0.38
      });
      const head = addRoundedBox(x, 0.98, z - 0.06, 0.86, 0.24, 0.46, '#5f7278', 0.09, {
        metalness: 0.18,
        roughness: 0.34
      });
      addRoundedBox(x + 0.32, 1.0, z + 0.2, 0.12, 0.06, 0.04, '#d9a73a', 0.015);
      addTextPanel('MIX', x - 0.16, 1.01, z + 0.23, 0.27, 0.1, '#d8d1c2', '#203734');

      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.25, 0.36, 42, 1, true),
        new THREE.MeshStandardMaterial({ color: '#d7d2c7', roughness: 0.18, metalness: 0.62, side: THREE.DoubleSide })
      );
      bowl.position.set(x, 0.62, z);
      bowl.castShadow = true;
      bowl.receiveShadow = true;
      scene.add(bowl);
      const bowlLip = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.014, 8, 48),
        new THREE.MeshStandardMaterial({ color: '#f1eadc', roughness: 0.16, metalness: 0.55 })
      );
      bowlLip.position.set(x, 0.8, z);
      bowlLip.rotation.x = Math.PI / 2;
      bowlLip.castShadow = true;
      scene.add(bowlLip);

      const dough = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 24, 14),
        new THREE.MeshStandardMaterial({ color: '#d0a85c', roughness: 0.92 })
      );
      dough.scale.set(1.35, 0.34, 0.95);
      dough.position.set(x, 0.72, z);
      dough.castShadow = true;
      scene.add(dough);

      const hookGroup = new THREE.Group();
      hookGroup.position.set(x, 0.92, z);
      const hookMat = new THREE.MeshStandardMaterial({ color: '#d8d1c2', roughness: 0.22, metalness: 0.58 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 16), hookMat);
      shaft.position.y = -0.1;
      hookGroup.add(shaft);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 8, 30, Math.PI * 1.35), hookMat);
      hook.position.y = -0.31;
      hook.rotation.x = Math.PI / 2;
      hook.rotation.z = -0.55;
      hookGroup.add(hook);
      scene.add(hookGroup);

      return { bowl, bowlLip, dough, hookGroup, head };
    };

    const createProofDrawer = (x, y, z) => {
      addRoundedBox(x, 0.25, z, 1.02, 0.16, 0.76, '#4f6548', 0.055, {
        metalness: 0.12,
        roughness: 0.38
      });
      const glass = addRoundedBox(x, y + 0.18, z, 0.98, 0.58, 0.72, '#dfead1', 0.055, {
        opacity: 0.24,
        metalness: 0.02,
        roughness: 0.08
      });
      const back = addRoundedBox(x, y + 0.18, z - 0.36, 0.98, 0.58, 0.035, '#71865c', 0.035, {
        opacity: 0.34,
        roughness: 0.52
      });
      const glow = addRoundedBox(x, y + 0.18, z, 0.84, 0.44, 0.58, '#dfead1', 0.04, {
        opacity: 0.2,
        emissive: '#9fbd7a',
        emissiveIntensity: 0.2,
        roughness: 0.8
      });
      addCylinder(x - 0.43, y + 0.47, z + 0.38, 0.018, 0.42, '#d8d1c2').rotation.z = Math.PI / 2;

      const tray = addRoundedBox(x, y - 0.04, z + 0.02, 0.72, 0.055, 0.46, '#d8d1c2', 0.03, {
        metalness: 0.28,
        roughness: 0.28
      });
      const dough = new THREE.Mesh(
        new THREE.SphereGeometry(0.23, 32, 18),
        new THREE.MeshStandardMaterial({ color: '#d0a85c', roughness: 0.9 })
      );
      dough.scale.set(1.1, 0.55, 0.86);
      dough.position.set(x, y + 0.07, z + 0.02);
      dough.castShadow = true;
      dough.receiveShadow = true;
      scene.add(dough);

      const marks = [0.32, 0.42, 0.52].map((markY, index) => addBox(x - 0.48, y - 0.06 + markY, z + 0.39, 0.12 + index * 0.04, 0.01, 0.01, '#596a70', 0.72));
      const steam = Array.from({ length: 5 }, (_, index) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x - 0.28 + index * 0.14, y + 0.1, z + 0.02),
          new THREE.Vector3(x - 0.26 + index * 0.14, y + 0.26, z + 0.06),
          new THREE.Vector3(x - 0.3 + index * 0.14, y + 0.42, z + 0.02)
        ]);
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 18, 0.006, 8),
          new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, roughness: 0.2 })
        );
        scene.add(mesh);
        return mesh;
      });

      return { glass, back, glow, tray, dough, marks, steam };
    };

    const createCoolingRack = (x, y, z) => {
      const metal = '#c8c2b5';
      addRoundedBox(x, y - 0.13, z, 0.94, 0.08, 0.72, '#9c442e', 0.04, {
        opacity: 0.35,
        metalness: 0.1,
        roughness: 0.55
      });
      const rails = [
        [[x - 0.48, y, z - 0.34], [x + 0.48, y, z - 0.34]],
        [[x - 0.48, y, z + 0.34], [x + 0.48, y, z + 0.34]],
        [[x - 0.48, y + 0.18, z - 0.34], [x + 0.48, y + 0.18, z - 0.34]],
        [[x - 0.48, y + 0.18, z + 0.34], [x + 0.48, y + 0.18, z + 0.34]]
      ];
      rails.forEach(([start, end]) => addTube([start, end], metal, 0.012, 1));
      for (let i = 0; i < 8; i += 1) {
        const wireX = x - 0.38 + i * 0.11;
        addTube([[wireX, y + 0.09, z - 0.32], [wireX, y + 0.09, z + 0.32]], metal, 0.007, 1);
      }
      for (let i = 0; i < 4; i += 1) {
        const wireZ = z - 0.24 + i * 0.16;
        addTube([[x - 0.43, y + 0.1, wireZ], [x + 0.43, y + 0.1, wireZ]], metal, 0.007, 1);
      }
      [
        [x - 0.42, z - 0.3],
        [x + 0.42, z - 0.3],
        [x - 0.42, z + 0.3],
        [x + 0.42, z + 0.3]
      ].forEach(([legX, legZ]) => addTube([[legX, y - 0.13, legZ], [legX, y + 0.18, legZ]], metal, 0.01, 1));

      const loaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 32, 18),
        new THREE.MeshStandardMaterial({ color: '#b96f35', roughness: 0.86 })
      );
      loaf.scale.set(1.6, 0.55, 1);
      loaf.position.set(x, y + 0.28, z);
      loaf.castShadow = true;
      scene.add(loaf);
      for (let i = 0; i < 3; i += 1) {
        const score = addBox(x - 0.18 + i * 0.18, y + 0.42, z + 0.04, 0.11, 0.012, 0.018, '#f0d79f', 0.9);
        score.rotation.z = -0.3;
      }
      const steam = Array.from({ length: 5 }, (_, index) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x - 0.24 + index * 0.12, y + 0.46, z),
          new THREE.Vector3(x - 0.2 + index * 0.12, y + 0.62, z + 0.04),
          new THREE.Vector3(x - 0.25 + index * 0.12, y + 0.8, z - 0.02)
        ]);
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 18, 0.006, 8),
          new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.2 })
        );
        scene.add(mesh);
        return mesh;
      });

      return { loaf, steam };
    };

    const createBrevilleOven = (x, y, z) => {
      const frontZ = z + 0.45;
      const body = addRoundedBox(x, y, z, 1.52, 0.9, 0.88, '#4f6474', 0.12, {
        metalness: 0.18,
        roughness: 0.38,
        bevelThickness: 0.035,
        bevelSize: 0.035
      });
      addRoundedBox(x, y + 0.02, frontZ + 0.035, 1.34, 0.72, 0.055, '#d8d1c2', 0.08, {
        metalness: 0.5,
        roughness: 0.28
      });
      const glass = addRoundedBox(x - 0.16, y - 0.01, frontZ + 0.075, 0.9, 0.55, 0.045, '#101817', 0.05, {
        opacity: 0.74,
        metalness: 0.05,
        roughness: 0.2
      });
      const glow = addRoundedBox(x - 0.16, y - 0.01, frontZ + 0.098, 0.78, 0.43, 0.03, '#f0a33c', 0.04, {
        opacity: 0.18,
        emissive: '#f97316',
        emissiveIntensity: 0.25,
        roughness: 0.8
      });
      addRoundedBox(x + 0.55, y, frontZ + 0.09, 0.24, 0.58, 0.05, '#273532', 0.035, {
        metalness: 0.12,
        roughness: 0.4
      });
      addRoundedBox(x + 0.55, y + 0.19, frontZ + 0.125, 0.16, 0.075, 0.025, '#b8dfd8', 0.015, {
        emissive: '#5ad7cf',
        emissiveIntensity: 0.25,
        roughness: 0.25
      });
      addTextPanel('450F', x + 0.55, y + 0.19, frontZ + 0.17, 0.23, 0.09, '#102523', '#dff6ef');

      const knobs = [y + 0.02, y - 0.17].map((knobY) => {
        const knob = addCylinder(x + 0.55, knobY, frontZ + 0.15, 0.055, 0.04, '#d4cab8');
        knob.rotation.x = Math.PI / 2;
        knob.material.metalness = 0.45;
        knob.material.roughness = 0.24;
        return knob;
      });
      const button = addCylinder(x + 0.55, y - 0.31, frontZ + 0.15, 0.035, 0.035, '#d9a73a');
      button.rotation.x = Math.PI / 2;

      const handle = addCylinder(x - 0.16, y + 0.36, frontZ + 0.16, 0.035, 0.86, '#d7cbb7');
      handle.rotation.z = Math.PI / 2;
      handle.material.metalness = 0.48;
      handle.material.roughness = 0.22;
      addBox(x - 0.55, y + 0.31, frontZ + 0.13, 0.06, 0.16, 0.04, '#d7cbb7');
      addBox(x + 0.23, y + 0.31, frontZ + 0.13, 0.06, 0.16, 0.04, '#d7cbb7');

      const rods = [y + 0.15, y - 0.15].map((rodY) => {
        const rod = addCylinder(x - 0.16, rodY, frontZ + 0.13, 0.014, 0.68, '#f3b665');
        rod.rotation.z = Math.PI / 2;
        rod.material.emissive.set('#f97316');
        rod.material.emissiveIntensity = 0.2;
        return rod;
      });
      for (let i = 0; i < 5; i += 1) {
        addBox(x - 0.16, y - 0.02, frontZ + 0.135 + i * 0.022, 0.72, 0.012, 0.008, '#c8c2b5');
      }
      const fan = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.008, 8, 32),
        new THREE.MeshStandardMaterial({ color: '#9eaaab', metalness: 0.55, roughness: 0.28 })
      );
      fan.position.set(x - 0.16, y - 0.02, frontZ + 0.145);
      scene.add(fan);
      for (let i = 0; i < 3; i += 1) {
        const blade = addBox(x - 0.16, y - 0.02, frontZ + 0.15, 0.18, 0.018, 0.006, '#9eaaab');
        blade.rotation.z = (Math.PI / 3) * i;
      }
      for (let i = 0; i < 7; i += 1) {
        addBox(x - 0.42 + i * 0.14, y + 0.49, z - 0.04, 0.075, 0.012, 0.36, '#3c4f5c', 0.9);
      }
      [
        [x - 0.54, y - 0.5, z - 0.28],
        [x + 0.54, y - 0.5, z - 0.28],
        [x - 0.54, y - 0.5, z + 0.28],
        [x + 0.54, y - 0.5, z + 0.28]
      ].forEach(([fx, fy, fz]) => addCylinder(fx, fy, fz, 0.055, 0.07, '#2b302f'));
      addTextPanel('BOV860', x - 0.43, y + 0.43, frontZ + 0.17, 0.32, 0.11, '#d8d1c2', '#263330');

      return { body, glass, glow, fan, knobs, rods };
    };

    addBox(0, -0.07, 0, 5.55, 0.14, 2.65, '#d8c89f');
    addBox(0, 1.08, -1.34, 5.55, 2.24, 0.05, '#d8c89f', 0.28);
    addBox(-2.82, 1.08, 0, 0.05, 2.24, 2.65, '#d8c89f', 0.2);
    addBox(2.82, 1.08, 0, 0.05, 2.24, 2.65, '#d8c89f', 0.2);
    addLabel('HOME SOURDOUGH CELL', 0, 1.96, 1.16, '#203734', [1.72, 0.4, 1]);
    addDimensionLine(new THREE.Vector3(-2.75, 0.05, 1.52), new THREE.Vector3(2.75, 0.05, 1.52), '~5 ft counter width', new THREE.Vector3(0, 0.34, 1.78), 'z');
    addDimensionLine(new THREE.Vector3(2.9, 0.05, -1.28), new THREE.Vector3(2.9, 0.05, 1.28), '~30 in depth', new THREE.Vector3(2.45, 0.38, 0.05), 'x');
    addDimensionLine(new THREE.Vector3(-2.96, -0.02, -1.34), new THREE.Vector3(-2.96, 2.12, -1.34), '~34 in height', new THREE.Vector3(-2.54, 1.15, -1.18), 'x');

    const stationMeshes = Object.fromEntries(
      homeStations.map((station) => {
        const [x, y, z] = station.position;
        const [w, h, d] = station.size;
        return [station.id, addBox(x, y, z, w, h, d, station.color)];
      })
    );
    homeStations.forEach((station) => addLabel(station.label, ...station.labelPosition, '#203734', [1.05, 0.3, 1]));
    const focusMeshes = Object.fromEntries(
      homeStations.map((station) => {
        const [x, y, z] = station.position;
        const [w, h, d] = station.size;
        const mesh = addBox(x, y + 0.03, z, w + 0.16, h + 0.14, d + 0.16, '#d9a73a', 0.23);
        mesh.visible = false;
        return [station.id, mesh];
      })
    );
    const callouts = Object.fromEntries(
      Object.entries(homeStageFocus).map(([stage, focus]) => {
        const station = homeStations.find((item) => item.id === focus.station);
        const [x, y, z] = station.labelPosition;
        const sprite = addLabel(focus.callout, x, y + 0.42, z, '#9c442e', [1.35, 0.36, 1]);
        sprite.visible = false;
        return [stage, { sprite, baseY: sprite.position.y }];
      })
    );

    ['starter', 'hoppers', 'mixer', 'oven', 'proof', 'cool'].forEach((stationId) => {
      stationMeshes[stationId].visible = false;
    });
    const starterStation = createStarterStation(-2.25, 0.66, 0.68);
    const starterFill = starterStation.fill;
    createIngredientHoppers(-2.2, 1.2, -0.55);
    const mixerStation = createMixerStation(-0.9, 0.64, -0.2);
    const mixerBowl = mixerStation.bowl;
    const proofStation = createProofDrawer(0.15, 0.46, 0.75);
    const brevilleOven = createBrevilleOven(1.4, 0.62, -0.33);
    const oven = brevilleOven.body;
    const coolingRack = createCoolingRack(2.28, 0.32, 0.72);
    addLabel('OVEN 18.9"W x 15.9"D x 10.9"H', 1.38, 1.14, 0.82, '#9c442e', [1.45, 0.32, 1]);

    const cleanWave = addBox(0.55, 0.51, -1.02, 0.72, 0.035, 0.32, '#8fb3c7', 0.75);

    const pathPoints = homePathPoints.map((point) => new THREE.Vector3(...point));
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    scene.add(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, 0.018, 8),
      new THREE.MeshStandardMaterial({ color: '#71865c', emissive: '#314200', emissiveIntensity: 0.12 })
    ));
    const arrowMarkers = [0.18, 0.38, 0.58, 0.78].map((pathT) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 20), new THREE.MeshStandardMaterial({ color: '#71865c', roughness: 0.55 }));
      cone.rotation.x = Math.PI / 2;
      cone.position.copy(curve.getPointAt(pathT));
      scene.add(cone);
      return { cone, pathT };
    });

    const dough = new THREE.Group();
    const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 16), new THREE.MeshStandardMaterial({ color: '#d0a85c', roughness: 0.88 }));
    loaf.scale.set(1.35, 0.7, 0.9);
    dough.add(loaf);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.045, 0.34), new THREE.MeshStandardMaterial({ color: '#596a70', roughness: 0.62 }));
    tray.position.set(0, -0.13, 0);
    dough.add(tray);
    scene.add(dough);

    const ingredientSources = ingredientFeed.map((item, index) => ({
      item,
      start: new THREE.Vector3(-2.72 + index * 0.28, 1.33, -0.92),
      starterEnd: new THREE.Vector3(-2.25, 1.16, 0.68),
      mixerEnd: new THREE.Vector3(-0.9, 0.92, -0.2),
      badge: addIngredientBadge(item, -2.72 + index * 0.28, 1.33, -0.92)
    }));

    const arm = new THREE.Group();
    arm.position.set(-0.05, 0.16, 0.04);
    const armMat = new THREE.MeshStandardMaterial({ color: '#d9a73a', metalness: 0.24, roughness: 0.42 });
    const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.16), armMat);
    arm.add(armBase);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.12), armMat);
    lower.position.set(0.2, 0.4, 0);
    lower.rotation.z = -0.42;
    arm.add(lower);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), armMat);
    upper.position.set(0.5, 0.72, 0);
    upper.rotation.z = 0.68;
    arm.add(upper);
    const gripper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.12), armMat);
    gripper.position.set(0.76, 0.94, 0);
    arm.add(gripper);
    scene.add(arm);
    addLabel('COMPACT ARM', -0.08, 1.45, 0.18, '#d9a73a', [1.25, 0.34, 1]);

    const poseByStage = {
      feed: { y: -1.55, z: -0.05, lower: -0.78, upper: 1.08, grip: -0.12 },
      starter: { y: -1.15, z: 0, lower: -0.36, upper: 0.58, grip: 0 },
      mix: { y: -0.75, z: -0.03, lower: -0.62, upper: 0.86, grip: -0.08 },
      bulk: { y: -0.45, z: 0.03, lower: -0.72, upper: 1.02, grip: 0.12 },
      proof: { y: 0.32, z: 0.02, lower: -0.48, upper: 0.74, grip: 0 },
      bake: { y: 1.08, z: -0.04, lower: -0.72, upper: 1.04, grip: -0.1 },
      cool: { y: 1.42, z: 0.04, lower: -0.54, upper: 0.84, grip: 0.08 },
      clean: { y: 2.55, z: 0.1, lower: -0.2, upper: 0.36, grip: 0.2 }
    };
    const pathByStage = {
      feed: 0.02,
      starter: 0.08,
      mix: 0.24,
      bulk: 0.32,
      proof: 0.47,
      bake: 0.67,
      cool: 0.83,
      clean: 0.98
    };

    let raf;
    let lastPhaseUiUpdate = 0;
    let lastElapsed = 0;
    const startedAt = performance.now();

    const applyPhase = (t, elapsed) => {
      const nextStage = getStageIndexForPhase(schedule, t * 100);
      const stage = schedule.stages[nextStage] || schedule.stages[0];
      const stageProgress = clampNumber(((t * schedule.totalMinutes) - stage.startMinute) / stage.minutes, 0, 0, 1);
      const nextStageId = schedule.stages[nextStage + 1]?.id || stage.id;
      const fromPath = pathByStage[stage.id] ?? 0;
      const toPath = pathByStage[nextStageId] ?? fromPath;
      const pathT = THREE.MathUtils.lerp(fromPath, toPath, stage.id === 'starter' ? 0 : stageProgress * 0.45);
      const doughPos = curve.getPointAt(clampNumber(pathT, 0, 0, 0.99));
      dough.position.copy(doughPos);
      dough.position.y += Math.sin(elapsed * 4) * 0.015;
      loaf.material.color.set(stage.id === 'bake' || stage.id === 'cool' || stage.id === 'clean' ? '#b96f35' : '#d0a85c');
      loaf.scale.set(1.18 + stageProgress * 0.18, stage.id === 'proof' ? 0.88 : 0.7, 0.92);

      const starterProgress = stage.id === 'starter'
        ? stageProgress
        : (['mix', 'bulk', 'proof', 'bake', 'cool', 'clean'].includes(stage.id) ? 1 : 0.12 + stageProgress * 0.18);
      const fillHeight = 0.2 + starterProgress * 0.48;
      starterFill.scale.y = fillHeight / 0.24;
      starterFill.position.y = 0.26 + fillHeight / 2;
      starterStation.bubbles.forEach((bubble, index) => {
        const { angle, radius, baseY, speed } = bubble.userData;
        const swirl = angle + elapsed * (0.35 + index * 0.015);
        const usableHeight = Math.max(0.14, fillHeight - 0.04);
        const localY = ((baseY - 0.3 + elapsed * speed * 0.045) % usableHeight);
        bubble.position.set(
          -2.25 + Math.cos(swirl) * radius,
          0.3 + localY,
          0.68 + Math.sin(swirl) * radius
        );
        bubble.visible = starterProgress > 0.08;
        bubble.material.opacity = Math.min(0.82, 0.18 + starterProgress * 0.7);
      });

      ingredientSources.forEach(({ start, starterEnd, mixerEnd, badge }, index) => {
        const isFeed = stage.id === 'feed';
        const isMix = stage.id === 'mix';
        const target = isFeed ? starterEnd : mixerEnd;
        const feedT = (stageProgress * 1.5 + index * 0.16) % 1;
        const moving = isFeed || isMix;
        badge.position.lerpVectors(start, target, moving ? Math.min(1, feedT / 0.78) : 0);
        badge.position.y += moving ? Math.sin(feedT * Math.PI) * 0.18 : Math.sin(elapsed * 1.5 + index) * 0.015;
        badge.material.opacity = moving && feedT < 0.82 ? 1 : 0.34;
      });

      const focus = homeStageFocus[stage.id] || homeStageFocus.feed;
      Object.entries(focusMeshes).forEach(([stationId, focusMesh]) => {
        const active = stationId === focus.station;
        focusMesh.visible = active;
        focusMesh.scale.setScalar(active ? 1 + Math.sin(elapsed * 5) * 0.035 : 1);
      });
      Object.entries(stationMeshes).forEach(([stationId, mesh]) => {
        const active = stationId === focus.station;
        mesh.material.emissive.set(active ? '#332600' : '#000000');
        mesh.material.emissiveIntensity = active ? 0.28 : 0;
      });
      Object.entries(callouts).forEach(([stageId, callout]) => {
        const { sprite, baseY } = callout;
        sprite.visible = stageId === stage.id;
        if (sprite.visible) {
          sprite.position.y = baseY + Math.sin(elapsed * 3) * 0.02;
        }
      });

      const pose = poseByStage[stage.id] || poseByStage.feed;
      arm.rotation.y = pose.y + Math.sin(elapsed * 2.2) * 0.04;
      arm.rotation.z = pose.z;
      lower.rotation.z = pose.lower;
      upper.rotation.z = pose.upper;
      gripper.rotation.z = pose.grip;
      cleanWave.material.opacity = stage.id === 'clean' ? 0.9 : 0.28;
      cleanWave.position.y = 0.51 + Math.sin(elapsed * 5) * 0.02;
      oven.material.emissive.set(stage.id === 'bake' ? '#6a2b15' : '#000000');
      oven.material.emissiveIntensity = stage.id === 'bake' ? 0.28 + Math.sin(elapsed * 3) * 0.08 : 0;
      brevilleOven.glow.material.opacity = stage.id === 'bake' ? 0.52 + Math.sin(elapsed * 5) * 0.08 : 0.16;
      brevilleOven.glow.material.emissiveIntensity = stage.id === 'bake' ? 0.85 : 0.24;
      brevilleOven.rods.forEach((rod, index) => {
        rod.material.emissiveIntensity = stage.id === 'bake' ? 0.9 + Math.sin(elapsed * 8 + index) * 0.12 : 0.18;
      });
      brevilleOven.fan.rotation.z += stage.id === 'bake' ? 0.11 : 0.012;
      mixerBowl.rotation.y += stage.id === 'mix' ? 0.035 : 0.006;
      mixerStation.hookGroup.rotation.y += stage.id === 'mix' || stage.id === 'bulk' ? 0.16 : 0.018;
      mixerStation.dough.rotation.y += stage.id === 'mix' || stage.id === 'bulk' ? 0.055 : 0.006;
      mixerStation.dough.scale.set(
        1.35 + (stage.id === 'mix' ? Math.sin(elapsed * 8) * 0.045 : 0),
        stage.id === 'bulk' ? 0.4 + Math.sin(elapsed * 2.4) * 0.02 : 0.34,
        0.95 + (stage.id === 'mix' ? Math.cos(elapsed * 7) * 0.035 : 0)
      );
      mixerStation.head.material.emissive.set(stage.id === 'mix' ? '#332600' : '#000000');
      mixerStation.head.material.emissiveIntensity = stage.id === 'mix' ? 0.22 : 0;
      const proofProgress = stage.id === 'proof'
        ? stageProgress
        : (['bake', 'cool', 'clean'].includes(stage.id) ? 1 : stage.id === 'bulk' ? 0.35 : 0.12);
      proofStation.dough.scale.set(1.05 + proofProgress * 0.42, 0.45 + proofProgress * 0.24, 0.86 + proofProgress * 0.18);
      proofStation.dough.position.y = 0.53 + proofProgress * 0.08 + Math.sin(elapsed * 2.2) * 0.005;
      proofStation.glass.material.opacity = stage.id === 'proof' ? 0.34 : 0.22;
      proofStation.glow.material.opacity = stage.id === 'proof' ? 0.42 + Math.sin(elapsed * 3) * 0.08 : 0.18;
      proofStation.glow.material.emissiveIntensity = stage.id === 'proof' ? 0.45 : 0.18;
      proofStation.steam.forEach((wisp, index) => {
        wisp.material.opacity = stage.id === 'proof' ? 0.22 + Math.sin(elapsed * 2 + index) * 0.04 : 0.06;
        wisp.position.y = Math.sin(elapsed * 1.5 + index) * 0.025;
      });
      coolingRack.loaf.visible = ['cool', 'clean'].includes(stage.id) || (stage.id === 'bake' && stageProgress > 0.75);
      coolingRack.loaf.scale.set(1.55, 0.54 + (stage.id === 'cool' ? Math.sin(elapsed * 1.7) * 0.01 : 0), 0.98);
      coolingRack.steam.forEach((wisp, index) => {
        wisp.visible = coolingRack.loaf.visible;
        wisp.material.opacity = stage.id === 'cool' ? 0.2 + Math.sin(elapsed * 2.3 + index) * 0.04 : 0.06;
        wisp.position.y = Math.sin(elapsed * 1.7 + index) * 0.035;
      });
      scene.rotation.y = Math.sin(elapsed * 0.16) * 0.09;
      arrowMarkers.forEach(({ cone, pathT: arrowT }) => {
        const here = curve.getPointAt(arrowT);
        const next = curve.getPointAt(Math.min(0.99, arrowT + 0.015));
        cone.position.copy(here);
        cone.position.y += Math.sin(elapsed * 3 + arrowT * 10) * 0.018;
        cone.lookAt(next);
        cone.rotateX(Math.PI / 2);
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
        const nextPhase = (phaseRef.current + delta * 6) % 100;
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
      positionCamera();
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
  }, [model.loavesPerBake, model.ovenCycles, schedule]);

  const updatePhase = (value) => {
    const nextPhase = clampNumber(value, 0, 0, 100);
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    setPlaying(false);
  };

  return (
    <div>
      <div className={`scene homeScene ${sceneError ? 'sceneFallback' : ''}`} ref={mount}>
        {sceneError && (
          <div>
            <strong>3D renderer unavailable</strong>
            <span>The home micro-cell model still runs below; open this page in a browser with WebGL enabled to view the animated countertop unit.</span>
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
        <Metric label="Starter rise" value={telemetry.starterRise} />
        <Metric label="Bake cycle" value={telemetry.bakeCycle} />
        <Metric label="Loaves baked" value={`${telemetry.completedLoaves}/${model.loavesPerBake}`} />
        <Metric label="Water / week" value={`${format1(model.waterL)} L`} />
        <Metric label="Energy / week" value={`${format1(model.electricityKwh)} kWh`} />
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

function Automation({ model, multiplier, setMultiplier, assumptions }) {
  const containers = multiplier <= 2 ? 'One 20 ft container' : multiplier <= 5 ? 'Two 20 ft containers sharing oven/service spine' : 'One 40 ft container plus staging annex';
  const capex = getEquipmentRows(multiplier, assumptions).reduce((sum, [, qty, unit]) => sum + qty * unit, 0);
  const schedule = useMemo(() => getWorkflowSchedule(model), [model]);
  const insights = getAutomationInsights(model, schedule, multiplier);

  return (
    <section className="page">
      <div className="pageHead">
        <p className="eyebrow">Automated concept</p>
        <h1>Container bakery with robotic dough and oven handling.</h1>
      </div>
      <div className="pitchStrip">
        <Metric label="Lunch output" value={`${model.targetLoaves} loaves`} />
        <Metric label="Bake cycle" value={`${model.bakeRounds} rounds / ${model.ovenLoads} loads`} />
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
        <ContainerScene model={model} multiplier={multiplier} schedule={schedule} />
        <AutomationInsights insights={insights} />
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
            <Metric label="Oven loads" value={model.ovenLoads} />
            <Metric label="Bake rounds" value={model.bakeRounds} />
            <Metric label="Ovens modeled" value={model.ovenUnits} />
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

function AutomationInsights({ insights }) {
  return (
    <div className="insightGrid">
      {insights.map(([label, value, detail]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <p>{detail}</p>
        </article>
      ))}
    </div>
  );
}

function ContainerScene({ model, multiplier, schedule }) {
  const mount = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [sceneError, setSceneError] = useState(false);
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
    const camera = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 100);
    const cameraTarget = new THREE.Vector3(0, 0.72, 0);
    const positionCamera = () => {
      const aspect = el.clientWidth / Math.max(1, el.clientHeight);
      const z = aspect < 0.75 ? 20.5 : aspect < 1 ? 16.8 : aspect < 1.45 ? 17.2 : 8.8;
      const y = aspect < 0.75 ? 5.9 : aspect < 1 ? 5.45 : aspect < 1.45 ? 5.7 : 5.1;
      const x = aspect < 0.75 ? 3.2 : aspect < 1 ? 4.2 : aspect < 1.45 ? 3.8 : 6.35;
      camera.position.set(x, y, z);
      camera.lookAt(cameraTarget);
    };
    positionCamera();

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
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const addBox = (x, y, z, w, h, d, color, opacity = 1) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.68, transparent: opacity < 1, opacity });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = opacity >= 0.55;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const addCylinder = (x, y, z, radius, height, color, opacity = 1) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.12, transparent: opacity < 1, opacity });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = opacity >= 0.55;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const addRoundedBox = (x, y, z, w, h, d, color, radius = 0.06, options = {}) => {
      const shape = new THREE.Shape();
      const r = Math.min(radius, w / 2, h / 2);
      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: true,
        bevelThickness: options.bevelThickness ?? 0.025,
        bevelSize: options.bevelSize ?? 0.025,
        bevelSegments: options.bevelSegments ?? 4
      });
      geometry.translate(0, 0, -d / 2);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.48,
        metalness: options.metalness ?? 0.1,
        transparent: (options.opacity ?? 1) < 1,
        opacity: options.opacity ?? 1,
        emissive: options.emissive ?? '#000000',
        emissiveIntensity: options.emissiveIntensity ?? 0
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = (options.opacity ?? 1) >= 0.45;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const addTube = (points, color, radius = 0.014, opacity = 1) => {
      const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(path, 36, radius, 10),
        new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.18, transparent: opacity < 1, opacity })
      );
      mesh.castShadow = opacity >= 0.55;
      scene.add(mesh);
      return mesh;
    };

    const addTextPanel = (text, x, y, z, w, h, fill = '#101817', ink = '#dfead1') => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = fill;
      ctx.roundRect(18, 18, 476, 120, 22);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = '800 42px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(text, 256, 88);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(w, h, 1);
      scene.add(sprite);
      return sprite;
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

    const addSmallLabel = (text, x, y, z, accent = '#203734') => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255, 250, 240, 0.94)';
      ctx.roundRect(18, 18, 604, 92, 18);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.fillStyle = '#1a2421';
      ctx.font = '800 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(text, 320, 76);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.position.set(x, y, z);
      sprite.scale.set(1.8, 0.45, 1);
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

    const createLoafGroup = (x, y, z, scale = [1.2, 0.52, 0.78], color = '#b96f35') => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      const loaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 24, 14),
        new THREE.MeshStandardMaterial({ color, roughness: 0.88 })
      );
      loaf.scale.set(...scale);
      loaf.castShadow = true;
      loaf.receiveShadow = true;
      group.add(loaf);
      for (let i = 0; i < 3; i += 1) {
        const score = new THREE.Mesh(
          new THREE.BoxGeometry(0.075, 0.01, 0.012),
          new THREE.MeshStandardMaterial({ color: '#f0d79f', roughness: 0.75 })
        );
        score.position.set(-0.08 + i * 0.08, 0.08, 0.03);
        score.rotation.z = -0.35;
        group.add(score);
      }
      scene.add(group);
      return group;
    };

    const createMeteringMixerStation = () => {
      const x = -3.45;
      const z = -0.7;
      addSmallLabel('1. ingredient metering', -4.65, 1.52, -1.3, '#203734');
      addRoundedBox(-4.75, 0.28, -1.06, 1.0, 0.14, 1.52, '#596a70', 0.05, {
        metalness: 0.14,
        roughness: 0.42
      });
      const hopperSpecs = [
        { label: 'FLOUR', color: '#efe3bf', x: -5.05, z: -1.42, end: [-3.72, 1.03, -0.82] },
        { label: 'WATER', color: '#8fb3c7', x: -5.05, z: -0.94, end: [-3.48, 1.02, -0.73] },
        { label: 'STARTER', color: '#d0a85c', x: -5.05, z: -0.46, end: [-3.35, 1.02, -0.63] },
        { label: 'SALT', color: '#f7f7ef', x: -4.43, z: -1.18, end: [-3.22, 1.02, -0.62] }
      ];
      hopperSpecs.forEach((hopper) => {
        addRoundedBox(hopper.x, 0.92, hopper.z, 0.28, 0.76, 0.34, hopper.color, 0.045, {
          opacity: 0.72,
          roughness: 0.2,
          metalness: 0.02
        });
        addRoundedBox(hopper.x, 1.34, hopper.z, 0.34, 0.08, 0.4, '#d8d1c2', 0.02, {
          metalness: 0.36,
          roughness: 0.22
        });
        const funnel = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.26, 4),
          new THREE.MeshStandardMaterial({ color: hopper.color, roughness: 0.58, transparent: true, opacity: 0.86 })
        );
        funnel.position.set(hopper.x, 0.44, hopper.z);
        funnel.rotation.y = Math.PI / 4;
        funnel.castShadow = true;
        scene.add(funnel);
        addTextPanel(hopper.label, hopper.x, 0.94, hopper.z + 0.22, 0.34, 0.12, 'rgba(255,250,240,0.9)', '#203734');
        addTube([[hopper.x, 0.48, hopper.z], [hopper.x + 0.32, 0.7, hopper.z], hopper.end], '#d8d1c2', 0.016, 0.82);
      });

      addSmallLabel('2. spiral mix + dough tub', x, 1.78, z, '#203734');
      addRoundedBox(x, 0.26, z, 1.22, 0.18, 1.08, '#45585d', 0.06, {
        metalness: 0.18,
        roughness: 0.36
      });
      addRoundedBox(x - 0.48, 0.72, z + 0.08, 0.18, 0.74, 0.34, '#45585d', 0.055, {
        metalness: 0.18,
        roughness: 0.35
      });
      const head = addRoundedBox(x, 1.17, z - 0.04, 1.02, 0.28, 0.52, '#596a70', 0.095, {
        metalness: 0.2,
        roughness: 0.32
      });
      addRoundedBox(x + 0.37, 1.2, z + 0.25, 0.15, 0.075, 0.04, '#d9a73a', 0.016);
      addTextPanel('MIXER', x - 0.12, 1.18, z + 0.28, 0.34, 0.12, '#d8d1c2', '#203734');

      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.43, 0.32, 0.44, 48, 1, true),
        new THREE.MeshStandardMaterial({ color: '#d7d2c7', roughness: 0.18, metalness: 0.62, side: THREE.DoubleSide })
      );
      bowl.position.set(x, 0.72, z);
      bowl.castShadow = true;
      bowl.receiveShadow = true;
      scene.add(bowl);
      const bowlLip = new THREE.Mesh(
        new THREE.TorusGeometry(0.43, 0.016, 8, 56),
        new THREE.MeshStandardMaterial({ color: '#f1eadc', roughness: 0.16, metalness: 0.55 })
      );
      bowlLip.position.set(x, 0.94, z);
      bowlLip.rotation.x = Math.PI / 2;
      bowlLip.castShadow = true;
      scene.add(bowlLip);
      const dough = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 30, 16),
        new THREE.MeshStandardMaterial({ color: '#d0a85c', roughness: 0.92 })
      );
      dough.scale.set(1.5, 0.34, 0.96);
      dough.position.set(x, 0.83, z);
      dough.castShadow = true;
      scene.add(dough);
      const hookGroup = new THREE.Group();
      hookGroup.position.set(x, 1.05, z);
      const hookMat = new THREE.MeshStandardMaterial({ color: '#d8d1c2', roughness: 0.22, metalness: 0.58 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 16), hookMat);
      shaft.position.y = -0.14;
      hookGroup.add(shaft);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.016, 8, 34, Math.PI * 1.35), hookMat);
      hook.position.y = -0.39;
      hook.rotation.x = Math.PI / 2;
      hook.rotation.z = -0.55;
      hookGroup.add(hook);
      scene.add(hookGroup);

      const tub = addRoundedBox(x + 0.56, 0.48, z + 0.42, 0.38, 0.28, 0.46, '#dfead1', 0.045, {
        opacity: 0.38,
        metalness: 0.04,
        roughness: 0.16
      });
      const tubDough = createLoafGroup(x + 0.56, 0.62, z + 0.42, [1.15, 0.38, 0.8], '#d0a85c');

      return { bowl, bowlLip, dough, hookGroup, head, tub, tubDough };
    };

    const createProofRackStation = () => {
      const x = -2.05;
      const z = 0.85;
      addSmallLabel('3. transparent proof rack', x, 1.62, z + 0.2, '#203734');
      addRoundedBox(x, 0.25, z, 1.34, 0.12, 1.0, '#4f6548', 0.055, {
        metalness: 0.12,
        roughness: 0.38
      });
      const glass = addRoundedBox(x, 0.78, z, 1.34, 0.92, 0.98, '#dfead1', 0.07, {
        opacity: 0.18,
        metalness: 0.02,
        roughness: 0.08
      });
      const glow = addRoundedBox(x, 0.78, z, 1.18, 0.76, 0.84, '#dfead1', 0.06, {
        opacity: 0.18,
        emissive: '#9fbd7a',
        emissiveIntensity: 0.2,
        roughness: 0.8
      });
      const metal = '#c8c2b5';
      [-0.52, 0.52].forEach((sideX) => {
        [-0.42, 0.42].forEach((sideZ) => {
          addTube([[x + sideX, 0.24, z + sideZ], [x + sideX, 1.24, z + sideZ]], metal, 0.012, 1);
        });
      });
      const doughs = [];
      const covers = [];
      [0.44, 0.72, 1.0].forEach((shelfY, shelfIndex) => {
        addTube([[x - 0.58, shelfY, z - 0.42], [x + 0.58, shelfY, z - 0.42]], metal, 0.01, 1);
        addTube([[x - 0.58, shelfY, z + 0.42], [x + 0.58, shelfY, z + 0.42]], metal, 0.01, 1);
        addRoundedBox(x, shelfY - 0.02, z, 1.02, 0.045, 0.68, '#d8d1c2', 0.025, {
          metalness: 0.24,
          roughness: 0.3
        });
        [-0.32, 0, 0.32].forEach((offsetX, loafIndex) => {
          const cover = addRoundedBox(x + offsetX, shelfY + 0.075, z + (loafIndex % 2 ? -0.13 : 0.13), 0.25, 0.16, 0.28, '#ffffff', 0.035, {
            opacity: 0.24,
            roughness: 0.08
          });
          const dough = createLoafGroup(x + offsetX, shelfY + 0.12, z + (loafIndex % 2 ? -0.13 : 0.13), [0.9, 0.42, 0.72], '#d0a85c');
          dough.userData = { shelfIndex, loafIndex, baseY: dough.position.y };
          doughs.push(dough);
          covers.push(cover);
        });
      });
      const steam = Array.from({ length: 8 }, (_, index) => {
        const offsetX = -0.45 + index * 0.13;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x + offsetX, 0.44, z + 0.06),
          new THREE.Vector3(x + offsetX + 0.04, 0.72, z + 0.12),
          new THREE.Vector3(x + offsetX - 0.02, 1.12, z + 0.04)
        ]);
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 18, 0.006, 8),
          new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.2 })
        );
        scene.add(mesh);
        return mesh;
      });
      return { glass, glow, doughs, covers, steam };
    };

    const createDeckOvenStation = () => {
      const x = -0.45;
      const z = -0.85;
      addSmallLabel('4. Atlas 3-deck steam oven', x, 1.72, z + 0.12, '#203734');
      const body = addRoundedBox(x, 0.76, z, 1.58, 1.28, 0.92, '#4f6474', 0.1, {
        metalness: 0.22,
        roughness: 0.36,
        bevelThickness: 0.035,
        bevelSize: 0.035
      });
      addTextPanel('ATLAS CRAFT 3', x - 0.22, 1.34, z + 0.49, 0.62, 0.16, '#d8d1c2', '#263330');
      addTextPanel(`${model.ovenCapacity}/LOAD`, x + 0.45, 1.17, z + 0.52, 0.42, 0.13, '#102523', '#dff6ef');
      const glows = [];
      const deckDoors = [];
      [0.42, 0.75, 1.08].forEach((deckY, index) => {
        const frame = addRoundedBox(x - 0.16, deckY, z + 0.5, 1.08, 0.24, 0.055, '#d8d1c2', 0.035, {
          metalness: 0.5,
          roughness: 0.25
        });
        const glass = addRoundedBox(x - 0.16, deckY, z + 0.545, 0.9, 0.15, 0.035, '#101817', 0.025, {
          opacity: 0.76,
          roughness: 0.18
        });
        const glow = addRoundedBox(x - 0.16, deckY, z + 0.565, 0.78, 0.1, 0.025, '#f0a33c', 0.018, {
          opacity: 0.2,
          emissive: '#f97316',
          emissiveIntensity: 0.26,
          roughness: 0.8
        });
        const handle = addCylinder(x - 0.16, deckY + 0.13, z + 0.61, 0.018, 0.74, '#d7cbb7');
        handle.rotation.z = Math.PI / 2;
        handle.material.metalness = 0.48;
        handle.material.roughness = 0.22;
        glows.push(glow);
        deckDoors.push(frame, glass);
        if (index < 2) {
          addBox(x, deckY + 0.17, z + 0.04, 1.36, 0.035, 0.74, '#263330', 0.82);
        }
      });
      addRoundedBox(x + 0.58, 0.82, z + 0.54, 0.24, 0.82, 0.055, '#273532', 0.035, {
        metalness: 0.12,
        roughness: 0.4
      });
      ['260C', 'steam', `${model.ovenLoads} loads`].forEach((label, index) => {
        addTextPanel(label, x + 0.58, 1.08 - index * 0.24, z + 0.59, 0.3, 0.1, '#102523', index === 1 ? '#8fb3c7' : '#dff6ef');
      });
      addTube([[x - 0.78, 1.34, z - 0.1], [x - 1.0, 1.58, z - 0.6], [x - 1.1, 1.58, z - 1.32]], '#8fb3c7', 0.02, 0.86);
      const steam = Array.from({ length: 5 }, (_, index) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x - 0.52 + index * 0.2, 1.32, z + 0.52),
          new THREE.Vector3(x - 0.5 + index * 0.2, 1.54, z + 0.6),
          new THREE.Vector3(x - 0.57 + index * 0.2, 1.76, z + 0.52)
        ]);
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 18, 0.007, 8),
          new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.2 })
        );
        scene.add(mesh);
        return mesh;
      });
      return { body, glows, deckDoors, steam };
    };

    const createCoolingRackStation = () => {
      const x = 1.35;
      const z = -0.85;
      addSmallLabel('5. cooling accumulation', x, 1.88, z + 0.12, '#203734');
      const metal = '#c8c2b5';
      const shelves = [0.36, 0.67, 0.98, 1.29];
      [-0.56, 0.56].forEach((sideX) => {
        [-0.34, 0.34].forEach((sideZ) => {
          addTube([[x + sideX, 0.2, z + sideZ], [x + sideX, 1.46, z + sideZ]], metal, 0.013, 1);
        });
      });
      shelves.forEach((shelfY) => {
        addTube([[x - 0.62, shelfY, z - 0.36], [x + 0.62, shelfY, z - 0.36]], metal, 0.012, 1);
        addTube([[x - 0.62, shelfY, z + 0.36], [x + 0.62, shelfY, z + 0.36]], metal, 0.012, 1);
        for (let i = 0; i < 8; i += 1) {
          const wireX = x - 0.48 + i * 0.14;
          addTube([[wireX, shelfY, z - 0.34], [wireX, shelfY, z + 0.34]], metal, 0.006, 1);
        }
      });
      const loaves = [];
      shelves.forEach((shelfY, shelfIndex) => {
        [-0.32, 0, 0.32].forEach((offsetX, loafIndex) => {
          const loaf = createLoafGroup(x + offsetX, shelfY + 0.1, z + (loafIndex % 2 ? -0.13 : 0.13), [0.95, 0.45, 0.72], '#b96f35');
          loaf.userData = { shelfIndex, loafIndex, baseY: loaf.position.y };
          loaves.push(loaf);
        });
      });
      const steam = Array.from({ length: 9 }, (_, index) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x - 0.48 + index * 0.12, 0.88, z + 0.02),
          new THREE.Vector3(x - 0.44 + index * 0.12, 1.14, z + 0.08),
          new THREE.Vector3(x - 0.5 + index * 0.12, 1.42, z + 0.0)
        ]);
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 18, 0.006, 8),
          new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.2 })
        );
        scene.add(mesh);
        return mesh;
      });
      return { loaves, steam };
    };

    const createSlicerBaggerStation = () => {
      addSmallLabel('6. slice + bag packout', 3.52, 1.62, 0.25, '#203734');
      addRoundedBox(2.78, 0.32, 0.8, 1.08, 0.16, 1.22, '#596a70', 0.055, {
        metalness: 0.18,
        roughness: 0.36
      });
      addRoundedBox(2.8, 0.76, 0.78, 0.74, 0.76, 0.58, '#6f805d', 0.075, {
        metalness: 0.1,
        roughness: 0.38
      });
      addRoundedBox(2.8, 0.86, 1.11, 0.52, 0.36, 0.05, '#101817', 0.035, {
        opacity: 0.72,
        roughness: 0.18
      });
      const blade = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.012, 10, 46),
        new THREE.MeshStandardMaterial({ color: '#d8d1c2', roughness: 0.18, metalness: 0.72 })
      );
      blade.position.set(2.78, 0.82, 1.15);
      scene.add(blade);
      const bladeHub = addCylinder(2.78, 0.82, 1.16, 0.04, 0.03, '#596a70');
      bladeHub.rotation.x = Math.PI / 2;
      const conveyor = addRoundedBox(3.45, 0.35, 0.18, 1.54, 0.12, 0.36, '#45585d', 0.04, {
        metalness: 0.18,
        roughness: 0.38
      });
      for (let i = 0; i < 8; i += 1) {
        addTube([[2.78 + i * 0.18, 0.43, 0.0], [2.78 + i * 0.18, 0.43, 0.36]], '#c8c2b5', 0.006, 1);
      }
      const slices = [];
      for (let i = 0; i < 9; i += 1) {
        const slice = addRoundedBox(3.05 + i * 0.035, 0.55, 0.26 + i * 0.012, 0.018, 0.22, 0.18, '#d0a85c', 0.012, {
          roughness: 0.86
        });
        slices.push(slice);
      }
      const bagger = addRoundedBox(4.02, 0.62, -0.62, 0.82, 0.92, 0.82, '#aeb7b6', 0.075, {
        metalness: 0.16,
        roughness: 0.35
      });
      addTextPanel('BAG', 4.02, 0.94, -0.13, 0.32, 0.11, '#d8d1c2', '#203734');
      const roll = addCylinder(4.02, 1.16, -0.62, 0.22, 0.46, '#fffaf0', 0.72);
      roll.rotation.z = Math.PI / 2;
      const chute = addRoundedBox(3.78, 0.54, -0.22, 0.52, 0.1, 0.62, '#dfead1', 0.025, {
        opacity: 0.48,
        roughness: 0.18
      });
      const baggedLoaves = [0, 1, 2].map((index) => {
        const bag = addRoundedBox(4.2, 0.34 + index * 0.1, -0.15 + index * 0.12, 0.42, 0.12, 0.3, '#fffaf0', 0.035, {
          opacity: 0.58,
          roughness: 0.18
        });
        bag.userData = { baseY: bag.position.y };
        return bag;
      });
      return { blade, bladeHub, conveyor, slices, bagger, roll, chute, baggedLoaves };
    };

    const createWashdownStation = () => {
      addSmallLabel('7. timed washdown', 4.72, 1.34, -1.28, '#203734');
      const basin = addRoundedBox(4.68, 0.32, -1.22, 0.82, 0.18, 0.58, '#596a70', 0.055, {
        metalness: 0.22,
        roughness: 0.3
      });
      addRoundedBox(4.68, 0.44, -1.22, 0.62, 0.08, 0.42, '#8fb3c7', 0.04, {
        opacity: 0.52,
        roughness: 0.16
      });
      const faucet = addTube([[4.48, 0.58, -1.22], [4.48, 0.88, -1.22], [4.68, 0.88, -1.22], [4.68, 0.68, -1.22]], '#d8d1c2', 0.018, 1);
      const water = Array.from({ length: 5 }, (_, index) => {
        const stream = addTube([[4.58 + index * 0.04, 0.66, -1.22], [4.6 + index * 0.04, 0.48, -1.21]], '#8fb3c7', 0.006, 0.75);
        return stream;
      });
      return { basin, faucet, water };
    };

    const floorW = multiplier > 5 ? 12.4 : 10.4;
    const moduleCount = multiplier <= 2 ? 1 : multiplier <= 5 ? 2 : 3;
    const laneCount = Math.min(4, Math.max(1, Math.ceil(multiplier / 2)));
    const ovenQueueCount = Math.min(6, Math.max(1, model.ovenLoads));
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
    const stationFocusMeshes = Object.fromEntries(
      sceneStations.map((station) => {
        const [x, y, z] = station.position;
        const [w, h, d] = station.size;
        const focus = addBox(x, y + 0.04, z, w + 0.22, h + 0.18, d + 0.22, '#e2b84f', 0.22);
        focus.visible = false;
        return [station.id, focus];
      })
    );
    const stationCallouts = Object.fromEntries(
      Object.entries(stageFocus).map(([stage, focus]) => {
        const station = sceneStations.find((item) => item.id === focus.station);
        const [x, y, z] = station.labelPosition;
        const sprite = addSmallLabel(focus.callout, x, y + 0.55, z, '#9c442e');
        sprite.visible = false;
        return [stage, { sprite, baseY: sprite.position.y }];
      })
    );

    Object.values(stationMeshes).forEach((mesh) => {
      mesh.visible = false;
    });
    const meteringMixer = createMeteringMixerStation();
    const proofRack = createProofRackStation();
    const deckOven = createDeckOvenStation();
    const coolingRack = createCoolingRackStation();
    const slicerBagger = createSlicerBaggerStation();
    const washdownStation = createWashdownStation();
    addSmallLabel(`${model.targetLoaves} loaves · ${model.ovenLoads} oven load${model.ovenLoads === 1 ? '' : 's'} · ${model.bakeRounds} bake round${model.bakeRounds === 1 ? '' : 's'}`, 0.35, 2.02, 1.45, '#9c442e');

    const mixer = stationMeshes.mixer;
    const mixerDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.78, 28), new THREE.MeshStandardMaterial({ color: '#f0e0b5', roughness: 0.82 }));
    mixerDrum.rotation.x = Math.PI / 2;
    mixerDrum.position.set(-3.45, 0.68, -0.7);
    scene.add(mixerDrum);
    mixerDrum.visible = false;

    for (let lane = 0; lane < laneCount; lane += 1) {
      const z = 1.48 - lane * 0.36;
      for (let i = 0; i < Math.min(7, multiplier + 2); i += 1) {
        addBox(-3.6 + i * 1.15, 0.22, z, 0.48, 0.18, 0.58, lane === 0 ? '#caa15a' : '#d6b56f', 0.44);
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
    const arrowMarkers = [0.14, 0.31, 0.48, 0.65, 0.82].map((pathT) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.3, 24),
        new THREE.MeshStandardMaterial({ color: '#8fa765', emissive: '#314200', emissiveIntensity: 0.08, roughness: 0.55 })
      );
      cone.rotation.x = Math.PI / 2;
      cone.position.copy(curve.getPointAt(pathT));
      scene.add(cone);
      return { cone, pathT };
    });

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
    const trayGroups = Array.from({ length: Math.min(10, Math.max(3, model.ovenLoads + moduleCount)) }, (_, index) => createTray(index));

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
      const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), mat);
      wrist.position.set(0.86, 1.22, 0);
      group.add(wrist);
      const gripper = new THREE.Group();
      gripper.position.set(1.02, 1.24, 0);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.12), mat);
      gripper.add(palm);
      [-0.07, 0.07].forEach((offsetZ) => {
        const finger = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.035), mat);
        finger.position.set(0.13, -0.04, offsetZ);
        gripper.add(finger);
      });
      group.add(gripper);
      scene.add(group);
      return { group, lower, upper, wrist, gripper };
    });
    addSmallLabel('ARM A: dough handling', -0.95, 1.55, 0.24, '#d9a73a');
    addSmallLabel('ARM B: oven + packout', 1.8, 1.55, 0.24, '#d9a73a');

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
      const nextStage = getStageIndexForPhase(schedule, t * 100);
      const stage = schedule.stages[nextStage] || schedule.stages[0];
      const stageProgress = clampNumber(((t * schedule.totalMinutes) - stage.startMinute) / stage.minutes, 0, 0, 1);
      const stageId = stage.id;
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
      arrowMarkers.forEach(({ cone, pathT }) => {
        const here = curve.getPointAt(pathT);
        const next = curve.getPointAt(Math.min(0.99, pathT + 0.015));
        cone.position.copy(here);
        cone.position.y += Math.sin(elapsed * 3 + pathT * 10) * 0.02;
        cone.lookAt(next);
        cone.rotateX(Math.PI / 2);
      });
      ingredientSources.forEach(({ start, end, badge }, index) => {
        const feedT = (t * 1.6 + index * 0.19) % 1;
        const eased = feedT < 0.78 ? feedT / 0.78 : 0;
        badge.position.lerpVectors(start, end, eased);
        badge.position.y += Math.sin(feedT * Math.PI) * 0.28;
        badge.material.opacity = feedT < 0.82 ? 1 : 0.25;
      });
      meteringMixer.hookGroup.rotation.y += stageId === 'mix' ? 0.22 : stageId === 'proof' ? 0.025 : 0.012;
      meteringMixer.bowl.rotation.y += stageId === 'mix' ? 0.04 : 0.006;
      meteringMixer.dough.rotation.y += stageId === 'mix' ? 0.06 : 0.008;
      meteringMixer.dough.scale.set(
        1.5 + (stageId === 'mix' ? Math.sin(elapsed * 8) * 0.055 : 0),
        0.34 + (stageId === 'proof' ? 0.08 : 0) + (stageId === 'mix' ? Math.cos(elapsed * 7) * 0.02 : 0),
        0.96 + (stageId === 'mix' ? Math.cos(elapsed * 7) * 0.04 : 0)
      );
      meteringMixer.tubDough.visible = ['proof', 'shape', 'bake', 'cool', 'slice', 'clean'].includes(stageId);
      meteringMixer.tubDough.scale.setScalar(meteringMixer.tubDough.visible ? 1 + Math.sin(elapsed * 2.3) * 0.015 : 0.6);
      meteringMixer.head.material.emissive.set(stageId === 'mix' ? '#332600' : '#000000');
      meteringMixer.head.material.emissiveIntensity = stageId === 'mix' ? 0.24 : 0;

      const proofProgress = stageId === 'proof'
        ? stageProgress
        : (['shape', 'bake', 'cool', 'slice', 'clean'].includes(stageId) ? 1 : stageId === 'mix' ? 0.2 : 0.08);
      proofRack.glow.material.opacity = stageId === 'proof' ? 0.38 + Math.sin(elapsed * 3) * 0.06 : 0.16;
      proofRack.glow.material.emissiveIntensity = stageId === 'proof' ? 0.45 : 0.18;
      proofRack.glass.material.opacity = stageId === 'proof' ? 0.28 : 0.16;
      proofRack.doughs.forEach((dough, index) => {
        const stagger = clampNumber(proofProgress - index * 0.035, 0.05, 0.05, 1);
        dough.visible = proofProgress > index * 0.025 || ['shape', 'bake', 'cool', 'slice', 'clean'].includes(stageId);
        dough.scale.set(0.78 + stagger * 0.32, 0.8 + stagger * 0.18, 0.78 + stagger * 0.16);
        dough.position.y = dough.userData.baseY + stagger * 0.055 + Math.sin(elapsed * 1.9 + index) * 0.004;
      });
      proofRack.covers.forEach((cover) => {
        cover.material.opacity = stageId === 'proof' ? 0.32 : 0.2;
      });
      proofRack.steam.forEach((wisp, index) => {
        wisp.material.opacity = stageId === 'proof' ? 0.2 + Math.sin(elapsed * 2 + index) * 0.035 : 0.05;
        wisp.position.y = Math.sin(elapsed * 1.4 + index) * 0.025;
      });

      deckOven.body.material.emissive.set(stageId === 'bake' || stageId === 'shape' ? '#6a2b15' : '#000000');
      deckOven.body.material.emissiveIntensity = stageId === 'bake' ? 0.26 + Math.sin(elapsed * 3) * 0.08 : stageId === 'shape' ? 0.08 : 0;
      deckOven.glows.forEach((glow, index) => {
        const loadGlow = stageId === 'bake' ? 0.52 + Math.sin(elapsed * 5 + index) * 0.08 : 0.16;
        glow.material.opacity = loadGlow;
        glow.material.emissiveIntensity = stageId === 'bake' ? 0.82 : 0.24;
      });
      deckOven.steam.forEach((wisp, index) => {
        wisp.material.opacity = stageId === 'bake' ? 0.22 + Math.sin(elapsed * 2.2 + index) * 0.04 : 0.05;
        wisp.position.y = Math.sin(elapsed * 1.7 + index) * 0.04;
      });

      const rackFill = stageId === 'cool'
        ? stageProgress
        : (['slice', 'clean'].includes(stageId) ? 1 : stageId === 'bake' ? clampNumber(stageProgress - 0.55, 0, 0, 1) : 0);
      coolingRack.loaves.forEach((loaf, index) => {
        const visible = rackFill > index / Math.max(1, coolingRack.loaves.length - 1);
        loaf.visible = visible;
        loaf.position.y = loaf.userData.baseY + (visible ? Math.sin(elapsed * 1.6 + index) * 0.005 : 0);
      });
      coolingRack.steam.forEach((wisp, index) => {
        wisp.visible = rackFill > 0.08;
        wisp.material.opacity = stageId === 'cool' ? 0.22 + Math.sin(elapsed * 2.3 + index) * 0.04 : 0.06;
        wisp.position.y = Math.sin(elapsed * 1.7 + index) * 0.035;
      });

      slicerBagger.blade.rotation.z += stageId === 'slice' ? 0.28 : 0.025;
      slicerBagger.bladeHub.rotation.z += stageId === 'slice' ? 0.28 : 0.025;
      slicerBagger.conveyor.material.emissive.set(stageId === 'slice' ? '#162d20' : '#000000');
      slicerBagger.conveyor.material.emissiveIntensity = stageId === 'slice' ? 0.2 : 0;
      slicerBagger.slices.forEach((slice, index) => {
        slice.visible = ['slice', 'clean'].includes(stageId);
        slice.position.x = 3.05 + index * 0.035 + (stageId === 'slice' ? Math.sin(elapsed * 5 + index) * 0.012 : 0);
      });
      slicerBagger.baggedLoaves.forEach((bag, index) => {
        bag.visible = ['slice', 'clean'].includes(stageId);
        bag.position.y = bag.userData.baseY + (stageId === 'slice' ? Math.sin(elapsed * 2.5 + index) * 0.012 : 0);
        bag.material.opacity = stageId === 'slice' ? 0.72 : 0.5;
      });
      slicerBagger.roll.rotation.z += stageId === 'slice' ? 0.035 : 0.004;
      slicerBagger.bagger.material.emissive.set(stageId === 'slice' ? '#172b22' : '#000000');
      slicerBagger.bagger.material.emissiveIntensity = stageId === 'slice' ? 0.16 : 0;

      washdownStation.water.forEach((stream, index) => {
        stream.visible = stageId === 'clean';
        stream.material.opacity = stageId === 'clean' ? 0.75 + Math.sin(elapsed * 5 + index) * 0.08 : 0.08;
        stream.position.y = Math.sin(elapsed * 4 + index) * 0.015;
      });
      washdownStation.basin.material.emissive.set(stageId === 'clean' ? '#12343d' : '#000000');
      washdownStation.basin.material.emissiveIntensity = stageId === 'clean' ? 0.18 : 0;

      const activeFocus = stageFocus[stageId] || stageFocus.mix;
      Object.entries(stationFocusMeshes).forEach(([stationId, focusMesh]) => {
        const active = stationId === activeFocus.station;
        focusMesh.visible = active;
        focusMesh.scale.setScalar(active ? 1 + Math.sin(elapsed * 5) * 0.035 : 1);
      });
      Object.entries(stationMeshes).forEach(([stationId, mesh]) => {
        const active = stationId === activeFocus.station;
        mesh.material.emissive.set(active ? '#332600' : '#000000');
        mesh.material.emissiveIntensity = active ? 0.28 : 0;
      });
      Object.entries(stationCallouts).forEach(([stage, callout]) => {
        const { sprite, baseY } = callout;
        sprite.visible = stage === stageId;
        if (sprite.visible) {
          sprite.position.y = baseY + Math.sin(elapsed * 3) * 0.02;
        }
      });
      const poseSet = armPoses[stageId] || armPoses.mix;
      armGroups.forEach((arm, index) => {
        const pose = poseSet[index] || poseSet[0];
        arm.group.rotation.y = pose.y + Math.sin(elapsed * 2 + index) * 0.04;
        arm.group.rotation.z = pose.z;
        arm.lower.rotation.z = pose.lower;
        arm.upper.rotation.z = pose.upper;
        arm.wrist.rotation.y = elapsed * (stageId === 'clean' ? 1.8 : 0.8);
        arm.gripper.rotation.z = (stageId === 'shape' || stageId === 'slice' ? Math.sin(elapsed * 5 + index) * 0.14 : 0);
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
      positionCamera();
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
  }, [multiplier, model.ovenLoads, model.targetLoaves, model.ovenCapacity, schedule]);

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
        <Metric label="Bake round" value={`${telemetry.activeRound}/${model.bakeRounds}`} />
        <Metric label="Oven loads" value={telemetry.activeLoadLabel} />
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
              <td>{formatUnitMoney(qty * unit)}</td>
              <td>{note}</td>
            </tr>
          ))}
          <tr className="total">
            <th>Total</th>
            <td></td>
            <td></td>
            <td>{formatUnitMoney(total)}</td>
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
