const GRAPH_API_VERSION = "v21.0";

/**
 * Sends a plain-text WhatsApp message via Meta's WhatsApp Cloud API. Returns
 * { sent: false, reason: "not_configured" } when WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID
 * aren't set, so callers can fall back to recording the intent instead of a real send.
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<{ sent: true } | { sent: false; reason: "not_configured" | "api_error"; error?: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return { sent: false, reason: "not_configured" };
  }

  const digitsOnly = to.replace(/\D/g, "");

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: digitsOnly,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    return { sent: false, reason: "api_error", error: body?.error?.message ?? `HTTP ${response.status}` };
  }

  return { sent: true };
}
