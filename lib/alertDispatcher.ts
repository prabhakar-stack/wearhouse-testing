import nodemailer from 'nodemailer';
import { prisma } from './prisma';
import { ALERT_RULE_BY_TYPE } from './alertRules';

// Initialize transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.resend.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
});

/**
 * Dispatches notification alerts via active channels (Google Chat, email, dashboard).
 */
export async function dispatchAlert(alertId: string) {
  try {
    // 1. Fetch full alert details with target user & manifest
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        targetUser: { select: { email: true, name: true } },
        manifest: { select: { trackingId: true, id: true } },
      },
    });

    if (!alert) {
      console.warn(`[Alert Dispatcher] Alert with ID ${alertId} not found.`);
      return;
    }

    const rule = ALERT_RULE_BY_TYPE[alert.type];
    if (!rule) {
      console.warn(`[Alert Dispatcher] Rule mapping not found for alert type: ${alert.type}`);
      return;
    }

    // 2. Identify the target email address(es)
    let recipientEmails: string[] = [];
    if (alert.targetUser?.email) {
      recipientEmails.push(alert.targetUser.email);
    }
    // Also scan rule targetRoles for direct email addresses as a fallback
    rule.targetRoles.forEach((role) => {
      if (role.includes('@')) {
        recipientEmails.push(role.trim());
      }
    });

    // Deduplicate recipient emails
    recipientEmails = [...new Set(recipientEmails)];

    // Send via active channels
    const channels = rule.channels || [];

    for (const channel of channels) {
      try {
        if (channel === 'hangout') {
          await sendHangoutMessage(alert, rule.sopSteps);
        } else if (channel === 'email') {
          await sendEmailMessage(alert, recipientEmails, false);
        } else if (channel === 'email_existing_thread') {
          await sendEmailMessage(alert, recipientEmails, true);
        }
      } catch (err) {
        console.error(`[Alert Dispatcher] Failed to dispatch via channel ${channel}:`, err);
      }
    }
  } catch (error) {
    console.error('[Alert Dispatcher] Error in dispatchAlert:', error);
  }
}

/**
 * Sends a Google Chat / Hangouts Incoming Webhook card message.
 */
async function sendHangoutMessage(alert: any, sopSteps: string[]) {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Alert Dispatcher] GOOGLE_CHAT_WEBHOOK_URL environment variable is not defined.');
    return;
  }

  const trackingId = alert.manifest?.trackingId || 'N/A';
  const sopFormatted = sopSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n');

  // Construct Google Chat Card v2 Payload
  const payload = {
    cardsV2: [
      {
        cardId: alert.id,
        card: {
          header: {
            title: alert.title,
            subtitle: `Priority: ${alert.level} | ID: ${trackingId}`,
            imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/warning/default/48px.svg',
            imageType: 'CIRCLE',
          },
          sections: [
            {
              header: 'Alert Description',
              widgets: [
                {
                  textParagraph: {
                    text: alert.description,
                  },
                },
              ],
            },
            {
              header: 'SOP Steps for Resolution',
              widgets: [
                {
                  textParagraph: {
                    text: sopFormatted.replace(/\n/g, '<br>'),
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Google Chat webhook returned status ${response.status}: ${await response.text()}`);
  }
}

/**
 * Sends notification email, replying to the existing thread if requested.
 */
async function sendEmailMessage(alert: any, toEmails: string[], replyToThread: boolean) {
  if (toEmails.length === 0) {
    console.warn(`[Alert Dispatcher] No recipient email found for alert ${alert.id}. Skipping email.`);
    return;
  }

  const fromEmail = process.env.SMTP_FROM || 'alerts@warehouse.local';
  const trackingId = alert.manifest?.trackingId || 'N/A';
  const subject = `[Warehouse Alert] [${alert.level}] ${alert.title} (Tracking: ${trackingId})`;

  let headers: Record<string, string> = {};
  let threadKey = alert.manifestId || alert.manifest?.id || trackingId;

  // If we should reply to an existing thread, search for a previous alert in the same manifest/tracking
  if (replyToThread && threadKey) {
    const parentAlert = await prisma.alert.findFirst({
      where: {
        manifestId: alert.manifestId,
        emailMessageId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { emailMessageId: true },
    });

    if (parentAlert?.emailMessageId) {
      headers['In-Reply-To'] = parentAlert.emailMessageId;
      headers['References'] = parentAlert.emailMessageId;
    }
  }

  const htmlBody = `
    <h2>${alert.title}</h2>
    <p><strong>Priority Level:</strong> ${alert.level}</p>
    <p><strong>Tracking ID:</strong> ${trackingId}</p>
    <hr />
    <p>${alert.description}</p>
    <h3>Resolution SOP Steps:</h3>
    <ol>
      ${ALERT_RULE_BY_TYPE[alert.type]?.sopSteps.map((step) => `<li>${step}</li>`).join('') || '<li>Follow standard return inspection procedure.</li>'}
    </ol>
    <br />
    <p><em>This is an automated system notification. Please resolve this alert on your dashboard.</em></p>
  `;

  const mailOptions = {
    from: fromEmail,
    to: toEmails.join(', '),
    subject: replyToThread && headers['In-Reply-To'] ? `Re: ${subject}` : subject,
    html: htmlBody,
    headers,
  };

  const info = await transporter.sendMail(mailOptions);
  
  if (info.messageId) {
    // Save the Message-ID so future alerts can reply in the same thread
    await prisma.alert.update({
      where: { id: alert.id },
      data: {
        emailMessageId: info.messageId,
        emailThreadKey: threadKey,
      },
    });
  }
}
