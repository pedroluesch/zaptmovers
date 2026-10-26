/*
  Zapt Movers — booking handler.

  Emails the full booking to sales@zaptmovers.com and drops a matching lead
  into Move Basic so it shows up in the sales pipeline.

  Environment variables (Netlify > Site configuration > Environment variables):
    RESEND_API_KEY           required for email
    SALES_EMAIL              defaults to sales@zaptmovers.com
    BOOKING_FROM_EMAIL       a verified sender on your domain
    MOVEBASIC_WEBHOOK_URL    the same webhook the quote form uses
*/

import { toMoveBasicLead, sendLeadWithRetry, webhookUrl } from '../lib/movebasic.mjs';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function money(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
}

function buildEmail(b) {
  const q = b.quote || {};
  const m = b.move || {};
  const c = b.customer || {};

  const rooms = {};
  (b.inventory || []).forEach(l => {
    (rooms[l.room] = rooms[l.room] || []).push(l);
  });

  const inventoryHtml = Object.keys(rooms).map(room => `
    <tr><td colspan="4" style="padding:14px 0 6px;font-weight:700;border-bottom:2px solid #111C2E">${esc(room)}</td></tr>
    ${rooms[room].map(l => `
      <tr>
        <td style="padding:5px 0;border-bottom:1px solid #eee">${esc(l.item)}</td>
        <td style="padding:5px 0;border-bottom:1px solid #eee;text-align:right">x${l.qty}</td>
        <td style="padding:5px 0;border-bottom:1px solid #eee;text-align:right">${l.cuft} cu ft</td>
        <td style="padding:5px 0;border-bottom:1px solid #eee;text-align:right">${l.lbs} lb</td>
      </tr>`).join('')}
  `).join('');

  const linesHtml = (q.lines || []).map(l =>
    `<tr><td style="padding:4px 0">${esc(l.label)}</td><td style="padding:4px 0;text-align:right">${money(l.amount)}</td></tr>`
  ).join('');

  const materialsHtml = (b.materials || []).length
    ? `<p><b>Materials requested:</b> ${b.materials.map(x => esc(x.id) + ' x' + x.qty).join(', ')}</p>`
    : '';

  const access = e => {
    const a = (m.access || {})[e] || {};
    let s = a.type === 'stairs' ? `stairs, ${a.flights} flight(s)`
          : a.type === 'elevator' ? 'elevator' : 'ground floor';
    if (a.longCarry) s += ' + long carry';
    return s;
  };

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:680px;color:#111C2E">
    <div style="background:#FFD100;padding:18px 22px;border-radius:10px 10px 0 0">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase">New online booking</div>
      <div style="font-size:26px;font-weight:800">${esc(c.name)} &middot; ${money(q.low)} &ndash; ${money(q.high)}</div>
    </div>
    <div style="border:1px solid #E2D4BC;border-top:0;padding:22px;border-radius:0 0 10px 10px">

      <h3 style="margin:0 0 8px">Contact</h3>
      <p style="margin:0 0 18px">
        ${esc(c.name)}<br>
        <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a><br>
        ${esc(c.email)}
      </p>

      <h3 style="margin:0 0 8px">The move</h3>
      <p style="margin:0 0 18px">
        <b>Date:</b> ${esc(m.date)} &middot; <b>Window:</b> ${esc((m.window || {}).range)}<br>
        <b>From:</b> ${esc((m.from || {}).text)}<br>
        <b>To:</b> ${esc((m.to || {}).text)}<br>
        <b>Distance:</b> ${esc(m.miles)} mi, ${esc(m.driveMinutes)} min drive<br>
        <b>Pickup access:</b> ${esc(access('origin'))}<br>
        <b>Delivery access:</b> ${esc(access('destination'))}<br>
        <b>Packing:</b> ${esc(m.packing)} &middot;
        <b>TV protection:</b> ${m.tvProtection ? 'yes' : 'no'} &middot;
        <b>Full value protection:</b> ${m.fullValueProtection ? 'yes' : 'no'}
      </p>

      <h3 style="margin:0 0 8px">Recommended</h3>
      <p style="margin:0 0 18px">
        <b>${q.movers} movers</b> &middot; <b>${esc((q.truck || {}).name)}</b> &middot;
        ${q.billableHours} billable hours (${q.laborHours} labor + ${q.travelHours} travel)<br>
        Total load: <b>${(q.inventory || {}).cuft} cu ft</b>, ${(q.inventory || {}).lbs} lb,
        ${(q.inventory || {}).pieces} items
        ${q.crewBumped ? '<br><i>Crew size was raised automatically for access or heavy items.</i>' : ''}
      </p>

      <h3 style="margin:0 0 8px">Price breakdown</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        <tr><td style="padding:4px 0">Labor ${q.movers} movers, ${q.laborHours}h @ ${money(q.hourlyRate)}</td>
            <td style="padding:4px 0;text-align:right">${money((q.laborHours || 0) * (q.hourlyRate || 0))}</td></tr>
        <tr><td style="padding:4px 0">Travel ${q.travelHours}h${q.doubleDriveTime ? ' (doubled)' : ''}</td>
            <td style="padding:4px 0;text-align:right">${money((q.travelHours || 0) * (q.hourlyRate || 0))}</td></tr>
        ${linesHtml}
        <tr><td style="padding:10px 0 0;font-weight:700;border-top:2px solid #111C2E">Estimated total</td>
            <td style="padding:10px 0 0;text-align:right;font-weight:700;border-top:2px solid #111C2E">${money(q.total)}</td></tr>
      </table>
      ${materialsHtml}

      ${c.notes ? `<h3 style="margin:0 0 8px">Customer notes</h3><p style="margin:0 0 18px">${esc(c.notes)}</p>` : ''}

      <h3 style="margin:0 0 8px">Inventory</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${inventoryHtml}</table>

      <p style="margin-top:22px;font-size:12px;color:#3A4A66">
        Submitted from ${esc(b.source)}. Prices come from /assets/pricing.json and are an estimate, not a confirmed quote.
      </p>
    </div>
  </div>`;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' }
    });
  }

  let b;
  try { b = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const c = b.customer || {};
  if (!c.name || !c.phone) {
    return new Response(JSON.stringify({ error: 'Missing name or phone' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const salesEmail = process.env.SALES_EMAIL || 'sales@zaptmovers.com';
  const fromEmail = process.env.BOOKING_FROM_EMAIL || 'bookings@zaptmovers.com';
  const resendKey = process.env.RESEND_API_KEY;

  let emailed = false;
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Zapt Booking <${fromEmail}>`,
          to: [salesEmail],
          reply_to: c.email || undefined,
          subject: `Booking: ${c.name} — ${(b.move || {}).date} — ${money((b.quote || {}).total)}`,
          html: buildEmail(b)
        })
      });
      emailed = r.ok;
      if (!r.ok) console.error('Resend rejected the email', r.status, await r.text());
    } catch (e) {
      console.error('Could not reach Resend', e);
    }
  } else {
    console.error('RESEND_API_KEY is not set — booking was not emailed.');
  }

  // Always log the full booking so nothing is lost even if email fails.
  console.log('BOOKING', JSON.stringify(b));

  let leadCreated = false;
  if (webhookUrl()) {
    const q = b.quote || {}, m = b.move || {};
    const bits = (c.name || '').trim().split(/\s+/);
    const lead = toMoveBasicLead({
      firstName: bits[0] || c.name,
      lastName: bits.slice(1).join(' '),
      phoneNumber: c.phone,
      email: c.email,
      userOptIn: c.smsOptIn === true,
      referralSource: 'Website booking',
      serviceType: m.packing && m.packing !== 'none' ? 'Moving and packing' : 'Moving',
      moveDate: m.date,
      originStreet: (m.from || {}).text,
      originCity: (m.from || {}).city,
      originState: (m.from || {}).state,
      originZip: (m.from || {}).zip,
      destinationStreet: (m.to || {}).text,
      destinationCity: (m.to || {}).city,
      destinationState: (m.to || {}).state,
      destinationZip: (m.to || {}).zip,
      bedrooms: (q.inventory || {}).bedrooms,
      landingPath: b.source,
      notes: [
        'ONLINE BOOKING REQUEST',
        `Window: ${(m.window || {}).range}`,
        `${(q.inventory || {}).cuft} cu ft, ${(q.inventory || {}).lbs} lb, ${(q.inventory || {}).pieces} items`,
        `Recommended: ${q.movers} movers, ${(q.truck || {}).name}, ${q.billableHours} billable hours`,
        `Estimate shown: ${money(q.low)} - ${money(q.high)}`,
        c.notes ? `Customer notes: ${c.notes}` : null,
        emailed ? 'Full inventory emailed to sales.' : 'EMAIL FAILED - full inventory is in the function log.'
      ].filter(Boolean).join(' | ')
    });

    const r = await sendLeadWithRetry(lead);
    leadCreated = r.ok;
    if (r.ok) {
      console.log('Move Basic booking lead', r.reference, r.duplicate ? '(duplicate)' : '');
    } else {
      console.error('Move Basic rejected booking lead', r.status, r.body);
    }
  } else {
    console.error('MOVEBASIC_WEBHOOK_URL is not set - booking was not sent to the CRM.');
  }

  if (!emailed && !leadCreated) {
    return new Response(JSON.stringify({ error: 'Booking could not be delivered' }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true, emailed, leadCreated }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/booking' };
