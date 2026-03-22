const emailDisplay = document.getElementById("emailDisplay");
const statusText   = document.getElementById("statusText");
const dot          = document.getElementById("dot");

function setStatus(msg, color) {
  statusText.textContent = msg;
  dot.className = "dot" + (color ? " " + color : "");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getMicrosoftTab() {
  const tabs = await chrome.tabs.query({ url: "https://signup.live.com/*" });
  return tabs.length > 0 ? tabs[0] : null;
}

chrome.storage.local.get("tempEmail", (data) => {
  if (data.tempEmail) emailDisplay.textContent = data.tempEmail;
});

// ── Step 1: Create mailbox + open signup tab ──────────────────────────────────
document.getElementById("btnCreate").addEventListener("click", async () => {
  setStatus("Creating mailbox...", "yellow");
  document.getElementById("btnCreate").disabled = true;

  chrome.runtime.sendMessage({ type: "CREATE_MAILBOX" }, async (res) => {
    document.getElementById("btnCreate").disabled = false;
    if (res.ok) {
      emailDisplay.textContent = res.email;
      setStatus("Email ready! Opening Microsoft...", "yellow");
      chrome.tabs.create({ url: "https://signup.live.com/" }, () => {
        setStatus("signup.live.com opened!", "green");
      });
    } else {
      setStatus("Error: " + res.error);
    }
  });
});

// ── Step 2: Fill email + Next ─────────────────────────────────────────────────
document.getElementById("btnFill").addEventListener("click", async () => {
  const data = await chrome.storage.local.get("tempEmail");
  if (!data.tempEmail) { setStatus("Create an email first!"); return; }
  const tab = await getMicrosoftTab();
  if (!tab) { setStatus("Open signup.live.com first!"); return; }
  setStatus("Filling form...", "yellow");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["microsoft_script.js"] });
  setStatus("Done!", "green");
});

// ── Steps 4 + 5 as reusable functions ────────────────────────────────────────

async function runStep4() {
  const month = document.getElementById("dobMonth").value || "5";
  const day   = document.getElementById("dobDay").value   || "18";
  const year  = document.getElementById("dobYear").value  || "2000";
  await chrome.storage.local.set({ dob: { month, day, year } });

  const tab = await getMicrosoftTab();
  if (!tab) { setStatus("Microsoft tab closed!"); return false; }

  setStatus("Filling DOB, Next in ~4s...", "yellow");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["dob_script.js"] });
  await sleep(4000); // dob_script waits 4s internally before clicking Next
  setStatus("DOB filled + Next clicked!", "green");
  return true;
}

async function runStep5() {
  const first = document.getElementById("nameFirst").value.trim() || "John";
  const last  = document.getElementById("nameLast").value.trim()  || "Smith";
  await chrome.storage.local.set({ name: { first, last } });

  const tab = await getMicrosoftTab();
  if (!tab) { setStatus("Microsoft tab closed!"); return false; }

  setStatus("Filling name...", "yellow");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["name_script.js"] });
  await sleep(3000);

  chrome.runtime.sendMessage({ type: "START_WATCHER" });
  setStatus("Done! Watching inbox for codes...", "green");
  return true;
}

// ── Step 3: Poll code → auto-run Steps 4 & 5 ─────────────────────────────────
document.getElementById("btnCode").addEventListener("click", async () => {
  setStatus("Waiting for code...", "yellow");
  document.getElementById("btnCode").disabled = true;

  let attempts = 0;
  const poll = setInterval(async () => {
    attempts++;
    setStatus("Checking inbox... (" + attempts + "/24)", "yellow");

    chrome.runtime.sendMessage({ type: "POLL_CODE" }, async (res) => {
      if (res.ok && res.code) {
        clearInterval(poll);
        document.getElementById("btnCode").disabled = false;

        // Fill the code on the page
        const tab = await getMicrosoftTab();
        if (tab) {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["code_script.js"] });
          setStatus("Code " + res.code + " filled! Waiting for next page...", "yellow");
        } else {
          setStatus("Code: " + res.code + " — Microsoft tab closed!"); return;
        }

        // Wait for Microsoft to navigate to DOB page after code submit
        await sleep(4000);

        // Auto-run Step 4 (DOB)
        const step4ok = await runStep4();
        if (!step4ok) return;

        // Auto-run Step 5 (Name) — wait 3s for name page to load after DOB Next
        await sleep(3000);
        await runStep5();

      } else if (attempts >= 24) {
        clearInterval(poll);
        document.getElementById("btnCode").disabled = false;
        setStatus("Timed out waiting for code.");
      }
    });
  }, 5000);
});

// ── Step 4: Manual fallback button ───────────────────────────────────────────
document.getElementById("btnDOB").addEventListener("click", async () => {
  await runStep4();
});

// ── Step 5: Manual fallback button ───────────────────────────────────────────
document.getElementById("btnName").addEventListener("click", async () => {
  await runStep5();
});

// ── Reset ─────────────────────────────────────────────────────────────────────
document.getElementById("btnClear").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_WATCHER" });
  chrome.storage.local.clear(() => {
    emailDisplay.textContent = "";
    setStatus("Cleared.");
    dot.className = "dot";
  });
});

// ── Clear browser data ────────────────────────────────────────────────────────
document.getElementById("btnNuke").addEventListener("click", async () => {
  setStatus("Clearing browser data...", "yellow");
  document.getElementById("btnNuke").disabled = true;
  chrome.browsingData.remove({ since: 0 }, {
    cookies: true,
    cache: true,
    cacheStorage: true,
    downloads: true,
    fileSystems: true,
    formData: true,
    history: true,
    indexedDB: true,
    localStorage: true,
    passwords: false,
    serviceWorkers: true,
    webSQL: true
  }, () => {
    document.getElementById("btnNuke").disabled = false;
    setStatus("Browser data cleared!", "green");
  });
});
