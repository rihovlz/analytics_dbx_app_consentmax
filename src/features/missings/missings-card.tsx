"use client";

import { useEffect, useState } from "react";

import { HelpBox } from "@/features/alliance-contribution/alliance-help";
import { missingsSchema, type Missings, type MissingRow } from "@/features/missings/contract";

type Lang = "fr" | "en";

const UI: Record<Lang, {
  loading: string; unavailable: string; invalid: string;
  summary: string; table: string; avgLabel: string; evolution: string;
  scaleHint: string; empty: string;
  tip: { self: string; missing: string; pct: string; change: string };
}> = {
  fr: {
    loading: "Chargement…", unavailable: "Données indisponibles.", invalid: "Réponse du serveur invalide.",
    summary: "Synthèse", table: "Contacts manquants", avgLabel: "avg % missing opt-in self",
    evolution: "% missing opt-in evolution", scaleHint: "", empty: "—",
    tip: {
      self: "nombre d'emails ayant consenti (opt-in) collectés par l'enseigne",
      missing: "nombre de ces emails absents de la base contact fournie par l'enseigne à VLZ",
      pct: "# missing opt-in ÷ # self opt-in",
      change: "% missing opt-in self du dernier jour − % missing opt-in self N jours avant, en points de pourcentage",
    },
  },
  en: {
    loading: "Loading…", unavailable: "Data unavailable.", invalid: "Invalid server response.",
    summary: "Summary", table: "Missing contacts", avgLabel: "avg % missing opt-in self",
    evolution: "% missing opt-in evolution", scaleHint: "", empty: "—",
    tip: {
      self: "number of emails that consented (opt-in) collected by the member",
      missing: "number of these emails missing from the contact base the member provided to VLZ",
      pct: "# missing opt-in ÷ # self opt-in",
      change: "% missing opt-in self on the last day − % missing opt-in self N days earlier, in percentage points",
    },
  },
};

type State =
  | { status: "loading" }
  | { status: "success"; result: Missings }
  | { status: "error"; message: string };

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000)     return `${(n / 1_000).toLocaleString("fr-FR",     { maximumFractionDigits: 1 })} k`;
  return n.toLocaleString("fr-FR");
}

function fmtPct(v: number | null, digits = 0): string {
  return v === null ? "—" : `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`;
}

