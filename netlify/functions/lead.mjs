/*
  Zapt Movers — quote form handler.

  Takes the quote form's payload and delivers it to Move Basic.

  Environment variable (Netlify > Site configuration > Environment variables):
    MOVEBASIC_WEBHOOK_URL   full webhook address, key included
    MOVEBASIC_TEST_MODE     set to "true" to exercise the integration without
                            creating real leads (Move Basic answers with what
                            it read and saves nothing)
*/

import {
  toMoveBasicLead,
  sendLeadWithRetry
} from '../lib/movebasic.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://www.zaptmovers.com',
  'https://zaptmovers.com',
  'https://youthful-success-648235.framer.app',
  'https://zaptmovers.netlify.app'
]);

function getCorsHeaders(req) {
  const origin = req.headers.get('origin');

  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };

  if (!origin) {
    return headers;
  }

  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(req)
    }
  });

export default async (req) => {
  const origin = req.headers.get('origin');

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(req, { error: 'Origin not allowed' }, 403);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req)
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          Allow: 'POST, OPTIONS',
          ...getCorsHeaders(req)
        }
      }
    );
  }

  let src;

  try {
    src = await req.json();
  } catch {
    return json(req, { error: 'Invalid JSON' }, 400);
  }

  // Honeypot: the browser never fills this, bots usually do.
  if (src && src.company) {
    console.log('Lead rejected: honeypot filled');
    return json(req, { ok: true });
  }

  const hasName =
    src &&
    (
      src.firstName ||
      src.fullName
    );

  const hasContact =
    src &&
    (
      src.phoneNumber ||
      src.phone ||
      src.email
    );

  if (!hasName || !hasContact) {
    return json(
      req,
      {
        error: 'A name and a phone or an email are needed'
      },
      422
    );
  }

  const lead = toMoveBasicLead(src);

  if (process.env.MOVEBASIC_TEST_MODE === 'true') {
    lead.test = true;
  }

  const r = await sendLeadWithRetry(lead);

  if (!r.ok) {
    console.error(
      'Move Basic rejected the lead:',
      r.status,
      r.body,
      JSON.stringify(lead)
    );

    return json(
      req,
      {
        error: 'Could not save the lead',
        detail: r.body
      },
      r.retryable ? 502 : 400
    );
  }

  if (r.test) {
    console.log(
      'Move Basic TEST mode — nothing saved. It read:',
      JSON.stringify(r.read)
    );

    return json(req, {
      ok: true,
      test: true,
      read: r.read
    });
  }

  if (r.duplicate) {
    console.log(
      'Move Basic: duplicate of',
      r.reference,
      '-',
      lead.phone || lead.email
    );

    return json(req, {
      ok: true,
      duplicate: true,
      reference: r.reference
    });
  }

  console.log(
    'Move Basic created lead',
    r.reference,
    '-',
    lead.firstName,
    lead.phone
  );

  return json(req, {
    ok: true,
    reference: r.reference
  });
};

export const config = {
  path: '/api/lead'
};
