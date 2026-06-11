import { prisma } from './prisma.ts';
import { ALERT_RULE_BY_TYPE } from './alertRules.ts';
import nodemailer from 'nodemailer';

/**
 * Dispatches notification alerts via active channels (Google Chat, email, dashboard).
 */
export async function dispatchAlert(alertId: string) {
  try {
    // 1. Fetch full alert details with target user & manifest
    // IMPORTANT: Make sure `lastEmailMessageId` is added to your Manifest model in schema.prisma!
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        targetUsers: { select: { email: true, name: true } },
        manifest: { select: { trackingId: true, id: true, lastEmailMessageId: true } },
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

    // Resolve targeted users from rule.targetRoles dynamically
    const { alertLevels, roles, directEmails } = getPrismaUserQuery(rule.targetRoles);

    let targetEmailsFromDb: string[] = [];
    if (alertLevels.length > 0 || roles.length > 0) {
      const targetUsers = await prisma.user.findMany({
        where: {
          OR: [
            alertLevels.length > 0 ? { alertLevel: { in: alertLevels } } : {},
            roles.length > 0 ? { role: { in: roles } } : {},
          ].filter(cond => Object.keys(cond).length > 0),
        },
        select: {
          email: true,
        },
      });
      targetEmailsFromDb = targetUsers.map(u => u.email);
    }

    let recipientEmails: string[] = [...targetEmailsFromDb, ...directEmails];

    if (alert.targetUsers && alert.targetUsers.length > 0) {
      for (const u of alert.targetUsers) {
        if (u.email) recipientEmails.push(u.email);
      }
    }

    // Fallback to a test email address if no target users are configured/found
    if (recipientEmails.length === 0) {
      const testEmail = process.env.TEST_EMAIL || 'test@example.com';
      recipientEmails.push(testEmail);
    }

    // Deduplicate recipient emails
    recipientEmails = [...new Set(recipientEmails)];

    // Send via active channels
    const channels = rule.channels || [];

    for (const channel of channels) {
      try {
        if (channel === 'hangout') {
          await sendHangoutMessage(alert, rule.sopSteps);
        } else if (channel === 'email' || channel === 'email_existing_thread') {
          
          // Threading Fix: Get the actual SMTP Message-ID from the database
          const previousMessageId = channel === 'email_existing_thread' ? (alert.manifest?.lastEmailMessageId || undefined) : undefined;
          
          // Send the email and return the newly generated Message-ID
          const newMessageId = await sendEmailMessage(alert, recipientEmails, previousMessageId);

          // Save the new Message-ID back to the database for future replies
          if (newMessageId && alert.manifest?.id) {
            await prisma.manifest.update({
              where: { id: alert.manifest.id },
              data: { lastEmailMessageId: newMessageId }
            });
          }
          
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
async function sendHangoutMessage(alert: any, sopSteps: { en: string; hi: string }[]) {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Alert Dispatcher] GOOGLE_CHAT_WEBHOOK_URL environment variable is not defined.');
    return;
  }

  const trackingId = alert.manifest?.trackingId || 'N/A';
  const subject = formatAlertSubject(alert.title, trackingId);
  const dynamicDescription = alert.description.replace(/{trackingId}/g, trackingId);

  // Construct Google Chat Card v2 Payload
  const payload = {
    cardsV2: [
      {
        cardId: alert.id,
        card: {
          header: {
            title: subject,
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
                    text: dynamicDescription,
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
 * Sends alert notification email directly using Nodemailer via Gmail SMTP.
 * Supports email threading by passing an optional previousMessageId.
 * Returns the generated messageId so it can be saved to the database.
 */
async function sendEmailMessage(alert: any, toEmails: string[], previousMessageId?: string): Promise<string | null> {
  const gmailUser = process.env.SMTP_USER || process.env.GMAIL_ADDRESS;
  const gmailPass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.warn('[Alert Dispatcher] SMTP_USER or SMTP_PASSWORD not found in environment. Skipping email dispatch.');
    return null;
  }

  const trackingId = alert.manifest?.trackingId || 'N/A';
  const dynamicDescription = alert.description.replace(/{trackingId}/g, trackingId);
  const subject = formatAlertSubject(alert.title, trackingId);

  // Clean HTML Formatting
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #d9534f; border-bottom: 2px solid #eaeaea; padding-bottom: 10px;">
        ${subject}
      </h2>
      <p><strong>Priority Level:</strong> <span style="background-color: #f0ad4e; color: white; padding: 2px 6px; border-radius: 4px;">${alert.level}</span></p>
      <p><strong>Tracking ID:</strong> ${trackingId}</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #d9534f; margin: 20px 0;">
        <p style="margin: 0; white-space: pre-wrap;">${dynamicDescription}</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">
        This alert was generated automatically by the Warehouse Management System.
      </p>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  const mailOptions: any = {
    from: `"Warehouse Alerts" <${gmailUser}>`,
    to: toEmails.join(', '), // Send to all recipients at once
    subject,
    html: htmlContent,
  };

  // Email Threading Logic
  if (previousMessageId && typeof previousMessageId === 'string') {
    mailOptions.inReplyTo = previousMessageId;
    mailOptions.references = [previousMessageId];
  }

  try {
    console.log(`[Alert Dispatcher] Dispatching email to ${toEmails.join(', ')} via Gmail SMTP...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Alert Dispatcher] Email alert successfully sent! Message ID: ${info.messageId}`);
    return info.messageId;
  } catch (err) {
    console.error(`[Alert Dispatcher] Failed to send email via Nodemailer:`, err);
    return null;
  }
}

function formatAlertSubject(title: string | null | undefined, trackingId: string) {
  const baseTitle = title || 'Process Break Alert';
  return trackingId && trackingId !== 'N/A' ? `[${trackingId}] ${baseTitle}` : baseTitle;
}

/**
 * Maps rule target roles to database query parameters for User alertLevel and role,
 * while separating direct email addresses.
 */
function getPrismaUserQuery(targetRoles: string[]) {
  const alertLevels: any[] = [];
  const roles: any[] = [];
  const directEmails: string[] = [];

  for (const role of targetRoles) {
    if (role.includes('@')) {
      directEmails.push(role);
    } else if (['L1', 'L2', 'L3', 'L4'].includes(role)) {
      alertLevels.push(role);
    } else {
      // Map rule target roles case-insensitively to database Role enum values
      const upperRole = role.toUpperCase();
      if (upperRole === 'RECEIVER') roles.push('RECEIVER');
      else if (upperRole === 'INSPECTOR') roles.push('INSPECTOR');
      else if (upperRole === 'QC' || upperRole === 'QC_AGENT') roles.push('QC_AGENT');
      else if (upperRole === 'RECOVERY' || upperRole === 'RECOVERER') roles.push('RECOVERER');
      else if (upperRole === 'ADMIN') roles.push('ADMIN');
      else if (upperRole === 'SUPER_ACCESS' || upperRole === 'SUPER-ACCESS') roles.push('SUPER_ACCESS');
      else if (upperRole === 'CLAIMS_SPECIALIST' || upperRole === 'CLAIMS') roles.push('CLAIMS_SPECIALIST');
    }
  }

  return { alertLevels, roles, directEmails };
}
