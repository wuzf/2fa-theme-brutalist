import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { readFile } from "node:fs/promises";
import { mount } from "../src/theme.js";
import { localText } from "../src/i18n.js";
import { createSyntheticSdk, OTHER_GROUP } from "../dev/synthetic-sdk.js";

async function fixture(t, { setup = () => {}, settings = {} } = {}) {
  const window = new Window({ url: "https://brutalist.test/" });
  for (const path of ["tokens", "components", "application", "ledger"]) {
    const style = window.document.createElement("style");
    style.textContent = await readFile(
      new URL(`../src/styles/${path}.css`, import.meta.url),
      "utf8",
    );
    window.document.head.append(style);
  }
  const root = window.document.createElement("div");
  window.document.body.append(root);
  const mock = createSyntheticSdk();
  setup(mock);
  mock.emit();
  const app = mount({ root, sdk: mock.sdk, appearance: { settings } });
  t.after(async () => {
    app.unmount();
    await window.happyDOM.abort();
  });
  return { window, root, mock };
}

const otherLabels = [
  "Aliyun",
  "Binance",
  "Cloudflare",
  "eu.org",
  "GitHub",
  "GoDaddy",
  "Linode",
  "Vultr",
];
function otherServices(mock) {
  const template = mock.state.library.accounts[0];
  mock.state.library.accounts = [
    ...otherLabels.map((label, index) => ({
      ...structuredClone(template),
      ref: { id: `other-${index}`, generation: 1 },
      service: { label, groupId: OTHER_GROUP },
    })),
    ...["Google", "Google Workspace"].map((label, index) => ({
      ...structuredClone(template),
      ref: { id: `google-${index}`, generation: 1 },
      service: { label, groupId: "google" },
    })),
  ];
}

test("services in the shared other group get colors by name, real groups keep one color", async (t) => {
  const h = await fixture(t, { setup: otherServices });
  const tone = (id) =>
    [...h.root.querySelectorAll(".brutalist-card")].find(
      (card) =>
        card.querySelector(".brutalist-account-name").textContent ===
        (id.startsWith("google")
          ? ["Google", "Google Workspace"][Number(id.slice(-1))]
          : otherLabels[Number(id.slice(-1))]),
    ).dataset.tone;
  const otherTones = new Set(
    otherLabels.map((_, index) => tone(`other-${index}`)),
  );
  assert.ok(otherTones.size > 1, `other tones: ${[...otherTones]}`);
  assert.equal(tone("google-0"), tone("google-1"));
});

test("the countdown column is labelled and sits beside the code", async (t) => {
  const h = await fixture(t);
  const head = h.root.querySelector(".brutalist-ledger-head");
  assert.deepEqual(
    [...head.children].map((node) => node.textContent),
    [
      "#",
      localText("en", "current"),
      localText("en", "remaining"),
      localText("en", "service"),
    ],
  );
  const card = h.root.querySelector(".brutalist-card");
  assert.equal(
    h.window.getComputedStyle(card).gridTemplateAreas.replace(/\s+/g, " "),
    '"index code time mark identity menu"',
  );
});

test("search and service tabs share one pinned bar; scan sits in the masthead", async (t) => {
  const h = await fixture(t);
  const filters = h.root.querySelector(".brutalist-filters");
  assert.ok(filters.querySelector(".brutalist-toolbar"));
  assert.ok(filters.querySelector(".brutalist-service-tabs"));
  const style = h.window.getComputedStyle(filters);
  assert.equal(style.position, "sticky");
  assert.equal(style.top, "0px");
  const head = h.root.querySelector(".brutalist-topbar-inner");
  assert.deepEqual(
    [...head.children].map((node) => node.className.split(" ")[0]),
    ["brutalist-brand", "brutalist-rail", "brutalist-actions"],
  );
  assert.ok(head.querySelector('.brutalist-rail [data-value="scan-import"]'));
});

test("compact density makes ledger rows shorter, not only the digits", async (t) => {
  const read = async (density) => {
    const h = await fixture(t, { settings: { density } });
    const style = (selector) =>
      h.window.getComputedStyle(h.root.querySelector(selector));
    return {
      copy: parseFloat(style(".brutalist-copy-code").minHeight),
      next: parseFloat(style(".brutalist-otp-next").minHeight),
      padding: parseFloat(style(".brutalist-codes").paddingTop),
    };
  };
  const comfortable = await read("comfortable");
  const compact = await read("compact");
  assert.ok(
    compact.copy < comfortable.copy,
    JSON.stringify({ comfortable, compact }),
  );
  assert.ok(
    compact.next < comfortable.next,
    JSON.stringify({ comfortable, compact }),
  );
  assert.ok(
    compact.padding < comfortable.padding,
    JSON.stringify({ comfortable, compact }),
  );
});
