if (window.__nameScriptRan) {
  console.log("Name script already ran.");
} else {
  window.__nameScriptRan = true;

  async function fillName() {
    const data = await chrome.storage.local.get("name");
    const firstName = data.name?.first || "John";
    const lastName  = data.name?.last  || "Smith";

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const firstInput = document.querySelector('input#firstNameInput, input[name="firstNameInput"]');
      const lastInput  = document.querySelector('input#lastNameInput,  input[name="lastNameInput"]');

      if (firstInput && lastInput) {
        clearInterval(interval);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

        setter.call(firstInput, firstName);
        firstInput.dispatchEvent(new Event('input',  { bubbles: true }));
        firstInput.dispatchEvent(new Event('change', { bubbles: true }));

        setter.call(lastInput, lastName);
        lastInput.dispatchEvent(new Event('input',  { bubbles: true }));
        lastInput.dispatchEvent(new Event('change', { bubbles: true }));

        console.log("Name filled:", firstName, lastName);

        setTimeout(() => {
          const nextBtn =
            document.querySelector('button[data-testid="primaryButton"]') ||
            document.querySelector('button[type="submit"]') ||
            [...document.querySelectorAll('button')].find(b => b.textContent.trim() === "Next");
          if (nextBtn && !nextBtn.disabled) { nextBtn.focus(); nextBtn.click(); console.log("Next clicked."); }
        }, 800);

      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn("Name fields not found.");
      }
    }, 500);
  }

  fillName();
}
