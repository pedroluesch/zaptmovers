/*
  Zapt Movers — Move Basic lead delivery.

  Single place where our form payload becomes a Move Basic lead. Both
  /api/lead and /api/booking import this, so the mapping never drifts apart.

  Environment variable (Netlify > Site configuration > Environment variables):
    MOVEBASIC_WEBHOOK_URL   the full webhook address, key included

  The key lives in the URL path, which makes the whole URL a credential.
  It must never sit in a committed file — Netlify's secrets scanning fails
  the build when it finds one, and it would be right to.
*/

const ENDPOINT = 'https://app.movebasic.us/api/lead-in';

/** Move Basic wants 2026-11-15 or 11/15/2026. Our date inputs give YYYY-MM-DD. */
export function moveDate(value) {
  if (!value) return undefined;
  const v = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}`;
  return v;
}

export function splitName(full) {
  const bits = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (bits.length === 0) return {};
  if (bits.length === 1) return { firstName: bits[0] };
  return { firstName: bits[0], lastName: bits.slice(1).join(' ') };
}

/**
 * Builds the Move Basic lead.
 *
 * `src` is our own shape, which both the quote form and the booking page
 * already produce. Anything Move Basic has no field for goes into notes,
 * because the CRM keeps the whole body but only the listed fields are read.
 */
export function toMoveBasicLead(src = {}) {
  const lead = {};

  if (src.firstName || src.lastName) {
    if (src.firstName) lead.firstName = src.firstName;
    if (src.lastName) lead.lastName = src.lastName;
  } else if (src.fullName) {
    Object.assign(lead, splitName(src.fullName));
  }

  if (src.phoneNumber) lead.phone = src.phoneNumber;
  if (src.email) lead.email = src.email;

  const d = moveDate(src.moveDate);
  if (d) lead.moveDate = d;

  // Move Basic accepts the whole address on one line in the street field.
  if (src.originStreet) lead.originStreet = src.originStreet;
  if (src.originCity) lead.originCity = src.originCity;
  if (src.originState) lead.originState = src.originState;
  if (src.originZip) lead.originZip = src.originZip;

  if (src.destinationStreet) lead.destinationStreet = src.destinationStreet;
  if (src.destinationCity) lead.destinationCity = src.destinationCity;
  if (src.destinationState) lead.destinationState = src.destinationState;
  if (src.destinationZip) lead.destinationZip = src.destinationZip;

  // Move size is ONE field in Move Basic. Sending both `bedrooms` and
  // `moveSize` would be ambiguous, so the readable label goes in notes.
  if (src.bedrooms) lead.bedrooms = src.bedrooms;

  // "Your reference" is meant for a campaign or your own lead id.
  const campaign = src.UtmCampaign || src.utm_campaign;
  lead.ref_tag = campaign ? `utm:${campaign}` : `site:${src.landingPath || '/'}`;

  const extras = [
    src.notes || null,
    src.serviceType ? `Service: ${src.serviceType}` : null,
    src.referralSource ? `Heard about us: ${src.referralSource}` : null,
    typeof src.userOptIn === 'boolean'
      ? `SMS consent: ${src.userOptIn ? 'yes' : 'no'}`
      : null,
    src.UtmSource ? `utm_source=${src.UtmSource}` : null,
    src.UtmMedium ? `utm_medium=${src.UtmMedium}` : null,
    src.UtmCampaign ? `utm_campaign=${src.UtmCampaign}` : null,
    src.UtmContent ? `utm_content=${src.UtmContent}` : null,
    src.UtmKeyword ? `utm_term=${src.UtmKeyword}` : null
  ].filter(Boolean);

  if (extras.length) lead.notes = extras.join(' | ');
  if (src.test === true) lead.test = true;

  return lead;
}

/** Where to POST. Falls back to the documented path form if only a key is set. */
export function webhookUrl() {
  const full = (process.env.MOVEBASIC_WEBHOOK_URL || '').trim();
  if (full) return full;
  const key = (process.env.MOVEBASIC_API_KEY || '').trim();
  return key ? `${ENDPOINT}/${encodeURIComponent(key)}` : '';
}

/**
 * Sends the lead. Returns { ok, status, duplicate, reference, body, retryable }.
 * Per the spec: retry only on 5xx, never on 2xx or 4xx.
 */
export async function sendLead(lead) {
  const url = webhookUrl();
  if (!url) {
    return {
      ok: false, status: 500, retryable: false,
      body: 'MOVEBASIC_WEBHOOK_URL is not set in Netlify environment variables'
    };
  }

  let res, text;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    text = await res.text();
  } catch (err) {
    console.error('Move Basic unreachable:', err);
    return { ok: false, status: 502, retryable: true, body: 'Could not reach Move Basic' };
  }

  let data = {};
  try { data = JSON.parse(text); } catch { /* keep the raw text */ }

  return {
    ok: res.ok && data.ok !== false,
    status: res.status,
    duplicate: data.duplicate === true,
    reference: data.reference,
    test: data.test === true,
    read: data.read,
    body: text,
    retryable: res.status >= 500
  };
}

/** One retry, a second apart, and only when the spec says it is safe. */
export async function sendLeadWithRetry(lead) {
  let r = await sendLead(lead);
  if (!r.ok && r.retryable) {
    console.warn('Move Basic returned', r.status, '— retrying once in 1s');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    r = await sendLead(lead);
  }
  return r;
}
