import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { readFile } from "node:fs/promises";
import { mount } from "../src/theme.js";
import { hostAppearance } from "../src/hostAppearance.js";
import { localText, languages } from "../src/i18n.js";
import { createSyntheticSdk } from "../dev/synthetic-sdk.js";

function fixture(t, setup = () => {}) {
  const window = new Window({ url: "https://brutalist.test/" });
  const root = window.document.createElement("div");
  window.document.body.append(root);
  const mock = createSyntheticSdk();
  setup(mock);
  mock.emit();
  const app = mount({ root, sdk: mock.sdk, appearance: { settings: {} } });
  const select = (key, value) => {
    const control = root.querySelector(`[data-setting="${key}"]`);
    control.value = value;
    control.dispatchEvent(new window.Event("change", { bubbles: true }));
    return control;
  };
  const key = (control, value) =>
    control.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    );
  t.after(async () => {
    app.unmount();
    await window.happyDOM.abort();
  });
  return { window, root, mock, app, select, key };
}
function manyAccounts(mock) {
  const template = mock.state.library.accounts[0];
  mock.state.library.accounts = Array.from({ length: 200 }, (_, index) => ({
    ...structuredClone(template),
    ref: { id: `account-${String(index).padStart(3, "0")}`, generation: 1 },
    accountLabel: `account-${String(index).padStart(3, "0")} 长账户${"x".repeat(80)}`,
    service: {
      groupId: `service-${index % 40}`,
      label:
        index % 40 < 2
          ? "Identical label"
          : index % 40 === 39
            ? "其他"
            : `长服务 ${index % 40} ${"long-service".repeat(10)}`,
    },
  }));
}

test("200 accounts and 40 services use one labelled select and stable group IDs, including duplicate labels and other", (t) => {
  const h = fixture(t, manyAccounts);
  const service = h.root.querySelector('[data-setting="service"]');
  assert.equal(service.tagName, "SELECT");
  assert.equal(
    service.closest("label").querySelector("span").textContent,
    "Service",
  );
  assert.equal(service.options.length, 41);
  assert.equal(service.options[0].textContent, "All services (200)");
  assert.equal(service.options[1].textContent, "Identical label (5)");
  assert.equal(service.options[2].textContent, "Identical label (5)");
  assert.equal(h.root.querySelectorAll('[data-action="filter"]').length, 0);
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 200);
  const options = [...service.options];
  h.root.querySelector('[data-action="display"]').click();
  service.focus();
  h.select("service", "service-1");
  assert.deepEqual(h.mock.calls.at(-1), {
    method: "view.setServiceFilter",
    value: { serviceFilter: "service-1" },
  });
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 5);
  assert.deepEqual(
    [...h.root.querySelectorAll(".brutalist-card")].map(
      (node) => node.dataset.account,
    ),
    ["account-001", "account-041", "account-081", "account-121", "account-161"],
  );
  h.mock.emit();
  assert.ok(h.window.document.activeElement === service);
  assert.equal(service.options.length, options.length);
  assert.ok(
    options.every((option, index) => service.options[index] === option),
  );
  assert.equal(service.value, "service-1");
  const search = h.root.querySelector('[data-setting="query"]');
  search.value = "account-081";
  search.dispatchEvent(new h.window.Event("input", { bubbles: true }));
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 1);
  assert.equal(service.options[0].textContent, "All services (200)");
  h.root.querySelector('[data-action="clear"]').click();
  assert.equal(h.mock.state.library.view.query, "");
  assert.equal(service.value, "");
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 200);
  h.select("service", "service-39");
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 5);
  assert.equal(service.selectedOptions[0].textContent, "其他 (5)");
  h.mock.state.library.accounts = h.mock.state.library.accounts.filter(
    (account) => account.service.groupId !== "service-39",
  );
  h.mock.emit();
  assert.equal(service.value, "");
  assert.equal(service.options.length, 40);
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 195);
});

