# Go-live checklist: trade payments

Tick each before switching trade checkout to real money.

- [ ] **Paystack live keys**: set `PAYSTACK_SECRET_KEY` (live `sk_live_…`) in the production environment. Never commit it.
- [ ] **Webhook**: in the Paystack dashboard set the webhook URL to `https://<site>/api/paystack/webhook`, copy the signing secret into `PAYSTACK_WEBHOOK_SECRET`. (Paystack signs with the secret key; this project reads `PAYSTACK_WEBHOOK_SECRET`, so set both to the same live secret key unless Paystack gives a separate one.)
- [ ] **Site URL**: `NEXT_PUBLIC_SITE_URL` is the public https origin (callback URLs are built from it).
- [ ] **Hold-expiry cron**: schedule `GET https://<site>/api/cron/trade-holds` every minute with header `x-cron-secret: $CRON_SECRET` (`CRON_SECRET` must be set, otherwise the route refuses everything).
- [ ] **Stock hold minutes**: confirm the value in Admin → Trade → Checkout Payment Settings (default 15).
- [ ] **Bank transfer**: only when the banking details are confirmed, enter them in the same settings card and switch it on.
- [ ] **Nirvana contact**: enter the dedicated contact's name, phone and email in the same card (checkout shows "your Happy Hour account manager" until then).
- [ ] **Credit accounts**: confirm which businesses have credit enabled and their limits (Admin → Trade → Accounts).
- [ ] **One real test payment** of a small amount on the live keys, from a guest and from an account, then refund it in the Paystack dashboard.
- [ ] **Paid-after-expiry**: know where to look — orders with payment status `paid after expiry` need a manual refund or reinstatement.
