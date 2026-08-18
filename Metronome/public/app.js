// ---------- Shared app state ----------
const state = {
  customerId: null,       // Stripe customer id
  metronomeCustomerId: null
};

// ---------- JSON syntax highlighting ----------
function syntaxHighlight(json) {
  const jsonString = JSON.stringify(json, null, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return jsonString.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

// ---------- Reusable request/response panel renderer ----------
function renderApiPanel(panelEl, { method, path, requestBody, status, responseBody }) {
  const ok = status >= 200 && status < 300;
  panelEl.innerHTML = `
    <div class="api-panel-section">
      <div class="api-panel-label">
        <span>Request &middot; ${method} ${path}</span>
        <button class="copy-btn" data-copy>Copy</button>
      </div>
      <pre>${syntaxHighlight(requestBody)}</pre>
    </div>
    <div class="api-panel-section">
      <div class="api-panel-label">
        <span>Response</span>
        <span class="http-status ${ok ? "ok" : "fail"}">${status}</span>
      </div>
      <pre>${syntaxHighlight(responseBody)}</pre>
    </div>
  `;
  panelEl.classList.add("is-visible");
  const copyBtn = panelEl.querySelector("[data-copy]");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(JSON.stringify(requestBody, null, 2));
    copyBtn.textContent = "Copied";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  });
}

// ---------- Step status helpers ----------
function setStepStatus(stepEl, statusText, statusClass) {
  const badge = stepEl.querySelector("[data-status]");
  badge.textContent = statusText;
  badge.className = `step-status ${statusClass}`;
}

function markStepDone(stepEl) {
  stepEl.classList.remove("is-active", "is-disabled");
  stepEl.classList.add("is-done");
  setStepStatus(stepEl, "Complete", "done");
}

function markStepError(stepEl) {
  setStepStatus(stepEl, "Failed", "error");
}

function activateStep(stepEl) {
  stepEl.classList.remove("is-disabled");
  stepEl.classList.add("is-active");
  setStepStatus(stepEl, "In progress", "active");
  stepEl.querySelectorAll("button").forEach((b) => (b.disabled = false));
}

function setButtonLoading(btn, loading) {
  btn.classList.toggle("is-loading", loading);
  btn.disabled = loading;
}

// ---------- Generic call helper ----------
async function callApi({ btn, panel, method, path, requestBody }) {
  setButtonLoading(btn, true);
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    const responseBody = await res.json();
    renderApiPanel(panel, { method, path, requestBody, status: res.status, responseBody });
    setButtonLoading(btn, false);
    return { ok: res.ok, status: res.status, body: responseBody };
  } catch (err) {
    renderApiPanel(panel, {
      method,
      path,
      requestBody,
      status: 0,
      responseBody: { error: err.message }
    });
    setButtonLoading(btn, false);
    return { ok: false, status: 0, body: { error: err.message } };
  }
}

// ---------- Step 1: Sign up ----------
const stepSignup = document.getElementById("step-signup");
const btnSignup = document.getElementById("btn-signup");
const panelSignup = document.getElementById("panel-signup");

btnSignup.addEventListener("click", async () => {
  const name = document.getElementById("input-name").value.trim();
  const email = document.getElementById("input-email").value.trim();
  if (!name || !email) return;

  const requestBody = { name, email };
  const result = await callApi({
    btn: btnSignup,
    panel: panelSignup,
    method: "POST",
    path: "/sign-up",
    requestBody
  });

  if (result.ok) {
    state.customerId = result.body.stripe_customer_id;
    state.metronomeCustomerId = result.body.metronome_customer_id;
    markStepDone(stepSignup);
    activateStep(document.getElementById("step-checkout"));
  } else {
    markStepError(stepSignup);
  }
});

// ---------- Step 2: Checkout session ----------
const stepCheckout = document.getElementById("step-checkout");
const btnCheckout = document.getElementById("btn-checkout");
const panelCheckout = document.getElementById("panel-checkout");

btnCheckout.addEventListener("click", async () => {
  const requestBody = { customer_id: state.customerId };
  const result = await callApi({
    btn: btnCheckout,
    panel: panelCheckout,
    method: "POST",
    path: "/create-checkout-session",
    requestBody
  });

  if (result.ok) {
    markStepDone(stepCheckout);
    activateStep(document.getElementById("step-default-pm"));
    if (result.body.url) window.open(result.body.url, "_blank");
  } else {
    markStepError(stepCheckout);
  }
});

// ---------- Step 3: Set default payment method ----------
const stepDefaultPm = document.getElementById("step-default-pm");
const btnDefaultPm = document.getElementById("btn-default-pm");
const panelDefaultPm = document.getElementById("panel-default-pm");

btnDefaultPm.addEventListener("click", async () => {
  const requestBody = { customer_id: state.customerId };
  const result = await callApi({
    btn: btnDefaultPm,
    panel: panelDefaultPm,
    method: "POST",
    path: "/set-default-payment-method",
    requestBody
  });

  if (result.ok) {
    markStepDone(stepDefaultPm);
    activateStep(document.getElementById("step-contract"));
  } else {
    markStepError(stepDefaultPm);
  }
});

// ---------- Step 4: Create contract ----------
const stepContract = document.getElementById("step-contract");
const btnContract = document.getElementById("btn-contract");
const panelContract = document.getElementById("panel-contract");

btnContract.addEventListener("click", async () => {
  const requestBody = { customer_id: state.metronomeCustomerId };
  const result = await callApi({
    btn: btnContract,
    panel: panelContract,
    method: "POST",
    path: "/create-contract",
    requestBody
  });

  if (result.ok) {
    state.contractId = result.body.contract && result.body.contract.data && result.body.contract.data.id;
    markStepDone(stepContract);
    activateStep(document.getElementById("step-usage"));
  } else {
    markStepError(stepContract);
  }
});

// ---------- Step 5: Send usage event ----------
const stepUsage = document.getElementById("step-usage");
const btnUsage = document.getElementById("btn-usage");
const panelUsage = document.getElementById("panel-usage");

btnUsage.addEventListener("click", async () => {
  const requestBody = { customer_id: state.metronomeCustomerId };
  const result = await callApi({
    btn: btnUsage,
    panel: panelUsage,
    method: "POST",
    path: "/post-usage",
    requestBody
  });

  if (result.ok) {
    markStepDone(stepUsage);
    btnUsage.disabled = false;
    btnUsage.querySelector(".label").textContent = "Send another usage event";
  } else {
    markStepError(stepUsage);
  }
});
