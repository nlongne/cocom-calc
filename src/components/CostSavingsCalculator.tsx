"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Calculator, Info } from "lucide-react";
import { Source_Sans_3 } from "next/font/google";
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from "recharts";

// ===== Brand & helpers =====
const LOGO_SRC = "/cocom-logo.png";
const BRAND = { blue: "#1C3256", blueTint: "#e6ecf5" } as const;
const currency = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const pct = (n: number) => `${(Math.max(0, Math.min(1, n || 0)) * 100).toFixed(1)}%`;

// Styled Switch with brand colors (unchecked = light blue, checked = brand blue)
const StyledSwitch = (props: React.ComponentProps<typeof Switch>) => (
  <Switch
    {...props}
    className={"bg-[#c5d6ec] data-[state=checked]:bg-[#1C3256]"}
  />
);

function InfoTip({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="relative inline-flex items-center align-text-top group"
      aria-label={`Info: ${text}`}
      title={text}
    >
      <Info className="w-3 h-3 text-slate-500" />
      <span
        role="tooltip"
        className="pointer-events-none absolute z-20 invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 transition duration-150 whitespace-normal max-w-[260px] rounded-md bg-slate-900 text-white text-[11px] leading-snug p-2 shadow-lg -top-1 left-1/2 -translate-x-1/2 -translate-y-full"
      >
        {text}
      </span>
    </button>
  );
}

// ===== Types =====
export type CategoryKey = "isp" | "voip" | "biznet" | "mobile";
export type CategoryInputs = {
  mode: "flat" | "perUnit";
  units: number;
  currentMonthly: number; // flat total or per-unit rate
  proposedMonthly: number; // flat total or per-unit rate
  oneTimeCost: number;
  termMonths: number;
  enabled: boolean;
  // ISP-specific
  ispMode?: "current" | "new"; // Existing bulk vs New bulk agreement
  resellPrice?: number; // for ISP new
  doorFeePerUnit?: number; // for ISP new
  // BizNet-specific
  bulkAgreement?: boolean; // if true, proposed=0 else 120
};

type KPIs = {
  current: number;
  proposed: number;
  monthlySavings: number;
  annualSavings: number; // includes doorBenefit for isp=new
  lifetimeSavings: number;
  roi: number;
  paybackMonths: number;
  reduction: number;
  doorBenefit?: number;
};

// ===== Labels & defaults =====
const CATEGORY_LABELS: Record<CategoryKey, string> = {
  isp: "ISP Bulk Service",
  voip: "VoIP and POTS Cost Optimization",
  biznet: "Business Internet",
  mobile: "Mobile & Connectivity Plans",
};

const DEMO_DEFAULTS: Record<CategoryKey, CategoryInputs> = {
  isp: {
    mode: "perUnit",
    units: 120,
    currentMonthly: 55,
    proposedMonthly: 32,
    oneTimeCost: 5000,
    termMonths: 0,
    enabled: true,
    ispMode: "current",
    resellPrice: 65,
    doorFeePerUnit: 200,
  },
  voip: {
    mode: "flat",
    units: 10,
    currentMonthly: 600,
    proposedMonthly: 30,
    oneTimeCost: 0,
    termMonths: 0,
    enabled: true,
  },
  biznet: {
    mode: "flat",
    units: 1,
    currentMonthly: 350,
    proposedMonthly: 120,
    oneTimeCost: 0,
    termMonths: 0,
    enabled: true,
    bulkAgreement: false,
  },
  mobile: {
    mode: "perUnit",
    units: 40,
    currentMonthly: 45,
    proposedMonthly: 28,
    oneTimeCost: 0,
    termMonths: 24,
    enabled: true,
  },
};

