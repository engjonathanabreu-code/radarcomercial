import nodemailer from 'nodemailer';

export function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function textToHtml(text: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2a2b">${text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')}</div>`;
}

export async function sendMail(opts: { to: string; cc?: string | null; subject: string; text: string; html?: string; bcc?: string | null }) {
  const from = `"${process.env.SMTP_FROM_NAME || process.env.SMTP_USER}" <${process.env.SMTP_USER}>`;
  const info = await transport().sendMail({
    from,
    to: opts.to,
    cc: opts.cc || undefined,
    bcc: opts.bcc ?? (process.env.SMTP_BCC || undefined),
    replyTo: process.env.SMTP_USER,
    subject: opts.subject,
    text: opts.text,
    html: opts.html || textToHtml(opts.text),
  });
  return info.messageId as string;
}
