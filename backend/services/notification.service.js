const RESEND_API_URL = "https://api.resend.com/emails";

function isEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function buildEmailHtml({ title, message, category }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
      <p style="margin:0 0 8px;color:#536177">${category || "UMIBRes"}</p>
      <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
      <p style="margin:0 0 18px">${message}</p>
      <p style="margin:0;color:#536177;font-size:13px">Ky njoftim u dergua nga UMIBRes.</p>
    </div>
  `;
}

function getNotificationTemplate({ title, message, category }) {
  if (!process.env.RESEND_NOTIFICATION_TEMPLATE_ID) {
    return undefined;
  }

  return {
    id: process.env.RESEND_NOTIFICATION_TEMPLATE_ID,
    variables: {
      TITLE: title || "Njoftim nga UMIBRes",
      CATEGORY: category || "Sistem",
      MESSAGE: message || "Ka pasur nje perditesim te ri ne sistem.",
    },
  };
}

export async function sendEmailNotification({ to, title, message, category, html, template }) {
  if (!isEmailEnabled() || !to) {
    return { skipped: true };
  }

  const payload = {
    from: process.env.EMAIL_FROM,
    to,
    subject: title,
  };

  if (template?.id) {
    payload.template = {
      id: template.id,
      variables: template.variables || {},
    };
  } else {
    payload.text = `${category ? `${category}\n\n` : ""}${message}`;
    payload.html = html || buildEmailHtml({ title, message, category });
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`email_send_failed:${response.status}:${details}`);
  }

  return response.json().catch(() => ({ sent: true }));
}

export async function getUserPreferences(client, userId) {
  const { rows } = await client.query(
    `insert into user_preferences (user_id)
     values ($1)
     on conflict (user_id) do update
       set user_id = excluded.user_id
     returning user_id, email_notifications, updated_at`,
    [userId]
  );

  return rows[0];
}

export async function updateUserPreferences(client, userId, values = {}) {
  const emailNotifications = Boolean(values.emailNotifications ?? values.email_notifications);
  const { rows } = await client.query(
    `insert into user_preferences (user_id, email_notifications, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update
       set email_notifications = excluded.email_notifications,
           updated_at = now()
     returning user_id, email_notifications, updated_at`,
    [userId, emailNotifications]
  );

  return rows[0];
}

export function mapUserPreferences(row = {}) {
  return {
    emailNotifications: Boolean(row.email_notifications ?? true),
    updatedAt: row.updated_at || null,
  };
}

export async function createNotification(client, { userId, title, message, category }) {
  if (!userId) {
    return null;
  }

  const { rows } = await client.query(
    `insert into notifications (user_id, title, message, category)
     values ($1, $2, $3, $4)
     returning id, user_id, title, message, category, is_read, created_at`,
    [userId, title, message, category || null]
  );
  const notification = rows[0] || null;

  try {
    const preferences = await getUserPreferences(client, userId);

    if (preferences?.email_notifications) {
      const userResult = await client.query(
        `select email from users where id = $1 limit 1`,
        [userId]
      );

      await sendEmailNotification({
        to: userResult.rows[0]?.email,
        title,
        message,
        category,
        template: getNotificationTemplate({ title, message, category }),
      });
    }
  } catch (error) {
    console.warn("email_notification_skipped", {
      userId,
      notificationId: notification?.id,
      message: error.message,
    });
  }

  return notification;
}
