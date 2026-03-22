if (window.__dobScriptRan) {
  console.log("DOB script already ran.");
} else {
  window.__dobScriptRan = true;

  const MONTHS = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function selectFluentDropdown(btn, matchText) {
    document.body.click();
    await sleep(300);
    btn.click();
    await sleep(800);

    const options = [...document.querySelectorAll('[role="option"]')];
    console.log("Options:", options.map(o => o.textContent.trim()));

    const match = options.find(o => o.textContent.trim().toLowerCase() === matchText.toLowerCase());
    if (match) {
      match.click();
      console.log("Selected:", match.textContent.trim());
      await sleep(500);
      return true;
    }
    console.warn("No option matched:", matchText);
    document.body.click();
    await sleep(300);
    return false;
  }

  async function fillDOB() {
    const data = await chrome.storage.local.get("dob");
    const monthNum  = parseInt(data.dob?.month || "5", 10);
    const day       = String(data.dob?.day   || "18");
    const year      = String(data.dob?.year  || "2000");
    const monthName = MONTHS[monthNum];

    let attempts = 0;
    const fields = await new Promise((resolve) => {
      const check = setInterval(() => {
        attempts++;
        const monthBtn  = document.querySelector('button#BirthMonthDropdown, button[name="BirthMonth"]');
        const dayBtn    = document.querySelector('button#BirthDayDropdown,   button[name="BirthDay"]');
        const yearInput = document.querySelector('input#floatingLabelInput19, input[name="BirthYear"]');
        if (monthBtn && dayBtn && yearInput) { clearInterval(check); resolve({ monthBtn, dayBtn, yearInput }); }
        else if (attempts >= 20)            { clearInterval(check); resolve(null); }
      }, 500);
    });

    if (!fields) { console.warn("DOB fields not found."); return; }
    const { monthBtn, dayBtn, yearInput } = fields;

    // Fill Year
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(yearInput, year);
    yearInput.dispatchEvent(new Event('input',  { bubbles: true }));
    yearInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log("Year filled:", year);
    await sleep(400);

    // Fill Month
    const monthOk = await selectFluentDropdown(monthBtn, monthName);
    if (!monthOk) await selectFluentDropdown(monthBtn, String(monthNum));

    // Fill Day
    await selectFluentDropdown(dayBtn, day);

    console.log("DOB filled. Clicking Next in 4s...");
    await sleep(4000);

    const nextBtn =
      document.querySelector('button[data-testid="primaryButton"]') ||
      document.querySelector('button[type="submit"]') ||
      [...document.querySelectorAll('button')].find(b => b.textContent.trim() === "Next");

    if (nextBtn && !nextBtn.disabled) { nextBtn.focus(); nextBtn.click(); console.log("Next clicked."); }
    else { console.warn("Next button not found or disabled."); }
  }

  fillDOB();
}
