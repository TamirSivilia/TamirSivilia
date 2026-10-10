// Delivers one-time codes. Real delivery requires Twilio Verify credentials;
// without them the server only works in DEV_PREVIEW mode (code is logged, never faked as "sent").

const DEV_PREVIEW = process.env.DEV_PREVIEW === 'true';
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;

const twilioConfigured = Boolean(
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID
);

export function smsProviderStatus() {
  if (twilioConfigured) return 'twilio';
  if (DEV_PREVIEW) return 'dev-preview';
  return 'unconfigured';
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendCode(phone, code) {
  if (twilioConfigured) {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, Channel: 'sms' }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio send failed: ${res.status} ${text}`);
    }
    return { delivered: true, provider: 'twilio' };
  }

  if (DEV_PREVIEW) {
    // eslint-disable-next-line no-console
    console.log(`[DEV_PREVIEW] SMS code for ${phone}: ${code}`);
    return { delivered: false, provider: 'dev-preview', code };
  }

  throw new Error(
    'No SMS provider configured. Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID, or DEV_PREVIEW=true for local-only testing.'
  );
}

export async function checkCode(phone, code) {
  if (!twilioConfigured) return null; // caller falls back to local OTP check (dev-preview only)
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Code: code }),
    }
  );
  if (!res.ok) return { ok: false };
  const data = await res.json();
  return { ok: data.status === 'approved' };
}
