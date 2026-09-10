# -*- coding: utf-8 -*-
"""Builds one landing page per city from cities.py, plus the /movers/ hub."""

import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from cities import CITIES

ROOT = pathlib.Path('/home/claude/zapt-site')
BASE = 'https://www.zaptmovers.com'
LOGO = '/assets/icon-zapt.svg'
LOGO_LIGHT = '/assets/icon-zapt-light.svg'
IMG = 'https://framerusercontent.com/images/%s.webp?width=900&height=700'

BY_SLUG = {c['slug']: c for c in CITIES}

CSS = open(pathlib.Path(__file__).parent / 'city.css').read()


def head(c):
    url = '%s/movers/%s/' % (BASE, c['slug'])
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{c['title']}</title>
<meta name="description" content="{c['meta']}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="Movers in {c['city']}, {c['state']} | Zapt Movers">
<meta property="og:description" content="{c['meta']}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800;900&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/quote-form.css">
<style>
{CSS}
</style>
</head>
<body>'''


HEADER = '''
<header>
  <div class="wrap bar">
    <a href="/" class="logo">
      <img src="%s" alt="Zapt Movers" onerror="this.style.display='none'">
      <span class="mark">ZAPT<em>MOVERS</em></span>
    </a>
    <button class="menu-toggle" id="menuBtn" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav id="nav">
      <a class="nl" href="/#services">Services</a>
      <a class="nl" href="/#process">How it works</a>
      <a class="nl" href="/movers/">Locations</a>
      <a class="nl" href="/blog/">Blog</a>
      <a class="btn btn-zap" href="#quote">Free quote</a>
    </nav>
  </div>
</header>
''' % LOGO


def footer(nearby_html, city_label):
    return f'''
<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        <a href="/" class="logo">
          <img src="{LOGO_LIGHT}" alt="Zapt Movers" onerror="this.style.display='none'">
          <span class="mark">ZAPT<em>MOVERS</em></span>
        </a>
        <p style="max-width:34ch;margin-top:16px">Licensed, bonded and insured moving across the Bay Area, Los Angeles and Dallas&ndash;Fort Worth. Open every day, 8am&ndash;6pm.</p>
      </div>
      <div>
        <h4>Nearby cities</h4>
        {nearby_html}
        <a href="/movers/">All locations</a>
      </div>
      <div>
        <h4>Contact</h4>
        <a href="tel:+14158432532">(415) 843-2532</a>
        <a href="tel:+14698688785">(469) 868-8785 &middot; DFW</a>
        <a href="#quote">Request a quote</a>
        <a href="/blog/">Moving guides</a>
      </div>
    </div>
    <div class="legal">
      <span>&copy; <span id="yr">2026</span> Zapt Movers &middot; US DOT 3438977 &middot; Local State License CAL-T0192235</span>
      <span>Serving {city_label}</span>
    </div>
  </div>
