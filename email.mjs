// Sends one email through Resend or Brevo using their HTTP APIs (no SMTP).
//
// Environment variables (set as GitHub Actions secrets):
//   EMAIL_PROVIDER  "resend" or "brevo"
//   EMAIL_API_KEY   API key from the provider
//   EMAIL_FROM      sender address the provider has verified
//   EMAIL_TO        recipient address

export async function sendEmail({ subject, text, html }) {
  const provider = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.EMAIL_TO;

  const required = { EMAIL_PROVIDER: provider, EMAIL_API_KEY: apiKey, EMAIL_FROM: from, EMAIL_TO: to };
  for (const [name, value] of Object.entries(required)) {
    if (!value) throw new Error(`Missing environment variable ${name}`);
  }

  let res;
  if (provider === "resend") {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: `Barnehage-varsel <${from}>`, to: [to], subject, text, html }),
    });
  } else if (provider === "brevo") {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Barnehage-varsel", email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });
  } else {
    throw new Error(`Unknown EMAIL_PROVIDER "${provider}" (use "resend" or "brevo")`);
  }

  const body = await res.text();
  if (!res.ok) throw new Error(`${provider} responded ${res.status}: ${body}`);
  return body;
}
