/*
  Zapt Movers — shared quote form.

  One implementation, used by the home page and every city page. Fix a bug here
  and it is fixed everywhere.

  Usage:
    <div id="zapt-quote"></div>
    <script src="/assets/quote-form.js"></script>
    <script>
      ZaptQuoteForm.mount('#zapt-quote', {
        city: 'Plano, TX',              // optional, tags the lead with its landing page
        phoneDisplay: '(469) 868-8785', // shown in success and error messages
        phoneHref: '+14698688785'
      });
    </script>

  On the home page an estimator is also passed in, so the price the visitor saw
  travels with the lead. See the mount call at the bottom of index.html.
*/
(function () {
  'use strict';

  var CONFIG = {
    leadEndpoint: '/api/lead',
    defaultReferralSource: 'Your Website',
    phoneDisplay: '(415) 843-2532',
    phoneHref: '+14158432532'
  };

  // Left value is what the visitor sees. data-crm is what SmartMoving stores —
  // it must match Settings > Sales > Move Sizes exactly or a duplicate is created.
  var SIZES = [
    { v: 'studio', crm: '1 Bedroom',  en: 'Studio / 1 bedroom',   pt: 'Studio / 1 quarto',        beds: '1' },
    { v: 'two',    crm: '2 Bedrooms', en: '2 bedrooms',           pt: '2 quartos',                beds: '2' },
    { v: 'three',  crm: '3 Bedrooms', en: '3 bedrooms',           pt: '3 quartos',                beds: '3' },
    { v: 'four',   crm: '4+ Bedrooms',en: '4+ bedrooms',          pt: '4+ quartos',               beds: '4+' },
    { v: 'office', crm: 'Office',     en: 'Office / commercial',  pt: 'Escritório / comercial',   beds: 'Office' }
  ];

  // Must match Settings > Sales > Referral Sources in SmartMoving.
  var REFERRALS = [
    { v: 'Google',          en: 'Google',                      pt: 'Google' },
    { v: 'Yelp',            en: 'Yelp',                        pt: 'Yelp' },
    { v: 'Facebook',        en: 'Facebook or Instagram',       pt: 'Facebook ou Instagram' },
    { v: 'Referral',        en: 'Friend or family',            pt: 'Indicação de amigo ou familiar' },
    { v: 'Repeat Customer', en: "I've moved with you before",  pt: 'Já me mudei com vocês' },
    { v: 'Realtor',         en: 'Realtor or property manager', pt: 'Corretor ou administradora' },
    { v: 'Other',           en: 'Something else',              pt: 'Outro' }
  ];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function isPt() {
    return document.documentElement.lang.slice(0, 2).toLowerCase() === 'pt';
  }

  function parsePlace(raw) {
    var out = {};
    var s = (raw || '').trim();
    if (!s) return out;
    var zip = s.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zip) out.zip = zip[1];
    var parts = s.replace(/\b\d{5}(-\d{4})?\b/, '').split(',')
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
    if (parts.length >= 2) {
      out.city = parts[0];
      out.state = parts[1].replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
    } else if (parts.length === 1) {
      out.city = parts[0];
    }
    return out;
  }

  function splitName(full) {
    var bits = full.trim().split(/\s+/);
    if (bits.length < 2) return { fullName: full.trim() };
    return { firstName: bits[0], lastName: bits.slice(1).join(' ') };
  }

  function template(id, opts) {
    var sizeOpts = SIZES.map(function (s, i) {
      return '<option value="' + s.v + '" data-crm="' + esc(s.crm) + '" data-beds="' + s.beds +
        '" data-en="' + esc(s.en) + '" data-pt="' + esc(s.pt) + '"' +
        (i === 1 ? ' selected' : '') + '>' + esc(s.en) + '</option>';
    }).join('');

    var refOpts = REFERRALS.map(function (r) {
      return '<option value="' + esc(r.v) + '" data-en="' + esc(r.en) + '" data-pt="' + esc(r.pt) + '">' +
        esc(r.en) + '</option>';
    }).join('');

    return '' +
      '<div class="row">' +
        '<div class="field"><label for="' + id + '-name" data-en="Name" data-pt="Nome">Name</label>' +
        '<input type="text" id="' + id + '-name" autocomplete="name"></div>' +
        '<div class="field"><label for="' + id + '-phone" data-en="Phone" data-pt="Telefone">Phone</label>' +
        '<input type="tel" id="' + id + '-phone" autocomplete="tel"></div>' +
      '</div>' +
      '<div class="field"><label for="' + id + '-email" data-en="Email" data-pt="E-mail">Email</label>' +
      '<input type="text" id="' + id + '-email" autocomplete="email" inputmode="email"></div>' +
      '<div class="row">' +
        '<div class="field"><label for="' + id + '-from" data-en="Moving from" data-pt="Sai de">Moving from</label>' +
        '<input type="text" id="' + id + '-from" placeholder="' + esc(opts.fromPlaceholder) + '"></div>' +
        '<div class="field"><label for="' + id + '-to" data-en="Moving to" data-pt="Vai para">Moving to</label>' +
        '<input type="text" id="' + id + '-to" placeholder="' + esc(opts.toPlaceholder) + '"></div>' +
      '</div>' +
      '<div class="field"><label for="' + id + '-date" data-en="Preferred date" data-pt="Data desejada">Preferred date</label>' +
      '<input type="date" id="' + id + '-date"></div>' +
      '<div class="row">' +
        '<div class="field"><label for="' + id + '-size" data-en="Move size" data-pt="Tamanho da mudança">Move size</label>' +
        '<select id="' + id + '-size">' + sizeOpts + '</select></div>' +
        '<div class="field"><label for="' + id + '-referral" data-en="How did you hear about us?" data-pt="Como nos conheceu?">How did you hear about us?</label>' +
        '<select id="' + id + '-referral"><option value="" data-en="Select one" data-pt="Selecione">Select one</option>' + refOpts + '</select></div>' +
      '</div>' +
      '<label class="consent" for="' + id + '-optin"><input type="checkbox" id="' + id + '-optin" checked>' +
      '<span data-en="Text me updates about my move. Message rates may apply." data-pt="Quero receber mensagens sobre a minha mudança. Podem incidir tarifas de SMS.">Text me updates about my move. Message rates may apply.</span></label>' +
      '<input class="hp" type="text" id="' + id + '-company" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="row">' +
        '<button class="btn" id="' + id + '-send"><span id="' + id + '-label" data-en="Send my request" data-pt="Enviar meu pedido">Send my request</span></button>' +
        '<a class="btn btn-ghost" href="tel:' + esc(opts.phoneHref) + '">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>' +
        '<span>' + esc(opts.phoneDisplay) + '</span></a>' +
      '</div>' +
      '<p class="err" id="' + id + '-err" style="display:none"></p>' +
      '<p class="form-note" data-en="Goes straight into our dispatch system. We reply the same day." data-pt="Vai direto para o nosso sistema de despacho. Respondemos no mesmo dia.">Goes straight into our dispatch system. We reply the same day.</p>' +
      '<div class="status" id="' + id + '-status" role="status" aria-live="polite"></div>';
  }

  var counter = 0;

  function mount(target, options) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return null;

    var opts = options || {};
    opts.phoneDisplay = opts.phoneDisplay || CONFIG.phoneDisplay;
    opts.phoneHref = opts.phoneHref || CONFIG.phoneHref;
    opts.fromPlaceholder = opts.fromPlaceholder || 'San Francisco, CA 94110';
    opts.toPlaceholder = opts.toPlaceholder || 'Dallas, TX 75208';

    var id = 'zq' + (++counter);
    host.innerHTML = template(id, opts);

    var el = function (suffix) { return document.getElementById(id + '-' + suffix); };
    var nameEl = el('name'), phoneEl = el('phone'), sizeEl = el('size');
    var sendEl = el('send'), labelEl = el('label'), errEl = el('err'), statusEl = el('status');

    ['name', 'phone'].forEach(function (f) {
      el(f).addEventListener('input', function () {
        el(f).classList.remove('bad-field');
        errEl.style.display = 'none';
      });
    });

    var api = {
      element: host,
      sizeSelect: sizeEl,
      setSize: function (v) { sizeEl.value = v; }
    };

    function buildLead() {
      var val = function (f) { return el(f).value.trim(); };
      var origin = parsePlace(val('from'));
      var dest = parsePlace(val('to'));
      var opt = sizeEl.options[sizeEl.selectedIndex];

      var est = (typeof opts.estimator === 'function') ? (opts.estimator() || {}) : {};
      var packing = !!(est.extras && est.extras.some(function (x) { return /pack/i.test(x); }));

      var notes = [
        'Move size: ' + (opt.getAttribute('data-en') || opt.textContent.trim()),
        est.distance ? 'Distance: ' + est.distance : null,
        est.extras && est.extras.length ? 'Requested extras: ' + est.extras.join(', ') : null,
        est.amount ? 'Site estimate shown: ' + est.amount : null,
        'Origin as typed: ' + (val('from') || '—'),
        'Destination as typed: ' + (val('to') || '—'),
        'Landing page: ' + (opts.city ? opts.city + ' (' + location.pathname + ')' : location.pathname),
        'Form language: ' + (isPt() ? 'Portuguese' : 'English')
      ].filter(Boolean).join(' | ');

      var lead = splitName(val('name'));
      lead.phoneNumber = val('phone');
      lead.phoneType = 'Mobile';
      lead.userOptIn = el('optin').checked;
      lead.email = val('email');
      lead.bedrooms = opt.getAttribute('data-beds');
      lead.moveSize = opt.getAttribute('data-crm');
      lead.serviceType = packing ? 'MovingAndPacking' : 'Moving';
      lead.referralSource = el('referral').value || CONFIG.defaultReferralSource;
      lead.notes = notes;
      if (opts.branch) lead.branch = opts.branch;

      var d = val('date');
      if (d) lead.moveDate = d.replace(/-/g, '');

      if (origin.city) lead.originCity = origin.city;
      if (origin.state) lead.originState = origin.state;
      if (origin.zip) lead.originZip = origin.zip;
      if (dest.city) lead.destinationCity = dest.city;
      if (dest.state) lead.destinationState = dest.state;
      if (dest.zip) lead.destinationZip = dest.zip;

      var q = new URLSearchParams(location.search);
      var utm = { utm_source: 'UtmSource', utm_medium: 'UtmMedium', utm_campaign: 'UtmCampaign',
                  utm_content: 'UtmContent', utm_term: 'UtmKeyword' };
      Object.keys(utm).forEach(function (k) { if (q.get(k)) lead[utm[k]] = q.get(k); });

      return lead;
    }

    function say(kind, title, body) {
      statusEl.className = 'status ' + kind;
      statusEl.innerHTML = '<h3>' + title + '</h3><p>' + body + '</p>';
    }

    sendEl.addEventListener('click', function () {
      var pt = isPt();
      var phone = opts.phoneDisplay;
      errEl.style.display = 'none';
      nameEl.classList.remove('bad-field');
      phoneEl.classList.remove('bad-field');

      if (!nameEl.value.trim()) {
        nameEl.classList.add('bad-field');
        errEl.textContent = pt ? 'Informe o seu nome.' : 'Enter your name.';
        errEl.style.display = 'block';
        nameEl.focus();
        return;
      }
      if (phoneEl.value.replace(/\D/g, '').length < 10) {
        phoneEl.classList.add('bad-field');
        errEl.textContent = pt ? 'Informe um telefone com DDD.' : 'Enter a phone number with area code.';
        errEl.style.display = 'block';
        phoneEl.focus();
        return;
      }
      if (el('company').value) return;

      if (location.protocol === 'file:') {
        say('bad',
          pt ? 'Formulário desativado localmente.' : 'Form disabled locally.',
          pt ? 'Você abriu o arquivo direto do computador. O envio só funciona com o site publicado.'
             : 'You opened this file straight from your computer. Submitting only works on the deployed site.');
        console.warn('Zapt form: running from file:// — /api/lead is not reachable.');
        return;
      }

      sendEl.disabled = true;
      labelEl.textContent = pt ? 'Enviando…' : 'Sending…';

      fetch(CONFIG.leadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildLead())
      }).then(function (res) {
        return res.text().then(function (body) { return { res: res, body: body }; });
      }).then(function (r) {
        if (r.res.ok) {
          say('ok',
            pt ? 'Recebemos o seu pedido.' : 'Got it — you\u2019re in.',
            pt ? 'Um coordenador vai ligar hoje mesmo com o seu preço. Se preferir falar agora: ' + phone + '.'
               : 'A coordinator will call you today with your price. Want it sooner? Call ' + phone + '.');
          sendEl.style.display = 'none';
          if (typeof opts.onSuccess === 'function') opts.onSuccess();
          return;
        }

        console.error('Zapt form: lead endpoint returned HTTP ' + r.res.status, r.body);

        if (r.res.status === 400 && /already been submitted/i.test(r.body)) {
          say('ok',
            pt ? 'Já temos o seu pedido.' : 'We already have this one.',
            pt ? 'Este pedido já está no nosso sistema e alguém vai entrar em contato. Precisa falar agora? ' + phone + '.'
               : 'Your request is already in our system and someone is on it. Need us sooner? Call ' + phone + '.');
          sendEl.style.display = 'none';
          return;
        }
        if (r.res.status === 404) {
          console.error('Zapt form: /api/lead not found. The Netlify function did not deploy.');
        }
        if (r.res.status === 500 && /PROVIDER_KEY/i.test(r.body)) {
          console.error('Zapt form: SMARTMOVING_PROVIDER_KEY missing. Add it, then trigger a NEW deploy.');
        }
        throw new Error('HTTP ' + r.res.status);
      }).catch(function (err) {
        console.error('Zapt form: submission failed.', err);
        say('bad',
          pt ? 'Não conseguimos enviar.' : 'That didn\u2019t go through.',
          pt ? 'Algo falhou no envio. Ligue para ' + phone + ' e um coordenador atende você na hora.'
             : 'Something failed on our end. Call ' + phone + ' and a coordinator will take your details right now.');
      }).then(function () {
        sendEl.disabled = false;
        labelEl.textContent = pt ? 'Enviar meu pedido' : 'Send my request';
      });
    });

    return api;
  }

  window.ZaptQuoteForm = { mount: mount, config: CONFIG, sizes: SIZES };
})();
