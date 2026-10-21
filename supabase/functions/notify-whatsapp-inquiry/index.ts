import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function response(status: number, body: Record<string, unknown>, origin?: string) {
  const headers = new Headers(jsonHeaders);
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Vary", "Origin");
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(JSON.stringify(body), { status, headers });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidInquiry(value: unknown): value is {
  name: string;
  phone: string;
  email: string | null;
  interest: string;
  message: string;
} {
  if (!isRecord(value)) return false;
  const { name, phone, email, interest, message } = value;
  return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 120
    && typeof phone === "string" && phone.trim().length >= 5 && phone.trim().length <= 40
    && (email === null || (typeof email === "string" && email.length <= 254))
    && typeof interest === "string" && interest.trim().length >= 1 && interest.trim().length <= 120
    && typeof message === "string" && message.trim().length >= 5 && message.trim().length <= 3000;
}

async function hashAddress(address: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(address));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const allowedOrigin = Deno.env.get("WHATSAPP_ALLOWED_ORIGIN");
  if (!allowedOrigin) {
    console.error("Missing WHATSAPP_ALLOWED_ORIGIN function secret.");
    return response(500, { error: "WhatsApp notifications are not configured." });
  }

  const origin = request.headers.get("origin") || undefined;
  if (origin && origin !== allowedOrigin) {
    return response(403, { error: "Origin is not allowed." });
  }
  if (request.method === "OPTIONS") {
    return response(200, {}, origin || allowedOrigin);
  }
  if (request.method !== "POST") {
    return response(405, { error: "Method not allowed." }, origin || allowedOrigin);
  }

  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const teamNumber = Deno.env.get("WHATSAPP_TEAM_NUMBER");
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
  const templateLanguage = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE");
  const graphVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION");
  const rateLimitSecret = Deno.env.get("WHATSAPP_RATE_LIMIT_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!accessToken || !phoneNumberId || !teamNumber || !templateName || !templateLanguage
    || !graphVersion || !rateLimitSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("WhatsApp notification is missing one or more required function secrets.");
    return response(500, { error: "WhatsApp notifications are not configured." }, origin || allowedOrigin);
  }
  if (!/^\d+$/.test(phoneNumberId) || !/^\d{8,15}$/.test(teamNumber)
    || !/^v\d+\.\d+$/.test(graphVersion) || !/^[a-z0-9_]+$/.test(templateName)
    || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(templateLanguage)) {
    console.error("WhatsApp team number or Graph API version has an invalid format.");
    return response(500, { error: "WhatsApp notifications are not configured." }, origin || allowedOrigin);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response(400, { error: "A valid JSON request body is required." }, origin || allowedOrigin);
  }
  if (!isRecord(body) || !isValidInquiry(body.inquiry)) {
    return response(400, { error: "Inquiry details are missing or invalid." }, origin || allowedOrigin);
  }

  const clientAddress = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (!clientAddress) {
    console.error("Could not determine the request address for WhatsApp notification rate limiting.");
    return response(400, { error: "We couldn't process this notification request." }, origin || allowedOrigin);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ipHash = await hashAddress(clientAddress, rateLimitSecret);
    const { data: allowed, error: rateLimitError } = await supabase.rpc(
      "claim_whatsapp_notification",
      { p_ip_hash: ipHash },
    );
    if (rateLimitError) throw rateLimitError;
    if (!allowed) {
      return response(429, { error: "Please wait before sending another inquiry." }, origin || allowedOrigin);
    }

    const { name, phone, email, interest, message } = body.inquiry;
    const notificationMessage = message.length > 900
      ? `${message.slice(0, 900)}… [truncated; see full inquiry in Supabase]`
      : message;
    const apiResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: teamNumber,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [{
              type: "body",
              parameters: [
                { type: "text", text: name.trim() },
                { type: "text", text: phone.trim() },
                { type: "text", text: email?.trim() || "Not provided" },
                { type: "text", text: interest },
                { type: "text", text: notificationMessage },
              ],
            }],
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!apiResponse.ok) {
      console.error("Meta WhatsApp API returned an error status:", apiResponse.status);
      return response(502, { error: "The WhatsApp team notification could not be sent." }, origin || allowedOrigin);
    }

    return response(200, { sent: true }, origin || allowedOrigin);
  } catch (error) {
    console.error("Could not send the WhatsApp team notification:", error);
    return response(500, { error: "The WhatsApp team notification could not be sent." }, origin || allowedOrigin);
  }
});
