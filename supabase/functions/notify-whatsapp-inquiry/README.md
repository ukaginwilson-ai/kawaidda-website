# WhatsApp inquiry notifications

This Supabase Edge Function sends a WhatsApp template notification to the Kawaidda team after a website inquiry is saved. Meta credentials stay in Supabase Function secrets; do not add them to the HTML or SQL files.

## 1. Configure the approved Meta template

Create and get approval for a WhatsApp template with five body parameters, in this order:

1. Customer name
2. Customer phone
3. Customer email (`Not provided` when omitted)
4. Product or service interest
5. Inquiry message

For example, the body could be:

```text
New website inquiry
Name: {{1}}
Phone: {{2}}
Email: {{3}}
Interested in: {{4}}
Message: {{5}}
```

The function truncates the message parameter after 900 characters and labels it as truncated. The complete inquiry remains in `public.inquiries`.

## 2. Apply the database setup

Run the updated `supabase-setup.sql` in the Supabase SQL Editor. It creates a private rate-limit table and an RPC function used by the Edge Function, and applies the website catalog, submission, and staff-dashboard access policies. The rate limiter permits up to three WhatsApp notification attempts per IP address in 15 minutes.

## 3. Configure secrets and deploy

The team recipient must have opted in to receive WhatsApp messages from the business. The recipient must also be different from the sending business number.

From the project root, set these Supabase Function secrets using a secure terminal or the Supabase Dashboard; do not commit their values:

- `WHATSAPP_ACCESS_TOKEN` — Meta Cloud API access token.
- `WHATSAPP_PHONE_NUMBER_ID` — the sending WhatsApp Business phone-number ID from Meta.
- `WHATSAPP_TEAM_NUMBER` — team recipient in international format, digits only, without `+`; this must not be the sending number.
- `WHATSAPP_TEMPLATE_NAME` — approved template name.
- `WHATSAPP_TEMPLATE_LANGUAGE` — approved template language code, such as `en`.
- `WHATSAPP_GRAPH_API_VERSION` — a currently supported Meta Graph API version, such as `vXX.X`.
- `WHATSAPP_ALLOWED_ORIGIN` — exact website origin, such as `https://example.com` (no path or trailing slash).
- `WHATSAPP_RATE_LIMIT_SECRET` — a private random value used to hash IP addresses for rate limiting.

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Keep the function's JWT verification enabled and never expose the service-role key or Meta access token in the browser.

After applying the SQL and setting the secrets, deploy with `supabase functions deploy notify-whatsapp-inquiry`. Test a website inquiry and check the function logs if the inquiry is saved but the WhatsApp notification fails. The site reports these outcomes separately so a notification failure does not imply that the inquiry was lost.
