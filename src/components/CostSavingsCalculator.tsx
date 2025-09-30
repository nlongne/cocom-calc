"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Calculator } from "lucide-react";
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from "recharts";

// ---- Brand tokens ----
const LOGO_SRC = "/cocom-logo.png";  // place your logo file in /public with this exact name (or change this path)
const BRAND = {
  blue: "#1C3256",
  blueLight: "#2a497b",
  blueTint: "#e6ecf5",
};

// ---------- Helpers ----------
const currency = (n:number) => n.toLocaleString(undefined,{ style:"currency", currency:"USD", maximumFractionDigits: 0 });
const pct = (n:number) => `${(n*100).toFixed(1)}%`;

// unified category model
export type CategoryKey =
  | "isp"
  | "voip"
  | "wifi"
  | "access"
  | "cloud"
  | "mobile";

const CATEGORY_LABELS: Record<CategoryKey,string> = {
  isp: "Contract & ISP Negotiation",
  voip: "VoIP & Phone Cost Optimization",
  wifi: "Wi‑Fi Infrastructure Audits",
  access: "Access Control & Security Systems",
  cloud: "Cloud & Licensing Review",
  mobile: "Mobile & Connectivity Plans",
};

// default inputs per category
export type CategoryInputs = {
  mode: "flat" | "perUnit"; // flat = monthly totals, perUnit = units * rate
  units: number;              // dwellings, seats, lines, devices, etc.
  currentMonthly: number;     // if mode=flat, this is the total monthly; if perUnit, this is current rate per unit
  proposedMonthly: number;    // if mode=flat, this is the total monthly; if perUnit, this is proposed rate per unit
  oneTimeCost: number;        // any upfront project cost (CPE, install, conversion, hardware)
  termMonths: number;         // term to show lifetime savings for ISP / contracts
  enabled: boolean;           // include/exclude from totals & charts
};

const DEMO_DEFAULTS: Record<CategoryKey, CategoryInputs> = {
  isp:    { mode:"perUnit", units: 0, currentMonthly: 0, proposedMonthly: 32, oneTimeCost: 5000, termMonths: 0, enabled: true },
  voip:   { mode:"flat",    units: 32,  currentMonthly: 850, proposedMonthly: 30, oneTimeCost: 1200, termMonths: 36, enabled: true },
  wifi:   { mode:"flat",    units: 1,   currentMonthly: 0,   proposedMonthly: 0,  oneTimeCost: 8000, termMonths: 0,  enabled: true },
  access: { mode:"flat",    units: 1,   currentMonthly: 220, proposedMonthly: 95, oneTimeCost: 15000, termMonths: 60, enabled: true },
  cloud:  { mode:"perUnit", units: 120, currentMonthly: 28,  proposedMonthly: 19, oneTimeCost: 0,    termMonths: 36, enabled: true },
  mobile: { mode:"perUnit", units: 40,  currentMonthly: 45,  proposedMonthly: 28, oneTimeCost: 0,    termMonths: 24, enabled: true },
};

const ZERO_DEFAULTS: Record<CategoryKey, CategoryInputs> = {
  isp:    { mode:"perUnit", units: 0, currentMonthly: 0, proposedMonthly: 32, oneTimeCost: 5000, termMonths: 0, enabled: true },
  voip:   { mode:"flat", units: 0, currentMonthly: 0, proposedMonthly: 30, oneTimeCost: 0, termMonths: 0, enabled: true },
  wifi:   { mode:"flat", units: 0, currentMonthly: 0, proposedMonthly: 0, oneTimeCost: 0, termMonths: 0, enabled: true },
  access: { mode:"flat", units: 0, currentMonthly: 0, proposedMonthly: 0, oneTimeCost: 0, termMonths: 0, enabled: true },
  cloud:  { mode:"flat", units: 0, currentMonthly: 0, proposedMonthly: 0, oneTimeCost: 0, termMonths: 0, enabled: true },
  mobile: { mode:"flat", units: 0, currentMonthly: 0, proposedMonthly: 0, oneTimeCost: 0, termMonths: 0, enabled: true },
};