</footer>
'''


def schema(c):
    hub = c['hub']
    addr = {"@type": "PostalAddress",
            "addressLocality": hub['addr']['city'],
            "addressRegion": hub['addr']['region'],
            "addressCountry": "US"}
    if hub['addr']['street']:
        addr["streetAddress"] = hub['addr']['street']
    if hub['addr']['zip']:
        addr["postalCode"] = hub['addr']['zip']

    served = [{"@type": "City", "name": c['city'], "addressRegion": c['state']}]
    for s in c['nearby']:
        n = BY_SLUG[s]
        served.append({"@type": "City", "name": n['city'], "addressRegion": n['state']})

    graph = [
        {
            "@type": "MovingCompany",
            "@id": "%s/movers/%s/#business" % (BASE, c['slug']),
            "name": "Zapt Movers",
            "url": "%s/movers/%s/" % (BASE, c['slug']),
            "telephone": "+1-%s" % hub['href'][2:5] + "-" + hub['href'][5:8] + "-" + hub['href'][8:],
            "priceRange": "$$",
            "image": IMG % c['photo'],
            "address": addr,
            "areaServed": served,
            "openingHoursSpecification": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday",
                              "Friday", "Saturday", "Sunday"],
                "opens": "08:00", "closes": "18:00"
            },
            "sameAs": ["https://www.facebook.com/zaptmovers.co",
                       "https://instagram.com/zaptmovers"]
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                {"@type": "ListItem", "position": 2, "name": "Locations", "item": BASE + "/movers/"},
                {"@type": "ListItem", "position": 3, "name": "%s, %s" % (c['city'], c['state'])}
            ]
        },
        {
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": strip(q),
                 "acceptedAnswer": {"@type": "Answer", "text": strip(a)}}
                for q, a in c['faqs']
            ]
        }
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph},
                      indent=2, ensure_ascii=False)


def strip(html):
    """Schema text must be plain, not HTML entities."""
    return (html.replace('&mdash;', '-').replace('&ndash;', '-')
                .replace('&amp;', '&').replace('&middot;', '-'))


def page(c):
    hub = c['hub']
    cards = '\n'.join(
        '      <div class="lcard"><h3>%s</h3><p>%s</p></div>' % (t, b) for t, b in c['cards'])
    hoods = '\n'.join('      <span>%s</span>' % h for h in c['hoods'])
    faqs = '\n'.join(
        '    <details%s>\n      <summary>%s</summary>\n      <p>%s</p>\n    </details>'
        % (' open' if i == 0 else '', q, a) for i, (q, a) in enumerate(c['faqs']))
    nearby_nav = '\n'.join(
        '        <a href="/movers/%s/">%s, %s</a>' % (s, BY_SLUG[s]['city'], BY_SLUG[s]['state'])
        for s in c['nearby'])
    nearby_cards = '\n'.join(
        '      <a class="ncard" href="/movers/%s/"><h3>Movers in %s</h3>'
        '<p>%s</p></a>' % (s, BY_SLUG[s]['city'], BY_SLUG[s]['meta'].split('.')[1].strip())
        for s in c['nearby'])
    chips = '\n'.join('        <span class="chip">%s</span>' % x for x in c['chips'])

    return head(c) + HEADER + f'''
<main>

<div class="hero">
  <div class="wrap">
    <div>
      <nav class="crumb mono" aria-label="Breadcrumb">
        <a href="/">Home</a> &nbsp;/&nbsp; <a href="/movers/">Locations</a> &nbsp;/&nbsp; {c['city']}
      </nav>
      <h1><span class="tape">Movers in</span><br>{c['city']}, {c['state']}</h1>
      <p class="lede">{c['lede']}</p>
      <div class="hero-cta">
        <a class="btn" href="#quote">Get a free quote</a>
        <a class="btn btn-ghost" href="tel:{hub['href']}">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>
          {hub['phone']}
        </a>
      </div>
      <div class="chips">
{chips}
      </div>
    </div>
    <div class="hero-img">
      <img src="{IMG % c['photo']}" alt="Zapt Movers crew at work on a move in {c['city']}" loading="eager">
    </div>
  </div>
</div>

<div class="strip">
  <div class="wrap">
    <div class="item"><span class="num">15,000+</span><span class="lbl">Moves completed</span></div>
    <div class="item"><span class="num">4.8&#9733;</span><span class="lbl">From 1,000+ reviews</span></div>
    <div class="item"><span class="num">98%</span><span class="lbl">Customer satisfaction</span></div>
    <div class="item"><span class="num">$1M</span><span class="lbl">Cargo coverage</span></div>
  </div>
</div>

<section>
  <div class="wrap">
    <div class="sec-head">
      <h2>What makes a {c['city']} move different</h2>
      <p>Four things here cost people time and money when the moving company has not worked the city before.</p>
    </div>
    <div class="local">
{cards}
    </div>
  </div>
</section>