test("display disclosure supports keyboard, Escape, outside pointer and Tab departure without losing focus", (t) => {
  const h = fixture(t);
  const toggle = h.root.querySelector('[data-action="display"]');
  const panel = h.root.querySelector(".brutalist-display-panel");
  assert.equal(panel.hidden, true);
  assert.equal(toggle.getAttribute("aria-controls"), panel.id);
  toggle.focus();
  h.key(toggle, "Enter");
  assert.equal(panel.hidden, false);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  const sort = h.root.querySelector('[data-setting="sort"]');
  sort.focus();
  const choices = [...sort.options];
  for (let tick = 0; tick < 10; tick++) h.mock.emit();
  assert.ok(h.window.document.activeElement === sort);
  assert.equal(panel.hidden, false);
  assert.equal(sort.options.length, choices.length);
  assert.ok(choices.every((choice, index) => sort.options[index] === choice));
  h.key(sort, "Escape");
  assert.equal(panel.hidden, true);
  assert.ok(h.window.document.activeElement === toggle);
  h.key(toggle, " ");
  assert.equal(panel.hidden, false);
  sort.focus();
  h.window.document.body.dispatchEvent(
    new h.window.Event("pointerdown", { bubbles: true }),
  );
  assert.equal(panel.hidden, true);
  assert.ok(h.window.document.activeElement === toggle);
  toggle.click();
  sort.focus();
  const search = h.root.querySelector('[data-setting="query"]');
  search.focus();
  assert.equal(panel.hidden, true);
  assert.ok(h.window.document.activeElement === search);
  toggle.click();
  h.mock.state.host.dialogOpen = true;
  h.mock.emit();
  assert.equal(panel.hidden, true);
  assert.equal(h.mock.calls.length, 0);
});

test("a collapsed service filter stays identifiable and clearing it restores the search focus", (t) => {
  const h = fixture(t);
  const toggle = h.root.querySelector('[data-action="display"]');
  const panel = h.root.querySelector(".brutalist-display-panel");
  const service = h.root.querySelector('[data-setting="service"]');
  const search = h.root.querySelector('[data-setting="query"]');
  const clear = h.root.querySelector('[data-action="clear"]');
  const count = h.root.querySelector(".brutalist-section-description");
  assert.ok(service.closest("[hidden]"));
  assert.equal(clear.hidden, true);
  toggle.click();
  assert.equal(panel.hidden, false);
  assert.equal(
    service
      .closest("label")
      .querySelector("span")
      .classList.contains("brutalist-sr-only"),
    false,
  );
  service.focus();
  h.select("service", "Google");
  assert.equal(clear.hidden, false);
  assert.equal(count.classList.contains("brutalist-sr-only"), false);
  assert.match(count.textContent, /Google/);
  h.key(service, "Escape");
  assert.equal(panel.hidden, true);
  assert.ok(h.window.document.activeElement === toggle);
  assert.match(count.textContent, /Google/);
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 1);
  clear.focus();
  clear.click();
  assert.equal(h.mock.state.library.view.serviceFilter, null);
  assert.equal(h.mock.state.library.view.query, "");
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 6);
  assert.equal(clear.hidden, true);
  assert.equal(count.classList.contains("brutalist-sr-only"), true);
  assert.ok(h.window.document.activeElement === search);

  h.mock.sdk.view.setQuery("Google");
  assert.equal(clear.hidden, false);
  clear.focus();
  h.mock.sdk.view.setQuery("");
  assert.equal(clear.hidden, true);
  assert.ok(h.window.document.activeElement === search);
});

test("color scheme remains reachable from management settings and delegates to host preferences", (t) => {
  const h = fixture(t);
  const scheme = h.root.querySelector('[data-action="scheme"]');
  assert.ok(
    h.root.querySelector('.brutalist-topbar [data-action="scheme"]') === null,
  );
  assert.ok(scheme.closest("[hidden]"));
  h.root.querySelector('[data-action="route"][data-value="more"]').click();
  h.root
    .querySelector('[data-action="management-group"][data-value="settings"]')
    .click();
  assert.ok(scheme.closest("[hidden]") === null);
  scheme.focus();
  scheme.click();
  assert.deepEqual(h.mock.calls.at(-1), {
    method: "preferences.set",
    value: { theme: "dark" },
  });
  assert.equal(
    h.root.querySelector(".brutalist-theme").dataset.colorScheme,
    "dark",
  );
  h.mock.emit();
  assert.ok(h.window.document.activeElement === scheme);
  scheme.click();
  assert.equal(
    h.root.querySelector(".brutalist-theme").dataset.colorScheme,
    "light",
  );
  assert.equal(
    h.mock.calls.filter(({ method }) => method === "host.open").length,
    0,
  );
});

