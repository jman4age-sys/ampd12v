import React, { useMemo, useState } from "react";
import {
  Battery, Sun, Zap, Refrigerator, Lightbulb, Droplets, Flame, Coffee,
  HeartPulse, Wifi, Smartphone, Laptop, Wind, Plus, Minus, Info, CheckCircle2, AlertTriangle,
  Tablet, Camera, Fan, Tv, Thermometer, Microwave, Utensils, Wrench, Snowflake,
  Car, CloudRain, RotateCcw, Star, Sofa, ChevronRight, ArrowRight, Lock, ListChecks, Mail, ShieldCheck, FileText, HelpCircle, MapPin, Instagram, Youtube, Facebook,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts";

/* ────────────────────────────────────────────────────────────────────────
   GEAR CATALOG — daily Ah figures are the midpoint of realistic AU touring
   ranges (not manufacturer-guaranteed numbers — actual draw varies with
   ambient temp, thermostat setting, ventilation, and how it's used).
   ──────────────────────────────────────────────────────────────────────── */

const GEAR = [
  { key: "fridgeSmall",  label: "Fridge — Small (15-30L)",       icon: Refrigerator, ah: 20,  hint: "~15-25Ah/day, runs 24h" },
  { key: "fridgeMedium", label: "Fridge — Medium (35-50L)",       icon: Refrigerator, ah: 30,  hint: "~25-35Ah/day, runs 24h" },
  { key: "fridgeLarge",  label: "Fridge — Large (55-75L)",        icon: Refrigerator, ah: 38,  hint: "~30-45Ah/day, runs 24h" },
  { key: "fridgeXL",     label: "Fridge — XL / Dual-zone (80-110L)", icon: Refrigerator, ah: 50, hint: "~40-60Ah/day, runs 24h" },
  { key: "lights",        label: "LED Lighting",                  icon: Lightbulb,    ah: 5,   hint: "camp + strip lighting", defaultHours: 4,   maxHours: 12, desc: "Interior & camp lights",   cat: "comfort",   essential: true },
  { key: "phoneCharging", label: "Phone Charging",                icon: Smartphone,   ah: 2,   hint: "per device",            defaultHours: 3,   maxHours: 6,  desc: "Phones, watches, tablets", cat: "tech",      essential: true },
  { key: "tabletCharging",label: "Tablet Charging",               icon: Tablet,       ah: 4.5, hint: "per device",            defaultHours: 3,   maxHours: 6,  desc: "Tablets & e-readers",      cat: "tech" },
  { key: "laptopCharging",label: "Laptop Charging (12V direct)",  icon: Laptop,       ah: 15,  hint: "per device",            defaultHours: 3,   maxHours: 6,  desc: "Laptop straight off 12V",  cat: "tech" },
  { key: "cameraCharging",label: "Camera / Drone Charging",       icon: Camera,       ah: 9,   hint: "occasional",            defaultHours: 1.5, maxHours: 4,  desc: "Camera & drone batteries", cat: "tech" },
  { key: "starlinkMini",  label: "Starlink Mini",                 icon: Wifi,         ah: 29,  hint: "~8-50Ah/day",           defaultHours: 10,  maxHours: 20, desc: "Stay connected anywhere",  cat: "tech",      essential: true },
  { key: "starlinkStd",   label: "Starlink Standard",             icon: Wifi,         ah: 46,  hint: "~12-80Ah/day",          defaultHours: 10,  maxHours: 20, desc: "High-demand internet",     cat: "tech" },
  { key: "waterPump",     label: "Water Pump",                    icon: Droplets,     ah: 2.5, hint: "10-30 min use",         defaultHours: 0.3, maxHours: 1,  desc: "12V water pump, on demand",cat: "comfort",   essential: true },
  { key: "dieselHeater",  label: "Diesel Heater",                 icon: Flame,        ah: 16.5,hint: "running only — startup peak higher", defaultHours: 8, maxHours: 14, desc: "Cabin heat on cold nights", cat: "comfort" },
  { key: "cpap",          label: "CPAP (no humidifier)",          icon: HeartPulse,   ah: 22.5,hint: "~7-9h sleep",           defaultHours: 8,   maxHours: 10, desc: "Medical — per night",      cat: "comfort",   essential: true },
  { key: "cpapHumid",     label: "CPAP (with humidifier)",        icon: HeartPulse,   ah: 45,  hint: "~7-9h sleep",           defaultHours: 8,   maxHours: 10, desc: "Medical — per night",      cat: "comfort" },
  { key: "fan",           label: "12V Fan",                       icon: Fan,          ah: 9,   hint: "4-10h use",             defaultHours: 6,   maxHours: 14, desc: "Keep cool on warm days",   cat: "comfort",   essential: true },
  { key: "tv",             label: "12V Television",               icon: Tv,           ah: 12.5,hint: "2-5h use",             defaultHours: 3,   maxHours: 6,  desc: "Evening entertainment",    cat: "comfort",   essential: true },
  { key: "oven",           label: "12V Travel Oven",              icon: Microwave,    ah: 45,  hint: "2-6h use",             defaultHours: 3,   maxHours: 6,  desc: "Reheat & simple cooking",  cat: "cooking",   essential: true },
  { key: "electricBlanket",label: "Electric Blanket",             icon: Thermometer,  ah: 27.5,hint: "4-8h overnight",       defaultHours: 6,   maxHours: 9,  desc: "Warmth overnight",         cat: "comfort" },
];

// Fridge draw commonly rises 25-50% when run as a freezer instead of a fridge.
const FREEZER_MODE_MULTIPLIER = 1.375;

// Scales an item's baseline Ah/day figure by an adjustable hours-per-day override.
// Items without defaultHours (fridges — they run continuously) are unaffected.
function scaledItemAh(item, qty, hoursOverride, mult = 1) {
  if (!item.defaultHours) return item.ah * qty * mult;
  const hours = hoursOverride ?? item.defaultHours;
  return (item.ah / item.defaultHours) * hours * qty * mult;
}

const INVERTER_EFFICIENCY = 0.88;
const SYSTEM_VOLTAGE = 12;
// Conservative battery-side delivery allowance for normal DC-DC heat, wiring loss
// and charge taper. The charger's nameplate current remains the sizing input.
const DCDC_DELIVERY_FACTOR = 0.92;

// Energy an inverter appliance actually consumes. `duty` is the average share of its rated
// power drawn across a session — a thermostatic or variable appliance (induction hob, air
// fryer) rarely sits flat out. Peak sizing deliberately ignores this and uses the full
// rating, because the inverter, BMS and cabling still have to survive the maximum draw.
function inverterApplianceAh(item, qty, hoursOverride) {
  const hours = hoursOverride ?? item.defaultHours ?? 0;
  const duty = item.duty ?? 1;
  return (item.watts * duty * hours * qty) / (SYSTEM_VOLTAGE * INVERTER_EFFICIENCY);
}

const FRIDGE_KEYS = ["fridgeSmall", "fridgeMedium", "fridgeLarge", "fridgeXL"];

// Tiered against common BMS continuous-discharge ratings rather than one flat
// threshold, so the guidance reads as "what to check for" rather than a pass/fail
// verdict on a number this app can't actually verify (it doesn't know the real
// battery's BMS rating, only its Ah capacity — which doesn't reliably predict this).
function batteryDischargeCompatibility(requiredA) {
  if (requiredA <= 100) return { tier: "ok", note: "A 100A-rated BMS is generally sufficient for this." };
  if (requiredA <= 150) return { tier: "marginal", note: "Marginal for a 100A-rated BMS — look for at least 150A continuous, ideally with headroom." };
  if (requiredA <= 200) return { tier: "need200", note: "Needs a battery rated for at least 200A continuous discharge, or two batteries in parallel each sharing roughly half the load." };
  return { tier: "parallel", note: "Beyond typical single-battery territory — plan for two or more batteries in parallel, each individually rated to cover its share of the load." };
}

// Popular appliances run through an inverter — separated from the main list because
// their high INSTANTANEOUS current (not daily Ah) is what actually determines the
// inverter size, battery BMS max discharge rating, and cable/fuse sizing. They often
// use relatively few Ah/day since they run briefly, but undersizing around that low
// Ah figure alone would miss the real constraint.
const INVERTER_APPLIANCES = [
  { key: "coffeePod",    label: "Coffee Pod Machine",  icon: Coffee,   watts: 1250, peakA: 120, ah: 16, hint: "brief daily use",  defaultHours: 0.15, maxHours: 1,   cat: "cooking", desc: "Morning coffee" },
  { key: "microwave",    label: "Small Microwave",     icon: Microwave,watts: 1250, peakA: 120, ah: 10, hint: "brief daily use",  defaultHours: 0.1,  maxHours: 1,   cat: "cooking", desc: "Reheat leftovers" },
  { key: "toaster",      label: "Toaster",             icon: Utensils, watts: 1150, peakA: 110, ah: 8,  hint: "brief daily use",  defaultHours: 0.08, maxHours: 0.5, cat: "cooking", desc: "Toast & crumpets" },
  { key: "hairDryer",    label: "Hair Dryer",          icon: Wind,     watts: 1600, peakA: 150, ah: 11, hint: "brief daily use",  defaultHours: 0.08, maxHours: 0.5, cat: "comfort", desc: "Quick dry" },
  { key: "induction",    label: "Induction Cooktop",   icon: Flame,    watts: 1600, peakA: 150, ah: 39, duty: 0.55, hint: "1600W max — averages ~55% over a cook",  defaultHours: 0.5,  maxHours: 3,   cat: "cooking", desc: "Boils flat out, then simmers far lower" },
  { key: "airFryer",     label: "Air Fryer",           icon: Snowflake,watts: 1600, peakA: 150, ah: 40, duty: 0.65, hint: "1600W max — element cycles once hot",  defaultHours: 0.4,  maxHours: 2,   cat: "cooking", desc: "Full power to preheat, then cycles" },
  { key: "blender",      label: "Small Blender",       icon: Coffee,   watts: 500,  peakA: 47,  ah: 2,  hint: "brief use",        defaultHours: 0.05, maxHours: 0.5, cat: "cooking", desc: "Smoothies & prep" },
  { key: "toolCharger",  label: "Battery-Tool Charger",icon: Wrench,   watts: 200,  peakA: 20,  ah: 33, hint: "~2h charging",     defaultHours: 2,    maxHours: 6,   cat: "tech",    desc: "Recharge power tools" },
  { key: "laptopInverter",label: "Laptop Charger (via inverter)", icon: Laptop, watts: 82, peakA: 9, ah: 21, hint: "~3h use",      defaultHours: 3,    maxHours: 8,   cat: "tech",    desc: "Laptop via 240V brick" },
];

const SEASONS = {
  summer: { label: "Summer / Outback", emoji: "☀️", hours: 5.5 },
  spring: { label: "Spring / Autumn",  emoji: "⛅", hours: 4.5 },
  winter: { label: "Winter / Overcast",emoji: "🌧️", hours: 3.5 },
};

// Gear catalog tabs. "essential" is a flag on popular items (a curated starter set that
// spans types), the rest are true categories keyed on each item's `cat`.
const CATEGORIES = [
  { key: "essential", label: "Essentials",  icon: Star },
  { key: "comfort",   label: "Comfort",     icon: Sofa },
  { key: "cooking",   label: "Cooking",     icon: Flame },
  { key: "tech",      label: "Work & Tech", icon: Laptop },
];

const REGULATOR = {
  MPPT: { label: "MPPT", eff: 0.75, note: "Uses a conservative 75% whole-system solar yield to allow for hot panels, imperfect angle, wiring, controller and battery-charging losses." },
  PWM:  { label: "PWM",  eff: 0.62, note: "Uses a conservative 62% whole-system yield. PWM is simpler, but normally needs more panel wattage than MPPT for the same daily charge." },
};

const SHADE_LEVELS = {
  clear:   { label: "Ideal",           mult: 1.0, hint: "open sky, no obstruction" },
  partial: { label: "Mixed conditions",mult: 1.3, hint: "dappled shade, some tree cover" },
  heavy:   { label: "Poor solar access",mult: 1.6, hint: "heavy canopy — real shading is unpredictable (depends on panel layout and wiring), so treat this as a rough buffer, not a guarantee. A portable panel you can move into open sun is usually more reliable than just adding fixed panel wattage." },
};

// Sizes people actually buy, not whatever a raw calculation spits out.
const COMMON_BATTERY_SIZES = [50, 75, 100, 120, 135, 150, 200, 240, 300, 400];

const COMMON_SOLAR_SIZES = [100, 120, 160, 180, 200, 250, 300, 400];
// Solar controllers are rated by output current, and manufacturers publish a maximum PV
// array size for each. On a 12V system that works out to roughly 14.5 panel watts per amp
// of output (e.g. a 20A unit ≈ 290W, a 30A ≈ 440W, a 50A ≈ 700W). Used to check whether a
// controller — standalone MPPT, or the one built into a combined DC-DC — can pass the array.
// How the panels are mounted decides WHEN they can produce. A folding blanket is packed
// away on the road, so the DC-DC does all the work while driving; roof panels keep working.
// fixedShare = the portion of the array that produces while driving.
const SOLAR_MOUNT = {
  portable: { label: "Portable / folding", short: "Portable", fixedShare: 0,   note: "Blanket or folding panel, packed away while driving and deployed once you're set up. Your DC-DC does the charging on the road." },
  fixed:    { label: "Fixed roof panels",  short: "Fixed",    fixedShare: 1,   note: "Mounted on the roof or canopy, so they keep producing while you drive as well as when parked." },
  both:     { label: "Both",               short: "Both",     fixedShare: 0.5, note: "Roof panels run continuously and the portable adds output once parked. Assumes roughly half your array is roof-mounted." },
};

// Contact form. The site is fully static, so submissions are POSTed to a third-party form
// service. Your email address lives in THEIR dashboard — never in this file and never in the
// page source — so it can't be scraped or read by visitors. The access key below is safe to
// publish: it identifies the form, not the destination inbox.
//
// SETUP (Web3Forms, free, no account needed):
//   1. Go to https://web3forms.com and enter your email address
//   2. They email you an access key
//   3. Paste it below and set endpoint to https://api.web3forms.com/submit
//
// Formspree alternative: set endpoint to https://formspree.io/f/xxxxxxxx, leave accessKey "".
// Leave endpoint empty and the form shows a "not configured yet" notice instead of failing.
// Business details shown in the footer. Anything left empty is simply hidden, so the site
// never displays a placeholder to visitors. Fill these in when you have them.
const SITE = {
  abn: "",       // e.g. "12 345 678 901" — required on a .com.au, hidden while empty
  facebook: "",  // full URL, e.g. "https://facebook.com/ampd12v"
  instagram: "",
  youtube: "",
};

const CONTACT_FORM = {
  endpoint: "https://api.web3forms.com/submit",
  accessKey: "5e624168-1565-4bb1-9010-18fd9fc22b3a",
};
const CONTROLLER_W_PER_A = 14.5;
const COMMON_MPPT_SIZES = [10, 15, 20, 30, 40, 50, 60, 75, 100];
const mpptSizeFor = (panelW) =>
  COMMON_MPPT_SIZES.find((a) => a * CONTROLLER_W_PER_A >= panelW) ?? COMMON_MPPT_SIZES[COMMON_MPPT_SIZES.length - 1];
// Common DC-DC charger sizes used for brand-neutral recommendations.
const CHARGER_TIERS = [
  { sizeA: 20 },
  { sizeA: 25 },
  { sizeA: 40 },
  { sizeA: 50 },
];

const COMMON_INVERTER_SIZES = [150, 300, 600, 1000, 1500, 2000, 2500, 3000, 3500];

const ALTERNATOR_TYPES = {
  smart: { label: "Yes — smart / variable-voltage", note: "Common on most vehicles from roughly 2015 onward. A standard DC-DC charger won't charge reliably here — you need one with an ignition-trigger input (most current DC-DC chargers have this) or a purpose-built smart-alternator-compatible unit." },
  conventional: { label: "No — conventional / fixed-voltage", note: "Standard DC-DC installation — the charger senses the alternator's steady output directly, no special trigger wiring needed." },
  unsure: { label: "Not sure", note: "A sustained warm-idle voltage check (watch for several minutes, not one instant reading) or your auto-electrician can confirm. Until then, wiring for ignition-trigger compatibility is the safer default." },
};

const CHEMISTRY = {
  // cRate = safe CHARGE rate (used for DC-DC charger ceiling).
  // dischargeC = continuous DISCHARGE rate the bank must sustain, used to size a battery that
  // can actually feed a high-wattage inverter. Quality LiFePO4 is typically rated around 1C
  // continuous through the BMS (a 100Ah unit ≈ 100A, a 200Ah ≈ 200A), so Ah ≈ required amps.
  // Lead-acid is far worse under high current (Peukert losses + 50% DoD) — modelled at ~0.4C.
  LiFePO4: { label: "Lithium (LiFePO4)", dod: 0.85, cRate: 0.5, dischargeC: 1.0 },
  AGM:     { label: "AGM / Lead-acid",   dod: 0.50, cRate: 0.2, dischargeC: 0.4 },
};

/* ────────────────────────────────────────────────────────────────────────
   UI
   ──────────────────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, unit, detail, tone, children }) {
  const toneCls = { amber: "text-amber-400", teal: "text-teal-400", stone: "text-slate-900" }[tone];
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex-1 min-w-[220px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
          <Icon size={17} className={toneCls} />
        </div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      </div>
      <div className={`font-mono text-4xl font-bold ${toneCls} leading-none mb-2`}>
        {value}<span className="text-lg text-slate-500 font-normal ml-1">{unit}</span>
      </div>
      <div className="text-[12.5px] text-slate-500 leading-snug">{detail}</div>
      {children}
    </div>
  );
}

function RecommendationCard({ icon: Icon, title, value, unit, badge, badgeTone = "teal", summary, reasons = [], open, onToggle }) {
  const badgeCls = badgeTone === "red"
    ? "border-red-200 bg-red-50 text-red-700"
    : badgeTone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-teal-200 bg-teal-50 text-teal-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Icon size={21} className="text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{title}</div>
              <div className="font-mono text-3xl font-bold text-slate-950 leading-none mt-1">
                {value}<span className="text-base text-slate-500 font-normal ml-1">{unit}</span>
              </div>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold ${badgeCls}`}>{badge}</span>
        </div>
        <p className="text-[12.5px] text-slate-600 leading-relaxed">{summary}</p>
      </div>
      <button onClick={onToggle} className="w-full flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
        <span>{open ? "Hide reasoning" : "Why this recommendation?"}</span>
        <ChevronRight size={15} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          <div className="space-y-2">
            {reasons.map((reason) => (
              <div key={reason} className="flex items-start gap-2 text-[12.5px] text-slate-700 leading-snug">
                <CheckCircle2 size={14} className="text-teal-500 mt-0.5 shrink-0" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SystemDiagram({ solarLabel, chargerLabel, batteryLabel, activeGear, activeInverter, customFridge, customAppliances }) {
  const loads = [];
  if (customFridge) loads.push({ label: "Fridge", icon: Refrigerator });
  activeGear.filter((g) => !g.label.toLowerCase().includes("fridge")).slice(0, 4).forEach((g) => loads.push({ label: g.label.replace(/\s*—.*$/, ""), icon: GEAR.find((x) => x.label === g.label)?.icon || Zap }));
  activeInverter.slice(0, 2).forEach((a) => loads.push({ label: a.label, icon: Zap }));
  (customAppliances || []).slice(0, 2).forEach((a) => loads.push({ label: a.label, icon: Plus }));
  const shownLoads = loads.slice(0, 6);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 mb-5">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Your power flow</div>
          <div className="text-[12.5px] text-slate-500 mt-1">A simple overview of how the recommended system works.</div>
        </div>
        <span className="hidden sm:inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10.5px] font-semibold text-teal-700">Live from your selections</span>
      </div>
      <div className="grid lg:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-center">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-center">
          <Sun size={25} className="text-teal-600 mx-auto mb-2" />
          <div className="text-[10px] uppercase tracking-wide text-teal-700 font-semibold">Solar</div>
          <div className="font-mono text-[16px] text-slate-900 mt-1">{solarLabel}</div>
        </div>
        <ArrowRight size={20} className="hidden lg:block text-slate-300" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <Zap size={25} className="text-amber-600 mx-auto mb-2" />
          <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">Charging</div>
          <div className="font-mono text-[16px] text-slate-900 mt-1">{chargerLabel}</div>
        </div>
        <ArrowRight size={20} className="hidden lg:block text-slate-300" />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <Battery size={25} className="text-slate-700 mx-auto mb-2" />
          <div className="text-[10px] uppercase tracking-wide text-slate-600 font-semibold">Battery bank</div>
          <div className="font-mono text-[16px] text-slate-900 mt-1">{batteryLabel}</div>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Your loads</div>
        {shownLoads.length ? (
          <div className="flex flex-wrap gap-2">
            {shownLoads.map((load, i) => {
              const Icon = load.icon;
              return <span key={`${load.label}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] text-slate-700"><Icon size={13} className="text-slate-500" />{load.label}</span>;
            })}
          </div>
        ) : <div className="text-[12px] text-slate-400">Add appliances to see them here.</div>}
      </div>
    </div>
  );
}

function Dashboard({
  onBack, onShowDisclaimer, status, dailyAh, dailyWh,
  batteryRounded, batteryExceedsRange, recBatteryAh, batterySizedForDischarge, chem, chemistry, autonomyDays,
  solarLabel, solarBrandKey, peakSunHours, season, regulator, shade,
  chargerRounded, chargerLabel, chargerAtSingleUnitCeiling, recChargerA, chargerTier,
  solarSupportRounded, fullRecoveryAh, actualBatteryRuntimeDays,
  anyInverterSelected, recInverterW, inverterExceedsRange, peakInverterW, peakInverterA, exceedsTypicalBatteryDischarge,
  runInverterSimultaneously,
  actualSolarWh, actualDriveWh, simDriveWh, solarActualW, alternator, hoursDriven, solarMount,
  qty, invQty, customFridge, customFridgeQty, freezerMode, gearAh, customFridgeAh, inverterAh,
  customAppliances, customAppliancesAh, hours, invHours, chargerSetup, solarWasCapped, dischargeCompat,
  recMinAhForPeak, peakWantsBiggerBattery, requiredBmsA, inverterRatedA,
}) {
  const [dashDetails, setDashDetails] = useState(false);
  const [openRecommendation, setOpenRecommendation] = useState("battery");
  const displayVoltage = chemistry === "LiFePO4" ? 12.8 : 12;
  const activeGear = GEAR.filter((g) => (qty[g.key] || 0) > 0).map((g) => {
    const mult = (freezerMode && FRIDGE_KEYS.includes(g.key)) ? FREEZER_MODE_MULTIPLIER : 1;
    return { label: g.label, qty: qty[g.key], ah: scaledItemAh(g, qty[g.key], hours[g.key], mult) };
  });
  const activeInverter = INVERTER_APPLIANCES.filter((a) => (invQty[a.key] || 0) > 0).map((a) => ({
    label: a.label, qty: invQty[a.key], ah: inverterApplianceAh(a, invQty[a.key], invHours[a.key]), watts: a.watts,
  }));

  const gearChartData = useMemo(() => {
    const items = [];
    if (customFridge && customFridgeQty > 0) items.push({ name: `Custom fridge`, ah: customFridgeAh });
    activeGear.forEach((g) => items.push({ name: g.label, ah: g.ah }));
    activeInverter.forEach((a) => items.push({ name: a.label, ah: a.ah }));
    (customAppliances || []).forEach((a) => items.push({ name: a.label, ah: a.ah * a.qty }));
    return items.sort((a, b) => b.ah - a.ah);
  }, [customFridge, customFridgeQty, customFridgeAh, qty, invQty, freezerMode, customAppliances]);

  const balanceChartData = [
    { name: "Required", value: Math.round(dailyWh), fill: "#64748B" },
    { name: "Solar", value: Math.round(actualSolarWh), fill: "#4FA69C" },
    { name: "DC-DC (driving)", value: Math.round(actualDriveWh), fill: "#E7A33E" },
  ];

  const PIE_COLORS = ["#E7A33E", "#4FA69C", "#D2573C", "#93A39A", "#8B9A91", "#C98A3D", "#3D8A82", "#B8654F"];

  const statusMeta = {
    balanced: { label: "Expected charging should cover normal use", color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/30", Icon: CheckCircle2 },
    tight:    { label: "Charging is marginal — add driving or more solar", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", Icon: AlertTriangle },
    shortfall:{ label: "Charging shortfall expected", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", Icon: AlertTriangle },
  }[status];
  const StatusIcon = statusMeta.Icon;
  const dailyChargeAh = (actualSolarWh + actualDriveWh) / displayVoltage;
  const dailyBalanceAh = dailyChargeAh - dailyAh;
  const runtimeScore = Math.min(100, Math.round((actualBatteryRuntimeDays / Math.max(1, autonomyDays)) * 100));
  const recoveryScore = dailyAh > 0 ? Math.min(100, Math.round((dailyChargeAh / dailyAh) * 100)) : 100;
  const systemScore = Math.max(0, Math.min(100, Math.round(runtimeScore * 0.45 + recoveryScore * 0.55)));
  const scoreMeta = systemScore >= 90
    ? { label: "Excellent match", cls: "text-teal-700 bg-teal-50 border-teal-200", bar: "bg-teal-500" }
    : systemScore >= 75
      ? { label: "Good match", cls: "text-amber-700 bg-amber-50 border-amber-200", bar: "bg-amber-500" }
      : systemScore >= 60
        ? { label: "Marginal", cls: "text-orange-700 bg-orange-50 border-orange-200", bar: "bg-orange-500" }
        : { label: "Needs improvement", cls: "text-red-700 bg-red-50 border-red-200", bar: "bg-red-500" };
  const batteryValue = batteryExceedsRange ? `${Math.ceil(recBatteryAh)}+` : batteryRounded;
  const inverterValue = inverterExceedsRange ? `${Math.ceil(peakInverterW * 1.25)}+` : recInverterW;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-amber-400 transition-colors mb-5">
        ← Edit my gear
      </button>

      <div className="mb-6">
        <div className="text-[11px] tracking-[0.18em] uppercase text-teal-600 font-semibold mb-1.5">Results Dashboard</div>
        <h1 className="font-display text-4xl sm:text-5xl text-slate-950 leading-none mb-3">Your recommended 12V system</h1>
        <p className="text-[14px] text-slate-500 max-w-2xl">A practical setup based on your appliances, travel pattern, solar conditions and battery chemistry.</p>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-950 text-white p-6 sm:p-8 mb-5 shadow-lg overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(231,163,62,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(79,166,156,0.13),transparent_35%)]" />
        <div className="relative grid lg:grid-cols-[220px_1fr] gap-7 items-center">
          <div className="flex lg:block items-center gap-5">
            <div className={`w-28 h-28 rounded-full border-8 border-slate-800 flex items-center justify-center shrink-0 ${scoreMeta.cls}`}>
              <div className="text-center">
                <div className="font-mono text-3xl font-bold leading-none">{systemScore}%</div>
                <div className="text-[9px] uppercase tracking-wide font-semibold mt-1">System score</div>
              </div>
            </div>
            <div className="lg:mt-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Overall result</div>
              <div className="text-xl font-semibold text-white mt-1">{scoreMeta.label}</div>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium mt-2 ${statusMeta.bg} ${statusMeta.border} ${statusMeta.color}`}><StatusIcon size={13} />{statusMeta.label}</div>
            </div>
          </div>
          <div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4"><Battery size={19} className="text-amber-400 mb-2" /><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Battery</div><div className="font-mono text-2xl font-bold mt-1">{batteryValue}<span className="text-sm text-slate-400 ml-1">Ah</span></div></div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4"><Sun size={19} className="text-teal-400 mb-2" /><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Solar</div><div className="font-mono text-2xl font-bold mt-1">{solarLabel}</div></div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4"><Zap size={19} className="text-amber-400 mb-2" /><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">DC-DC</div><div className="font-mono text-2xl font-bold mt-1">{chargerLabel}</div></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Daily use</div><div className="font-mono text-[15px] text-white mt-1">{dailyAh.toFixed(0)}Ah</div></div>
              <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Runtime</div><div className="font-mono text-[15px] text-white mt-1">{actualBatteryRuntimeDays.toFixed(1)} days</div></div>
              <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Daily balance</div><div className={`font-mono text-[15px] mt-1 ${dailyBalanceAh >= 0 ? "text-teal-400" : "text-red-400"}`}>{dailyBalanceAh >= 0 ? "+" : ""}{dailyBalanceAh.toFixed(0)}Ah</div></div>
              <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Driving</div><div className="font-mono text-[15px] text-white mt-1">{hoursDriven}h/day</div></div>
            </div>
          </div>
        </div>
      </section>

      <div className={`h-2 rounded-full overflow-hidden bg-slate-200 mb-6`}><div className={`h-full ${scoreMeta.bar} transition-all`} style={{ width: `${systemScore}%` }} /></div>

      <div className={`grid gap-4 mb-5 ${anyInverterSelected ? "lg:grid-cols-4 sm:grid-cols-2" : "lg:grid-cols-3"}`}>
        <RecommendationCard icon={Battery} title="Battery bank" value={batteryValue} unit="Ah" badge={actualBatteryRuntimeDays >= autonomyDays ? "Excellent match" : "Check margin"} badgeTone={actualBatteryRuntimeDays >= autonomyDays ? "teal" : "amber"}
          summary={`${chem.label}. About ${Math.round((batteryExceedsRange ? recBatteryAh : batteryRounded) * chem.dod)}Ah usable and roughly ${actualBatteryRuntimeDays.toFixed(1)} days at your estimated load.`}
          reasons={[`${dailyAh.toFixed(0)}Ah estimated daily use`, `${autonomyDays} days selected without dependable charging`, `${Math.round(chem.dod * 100)}% planned usable depth of discharge`]}
          open={openRecommendation === "battery"} onToggle={() => setOpenRecommendation(openRecommendation === "battery" ? null : "battery")} />
        <RecommendationCard icon={Sun} title="Solar array" value={solarLabel} unit="" badge={dailyBalanceAh >= 0 ? "Covers normal use" : "Needs support"} badgeTone={dailyBalanceAh >= 0 ? "teal" : "amber"}
          summary={`Produces about ${(actualSolarWh / displayVoltage).toFixed(0)}Ah in the selected clear-day conditions using ${REGULATOR[regulator].label}.`}
          reasons={[`${peakSunHours} peak-sun hours for ${SEASONS[season].label}`, `${SHADE_LEVELS[shade].label.toLowerCase()} solar access selected`, `${dailyAh.toFixed(0)}Ah/day equipment load`]}
          open={openRecommendation === "solar"} onToggle={() => setOpenRecommendation(openRecommendation === "solar" ? null : "solar")} />
        <RecommendationCard icon={Zap} title="DC-DC charger" value={chargerLabel} unit="" badge={hoursDriven > 0 ? "Matched to driving" : "Optional backup"} badgeTone={hoursDriven > 0 ? "teal" : "amber"}
          summary={hoursDriven > 0 ? `Adds about ${fullRecoveryAh.toFixed(0)}Ah during a ${hoursDriven}h driving day. Solar-first alternative: ${solarSupportRounded}A.` : `No regular driving entered, so solar is your primary charging source.`}
          reasons={hoursDriven > 0 ? [`${hoursDriven} hours of driving entered`, `${dailyAh.toFixed(0)}Ah daily load to recover`, `${Math.round(batteryRounded * chem.cRate)}A approximate battery charge-rate ceiling`] : ["No regular driving selected", "Solar handles primary recovery", `${solarSupportRounded}A is a practical backup tier`]}
          open={openRecommendation === "charger"} onToggle={() => setOpenRecommendation(openRecommendation === "charger" ? null : "charger")} />
        {anyInverterSelected && <RecommendationCard icon={Zap} title="Inverter" value={inverterValue} unit="W" badge="Peak-load sized" badgeTone="teal"
          summary={`Sized for ${runInverterSimultaneously ? `${peakInverterW}W combined use` : `your largest selected item at ${peakInverterW}W`} plus 25% headroom.`}
          reasons={[`${peakInverterW}W calculated peak appliance load`, "25% sizing headroom", `Confirm a BMS rating of at least ${requiredBmsA}A continuous`]}
          open={openRecommendation === "inverter"} onToggle={() => setOpenRecommendation(openRecommendation === "inverter" ? null : "inverter")} />}
      </div>

      <SystemDiagram solarLabel={solarLabel} chargerLabel={chargerLabel} batteryLabel={`${batteryValue}Ah`} activeGear={activeGear} activeInverter={activeInverter} customFridge={customFridge} customAppliances={customAppliances} />

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 mb-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">What the result means</div>
        <p className="text-[13.5px] text-slate-700 leading-relaxed">
          Your equipment uses about <span className="font-mono text-slate-900">{dailyAh.toFixed(0)}Ah/day</span>. Expected solar contributes about <span className="font-mono text-teal-600">{(actualSolarWh / displayVoltage).toFixed(0)}Ah</span> and a normal driving day contributes about <span className="font-mono text-amber-600">{(actualDriveWh / displayVoltage).toFixed(0)}Ah</span>.
          {dailyBalanceAh >= 0 ? <> Under the selected conditions, that leaves an estimated <span className="font-mono text-teal-600">+{dailyBalanceAh.toFixed(0)}Ah/day</span> margin.</> : <> Under the selected conditions, the system has an estimated <span className="font-mono text-red-600">{dailyBalanceAh.toFixed(0)}Ah/day</span> deficit.</>}
        </p>
      </div>
      {solarWasCapped && (
        <div className="text-[12px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
          Your panels could produce more than shown — your combined charger's {chargerRounded}A total output rating is the bottleneck. Also confirm the exact charger's maximum solar watts, open-circuit voltage and input current.
        </div>
      )}
      {(batteryExceedsRange || chargerAtSingleUnitCeiling || inverterExceedsRange) && (
        <div className="text-[12px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
          Some requirements are at the top of this calculator's range.{chargerAtSingleUnitCeiling ? " A 50A charger cannot replace the full daily use in the selected drive time. Use longer drives, solar or shore power; only use multiple chargers where the manufacturer explicitly approves the arrangement." : ""} For a large battery bank, get a professional cable/fuse/BMS assessment.
        </div>
      )}

      {shade === "heavy" && (
        <div className="text-[12px] text-amber-300 bg-amber-500/[0.07] border border-amber-500/20 rounded-lg px-3.5 py-2.5 mb-4">
          Poor solar access is only modelled as a planning buffer. A movable portable panel or another charging source is recommended; extra fixed wattage alone may not overcome partial shade.
        </div>
      )}

      <div className="flex items-start gap-2 text-[12px] text-amber-300 bg-amber-500/[0.07] border border-amber-500/20 rounded-lg px-3.5 py-2.5 mb-4">
        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" />
        <span>Important: These results are estimates only and are not a substitute for advice from a qualified installer. Always confirm exact equipment ratings and have installation details checked by a qualified professional before purchasing or installing a system.</span>
      </div>

      <TripSimulator
        recBattery={batteryExceedsRange ? Math.ceil(recBatteryAh) : batteryRounded}
        recSolarW={solarActualW}
        recChargerA={chargerRounded}
        solarWhPerW={(peakSunHours * REGULATOR[regulator].eff) / SHADE_LEVELS[shade].mult}
        fixedShare={SOLAR_MOUNT[solarMount].fixedShare}
        hoursDriven={hoursDriven}
        chargerSetup={chargerSetup}
        peakSunHours={peakSunHours}
        voltage={displayVoltage}
        dod={chem.dod}
        dailyWh={dailyWh}
      />

      <button
        onClick={() => setDashDetails((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-teal-400 hover:text-teal-300 mb-4 mt-8 transition-colors"
      >
        {dashDetails ? "▲ Hide full calculation details" : "▼ Show full calculation details — energy balance, alternator, gear breakdown"}
      </button>

      {dashDetails && (
        <>
          {/* Energy balance */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 mb-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Daily energy balance</div>
            <div className="grid sm:grid-cols-2 gap-4 items-center">
              <div className="space-y-2 text-[13.5px]">
                <div className="flex justify-between"><span className="text-slate-700">Required</span><span className="font-mono text-slate-900">{dailyWh.toFixed(0)}Wh ({dailyAh.toFixed(1)}Ah)</span></div>
                <div className="flex justify-between"><span className="text-slate-700">Solar production</span><span className="font-mono text-teal-400">+{actualSolarWh.toFixed(0)}Wh</span></div>
                <div className="flex justify-between"><span className="text-slate-700">DC-DC while driving ({hoursDriven}h)</span><span className="font-mono text-amber-400">+{actualDriveWh.toFixed(0)}Wh</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold"><span className="text-slate-900">Net balance</span><span className={`font-mono ${(actualSolarWh + actualDriveWh - dailyWh) >= 0 ? "text-teal-400" : "text-red-400"}`}>{(actualSolarWh + actualDriveWh - dailyWh) >= 0 ? "+" : ""}{(actualSolarWh + actualDriveWh - dailyWh).toFixed(0)}Wh</span></div>
              </div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={balanceChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 10.5 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 10.5 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#0F172A" }}
                      itemStyle={{ color: "#0F172A" }}
                      formatter={(v) => [`${v}Wh`, ""]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {balanceChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Alternator note */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-3.5 mb-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Alternator: {ALTERNATOR_TYPES[alternator].label}</div>
            <div className="text-[12px] text-slate-400 leading-snug">{ALTERNATOR_TYPES[alternator].note}</div>
          </div>

          {exceedsTypicalBatteryDischarge && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-4">
              <div className="text-[12.5px] font-semibold text-amber-400 mb-2">Battery-inverter compatibility check</div>
              <div className="space-y-1 text-[12.5px] mb-2">
                <div className="flex justify-between"><span className="text-slate-700">Battery capacity</span><span className="font-mono text-slate-800">{batteryExceedsRange ? `${Math.ceil(recBatteryAh)}+` : batteryRounded}Ah</span></div>
                <div className="flex justify-between"><span className="text-slate-700">Peak load draw</span><span className="font-mono text-slate-800">~{peakInverterA}A</span></div>
                <div className="flex justify-between"><span className="text-slate-700">A {recInverterW}W inverter can pull</span><span className="font-mono text-slate-800">~{Math.round(inverterRatedA)}A</span></div>
                <div className="flex justify-between"><span className="text-slate-700 font-semibold">Required BMS continuous rating</span><span className="font-mono font-semibold text-amber-700">≥{requiredBmsA}A</span></div>
                {peakWantsBiggerBattery && (
                  <div className="flex justify-between"><span className="text-slate-700 font-semibold">Minimum battery for that current</span><span className="font-mono font-semibold text-amber-700">~{recMinAhForPeak}Ah</span></div>
                )}
              </div>
              <div className="text-[12px] text-amber-800 leading-snug">
                <span className="font-semibold">Compatibility: </span>{dischargeCompat.note}
                {peakWantsBiggerBattery && <> Your daily energy only needs about {batteryExceedsRange ? `${Math.ceil(recBatteryAh)}+` : batteryRounded}Ah, but a {recInverterW}W inverter can draw ~{requiredBmsA}A — so you want around <span className="font-semibold">~{recMinAhForPeak}Ah</span>, since quality lithium is rated near 1C continuous (a {recMinAhForPeak}Ah battery ≈ a {recMinAhForPeak}A BMS).</>} Capacity (Ah) alone doesn't guarantee this — confirm the specific battery's BMS continuous-discharge rating, and size your cabling and fusing for the same current.
              </div>
            </div>
          )}

          {/* Gear list */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Your gear</div>
            <div className="grid sm:grid-cols-2 gap-4 items-center">
              <div className="space-y-1.5">
                {customFridge && customFridgeQty > 0 && (
                  <div className="flex justify-between text-[13.5px]">
                    <span className="text-slate-700">Custom fridge × {customFridgeQty}{freezerMode ? " (freezer mode)" : ""}</span>
                    <span className="font-mono text-slate-500">{customFridgeAh.toFixed(1)}Ah/day</span>
                  </div>
                )}
                {activeGear.map((g) => (
                  <div key={g.label} className="flex justify-between text-[13.5px]">
                    <span className="text-slate-700">{g.label} × {g.qty}</span>
                    <span className="font-mono text-slate-500">{g.ah.toFixed(1)}Ah/day</span>
                  </div>
                ))}
                {activeInverter.map((a) => (
                  <div key={a.label} className="flex justify-between text-[13.5px]">
                    <span className="text-slate-700">{a.label} × {a.qty} <span className="text-slate-400">(via inverter)</span></span>
                    <span className="font-mono text-slate-500">{a.ah.toFixed(1)}Ah/day</span>
                  </div>
                ))}
                {(customAppliances || []).map((a) => (
                  <div key={a.id} className="flex justify-between text-[13.5px]">
                    <span className="text-slate-700">{a.label} × {a.qty} <span className="text-slate-400">({a.is230V ? "custom · via inverter" : "custom"})</span></span>
                    <span className="font-mono text-slate-500">{(a.ah * a.qty).toFixed(1)}Ah/day</span>
                  </div>
                ))}
                {activeGear.length === 0 && !customFridge && activeInverter.length === 0 && (customAppliances || []).length === 0 && (
                  <div className="text-[13px] text-slate-500">No gear selected.</div>
                )}
              </div>
              {gearChartData.length > 0 && (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={gearChartData} dataKey="ah" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {gearChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "#0F172A" }}
                        itemStyle={{ color: "#0F172A" }}
                        formatter={(v, n) => [`${v.toFixed(1)}Ah/day`, n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 10.5, color: "#64748B" }} iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="text-[11.5px] text-slate-500 mt-4 leading-snug">
        Simplified, brand-neutral planning figures — actual needs vary with your specific gear, weather and driving pattern. Confirm the specifications of any equipment before purchasing.
      </div>
      <button onClick={onShowDisclaimer} className="text-[11.5px] text-slate-500 hover:text-amber-400 underline mt-3 transition-colors">
        Disclaimer
      </button>
    </div>
  );
}



const LEGAL_PAGES = {
  privacy: {
    eyebrow: "Legal",
    title: "Privacy Policy",
    intro: "This policy explains how AMP'D 12V handles information when you use the calculator or contact us.",
    sections: [
      { title: "Information we collect", body: "The calculator runs in your browser and does not require an account. We may receive information you voluntarily submit through a contact form, such as your name, email address and message. Standard hosting and analytics services may also collect basic technical data such as browser type, device type, approximate location and pages visited." },
      { title: "How information is used", body: "Information is used to operate and improve the website, respond to enquiries, understand general site usage, prevent misuse and meet legal obligations." },
      { title: "Cookies and analytics", body: "The website may use essential cookies and privacy-conscious analytics. Third-party services may set their own cookies. You can restrict cookies through your browser settings, although parts of the site may not work as intended." },
      { title: "Data sharing", body: "We do not sell personal information. Information may be handled by service providers needed to host, secure, analyse or operate the website, or disclosed where required by law." },
      { title: "Contact form", body: "Messages sent through the contact form are delivered by Web3Forms, a third-party form service, which processes the name, email address and message you provide and forwards them to us by email. Web3Forms handles that data under its own privacy policy. We use what you send only to reply to your enquiry and keep it no longer than needed for that purpose. If you would rather not use the form, no personal details are required to use the calculator itself." },
      { title: "Contact and access", body: "You may contact AMP'D 12V through the contact form to ask what personal information is held about you, request a correction or deletion, or raise a privacy concern. If you are not satisfied with our response, you can refer the matter to the Office of the Australian Information Commissioner (oaic.gov.au)." },
    ],
  },
  terms: {
    eyebrow: "Legal",
    title: "Terms & Conditions",
    intro: "These terms apply when you access or use AMP'D 12V and its calculators and guides.",
    sections: [
      { title: "Planning tool only", body: "The calculator provides general estimates based on the information entered. It is not professional electrical, engineering, installation, legal or financial advice." },
      { title: "Your responsibility", body: "You are responsible for checking manufacturer specifications, battery and BMS limits, cable sizing, fusing, ventilation, mounting and regulatory requirements before purchasing or installing equipment." },
      { title: "No guarantee", body: "Results may differ from real-world performance because weather, temperature, equipment condition, installation quality and user behaviour vary. AMP'D 12V does not guarantee uninterrupted access, error-free calculations or a particular result." },
      { title: "External websites", body: "Links to external websites may be provided for reference. AMP'D 12V does not control their content, availability, warranties, privacy practices or terms." },
      { title: "Intellectual property", body: "Unless otherwise stated, the AMP'D 12V name, calculator design, written content and original graphics are protected content and may not be republished or commercially reused without permission." },
      { title: "Limitation of liability", body: "To the maximum extent permitted by law, AMP'D 12V is not liable for loss, damage, injury, equipment failure, business interruption or costs arising from use of the website or reliance on its results." },
    ],
  },
  disclaimer: {
    eyebrow: "Legal",
    title: "Disclaimer",
    intro: "AMP'D 12V is an independent information and planning website for 4WD, camping and off-grid 12V systems.",
    sections: [
      { title: "Estimates only", body: "Calculator results are estimates generated from the appliances, conditions and settings entered. They are a planning starting point, not a guarantee of real-world performance." },
      { title: "Real-world variation", body: "Actual power use and charging output vary with ambient temperature, equipment type and model, battery age, panel temperature, shade, cable length, voltage drop, installation quality and how equipment is used." },
      { title: "Check exact product ratings", body: "Always confirm the exact specifications of the battery, charger, solar controller, inverter and appliances you intend to use. Equipment categories and sizing examples are illustrative and may change over time." },
      { title: "Qualified installation", body: "Electrical systems must be designed and installed in accordance with applicable laws, standards and manufacturer instructions. Use an appropriately qualified installer where required." },
      { title: "Independent website", body: "AMP'D 12V is an independent, brand-neutral planning website and is not affiliated with or endorsed by any manufacturer unless a relationship is expressly disclosed." },
    ],
  },
  cookies: {
    eyebrow: "Legal",
    title: "Cookie Policy",
    intro: "Cookies are small files stored by your browser that help websites function and understand usage.",
    sections: [
      { title: "Essential cookies", body: "Essential cookies may be used to support security, preferences and basic site operation." },
      { title: "Analytics cookies", body: "Analytics may be used to understand aggregated traffic and improve the calculator. Where practical, privacy-friendly settings should be used." },
      { title: "Managing cookies", body: "You can block or delete cookies through your browser. Blocking some cookies may affect website features." },
    ],
  },
  about: {
    eyebrow: "About",
    title: "About AMP'D 12V",
    intro: "AMP'D 12V helps Australian travellers make sense of batteries, solar, DC-DC charging and inverter loads before spending money on a 12V system.",
    sections: [
      { title: "What we do", body: "We turn common touring appliances and trip habits into practical battery, solar, charger and inverter guidance using transparent planning assumptions." },
      { title: "Why it exists", body: "12V advice is often scattered across product pages, forums and sales material. AMP'D 12V aims to provide a simpler, brand-neutral starting point." },
      { title: "Our approach", body: "Recommendations are based on energy use, available charging time, expected solar conditions and equipment limits. Estimates are clearly labelled and should always be checked against exact product specifications." },
      { title: "Australian focus", body: "The calculator is designed around common Australian 4WD and camping use, product sizes and conditions." },
    ],
  },
  faq: {
    eyebrow: "Support",
    title: "Frequently Asked Questions",
    intro: "Common questions about how to use the calculator and interpret the results.",
    sections: [
      { title: "Why is the recommended battery larger than my daily use?", body: "The calculator allows for your selected days of autonomy and the safe usable depth of discharge for the battery chemistry." },
      { title: "Do solar and DC-DC amps add together?", body: "Separate controllers can contribute independently. Combined solar/DC-DC chargers normally share one total battery-side output limit, so their maximum inputs should not simply be added together." },
      { title: "Why does inverter size depend on watts instead of Ah/day?", body: "Inverters must handle instantaneous power. A high-wattage appliance may only run briefly and use modest daily energy, but it still requires sufficient inverter, BMS, cable and fuse capacity." },
      { title: "Are the fridge figures guaranteed?", body: "No. Fridge consumption changes significantly with ambient temperature, ventilation, thermostat setting, loading and lid openings. Use the figures as planning estimates." },
      { title: "Can I install the recommended system myself?", body: "That depends on the system and local requirements. High-current DC wiring and any fixed 230/240V work can present serious risks and may require qualified installation." },
    ],
  },
  contact: {
    eyebrow: "Support",
    title: "Contact",
    intro: "Questions, corrections and future partnership enquiries are welcome.",
    sections: [
      { title: "General enquiries", body: "Use the message form above — it reaches me directly, and saves publishing an email address for spambots to harvest." },
      { title: "Corrections", body: "Found a calculator assumption that needs updating? Include the appliance category, source and the figure you believe should be reviewed." },
      { title: "Commercial enquiries", body: "Future commercial relationships will not change the calculator's brand-neutral sizing logic. Any sponsored arrangement will be disclosed clearly." },
      { title: "Response times", body: "AMP'D 12V is a small independent project, so replies may not be immediate." },
    ],
  },
};

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("General enquiry");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real people never see or fill this
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = name.trim().length > 1 && emailLooksValid && message.trim().length > 9 && state !== "sending";
  const configured = Boolean(CONTACT_FORM.endpoint);

  const send = async () => {
    if (!canSend) return;
    if (website) { setState("sent"); return; } // silently swallow bots
    setState("sending");
    setError("");
    try {
      const payload = {
        // Web3Forms uses `subject` as the email subject line and `from_name` as the sender,
        // so make both scannable in an inbox rather than every message looking identical.
        subject: `AMP'D 12V — ${subject} from ${name.trim()}`,
        from_name: name.trim(),
        name: name.trim(),
        email: email.trim(),
        enquiry_type: subject,
        message: message.trim(),
        ...(CONTACT_FORM.accessKey ? { access_key: CONTACT_FORM.accessKey } : {}),
      };
      const res = await fetch(CONTACT_FORM.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Send failed (${res.status})`);
      setState("sent");
      setName(""); setEmail(""); setMessage(""); setSubject("General enquiry");
    } catch (err) {
      setState("error");
      setError("That didn't send. Please try again in a moment.");
    }
  };

  if (state === "sent") {
    return (
      <section className="bg-white border border-teal-500/40 shadow-sm rounded-2xl px-5 py-6 text-center">
        <CheckCircle2 size={26} className="text-teal-600 mx-auto mb-2.5" />
        <h2 className="text-[16px] font-semibold text-slate-900 mb-1.5">Message sent</h2>
        <p className="text-[13.5px] text-slate-600 mb-4">Thanks — I'll get back to you as soon as I can.</p>
        <button onClick={() => setState("idle")} className="text-[13px] font-medium text-amber-700 hover:text-amber-800">Send another message</button>
      </section>
    );
  }

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500";

  return (
    <section className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-5">
      <h2 className="text-[15px] font-semibold text-slate-900 mb-1">Send a message</h2>
      <p className="text-[13px] text-slate-600 mb-4">Fill this in and it comes straight to me — no email address needed.</p>

      {!configured && (
        <div className="text-[12.5px] text-amber-800 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-4 leading-snug">
          <span className="font-semibold">Not connected yet.</span> Add your form endpoint to <span className="font-mono">CONTACT_FORM</span> in the source before publishing, or this button won't do anything.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label htmlFor="cf-name" className="block text-[12px] font-medium text-slate-700 mb-1">Your name</label>
          <input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Jane Smith" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="cf-email" className="block text-[12px] font-medium text-slate-700 mb-1">Your email</label>
          <input id="cf-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} placeholder="you@example.com" autoComplete="email" />
          {email.length > 3 && !emailLooksValid && <div className="text-[11.5px] text-amber-700 mt-1">That doesn't look like a complete email address.</div>}
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor="cf-subject" className="block text-[12px] font-medium text-slate-700 mb-1">What's it about?</label>
        <select id="cf-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>
          <option>General enquiry</option>
          <option>Correction to a figure or assumption</option>
          <option>Commercial enquiry</option>
          <option>Bug or something not working</option>
        </select>
      </div>

      <div className="mb-1">
        <label htmlFor="cf-message" className="block text-[12px] font-medium text-slate-700 mb-1">Message</label>
        <textarea id="cf-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={inputClass} placeholder="What can I help with?" />
        <div className="text-[11.5px] text-slate-400 mt-1">{message.trim().length < 10 ? "A little more detail helps." : `${message.trim().length} characters`}</div>
      </div>

      {/* Honeypot: hidden from people, irresistible to bots */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

      {state === "error" && (
        <div className="text-[12.5px] text-red-700 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 my-3">{error}</div>
      )}

      <button onClick={send} disabled={!canSend || !configured}
        className="mt-3 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14.5px] font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99] transition-all">
        {state === "sending" ? "Sending…" : "Send message"} <ArrowRight size={16} />
      </button>

      <p className="text-[11.5px] text-slate-400 mt-3 leading-snug">
        Your name, email and message are sent to the form provider that handles this site's mail, and are used only to reply to you. See the Privacy Policy for details.
      </p>
    </section>
  );
}

function ContentPage({ pageKey, onBack, onNavigate }) {
  const page = LEGAL_PAGES[pageKey] || LEGAL_PAGES.disclaimer;
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-amber-400 transition-colors mb-5">← Back to calculator</button>
      <div className="mb-7">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-teal-500/20 border border-slate-200 flex items-center justify-center"><Zap size={19} className="text-amber-400" /></div>
          <div className="font-display text-2xl text-slate-900">AMP'D 12V</div>
        </div>
        <div className="text-[11px] tracking-[0.18em] uppercase text-teal-400/80 font-semibold mb-1.5">{page.eyebrow}</div>
        <h1 className="font-display text-4xl sm:text-5xl text-slate-900 leading-none mb-3">{page.title}</h1>
        <p className="text-[14.5px] text-slate-500 leading-relaxed max-w-2xl">{page.intro}</p>
      </div>
      <div className="space-y-4">
        {pageKey === "contact" && <ContactForm />}
        {page.sections.map((section) => (
          <section key={section.title} className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-4">
            <h2 className="text-[15px] font-semibold text-slate-900 mb-2">{section.title}</h2>
            <p className="text-[13.5px] text-slate-700 leading-relaxed whitespace-pre-line">{section.body}</p>
          </section>
        ))}
      </div>
      <div className="mt-7 text-[11.5px] text-slate-400">Last updated July 2026.</div>
      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={() => onNavigate("privacy")} className="text-[12px] text-slate-400 hover:text-amber-400">Privacy</button>
        <button onClick={() => onNavigate("terms")} className="text-[12px] text-slate-400 hover:text-amber-400">Terms</button>
        <button onClick={() => onNavigate("disclaimer")} className="text-[12px] text-slate-400 hover:text-amber-400">Disclaimer</button>
      </div>
    </div>
  );
}

function SiteFooter({ onNavigate }) {
  const linkClass = "block text-[12.5px] text-slate-400 hover:text-amber-400 transition-colors text-left";
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-950">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-teal-500/20 border border-slate-700 flex items-center justify-center"><Zap size={20} className="text-amber-400" /></div>
              <div>
                <div className="font-display text-2xl text-white leading-none">AMP'D 12V</div>
                <div className="text-[10px] tracking-[0.14em] uppercase text-teal-400/70 mt-1">Independent 4WD power planning</div>
              </div>
            </div>
            <p className="text-[12.5px] text-slate-400 leading-relaxed max-w-sm">Independent planning tools for Australian 4WD, camping and off-grid 12V systems.</p>
            {(SITE.facebook || SITE.instagram || SITE.youtube) && (
              <div className="flex gap-2 mt-4">
                {[["facebook", Facebook, "Facebook"], ["instagram", Instagram, "Instagram"], ["youtube", Youtube, "YouTube"]]
                  .filter(([k]) => SITE[k])
                  .map(([k, Icon, label]) => (
                    <a key={k} href={SITE[k]} target="_blank" rel="noopener noreferrer" aria-label={label}
                      className="w-9 h-9 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors"><Icon size={15}/></a>
                  ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold mb-3">Support</div>
            <div className="space-y-2.5">
              <button onClick={() => onNavigate("about")} className={linkClass}>About us</button>
              <button onClick={() => onNavigate("faq")} className={linkClass}>FAQ</button>
              <button onClick={() => onNavigate("contact")} className={linkClass}>Contact</button>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold mb-3">Legal</div>
            <div className="space-y-2.5">
              <button onClick={() => onNavigate("privacy")} className={linkClass}>Privacy policy</button>
              <button onClick={() => onNavigate("terms")} className={linkClass}>Terms &amp; conditions</button>
              <button onClick={() => onNavigate("disclaimer")} className={linkClass}>Disclaimer</button>
              <button onClick={() => onNavigate("cookies")} className={linkClass}>Cookie policy</button>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold mb-3">Trust</div>
            <div className="space-y-3 text-[12px] text-slate-400">
              <div className="flex gap-2"><ShieldCheck size={15} className="text-teal-400 shrink-0 mt-0.5"/><span>Independent planning guidance</span></div>
              <div className="flex gap-2"><FileText size={15} className="text-teal-400 shrink-0 mt-0.5"/><span>Estimates clearly disclosed</span></div>
              <div className="flex gap-2"><MapPin size={15} className="text-teal-400 shrink-0 mt-0.5"/><span>South Australia</span></div>
            </div>
          </div>
        </div>
        <div className="mt-9 pt-5 border-t border-slate-200 flex flex-col sm:flex-row gap-2 justify-between text-[11px] text-slate-500">
          <span>© 2026 AMP'D 12V. All rights reserved.</span>
          {SITE.abn && <span>ABN {SITE.abn}</span>}
        </div>
      </div>
    </footer>
  );
}

function Disclaimer({ onBack }) {
  const sections = [
    { title: "Estimates only", body: "Calculator results are estimates only, generated from the appliances, conditions, and settings you enter. They are a planning starting point, not a guarantee of real-world performance." },
    { title: "Real-world variation", body: "Actual power use varies with ambient temperature, specific equipment, battery age and condition, and how a system is actually used day to day. Any of these can push real consumption or output meaningfully above or below the figures shown here." },
    { title: "Check manufacturer specs", body: "Figures shown in this app are category-based planning estimates drawn from published guidance and reasonable real-world assumptions. Always confirm the specific rating of the exact product you intend to buy or install directly with the manufacturer before purchasing." },
    { title: "Not professional electrical advice", body: "This calculator is a planning tool. It is not professional electrical advice and should not be relied on as the sole basis for designing, purchasing, or installing a 12V or 240V system." },
    { title: "Compliance & qualified installation", body: "12V and 240V installations must comply with applicable Australian standards and regulatory requirements, and must be carried out by appropriately licensed and qualified people. This includes wiring, fusing, battery installation, and inverter/appliance setup." },
    { title: "Limitation of liability", body: "AMP'D 12V is not responsible for equipment damage, flat batteries, personal injury, or other losses arising from reliance on results produced by this calculator." },
    { title: "Accuracy of information", body: "Information in this app, including appliance assumptions and sizing guidance, may change over time or contain errors. Always verify current details before making a purchasing decision." },
  ];

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-amber-400 transition-colors mb-5">
        ← Back
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-teal-500/20 border border-slate-200 flex items-center justify-center shrink-0">
            <Zap size={18} className="text-amber-400" strokeWidth={2.5} />
          </div>
          <div className="font-display text-2xl leading-none text-slate-900">AMP'D 12V</div>
        </div>
        <div className="text-[11px] tracking-[0.18em] uppercase text-teal-400/80 font-semibold mb-1.5">Legal</div>
        <h1 className="font-display text-4xl text-slate-900 leading-none">Disclaimer</h1>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3.5 mb-6 flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <div className="text-[13.5px] text-amber-200 leading-snug">
          Important: These results are estimates only and are not a substitute for advice from a qualified installer. Always confirm exact equipment ratings and have installation details checked by a qualified professional before purchasing or installing a system.
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-3.5">
            <div className="text-[13.5px] font-semibold text-slate-900 mb-1.5">{s.title}</div>
            <div className="text-[13px] text-slate-700 leading-relaxed">{s.body}</div>
          </div>
        ))}
      </div>

      <div className="text-[11.5px] text-slate-400 mt-6">
        By using this calculator, you acknowledge and accept the terms above.
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   TRIP SIMULATOR — runs off the live setup values passed in as props
   (dailyWh, actualSolarWh, per-driving-day DC-DC, battery + chemistry), so it
   uses the exact same numbers as the results above rather than a separate model.
   ──────────────────────────────────────────────────────────────────────── */

const SIM_MAX_DAYS = 7;

function runSimulation({
  batteryAh, voltage, dod, dailyWh,
  solarFullWhPerSunHour, solarFixedWhPerSunHour,
  chargerWhPerHour, chargerSetup, driveHours,
  peakSunHours, days, startingPct,
}) {
  const nominalWh = batteryAh * voltage;
  const minimumWh = nominalWh * (1 - dod);
  let storedWh = nominalWh * (startingPct / 100);
  const reservePct = nominalWh > 0 ? Math.round((minimumWh / nominalWh) * 100) : 0;
  const points = [{ day: 0, label: "Start", pct: startingPct, drove: false, cloudy: false, hitReserve: storedWh <= minimumWh }];

  // Quarter-hour steps let charging appear in the correct order instead of treating
  // the entire day as one net total. Driving is assumed to begin at 9am; the solar
  // window is centred on noon. These are planning assumptions, not a trip timetable.
  const STEP_H = 0.25;
  const DRIVE_START_H = 9;
  const sunStart = Math.max(0, 12 - peakSunHours / 2);
  const sunEnd = Math.min(24, 12 + peakSunHours / 2);
  const loadWhPerHour = dailyWh / 24;

  days.forEach((d, i) => {
    let solarWh = 0;
    let dcdcWh = 0;
    let unmetWh = 0;
    let firstShortfallHour = null;
    let recoveredAfterReserve = false;
    let wasAtReserve = storedWh <= minimumWh + 0.01;

    for (let t = 0; t < 24; t += STEP_H) {
      const midpoint = t + STEP_H / 2;
      const drivingNow = d.drove && driveHours > 0 && midpoint >= DRIVE_START_H && midpoint < DRIVE_START_H + driveHours;
      const sunnyNow = midpoint >= sunStart && midpoint < sunEnd;
      const cloudFactor = d.cloudy ? 0.3 : 1;

      let stepSolarWh = 0;
      let stepDcdcWh = 0;

      if (sunnyNow) {
        if (drivingNow) {
          const fixedSolarPotential = solarFixedWhPerSunHour * cloudFactor * STEP_H;
          if (chargerSetup === "combined") {
            // Fixed solar and alternator share one battery-side output ceiling.
            const combinedCapacity = chargerWhPerHour * STEP_H;
            stepSolarWh = Math.min(fixedSolarPotential, combinedCapacity);
            stepDcdcWh = Math.max(0, combinedCapacity - stepSolarWh);
          } else {
            stepSolarWh = fixedSolarPotential;
            stepDcdcWh = chargerWhPerHour * STEP_H;
          }
        } else {
          stepSolarWh = solarFullWhPerSunHour * cloudFactor * STEP_H;
        }
      } else if (drivingNow) {
        stepDcdcWh = chargerWhPerHour * STEP_H;
      }

      const beforeStep = storedWh;
      const netWh = stepSolarWh + stepDcdcWh - loadWhPerHour * STEP_H;
      const rawWh = storedWh + netWh;

      if (rawWh < minimumWh) {
        const missing = minimumWh - rawWh;
        unmetWh += missing;
        if (firstShortfallHour == null) firstShortfallHour = t + STEP_H;
        storedWh = minimumWh;
      } else {
        storedWh = Math.min(nominalWh, rawWh);
      }

      if (wasAtReserve && storedWh > minimumWh + 0.01 && beforeStep <= minimumWh + 0.01) {
        recoveredAfterReserve = true;
      }
      wasAtReserve = storedWh <= minimumWh + 0.01;
      solarWh += stepSolarWh;
      dcdcWh += stepDcdcWh;
    }

    points.push({
      day: i + 1,
      label: `Day ${i + 1}`,
      pct: nominalWh > 0 ? Math.round((storedWh / nominalWh) * 100) : 0,
      drove: d.drove,
      cloudy: d.cloudy,
      hitReserve: storedWh <= minimumWh + 0.01,
      shortfallAh: Math.round(unmetWh / voltage),
      ranOut: unmetWh > 0,
      firstShortfallHour: firstShortfallHour == null ? null : Math.round(firstShortfallHour * 4) / 4,
      solarAh: Math.round(solarWh / voltage),
      dcdcAh: Math.round(dcdcWh / voltage),
      inAh: Math.round((solarWh + dcdcWh) / voltage),
      recoveredAfterReserve,
      reservePct,
    });
  });
  return points;
}

function DayChip({ index, day, onToggleDrive, onToggleCloudy }) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold">Day {index + 1}</div>
      <button
        onClick={onToggleDrive}
        aria-pressed={day.drove}
        className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors ${
          day.drove
            ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
            : "border-slate-200 bg-white text-slate-400 hover:border-slate-400"
        }`}
      >
        <Car size={16} />
        <span className="text-[10px] font-medium">{day.drove ? "Driving" : "Parked"}</span>
      </button>
      <button
        onClick={onToggleCloudy}
        aria-pressed={day.cloudy}
        className={`w-16 h-7 rounded-lg border flex items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
          day.cloudy
            ? "border-stone-400/50 bg-stone-400/10 text-slate-700"
            : "border-slate-200 bg-white text-slate-300 hover:border-slate-400"
        }`}
      >
        <CloudRain size={11} /> {day.cloudy ? "Cloudy" : "Clear"}
      </button>
    </div>
  );
}

function TripSimulator({ recBattery, recSolarW, recChargerA, solarWhPerW, fixedShare, hoursDriven, chargerSetup, peakSunHours, voltage, dod, dailyWh }) {
  const [numDays, setNumDays] = useState(5);
  const [startingPct, setStartingPct] = useState(100);
  const [days, setDays] = useState(
    Array.from({ length: 5 }, (_, i) => ({ drove: i % 2 === 0, cloudy: false }))
  );
  // Adjustable system — starts at the recommended sizing, drag to explore.
  const [batteryAh, setBatteryAh] = useState(recBattery);
  const [solarW, setSolarW] = useState(recSolarW);
  const [chargerA, setChargerA] = useState(recChargerA);
  const recController = mpptSizeFor(recSolarW);
  const [controllerA, setControllerA] = useState(recController);
  const recFixedW = Math.round(recSolarW * fixedShare);
  const [fixedW, setFixedW] = useState(recFixedW);
  const [simDriveHours, setSimDriveHours] = useState(hoursDriven);

  const setNumDaysClamped = (n) => {
    const next = Math.max(2, Math.min(SIM_MAX_DAYS, n));
    setNumDays(next);
    setDays((cur) => {
      if (next > cur.length) {
        return [...cur, ...Array.from({ length: next - cur.length }, (_, i) => ({ drove: (cur.length + i) % 2 === 0, cloudy: false }))];
      }
      return cur.slice(0, next);
    });
  };

  const toggleDrive = (i) => setDays((d) => d.map((day, idx) => (idx === i ? { ...day, drove: !day.drove } : day)));
  const toggleCloudy = (i) => setDays((d) => d.map((day, idx) => (idx === i ? { ...day, cloudy: !day.cloudy } : day)));
  const reset = () => setDays(Array.from({ length: numDays }, (_, i) => ({ drove: i % 2 === 0, cloudy: false })));
  const resetSystem = () => { setBatteryAh(recBattery); setSolarW(recSolarW); setChargerA(recChargerA); setControllerA(recController); setFixedW(recFixedW); setSimDriveHours(hoursDriven); };

  // Whatever regulates the panels has a maximum array it can pass: in a combined unit that's
  // the DC-DC's own output rating; in a separate setup it's the standalone solar controller.
  const limiterA = chargerSetup === "combined" ? chargerA : controllerA;
  const usablePanelW = Math.round(limiterA * CONTROLLER_W_PER_A);
  const effectiveSolarW = Math.min(solarW, usablePanelW);
  const solarIsCapped = solarW > usablePanelW;

  // Solar is spread across a daylight window and driving is simulated chronologically.
  // A conservative delivery factor allows for charger heat, wiring loss and normal taper.
  const ratePerWattWh = peakSunHours > 0 ? solarWhPerW / peakSunHours : 0;
  const fixedWEff = Math.min(fixedW, effectiveSolarW);
  const solarFullWhPerSunHour = effectiveSolarW * ratePerWattWh;
  const solarFixedWhPerSunHour = fixedWEff * ratePerWattWh;
  const chargerWhPerHour = chargerA * voltage * DCDC_DELIVERY_FACTOR;

  const solarParkedWh = solarFullWhPerSunHour * peakSunHours;
  const solarAhPerDay = Math.round(solarParkedWh / voltage);
  const driveAhPerDay = Math.round((chargerWhPerHour * simDriveHours) / voltage);
  const usableAh = Math.round(batteryAh * dod);
  const dailyAhLoad = Math.round(dailyWh / voltage);

  const points = useMemo(
    () => runSimulation({
      batteryAh, voltage, dod, dailyWh,
      solarFullWhPerSunHour, solarFixedWhPerSunHour,
      chargerWhPerHour, chargerSetup, driveHours: simDriveHours,
      peakSunHours, days, startingPct,
    }),
    [batteryAh, voltage, dod, dailyWh, solarFullWhPerSunHour, solarFixedWhPerSunHour,
      chargerWhPerHour, chargerSetup, simDriveHours, peakSunHours, days, startingPct]
  );

  const minPct = Math.min(...points.map((p) => p.pct));
  const endPct = points[points.length - 1].pct;
  const everHitReserve = points.some((p) => p.hitReserve);
  const reservePct = Math.round((1 - dod) * 100);

  const status = everHitReserve
    ? { label: "Hits the reserve — this system can't keep up", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", Icon: AlertTriangle }
    : minPct < 30
    ? { label: "Gets tight — little margin for an extra cloudy day", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", Icon: AlertTriangle }
    : { label: "Comfortable margin the whole trip", color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/30", Icon: CheckCircle2 };
  const StatusIcon = status.Icon;
  const firstRanOut = points.find((p) => p.ranOut);
  const worstShortfall = Math.max(0, ...points.map((p) => p.shortfallAh || 0));

  const batteryMax = Math.max(600, Math.ceil((recBattery * 2) / 50) * 50);
  const solarMax = Math.max(800, Math.ceil((recSolarW * 2) / 100) * 100);
  const systemControls = [
    { key: "batt",  label: "Battery bank",  value: batteryAh, set: setBatteryAh, min: 50, max: batteryMax, step: 10, unit: "Ah", rec: recBattery,  sub: `${usableAh}Ah usable at ${Math.round(dod * 100)}% depth of discharge` },
    { key: "solar", label: "Solar array",   value: solarW,    set: setSolarW,    min: 0,  max: solarMax,    step: 20, unit: "W",  rec: recSolarW,   sub: `~${solarAhPerDay}Ah/day parked in the selected conditions` },
    ...(fixedShare > 0
      ? [{ key: "fixedw", label: "…of which roof-mounted", value: fixedWEff, set: setFixedW, min: 0, max: solarW, step: 20, unit: "W", rec: Math.min(recFixedW, solarW),
          sub: chargerSetup === "combined"
            ? `roof panels run while driving, but share the charger's ${chargerA}A ceiling`
            : `adds roof-solar input while driving; the portable share stays packed away` }]
      : []),
    ...(chargerSetup === "separate"
      ? [{ key: "mppt", label: "Solar controller", value: controllerA, set: setControllerA, min: 10, max: 100, step: 5, unit: "A", rec: recController, sub: `handles up to ~${Math.round(controllerA * CONTROLLER_W_PER_A)}W of panel` }]
      : []),
    { key: "driveh", label: "Hours driven on each driving day", value: simDriveHours, set: setSimDriveHours, min: 0, max: 8, step: 0.5, unit: "h", rec: hoursDriven, sub: `A ${chargerA}A charger contributes about ${driveAhPerDay}Ah over this drive after normal delivery losses` },
    { key: "dcdc",  label: chargerSetup === "combined" ? "DC-DC charger (solar + alternator)" : "DC-DC charger", value: chargerA, set: setChargerA, min: 0, max: 60, step: 5, unit: "A", rec: recChargerA, sub: chargerSetup === "combined" ? `~${driveAhPerDay}Ah per driving day · also caps solar at ~${usablePanelW}W` : `~${driveAhPerDay}Ah added per day you drive` },
  ];

  return (
    <div className="mt-8 pt-8 border-t border-slate-200">
      <div className="mb-6">
        <div className="text-[11px] tracking-[0.18em] uppercase text-teal-400/80 font-semibold mb-1.5">Trip Simulation</div>
        <h2 className="font-display text-3xl text-slate-900 leading-none mb-2">Will your battery keep up?</h2>
        <p className="text-slate-500 text-[14.5px]">
          Your load is about <span className="font-mono text-slate-800">{dailyAhLoad}Ah/day</span>. The sliders below start at your recommended system — drag any of them to watch the state of charge react, and see exactly why a bigger battery, more solar or a stronger charger changes the outcome.
        </p>
      </div>

      {/* Adjustable system */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Size your system</div>
          <button onClick={resetSystem} className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-amber-400 transition-colors">
            <RotateCcw size={12} /> Reset to recommended
          </button>
        </div>
        <p className="text-[12px] text-slate-400 mb-4 leading-snug">Drag to test a bigger — or smaller — system. The graph below updates live.</p>
        <div className="space-y-4">
          {systemControls.map((c) => {
            const below = c.value < c.rec;
            return (
              <div key={c.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[13px] font-medium text-slate-800">{c.label}</span>
                  <span className="font-mono text-[14px] text-amber-400">{c.value}{c.unit}</span>
                </div>
                <input
                  type="range" min={c.min} max={c.max} step={c.step} value={c.value}
                  onChange={(e) => c.set(Number(e.target.value))}
                  className="w-full accent-amber-500" aria-label={`${c.label} size`}
                />
                <div className="flex items-center justify-between mt-1 text-[11px] gap-3">
                  <span className="text-slate-400">{c.sub}</span>
                  <span className={below ? "text-amber-400 font-medium shrink-0" : "text-slate-400 shrink-0"}>
                    {below ? `↓ below recommended ${c.rec}${c.unit}` : `recommended ${c.rec}${c.unit}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {solarIsCapped && (
          <div className="text-[12px] text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mt-4 leading-snug">
            <span className="font-semibold">These don't match up.</span>{" "}
            {chargerSetup === "combined"
              ? `A combined unit shares one output, so a ${chargerA}A charger can only pass about ${usablePanelW}W of panel.`
              : `A ${controllerA}A solar controller can only pass about ${usablePanelW}W of panel.`}{" "}
            The extra {Math.max(0, solarW - usablePanelW)}W is doing nothing — the graph below already ignores it.{" "}
            {chargerSetup === "combined"
              ? "Either raise the DC-DC rating, or switch to a separate solar controller in step 2 so the panels charge independently."
              : `Step the controller up to about ${mpptSizeFor(solarW)}A to use the whole array.`}
          </div>
        )}
      </div>

      {/* Trip length */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[13px] text-slate-500">Trip length</span>
        <div className="flex items-center gap-1.5">
          {[3, 5, 7].map((n) => (
            <button
              key={n}
              onClick={() => setNumDaysClamped(n)}
              className={`px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors ${
                numDays === n ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
            >
              {n} days
            </button>
          ))}
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-amber-400 ml-auto transition-colors">
          <RotateCcw size={12} /> Reset days
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-[13px] text-slate-500">Starting charge</span>
        <input type="range" min={50} max={100} step={5} value={startingPct}
          onChange={(e) => setStartingPct(Number(e.target.value))}
          className="flex-1 max-w-xs accent-amber-500" aria-label="Starting battery percentage" />
        <span className="font-mono text-[13px] text-amber-400 w-12 text-right">{startingPct}%</span>
      </div>

      {/* Day toggles */}
      <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
        {days.map((day, i) => (
          <DayChip key={i} index={i} day={day} onToggleDrive={() => toggleDrive(i)} onToggleCloudy={() => toggleCloudy(i)} />
        ))}
      </div>

      {/* Status */}
      <div className={`inline-flex items-center gap-2 text-[13px] font-medium px-3.5 py-1.5 rounded-full border mb-4 ${status.bg} ${status.border} ${status.color}`}>
        <StatusIcon size={15} /> {status.label}
      </div>

      {firstRanOut && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 mb-5">
          <div className="text-[13.5px] font-semibold text-red-700 mb-1">
            Power first becomes unavailable on {firstRanOut.label} at about {firstRanOut.firstShortfallHour}h.
          </div>
          <div className="text-[12.5px] text-slate-700 leading-snug">
            That day still received {firstRanOut.solarAh}Ah from solar{firstRanOut.dcdcAh > 0 ? ` and ${firstRanOut.dcdcAh}Ah from the DC-DC charger` : ""},
            but the {Math.round(dailyWh / voltage)}Ah/day load was higher than the energy available at the time. The largest unsupplied amount is about {worstShortfall}Ah in a day.
            The simulation runs in 15-minute steps, so later driving can lift the battery above reserve again; loads are treated as unavailable whenever the battery is already at reserve and incoming charge cannot cover them.
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Battery state of charge</div>
          <div className="font-mono text-sm text-slate-700">
            Ends trip at <span className={endPct < 30 ? "text-red-400" : endPct < 60 ? "text-amber-400" : "text-teal-400"}>{endPct}%</span>
          </div>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} width={36} />
              <ReferenceLine y={reservePct} stroke="#D2573C" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Tooltip
                contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#0F172A" }}
                formatter={(v, _n, ctx) => [`${v}%`, ctx?.payload?.drove ? "Drove that day" : "Parked"]}
              />
              <Line type="monotone" dataKey="pct" stroke="#E7A33E" strokeWidth={2.5} dot={{ r: 4, fill: "#E7A33E" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[11px] text-slate-400 mt-2">Dashed red line marks the calculator's {reservePct}% reserve. The simulation stops planned discharge at this reserve.</div>
      </div>

      {/* Day-by-day breakdown */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Day by day</div>
        <div className="space-y-2">
          {points.slice(1).map((p, i) => (
            <div key={i} className="flex items-center justify-between text-[13px] py-1.5 border-b border-slate-200 last:border-0">
              <div className="flex items-center gap-2 text-slate-700 min-w-0">
                <span className="w-12 text-slate-500 shrink-0">{p.label}</span>
                {p.drove && <span className="flex items-center gap-1 text-amber-700 text-[11.5px]"><Car size={12} /> drove</span>}
                {p.cloudy && <span className="flex items-center gap-1 text-slate-500 text-[11.5px]"><CloudRain size={12} /> cloudy</span>}
                <span className="text-[11.5px] font-mono text-teal-700">solar +{p.solarAh}Ah</span>
                {p.dcdcAh > 0 && <span className="text-[11.5px] font-mono text-amber-700">DC-DC +{p.dcdcAh}Ah</span>}
                {p.recoveredAfterReserve && <span className="text-[11px] text-teal-700 font-medium">· recovered after reserve</span>}
                {p.ranOut && (
                  <span className="text-[11.5px] text-red-700 font-medium truncate">· unavailable from ~{p.firstShortfallHour}h (short {p.shortfallAh}Ah)</span>
                )}
              </div>
              <span className={`font-mono shrink-0 ${p.ranOut ? "text-red-600" : p.pct < 40 ? "text-amber-600" : "text-teal-700"}`}>{p.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11.5px] text-slate-400 mt-4 leading-snug">
        Simulation uses 15-minute steps, assumes driving starts at 9am on each selected driving day, and centres the selected peak-sun window around noon. Loads are spread evenly across the day; actual appliance timing, shade and charger taper will vary.
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   WIZARD SHELL — presentational components for the redesigned front page.
   None hold text inputs (those stay inline in App to avoid remount/focus loss).
   ──────────────────────────────────────────────────────────────────────── */

function Stepper({ count, onDec, onInc, tone = "amber" }) {
  const ring = tone === "red" ? "hover:text-red-400 hover:border-red-500/40" : "hover:text-amber-400 hover:border-amber-500/40";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button onClick={onDec} disabled={count === 0} aria-label="Decrease quantity"
        className={`w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 ${ring} disabled:opacity-30 disabled:pointer-events-none transition-colors`}><Minus size={14} /></button>
      <span className="font-mono text-sm w-5 text-center tabular-nums">{count}</span>
      <button onClick={onInc} aria-label="Increase quantity"
        className={`w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 ${ring} transition-colors`}><Plus size={14} /></button>
    </div>
  );
}

const WIZARD_STEPS = [
  { n: 1, label: "Gear" },
  { n: 2, label: "Usage" },
  { n: 3, label: "Your system" },
];

/* Brand strings in one place so a rename is a single edit here
   (legal page copy still carries the name in prose). */
const BRAND = {
  name: "AMP'D 12V",
  tagline: "Australian 12V Power Calculator",
};

const HOME_FEATURES = [
  { icon: Battery, title: "Battery sizing", body: "Works out the capacity you need from your real daily draw, your battery chemistry and how long you sit without a charge." },
  { icon: Sun, title: "Solar sizing", body: "Sizes the array for your season, regulator and how much shade you camp in — not a best-case lab figure." },
  { icon: Zap, title: "DC-DC charger", body: "Recommends a charger that suits your driving hours based on your driving hours and battery charging limits." },
  { icon: ListChecks, title: "Daily power use", body: "Add your fridge, lights, Starlink and 240V appliances, then tune the run hours to match how you actually camp." },
];

const HOME_STEPS = [
  { n: 1, title: "Add your gear", body: "Pick your fridge size, then add lights, Starlink, CPAP, a 12V oven or anything running through an inverter." },
  { n: 2, title: "Tell us how you travel", body: "Driving hours, season, shade, battery chemistry and how long you'll go between charges." },
  { n: 3, title: "See your system", body: "Battery, solar, DC-DC and inverter recommendations — plus a trip simulator you can resize live." },
];

const HOME_FLOW = [
  { icon: Car, label: "Your 4WD" },
  { icon: Battery, label: "Battery" },
  { icon: Sun, label: "Solar" },
  { icon: Zap, label: "Charger" },
];

function HomePage({ onStart, onNavigate }) {
  return (
    <>
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-[72px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-teal-500/20 border border-slate-700 flex items-center justify-center">
              <Zap size={20} className="text-amber-400" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-xl text-white">{BRAND.name}</div>
              <div className="text-[10px] tracking-[0.16em] uppercase text-teal-400/80 font-semibold hidden sm:block">{BRAND.tagline}</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => onNavigate("about")} className="hidden sm:block px-3 py-2 text-[13px] font-medium text-slate-300 hover:text-white transition-colors">About</button>
            <button onClick={() => onNavigate("faq")} className="hidden sm:block px-3 py-2 text-[13px] font-medium text-slate-300 hover:text-white transition-colors">FAQ</button>
            <button onClick={() => onNavigate("contact")} className="hidden md:block px-3 py-2 text-[13px] font-medium text-slate-300 hover:text-white transition-colors">Contact</button>
            <button onClick={onStart} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13.5px] font-bold bg-amber-500 text-[#12181A] hover:bg-amber-400 transition-colors">
              Build my system <ArrowRight size={15} />
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-slate-950 text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 pt-14 pb-16 sm:pt-20 sm:pb-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[12px] font-semibold text-teal-300 mb-5">
            <Star size={12} /> Australia's free 12V power calculator
          </span>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white leading-[0.92] mb-5">
            Build your perfect<br /><span className="text-amber-400">12V touring system</span>
          </h1>
          <p className="text-slate-300 text-[16.5px] sm:text-[18px] leading-relaxed mb-8 max-w-2xl">
            Work out the right battery, solar, DC-DC charger and inverter for your 4WD, caravan or camper — using your actual gear and how you really travel, not best-case guesses.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={onStart} className="flex items-center gap-2 px-7 py-4 rounded-xl text-[15.5px] font-bold bg-amber-500 text-[#12181A] hover:bg-amber-400 active:scale-[0.99] transition-all">
              Build my system <ArrowRight size={18} />
            </button>
            <a href="#how-it-works" className="flex items-center gap-2 px-7 py-4 rounded-xl text-[15.5px] font-semibold border border-slate-200 text-slate-800 hover:border-slate-400 hover:bg-white transition-colors">
              How it works
            </a>
          </div>
        </div>

        {/* Interactive flow row */}
        <button onClick={onStart} className="group w-full mt-12 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8 hover:border-amber-500/40 transition-colors text-left">
          <div className="flex items-center justify-center gap-2 sm:gap-6 flex-wrap">
            {HOME_FLOW.map((f, i) => {
              const Icon = f.icon;
              return (
                <React.Fragment key={f.label}>
                  <div className="flex flex-col items-center gap-2 transition-transform group-hover:-translate-y-0.5">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center group-hover:border-amber-500/40 transition-colors">
                      <Icon size={26} className="text-amber-400" />
                    </div>
                    <span className="text-[12px] font-medium text-slate-300">{f.label}</span>
                  </div>
                  {i < HOME_FLOW.length - 1 && <ChevronRight size={20} className="text-slate-300 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
          <div className="text-center text-[13px] text-slate-400 mt-5">
            Four questions, a few minutes — <span className="text-amber-400 font-medium">start building →</span>
          </div>
        </button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-16 sm:pb-20">
        <h2 className="font-display text-4xl sm:text-5xl text-slate-900 text-center leading-none mb-3">Everything you need to size a reliable system</h2>
        <p className="text-slate-500 text-center text-[15px] mb-10 max-w-2xl mx-auto">Each recommendation shows the numbers behind it, so you can check the reasoning instead of trusting a black box.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOME_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-amber-500/40 hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center mb-4">
                  <Icon size={22} className="text-amber-400" />
                </div>
                <h3 className="text-[16px] font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-[13.5px] text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-16 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl text-slate-900 leading-none mb-5">Why {BRAND.name}?</h2>
            <p className="text-slate-500 text-[15.5px] leading-relaxed mb-7">
              Most calculators either oversimplify your setup or quietly oversize every component. This one uses transparent, real-world assumptions — derated solar, honest charger limits, and battery figures that account for how deep you can actually discharge.
            </p>
            <ul className="space-y-3">
              {[
                "Built around Australian touring conditions",
                "Real-world appliance draw, adjustable to your run hours",
                "Brand-neutral — the maths comes first",
                "Free to use, nothing to sign up for",
                "Works for 4WDs, campers and caravans",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14.5px] text-slate-700">
                  <CheckCircle2 size={17} className="text-teal-400 shrink-0 mt-0.5" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Sample result preview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-4">Example result</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Estimated daily use</div>
              <div className="font-mono text-4xl font-bold text-amber-400 leading-none">86<span className="text-lg text-slate-500 font-normal ml-1.5">Ah/day</span></div>
              <div className="text-[11.5px] text-slate-400 mt-1.5">50L fridge · lights · Starlink · phone charging</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { Icon: Battery, label: "Battery", value: "150Ah", tone: "text-amber-400" },
                { Icon: Sun, label: "Solar", value: "400W", tone: "text-teal-400" },
                { Icon: Zap, label: "DC-DC", value: "40A", tone: "text-amber-400" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <s.Icon size={18} className={`${s.tone} mx-auto mb-1.5`} />
                  <div className="text-[9.5px] uppercase tracking-wide text-slate-400 font-semibold">{s.label}</div>
                  <div className="font-mono text-[15px] text-slate-900">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="text-[11.5px] text-slate-400 mt-4 leading-snug">Illustrative only — your result depends on your gear, season and driving.</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-16 sm:pb-20 scroll-mt-24">
        <h2 className="font-display text-4xl sm:text-5xl text-slate-900 text-center leading-none mb-10">Build your system in three steps</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {HOME_STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-7 hover:border-amber-500/40 hover:-translate-y-1 transition-all">
              <div className="w-11 h-11 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center font-display text-2xl text-amber-400 mb-4">{s.n}</div>
              <h3 className="text-[17px] font-semibold text-slate-900 mb-2">{s.title}</h3>
              <p className="text-[14px] text-slate-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-16 sm:pb-20">
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.10] to-teal-500/[0.06] px-6 py-12 sm:py-16 text-center">
          <h2 className="font-display text-4xl sm:text-5xl text-slate-900 leading-none mb-4">Ready to build your 12V system?</h2>
          <p className="text-slate-700 text-[15.5px] mb-8 max-w-xl mx-auto">It takes a few minutes, it's free, and everything stays in your browser.</p>
          <button onClick={onStart} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-[16px] font-bold bg-amber-500 text-[#12181A] hover:bg-amber-400 active:scale-[0.99] transition-all">
            Start building <ArrowRight size={18} />
          </button>
          <div className="flex items-center justify-center gap-1.5 text-[11.5px] text-slate-400 mt-4">
            <Lock size={12} /> Secure. Private. Yours.
          </div>
        </div>
      </section>
    </>
  );
}

function WizardHeader({ step, onStep, itemCount, dailyAh, onHome }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-[72px] flex items-center justify-between gap-4">
        {/* Brand */}
        <button onClick={() => (onHome ? onHome() : onStep(1))} className="flex items-center gap-3 shrink-0 text-left">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-teal-500/20 border border-slate-700 flex items-center justify-center">
            <Zap size={20} className="text-amber-400" strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="font-display text-xl text-white">{BRAND.name}</div>
            <div className="text-[10px] tracking-[0.16em] uppercase text-teal-400/80 font-semibold">{BRAND.tagline}</div>
          </div>
        </button>

        {/* Steps */}
        <nav className="hidden md:flex items-center gap-2 flex-1 justify-center max-w-md">
          {WIZARD_STEPS.map((s, i) => {
            const done = step > s.n;
            const current = step === s.n;
            const reachable = s.n <= step;
            return (
              <React.Fragment key={s.n}>
                <button
                  onClick={() => reachable && onStep(s.n)}
                  disabled={!reachable}
                  className={`flex items-center gap-2 ${reachable ? "" : "opacity-50 pointer-events-none"}`}
                >
                  <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-[12px] font-semibold transition-colors ${
                    current ? "border-amber-500 bg-amber-500/15 text-amber-400"
                      : done ? "border-teal-500/50 bg-teal-500/15 text-teal-400"
                      : "border-slate-200 text-slate-400"
                  }`}>
                    {done ? <CheckCircle2 size={14} /> : s.n}
                  </span>
                  <span className={`text-[12.5px] font-medium ${current ? "text-amber-400" : done ? "text-slate-200" : "text-slate-400"}`}>{s.label}</span>
                </button>
                {i < WIZARD_STEPS.length - 1 && <div className="w-8 h-px bg-slate-700" />}
              </React.Fragment>
            );
          })}
        </nav>

        {/* My setup pill */}
        <button onClick={() => itemCount > 0 && onStep(3)} disabled={itemCount === 0}
          className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] px-3.5 py-2 hover:bg-amber-500/10 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0">
          <ListChecks size={16} className="text-amber-400" />
          <div className="text-left leading-tight hidden sm:block">
            <div className="text-[12px] font-semibold text-slate-900">My setup</div>
            <div className="text-[10.5px] text-slate-500 font-mono">{itemCount} item{itemCount === 1 ? "" : "s"} · {Math.round(dailyAh)} Ah/day</div>
          </div>
          <ChevronRight size={15} className="text-slate-400" />
        </button>
      </div>
      <div className="md:hidden h-1 bg-slate-800"><div className="h-full bg-amber-500 transition-all" style={{ width: `${(step / WIZARD_STEPS.length) * 100}%` }} /></div>
    </header>
  );
}

function CategoryTabs({ active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {CATEGORIES.map((c) => {
        const Icon = c.icon;
        const on = active === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
              on ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800"
            }`}
          >
            <Icon size={16} /> {c.label}
          </button>
        );
      })}
    </div>
  );
}

// A rich gear tile: icon plate + name + description + Ah/day, with an Add button that
// becomes a stepper once added. `viaInverter` tags 240V appliances that run off the inverter.
function GearTile({ item, count, ahLabel, onInc, onDec, viaInverter, hoursValue, onHours }) {
  const Icon = item.icon;
  const active = count > 0;
  const accent = viaInverter ? "red" : "amber";
  const plate = active
    ? (viaInverter ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")
    : "bg-slate-100 text-slate-500";
  const ring = active ? (viaInverter ? "border-red-500/40 bg-red-500/[0.06]" : "border-amber-500/40 bg-amber-500/[0.06]") : "border-slate-200 bg-white";
  const adjustable = active && !!item.defaultHours;
  const hrs = hoursValue ?? item.defaultHours ?? 0;
  const sliderStep = (item.maxHours ?? 12) <= 1 ? 0.05 : 0.5;
  const hrsLabel = hrs >= 1 ? `${Math.round(hrs * 10) / 10}h/day` : `${Math.round(hrs * 60)} min/day`;
  const accentClass = viaInverter ? "accent-red-500" : "accent-amber-500";
  return (
    <div className={`flex flex-col rounded-2xl border ${ring} p-4 transition-colors`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${plate}`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-slate-900 leading-tight">{item.label}</div>
          {item.desc && <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{item.desc}</div>}
        </div>
      </div>

      {adjustable && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10.5px] mb-1">
            <span className="uppercase tracking-wide text-slate-400 font-semibold">Runs</span>
            <span className="font-mono text-slate-700">{hrsLabel}</span>
          </div>
          <input
            type="range"
            min={0}
            max={item.maxHours ?? 12}
            step={sliderStep}
            value={hrs}
            onChange={(e) => onHours(parseFloat(e.target.value))}
            className={`w-full ${accentClass}`}
            aria-label={`${item.label} run time per day`}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="text-[11.5px] font-mono text-teal-400">{ahLabel}{viaInverter ? <span className="text-red-400/80"> · inverter</span> : null}</div>
        {active ? (
          <Stepper count={count} onDec={onDec} onInc={onInc} tone={accent} />
        ) : (
          <button onClick={onInc}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors ${
              viaInverter ? "border-slate-200 text-slate-700 hover:border-red-500/50 hover:text-red-400" : "border-slate-200 text-slate-700 hover:border-amber-500/50 hover:text-amber-400"
            }`}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// Featured fridge card — the biggest daily load, so it leads the catalog. Size options
// map to the four fridge entries in GEAR; selecting one clears the others.
function FridgeFeature({ options, activeKey, customFridge, freezerMode, onFreezerToggle, onSelect }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-4">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 shrink-0 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
          <Refrigerator size={30} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold text-slate-900">Fridge / Freezer</div>
          <div className="text-[12.5px] text-slate-500 mt-0.5">Almost always your biggest load — it runs 24/7. Pick the size closest to yours.</div>
          {customFridge ? (
            <div className="text-[12px] text-amber-400 mt-1.5 font-medium">Using your model: Custom fridge (~{customFridge.ah}Ah/day)</div>
          ) : (
            <div className="text-[12px] font-mono text-teal-400 mt-1.5">~15–60 Ah/day depending on size</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {options.map((o) => {
          const on = !customFridge && activeKey === o.key;
          return (
            <button
              key={o.key}
              onClick={() => onSelect(o.key)}
              className={`relative rounded-xl border p-3 text-left transition-colors ${
                on ? "border-amber-500/60 bg-amber-500/10" : "border-slate-200 bg-slate-50 hover:border-slate-400"
              }`}
            >
              {on && <CheckCircle2 size={15} className="absolute top-2 right-2 text-amber-400" />}
              <div className={`text-[13.5px] font-semibold ${on ? "text-amber-400" : "text-slate-800"}`}>{o.size}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{o.litres}</div>
              <div className="text-[11px] font-mono text-teal-400 mt-1.5">~{o.ah} Ah/day</div>
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2.5 mt-3.5 text-[12.5px] text-slate-700 cursor-pointer w-fit">
        <input type="checkbox" checked={freezerMode} onChange={onFreezerToggle} className="accent-amber-500 w-4 h-4" />
        Running it as a freezer <span className="text-slate-400">(+~35% draw)</span>
      </label>
    </div>
  );
}

// Right-hand live summary. Purely presentational — receives a prebuilt list of rows
// (each with its own stepper handlers) plus the headline guide figures.
function SummarySidebar({ step, itemCount, dailyAh, rows, batteryLabel, solarLabel, onContinue }) {
  return (
    <aside className="lg:sticky lg:top-[88px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Battery size={20} className="text-teal-400" />
          <div className="font-display text-xl text-slate-900">Your daily setup</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Estimated daily use</div>
          <div className="font-mono text-4xl font-bold text-amber-400 leading-none">
            {Math.round(dailyAh)}<span className="text-lg text-slate-500 font-normal ml-1.5">Ah/day</span>
          </div>
          <div className="text-[11.5px] text-slate-400 mt-1.5">Based on your selected gear</div>
        </div>

        <div className="space-y-1 mb-4 max-h-[280px] overflow-y-auto -mr-1 pr-1">
          {rows.length === 0 && (
            <div className="text-[13px] text-slate-400 text-center py-6">Add gear to start building your setup.</div>
          )}
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.id} className="flex items-center gap-2.5 py-1.5">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <Icon size={15} className="text-slate-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-slate-800 truncate">{r.label}</div>
                  <div className="text-[10.5px] font-mono text-teal-400">{r.ahLabel}</div>
                </div>
                <Stepper count={r.qty} onDec={r.onDec} onInc={r.onInc} tone={r.tone} />
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <Battery size={18} className="text-amber-400 shrink-0" />
            <div className="leading-tight">
              <div className="text-[9.5px] uppercase tracking-wide text-slate-400 font-semibold">Battery (guide)</div>
              <div className="text-[13.5px] font-mono text-slate-900">{batteryLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sun size={18} className="text-teal-400 shrink-0" />
            <div className="leading-tight">
              <div className="text-[9.5px] uppercase tracking-wide text-slate-400 font-semibold">Solar (guide)</div>
              <div className="text-[13.5px] font-mono text-slate-900">{solarLabel}</div>
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          disabled={itemCount === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold bg-amber-500 text-[#12181A] hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99] transition-all"
        >
          {step === 1 ? "Continue to usage" : "See your system"} <ArrowRight size={18} />
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-3">
          <Lock size={11} /> Secure. Private. Yours.
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [qty, setQty] = useState({ lights: 1, phoneCharging: 2 });
  const [hours, setHours] = useState({}); // per-item hours-per-day override, key -> number
  const [customAppliances, setCustomAppliances] = useState([]); // [{ id, label, ah, qty }]
  const [showAddAppliance, setShowAddAppliance] = useState(false);
  const [newApplianceLabel, setNewApplianceLabel] = useState("");
  const [newApplianceAh, setNewApplianceAh] = useState("");
  const [newApplianceWatts, setNewApplianceWatts] = useState("");
  const [newApplianceIs230V, setNewApplianceIs230V] = useState(false);
  const [invQty, setInvQty] = useState({});
  const [invHours, setInvHours] = useState({}); // per-inverter-item hours-per-day override
  const [runInverterSimultaneously, setRunInverterSimultaneously] = useState(false);
  const [solarMount, setSolarMount] = useState("portable"); // portable is the common 4WD case
  const [chargerSetup, setChargerSetup] = useState("combined"); // "combined" | "separate" — combined (dual-input DC-DC / all-in-one boxes) is the common 4WD case
  const [customFridge, setCustomFridge] = useState(null); // { brand, model, ah, note, confirmed } | null
  const [customFridgeQty, setCustomFridgeQty] = useState(1);
  const [freezerMode, setFreezerMode] = useState(false);
  const [chemistry, setChemistry] = useState("LiFePO4");
  const [autonomyDays, setAutonomyDays] = useState(1.5);
  const [season, setSeason] = useState("spring");
  const [regulator, setRegulator] = useState("MPPT");
  const [shade, setShade] = useState("clear");
  const [alternator, setAlternator] = useState("unsure");
  const [hoursDriven, setHoursDriven] = useState(2);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [contentPage, setContentPage] = useState(null);
  const [view, setView] = useState("home");     // "home" = landing page, "build" = the wizard
  const [step, setStep] = useState(1);          // 1 = Gear, 2 = Usage, 3 = Your system
  const [activeCat, setActiveCat] = useState("essential");
  const [showDetails, setShowDetails] = useState(false);

  const MAX_ITEM_QTY = 12;
  const setItemQty = (key, delta) => {
    if (delta > 0 && FRIDGE_KEYS.includes(key) && customFridge) {
      setCustomFridge(null);
      setCustomFridgeQty(1);
    }
    setQty((q) => {
      const next = Math.min(MAX_ITEM_QTY, Math.max(0, (q[key] || 0) + delta));
      return { ...q, [key]: next };
    });
  };
  const setInvItemQty = (key, delta) => {
    setInvQty((q) => {
      const next = Math.min(MAX_ITEM_QTY, Math.max(0, (q[key] || 0) + delta));
      return { ...q, [key]: next };
    });
  };
  const setItemHours = (key, value) => setHours((h) => ({ ...h, [key]: value }));
  const setInvItemHours = (key, value) => setInvHours((h) => ({ ...h, [key]: value }));


  const addCustomAppliance = () => {
    const ah = parseFloat(newApplianceAh);
    if (!newApplianceLabel.trim() || !ah || ah <= 0) return;
    const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const watts = parseFloat(newApplianceWatts);
    setCustomAppliances((list) => [...list, {
      id, label: newApplianceLabel.trim(), ah, qty: 1,
      watts: Number.isFinite(watts) && watts > 0 ? watts : null,
      is230V: newApplianceIs230V,
    }]);
    setNewApplianceLabel("");
    setNewApplianceAh("");
    setNewApplianceWatts("");
    setNewApplianceIs230V(false);
    setShowAddAppliance(false);
  };
  const setCustomApplianceQty = (id, delta) => {
    setCustomAppliances((list) => list.map((a) => a.id === id ? { ...a, qty: Math.min(MAX_ITEM_QTY, Math.max(0, a.qty + delta)) } : a).filter((a) => a.qty > 0));
  };
  const removeCustomAppliance = (id) => setCustomAppliances((list) => list.filter((a) => a.id !== id));

  const gearAh = useMemo(
    () => GEAR.reduce((sum, g) => {
      const mult = (freezerMode && FRIDGE_KEYS.includes(g.key)) ? FREEZER_MODE_MULTIPLIER : 1;
      return sum + scaledItemAh(g, qty[g.key] || 0, hours[g.key], mult);
    }, 0),
    [qty, freezerMode, hours]
  );
  const customFridgeAh = useMemo(() => {
    if (!customFridge || !customFridge.ah) return 0;
    const mult = freezerMode ? FREEZER_MODE_MULTIPLIER : 1;
    return customFridge.ah * mult * customFridgeQty;
  }, [customFridge, customFridgeQty, freezerMode]);
  const inverterAh = useMemo(
    () => INVERTER_APPLIANCES.reduce((sum, a) => sum + inverterApplianceAh(a, invQty[a.key] || 0, invHours[a.key]), 0),
    [invQty, invHours]
  );
  const customAppliancesAh = useMemo(
    () => customAppliances.reduce((sum, a) => sum + a.ah * a.qty, 0),
    [customAppliances]
  );
  const dailyAh = gearAh + customFridgeAh + inverterAh + customAppliancesAh;
  const dailyWh = dailyAh * 12;

  // Daily Ah/Wh total is a sum of everything used across the day — that's correct
  // regardless of whether appliances run at the same time or not (a hairdryer for
  // 5 min this morning and a coffee machine for 2 min this evening both add to your
  // daily energy use even though they never overlap).
  //
  // Inverter/current SIZING is different: most people don't run an induction cooktop
  // and a hair dryer at once, so summing every selected appliance's peak draw wildly
  // oversizes the inverter. Default to the single most demanding selected appliance
  // (at the quantity set for it) — realistic for how these are actually used — with
  // an opt-in toggle for genuine simultaneous-use cases (families, shared camps).
  const inverterLoads = useMemo(() => {
    const presetLoads = INVERTER_APPLIANCES.map((a) => ({ ...a, qty: invQty[a.key] || 0 })).filter((a) => a.qty > 0);
    const customLoads = customAppliances.filter((a) => a.is230V && a.watts && a.qty > 0).map((a) => ({
      key: a.id, label: a.label, watts: a.watts,
      peakA: a.watts / (SYSTEM_VOLTAGE * INVERTER_EFFICIENCY), qty: a.qty, custom: true,
    }));
    return [...presetLoads, ...customLoads];
  }, [invQty, customAppliances]);

  const mostDemandingInverterAppliance = useMemo(
    () => inverterLoads.reduce((best, a) => (!best || a.watts > best.watts ? a : best), null),
    [inverterLoads]
  );
  const peakInverterASum = useMemo(() => inverterLoads.reduce((sum, a) => sum + a.peakA * a.qty, 0), [inverterLoads]);
  const peakInverterWSum = useMemo(() => inverterLoads.reduce((sum, a) => sum + a.watts * a.qty, 0), [inverterLoads]);
  const peakInverterA = runInverterSimultaneously ? peakInverterASum : (mostDemandingInverterAppliance?.peakA ?? 0);
  const peakInverterW = runInverterSimultaneously ? peakInverterWSum : (mostDemandingInverterAppliance?.watts ?? 0);

  const recInverterW = useMemo(() => {
    const withHeadroom = peakInverterW * 1.25;
    return COMMON_INVERTER_SIZES.find((s) => s >= withHeadroom) ?? COMMON_INVERTER_SIZES[COMMON_INVERTER_SIZES.length - 1];
  }, [peakInverterW]);
  const inverterExceedsRange = peakInverterW * 1.25 > COMMON_INVERTER_SIZES[COMMON_INVERTER_SIZES.length - 1];
  const anyInverterSelected = inverterLoads.length > 0;

  // Many single 100-120Ah 12V LiFePO4 batteries are capped around 100-150A continuous
  // discharge by their internal bus bar and BMS FET rating — NOT a simple multiple of
  // capacity the way charge current roughly is. A "150Ah" battery doesn't automatically
  // discharge faster than a 100Ah one from the same range; budget/mid-tier units in
  // particular often cap out well below what a naive C-rate estimate would suggest.
  // Tiered against common BMS ratings rather than one flat threshold, so the guidance
  // is a genuine "what to check for," not a pass/fail verdict on a number we can't verify.
  const exceedsTypicalBatteryDischarge = peakInverterA > 100;
  const dischargeCompat = batteryDischargeCompatibility(peakInverterA);

  const chem = CHEMISTRY[chemistry];
  // Battery Ah is an energy-capacity calculation. Inverter compatibility is reported
  // separately because a battery's BMS current limit cannot be inferred from its Ah rating.
  const energyBatteryAh = (dailyAh * autonomyDays) / chem.dod;
  const batterySizedForDischarge = false;
  const recBatteryAh = energyBatteryAh;
  const peakSunHours = SEASONS[season].hours;
  const recSolarW = (dailyWh / (peakSunHours * REGULATOR[regulator].eff)) * SHADE_LEVELS[shade].mult;

  const batterySnap = COMMON_BATTERY_SIZES.find((s) => s >= recBatteryAh);
  const batteryExceedsRange = batterySnap == null;
  const batteryRounded = batterySnap ?? COMMON_BATTERY_SIZES[COMMON_BATTERY_SIZES.length - 1];
  const recommendedBatteryAh = batteryExceedsRange ? recBatteryAh : batteryRounded;

  const batteryChargeCeilingA = recommendedBatteryAh * chem.cRate;
  const fullRecoveryRequiredA = hoursDriven > 0 ? dailyAh / hoursDriven : 0;
  const desiredChargerA = hoursDriven > 0 ? fullRecoveryRequiredA : Math.min(20, batteryChargeCeilingA);
  const recChargerA = Math.min(desiredChargerA, batteryChargeCeilingA);

  // Hybrid discharge advisory. The battery size above stays purely energy-based — we do NOT
  // silently inflate it from a current figure. But when a high-current inverter load implies a
  // bigger bank than daily energy alone, we surface a *recommended minimum* Ah as guidance, using
  // the rough chem.dischargeC heuristic (lead-acid especially needs headroom; lithium is really
  // BMS-limited, which the compatibility note also spells out). Only meaningful when it exceeds
  // the energy-based pick, so users with modest loads don't get an unnecessary upsell.
  // The battery has to feed whatever the INSTALLED inverter can pull, not just today's
  // appliance list — a 2000W inverter can demand ~190A at 12V even if the current load is less.
  // That current is what the BMS must sustain continuously, so it drives the minimum bank size.
  const inverterRatedA = anyInverterSelected ? recInverterW / (SYSTEM_VOLTAGE * INVERTER_EFFICIENCY) : 0;
  const requiredBmsA = Math.round(Math.max(peakInverterA, inverterRatedA));
  const dischargeMinBatteryAh = requiredBmsA > 0 ? requiredBmsA / chem.dischargeC : 0;
  const dischargeMinSnap = COMMON_BATTERY_SIZES.find((s) => s >= dischargeMinBatteryAh);
  const recMinAhForPeak = dischargeMinSnap ?? COMMON_BATTERY_SIZES[COMMON_BATTERY_SIZES.length - 1];
  const peakWantsBiggerBattery = requiredBmsA > 0 && recMinAhForPeak > (batteryExceedsRange ? recBatteryAh : batteryRounded);

  const solarSingle = COMMON_SOLAR_SIZES.find((s) => s >= recSolarW);
  const solarPanelCount = solarSingle ? 1 : Math.ceil(recSolarW / 200);
  const solarPanelSize = solarSingle ?? 200;
  const solarLabel = solarPanelCount > 1 ? `${solarPanelCount} × ${solarPanelSize}W` : `${solarPanelSize}W`;
  const solarBrandKey = solarPanelSize;
  const solarActualW = solarPanelCount * solarPanelSize; // the real installed size, not the raw calculated one

  const chargerTopTier = CHARGER_TIERS[CHARGER_TIERS.length - 1];
  const chargerFound = CHARGER_TIERS.find((t) => t.sizeA >= recChargerA);
  const chargerTier = chargerFound ?? chargerTopTier;
  // True when demand is above what a common single ~50A unit delivers.
  const chargerAtSingleUnitCeiling = chargerFound == null;
  const chargerRounded = chargerTier.sizeA;
  const chargerLabel = `${chargerRounded}A`;

  // Honest energy balance: uses the ACTUALLY RECOMMENDED (rounded, real-product) solar
  // and charger sizes, not a formula that's algebraically guaranteed to always match
  // daily use exactly. This can genuinely come out short, e.g. if a large panel array
  // rounds down to a smaller common size, or shade/season conditions bite hard.
  const actualSolarWhUncapped = (solarActualW * peakSunHours * REGULATOR[regulator].eff) / SHADE_LEVELS[shade].mult;
  // Combined DC-DC + solar units do not
  // add their solar and alternator inputs together — both share ONE total output rating
  // to the battery. A "25A" combined unit can't deliver more than 25A total, whether
  // that's all solar, all driving, or a mix. This caps what the solar stage can actually
  // push through THIS charger, separately from what the panels could produce on their own.
  const chargeVoltage = chemistry === "LiFePO4" ? 12.8 : 12;
  const mount = SOLAR_MOUNT[solarMount];

  // Split the daylight window: sun hours that elapse while you're driving vs parked.
  // Portable panels are packed on the road, so they only harvest the parked share.
  const sunHoursDriving = Math.min(hoursDriven, peakSunHours);
  const sunHoursParked = Math.max(0, peakSunHours - sunHoursDriving);
  const arrayRateWh = peakSunHours > 0 ? actualSolarWhUncapped / peakSunHours : 0; // whole array, per sun hour
  const fixedRateWh = arrayRateWh * mount.fixedShare;

  // A combined unit shares one output rating; a separate MPPT is independent of the DC-DC.
  const solarCeilingWh = chargerSetup === "combined" ? chargerRounded * chargeVoltage : Infinity;
  const dcRateWh = chargerRounded * chargeVoltage; // DC-DC rating is battery-side output

  // Parked daylight: the whole array works (fixed + deployed portable).
  const parkedSolarWh = Math.min(arrayRateWh, solarCeilingWh) * sunHoursParked;
  // While driving: only fixed panels produce. On a COMBINED unit the alternator simply fills
  // whatever headroom solar leaves, so the pair still delivers the unit's full rating — that
  // energy is counted in the drive figure below, not added again here.
  const drivingSolarWh = chargerSetup === "combined" ? 0 : Math.min(fixedRateWh, solarCeilingWh) * sunHoursDriving;

  const actualSolarWh = parkedSolarWh + drivingSolarWh;
  const solarWasCapped = chargerSetup === "combined" && arrayRateWh > solarCeilingWh + 1;
  // The alternator delivers the charger's rated output for the whole drive, regardless of sun.
  const actualDriveWh = dcRateWh * hoursDriven * DCDC_DELIVERY_FACTOR;

  const solarShortfallAh = Math.max(0, dailyAh - actualSolarWhUncapped / chargeVoltage);
  const solarSupportRequiredA = hoursDriven > 0 ? solarShortfallAh / hoursDriven : 20;
  const solarSupportTier = CHARGER_TIERS.find((t) => t.sizeA >= Math.max(20, solarSupportRequiredA)) ?? chargerTopTier;
  const solarSupportRounded = solarSupportTier.sizeA;

  const simDriveWh = actualDriveWh;
  const fullRecoveryAh = actualDriveWh / chargeVoltage;
  const chargingWh = actualSolarWh + actualDriveWh;
  const balanceWh = chargingWh - dailyWh;
  const recoveryRatio = dailyWh > 0 ? chargingWh / dailyWh : 0;
  const status = recoveryRatio >= 1.1 ? "balanced" : recoveryRatio >= 0.85 ? "tight" : "shortfall";
  const actualBatteryRuntimeDays = dailyAh > 0
    ? ((batteryExceedsRange ? recBatteryAh : batteryRounded) * chem.dod) / dailyAh
    : 0;

  /* ── Wizard view helpers ──────────────────────────────────────────────── */
  const itemCount =
    Object.values(qty).reduce((a, b) => a + (b || 0), 0) +
    Object.values(invQty).reduce((a, b) => a + (b || 0), 0) +
    customAppliances.reduce((a, x) => a + x.qty, 0) +
    (customFridge ? customFridgeQty : 0);

  // Featured fridge card options, parsed from the four fridge GEAR entries.
  const fridgeOptions = FRIDGE_KEYS.map((k) => GEAR.find((g) => g.key === k)).map((g) => {
    const m = g.label.match(/Fridge — (.+?) \((.+?)\)/);
    return { key: g.key, size: m ? m[1] : g.label, litres: m ? m[2] : "", ah: g.ah };
  });
  const activeFridgeKey = FRIDGE_KEYS.find((k) => (qty[k] || 0) > 0);

  // Rows for the live summary sidebar, each with its own stepper handlers.
  const summaryRows = [];
  if (customFridge && customFridgeQty > 0) {
    summaryRows.push({
      id: "custom-fridge", label: `Custom fridge`, icon: Refrigerator, tone: "amber",
      ahLabel: `${customFridgeAh.toFixed(0)} Ah/day`, qty: customFridgeQty,
      onDec: () => setCustomFridgeQty((q) => { const n = Math.max(0, q - 1); if (n === 0) setCustomFridge(null); return n; }),
      onInc: () => setCustomFridgeQty((q) => Math.min(MAX_ITEM_QTY, q + 1)),
    });
  }
  GEAR.forEach((g) => {
    const c = qty[g.key] || 0;
    if (c <= 0) return;
    const mult = (freezerMode && FRIDGE_KEYS.includes(g.key)) ? FREEZER_MODE_MULTIPLIER : 1;
    summaryRows.push({
      id: g.key, label: g.label.replace(/^Fridge — /, "Fridge · "), icon: g.icon, tone: "amber",
      ahLabel: `${scaledItemAh(g, c, hours[g.key], mult).toFixed(0)} Ah/day`, qty: c,
      onDec: () => setItemQty(g.key, -1), onInc: () => setItemQty(g.key, 1),
    });
  });
  INVERTER_APPLIANCES.forEach((a) => {
    const c = invQty[a.key] || 0;
    if (c <= 0) return;
    summaryRows.push({
      id: a.key, label: a.label, icon: a.icon, tone: "red",
      ahLabel: `${inverterApplianceAh(a, c, invHours[a.key]).toFixed(0)} Ah/day`, qty: c,
      onDec: () => setInvItemQty(a.key, -1), onInc: () => setInvItemQty(a.key, 1),
    });
  });
  customAppliances.forEach((a) => {
    summaryRows.push({
      id: a.id, label: a.label, icon: Plus, tone: a.is230V ? "red" : "amber",
      ahLabel: `${(a.ah * a.qty).toFixed(0)} Ah/day`, qty: a.qty,
      onDec: () => setCustomApplianceQty(a.id, -1), onInc: () => setCustomApplianceQty(a.id, 1),
    });
  });

  const sidebarBatteryLabel = dailyAh === 0 ? "—" : batteryExceedsRange ? `~${Math.ceil(recBatteryAh)}+ Ah` : `~${batteryRounded} Ah`;
  const sidebarSolarLabel = dailyAh === 0 ? "—" : `~${solarActualW} W`;

  // Items shown in the current gear tab (fridge sizes live in the featured card, so excluded).
  const tabItems = [
    ...GEAR.filter((g) => !FRIDGE_KEYS.includes(g.key)).map((g) => ({ ...g, viaInverter: false })),
    ...INVERTER_APPLIANCES.map((a) => ({ ...a, viaInverter: true })),
  ].filter((it) => (activeCat === "essential" ? it.essential : it.cat === activeCat));

  return (
    <div className="min-h-screen bg-[#F5F7F6] text-slate-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Big Shoulders Display', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        .bg-terrain {
          background-color: #F5F7F6;
          background-image: radial-gradient(ellipse 900px 500px at 15% -10%, rgba(231,163,62,0.10), transparent 60%),
                             radial-gradient(ellipse 700px 500px at 110% 10%, rgba(79,166,156,0.10), transparent 60%);
        }
        select, input { color-scheme: light; }
      `}</style>

      <div className="bg-terrain min-h-screen">
        {contentPage ? (
          <>
            <div className="px-4 sm:px-8 py-8 sm:py-12">
              <div className="max-w-3xl mx-auto">
                <ContentPage pageKey={contentPage} onBack={() => setContentPage(null)} onNavigate={setContentPage} />
              </div>
            </div>
            <SiteFooter onNavigate={setContentPage} />
          </>
        ) : showDisclaimer ? (
          <>
            <div className="px-4 sm:px-8 py-8 sm:py-12">
              <div className="max-w-3xl mx-auto">
                <Disclaimer onBack={() => setShowDisclaimer(false)} />
              </div>
            </div>
            <SiteFooter onNavigate={setContentPage} />
          </>
        ) : view === "home" ? (
          <>
            <HomePage onStart={() => { setView("build"); setStep(1); }} onNavigate={setContentPage} />
            <SiteFooter onNavigate={setContentPage} />
          </>
        ) : (
          <>
            <WizardHeader step={step} onStep={setStep} itemCount={itemCount} dailyAh={dailyAh} onHome={() => setView("home")} />

            {step === 3 ? (
              <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
                <Dashboard
                  onBack={() => setStep(1)}
                  onShowDisclaimer={() => setShowDisclaimer(true)}
                  status={status} dailyAh={dailyAh} dailyWh={dailyWh}
                  batteryRounded={batteryRounded} batteryExceedsRange={batteryExceedsRange} recBatteryAh={recBatteryAh} batterySizedForDischarge={batterySizedForDischarge}
                  chem={chem} chemistry={chemistry} autonomyDays={autonomyDays}
                  solarLabel={solarLabel} solarBrandKey={solarBrandKey} peakSunHours={peakSunHours}
                  season={season} regulator={regulator} shade={shade}
                  chargerRounded={chargerRounded} chargerLabel={chargerLabel} chargerAtSingleUnitCeiling={chargerAtSingleUnitCeiling} recChargerA={recChargerA} chargerTier={chargerTier}
                  solarSupportRounded={solarSupportRounded} fullRecoveryAh={fullRecoveryAh} actualBatteryRuntimeDays={actualBatteryRuntimeDays}
                  anyInverterSelected={anyInverterSelected} recInverterW={recInverterW} inverterExceedsRange={inverterExceedsRange}
                  peakInverterW={peakInverterW} peakInverterA={peakInverterA} exceedsTypicalBatteryDischarge={exceedsTypicalBatteryDischarge}
                  dischargeCompat={dischargeCompat}
                  recMinAhForPeak={recMinAhForPeak} peakWantsBiggerBattery={peakWantsBiggerBattery} requiredBmsA={requiredBmsA} inverterRatedA={inverterRatedA}
                  runInverterSimultaneously={runInverterSimultaneously}
                  actualSolarWh={actualSolarWh} actualDriveWh={actualDriveWh} simDriveWh={simDriveWh} solarActualW={solarActualW}
                  chargerSetup={chargerSetup} solarWasCapped={solarWasCapped} solarMount={solarMount}
                  alternator={alternator} hoursDriven={hoursDriven}
                  qty={qty} invQty={invQty} customFridge={customFridge} customFridgeQty={customFridgeQty} freezerMode={freezerMode}
                  hours={hours} invHours={invHours}
                  customAppliances={customAppliances} customAppliancesAh={customAppliancesAh}
                  gearAh={gearAh} customFridgeAh={customFridgeAh} inverterAh={inverterAh}
                />
              </div>
            ) : (
              <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
                <div className="min-w-0">
                  {step === 1 ? (
                    <>
                      <h1 className="font-display text-4xl sm:text-5xl text-slate-900 leading-[0.95] mb-2">What are you powering?</h1>
                      <p className="text-slate-500 text-[14.5px] mb-6 max-w-lg">Add the gear you plan to run on your trip. We'll work out how much power you need each day.</p>

                      <CategoryTabs active={activeCat} onChange={setActiveCat} />

                      {activeCat === "essential" && (
                        <FridgeFeature
                          options={fridgeOptions}
                          activeKey={activeFridgeKey}
                          customFridge={customFridge}
                          freezerMode={freezerMode}
                          onFreezerToggle={(e) => setFreezerMode(e.target.checked)}
                          onSelect={(key) => { setCustomFridge(null); setCustomFridgeQty(1); setQty((c) => ({ ...c, fridgeSmall: 0, fridgeMedium: 0, fridgeLarge: 0, fridgeXL: 0, [key]: 1 })); }}
                        />
                      )}

                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {tabItems.map((it) => {
                          const count = it.viaInverter ? (invQty[it.key] || 0) : (qty[it.key] || 0);
                          const hoursValue = it.viaInverter ? (invHours[it.key] ?? it.defaultHours) : (hours[it.key] ?? it.defaultHours);
                          const displayAh = it.viaInverter
                            ? inverterApplianceAh(it, Math.max(count, 1), invHours[it.key])
                            : scaledItemAh(it, Math.max(count, 1), hours[it.key], 1);
                          return (
                            <GearTile
                              key={it.key}
                              item={it}
                              count={count}
                              viaInverter={it.viaInverter}
                              hoursValue={hoursValue}
                              onHours={(v) => (it.viaInverter ? setInvItemHours(it.key, v) : setItemHours(it.key, v))}
                              ahLabel={`~${Math.round(displayAh)} Ah/day`}
                              onInc={() => (it.viaInverter ? setInvItemQty(it.key, 1) : setItemQty(it.key, 1))}
                              onDec={() => (it.viaInverter ? setInvItemQty(it.key, -1) : setItemQty(it.key, -1))}
                            />
                          );
                        })}
                        {tabItems.length === 0 && (
                          <div className="col-span-full text-[13px] text-slate-400 py-8 text-center">Nothing in this category yet.</div>
                        )}
                      </div>

                      <div className="mt-4">
                        {showAddAppliance ? (
                          <div className="rounded-2xl border border-amber-500/40 bg-white p-4">
                            <div className="grid sm:grid-cols-[1fr_120px_120px] gap-2 mb-2">
                              <input
                                value={newApplianceLabel}
                                onChange={(e) => setNewApplianceLabel(e.target.value)}
                                placeholder="What is it? e.g. 12V kettle, heated jacket, hair straightener"
                                autoFocus
                                style={{ backgroundColor: "#FFFFFF", color: "#0F172A" }}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                              />
                              <input
                                value={newApplianceAh}
                                onChange={(e) => setNewApplianceAh(e.target.value)}
                                type="number" min={0} step={0.5}
                                placeholder="Ah/day"
                                style={{ backgroundColor: "#FFFFFF", color: "#0F172A" }}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                              />
                              <input
                                value={newApplianceWatts}
                                onChange={(e) => setNewApplianceWatts(e.target.value)}
                                type="number" min={0} step={1}
                                placeholder="Watts"
                                style={{ backgroundColor: "#FFFFFF", color: "#0F172A" }}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                              />
                            </div>
                            <label className="flex items-center gap-2 text-[12px] text-slate-700 mb-2.5 cursor-pointer">
                              <input type="checkbox" checked={newApplianceIs230V}
                                onChange={(e) => setNewApplianceIs230V(e.target.checked)} className="accent-red-500 w-4 h-4" />
                              Runs from 230/240V through an inverter
                            </label>
                            <div className="text-[11px] text-slate-500 mb-2.5">Work out Ah/day: 12V direct = watts × hours ÷ 12. Through an inverter = watts × hours ÷ 12 ÷ 0.88.</div>
                            <div className="flex items-center gap-2">
                              <button onClick={addCustomAppliance} className="px-3.5 py-2 rounded-lg text-[13px] font-semibold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">Add it</button>
                              <button onClick={() => { setShowAddAppliance(false); setNewApplianceLabel(""); setNewApplianceAh(""); setNewApplianceWatts(""); setNewApplianceIs230V(false); }} className="px-3.5 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowAddAppliance(true)}
                            className="flex items-center gap-2 w-full justify-center rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-[13.5px] font-medium text-slate-700 hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-500/5 transition-colors"
                          >
                            <Plus size={16} /> Can't see your gear? <span className="text-teal-400">Add a custom item</span>
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <h1 className="font-display text-4xl sm:text-5xl text-slate-900 leading-[0.95] mb-2">How will you use it?</h1>
                      <p className="text-slate-500 text-[14.5px] mb-6 max-w-lg">A few details about your trip so we can fine-tune the battery, solar and charger. Sensible defaults are already set — change anything that doesn't fit.</p>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Days without a charge</div>
                          <div className="flex items-center gap-3">
                            <input type="range" min={0.5} max={4} step={0.5} value={autonomyDays} onChange={(e) => setAutonomyDays(parseFloat(e.target.value))} className="flex-1 accent-amber-500" />
                            <span className="font-mono text-lg text-amber-400 w-14 text-right">{autonomyDays}d</span>
                          </div>
                          <div className="text-[11.5px] text-slate-400 mt-2 leading-snug">How long you might sit with no solar and no driving. Sets the battery's safety buffer.</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Hours driven on a driving day</div>
                            <span className="font-mono text-lg text-amber-400">{hoursDriven}h</span>
                          </div>
                          <input
                            type="range" min={0} max={8} step={0.5} value={hoursDriven}
                            onChange={(e) => setHoursDriven(parseFloat(e.target.value))}
                            className="w-full accent-amber-500"
                            aria-label="Hours driven on a driving day"
                          />
                          <div className="flex justify-between text-[10.5px] text-slate-400 mt-1 mb-3"><span>Parked</span><span>4h</span><span>8h</span></div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[0, 1, 2, 4].map((h) => (
                              <button key={h} onClick={() => setHoursDriven(h)} className={`rounded-lg border px-2 py-1.5 text-[11.5px] font-medium transition-colors ${hoursDriven === h ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                                {h === 0 ? "0h" : `${h}h`}
                              </button>
                            ))}
                          </div>
                          <div className="text-[11.5px] text-slate-400 mt-2 leading-snug">Used for charger sizing and as the starting value for each driving day in the trip simulator.</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Battery type</div>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(CHEMISTRY).map(([k, v]) => (
                              <button key={k} onClick={() => setChemistry(k)} className={`rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-colors ${chemistry === k ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>{v.label}</button>
                            ))}
                          </div>
                          <div className="text-[11.5px] text-slate-400 mt-2 leading-snug">Lithium runs deeper and takes higher charge current; AGM is cheaper but needs a bigger bank.</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Season / sun</div>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(SEASONS).map(([k, v]) => (
                              <button key={k} onClick={() => setSeason(k)} className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition-colors ${season === k ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>
                                <span className="text-lg leading-none">{v.emoji}</span>
                                <span className="text-[10.5px] font-medium text-center leading-tight">{v.label}</span>
                                <span className="text-[10px] font-mono text-slate-400">{v.hours}h</span>
                              </button>
                            ))}
                          </div>
                          <div className="text-[11.5px] text-slate-400 mt-2 leading-snug">Peak-sun hours drive how much your panels actually harvest.</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Solar regulator</div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            {Object.entries(REGULATOR).map(([k, v]) => (
                              <button key={k} onClick={() => setRegulator(k)} className={`rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${regulator === k ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>{v.label}</button>
                            ))}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug">{REGULATOR[regulator].note}</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Camp shade</div>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {Object.entries(SHADE_LEVELS).map(([k, v]) => (
                              <button key={k} onClick={() => setShade(k)} className={`rounded-lg border px-2 py-2 text-[11.5px] font-medium transition-colors ${shade === k ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>{v.label}</button>
                            ))}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug">{SHADE_LEVELS[shade].hint}</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Smart alternator?</div>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {Object.entries(ALTERNATOR_TYPES).map(([k, v]) => (
                              <button key={k} onClick={() => setAlternator(k)} className={`rounded-lg border px-2 py-2 text-[11.5px] font-medium transition-colors ${alternator === k ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>{v.label}</button>
                            ))}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug">{ALTERNATOR_TYPES[alternator].note}</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Solar setup</div>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {Object.entries(SOLAR_MOUNT).map(([k, v]) => (
                              <button key={k} onClick={() => setSolarMount(k)} className={`rounded-lg border px-2 py-2 text-[11.5px] font-medium transition-colors ${solarMount === k ? "border-amber-500 bg-amber-500/10 text-amber-700" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>{v.short}</button>
                            ))}
                          </div>
                          <div className="text-[11px] text-slate-500 leading-snug">{SOLAR_MOUNT[solarMount].note}</div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Solar &amp; DC-DC wiring</div>
                          <div className="flex flex-col gap-2 mb-2">
                            <button onClick={() => setChargerSetup("combined")} className={`rounded-lg border px-3 py-2 text-[12.5px] font-medium text-left transition-colors ${chargerSetup === "combined" ? "border-teal-600 bg-teal-500/10 text-teal-700" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>Combined — one unit does DC-DC + solar</button>
                            <button onClick={() => setChargerSetup("separate")} className={`rounded-lg border px-3 py-2 text-[12.5px] font-medium text-left transition-colors ${chargerSetup === "separate" ? "border-teal-600 bg-teal-500/10 text-teal-700" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>Separate — standalone MPPT + independent DC-DC</button>
                          </div>
                          <div className="text-[11px] text-slate-500 leading-snug">{chargerSetup === "combined" ? "Most common — dual-input DC-DC chargers and all-in-one battery boxes have the solar regulator built in, so both inputs share ONE total output." : "Solar and driving charge independently, so their outputs add together. More typical of caravans and larger custom builds."}</div>
                        </div>

                        {anyInverterSelected && (
                          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-5 sm:col-span-2">
                            <div className="text-[11px] uppercase tracking-wide text-red-400 font-semibold mb-3">Inverter appliances</div>
                            <label className="flex items-center gap-2.5 text-[13px] text-slate-800 cursor-pointer">
                              <input type="checkbox" checked={runInverterSimultaneously} onChange={(e) => setRunInverterSimultaneously(e.target.checked)} className="accent-red-500 w-4 h-4 shrink-0" />
                              I'd realistically run more than one high-draw appliance at the same time
                            </label>
                            <div className="text-[11.5px] text-slate-400 mt-2 leading-snug">Off, we size the inverter to your single biggest appliance. Tick it and we size for everything running at once.</div>
                          </div>
                        )}
                      </div>

                      <button onClick={() => setStep(1)} className="mt-5 text-[13px] font-medium text-slate-500 hover:text-amber-400 transition-colors">← Back to gear</button>
                    </>
                  )}
                </div>

                <SummarySidebar
                  step={step}
                  itemCount={itemCount}
                  dailyAh={dailyAh}
                  rows={summaryRows}
                  batteryLabel={sidebarBatteryLabel}
                  solarLabel={sidebarSolarLabel}
                  onContinue={() => setStep(step + 1)}
                />
              </div>
            )}
            <SiteFooter onNavigate={setContentPage} />
          </>
        )}
      </div>
    </div>
  );
}