const ZERO_DEFAULTS: Record<CategoryKey, CategoryInputs> = {
  isp: {
    mode: "perUnit",
    units: 0,
    currentMonthly: 0,
    proposedMonthly: 32,
    oneTimeCost: 5000,
    termMonths: 0,
    enabled: true,
    ispMode: "current",
    resellPrice: 65,
    doorFeePerUnit: 200,
  },
  voip: {
    mode: "flat",
    units: 0,
    currentMonthly: 0,
    proposedMonthly: 30,
    oneTimeCost: 0,
    termMonths: 0,
    enabled: true,
  },
  biznet: {
    mode: "flat",
    units: 0,
    currentMonthly: 0,
    proposedMonthly: 120,
    oneTimeCost: 0,
    termMonths: 0,
    enabled: true,
    bulkAgreement: false,
  },
  mobile: {
    mode: "perUnit",
    units: 0,
    currentMonthly: 0,
    proposedMonthly: 0,
    oneTimeCost: 0,
    termMonths: 0,
    enabled: true,
  },
};

// ===== Math =====
function computeMonthlyTotals(i: CategoryInputs) {
  const curr = i.mode === "flat" ? i.currentMonthly : i.units * i.currentMonthly;
  const prop = i.mode === "flat" ? i.proposedMonthly : i.units * i.proposedMonthly;
  return { current: curr, proposed: prop, savings: Math.max(0, curr - prop) };
}

function computeKPIs(i: CategoryInputs): KPIs {
  const { current, proposed, savings } = computeMonthlyTotals(i);
  let annual = savings * 12;
  const doorBenefit =
    i.ispMode === "new" && i.doorFeePerUnit && i.units
      ? i.doorFeePerUnit * i.units
      : 0;
  annual += doorBenefit; // client value includes door fees when ISP=new
  const lifetime = i.termMonths > 0 ? savings * i.termMonths : 0;
  const roi =
    i.oneTimeCost > 0
      ? (annual - i.oneTimeCost) / Math.max(1, i.oneTimeCost)
      : annual > 0
      ? Infinity
      : 0;
  const paybackMonths =
    i.oneTimeCost > 0 && savings > 0 ? i.oneTimeCost / savings : 0;
  const reduction = current > 0 ? (current - proposed) / current : 0;
  return {
    current,
    proposed,
    monthlySavings: savings,
    annualSavings: annual,
    lifetimeSavings: lifetime,
    roi,
    paybackMonths,
    reduction,
    doorBenefit,
  };
}

function normalizeForComputation(
  k: CategoryKey,
  i: CategoryInputs
): CategoryInputs {
  if (k === "voip") {
    const used =
      i.mode === "flat" ? i.currentMonthly > 0 : i.units > 0 && i.currentMonthly > 0;
    return { ...i, proposedMonthly: used ? 30 : 0 }; // $30 only when used
  }
  if (k === "biznet")
    return { ...i, mode: "flat", proposedMonthly: i.bulkAgreement ? 0 : 120 };
  if (k === "isp" && i.ispMode === "new") {
    const resell = i.resellPrice ?? 65; // revenue per unit
    return { ...i, mode: "perUnit", currentMonthly: resell, proposedMonthly: 32, oneTimeCost: 0 };
  }
  if (k === "isp" && i.ispMode !== "new")
    return { ...i, mode: "perUnit", proposedMonthly: 32, oneTimeCost: 5000 };
  return i;
}