<section class="quotesec" id="quote">
  <div class="wrap">
    <div>
      <div class="sec-head" style="margin-bottom:22px">
        <h2>Get your {c['city']} quote</h2>
        <p>Free, no obligation, same-day answer. Tell us what you have and where it is going. Open every day, 8am to 6pm.</p>
      </div>
      <ul class="ticks">
        <li>Written price before you commit</li>
        <li>Furniture pads, shrink wrap and floor protection included</li>
        <li>Licensed, bonded and insured with $1M cargo coverage</li>
        <li>Move now, pay later with 0% APR options</li>
      </ul>
    </div>
    <div class="form-card zq" id="zapt-quote"></div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head">
      <h2>What we move in {c['city']}</h2>
      <p>Same crews, same equipment, same insurance across every job type.</p>
    </div>
    <div class="svc">
      <a class="scard" href="/#services"><h3>Houses &amp; apartments</h3><p>Studio to five-bedroom. Pads, wrap and floor runners included.</p></a>
      <a class="scard" href="/#services"><h3>Office &amp; commercial</h3><p>Moved after hours so Monday looks normal.</p></a>
      <a class="scard" href="/#services"><h3>Packing service</h3><p>Full, partial or fragile-only. We bring the boxes.</p></a>
      <a class="scard" href="/#services"><h3>Long distance</h3><p>{c['city']} to anywhere, GPS tracked, with a delivery window.</p></a>
      <a class="scard" href="/#services"><h3>Storage</h3><p>Monitored, climate-controlled, short or long term.</p></a>
      <a class="scard" href="/#services"><h3>Specialty items</h3><p>Pianos, safes, art and wine. Crated and strapped.</p></a>
    </div>
  </div>
</section>

<section style="padding-top:0">
  <div class="wrap">
    <div class="sec-head">
      <h2>{c['city']} neighborhoods we work</h2>
      <p>If yours is not listed, we still serve it. This is just where we spend most of our weeks.</p>
    </div>
    <div class="hoods">
{hoods}
    </div>
  </div>
</section>

<section class="priceband">
  <div class="wrap">
    <div class="sec-head">
      <h2>What a {c['city']} move costs</h2>
      <p>Starting ranges for a local move. Your written quote is free and confirmed after a walkthrough.</p>
    </div>
    <table>
      <thead><tr><th scope="col">Home size</th><th scope="col">Typical crew</th><th scope="col">Typical range</th></tr></thead>
      <tbody>
        <tr><td>Studio or 1 bedroom</td><td>2 movers</td><td>$350 &ndash; $600</td></tr>
        <tr><td>2 bedrooms</td><td>2 movers</td><td>$600 &ndash; $1,200</td></tr>
        <tr><td>3 bedrooms</td><td>3 movers</td><td>$1,100 &ndash; $1,800</td></tr>
        <tr><td>4+ bedrooms</td><td>4 movers</td><td>$1,600 &ndash; $2,600</td></tr>
        <tr><td>Office or commercial</td><td>4+ movers</td><td>Quoted per site</td></tr>
      </tbody>
    </table>
    <p class="pricenote">Includes truck, crew, local mileage, furniture pads, shrink wrap and basic disassembly and reassembly. Packing service, specialty crating and storage are quoted separately. Move now and pay later is available through Afterpay and Wisetack, with rates starting at 0% APR.</p>
  </div>
</section>

<section>
  <div class="wrap" style="max-width:840px">
    <div class="sec-head"><h2>{c['city']} questions we get every week</h2></div>
{faqs}
  </div>
</section>

<section style="padding-top:0">
  <div class="wrap">
    <div class="quote-card">
      <div class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
      <p>Placeholder &mdash; replace with a real Google or Yelp review from a {c['city']} customer. A review naming the neighborhood and the job is worth far more here than a generic one.</p>
      <p class="who" style="margin:0">Customer name &middot; {c['city']}, {c['state']}</p>
    </div>
  </div>
</section>

<section style="padding-top:0">
  <div class="wrap">
    <div class="sec-head"><h2>We also move nearby</h2></div>
    <div class="nextgrid">
{nearby_cards}
    </div>
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <div>
      <h2>Moving in {c['city']}? Let's price it.</h2>
      <p>Free quote, no obligation, same-day answer. Open every day from 8am to 6pm.</p>
    </div>
    <div class="cta-actions">
      <a class="btn" href="#quote">Get my free quote</a>
      <a class="btn btn-ghost" href="tel:{hub['href']}">{hub['phone']}</a>
    </div>
  </div>
</section>

