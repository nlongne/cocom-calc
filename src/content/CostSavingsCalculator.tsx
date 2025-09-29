import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, RefreshCw, ChevronRight, Calculator } from "lucide-react";
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from "recharts";

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
};

const DEFAULTS: Record<CategoryKey, CategoryInputs> = {
  isp:    { mode:"perUnit", units: 200, currentMonthly: 70, proposedMonthly: 35, oneTimeCost: 5000, termMonths: 60 },
  voip:   { mode:"flat",    units: 32,  currentMonthly: 850, proposedMonthly: 420, oneTimeCost: 1200, termMonths: 36 },
  wifi:   { mode:"flat",    units: 1,   currentMonthly: 0,   proposedMonthly: 0,  oneTimeCost: 8000, termMonths: 0  },
  access: { mode:"flat",    units: 1,   currentMonthly: 220, proposedMonthly: 95, oneTimeCost: 15000, termMonths: 60 },
  cloud:  { mode:"perUnit", units: 120, currentMonthly: 28,  proposedMonthly: 19, oneTimeCost: 0,    termMonths: 36 },
  mobile: { mode:"perUnit", units: 40,  currentMonthly: 45,  proposedMonthly: 28, oneTimeCost: 0,    termMonths: 24 },
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

// ---------- UI building blocks ----------
function NumberField({ id, label, value, onChange, min=0, step=1, suffix }:{
  id:string; label:string; value:number; onChange:(n:number)=>void; min?:number; step?:number; suffix?:string;
}){
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm text-zinc-300">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e)=> onChange(parseFloat(e.target.value || "0"))}
          className="bg-zinc-900/60 border-zinc-700 text-zinc-100"
        />
        {suffix && <span className="text-zinc-400 text-sm w-16">{suffix}</span>}
      </div>
    </div>
  );
}

function ModeToggle({checked, onCheckedChange}:{checked:boolean; onCheckedChange:(b:boolean)=>void}){
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400">Flat monthly</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <span className="text-xs text-zinc-400">Per‑unit</span>
    </div>
  );
}

