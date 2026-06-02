// import nodemailer from 'nodemailer';
import { prisma } from './prisma.ts';
import { ALERT_RULE_BY_TYPE } from './alertRules.ts';

// Email transport removed – email sending disabled
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST || 'smtp.resend.com',
//   port: parseInt(process.env.SMTP_PORT || '587', 10),
//   secure: process.env.SMTP_SECURE === 'true',
//   auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASSWORD || '' },
// });

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

    // Resolve targeted users from rule.targetRoles dynamically (can contain alert levels, roles, and direct emails)
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

    if (alert.targetUser?.email) {
      recipientEmails.push(alert.targetUser.email);
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
          await sendEmailMessage(alert, recipientEmails, channel === 'email_existing_thread');
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
  const dynamicDescription = alert.description.replace(/{trackingId}/g, trackingId);

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
 * Sends alert notification email by calling the Deno SMTP mail server endpoint.
 */
async function sendEmailMessage(alert: any, toEmails: string[], _replyToThread: boolean) {
  const mailServerUrl = process.env.DENO_MAIL_SERVER_URL || 'http://localhost:8000';
  const trackingId = alert.manifest?.trackingId || 'N/A';
  const dynamicDescription = alert.description.replace(/{trackingId}/g, trackingId);
  
  // Format the email content
  const subject = alert.title || '⚠️ Process Break Alert';
  const content = `Alert Details:
--------------------------------------
Title: ${alert.title}
Priority Level: ${alert.level}
Tracking ID: ${trackingId}

Description:
${dynamicDescription}

This alert was generated automatically by the Warehouse Management System.
`;

  for (const to of toEmails) {
    try {
      console.log(`[Alert Dispatcher] Dispatching email to ${to} via Deno mail server...`);
      const response = await fetch(mailServerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Deno mail server returned status ${response.status}: ${await response.text()}`);
      }
      console.log(`[Alert Dispatcher] Email alert successfully sent to ${to}`);
    } catch (err) {
      console.error(`[Alert Dispatcher] Failed to send email to ${to}:`, err);
    }
  }
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