</main>
''' + footer(nearby_nav, '%s and %s' % (c['city'], hub['region_name'])) + f'''
<script type="application/ld+json">
{schema(c)}
</script>

<script src="/assets/quote-form.js"></script>
<script>
ZaptQuoteForm.mount('#zapt-quote', {{
  city: '{c['city']}, {c['state']}',
  branch: '{hub['branch']}',
  phoneDisplay: '{hub['phone']}',
  phoneHref: '{hub['href']}',
  fromPlaceholder: '{c['city']}, {c['state']}',
  toPlaceholder: 'City, ST'
}});
var menuBtn = document.getElementById('menuBtn'), nav = document.getElementById('nav');
menuBtn.addEventListener('click', function(){{
  var open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
}});
document.getElementById('yr').textContent = new Date().getFullYear();
</script>
</body>
</html>
'''


def hub_page():
    groups = {}
    for c in CITIES:
        groups.setdefault(c['hub']['region_name'], []).append(c)
    blocks = []
    for region, cs in groups.items():
        items = '\n'.join(
            '        <a class="ncard" href="/movers/%s/"><h3>%s, %s</h3><p>%s</p></a>'
            % (c['slug'], c['city'], c['state'], c['meta'].split('.')[1].strip()) for c in cs)
        blocks.append(
            '    <div class="sec-head" style="margin:44px 0 20px"><h2>%s</h2></div>\n'
            '    <div class="nextgrid">\n%s\n    </div>' % (region.title(), items))

    fake = dict(title='Moving Company Locations | Zapt Movers',
                meta='Zapt Movers serves the Bay Area, Los Angeles and Dallas-Fort Worth. Find your city for local crews, local pricing and a free quote.',
                slug='', city='', state='')
    h = head(fake).replace('<link rel="canonical" href="%s/movers//">' % BASE,
                           '<link rel="canonical" href="%s/movers/">' % BASE)
    return h + HEADER + f'''
<main>
<div class="hero">
  <div class="wrap" style="display:block">
    <nav class="crumb mono" aria-label="Breadcrumb"><a href="/">Home</a> &nbsp;/&nbsp; Locations</nav>
    <h1><span class="tape">Find your city</span></h1>
    <p class="lede" style="max-width:56ch">We run our own trucks and crews in three regions. Each city page covers what actually makes a move there different, with local pricing and a free quote.</p>
  </div>
</div>
<section style="padding-top:0">
  <div class="wrap">
{chr(10).join(blocks)}
  </div>
</section>
<section class="cta-band">
  <div class="wrap">
    <div><h2>Don't see your city?</h2><p>We cover far more than we have pages for. Call and ask.</p></div>
    <div class="cta-actions">
      <a class="btn" href="/#quote">Get a free quote</a>
      <a class="btn btn-ghost" href="tel:+14158432532">(415) 843-2532</a>
    </div>
  </div>
</section>
</main>
''' + footer('        <a href="/#locations">All service areas</a>', 'the Bay Area, Los Angeles and Dallas-Fort Worth') + '''
<script>
var menuBtn = document.getElementById('menuBtn'), nav = document.getElementById('nav');
menuBtn.addEventListener('click', function(){
  var open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
document.getElementById('yr').textContent = new Date().getFullYear();
</script>
</body>
</html>
'''


if __name__ == '__main__':
    for c in CITIES:
        d = ROOT / 'movers' / c['slug']
        d.mkdir(parents=True, exist_ok=True)
        (d / 'index.html').write_text(page(c), encoding='utf-8')
        print('built', c['slug'])

    (ROOT / 'movers').mkdir(exist_ok=True)
    (ROOT / 'movers' / 'index.html').write_text(hub_page(), encoding='utf-8')
    print('built /movers/ hub')

    urls = ['/', '/movers/', '/blog/', '/blog/california-to-texas/', '/blog/summer-move/']
    urls += ['/movers/%s/' % c['slug'] for c in CITIES]
    body = '\n'.join('  <url><loc>%s%s</loc></url>' % (BASE, u) for u in urls)
    (ROOT / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % body,
        encoding='utf-8')
    print('sitemap:', len(urls), 'urls')
