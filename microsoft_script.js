if (window.__msScriptRan) {
  console.log("MS script already ran.");
} else {
  window.__msScriptRan = true;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function waitFor(selector, maxMs = 8000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) { clearInterval(timer); resolve(el); }
        else if (Date.now() - start > maxMs) {
          clearInterval(timer);
          reject(new Error("Timeout: " + selector));
        }
      }, 300);
    });
  }

  async function run() {
    try {
      const data = await chrome.storage.local.get("tempEmail");
      if (!data.tempEmail) { console.warn("No temp email."); return; }

      const emailField = await waitFor(
        'input[name="MemberName"], input[name="Email"], input#floatingLabelInput4, input[type="email"]'
      );
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(emailField, data.tempEmail);
      emailField.dispatchEvent(new Event('input',  { bubbles: true }));
      emailField.dispatchEvent(new Event('change', { bubbles: true }));
      emailField.focus();
      console.log("Email filled:", data.tempEmail);
      await sleep(800);

      const nextBtn =
        document.querySelector('button[data-testid="primaryButton"]') ||
        document.querySelector('button[type="submit"]') ||
        [...document.querySelectorAll('button')].find(b => b.textContent.trim() === "Next");

      if (nextBtn) { nextBtn.click(); console.log("Next clicked."); }
      else { console.warn("Next button not found."); }

    } catch (e) {
      console.error("MS script error:", e.message);
    }
  }

  run();
}
