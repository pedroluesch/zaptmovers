/*
  OPTIONAL — server-side proxy for SmartMoving leads.

  Why you might want this:
  The provider key is visible in the page source when the browser posts
  directly to SmartMoving. Anyone can read it and push junk leads into
  your CRM. This proxy keeps the key on the server instead.

  How to use it:
  1. Deploy on Vercel  -> save as /api/lead.js
     Deploy on Netlify -> save as /netlify/functions/lead.js
  2. Set an environment variable in your host's dashboard:
        SMARTMOVING_PROVIDER_KEY = 98f4b618-0190-4506-a109-aba7005c6e31
  3. In zapt-movers-v2.html change CONFIG.leadEndpoint to:
        leadEndpoint: "/api/lead"
     and delete the provider key from that file.

  If your site is hosted somewhere with no server (plain static hosting,
  Framer, S3), skip this file — the page already works posting directly.
*/

const SMARTMOVING_URL = 'https://api.smartmoving.com/api/leads/from-provider/v2';

// Optional: SmartMoving branch IDs, so leads land in the right market.
// Get these from Settings > Sales > Lead Providers in SmartMoving.
const BRANCH_IDS = {
  bay: '',
  la: '',
  dfw: ''
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.SMARTMOVING_PROVIDER_KEY;
  if (!key) {
    console.error('SMARTMOVING_PROVIDER_KEY is not set');
    return res.status(500).json({ error: 'Server not configured' });
  }

  const lead = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  if (!lead || (!lead.fullName && !lead.firstName)) {
    return res.status(400).json({ error: 'Missing name' });
  }

  // Honeypot: the browser never fills this, bots usually do.
  if (lead.company) {
    return res.status(200).json({ ok: true });
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
      console.error('SmartMoving rejected lead', smResponse.status, text, lead);
      return res.status(smResponse.status).send(text);
    }

    /*
      STRONGLY RECOMMENDED by SmartMoving: email yourself a copy of every
      submission, so a SmartMoving outage never costs you a lead.
      Drop your email service call here — Resend, SendGrid, Postmark, etc.

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'leads@zaptmovers.com',
            to: 'info@zaptmovers.com',
            subject: `New website lead: ${lead.firstName || lead.fullName}`,
            text: JSON.stringify(lead, null, 2)
          })
        });
    */

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Failed to reach SmartMoving', err, lead);
    return res.status(502).json({ error: 'Upstream unavailable' });
  }
}