function computeMonthlyTotals(i: CategoryInputs) {
  const curr = i.mode === "flat" ? i.currentMonthly : i.units * i.currentMonthly;
  const prop = i.mode === "flat" ? i.proposedMonthly : i.units * i.proposedMonthly;
  const savings = Math.max(0, curr - prop);
  return { current: curr, proposed: prop, savings };
}

function computeKPIs(i: CategoryInputs){
  const { current, proposed, savings } = computeMonthlyTotals(i);
  const annual = savings * 12;
  const lifetime = i.termMonths > 0 ? savings * i.termMonths : 0;
  const roi = i.oneTimeCost > 0 ? (annual - i.oneTimeCost) / Math.max(1, i.oneTimeCost) : (annual > 0 ? Infinity : 0);
  const paybackMonths = i.oneTimeCost > 0 && savings > 0 ? i.oneTimeCost / savings : 0;
  const reduction = current > 0 ? (current - proposed) / current : 0;
  return { current, proposed, monthlySavings: savings, annualSavings: annual, lifetimeSavings: lifetime, roi, paybackMonths, reduction };
}

// ---------- Rules (make pills meaningful) ----------
type Rule = {
  forceMode?: "flat" | "perUnit";
  fixed?: Partial<Pick<CategoryInputs, "proposedMonthly"|"oneTimeCost"|"termMonths"|"units">>;
  hide?: Partial<Record<"proposedMonthly"|"oneTimeCost"|"termMonths"|"units"|"mode", boolean>>;
};
const CATEGORY_RULES: Partial<Record<CategoryKey, Rule>> = {
  isp:  { forceMode:"perUnit", fixed:{ proposedMonthly:32, oneTimeCost:5000, termMonths:0 }, hide:{ termMonths:true, oneTimeCost:true, mode:true } },
  voip: { forceMode:"flat", fixed:{ proposedMonthly:30 } },
};
function applyRules(k: CategoryKey, next: CategoryInputs): CategoryInputs {
  const r = CATEGORY_RULES[k];
  if (!r) return next;
  const out = { ...next };
  if (r.forceMode) out.mode = r.forceMode;
  if (r.fixed) Object.assign(out, r.fixed);
  return out;
}

// ---------- UI building blocks ----------
function NumberField({ id, label, value, onChange, min=0, step=1, suffix, disabled, prefix }:{
  id:string; label:string; value:number; onChange:(n:number)=>void; min?:number; step?:number; suffix?:string; disabled?: boolean; prefix?: string; }){
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm text-slate-700">{label}</Label>
      <div className="flex items-center gap-2"><div className="relative w-full">{prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e)=> onChange(parseFloat(e.target.value || "0"))}
          disabled={disabled}
          className={"bg-white border-slate-300 text-slate-900" + (prefix ? " pl-6" : "")}
        />
        </div>
        {suffix && <span className="text-slate-500 text-sm w-16">{suffix}</span>}
      </div>
    </div>
  );
}

function ModeToggle({checked, onCheckedChange}:{checked:boolean; onCheckedChange:(b:boolean)=>void}){
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500">Flat monthly</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <span className="text-xs text-slate-500">Per-unit</span>
    </div>
  );
}

