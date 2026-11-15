import { ApiError } from '../api/http.ts';

export function emailSender(env: Record<string, string | undefined> = process.env) {
  const key = env.RESEND_API_KEY, from = env.SECONDHAND_EMAIL_FROM;
  if (!key || !from) return undefined;
  return async (email: string, code: string) => {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject: 'Your Secondhand sign-in code',
          text: `Your Secondhand sign-in code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.` }),
      });
    } catch { throw new ApiError('unavailable', 'Email could not be sent. Try again.', 'send_code', { by: 'user' }); }
    if (!response.ok) throw new ApiError('unavailable', 'Email could not be sent. Try again.', 'send_code', { by: 'user' });
  };
}
