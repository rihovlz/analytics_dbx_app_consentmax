import assert from "node:assert/strict";
import test from "node:test";

import { assertTemplateJourneyDoctor } from "../scripts/validate-template-journey";

function doctorOutput(recommendedStep = "npm run check"): unknown[] {
  return [
    { status: "pass", name: "Initialisation" },
    { status: "pass", name: "Cadrage" },
    { status: "pass", name: "Accès aux données" },
    { status: "pass", name: "Features et sources" },
    { status: "warn", name: "Développement réel" },
    { status: "pass", name: "Étape recommandée", next: recommendedStep },
  ];
}

test("accepts the completed template consumer journey", () => {
  assert.doesNotThrow(() => assertTemplateJourneyDoctor(doctorOutput()));
});

test("rejects a failing doctor check or an incomplete journey", () => {
  const failing = doctorOutput();
  failing.splice(4, 0, { status: "fail", name: "Accès aux données" });
  assert.throws(() => assertTemplateJourneyDoctor(failing), /must not report a failing check/);
  assert.throws(() => assertTemplateJourneyDoctor(doctorOutput("npm run feature:new -- <slug>")), /npm run check/);
});
