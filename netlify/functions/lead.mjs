/*
  Zapt Movers — quote form handler.

  Takes the quote form's payload and delivers it to Move Basic.

  Environment variable (Netlify > Site configuration > Environment variables):
    MOVEBASIC_WEBHOOK_URL   full webhook address, key included
    MOVEBASIC_TEST_MODE     set to "true" to exercise the integration without
                            creating real leads (Move Basic answers with what
                            it read and saves nothing)
*/

import { toMoveBasicLead, sendLeadWithRetry } from '../lib/movebasic.mjs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' }
    });
  }

  let src;
  try {
    src = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // Honeypot: the browser never fills this, bots usually do. Answer 200 so
  // they do not learn they were caught, and save nothing.
  if (src && src.company) {
    console.log('Lead rejected: honeypot filled');
    return json({ ok: true });
  }

  const hasName = src && (src.firstName || src.fullName);
  const hasContact = src && (src.phoneNumber || src.email);
  if (!hasName || !hasContact) {
    return json({ error: 'A name and a phone or an email are needed' }, 422);
  }

  const lead = toMoveBasicLead(src);
  if (process.env.MOVEBASIC_TEST_MODE === 'true') lead.test = true;

  const r = await sendLeadWithRetry(lead);

  if (!r.ok) {
    console.error('Move Basic rejected the lead:', r.status, r.body, JSON.stringify(lead));
    // 5xx on our side too, so the browser knows it is worth a second try.
    return json({ error: 'Could not save the lead', detail: r.body }, r.retryable ? 502 : 400);
  }

  if (r.test) {
    console.log('Move Basic TEST mode — nothing saved. It read:', JSON.stringify(r.read));
    return json({ ok: true, test: true, read: r.read });
  }

  if (r.duplicate) {
    console.log('Move Basic: duplicate of', r.reference, '-', lead.phone || lead.email);
    return json({ ok: true, duplicate: true, reference: r.reference });
  }

  console.log('Move Basic created lead', r.reference, '-', lead.firstName, lead.phone);

  // Worth adding: email yourself a copy, so an outage on the CRM side never
  // costs you a lead. See booking.mjs for the Resend call to copy.

  return json({ ok: true, reference: r.reference });
};

export const config = { path: '/api/lead' };
