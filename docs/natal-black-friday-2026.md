# Natal Brasileiro — Black Friday 2026

Campaign ID: `natal-brasileiro-black-friday-2026`. Collection ID: `natal-brasileiro`.

Active from 2026-11-07 00:00 through 2026-11-30 23:59:59, America/Maceio (UTC−03); the end instant is exclusive. The server clock is authoritative. No scheduled job or catalog price changes are required to end the offer.

## Rules

One redemption per account, for different paid models in this collection only. Two eligible models unlock 50% off the least expensive; three or more unlock one free least-expensive model instead. The two offers never stack. Free models, collection bundles and other collections do not qualify. Coupons can still apply to other non-promotional items in a mixed cart.

Previously paid, non-refunded, full-price individual purchases count, once per model. One prior purchase allows another at half price, or two more for the price of one. Two prior purchases unlock a free model. Three or more prior purchases unlock one free model as a loyalty gift. Gifts and discounted purchases do not qualify as historical full-price purchases. Already-owned models cannot be chosen again. Accounts owning all five currently paid models have no further available model to redeem.

## Existing commerce integration

`lib/natal-promotion.mjs` is shared by cart and server pricing. The server reads history inside the existing atomic commerce record update; browser totals and claimed eligibility are not trusted. Pending promotion orders reserve the account benefit. Same-cart retries resume the order; a different cart cannot create another promotional charge. Reservations remain until payment status is resolved, including after campaign expiry. Do not manually clear a reservation without verifying cancellation/refund at the provider.

Zero-total redemption creates a paid internal order with provider `promotion` and billing type `PROMOTION`. It does not contact a payment provider or send an email. It uses the existing purchased-file access and personal physical-print sales license. All print profiles are available. The paid internal order prevents repeat redemption. A refunded qualifying historical purchase suspends access/license to the discounted model; unrelated fully paid models retain their access.

Normal payable orders continue using Asaas in BRL and PayPal in USD. Existing product prices are retained. No customer data or production orders were modified for testing.

## Validation

`node --test tests/*.test.mjs`: 239 passing tests, including 11 campaign cases/subtests. Covers boundaries, new and returning shoppers, mixed carts, currencies, coupon isolation, fake free totals, concurrent requests, pending-order reuse, mocked Asaas/PayPal amounts, free claims, print-profile links, PDF license and refund access revocation.

Production build: `node node_modules/next/dist/bin/next build --webpack`.

Local browser fixture: fake partner with three historical purchases redeemed one Noel at R$0.00 and received the existing profile and PDF-license controls. Mobile collection banner checked at 390px without horizontal overflow.
