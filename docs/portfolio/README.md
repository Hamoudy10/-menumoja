# Menu Moja — Portfolio

Print-ready portfolio (6 pages, A4): `menumoja-portfolio.html` — real screenshots embedded, contact details included.

Live hosted copy: **https://menumoja.vercel.app/portfolio.html**

## How to export to PDF (6 pages, A4)

1. Open `menumoja-portfolio.html` in Chrome or Edge (or the hosted link).
2. Press **Ctrl + P** (Print).
3. Destination: **Save as PDF**.
4. Set **Paper size: A4** · **Margins: None** · tick **Background graphics**.
5. Save as `MenuMoja-Portfolio.pdf`.

The HTML is styled for exactly 6 A4 pages (cover, RUN/UNDERSTAND/GROW,
screenshots, positioning/Kenya, how-it-works/available-now, outcomes/demo/contact).

## Updating screenshots

Source captures live in `../snapshots/`. The portfolio embeds them as base64 —
regenerate with `node <path-to>/build-portfolio.js` after replacing captures.
Current screenshot slots (10):

dashboard → Restaurant Dashboard
customer menu → QR Digital Menu
cart visual → Customer Ordering
POS → Point of Sale
kitchen display → Kitchen Display
Tables and floor plan → Tables & Floor Plan
payments → M-Pesa & Payments
analytics → Analytics
customers → Customers (CRM)
AI manager → AI — Restaurant Manager

## Demo

The TRY MENU MOJA button points at the live QR menu
(menumoja.vercel.app/menu/amorino-restaurant). Replace with the demo video
link when the video is ready (search for `amorino-restaurant` in the HTML).

## WhatsApp reply script (client has already asked)

> "Absolutely. I'll send you our Menu Moja portfolio shortly. It gives a brief
> overview of the platform, the restaurant problems we're solving, and some
> screenshots of the system. I'll also include a link where you can experience
> the demo."

After they've had a look:

> "Once you've had a look, I'd be happy to visit your restaurant for 15–20
> minutes. I'd like to understand what system you're currently using and show
> you specifically where Menu Moja could add value."

That's the transition from portfolio → meeting → demo → pilot.
