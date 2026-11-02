"use client";

import { useEffect, useRef, useState } from "react";

import { MatrixHelp, MemberHelp } from "@/features/alliance-contribution/alliance-help";

import {
  allianceContributionSchema,
  type AllianceContribution,
  type MemberRow,
} from "@/features/alliance-contribution/contract";

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000)     return `${(n / 1_000).toLocaleString("fr-FR",     { maximumFractionDigits: 1 })} k`;
  return n.toLocaleString("fr-FR");
}

/** Matrice : M avec 1 décimale, k sans décimale. */
function fmtCell(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000)     return `${(n / 1_000).toLocaleString("fr-FR",     { maximumFractionDigits: 0 })} k`;
  return n.toLocaleString("fr-FR");
}

/** Part d'une composante dans self + alliance, en % (0 décimale). */
function fmtPctShare(v: number): string {
  return `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
}

function fmtX(v: number | null): string {
  return v === null ? "—" : `x${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function fmtPctRaw(v: number | null): string {
  return v === null ? "—" : `+${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
}

/** Barre horizontale empilée : self (vert foncé) puis alliance (vert clair), même échelle pour toutes les lignes. */
function barShares(row: MemberRow) {
  const part = row.self + row.alliance;
  return {
    selfPct: part > 0 ? fmtPctShare(row.self / part) : "—",
    allPct:  part > 0 ? fmtPctShare(row.alliance / part) : "—",
  };
}

function CollectorBar({ row, max, onHover, onLeave }: {
  row: MemberRow; max: number;
  onHover: (e: React.MouseEvent<SVGSVGElement>) => void;
  onLeave: () => void;
}) {
  const w = 220;
  const selfW = (row.self / max) * w;
  const allW  = (row.alliance / max) * w;
  return (
    <svg width={w} height={14} role="img" aria-label={`${row.member} self and alliance`} className="block"
      onMouseMove={onHover} onMouseLeave={onLeave}>
      <rect x={0} y={0} width={selfW} height={14} fill="#15803d" />
      <rect x={selfW} y={0} width={allW} height={14} fill="#4ade80" />
    </svg>
  );
}

type SortKey = "member" | "self" | "alliance" | "total" | "allianceShare" | "boosterRatio";

function sortValue(row: MemberRow, key: Exclude<SortKey, "member">): number | null {
  switch (key) {
    case "self": return row.self;
    case "alliance": return row.alliance;
    case "total": return row.total;
    case "allianceShare": return row.allianceShare;
    case "boosterRatio": return row.boosterRatio;
  }
}

type State =
  | { status: "loading" }
  | { status: "success"; result: AllianceContribution }
  | { status: "error"; message: string };

export function AllianceContributionCard() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [barTip, setBarTip] = useState<{ row: MemberRow; x: number; y: number } | null>(null);
  const memberRef = useRef<HTMLElement>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "self", dir: "desc" });

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "member" ? "asc" : "desc" }));
  }

  useEffect(() => {
    fetch("/api/alliance-contribution", { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          setState({ status: "error", message: payload.error?.message ?? "Data unavailable." });
          return;
        }
        setState({ status: "success", result: allianceContributionSchema.parse(payload) });
      })
      .catch(() => setState({ status: "error", message: "Invalid server response." }));
  }, []);

  if (state.status === "loading") return <p className="p-5 text-sm text-muted">Loading…</p>;
  if (state.status === "error") return <p className="p-5 text-sm text-red-600">{state.message}</p>;

  const { members, matrix, byMember } = state.result;
  const cellValue = (c: string, r: string) => matrix.find((m) => m.collector === c && m.recipient === r)?.optIn ?? 0;
  const maxCell = Math.max(...matrix.map((m) => m.optIn), 1);
  const colTotal = (r: string) => matrix.filter((m) => m.recipient === r).reduce((a, m) => a + m.optIn, 0);
  const isDim = (name: string) => highlighted !== null && highlighted !== name;

  function toggle(name: string) {
    setHighlighted((h) => (h === name ? null : name));
  }

  // Échelle commune des barres : plus grand self + alliance, identique pour toutes les lignes.
  const maxBar = Math.max(...byMember.map((b) => b.self + b.alliance), 1);

  const sortedRows: MemberRow[] = [...byMember].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "member") return dir * a.member.localeCompare(b.member);
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    // null (booster ou % sans self) toujours en fin de liste
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return dir * (va - vb);
  });

  function showBarTip(e: React.MouseEvent<SVGSVGElement>, row: MemberRow) {
    const box = memberRef.current?.getBoundingClientRect();
    if (!box) return;
    setBarTip({ row, x: e.clientX - box.left, y: e.clientY - box.top });
  }

  function sortHeader(key: SortKey, label: string, align: "left" | "right") {
    const active = sort.key === key;
    const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
    return (
      <th className={`p-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
        <button type="button" onClick={() => sortBy(key)} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
          className={`${active ? "text-ink" : ""} hover:text-ink`}>{label}{arrow}</button>
      </th>
    );
  }

  return (
    <div className="space-y-5">
      <section aria-label="Alliance contribution matrix" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Opt-in — collectors × recipients</h3>
        <MatrixHelp />
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0 text-xs tabular-nums">
            <thead>
              <tr>
                <th className="sticky left-0 bg-surface p-1.5 text-left font-medium text-muted">Collector ↓ / Recipient →</th>
                {members.map((r) => (
                  <th key={r} className={`p-1.5 font-semibold ${isDim(r) ? "opacity-40" : ""} ${highlighted === r ? "text-accent" : ""}`}>
                    <button type="button" onClick={() => toggle(r)} aria-pressed={highlighted === r}>{r}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((c) => (
                <tr key={c}>
                  <th className={`sticky left-0 bg-surface p-1.5 text-left font-semibold ${isDim(c) ? "opacity-40" : ""} ${highlighted === c ? "text-accent" : ""}`}>
                    <button type="button" onClick={() => toggle(c)} aria-pressed={highlighted === c}>{c}</button>
                  </th>
                  {members.map((r) => {
                    const v = cellValue(c, r);
                    const dim = highlighted !== null && highlighted !== c && highlighted !== r;
                    return (
                      <td key={r} className={`p-1.5 text-right ${dim ? "opacity-30" : ""}`}
                        style={{ background: v > 0 ? `rgba(21, 128, 61, ${0.08 + 0.6 * (v / maxCell)})` : undefined }}>
                        {v > 0 ? fmtCell(v) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="font-semibold">
                <th className="sticky left-0 bg-surface p-1.5 text-left">Total</th>
                {members.map((r) => (
                  <td key={r} className={`p-1.5 text-right ${isDim(r) ? "opacity-40" : ""}`}>{fmtCell(colTotal(r))}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section ref={memberRef} aria-label="Alliance contribution by member" className="relative rounded-2xl border border-line bg-surface p-5 shadow-panel">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Opt-in — self consent and alliance contribution</h3>
        <MemberHelp />
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-muted">
                {sortHeader("member", "Member", "left")}
                {sortHeader("self", "# self opt-in", "right")}
                {sortHeader("alliance", "# alliance opt-in", "right")}
                {sortHeader("total", "# total opt-in", "right")}
                {sortHeader("allianceShare", "% booster alliance", "right")}
                {sortHeader("boosterRatio", "booster", "right")}
                <th className="p-2 pl-6 text-left font-medium text-muted">
                  <span className="flex items-center gap-3 whitespace-nowrap text-xs font-normal">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm bg-[#15803d]" />Self</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm bg-[#4ade80]" />Alliance</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.member} className={`border-t border-line ${isDim(row.member) ? "opacity-40" : ""} ${highlighted === row.member ? "bg-accent/10" : ""}`}>
                  <td className="p-2">
                    <button type="button" onClick={() => toggle(row.member)} aria-pressed={highlighted === row.member}
                      className="font-semibold">{row.member}</button>
                  </td>
                  <td className="p-2 text-right">{fmtN(row.self)}</td>
                  <td className="p-2 text-right">{fmtN(row.alliance)}</td>
                  <td className="p-2 text-right">{fmtN(row.total)}</td>
                  <td className="p-2 text-right">{fmtPctRaw(row.allianceShare)}</td>
                  <td className="p-2 text-right">{fmtX(row.boosterRatio)}</td>
                  <td className="p-2 pl-6"><CollectorBar row={row} max={maxBar} onHover={(e) => showBarTip(e, row)} onLeave={() => setBarTip(null)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {barTip && (() => {
          const { selfPct, allPct } = barShares(barTip.row);
          const flip = barTip.x > (memberRef.current?.clientWidth ?? 0) - 240;
          return (
            <div className="pointer-events-none absolute z-30 w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl"
              style={{ top: barTip.y + 12, ...(flip ? { left: barTip.x - 236 } : { left: barTip.x + 12 }) }}>
              <p className="font-semibold">{barTip.row.member}</p>
              <p className="mt-1.5 flex justify-between gap-4"><span>Self</span><span className="tabular-nums">{fmtN(barTip.row.self)} ({selfPct})</span></p>
              <p className="flex justify-between gap-4"><span>Alliance</span><span className="tabular-nums">{fmtN(barTip.row.alliance)} ({allPct})</span></p>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