test("all grouped and flat sort options remain available", (t) => {
  const h = fixture(t);
  h.root.querySelector('[data-action="display"]').click();
  const sort = h.root.querySelector('[data-setting="sort"]');
  const groupSort = h.root.querySelector('[data-setting="groupSort"]');
  assert.equal(sort.options.length, 4);
  assert.equal(groupSort.closest("label").hidden, false);
  for (const value of [
    "oldest-first",
    "newest-first",
    "account-asc",
    "account-desc",
  ]) {
    h.select("sort", value);
    assert.deepEqual(h.mock.calls.at(-1).value, { groupedItemSort: value });
  }
  for (const value of ["name-desc", "name-asc"]) {
    h.select("groupSort", value);
    assert.deepEqual(h.mock.calls.at(-1).value, { groupSort: value });
  }
  h.select("mode", "flat");
  assert.equal(groupSort.closest("label").hidden, true);
  assert.equal(sort.options.length, 6);
  for (const value of [...sort.options].map((option) => option.value)) {
    h.select("sort", value);
    assert.deepEqual(h.mock.calls.at(-1).value, { flatSort: value });
  }
  assert.equal(h.mock.state.library.view.mode, "flat");
  assert.deepEqual(
    [...h.root.querySelectorAll(".brutalist-card")].map(
      (node) => node.dataset.account,
    ),
    h.mock.state.library.view.resultIds,
  );
});

test("management has one host preferences entry and separately named theme settings in every locale", (t) => {
  const h = fixture(t);
  for (const [language] of languages.filter(([id]) => id !== "auto")) {
    h.mock.state.preferences.resolvedLanguage = language;
    h.mock.emit();
    for (const key of [
      "view",
      "service",
      "manage",
      "groupData",
      "groupTools",
      "groupSettings",
      "groupApplication",
    ])
      assert.ok(localText(language, key));
    assert.equal(
      h.root.querySelectorAll('[data-value="settings:preferences"]').length,
      1,
    );
    assert.equal(
      h.root.querySelector('[data-value="appearance"] > span').textContent,
      localText(language, "appearance"),
    );
  }
  h.root.querySelector('[data-value="settings:preferences"]').click();
  assert.deepEqual(h.mock.calls.at(-1).value.request, {
    kind: "settings",
    section: "preferences",
  });
});
test("host appearance follows the brutalist palette once per change, with no computed-style reads", (t) => {
  const h = fixture(t);
  const first = h.mock.appearances[0];
  assert.equal(h.mock.appearances.length, 1);
  assert.equal(first.surface, "#ffffff");
  assert.equal(first.accent, "#2346d8");
  assert.equal(first.fontFamily[0], "Arial");
  h.window.getComputedStyle = () => {
    throw new Error("Theme must not sample styles");
  };
  for (let i = 0; i < 20; i++) h.mock.emit();
  h.app.update({
    settings: {
      density: "compact",
    },
  });
  assert.equal(h.mock.appearances.length, 1);
  h.app.update({ settings: { density: "comfortable" } });
  assert.equal(h.mock.appearances.length, 1);
  assert.equal(h.mock.appearances.at(-1).accent, "#2346d8");
  assert.deepEqual(h.mock.appearances.at(-1).fontFamily, first.fontFamily);
  h.mock.sdk.preferences.set({ theme: "dark" });
  assert.equal(h.mock.appearances.length, 2);
  assert.equal(h.mock.appearances.at(-1).surface, "#30364a");
  assert.equal(h.mock.appearances.at(-1).accent, "#a9caff");
  h.app.update({ settings: { density: "compact" } });
  assert.equal(h.mock.appearances.length, 2);
  h.app.unmount();
  h.mock.sdk.preferences.set({ theme: "light" });
  h.app.update({ settings: { density: "comfortable" } });
  assert.equal(h.mock.appearances.length, 2);
});

