if (window.__codeScriptRan) {
  console.log("Code script already ran.");
} else {
  window.__codeScriptRan = true;

  async function fillCode() {
    const data = await chrome.storage.local.get("verifyCode");
    if (!data.verifyCode) { console.warn("No verification code stored."); return; }
    const code = data.verifyCode;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;

      const splitInputs = document.querySelectorAll('input[id^="codeEntry"]');
      const singleInput = document.querySelector('input[name="ftfa"], input[id*="code"], input[aria-label*="code" i]');

      if (splitInputs.length >= 6) {
        clearInterval(interval);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        splitInputs.forEach((input, i) => {
          setter.call(input, code[i]);
          input.dispatchEvent(new Event('input',  { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        console.log("Split code filled.");
        setTimeout(clickVerify, 600);
      } else if (singleInput) {
        clearInterval(interval);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(singleInput, code);
        singleInput.dispatchEvent(new Event('input',  { bubbles: true }));
        singleInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log("Single code input filled.");
        setTimeout(clickVerify, 600);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn("Code input not found.");
      }
    }, 500);
  }

  function clickVerify() {
    const btn =
      document.querySelector('button[data-testid="primaryButton"]') ||
      document.querySelector('button[type="submit"]') ||
      [...document.querySelectorAll('button')].find(b => /next|verify|confirm/i.test(b.textContent));
    if (btn) { btn.click(); console.log("Verify clicked."); }
  }

  fillCode();
}
