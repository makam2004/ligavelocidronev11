async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  try {
    return { ok: response.ok, status: response.status, data: JSON.parse(text) };
  } catch {
    return { ok: response.ok, status: response.status, data: { raw: text } };
  }
}

const els = {
  pilotUserId: document.getElementById('pilotUserId'),
  pilotName: document.getElementById('pilotName'),
  pilotCountry: document.getElementById('pilotCountry'),
  submitPilot: document.getElementById('submitPilot'),
  pilotSignupResult: document.getElementById('pilotSignupResult')
};

function setResult(payload) {
  els.pilotSignupResult.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}

async function submitPilot() {
  const payload = {
    user_id: Number(els.pilotUserId.value),
    name: els.pilotName.value.trim(),
    country: els.pilotCountry.value.trim()
  };

  const response = await fetchJson('/api/pilots/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  setResult(response.data);

  if (response.ok) {
    els.pilotUserId.value = '';
    els.pilotName.value = '';
    els.pilotCountry.value = '';
  }
}

els.submitPilot.addEventListener('click', submitPilot);
