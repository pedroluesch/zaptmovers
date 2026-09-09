const SMARTMOVING_URL = 'https://api.smartmoving.com/api/leads/from-provider/v2';

// Optional: SmartMoving branch IDs so leads land in the right market.
// Find them in SmartMoving under Settings > Sales > Lead Providers.
const BRANCH_IDS = {
  bay: '',
  la: '',
  dfw: ''
};

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
    });
  }

  const key = process.env.SMARTMOVING_PROVIDER_KEY;
  if (!key) {
    console.error('SMARTMOVING_PROVIDER_KEY environment variable is not set');
    return new Response(
      JSON.stringify({ error: 'SMARTMOVING_PROVIDER_KEY is not set in Netlify environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let lead;
  try {
    lead = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!lead || (!lead.fullName && !lead.firstName)) {
    return new Response(JSON.stringify({ error: 'Missing name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (lead.company) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  delete lead.company;

  let url = `${SMARTMOVING_URL}?providerKey=${encodeURIComponent(key)}`;
  const branch = BRANCH_IDS[lead.branch];
  if (branch) url += `&branchId=${encodeURIComponent(branch)}`;
  delete lead.branch;

  try {
    const smResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });

    const text = await smResponse.text();

    if (!smResponse.ok) {
      console.error('SmartMoving rejected lead:', smResponse.status, text, JSON.stringify(lead));
      return new Response(text, {
        status: smResponse.status,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    console.log('Lead accepted by SmartMoving:', lead.firstName || lead.fullName, lead.phoneNumber);

    // RECOMMENDED by SmartMoving: also email yourself a copy, so an outage
    // on their side never costs you a lead. Add your email provider here.

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Could not reach SmartMoving:', err, JSON.stringify(lead));
    return new Response(JSON.stringify({ error: 'Upstream unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/lead' };
