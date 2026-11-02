"use client";

import type { ReactNode } from "react";

import { useLanguage, type Lang } from "@/components/language/language-context";

const MATRIX_HELP: Record<Lang, ReactNode> = {
  fr: (
    <ul className="space-y-1.5">
      <li><b>Verticalement</b> : montre comment l'enseigne en haut de la colonne bénéficie de la contribution des membres de l'alliance (situés à gauche du tableau).</li>
      <li><b>Horizontalement</b> : montre la façon dont les opt-in collectés par l'enseigne référencée au début de la ligne bénéficient aux enseignes de l'alliance.</li>
    </ul>
  ),
  en: (
    <ul className="space-y-1.5">
      <li><b>Vertically</b>: shows how the member at the top of the column benefits from the contribution of the alliance members (listed on the left of the table).</li>
      <li><b>Horizontally</b>: shows how the opt-ins collected by the member at the start of the row benefit the alliance members.</li>
    </ul>
  ),
};

const MEMBER_HELP: Record<Lang, ReactNode> = {
  fr: (
    <ul className="space-y-1.5">
      <li><b># self opt-in</b> : nombre d'emails ayant consenti (opt-in) collectés par l'enseigne concernée.</li>
      <li><b># alliance opt-in</b> : nombre d'emails ayant consenti (opt-in) apportés par les autres enseignes de l'alliance à l'enseigne concernée.</li>
      <li><b># total opt-in</b> : nombre total d'emails ayant consenti pour l'enseigne (self + alliance).</li>
      <li><b>% booster alliance</b> : part que représente l'apport de l'alliance pour l'enseigne par rapport à la collecte en propre (alliance / self).</li>
      <li><b>booster</b> : coefficient multiplicateur grâce à l'apport de l'alliance (total / self).</li>
    </ul>
  ),
  en: (
    <ul className="space-y-1.5">
      <li><b># self opt-in</b>: number of emails that consented (opt-in) collected by the member concerned.</li>
      <li><b># alliance opt-in</b>: number of emails that consented (opt-in) brought to the member concerned by the other alliance members.</li>
      <li><b># total opt-in</b>: total number of emails that consented for the member (self + alliance).</li>
      <li><b>% booster alliance</b>: share of the alliance's contribution compared with the member's own collection (alliance / self).</li>
      <li><b>booster</b>: multiplier coefficient thanks to the alliance's contribution (total / self).</li>
    </ul>
  ),
};

export function HelpBox({ content }: { content: Record<Lang, ReactNode> }) {
  const { lang } = useLanguage();
  return (
    <div className="mb-4 rounded-xl border border-line bg-surface/60 p-4 text-xs text-muted">
      {content[lang]}
    </div>
  );
}

export function MatrixHelp() {
  return <HelpBox content={MATRIX_HELP} />;
}

export function MemberHelp() {
  return <HelpBox content={MEMBER_HELP} />;
}