test("old SDK without host appearance still mounts and supports account and host actions", (t) => {
  const h = fixture(t, (mock) => {
    delete mock.sdk.host.setAppearance;
  });
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 6);
  h.root.querySelector('[data-account="google"] [data-action="copy"]').click();
  assert.equal(h.mock.calls.at(-1).method, "otp.copy");
  h.root.querySelector('[data-value="account-add"]').click();
  assert.deepEqual(h.mock.calls.at(-1).value.request, { kind: "account-add" });
  h.app.update({ settings: { density: "compact" } });
  assert.equal(
    h.root.querySelector(".brutalist-theme").dataset.density,
    "compact",
  );
});

test("host palette fields stay finite and compatible for every density and color scheme", () => {
  for (const density of ["comfortable", "compact"])
    for (const dark of [false, true]) {
      const tokens = hostAppearance({ density }, dark);
      for (const [key, value] of Object.entries(tokens)) {
        if (["radius", "controlRadius", "borderWidth"].includes(key))
          assert.ok(Number.isFinite(value));
        else if (["shadow", "controlShadow", "fontFamily"].includes(key))
          continue;
        else assert.match(value, /^#[0-9a-f]{6}$/i);
      }
      assert.ok(tokens.fontFamily.length <= 8);
    }
});

test("toolbar keeps controls bounded and reachable, with management in the header and add in the empty state", async (t) => {
  const h = fixture(t, manyAccounts);
  for (const path of ["tokens", "components", "application"]) {
    const style = h.window.document.createElement("style");
    style.textContent = await readFile(
      new URL(`../src/styles/${path}.css`, import.meta.url),
      "utf8",
    );
    h.window.document.head.append(style);
  }
  const computed = (node) => h.window.getComputedStyle(node);
  const service = h.root.querySelector('[data-setting="service"]');
  assert.ok(parseFloat(computed(service).minHeight) >= 44);
  assert.equal(computed(service).maxWidth, "100%");
  assert.equal(
    computed(h.root.querySelector(".brutalist-display-panel")).display,
    "none",
  );
  h.root.querySelector('[data-action="display"]').click();
  assert.notEqual(
    computed(h.root.querySelector(".brutalist-display-panel")).display,
    "none",
  );
  const actions = [
    ...h.root.querySelectorAll(".brutalist-topbar-actions .brutalist-button"),
  ];
  assert.equal(actions.length, 1);
  assert.equal(actions[0].dataset.value, "more");
  assert.equal(actions[0].classList.contains("is-primary"), false);
  for (const control of actions) {
    assert.ok(parseFloat(computed(control).minHeight) >= 44);
  }
  h.mock.state.library.accounts = [];
  h.mock.emit();
  const empty = h.root.querySelector(".brutalist-empty-state");
  assert.equal(empty.hidden, false);
  const add = empty.querySelector("button");
  assert.equal(add.dataset.value, "account-add");
  assert.ok(parseFloat(computed(add).minHeight) >= 44);
  add.click();
  assert.deepEqual(h.mock.calls.at(-1).value.request, { kind: "account-add" });
});

test("mobile topbar reserves action hit areas while the brand and translated labels wrap", async (t) => {
  const h = fixture(t);
  for (const path of ["tokens", "components", "application"]) {
    const style = h.window.document.createElement("style");
    style.textContent = await readFile(
      new URL(`../src/styles/${path}.css`, import.meta.url),
      "utf8",
    );
    h.window.document.head.append(style);
  }
  const title = "2FA.";
  const computed = (node) => h.window.getComputedStyle(node);
  const brand = h.root.querySelector(".brutalist-brand");
  const name = h.root.querySelector(".brutalist-brand-name");
  const actions = h.root.querySelector(".brutalist-topbar-actions");
  const buttons = [...actions.querySelectorAll("button")];
  assert.equal(buttons.length, 1);
  assert.equal(name.textContent, title);
  assert.equal(computed(brand).minWidth, "0");
  assert.equal(computed(name.parentElement).minWidth, "0");
  assert.equal(computed(name).overflowWrap, "anywhere");
  for (const width of [320, 390, 600, 601]) {
    h.window.happyDOM.setViewport({ width, height: 844 });
    for (const language of ["zh-CN", "de"]) {
      h.mock.state.preferences.resolvedLanguage = language;
      h.mock.emit();
      assert.equal(
        h.root.querySelector('[data-value="more"]').textContent,
        localText(language, "manage"),
      );
      assert.equal(name.textContent, title);
      for (const button of buttons) {
        assert.ok(parseFloat(computed(button).minWidth) >= 44);
        assert.ok(parseFloat(computed(button).minHeight) >= 44);
        assert.equal(button.hidden, false);
        if (width <= 600)
          assert.equal(computed(button).overflowWrap, "anywhere");
      }
    }
  }
  buttons[0].click();
  assert.equal(h.root.querySelector(".brutalist-subpage").hidden, false);
  h.root.querySelector('.brutalist-subpage [data-value="account-add"]').click();
  assert.deepEqual(h.mock.calls.at(-1).value.request, { kind: "account-add" });
});

test("host accents remain readable as text and primary fills in every scheme", () => {
  const luminance = (hex) => {
    const [r, g, b] = hex
      .slice(1)
      .match(/../g)
      .map((value) => {
        const channel = parseInt(value, 16) / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const values = [luminance(a), luminance(b)].sort((a, b) => a - b);
    return (values[1] + 0.05) / (values[0] + 0.05);
  };
  for (const density of ["comfortable", "compact"])
    for (const dark of [false, true]) {
      const tokens = hostAppearance({ density }, dark);
      for (const fill of [tokens.accent, tokens.accentHover]) {
        assert.ok(
          contrast(fill, tokens.surface) >= 4.5,
          `${density}/${dark}: accent text on surface`,
        );
        assert.ok(
          contrast(tokens.accentText, fill) >= 4.5,
          `${density}/${dark}: text on primary fill`,
        );
      }
      assert.ok(
        contrast(tokens.stroke, tokens.surface) >= 3,
        `${density}/${dark}: visible control outlines`,
      );
    }
});

test("ledger service tabs filter by service and the command strip opens host actions", (t) => {
  const h = fixture(t);
  const tabs = h.root.querySelector(".brutalist-service-tabs");
  assert.equal(tabs.hidden, false);
  const all = tabs.querySelector('[data-action="service-tab"][data-value=""]');
  assert.equal(all.getAttribute("aria-pressed"), "true");
  const google = tabs.querySelector(
    '[data-action="service-tab"][data-value="Google"]',
  );
  google.click();
  assert.deepEqual(h.mock.calls.at(-1), {
    method: "view.setServiceFilter",
    value: { serviceFilter: "Google" },
  });
  assert.equal(
    tabs
      .querySelector('[data-action="service-tab"][data-value="Google"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 1);
  tabs.querySelector('[data-action="service-tab"][data-value=""]').click();
  assert.equal(h.mock.state.library.view.serviceFilter, null);
  assert.equal(h.root.querySelectorAll(".brutalist-card").length, 6);
  const strip = h.root.querySelector(".brutalist-rail");
  // Add, import and export live in Manage > Data; the strip keeps the everyday scan.
  assert.deepEqual(
    [...strip.querySelectorAll('[data-action="host"]')].map(
      (node) => node.dataset.value,
    ),
    ["scan-import"],
  );
  assert.equal(strip.querySelectorAll('[data-action="scheme"]').length, 0);
  strip.querySelector('[data-value="scan-import"]').click();
  assert.deepEqual(h.mock.calls.at(-1).value.request, { kind: "scan-import" });
});