// ---------- Category Card ----------
function CategoryCard({ k, inputs, onChange }:{
  k: CategoryKey;
  inputs: CategoryInputs;
  onChange: (next: CategoryInputs)=>void;
}){
  const kpis = useMemo(()=> computeKPIs(inputs), [inputs]);
  const isPerUnit = inputs.mode === "perUnit";

  return (
    <Card className="bg-zinc-950/70 border-zinc-800 overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-white">{CATEGORY_LABELS[k]}</h3>
            <p className="text-zinc-400 text-sm mt-1">Quickly model savings and ROI for this area.</p>
          </div>
          <div className="shrink-0"><Calculator className="w-5 h-5 text-zinc-500"/></div>
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
              <ModeToggle checked={isPerUnit} onCheckedChange={(b)=> onChange({ ...inputs, mode: b?"perUnit":"flat" })} />
              {isPerUnit && (
                <div className="w-36">
                  <NumberField id={`${k}-units`} label="Units / seats / lines" value={inputs.units} onChange={(n)=> onChange({ ...inputs, units: n })} step={1} suffix={"units"} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumberField id={`${k}-curr`} label={isPerUnit?"Current per‑unit" : "Current monthly total"} value={inputs.currentMonthly} onChange={(n)=> onChange({ ...inputs, currentMonthly: n })} step={0.01} suffix={isPerUnit?"/mo" : "/mo"} />
              <NumberField id={`${k}-prop`} label={isPerUnit?"Proposed per‑unit" : "Proposed monthly total"} value={inputs.proposedMonthly} onChange={(n)=> onChange({ ...inputs, proposedMonthly: n })} step={0.01} suffix={isPerUnit?"/mo" : "/mo"} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumberField id={`${k}-one`} label="One‑time project cost" value={inputs.oneTimeCost} onChange={(n)=> onChange({ ...inputs, oneTimeCost: n })} step={1} suffix={"one‑time"} />
              <NumberField id={`${k}-term`} label="Contract term (months)" value={inputs.termMonths} onChange={(n)=> onChange({ ...inputs, termMonths: n })} step={1} suffix={"months"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-400">Current monthly</p>
              <p className="text-xl font-semibold text-white">{currency(kpis.current)}</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-400">Proposed monthly</p>
              <p className="text-xl font-semibold text-white">{currency(kpis.proposed)}</p>
            </div>
            <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-4">
              <p className="text-xs text-emerald-300">Monthly savings</p>
              <p className="text-xl font-semibold text-emerald-200">{currency(kpis.monthlySavings)}</p>
            </div>
            <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-4">
              <p className="text-xs text-emerald-300">Annual savings</p>
              <p className="text-xl font-semibold text-emerald-200">{currency(kpis.annualSavings)}</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-400">Reduction</p>
              <p className="text-xl font-semibold text-white">{pct(kpis.reduction)}</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-400">Payback</p>
              <p className="text-xl font-semibold text-white">{kpis.paybackMonths>0?`${kpis.paybackMonths.toFixed(1)} mo`:"—"}</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 col-span-2 md:col-span-3">
              <p className="text-xs text-zinc-400">ROI (first year)</p>
              <p className="text-xl font-semibold text-white">{Number.isFinite(kpis.roi)? pct(kpis.roi) : "∞"}</p>
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
    const cached = typeof window !== "undefined" ? localStorage.getItem("cocom_calc_v1") : null;
    return cached ? JSON.parse(cached) : DEFAULTS;
  });

  useEffect(()=>{
    if (typeof window !== "undefined") localStorage.setItem("cocom_calc_v1", JSON.stringify(data));
  }, [data]);

  const totals = useMemo(()=>{
    let current = 0, proposed = 0, monthlySavings = 0, annualSavings = 0, lifetimeSavings = 0, oneTime = 0;
    (Object.keys(data) as CategoryKey[]).forEach((k)=>{
      const kpi = computeKPIs(data[k]);
      current += kpi.current;
      proposed += kpi.proposed;
      monthlySavings += kpi.monthlySavings;
      annualSavings += kpi.annualSavings;
      lifetimeSavings += kpi.lifetimeSavings;
      oneTime += data[k].oneTimeCost || 0;
    });
    return { current, proposed, monthlySavings, annualSavings, lifetimeSavings, oneTime };
  }, [data]);

  const chartData = useMemo(()=>{
    return (Object.keys(data) as CategoryKey[]).map((k)=>({
      name: CATEGORY_LABELS[k],
      value: computeKPIs(data[k]).annualSavings,
      key: k,
    })).filter(d=>d.value>0);
  }, [data]);

  const COLORS = ["#22c55e", "#10b981", "#84cc16", "#06b6d4", "#8b5cf6", "#f59e0b"]; // default tailwind palette

  const reset = () => setData(DEFAULTS);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8 text-white">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Savings & ROI Calculator</h1>
        <p className="text-zinc-400 mt-2 max-w-2xl">Model savings across contracts, voice, Wi‑Fi, access control, cloud licensing, and mobility. Toggle per‑unit or flat pricing, add one‑time costs, and see payback and ROI instantly.</p>
      </header>

      <div className="flex items-center gap-3 mb-6">
        <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" onClick={reset}>
          <RefreshCw className="w-4 h-4 mr-2"/> Reset examples
        </Button>
        <ExportButtons data={data} totals={totals} />
      </div>

      <Accordion type="multiple" defaultValue={["isp","voip","wifi","access","cloud","mobile"]} className="space-y-4">
        {(Object.keys(data) as CategoryKey[]).map((k)=> (
          <AccordionItem key={k} value={k} className="border-zinc-800 rounded-xl overflow-hidden">
            <AccordionTrigger className="px-4 md:px-6 hover:no-underline bg-zinc-950/70">
              <div className="flex items-center gap-3 text-left">
                <ChevronRight className="w-4 h-4 text-zinc-500"/>
                <span className="font-medium">{CATEGORY_LABELS[k]}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0">
              <CategoryCard k={k} inputs={data[k]} onChange={(next)=> setData((d)=> ({...d, [k]: next}))} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="mt-8 grid md:grid-cols-5 gap-6 items-start">
        <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryTile label="Current monthly" value={currency(totals.current)} />
          <SummaryTile label="Proposed monthly" value={currency(totals.proposed)} />
          <SummaryTile label="Monthly savings" value={currency(totals.monthlySavings)} highlight />
          <SummaryTile label="Annual savings" value={currency(totals.annualSavings)} highlight />
          <SummaryTile label="Lifetime (term)" value={totals.lifetimeSavings>0?currency(totals.lifetimeSavings):"—"} />
          <SummaryTile label="One‑time costs" value={currency(totals.oneTime)} />
        </div>
        <div className="md:col-span-2 h-72 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
          <h3 className="text-sm text-zinc-400 mb-2">Annual savings by category</h3>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={chartData} outerRadius={100} innerRadius={55} paddingAngle={3}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number)=> currency(v)} contentStyle={{ background: "#0a0a0a", border:"1px solid #27272a", color:"white" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500 text-sm">Enter values to see the chart</div>
          )}
        </div>
      </section>

      <footer className="mt-10 text-xs text-zinc-500">
        <p>Tip: For ISP contracts, set units to doors/beds and use per‑unit pricing. For VoIP or cloud, use flat totals or per‑seat rates.</p>
      </footer>
    </div>
  );
}

function SummaryTile({label, value, highlight=false}:{label:string; value:string; highlight?:boolean}){
  return (
    <div className={`rounded-xl border p-4 ${highlight?"bg-emerald-900/25 border-emerald-800":"bg-zinc-950/70 border-zinc-800"}`}>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`text-xl font-semibold ${highlight?"text-emerald-200":"text-white"}`}>{value}</p>
    </div>
  );
}

// ---------- Export (CSV/JSON) ----------
function ExportButtons({data, totals}:{data:Record<CategoryKey, CategoryInputs>, totals:any}){
  const toCSV = () => {
    const rows = [
      ["Category","Mode","Units","Current","Proposed","Monthly Savings","Annual Savings","Term Months","Lifetime Savings","One‑time Cost"],
      ...(Object.keys(data) as CategoryKey[]).map((k)=>{
        const i = data[k];
        const kpi = computeKPIs(i);
        return [
          CATEGORY_LABELS[k],
          i.mode,
          i.units,
          (i.mode==="flat"?i.currentMonthly:i.currentMonthly).toString(),
          (i.mode==="flat"?i.proposedMonthly:i.proposedMonthly).toString(),
          kpi.monthlySavings,
          kpi.annualSavings,
          i.termMonths,
          kpi.lifetimeSavings,
          i.oneTimeCost,
        ];
      }),
      ["TOTALS","","","", "", totals.monthlySavings, totals.annualSavings, "", totals.lifetimeSavings, totals.oneTime],
    ];
    const csv = rows.map(r=> r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cocom-savings.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const toJSON = () => {
    const blob = new Blob([JSON.stringify({ inputs:data, totals }, null, 2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cocom-savings.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={toCSV} className="bg-emerald-600 hover:bg-emerald-500">
        <Download className="w-4 h-4 mr-2"/> Export CSV
      </Button>
      <Button variant="secondary" onClick={toJSON} className="bg-zinc-900 border border-zinc-800">Export JSON</Button>
    </div>
  );
}