// ===== UI helpers =====
function ModeToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (b: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500">Flat monthly</span>
      <StyledSwitch checked={checked} onCheckedChange={onCheckedChange} />
      <span className="text-xs text-slate-500">Per-unit</span>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  step = 0.01,
  prefix,
  suffix,
  disabled,
}: {
  id: string;
  label: React.ReactNode;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-slate-600">
        {label}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          min={0}
          onChange={(e) =>
            onChange(Math.max(0, parseFloat(e.currentTarget.value || "0")))
          }
          disabled={disabled}
          className={`text-slate-900 placeholder:text-slate-400 ${prefix ? "pl-7" : ""} ${suffix ? "pr-14" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ===== Category card =====
function CategoryCard({
  k,
  inputs,
  onChange,
}: {
  k: CategoryKey;
  inputs: CategoryInputs;
  onChange: (next: CategoryInputs) => void;
}) {
  const normalized = useMemo(() => normalizeForComputation(k, inputs), [k, inputs]);
  const kpis = useMemo(() => computeKPIs(normalized), [normalized]);
  const isPerUnit = inputs.mode === "perUnit";

  return (
    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-slate-900">
              {CATEGORY_LABELS[k]}
            </h3>
            <p className="text-slate-600 text-sm mt-1">
              Quickly model CoCom savings and ROI for this area.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <Calculator className="w-5 h-5" style={{ color: BRAND.blue }} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Include in totals</Label>
              <StyledSwitch
                checked={inputs.enabled}
                onCheckedChange={(b) => onChange({ ...inputs, enabled: b })}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div className="grid gap-4">
            {k === "isp" ? (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Agreement type</span>
                  <InfoTip text="Existing = current bulk terms. New = model a new agreement." />
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          normalizeForComputation("isp", { ...inputs, ispMode: "current" })
                        )
                      }
                      className={`px-2 py-1 text-xs rounded-full ${
                        inputs.ispMode !== "new"
                          ? "bg-[#1C3256] text-white"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          normalizeForComputation("isp", { ...inputs, ispMode: "new" })
                        )
                      }
                      className={`px-2 py-1 text-xs rounded-full ${
                        inputs.ispMode === "new"
                          ? "bg-[#1C3256] text-white"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      New
                    </button>
                  </div>
                </div>
                <div className="w-36">
                  <NumberField
                    id={`${k}-units`}
                    label={
                      <>
                        <span>Units / doors</span> <InfoTip text="Number of dwellings covered." />
                      </>
                    }
                    value={inputs.units}
                    onChange={(n) =>
                      onChange({ ...inputs, units: Math.max(0, Math.round(n)) })
                    }
                    step={1}
                    suffix="units"
                  />
                </div>
              </div>
            ) : k === "biznet" ? (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-xs text-slate-600">
                  Bulk Service / Marketing Agreement
                  <span className="inline-block ml-1 align-middle">
                    <InfoTip text="If enabled, proposed becomes $0; otherwise $120/mo." />
                  </span>
                </div>
                <StyledSwitch
                  checked={!!inputs.bulkAgreement}
                  onCheckedChange={(b) =>
                    onChange(
                      normalizeForComputation("biznet", { ...inputs, bulkAgreement: b })
                    )
                  }
                />
              </div>
            ) : (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                <ModeToggle
                  checked={isPerUnit}
                  onCheckedChange={(b) =>
                    onChange(
                      normalizeForComputation(k, { ...inputs, mode: b ? "perUnit" : "flat" })
                    )
                  }
                />
                {isPerUnit && (
                  <div className="w-36">
                    <NumberField
                      id={`${k}-units`}
                      label={
                        <>
                          <span>Units / seats / lines</span>
                          <InfoTip text="Count of billable units in per‑unit mode." />
                        </>
                      }
                      value={inputs.units}
                      onChange={(n) =>
                        onChange({ ...inputs, units: Math.max(0, Math.round(n)) })
                      }
                      step={1}
                      suffix="units"
                    />
                  </div>
                )}
              </div>
            )}

            {k === "isp" &&
              (inputs.ispMode === "new" ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                  Modeling a <span className="font-medium text-slate-800">new bulk agreement</span>: wholesale per‑unit fixed at
                  <span className="font-medium text-slate-800"> $32</span>. Enter resell and door fee. Door fee benefits client (not charged CoCom fee). A
                  <span className="font-medium text-slate-800"> $5000</span> project fee applies.
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                  Proposed per‑unit fixed at <span className="font-medium text-slate-800">$32</span>. One‑time cost of
                  <span className="font-medium text-slate-800"> $5000</span> applied.
                </div>
              ))}

            {k === "isp" ? (
              inputs.ispMode !== "new" ? (
                <>
                  <NumberField
                    id={`${k}-curr`}
                    label="Current per-unit"
                    value={inputs.currentMonthly}
                    onChange={(n) => onChange({ ...inputs, currentMonthly: n })}
                    step={0.01}
                    suffix="/mo"
                    prefix="$"
                  />
                  <NumberField
                    id={`${k}-prop`}
                    label="Proposed per-unit (fixed) 🔒"
                    value={32}
                    onChange={(n) => onChange({ ...inputs, proposedMonthly: n })}
                    step={0.01}
                    suffix="/mo"
                    prefix="$"
                    disabled
                  />
                </>
              ) : (
                <>
                  <NumberField
                    id={`isp-resell`}
                    label={
                      <>
                        <span>Resell price per unit</span>
                        <InfoTip text="Customer-facing price per unit." />
                      </>
                    }
                    value={inputs.resellPrice ?? 65}
                    onChange={(n) => onChange({ ...inputs, resellPrice: n })}
                    step={0.01}
                    suffix="/mo"
                    prefix="$"
                  />
                  <NumberField
                    id={`isp-door`}
                    label={
                      <>
                        <span>Door fee per unit</span>
                        <InfoTip text="One-time fee to property; included in savings; excluded from CoCom fee." />
                      </>
                    }
                    value={inputs.doorFeePerUnit ?? 200}
                    onChange={(n) => onChange({ ...inputs, doorFeePerUnit: n })}
                    step={1}
                    suffix="one-time"
                    prefix="$"
                  />
                  <div className="text-xs text-slate-600">
                    Estimated cost per unit is <span className="font-medium text-slate-800">$32</span> (fixed).
                  </div>
                </>
              )
            ) : (
              <>
                <NumberField
                  id={`${k}-curr`}
                  label={isPerUnit ? "Current per-unit" : "Current monthly total"}
                  value={inputs.currentMonthly}
                  onChange={(n) => onChange({ ...inputs, currentMonthly: n })}
                  step={0.01}
                  suffix="/mo"
                  prefix="$"
                />
                <NumberField
                  id={`${k}-prop`}
                  label={
                    k === "voip"
                      ? isPerUnit
                        ? "Proposed per-unit (fixed) 🔒"
                        : "Proposed monthly (fixed) 🔒"
                      : k === "biznet"
                      ? "Proposed monthly (fixed) 🔒"
                      : isPerUnit
                      ? "Proposed per-unit"
                      : "Proposed monthly total"
                  }
                  value={
                    k === "voip"
                      ? 30
                      : k === "biznet"
                      ? inputs.bulkAgreement
                        ? 0
                        : 120
                      : inputs.proposedMonthly
                  }
                  onChange={(n) => onChange({ ...inputs, proposedMonthly: n })}
                  step={0.01}
                  suffix="/mo"
                  prefix="$"
                  disabled={k === "voip" || k === "biznet"}
                />
              </>
            )}

            {k !== "isp" && (
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  id={`${k}-one`}
                  label="One-time project cost"
                  value={inputs.oneTimeCost}
                  onChange={(n) => onChange({ ...inputs, oneTimeCost: n })}
                  step={1}
                  suffix="one-time"
                  prefix="$"
                />
                <NumberField
                  id={`${k}-term`}
                  label="Contract term (months)"
                  value={inputs.termMonths}
                  onChange={(n) => onChange({ ...inputs, termMonths: n })}
                  step={1}
                  suffix="months"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">
                {k === "isp" && inputs.ispMode === "new"
                  ? "Resell revenue (monthly)"
                  : "Current monthly"}
              </p>
              <p className="text-xl font-semibold text-slate-900">
                {currency(kpis.current)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">
                {k === "isp" && inputs.ispMode === "new"
                  ? "Wholesale cost (monthly)"
                  : "Proposed monthly"}
              </p>
              <p className="text-xl font-semibold text-slate-900">
                {currency(kpis.proposed)}
              </p>
            </div>
            <div className="bg-[#e6ecf5] border border-[#b9c6db] rounded-xl p-4">
              <p className="text-xs" style={{ color: BRAND.blue }}>
                {k === "isp" && inputs.ispMode === "new"
                  ? "Monthly profit"
                  : "Monthly savings"}
              </p>
              <p className="text-xl font-semibold" style={{ color: BRAND.blue }}>
                {currency(kpis.monthlySavings)}
              </p>
            </div>
            <div className="bg-[#e6ecf5] border border-[#b9c6db] rounded-xl p-4">
              <p className="text-xs" style={{ color: BRAND.blue }}>
                {k === "isp" && inputs.ispMode === "new"
                  ? "Annual profit"
                  : "Annual savings"}
              </p>
              <p className="text-xl font-semibold" style={{ color: BRAND.blue }}>
                {currency(kpis.annualSavings)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">
                Reduction <InfoTip text="Percentage decrease from current to proposed monthly." />
              </p>
              <p className="text-xl font-semibold text-slate-900">{pct(kpis.reduction)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">
                Payback <InfoTip text="Months to recover one-time costs." />
              </p>
              <p className="text-xl font-semibold text-slate-900">
                {kpis.paybackMonths > 0 ? `${kpis.paybackMonths.toFixed(1)} mo` : "—"}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 md:col-span-3">
              <p className="text-xs text-slate-500">
                ROI (first year) <InfoTip text="(Annual savings − one-time costs) ÷ one-time costs. Door-fee benefits not charged CoCom fee." />
              </p>
              <p className="text-xl font-semibold text-slate-900">
                {Number.isFinite(kpis.roi) ? pct(kpis.roi) : "∞"}
              </p>
            </div>
          </div>
        </div>

        {/* Chart BELOW numbers (rendered after the totals section) */}
      </CardContent>
    </Card>
  );
}

// ===== Page component =====
export default function CostSavingsCalculator() {
  // State
  const [data, setData] = useState<Record<CategoryKey, CategoryInputs>>(() => {
    let initial: Record<CategoryKey, CategoryInputs> = ZERO_DEFAULTS;
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("cocom_calc_v2");
      if (cached) {
        try {
          initial = JSON.parse(cached);
        } catch {}
      }
      const s = new URLSearchParams(window.location.search).get("s");
      if (s) {
        try {
          initial = { ...initial, ...JSON.parse(s) };
        } catch {}
      }
    }
    initial = {
      isp: normalizeForComputation("isp", { ...ZERO_DEFAULTS.isp, ...initial.isp }),
      voip: normalizeForComputation("voip", { ...ZERO_DEFAULTS.voip, ...initial.voip }),
      biznet: normalizeForComputation("biznet", { ...ZERO_DEFAULTS.biznet, ...initial.biznet }),
      mobile: normalizeForComputation("mobile", { ...ZERO_DEFAULTS.mobile, ...initial.mobile }),
    } as Record<CategoryKey, CategoryInputs>;
    return initial;
  });
  const [active, setActive] = useState<CategoryKey>("isp");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [view, setView] = useState<"simple" | "advanced">("simple"); // visual only: advanced reveals totals/chart

  // Effects (persist, URL sync, resize msg)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const old = localStorage.getItem("cocom_calc_v1");
      const cur = localStorage.getItem("cocom_calc_v2");
      if (old && !cur) localStorage.removeItem("cocom_calc_v1");
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem("cocom_calc_v2", JSON.stringify(data));
  }, [data]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("s", JSON.stringify(data));
    window.history.replaceState(null, "", url.toString());
  }, [data]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & { ResizeObserver?: new (cb: ResizeObserverCallback) => ResizeObserver };
    if (!w.ResizeObserver) return;
    const ro = new w.ResizeObserver(() => {
      window.parent?.postMessage({ type: "calc-resize", height: document.body.scrollHeight }, "*");
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  // Self-tests (lightweight runtime checks)
  useEffect(() => {
    // Test 1: simple per-unit math
    const t1: CategoryInputs = {
      mode: "perUnit",
      units: 10,
      currentMonthly: 60,
      proposedMonthly: 30,
      oneTimeCost: 1200,
      termMonths: 12,
      enabled: true,
    };
    const k1 = computeKPIs(t1);
    console.assert(k1.monthlySavings === 300, "Test1 monthlySavings should be 300");
    console.assert(k1.annualSavings === 3600, "Test1 annualSavings should be 3600");
    console.assert(Math.abs(k1.roi - 2) < 1e-9, "Test1 ROI should be 2.0");

    // Test 2: ISP new with door benefit included in annual
    const t2: CategoryInputs = {
      mode: "perUnit",
      units: 5,
      currentMonthly: 65,
      proposedMonthly: 32,
      oneTimeCost: 0,
      termMonths: 0,
      enabled: true,
      ispMode: "new",
      resellPrice: 65,
      doorFeePerUnit: 200,
    };
    const k2 = computeKPIs(normalizeForComputation("isp", t2));
    console.assert(k2.doorBenefit === 1000, "Test2 doorBenefit should be 1000");
    console.assert(Number.isFinite(k2.roi) === false, "Test2 ROI should be Infinity when oneTimeCost=0 & annual>0");

    // Test 3: reduction calc (flat)
    const t3: CategoryInputs = { mode: "flat", units: 0, currentMonthly: 200, proposedMonthly: 100, oneTimeCost: 0, termMonths: 0, enabled: true };
    const k3 = computeKPIs(t3);
    console.assert(Math.abs(k3.reduction - 0.5) < 1e-9, "Test3 reduction should be 0.5");

    // Test 4: voip unused -> proposed becomes 0
    const t4: CategoryInputs = { mode: "perUnit", units: 0, currentMonthly: 0, proposedMonthly: 30, oneTimeCost: 0, termMonths: 0, enabled: true };
    const k4 = computeKPIs(normalizeForComputation("voip", t4));
    console.assert(k4.proposed === 0, "Test4 voip proposed should be 0 when unused");

    // Test 5: biznet bulkAgreement true -> proposed 0
    const t5: CategoryInputs = { mode: "flat", units: 1, currentMonthly: 350, proposedMonthly: 120, oneTimeCost: 0, termMonths: 0, enabled: true, bulkAgreement: true };
    const k5 = computeKPIs(normalizeForComputation("biznet", t5));
    console.assert(k5.proposed === 0, "Test5 biznet proposed should be 0 with bulkAgreement");

    // Test 6: isp current -> oneTimeCost applied (affects ROI denominator)
    const t6: CategoryInputs = { mode: "perUnit", units: 10, currentMonthly: 55, proposedMonthly: 32, oneTimeCost: 0, termMonths: 0, enabled: true, ispMode: "current" };
    const norm6 = normalizeForComputation("isp", t6);
    console.assert(norm6.oneTimeCost === 5000, "Test6 ISP current should apply 5000 project fee");
  }, []);

  // Aggregates
  const totals = useMemo(() => {
    const keys = (Object.keys(data) as CategoryKey[])
      .filter((k) => data[k].enabled)
      .filter((k) => (scope === "all" ? true : k === active));
    let current = 0,
      proposed = 0,
      monthlySavings = 0,
      annualSavings = 0,
      lifetimeSavings = 0,
      oneTime = 0;
    keys.forEach((k) => {
      const kpi = computeKPIs(normalizeForComputation(k, data[k]));
      current += kpi.current;
      proposed += kpi.proposed;
      monthlySavings += kpi.monthlySavings;
      annualSavings += kpi.annualSavings;
      lifetimeSavings += kpi.lifetimeSavings;
      oneTime += data[k].oneTimeCost || 0;
    });
    return { current, proposed, monthlySavings, annualSavings, lifetimeSavings, oneTime };
  }, [data, active, scope]);

  const chartData = useMemo(() => {
    let keys = (Object.keys(data) as CategoryKey[]).filter((k) => data[k].enabled);
    if (scope === "selected") keys = keys.filter((k) => k === active);
    return keys
      .map((k) => ({ name: CATEGORY_LABELS[k], value: computeKPIs(normalizeForComputation(k, data[k])).annualSavings }))
      .filter((d) => d.value > 0);
  }, [data, active, scope]);

  const pillAnnual = useMemo(() => {
    const rec: Partial<Record<CategoryKey, number>> = {};
    (Object.keys(CATEGORY_LABELS) as CategoryKey[]).forEach((k) => {
      rec[k] = computeKPIs(normalizeForComputation(k, data[k])).annualSavings;
    });
    return rec as Record<CategoryKey, number>;
  }, [data]);

  // CoCom fee & net section (exclude door-fee benefits from % base; add $5k ISP project fee if ISP included)
  const feeRate = 0.3;
  const coCom = useMemo(() => {
    const keys = (Object.keys(data) as CategoryKey[])
      .filter((k) => data[k].enabled)
      .filter((k) => (scope === "all" ? true : k === active));
    let baseAnnual = 0; // excludes door fees
    keys.forEach((k) => {
      const kpi = computeKPIs(normalizeForComputation(k, data[k]));
      baseAnnual += Math.max(0, kpi.annualSavings - (kpi.doorBenefit || 0));
    });
    const bulkFee = data.isp?.enabled ? 5000 : 0;
    const fee = feeRate * baseAnnual + bulkFee;
    const net = Math.max(0, totals.annualSavings - fee);
    return { baseAnnual, bulkFee, fee, net };
  }, [data, active, scope, totals.annualSavings]);

  const COLORS = [BRAND.blue, "#2f5ea5", "#7aa2d2", "#5a8cc4", "#9ab7dc", "#c5d6ec"];

  // UI
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#1C3256] text-white">
      {/* Full-bleed background to cover the whole webpage, even outside this component's container */}
      <div aria-hidden className="fixed inset-0 bg-[#1C3256] -z-10" />
      <div className="mx-auto max-w-6xl p-4 md:p-8 pb-12">
        {/* Header */}
        <header className="mb-2 md:mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white">CoCom Savings & ROI Calculator</h1>
            <p className="text-white/80 mt-2 max-w-2xl">
              Model CoCom savings across ISP bulk service, VoIP/POTS, Business Internet, and mobility. Toggle per‑unit or flat pricing, add one‑time costs, and see CoCom payback and ROI instantly.
            </p>
          </div>
          <a href="https://cocompartners.com" className="shrink-0">
            <img src={LOGO_SRC} alt="CoCom logo" className="h-30 md:h-60 lg:h-60 w-auto opacity-90" />
          </a>
        </header>

        {/* CALCULATOR WRAPPER (content sits on blue bg) */}
        <section className="rounded-2xl bg-transparent text-inherit p-4 md:p-6 lg:p-8">
          {/* Simple / Advanced toggle (visual only) */}
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-full p-1">
              <button
                onClick={() => setView("simple")}
                className={`px-3 py-1 text-xs rounded-full ${
                  view === "simple" ? "bg-white text-[#1C3256]" : "text-white hover:bg白/10"
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setView("advanced")}
                className={`px-3 py-1 text-xs rounded-full ${
                  view === "advanced" ? "bg-white text-[#1C3256]" : "text-white hover:bg-white/10"
                }`}
              >
                Advanced
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              className="bg-white text-[#1C3256] hover:bg-white/90"
              onClick={() => {
                setData(ZERO_DEFAULTS);
                if (typeof window !== "undefined")
                  localStorage.setItem("cocom_calc_v2", JSON.stringify(ZERO_DEFAULTS));
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Clear (zeros)
            </Button>
            <Button onClick={() => {
              setData(DEMO_DEFAULTS);
              setActive("isp");
              if (typeof window !== "undefined")
                localStorage.setItem("cocom_calc_v2", JSON.stringify(DEMO_DEFAULTS));
            }} className="bg-white text-[#1C3256] hover:bg-white/90">
              <Calculator className="w-4 h-4 mr-2" /> Load demo
            </Button>
          </div>

          {/* Category tabs with annual badges */}
          <div className="mt-1 mb-4 flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setActive(k)}
                className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-2 ${
                  active === k
                    ? "bg-white text-[#1C3256] border-white"
                    : "bg-white/10 text-white border-white/20 hover:bg-white/15"
                }`}
              >
                <span>{CATEGORY_LABELS[k]}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded ${
                    active === k ? "bg-[#1C3256]/10 text-[#1C3256]" : "bg-white/20 text-white"
                  }`}
                >
                  {currency(pillAnnual[k] || 0)}
                </span>
              </button>
            ))}
          </div>

          {/* Active category card (kept white for readability) */}
          <CategoryCard
            k={active}
            inputs={data[active]}
            onChange={(next) => setData((d) => ({ ...d, [active]: next }))}
          />

          {/* ADVANCED-ONLY: Totals & chart controls + grid + chart */}
          {view === "advanced" && (
            <>
              {/* Totals & chart controls */}
              <div className="mt-6 mb-2 flex items-center gap-3 text-sm text-white/90">
                <span>Totals &amp; chart:</span>
                <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-full p-1">
                  <button
                    onClick={() => setScope("all")}
                    className={`px-3 py-1 text-xs rounded-full ${
                      scope === "all" ? "bg-white text-[#1C3256]" : "text-white hover:bg-white/10"
                    }`}
                  >
                    All categories
                  </button>
                  <button
                    onClick={() => setScope("selected")}
                    className={`px-3 py-1 text-xs rounded-full ${
                      scope === "selected" ? "bg-white text-[#1C3256]" : "text-white hover:bg-white/10"
                    }`}
                  >
                    Selected only
                  </button>
                </div>
              </div>

              {/* Totals grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border p-4 bg-white border-white/40">
                  <p className="text-xs text-slate-500">Current monthly</p>
                  <p className="text-xl font-semibold text-slate-900">{currency(totals.current)}</p>
                </div>
                <div className="rounded-xl border p-4 bg-white border-white/40">
                  <p className="text-xs text-slate-500">Proposed monthly</p>
                  <p className="text-xl font-semibold text-slate-900">{currency(totals.proposed)}</p>
                </div>
                <div className="rounded-xl border p-4 bg-[#e6ecf5] border-[#b9c6db]">
                  <p className="text-xs" style={{ color: BRAND.blue }}>
                    Monthly savings
                  </p>
                  <p className="text-xl font-semibold" style={{ color: BRAND.blue }}>
                    {currency(totals.monthlySavings)}
                  </p>
                </div>
                <div className="rounded-xl border p-4 bg-[#e6ecf5] border-[#b9c6db]">
                  <p className="text-xs" style={{ color: BRAND.blue }}>
                    Annual savings
                  </p>
                  <p className="text-xl font-semibold" style={{ color: BRAND.blue }}>
                    {currency(totals.annualSavings)}
                  </p>
                </div>
                <div className="rounded-xl border p-4 bg-white border-white/40">
                  <p className="text-xs text-slate-500">Lifetime (term)</p>
                  <p className="text-xl font-semibold text-slate-900">
                    {totals.lifetimeSavings > 0 ? currency(totals.lifetimeSavings) : "—"}
                  </p>
                </div>
                <div className="rounded-xl border p-4 bg-white border-white/40">
                  <p className="text-xs text-slate-500">One-time costs</p>
                  <p className="text-xl font-semibold text-slate-900">{currency(totals.oneTime)}</p>
                </div>
              </div>

              {/* Chart BELOW numbers */}
              <div className="mt-4 min-w-0 bg-white border border-white/40 rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm text-slate-600 mb-2">Annual savings by category</h3>
                <div className="relative h-72">
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          dataKey="value"
                          data={chartData}
                          outerRadius={110}
                          innerRadius={60}
                          paddingAngle={3}
                        >
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => currency(v as number)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                      Enter values to see the chart
                    </div>
                  )}
                  {/* Centered totals overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-xs text-slate-500">Total annual</div>
                      <div className="text-2xl font-bold text-slate-800">{currency(totals.annualSavings)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Net savings after CoCom fee (ALWAYS visible) */}
          <div className="mt-4 rounded-2xl border border-white/40 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-600">Your Net Savings (after CoCom fee)</p>
            <p className="text-2xl font-semibold" style={{ color: BRAND.blue }}>
              {currency(coCom.net)}
            </p>
            <p className="text-[12px] text-slate-500 mt-1">
              CoCom fee = 30% of annual savings <em>(excluding door‑fee benefits)</em> + bulk agreement fee (ISP, if any).
            </p>
            <p className="text-[12px] text-slate-500">
              Based on {currency(coCom.baseAnnual)} annual savings (excl. door‑fee benefits)
              {coCom.bulkFee > 0 ? `, plus ${currency(coCom.bulkFee)} one‑time bulk agreement fee (ISP)` : ""}.
            </p>
            <p className="text-[12px] text-slate-500">
              Estimated CoCom fee today: <span className="font-medium text-slate-700">{currency(coCom.fee)}</span>
            </p>
          </div>

          {/* Bottom CTA (non-sticky) */}
          <div className="mt-8">
            <div className="rounded-2xl shadow-sm border border-white/30 bg-white p-3 md:p-4 flex items-center justify-between gap-4">
              <div className="text-sm md:text-base text-slate-700">
                Want us to validate these savings for your portfolio? We’ll review bills, contracts, and usage to firm up the ROI.
              </div>
              <a
                href="https://www.cocompartners.com/contact"
                className="whitespace-nowrap inline-flex items-center justify-center rounded-xl px-4 py-2 text-white"
                style={{ background: BRAND.blue }}
              >
                Schedule a free audit
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

