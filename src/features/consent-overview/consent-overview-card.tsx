"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ConsentOverviewResult,
  type FilterParams,
  type Granularity,
  consentOverviewSchema,
} from "@/features/consent-overview/contract";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000)     return `${(n / 1_000).toLocaleString("fr-FR",     { maximumFractionDigits: 0 })} k`;
  return n.toLocaleString("fr-FR");
}
function fmtPct(r: number, digits = 1): string { return `${(r * 100).toFixed(digits)} %`; }

/** Convertit n'importe quel format de date en "dd/mm/yyyy".
 *  Accepte "YYYY-MM-DD", "YYYYMMDD", "YYYY-MM-DDTHH:mm:ss..." */
function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const s = iso.slice(0, 10); // prend les 10 premiers chars
  // Format avec tirets : "YYYY-MM-DD"
  const withDash = s.split("-");
  if (withDash.length === 3 && withDash[0]!.length === 4) {
    return `${withDash[2]}/${withDash[1]}/${withDash[0]}`;
  }
  // Format sans tirets : "YYYYMMDD"
  if (s.length === 8 && /^\d{8}$/.test(s)) {
    return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
  }
  return s;
}

/** Date-heure ISO ou "YYYY-MM-DD HH:mm:ss" → "dd/mm/yyyy HH:mm" (heure de Paris) */
function fmtDateTime(value: string): string {
  const d = new Date(value.includes("T") || value.endsWith("Z") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return fmtDate(value);
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Formate un label de période selon la granularité */
function fmtPeriodLabel(period: string, gran: Granularity): string {
  if (gran === "day") {
    // "YYYY-MM-DD" → "dd/mm"
    const p = period.split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}` : period;
  }
  if (gran === "week") {
    // "6-W45" ou "2026-W45" → toujours "2026-W45"
    // La query retourne YEAR()-W-WEEKOFYEAR(), le YEAR() peut être court si Spark renvoie juste l'entier
    // On normalise : si le segment avant "-W" fait <= 2 chars, on préfixe avec "20"
    const m = period.match(/^(\d+)-W(\d+)$/);
    if (m) {
      const yr = m[1].length <= 2 ? `20${m[1]}` : m[1];
      return `${yr}-W${m[2]}`;
    }
    return period;
  }
  // month: "YYYY-MM" → "MM-YYYY"
  const p = period.split("-");
  return p.length === 2 ? `${p[1]}-${p[0]}` : period;
}

// ── Date range picker ─────────────────────────────────────────────────────────

type DateRange = { startDate?: string; endDate?: string };

// Début de l'historique utilisé par le serveur quand aucune date n'est choisie
const DATA_START = "2024-10-01";

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Today",          range: () => { const d = toISO(new Date()); return { startDate: d, endDate: d }; } },
  { label: "Yesterday",      range: () => { const d = new Date(); d.setDate(d.getDate()-1); const s = toISO(d); return { startDate: s, endDate: s }; } },
  { label: "This week",      range: () => { const n = new Date(); const m = new Date(n); m.setDate(n.getDate()-n.getDay()+1); return { startDate: toISO(m), endDate: toISO(n) }; } },
  { label: "Last week",      range: () => { const n = new Date(); const m = new Date(n); m.setDate(n.getDate()-n.getDay()-6); const e = new Date(m); e.setDate(m.getDate()+6); return { startDate: toISO(m), endDate: toISO(e) }; } },
  { label: "This month",     range: () => { const n = new Date(); return { startDate: toISO(new Date(n.getFullYear(), n.getMonth(), 1)), endDate: toISO(n) }; } },
  { label: "Last month",     range: () => { const n = new Date(); return { startDate: toISO(new Date(n.getFullYear(), n.getMonth()-1, 1)), endDate: toISO(new Date(n.getFullYear(), n.getMonth(), 0)) }; } },
  { label: "This year",      range: () => { const n = new Date(); return { startDate: `${n.getFullYear()}-01-01`, endDate: toISO(n) }; } },
  { label: "Last 30 days",   range: () => { const e = new Date(); const s = new Date(e); s.setDate(s.getDate()-30);  return { startDate: toISO(s), endDate: toISO(e) }; } },
  { label: "Last 90 days",   range: () => { const e = new Date(); const s = new Date(e); s.setDate(s.getDate()-90);  return { startDate: toISO(s), endDate: toISO(e) }; } },
  { label: "Last 12 months", range: () => { const e = new Date(); const s = new Date(e); s.setMonth(s.getMonth()-12); return { startDate: toISO(s), endDate: toISO(e) }; } },
];

function DateRangePicker({ startDate, endDate, onChange }: {
  startDate?: string; endDate?: string; onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Résumé du filtre en dd/mm/yyyy
  // Toujours la plage effective : sans filtre, c'est l'historique complet jusqu'à aujourd'hui
  const effStart = startDate ?? DATA_START;
  const effEnd   = endDate ?? toISO(new Date());
  const label = effStart === effEnd ? fmtDate(effStart) : `${fmtDate(effStart)} → ${fmtDate(effEnd)}`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent">
        <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        <span className="text-on-surface">{label}</span>
        {(startDate || endDate) && (
          <span role="button" tabIndex={0} aria-label="Clear dates" className="ml-1 text-muted hover:text-on-surface"
            onClick={(e) => { e.stopPropagation(); onChange({ startDate: undefined, endDate: undefined }); }}
            onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onChange({ startDate: undefined, endDate: undefined }))}>✕</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-line bg-surface p-4 shadow-xl">
          <div className="mb-3 grid grid-cols-2 gap-1">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => { onChange(p.range()); setOpen(false); }}
                className="rounded-lg px-2 py-1.5 text-left text-xs font-medium text-muted hover:bg-accent/10 hover:text-on-surface">
                {p.label}
              </button>
            ))}
          </div>
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Custom range</p>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">Start
                <input type="date" value={startDate ?? ""} max={endDate}
                  onChange={(e) => onChange({ startDate: e.target.value || undefined, endDate })}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">End
                <input type="date" value={endDate ?? ""} min={startDate}
                  onChange={(e) => onChange({ startDate, endDate: e.target.value || undefined })}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </label>
            </div>
          </div>
          {(startDate || endDate) && (
            <button type="button" onClick={() => { onChange({ startDate: undefined, endDate: undefined }); setOpen(false); }}
              className="mt-2 w-full rounded-lg border border-line py-1.5 text-xs text-muted hover:text-on-surface">Clear</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Multi-select dropdown ─────────────────────────────────────────────────────

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: string[];      // déjà triées par l'appelant
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  }

  const btnLabel = selected.length === 0
    ? `All ${label}`
    : selected.length === 1 ? selected[0]!
    : `${selected.length} ${label}`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex min-w-[120px] items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent">
        <span className={selected.length > 0 ? "text-on-surface" : "text-muted"}>{btnLabel}</span>
        <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[160px] overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-xl">
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                className="h-3.5 w-3.5 rounded accent-accent" />
              <span>{opt}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" onClick={() => { onChange([]); setOpen(false); }}
              className="mt-1 w-full rounded-lg border border-line py-1 text-xs text-muted hover:text-on-surface">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter bar — édition locale, apply sur bouton ─────────────────────────────

function FilterBar({
  appliedFilters,
  availableMembers,
  availableDeviceTypes,
  onApply,
}: {
  appliedFilters: FilterParams;
  availableMembers: string[];
  availableDeviceTypes: string[];
  onApply: (f: FilterParams) => void;
}) {
  // État local de la barre — ne déclenche pas de requête avant Apply
  const [pending, setPending] = useState<FilterParams>(appliedFilters);

  // Synchroniser si les filtres appliqués changent de l'extérieur (reset, granularité)
  useEffect(() => { setPending(appliedFilters); }, [appliedFilters]);

  const hasPending =
    JSON.stringify({ ...pending, granularity: undefined }) !==
    JSON.stringify({ ...appliedFilters, granularity: undefined });

  const hasFilter = (pending.members?.length ?? 0) > 0
    || (pending.deviceTypes?.length ?? 0) > 0
    || pending.startDate || pending.endDate;

  // Tri alphabétique des options
  const sortedMembers = [...availableMembers].sort((a, b) => a.localeCompare(b));
  const sortedDevices = [...availableDeviceTypes].sort((a, b) => a.localeCompare(b));

  function handleApply() { onApply(pending); }

  function handleReset() {
    const reset: FilterParams = { granularity: pending.granularity };
    setPending(reset);
    onApply(reset);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <MultiSelect
        label="members"
        options={sortedMembers}
        selected={pending.members ?? []}
        onChange={(v) => setPending((p) => ({ ...p, members: v.length > 0 ? v : undefined }))}
      />
      <MultiSelect
        label="devices"
        options={sortedDevices}
        selected={pending.deviceTypes ?? []}
        onChange={(v) => setPending((p) => ({ ...p, deviceTypes: v.length > 0 ? v : undefined }))}
      />
      <DateRangePicker
        startDate={pending.startDate}
        endDate={pending.endDate}
        onChange={(r) => setPending((p) => ({ ...p, ...r }))}
      />

      {/* Bouton Apply — visible si la sélection diffère des filtres appliqués */}
      {hasPending && (
        <button type="button" onClick={handleApply}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent">
          Apply
        </button>
      )}

      {/* Reset — réinitialise et applique immédiatement */}
      {(hasFilter || hasPending) && (
        <button type="button" onClick={handleReset}
          className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-on-surface">
          Reset
        </button>
      )}
    </div>
  );
}

// ── KPI header — 1 bloc fusionné + Consent by device ─────────────────────────

function KpiHeader({ kpi, deviceData }: {
  kpi: ConsentOverviewResult["kpi"];
  deviceData: ConsentOverviewResult["byDevice"];
}) {
  const [deviceMode, setDeviceMode] = useState<"pct" | "abs">("pct");
  // Mode # : normaliser par le total max (opt-in + opt-out) pour que aucune barre ne déborde
  const maxTotal = Math.max(...deviceData.map((r) => r.optIn + r.optOut), 1);

  return (
    <section aria-label="Main KPIs" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Bloc fusionné — layout vertical */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-panel">

        {/* Contact exposed */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Contact exposed</span>
          <div className="mt-2 flex items-baseline gap-4">
            <span className="text-4xl font-bold tabular-nums leading-none">{fmtN(kpi.contactTotal)}</span>
            <span className="text-lg font-semibold tabular-nums text-muted">
              {fmtN(kpi.withoutChoice)}
              <span className="ml-1 text-xs font-normal">no choice</span>
            </span>
          </div>
        </div>

        {/* Contact with choice */}
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Contact with choice</span>
          <span className="text-4xl font-bold tabular-nums leading-none">{fmtN(kpi.contactWithChoice)}</span>

          {/* Split opt-in / custom / opt-out — flex-1 pour remplir la hauteur restante */}
          <div className="flex flex-1 flex-col gap-2 pt-1">
            {[
              { label: "Opt-in",  val: kpi.optIn,  pct: kpi.consentRate, l30: kpi.last30dConsentRate, color: "bg-green-600/90" },
              { label: "Custom",  val: kpi.custom,  pct: kpi.customRate,  l30: kpi.last30dCustomRate,  color: "bg-amber-500/90" },
              { label: "Opt-out", val: kpi.optOut,  pct: kpi.rejectRate,  l30: kpi.last30dRejectRate,  color: "bg-red-600/90"   },
            ].map(({ label, val, pct, l30, color }) => (
              <div key={label}
                className={`flex flex-1 items-center justify-between rounded-xl ${color} px-4`}
                style={{ minHeight: "2.8rem" }}>
                <span className="text-sm font-semibold text-white">{label}</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-base font-bold text-white tabular-nums">{fmtN(val)}</span>
                  {/* % période choisie */}
                  <span className="text-sm font-semibold text-white/90">{fmtPct(pct)}</span>
                  {/* % last 30 days — affiché uniquement si disponible */}
                  {l30 !== null && l30 !== undefined && (
                    <span className="text-xs text-white/60" title="last 30 days">
                      {fmtPct(l30)} <span className="opacity-70">(last 30d)</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Consent by device */}
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-panel">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Consent by device</span>
          <div className="flex gap-1 rounded-lg border border-line p-0.5">
            {(["pct", "abs"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setDeviceMode(m)}
                className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${deviceMode === m ? "bg-accent text-white" : "text-muted hover:text-on-surface"}`}>
                {m === "pct" ? "%" : "#"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {deviceData.map((row) => {
            // Mode % : opt-in% + opt-out% = 100% (consent rate)
            // Mode # : chaque barre proportionnelle à maxTotal — jamais de débordement possible
            const optInW  = deviceMode === "pct" ? row.consentRate     : row.optIn  / maxTotal;
            const optOutW = deviceMode === "pct" ? 1 - row.consentRate : row.optOut / maxTotal;

            return (
              <div key={row.deviceType} className="group relative">
                <div className="mb-1 flex items-baseline justify-between gap-1">
                  <span className="text-xs font-semibold">{row.deviceType}</span>
                  <span className="text-[10px] font-bold text-muted">{fmtPct(row.shareOfTotal)}</span>
                </div>
                <div className="flex h-5 w-full overflow-hidden rounded">
                  <div className="shrink-0 bg-green-600 transition-all"
                    style={{ width: `${(optInW * 100).toFixed(2)}%` }} />
                  <div className="shrink-0 bg-red-500 transition-all"
                    style={{ width: `${(optOutW * 100).toFixed(2)}%` }} />
                </div>
                {/* Labels sous les barres :
                    - opt-in : aligné à gauche (début de la barre verte)
                    - opt-out en mode % : aligné à droite du conteneur (barre va jusqu'au bout)
                    - opt-out en mode # : positionné à l'extrémité droite de la barre rouge */}
                <div className="relative mt-0.5 h-4 w-full text-[10px]">
                  {/* Label opt-in — toujours à gauche */}
                  <span className="absolute left-0 text-green-500 font-medium">
                    {deviceMode === "pct" ? fmtPct(row.consentRate, 0) : fmtN(row.optIn)}
                  </span>
                  {/* Label opt-out — ancré à l'extrémité droite de la barre rouge */}
                  <span className="absolute text-red-400"
                    style={{
                      right: deviceMode === "pct"
                        ? "0%"
                        : `${(1 - (optInW + optOutW)) * 100}%`,
                      transform: "translateX(50%)",
                    }}>
                    {deviceMode === "pct" ? fmtPct(1 - row.consentRate, 0) : fmtN(row.optOut)}
                  </span>
                </div>
                {/* Infobulle */}
                <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-48 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                  <p className="mb-1 font-semibold">{row.deviceType}</p>
                  <div className="flex justify-between gap-2"><span>Opt-in</span><span>{fmtN(row.optIn)} · {fmtPct(row.consentRate)}</span></div>
                  <div className="flex justify-between gap-2"><span>Opt-out</span><span>{fmtN(row.optOut)} · {fmtPct(1 - row.consentRate)}</span></div>
                  <div className="flex justify-between gap-2"><span>Share</span><span>{fmtPct(row.shareOfTotal)}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

type DisplayMode = "pct" | "abs";

function ModeToggle({ mode, onChange }: { mode: DisplayMode; onChange: (m: DisplayMode) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-line p-0.5">
      {(["pct", "abs"] as DisplayMode[]).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${mode === m ? "bg-accent text-white" : "text-muted hover:text-on-surface"}`}>
          {m === "pct" ? "%" : "#"}
        </button>
      ))}
    </div>
  );
}

// ── Opt-in by period ──────────────────────────────────────────────────────────

const GRAN_LABELS: Record<Granularity, string> = {
  day: "Last 30 days", week: "Last 12 weeks", month: "Last 12 months",
};

type BarTooltip = { x: number; y: number; label: string; firstConsent: number; reexposed: number; total: number; pctFirst: string; pctReex: string };

function OptInByPeriod({ data, granularity, onGranularity }: {
  data: ConsentOverviewResult["byPeriod"]; granularity: Granularity;
  onGranularity: (g: Granularity) => void;
}) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [tooltip, setTooltip] = useState<BarTooltip | null>(null);

  // Dimensions SVG
  const BAR_W   = granularity === "month" ? 44 : granularity === "week" ? 40 : 32;
  const PAD_L   = 30;    // marge gauche pour que la première étiquette -45° ne soit pas coupée
  const CHART_H = 180;
  const LABEL_H = 50;    // espace pour labels à -45°
  const SVG_H   = CHART_H + LABEL_H;
  const SVG_W   = PAD_L + Math.max(data.length * BAR_W, 100);
  const maxVal  = Math.max(...data.map((r) => r.firstConsent + r.reexposed), 1);

  const showEvery = 1; // tous les labels, rotation gère le chevauchement

  // Scroll tout à droite après chargement
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);

  function handleBarHover(e: React.MouseEvent, row: ConsentOverviewResult["byPeriod"][number], label: string) {
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const total    = row.firstConsent + row.reexposed;
    const pctFirst = total > 0 ? fmtPct(row.firstConsent / total) : "—";
    const pctReex  = total > 0 ? fmtPct(row.reexposed    / total) : "—";
    // Position relative au bloc section
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTooltip({ x, y, label, firstConsent: row.firstConsent, reexposed: row.reexposed, total, pctFirst, pctReex });
  }

  return (
    <section ref={sectionRef} aria-label="Opt-in by period"
      className="relative rounded-2xl border border-line bg-surface p-5 shadow-panel"
      onMouseLeave={() => setTooltip(null)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Opt-in by period</h3>
        <div className="flex gap-1 rounded-lg border border-line p-1">
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <button key={g} type="button" onClick={() => onGranularity(g)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${granularity === g ? "bg-accent text-white" : "text-muted hover:text-on-surface"}`}>
              {g === "day" ? "Day" : g === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-green-700" />1st consent</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-green-400" />Reexposed</span>
      </p>

      {/* Conteneur scrollable — tout dans un SVG pour axe X propre */}
      <div ref={scrollRef} className="overflow-x-auto">
        <svg width={SVG_W} height={SVG_H} role="img" aria-label={`Opt-in — ${GRAN_LABELS[granularity]}`}>
          {data.map((row, i) => {
            const total  = row.firstConsent + row.reexposed;
            const barH   = Math.round((total / maxVal) * CHART_H);
            const firstH = total > 0 ? Math.round((row.firstConsent / total) * barH) : 0;
            const reexH  = barH - firstH;
            const cx     = PAD_L + i * BAR_W + BAR_W / 2;
            const label  = fmtPeriodLabel(row.period, granularity);
            const showLabel = i % showEvery === 0 || i === data.length - 1;
            const barX   = PAD_L + i * BAR_W + 2;
            const barW   = BAR_W - 4;

            return (
              <g key={row.period}
                onMouseEnter={(e) => handleBarHover(e, row, label)}
                onMouseMove={(e)  => handleBarHover(e, row, label)}
                style={{ cursor: "default" }}>
                {/* Segment reexposed (vert clair, en haut) */}
                <rect x={barX} y={CHART_H - barH} width={barW} height={reexH} fill="#4ade80" rx={2} ry={2} />
                {/* Segment 1st consent (vert foncé, en bas) */}
                <rect x={barX} y={CHART_H - firstH} width={barW} height={firstH} fill="#15803d" />
                {/* Étiquette axe X — rotation -45° ancrée sous le centre de la barre */}
                {showLabel && (
                  <text
                    x={cx} y={CHART_H + 10}
                    textAnchor="end"
                    fontSize={10}
                    fill="currentColor"
                    fillOpacity={0.6}
                    transform={`rotate(-45, ${cx}, ${CHART_H + 10})`}>
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Infobulle positionnée dans le référentiel du bloc section */}
      {tooltip && (
        <div className="pointer-events-none absolute z-30 w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 80, transform: "translateY(-50%)" }}>
          <p className="mb-1 font-semibold">{tooltip.label}</p>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 shrink-0 rounded-sm bg-green-700" />
            <span className="flex-1">1st consent</span>
            <span className="tabular-nums">{fmtN(tooltip.firstConsent)}</span>
            <span className="text-white/60">({tooltip.pctFirst})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 shrink-0 rounded-sm" style={{ background: "#4ade80" }} />
            <span className="flex-1">Reexposed</span>
            <span className="tabular-nums">{fmtN(tooltip.reexposed)}</span>
            <span className="text-white/60">({tooltip.pctReex})</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-white/20 pt-1 font-semibold">
            <span>Total</span><span className="tabular-nums">{fmtN(tooltip.total)}</span>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Opt-in rate evolution ─────────────────────────────────────────────────────

const DEFAULT_WINDOW_DAYS = 30;
const MIN_WINDOW_DAYS = 7;
const ZOOM_CANDIDATE_DAYS = [180, 90, 60, 30, 14, 7] as const;

/** Largeurs de fenêtre possibles, de la vue complète (zoom arrière) à 7 jours (zoom avant). */
function zoomSteps(total: number): number[] {
  const steps = new Set<number>([total]);
  for (const d of ZOOM_CANDIDATE_DAYS) if (d < total && d >= MIN_WINDOW_DAYS) steps.add(d);
  return [...steps].sort((a, b) => b - a);
}

function OptInRateEvolution({ data }: { data: ConsentOverviewResult["rateEvolution"] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ svgX: number; svgY: number; day: string; rate: number } | null>(null);
  const total = data.length;
  const steps = zoomSteps(total);
  const defaultIdx = (() => {
    const i = steps.indexOf(DEFAULT_WINDOW_DAYS);
    return i >= 0 ? i : steps.findIndex((d) => d <= DEFAULT_WINDOW_DAYS);
  })();
  const [zoomIdx, setZoomIdx] = useState(-1); // -1 = défaut
  const activeIdx = zoomIdx < 0 ? Math.max(defaultIdx, 0) : Math.min(zoomIdx, steps.length - 1);
  const windowDays = steps[activeIdx] ?? total;

  // Scroll à droite après chargement ou changement de zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data, activeIdx]);

  if (data.length === 0) return null;

  const rates = data.map((r) => r.consentRate);
  const minR  = Math.min(...rates), maxR = Math.max(...rates);
  const pad   = (maxR - minR) * 0.15 || 0.02;
  const yMin  = Math.max(0, minR - pad), yMax = Math.min(1, maxR + pad);
  const yRange = yMax - yMin || 0.01;

  // SVG en pixels réels — largeur calculée pour remplir le bloc (min 4px/pt)
  // L'axe Y fait Y_AXIS_W px — la courbe occupe le reste
  const H = 220;
  const PAD = { top: 16, right: 20, bottom: 36, left: 52 };
  // On vise une largeur totale courbe ≥ conteneur visible.
  // On utilise 4px/pt comme minimum ; le SVG s'adapte via width="100%"
  // Une fenêtre de `windowDays` jours occupe 800 px : on en déduit la largeur par point
  const PX_PER_PT = Math.max(1, 800 / Math.max(windowDays, 1));
  const toY = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * (H - PAD.top - PAD.bottom);
  const yTicks   = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * yRange);

  // Étiquettes X : 1 tous les 10 points environ, ancre adaptée bords
  const labelStep = Math.max(1, Math.round(data.length / 10));
  const xIndices  = data
    .map((_, i) => i)
    .filter((i) => i % labelStep === 0 || i === data.length - 1);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pxX  = e.clientX - rect.left; // pas de PAD.left dans ce SVG
    const i    = Math.max(0, Math.min(data.length - 1, Math.round(pxX / PX_PER_PT)));
    const row  = data[i];
    if (row) setTooltip({ svgX: i * PX_PER_PT, svgY: toY(row.consentRate), day: row.day, rate: row.consentRate });
  }

  // Largeur de l'axe Y (fixe, toujours visible)
  const Y_AXIS_W = PAD.left;
  // Largeur du SVG courbe (sans axe Y)
  const CURVE_W  = data.length * PX_PER_PT + PAD.right;

  // Coordonnée X dans le SVG courbe (sans PAD.left)
  const toCurveX = (i: number) => i * PX_PER_PT;

  const curvePath = data
    .map((r, i) => `${i === 0 ? "M" : "L"}${toCurveX(i).toFixed(1)},${toY(r.consentRate).toFixed(1)}`)
    .join(" ");

  return (
    <section aria-label="Opt-in Rate Evolution" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Opt-in rate evolution</h3>
        <div className="flex items-center gap-1 rounded-lg border border-line p-0.5" role="group" aria-label="Zoom temporel">
          <button type="button" aria-label="Zoom arrière (vue plus large)"
            onClick={() => setZoomIdx(Math.max(0, activeIdx - 1))}
            disabled={activeIdx === 0}
            className="rounded-md p-1.5 text-muted hover:text-on-surface disabled:opacity-30">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M8 11h6" strokeLinecap="round" />
            </svg>
          </button>
          <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted">{windowDays} j</span>
          <button type="button" aria-label="Zoom avant (vue plus détaillée)"
            onClick={() => setZoomIdx(Math.min(steps.length - 1, activeIdx + 1))}
            disabled={activeIdx === steps.length - 1}
            className="rounded-md p-1.5 text-muted hover:text-on-surface disabled:opacity-30">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" aria-label="Revenir à la vue par défaut (30 derniers jours)"
            onClick={() => setZoomIdx(-1)}
            disabled={activeIdx === defaultIdx}
            className="rounded-md p-1.5 text-muted hover:text-on-surface disabled:opacity-30">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M3 12a9 9 0 109-9 9.4 9.4 0 00-6.4 2.5L3 8" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conteneur : axe Y fixe à gauche + zone scrollable à droite */}
      <div className="flex" style={{ height: `${H}px` }}>

        {/* Axe Y — fixe, non scrollable */}
        <svg width={Y_AXIS_W} height={H} className="shrink-0" aria-hidden="true">
          {yTicks.map((v) => (
            <g key={v}>
              {/* Ligne horizontale de grille — dépasse dans la zone courbe via overflow visible */}
              <text x={Y_AXIS_W - 6} y={toY(v) + 4} textAnchor="end" fontSize={12}
                fill="currentColor" fillOpacity={0.6}>{fmtPct(v, 0)}</text>
            </g>
          ))}
        </svg>

        {/* Zone scrollable — courbe + axe X + grille. Si CURVE_W < espace dispo : s'étire */}
        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto">
          <svg width={Math.max(CURVE_W, 100)} height={H} style={{ minWidth: `${CURVE_W}px`, width: "100%" }}
            role="img" aria-label="Opt-in rate evolution"
            onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>

            {/* Grille Y (lignes horizontales seulement, labels dans le SVG fixe) */}
            {yTicks.map((v) => (
              <line key={v} x1={0} y1={toY(v)} x2={CURVE_W} y2={toY(v)}
                stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
            ))}

            {/* Étiquettes X */}
            {xIndices.map((i) => {
              const row    = data[i]; if (!row) return null;
              const x      = toCurveX(i);
              const anchor = i === data.length - 1 ? "end" : i === 0 ? "start" : "middle";
              return (
                <text key={i} x={x} y={H - 6} textAnchor={anchor} fontSize={11}
                  fill="currentColor" fillOpacity={0.6}>
                  {fmtDate(row.day)}
                </text>
              );
            })}

            {/* Courbe */}
            <path d={curvePath} fill="none" stroke="#16a34a" strokeWidth={1.5} />
            {tooltip && (
              <circle cx={toCurveX(data.findIndex((r) => r.day === tooltip.day))}
                cy={tooltip.svgY} r={4} fill="#16a34a" stroke="white" strokeWidth={1.5} />
            )}

            {/* Zone de capture souris */}
            <rect x={0} y={PAD.top} width={CURVE_W} height={H - PAD.top - PAD.bottom}
              fill="transparent" />
          </svg>

          {/* Infobulle */}
          {tooltip && (
            <div className="pointer-events-none absolute z-10 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl"
              style={{ left: toCurveX(data.findIndex((r) => r.day === tooltip.day)) + 10, top: tooltip.svgY - 50 }}>
              <p className="font-semibold">{fmtDate(tooltip.day)}</p>
              <p>Consent rate: <span className="font-bold">{fmtPct(tooltip.rate)}</span></p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Consent by member ─────────────────────────────────────────────────────────

type MemberSort = "alpha" | "optin";

function ConsentByMember({ data }: { data: ConsentOverviewResult["byMember"] }) {
  const [mode, setMode] = useState<DisplayMode>("pct");
  const [sort, setSort] = useState<MemberSort>("optin");
  const maxOptIn = Math.max(...data.map((r) => r.optIn), 1);

  // Tri côté client sur les données déjà reçues (pas de nouvelle requête)
  // Tri : taux d'opt-in en mode %, volume d'opt-in en mode #
  const rows = [...data].sort((a, b) =>
    sort === "alpha"
      ? a.member.localeCompare(b.member)
      : mode === "pct" ? b.consentRate - a.consentRate : b.optIn - a.optIn,
  );

  return (
    <section aria-label="Consent by member" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Consent by member</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-line p-0.5" role="group" aria-label="Tri">
            {([["optin", "Opt-in ↓"], ["alpha", "A–Z"]] as const).map(([key, text]) => (
              <button key={key} type="button" onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${sort === key ? "bg-accent text-white" : "text-muted hover:text-on-surface"}`}>
                {text}
              </button>
            ))}
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      {/* En-tête colonnes */}
      <div className="mb-1 flex items-center gap-3 pt-2">
        <span className="w-8 shrink-0" />
        <span className="flex-1" /> {/* zone barre — pas de label "Opt-in" */}
        <span className="w-16 shrink-0 text-right text-[10px] font-semibold text-muted">
          {mode === "pct" ? "% opt-in" : "# opt-in"}
        </span>
      </div>

      <div className="space-y-1.5">
        {rows.map((row) => {
          const optInW  = mode === "pct" ? row.optIn  / (row.total || 1) : row.optIn  / maxOptIn;
          const customW = mode === "pct" ? row.custom / (row.total || 1) : row.custom / maxOptIn;
          const optOutW = mode === "pct" ? row.optOut / (row.total || 1) : row.optOut / maxOptIn;
          const label   = mode === "pct" ? fmtPct(row.consentRate) : fmtN(row.optIn);
          return (
            <div key={row.member} className="group relative flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs font-semibold">{row.member}</span>
              <div className="flex h-5 min-w-0 flex-1 overflow-hidden rounded">
                <div className="shrink-0 bg-green-600 transition-all" style={{ width: `${(optInW  * 100).toFixed(2)}%` }} />
                {customW > 0.001 && <div className="shrink-0 bg-amber-500 transition-all" style={{ width: `${(customW * 100).toFixed(2)}%` }} />}
                <div className="shrink-0 bg-red-500 transition-all"   style={{ width: `${(optOutW * 100).toFixed(2)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums font-medium">{label}</span>
              {/* Infobulle */}
              <div className="pointer-events-none absolute left-10 top-full z-10 mt-1 hidden w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                <p className="mb-1 font-semibold">{row.member}</p>
                <div className="flex justify-between gap-3"><span>Opt-in</span><span>{fmtN(row.optIn)} · {fmtPct(row.consentRate)}</span></div>
                <div className="flex justify-between gap-3"><span>Opt-out</span><span>{fmtN(row.optOut)} · {fmtPct(row.optOut / (row.total || 1))}</span></div>
                {row.custom > 0 && <div className="flex justify-between gap-3"><span>Custom</span><span>{fmtN(row.custom)} · {fmtPct(row.custom / (row.total || 1))}</span></div>}
                <div className="mt-1 flex justify-between border-t border-white/20 pt-1 font-semibold"><span>Total</span><span>{fmtN(row.total)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-green-600" />Opt-in</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-red-500" />Opt-out</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-amber-500" />Custom</span>
      </div>
    </section>
  );
}

// ── Opt-in rate by page type ──────────────────────────────────────────────────

function ConsentByPageType({ data }: { data: ConsentOverviewResult["byPageType"] }) {
  const [mode, setMode] = useState<DisplayMode>("pct");
  const [sort, setSort] = useState<MemberSort>("optin");
  const maxOptIn = Math.max(...data.map((r) => r.optIn), 1);

  // Tri : taux d'opt-in en mode %, volume d'opt-in en mode #, ou alphabétique sur le type de page
  const rows = [...data].sort((a, b) =>
    sort === "alpha"
      ? a.pageType.localeCompare(b.pageType)
      : mode === "pct" ? b.consentRate - a.consentRate : b.optIn - a.optIn,
  );

  return (
    <section aria-label="Opt-in rate by page type" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Opt-in rate by page type</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-line p-0.5" role="group" aria-label="Tri">
            {([["optin", "Opt-in ↓"], ["alpha", "A–Z"]] as const).map(([key, text]) => (
              <button key={key} type="button" onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${sort === key ? "bg-accent text-white" : "text-muted hover:text-on-surface"}`}>
                {text}
              </button>
            ))}
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const optInW  = mode === "pct" ? row.consentRate     : row.optIn  / maxOptIn;
          const optOutW = mode === "pct" ? 1 - row.consentRate : row.optOut / maxOptIn;
          const label   = mode === "pct" ? fmtPct(row.consentRate) : fmtN(row.optIn);
          return (
            <div key={row.pageType} className="group relative flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm" title={row.pageType}>{row.pageType}</span>
              <div className="flex h-5 min-w-0 flex-1 overflow-hidden rounded">
                <div className="shrink-0 bg-green-600 transition-all" style={{ width: `${(optInW  * 100).toFixed(1)}%` }} />
                <div className="shrink-0 bg-red-500 transition-all"   style={{ width: `${(optOutW * 100).toFixed(1)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums font-medium">{label}</span>
              <div className="pointer-events-none absolute left-40 top-full z-10 mt-1 hidden w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                <p className="mb-1 font-semibold">{row.pageType}</p>
                <div className="flex justify-between gap-3"><span>Opt-in</span><span>{fmtN(row.optIn)} · {fmtPct(row.consentRate)}</span></div>
                <div className="flex justify-between gap-3"><span>Opt-out</span><span>{fmtN(row.optOut)} · {fmtPct(row.optOut / (row.total || 1))}</span></div>
                <div className="mt-1 flex justify-between border-t border-white/20 pt-1 font-semibold"><span>Total</span><span>{fmtN(row.total)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

type State =
  | { status: "initial" }
  | { status: "success"; result: ConsentOverviewResult }
  | { status: "error"; message: string; requestId?: string };

const DEFAULT_FILTERS: FilterParams = { granularity: "month" };

function Spinner() {
  return (
    /* fixed = centré dans le viewport, indépendant du scroll de la page */
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
      <svg className="h-12 w-12 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-label="Loading">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}

export function ConsentOverviewCard() {
  const [filters, setFilters]       = useState<FilterParams>(DEFAULT_FILTERS);
  const [state, setState]           = useState<State>({ status: "initial" });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback((f: FilterParams) => {
    // Si on a déjà des données : garder l'affichage et montrer un spinner overlay
    setIsRefreshing(true);
    const params = new URLSearchParams();
    if (f.members     && f.members.length     > 0) params.set("members",     JSON.stringify(f.members));
    if (f.deviceTypes && f.deviceTypes.length > 0) params.set("deviceTypes", JSON.stringify(f.deviceTypes));
    if (f.startDate)   params.set("startDate",   f.startDate);
    if (f.endDate)     params.set("endDate",     f.endDate);
    if (f.granularity) params.set("granularity", f.granularity);

    fetch(`/api/consent-overview?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const payload: unknown = await res.json();
        if (!res.ok) {
          const err = payload as { error?: { message?: string; requestId?: string } };
          setState({ status: "error", message: err.error?.message ?? "Data unavailable.", requestId: err.error?.requestId });
        } else {
          setState({ status: "success", result: consentOverviewSchema.parse(payload) });
        }
      })
      .catch(() => setState({ status: "error", message: "Invalid server response." }))
      .finally(() => setIsRefreshing(false));
  }, []);

  useEffect(() => { load(filters); }, [load, filters]);

  // Granularité = effet immédiat (pas de requête SQL lourde, juste le rendu change)
  // Pour le bar chart period : il re-fetch car granularity est dans les params SQL
  const handleGranularity = (g: Granularity) => setFilters((f) => ({ ...f, granularity: g }));

  // Apply : remplace les filtres appliqués → déclenche le fetch
  const handleApply = (f: FilterParams) => setFilters(f);

  const result           = state.status === "success" ? state.result : null;
  const availableMembers = result?.filters.availableMembers    ?? [];
  const availableDevices = result?.filters.availableDeviceTypes ?? [];
  const granularity      = result?.filters.granularity ?? (filters.granularity ?? "month");
  const lastEventAt      = result?.kpi.lastEventAt ?? null;

  const isInitialLoad = state.status === "initial" && isRefreshing;

  return (
    <div className="min-h-screen space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold">ConsentMax Analytics</h1>
          {lastEventAt && (
            <span className="text-xs text-muted">
              last event: <span className="font-medium text-on-surface">{fmtDateTime(lastEventAt)}</span>
            </span>
          )}
          {result?.status === "demo" && (
            <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-800">Demo mode</span>
          )}
        </div>
        <FilterBar
          appliedFilters={filters}
          availableMembers={availableMembers}
          availableDeviceTypes={availableDevices}
          onApply={handleApply}
        />
      </div>

      {/* Chargement initial (aucune donnée encore) */}
      {isInitialLoad && <LoadingState label="Loading dashboard…" />}
      {state.status === "error" && <ErrorState title="Data unavailable" message={state.message} requestId={state.requestId} />}

      {result && (
        <div className="space-y-5">
          {isRefreshing && <Spinner />}

          {/* Row 1 : KPI fusionné + Consent by device */}
          <KpiHeader kpi={result.kpi} deviceData={result.byDevice} />

          {/* Row 2 : Opt-in by period + Opt-in rate evolution côte à côte, hauteur fixée */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2" style={{ minHeight: "320px" }}>
            <OptInByPeriod data={result.byPeriod} granularity={granularity} onGranularity={handleGranularity} />
            <OptInRateEvolution data={result.rateEvolution} />
          </div>

          {/* Row 3 : Consent by member pleine largeur */}
          <ConsentByMember data={result.byMember} />

          {/* Row 4 : Opt-in rate by page type pleine largeur */}
          <ConsentByPageType data={result.byPageType} />
        </div>
      )}
    </div>
  );
}