// ---------- Category Card ----------
function CategoryCard({ k, inputs, onChange, view }:{
  k: CategoryKey;
  inputs: CategoryInputs;
  onChange: (next: CategoryInputs)=>void;
  view: "simple"|"advanced";
}){
  const kpis = useMemo(()=> computeKPIs(inputs), [inputs]);
  const isPerUnit = inputs.mode === "perUnit";

  return (
    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-slate-900">{CATEGORY_LABELS[k]}</h3>
            <p className="text-slate-600 text-sm mt-1">Quickly model CoCom savings and ROI for this area.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block"><Calculator className="w-5 h-5" style={{color: BRAND.blue}}/></div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Include in totals</Label>
              <Switch checked={inputs.enabled} onCheckedChange={(b)=> onChange(applyRules(k, { ...inputs, enabled: b }))} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div className="grid gap-4">
            {k !== "isp" ? (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                <ModeToggle checked={isPerUnit} onCheckedChange={(b)=> onChange(applyRules(k, { ...inputs, mode: b?"perUnit":"flat" }))} />
                {isPerUnit && (
                  <div className="w-36">
                    <NumberField id={`${k}-units`} label="Units / seats / lines" value={inputs.units} onChange={(n)=> onChange(applyRules(k, { ...inputs, units: n }))} step={1} suffix={"units"} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-xs text-slate-600">Per‑unit pricing</div>
                <div className="w-36">
                  <NumberField id={`${k}-units`} label="Units / seats / lines" value={inputs.units} onChange={(n)=> onChange(applyRules(k, { ...inputs, units: n }))} step={1} suffix={"units"} />
                </div>
              </div>
            )}

            {k === "isp" && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                Proposed per‑unit is fixed at <span className="font-medium text-slate-800">$32</span>. One‑time cost of <span className="font-medium text-slate-800">$5000</span> is applied. Contract term is not used.
              </div>
            )}

            {k === "voip" && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                Proposed monthly is fixed at <span className="font-medium text-slate-800">$30</span> for VoIP.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <NumberField
                id={`${k}-curr`}
                label={isPerUnit?"Current per-unit" : "Current monthly total"}
                value={inputs.currentMonthly}
                onChange={(n)=> onChange(applyRules(k, { ...inputs, currentMonthly: n }))}
                step={0.01}
                suffix={"/mo"}
                prefix="$"
              />
              <NumberField
                id={`${k}-prop`}
                label={k==="isp"?"Proposed per-unit (fixed) 🔒":(k==="voip"?"Proposed monthly (fixed) 🔒":(isPerUnit?"Proposed per-unit" : "Proposed monthly total"))} 
                value={k==="isp"?32:(k==="voip"?30:inputs.proposedMonthly)}
                onChange={(n)=> onChange(applyRules(k, { ...inputs, proposedMonthly: n }))}
                step={0.01}
                suffix={"/mo"}
                disabled={k==="isp"||k==="voip"}
                prefix="$"
              />
            </div>

            {k !== "isp" && view === "advanced" && (
            <div className="grid grid-cols-2 gap-4">
              <NumberField id={`${k}-one`} label="One-time project cost" value={inputs.oneTimeCost} onChange={(n)=> onChange(applyRules(k, { ...inputs, oneTimeCost: n }))} step={1} suffix={"one-time"} prefix="$" />
              <NumberField id={`${k}-term`} label="Contract term (months)" value={inputs.termMonths} onChange={(n)=> onChange(applyRules(k, { ...inputs, termMonths: n }))} step={1} suffix={"months"} />
            </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Current monthly</p>
              <p className="text-xl font-semibold text-slate-900">{currency(kpis.current)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Proposed monthly</p>
              <p className="text-xl font-semibold text-slate-900">{currency(kpis.proposed)}</p>
            </div>
            <div className="bg-[#e6ecf5] border border-[#b9c6db] rounded-xl p-4">
              <p className="text-xs" style={{color: BRAND.blue}}>Monthly savings</p>
              <p className="text-xl font-semibold" style={{color: BRAND.blue}}>{currency(kpis.monthlySavings)}</p>
            </div>
            <div className="bg-[#e6ecf5] border border-[#b9c6db] rounded-xl p-4">
              <p className="text-xs" style={{color: BRAND.blue}}>Annual savings</p>
              <p className="text-xl font-semibold" style={{color: BRAND.blue}}>{currency(kpis.annualSavings)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Reduction</p>
              <p className="text-xl font-semibold text-slate-900">{pct(kpis.reduction)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Payback</p>
              <p className="text-xl font-semibold text-slate-900">{kpis.paybackMonths>0?`${kpis.paybackMonths.toFixed(1)} mo`:"—"}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 md:col-span-3">
              <p className="text-xs text-slate-500">ROI (first year)</p>
              <p className="text-xl font-semibold text-slate-900">{Number.isFinite(kpis.roi)? pct(kpis.roi) : "∞"}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Main Component ----------
export default function CostSavingsCalculator(){
  const [data, setData] = useState<Record<CategoryKey, CategoryInputs>>(()=>{
    let initial: Record<CategoryKey, CategoryInputs> = ZERO_DEFAULTS;
    if (typeof window !== "undefined"){
      const cached = localStorage.getItem("cocom_calc_v2");
      if (cached) try { initial = JSON.parse(cached); } catch {}
      const s = new URLSearchParams(window.location.search).get("s");
      if (s) { try { initial = { ...initial, ...JSON.parse(s) }; } catch {} }
    }
    // enforce fixed values
    initial.isp = applyRules("isp", { ...ZERO_DEFAULTS.isp, ...initial.isp });
    initial.voip = applyRules("voip", { ...ZERO_DEFAULTS.voip, ...initial.voip });
    return initial;
  });

  // define view/scope/active BEFORE any memoized computations that use them
  const [active, setActive] = useState<CategoryKey>("isp");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [view, setView] = useState<"simple" | "advanced">("simple");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const old = localStorage.getItem("cocom_calc_v1");
      const current = localStorage.getItem("cocom_calc_v2");
      if (old && !current) {
        // remove old key to avoid stale values
        localStorage.removeItem("cocom_calc_v1");
      }
    }
  }, []);

  useEffect(()=>{
    if (typeof window !== "undefined") localStorage.setItem("cocom_calc_v2", JSON.stringify(data));
  }, [data]);

  // shareable link: keep state in URL (compact enough for this form)
  useEffect(()=>{
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("s", JSON.stringify(data));
    window.history.replaceState(null, "", url.toString());
  }, [data]);

  // auto-resize for iframe embeds
  useEffect(()=>{
    if (typeof window === "undefined") return;
    interface WinWithRO extends Window {
      ResizeObserver?: new (callback: ResizeObserverCallback) => ResizeObserver;
    }
    const w = window as WinWithRO;
    if (!w.ResizeObserver) return;
    const ro = new w.ResizeObserver(()=>{
      window.parent?.postMessage({ type: "calc-resize", height: document.body.scrollHeight }, "*");
    });
    ro.observe(document.body);
    return ()=> ro.disconnect();
  }, []);

  const totals = useMemo(()=>{
    const keys = (Object.keys(data) as CategoryKey[])
      .filter(k => data[k].enabled)
      .filter(k => scope === "all" ? true : k === active);
    let current = 0, proposed = 0, monthlySavings = 0, annualSavings = 0, lifetimeSavings = 0, oneTime = 0;
    keys.forEach((k)=>{
      const kpi = computeKPIs(data[k]);
      current += kpi.current;
      proposed += kpi.proposed;
      monthlySavings += kpi.monthlySavings;
      annualSavings += kpi.annualSavings;
      lifetimeSavings += kpi.lifetimeSavings;
      oneTime += data[k].oneTimeCost || 0;
    });
    return { current, proposed, monthlySavings, annualSavings, lifetimeSavings, oneTime };
  }, [data, active, scope]);

  const chartData = useMemo(()=>{
    let keys = (Object.keys(data) as CategoryKey[]);
    keys = keys.filter(k => data[k].enabled);
    if (scope === "selected") keys = keys.filter(k => k === active);
    return keys.map((k)=>(
      { name: CATEGORY_LABELS[k], value: computeKPIs(data[k]).annualSavings, key: k }
    )).filter(d=>d.value>0);
  }, [data, active, scope]);

  const COLORS = [BRAND.blue, "#2f5ea5", "#7aa2d2", "#5a8cc4", "#9ab7dc", "#c5d6ec"];

  const clearAll = () => { setData(ZERO_DEFAULTS); if (typeof window !== "undefined") localStorage.setItem("cocom_calc_v2", JSON.stringify(ZERO_DEFAULTS)); };

  const loadDemo = () => { setData(DEMO_DEFAULTS); if (typeof window !== "undefined") localStorage.setItem("cocom_calc_v2", JSON.stringify(DEMO_DEFAULTS)); };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8 text-slate-900 bg-gradient-to-b from-white to-slate-50 rounded-2xl">
      <header className="mb-6 md:mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-slate-900">CoCom Savings & ROI Calculator</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">Model CoCom savings across contracts, voice, Wi‑Fi, access control, cloud licensing, and mobility. Toggle per‑unit or flat pricing, add one‑time costs, and see CoCom payback and ROI instantly.</p>
        </div>
        <a href="https://cocompartners.com" target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img src={LOGO_SRC} alt="CoCom logo" className="h-12 md:h-32 lg:h-40 w-auto opacity-90" />
        </a>
      </header>

      <div className="flex items-center gap-3 mb-6 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={clearAll}>
            <RefreshCw className="w-4 h-4 mr-2"/> Clear (zeros)
          </Button>
          <Button onClick={loadDemo} className="bg-[#1C3256] hover:opacity-90">
            <Calculator className="w-4 h-4 mr-2"/> Load demo
          </Button>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
          <button onClick={()=> setView('simple')} className={`px-3 py-1 text-xs rounded-full ${view==='simple' ? 'bg-[#1C3256] text-white' : 'text-slate-700 hover:bg-slate-50'}`}>Simple</button>
          <button onClick={()=> setView('advanced')} className={`px-3 py-1 text-xs rounded-full ${view==='advanced' ? 'bg-[#1C3256] text-white' : 'text-slate-700 hover:bg-slate-50'}`}>Advanced</button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {(["isp","voip","wifi","access","cloud","mobile"] as CategoryKey[])
          .sort((a,b)=> computeKPIs(data[b]).annualSavings - computeKPIs(data[a]).annualSavings)
          .map((k)=> {
            const isActive = active === k;
            const ann = computeKPIs(data[k]).annualSavings;
            const disabled = !data[k].enabled;
            return (
              <button
                key={k}
                onClick={()=> setActive(k)}
                aria-pressed={isActive}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center ${isActive ? 'bg-[#1C3256] text-white border-[#1C3256]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'} ${disabled ? 'opacity-60' : ''}`}
              >
                <span>{CATEGORY_LABELS[k]}</span>
                <span className={`${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'} ml-2 text-[10px] rounded-full px-2 py-0.5`}>{currency(ann)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <CategoryCard k={active} inputs={data[active]} view={view} onChange={(next)=> setData((d)=> ({...d, [active]: next}))} />

      <div className="mt-4 mb-3 flex items-center gap-2">
        <span className="text-xs text-slate-500">Totals & chart:</span>
        <button onClick={()=> setScope('all')} className={`px-2 py-1 text-xs rounded-full border ${scope==='all' ? 'bg-[#1C3256] text-white border-[#1C3256]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>All categories</button>
        <button onClick={()=> setScope('selected')} className={`px-2 py-1 text-xs rounded-full border ${scope==='selected' ? 'bg-[#1C3256] text-white border-[#1C3256]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>Selected only</button>
      </div>

      <section className="mt-4 grid md:grid-cols-5 gap-6 items-start">
        <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryTile label="Current monthly" value={currency(totals.current)} />
          <SummaryTile label="Proposed monthly" value={currency(totals.proposed)} />
          <SummaryTile label="Monthly savings" value={currency(totals.monthlySavings)} highlight />
          <SummaryTile label="Annual savings" value={currency(totals.annualSavings)} highlight />
          <SummaryTile label="Lifetime (term)" value={totals.lifetimeSavings>0?currency(totals.lifetimeSavings):"—"} />
          <SummaryTile label="One-time costs" value={currency(totals.oneTime)} />
        </div>
        <div className="md:col-span-2 h-72 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative">
          <h3 className="text-sm text-slate-600 mb-2">Annual savings by category</h3>
          {chartData.length ? (
            <div className="relative h-[calc(100%-1.5rem)]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={chartData} outerRadius={100} innerRadius={55} paddingAngle={3}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number)=> currency(v)} contentStyle={{ background: "#ffffff", border:"1px solid #e5e7eb", color:"#0f172a" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xs text-slate-500">Total annual</div>
                  <div className="text-lg font-semibold text-slate-800">{currency(totals.annualSavings)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 text-sm">Enter values to see the chart</div>
          )}
        </div>
      </section>

      <footer className="mt-10 text-xs text-slate-500">
        <p>Tip: For CoCom ISP contracts, set units to doors/beds and use per‑unit pricing. For CoCom VoIP or cloud, use flat totals or per‑seat rates.</p>
      </footer>
    </div>
  );
}

function SummaryTile({label, value, highlight=false}:{label:string; value:string; highlight?:boolean}){
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight?"bg-[#e6ecf5] border-[#b9c6db]":"bg-white border-slate-200"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${highlight?"text-[#1C3256]":"text-slate-900"}`}>{value}</p>
    </div>
  );
}




