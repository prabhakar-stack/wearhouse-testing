// @ts-nocheck
import { SMTPClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

Deno.serve(async (req) => {
  try {
    let to = "team@example.com";
    let subject = "⚠️ Process Break Alert";
    let content = "A backend process has failed. Check logs immediately.";

    // Parse dynamic options if request is POST
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.to) to = body.to;
        if (body.subject) subject = body.subject;
        if (body.content) content = body.content;
      } catch (e) {
        console.warn("[Deno SMTP] Failed to parse request body, using default values:", e);
      }
    }

    const gmailAddress = Deno.env.get("GMAIL_ADDRESS");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailAddress || !gmailAppPassword) {
      const errMsg = "GMAIL_ADDRESS or GMAIL_APP_PASSWORD environment variables are not set.";
      console.error(`[Deno SMTP] ${errMsg}`);
      return new Response(errMsg, { status: 500 });
    }

    console.log(`[Deno SMTP] Connecting to smtp.gmail.com...`);
    const client = new SMTPClient();

    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: gmailAddress,
      password: gmailAppPassword, // The 16-digit code
    });

    console.log(`[Deno SMTP] Sending email from ${gmailAddress} to ${to}...`);
    await client.send({
      from: gmailAddress,
      to,
      subject,
      content,
    });

    await client.close();

    console.log(`[Deno SMTP] Email sent successfully to ${to}`);
    return new Response("Alert Sent", { status: 200 });
  } catch (err: any) {
    console.error("[Deno SMTP] Error during mail transfer:", err);
    return new Response(`Error: ${err?.message || err}`, { status: 500 });
  }
});
