import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GenieErrorCard, TrackingStoppedNotice } from "../src/features/genie/genie-chat";
import { GenieMarkdown, isAllowedGenieLink } from "../src/features/genie/genie-markdown";
import {
  applyPostDispatchRetryPolicy,
  type GenieClientError,
} from "../src/features/genie/use-genie-conversation";

test("renders Genie Markdown images as inert alternative text", () => {
  const markup = renderToStaticMarkup(createElement(GenieMarkdown, {
    content: "![Graphique des ventes](https://tracker.example/pixel.gif \"Suivi distant\")",
  }));

  assert.doesNotMatch(markup, /<img\b/i);
  assert.doesNotMatch(markup, /tracker\.example|pixel\.gif|Suivi distant/);
  assert.match(markup, /\[Image : Graphique des ventes\]/);
});

test("keeps only explicit safe Genie Markdown links active", () => {
  const markup = renderToStaticMarkup(createElement(GenieMarkdown, {
    content: [
      "[HTTPS](https://safe.example/report)",
      "[HTTP](http://safe.example/report)",
      "[Même origine](/reports/sales)",
      "[Fragment](#details)",
      "[Protocole relatif](//evil.example/collect)",
      "[Schéma script](javascript:alert(1))",
      "[Courriel](mailto:test@example.com)",
      "[Chemin ambigu](/\\evil.example/collect)",
      "[Chemin point](./local)",
    ].join("\n\n"),
  }));

  assert.equal(markup.match(/<a\b/g)?.length, 4);
  assert.match(markup, /href="https:\/\/safe\.example\/report"/);
  assert.match(markup, /href="http:\/\/safe\.example\/report"/);
  assert.match(markup, /href="\/reports\/sales"/);
  assert.match(markup, /href="#details"/);
  assert.doesNotMatch(markup, /href="(?:\/\/|javascript:|mailto:|\.\/|\/\\)/i);
  assert.match(markup, />Protocole relatif<\/span>/);
  assert.match(markup, />Schéma script<\/span>/);

  assert.equal(isAllowedGenieLink("https://safe.example"), true);
  assert.equal(isAllowedGenieLink("/same-origin"), true);
  assert.equal(isAllowedGenieLink("#section"), true);
  assert.equal(isAllowedGenieLink("//evil.example"), false);
  assert.equal(isAllowedGenieLink("/\\evil.example"), false);
  assert.equal(isAllowedGenieLink("/%5Cevil.example"), false);
  assert.equal(isAllowedGenieLink("javascript:alert(1)"), false);
  assert.equal(isAllowedGenieLink("mailto:test@example.com"), false);
});

test("describes a local tracking stop without claiming remote cancellation", () => {
  const markup = renderToStaticMarkup(createElement(TrackingStoppedNotice));

  assert.match(markup, /Suivi arrêté dans cette page/);
  assert.match(markup, /Le traitement Databricks peut continuer/);
  assert.match(markup, /Démarrez une nouvelle conversation/);
  assert.doesNotMatch(markup, /annul/i);
});

test("locks ambiguous post-dispatch failures while preserving explicit HTTP rejections", () => {
  const explicitHttpRejection: GenieClientError = {
    code: "GENIE_UNAVAILABLE",
    message: "Capacité momentanément atteinte.",
    retryable: true,
  };
  const ambiguousPostDispatchFailure: GenieClientError = {
    code: "GENIE_UNAVAILABLE",
    message: "Flux interrompu.",
    retryable: true,
  };

  assert.equal(applyPostDispatchRetryPolicy(explicitHttpRejection, false), explicitHttpRejection);
  assert.deepEqual(applyPostDispatchRetryPolicy(ambiguousPostDispatchFailure, true), {
    ...ambiguousPostDispatchFailure,
    retryable: false,
    submissionMayHaveStarted: true,
  });
});

test("tracks replay safety at the POST dispatch boundary", async () => {
  const hookSource = await readFile(
    new URL("../src/features/genie/use-genie-conversation.ts", import.meta.url),
    "utf8",
  );
  const sendSource = hookSource.slice(
    hookSource.indexOf("const sendMessage = useCallback"),
    hookSource.indexOf("const newConversation = useCallback"),
  );
  const dispatchedIndex = sendSource.indexOf("requestMayHaveSubmitted = true;");
  const fetchIndex = sendSource.indexOf("await fetch(");
  const rejectedIndex = sendSource.indexOf("if (!response.ok)");
  const rejectionResetIndex = sendSource.indexOf("requestMayHaveSubmitted = false;", rejectedIndex);
  const readErrorIndex = sendSource.indexOf("throw await readHttpError(response);", rejectedIndex);

  assert.ok(dispatchedIndex >= 0 && dispatchedIndex < fetchIndex);
  assert.ok(fetchIndex < rejectedIndex);
  assert.ok(rejectedIndex < rejectionResetIndex && rejectionResetIndex < readErrorIndex);
  assert.match(
    sendSource,
    /applyPostDispatchRetryPolicy\(rawClientError, requestMayHaveSubmitted\)/,
  );
});

test("guards every conversation-history action while a response is streaming", async () => {
  const [chatSource, hookSource] = await Promise.all([
    readFile(new URL("../src/features/genie/genie-chat.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/genie/use-genie-conversation.ts", import.meta.url), "utf8"),
  ]);
  const historySource = chatSource.slice(
    chatSource.indexOf("function ConversationHistory"),
    chatSource.indexOf("function EmptyConversation"),
  );

  assert.match(historySource, /aria-disabled=\{disabled\}/);
  assert.match(historySource, /tabIndex=\{disabled \? -1 : undefined\}/);
  assert.match(
    historySource,
    /onClick=\{onClear\}[\s\S]*?disabled=\{disabled\}/,
  );
  assert.match(
    historySource,
    /onClick=\{\(\) => onResume\(session\.localId\)\}[\s\S]*?disabled=\{disabled\}/,
  );
  assert.match(
    hookSource,
    /const resumeConversation = useCallback\(\(localId: string\) => \{\s*if \(abortControllerRef\.current \|\|/s,
  );
  assert.match(
    hookSource,
    /const clearHistory = useCallback\(\(\) => \{\s*if \(abortControllerRef\.current\) \{\s*return;\s*\}/s,
  );
});

test("describes the full Databricks permission remediation surface", () => {
  const markup = renderToStaticMarkup(createElement(GenieErrorCard, {
    error: {
      code: "GENIE_PERMISSION_DENIED",
      message: "Accès refusé.",
      retryable: false,
    },
  }));

  assert.match(markup, /Space Genie/);
  assert.match(markup, /SQL warehouse/);
  assert.match(markup, /Unity Catalog/);
  assert.match(markup, /session et le consentement Databricks/);
  assert.doesNotMatch(markup, /CAN_RUN/);
});