const HELP: Record<"fr" | "en", React.ReactNode> = {
  fr: (
    <ul className="space-y-1.5">
      <li><b>member</b> : enseigne qui a collecté les opt-in.</li>
      <li><b># self opt-in</b> : nombre d'emails ayant consenti (opt-in) collectés par l'enseigne.</li>
      <li><b># missing opt-in</b> : nombre de ces emails absents de la base contact fournie par l'enseigne à VLZ.</li>
      <li><b>% missing opt-in self</b> : part des # self opt-in absents de la base contact de l'enseigne.</li>
      <li><b>change 30 d</b> : variation de % missing opt-in self sur 30 jours, en points de pourcentage (taux d'aujourd'hui − taux il y a 30 jours). Vide si l'historique est trop court.</li>
      <li><b>change 60 d</b> : variation de % missing opt-in self sur 60 jours, en points de pourcentage (taux d'aujourd'hui − taux il y a 60 jours). Vide si l'historique est trop court.</li>
      <li><b>change 90 d</b> : variation de % missing opt-in self sur 90 jours, en points de pourcentage (taux d'aujourd'hui − taux il y a 90 jours). Vide si l'historique est trop court.</li>
      <li><b>avg % missing opt-in self</b> (indicateur en haut du tableau) : part globale des # self opt-in absents, toutes enseignes confondues (hors VLZ).</li>
    </ul>
  ),
  en: (
    <ul className="space-y-1.5">
      <li><b>member</b>: member that collected the opt-ins.</li>
      <li><b># self opt-in</b>: number of emails that consented (opt-in) collected by the member.</li>
      <li><b># missing opt-in</b>: number of these emails missing from the contact base the member provided to VLZ.</li>
      <li><b>% missing opt-in self</b>: share of the # self opt-in missing from the member's contact base.</li>
      <li><b>change 30 d</b>: change in % missing opt-in self over 30 days, in percentage points (today's rate minus the rate 30 days ago). Empty if history is too short.</li>
      <li><b>change 60 d</b>: change in % missing opt-in self over 60 days, in percentage points (today's rate minus the rate 60 days ago). Empty if history is too short.</li>
      <li><b>change 90 d</b>: change in % missing opt-in self over 90 days, in percentage points (today's rate minus the rate 90 days ago). Empty if history is too short.</li>
      <li><b>avg % missing opt-in self</b> (indicator above the table): overall share of the # self opt-in missing, all members combined (excluding VLZ).</li>
    </ul>
  ),
};

const SUMMARY: Record<"fr" | "en", React.ReactNode> = {
  fr: (
    <div className="space-y-2">
      <p>Les enseignes transmettent quotidiennement à Valiuz une base de leurs contacts. Selon les enseignes, la couverture des contacts fournis varie. Certaines enseignes appliquent des filtres au moment de l'export vers Valiuz.</p>
      <p>Un contact opt-in ConsentMax mais absent de la base contact chez Valiuz ne peut faire l'objet d'aucun traitement au niveau de l'alliance (scoring, profiling, activation media...).</p>
      <p>Il existe 2 cas de figure associés à la collecte de l'opt-in d'un contact C par l'enseigne A qui pénalisent l'enseigne et/ou l'alliance :</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>C est absent de la base fournie par A. Conséquence : ce contact ne peut être utilisé au bénéfice de A.</li>
        <li>C existe dans la base contact de l'enseigne B, mais B ne le fournit pas à Valiuz. Conséquence : la connaissance client issue des achats et navigations au sein de B ne peut être exploitée et donc ne bénéficie à aucune enseigne de l'alliance (perte de signaux pour des scores cross-enseigne : socio-démo, moments de vie...).</li>
      </ul>
    </div>
  ),
  en: (
    <div className="space-y-2">
      <p>Members send Valiuz a contact base every day. Coverage varies by member, and some members apply filters when exporting to Valiuz.</p>
      <p>A ConsentMax opt-in contact who is missing from the contact base at Valiuz cannot be used for any processing at alliance level (scoring, profiling, media activation...).</p>
      <p>Two cases penalise the member and/or the alliance when member A collects an opt-in from contact C:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>C is missing from the base provided by A. Consequence: this contact cannot be used for A's benefit.</li>
        <li>C exists in member B's contact base, but B does not provide it to Valiuz. Consequence: the customer knowledge from purchases and browsing at B cannot be exploited and therefore benefits no member of the alliance (loss of signals for cross-member scores: socio-demographics, life moments...).</li>
      </ul>
    </div>
  ),
};

const COLUMN_TIPS = {
  self: { label: "# self opt-in", formula: "nombre d'emails ayant consenti (opt-in) collectés par l'enseigne" },
  unknown: { label: "# missing opt-in", formula: "nombre de ces emails absents de la base contact fournie par l'enseigne à VLZ" },
  unknownPct: { label: "% missing opt-in self", formula: "# missing opt-in ÷ # self opt-in" },
  evolution: { label: "change 30 d / 60 d / 90 d", formula: "% missing opt-in self du dernier jour − % missing opt-in self N jours avant, en points de pourcentage" },
};

type SortKey = "member" | "self" | "unknown" | "unknownPctSelf" | "evolution30" | "evolution60" | "evolution90";

function sortValueOf(row: MissingRow, key: Exclude<SortKey, "member">): number | null {
  switch (key) {
    case "self": return row.self;
    case "unknown": return row.unknown;
    case "unknownPctSelf": return row.unknownPctSelf;
    case "evolution30": return row.evolution30;
    case "evolution60": return row.evolution60;
    case "evolution90": return row.evolution90;
  }
}

function fmtPts(v: number | null): string {
  if (v === null) return "—";
  const pts = Math.round(v * 1000) / 10;
  const sign = pts > 0 ? "+" : pts < 0 ? "−" : "";
  return `${sign}${Math.abs(pts).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;
}

export function MissingsCard() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "member", dir: "asc" });
  const [lang, setLang] = useState<Lang>("fr");
  const t = UI[lang];

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key
      ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
      : { key, dir: key === "member" ? "asc" : "desc" }));
  }

  function sortedRows(rows: MissingRow[]): MissingRow[] {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "member") return dir * a.member.localeCompare(b.member);
      const va = sortValueOf(a, sort.key);
      const vb = sortValueOf(b, sort.key);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return dir * (va - vb);
    });
  }

  function sortHeader(key: SortKey, label: string, align: "left" | "right", tip?: string) {
    const active = sort.key === key;
    const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
    return (
      <th className={`group relative p-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
        <button type="button" onClick={() => sortBy(key)}
          aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
          className={`${active ? "text-ink" : ""} cursor-pointer border-b border-dotted border-muted hover:text-ink`}>
          {label}{arrow}
        </button>
        {tip && (
          <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-64 whitespace-normal rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-xl group-hover:block">
            {tip}
          </span>
        )}
      </th>
    );
  }

  useEffect(() => {
    fetch("/api/missings", { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          setState({ status: "error", message: payload.error?.message ?? UI[lang].unavailable });
          return;
        }
        setState({ status: "success", result: missingsSchema.parse(payload) });
      })
      .catch(() => setState({ status: "error", message: UI[lang].invalid }));
  }, []);

  if (state.status === "loading") return <p className="p-5 text-sm text-muted">{t.loading}</p>;
  if (state.status === "error") return <p className="p-5 text-sm text-red-600">{state.message}</p>;

  const { rows, globalUnknownPct } = state.result;
  const switcher = (
    <div className="mb-2 flex justify-end gap-1" role="group" aria-label="Language">
      {(["fr", "en"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${lang === l ? "bg-accent text-white" : "text-muted hover:text-on-surface"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <section aria-label="Summary" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t.summary}</h3>
          {switcher}
        </div>
        <HelpBox content={SUMMARY} lang={lang} showSwitch={false} />
      </section>

      <section aria-label="Missing contacts" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t.table}</h3>
          <p className="text-right">
            <span className="block text-xs text-muted">{t.avgLabel}</span>
            <span className="text-2xl font-bold tabular-nums">{fmtPct(globalUnknownPct)}</span>
          </p>
        </div>
        <HelpBox content={HELP} lang={lang} showSwitch={false} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-muted">
                {sortHeader("member", "member", "left")}
                {sortHeader("self", "# self opt-in", "right", `# self opt-in = ${t.tip.self}`)}
                {sortHeader("unknown", "# missing opt-in", "right", `# missing opt-in = ${t.tip.missing}`)}
                {sortHeader("unknownPctSelf", "% missing opt-in self", "right", `% missing opt-in self = ${t.tip.pct}`)}
                {sortHeader("evolution30", "change 30 d", "right", `change 30 d = ${COLUMN_TIPS.evolution.formula} (N = 30)`)}
                {sortHeader("evolution60", "change 60 d", "right", `change 60 d = ${COLUMN_TIPS.evolution.formula} (N = 60)`)}
                {sortHeader("evolution90", "change 90 d", "right", `change 90 d = ${COLUMN_TIPS.evolution.formula} (N = 90)`)}
              </tr>
            </thead>
            <tbody>
              {sortedRows(rows).map((r) => (
                <MissingTableRow key={r.member} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

function MissingTableRow({ row }: { row: MissingRow }) {
  return (
    <tr className="border-t border-line text-right">
      <td className="p-2 text-left font-semibold">{row.member}</td>
      <td className="p-2">{fmtN(row.self)}</td>
      <td className="p-2">{fmtN(row.unknown)}</td>
      <td className="p-2">{fmtPct(row.unknownPctSelf)}</td>
      <td className="p-2">{fmtPts(row.evolution30)}</td>
      <td className="p-2">{fmtPts(row.evolution60)}</td>
      <td className="p-2">{fmtPts(row.evolution90)}</td>
    </tr>
  );
}
