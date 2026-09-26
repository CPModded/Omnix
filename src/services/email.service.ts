import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';

export interface EmailAttachmentInput {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

function provider() {
  return String(process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
}

export function emailConfig() {
  const isGmail = provider() === 'gmail';
  const smtpHost = process.env.EMAIL_SMTP_HOST || (isGmail ? 'smtp.gmail.com' : '');
  const smtpPort = Number(process.env.EMAIL_SMTP_PORT || (isGmail ? 465 : 587));
  const smtpSecure = String(process.env.EMAIL_SMTP_SECURE ?? (isGmail ? 'true' : 'false')).toLowerCase() === 'true';
  const user = process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER || '';
  const password = process.env.EMAIL_SMTP_PASSWORD || process.env.EMAIL_PASSWORD || '';
  const from = process.env.EMAIL_FROM || user;
  const fromName = process.env.EMAIL_FROM_NAME || 'OMNIX';
  const imapHost = process.env.EMAIL_IMAP_HOST || (isGmail ? 'imap.gmail.com' : '');
  const imapPort = Number(process.env.EMAIL_IMAP_PORT || (isGmail ? 993 : 993));
  const imapSecure = String(process.env.EMAIL_IMAP_SECURE ?? 'true').toLowerCase() === 'true';
  return {
    provider: provider(), smtpHost, smtpPort, smtpSecure, user, password, from, fromName,
    imapHost, imapPort, imapSecure,
    sendConfigured: Boolean(smtpHost && user && password && from),
    receiveConfigured: Boolean(imapHost && user && password),
  };
}

export function getTransporter() {
  const c = emailConfig();
  if (!c.sendConfigured) throw new Error('Configuration SMTP Gmail incomplète.');
  return nodemailer.createTransport({ host:c.smtpHost, port:c.smtpPort, secure:c.smtpSecure, auth:{ user:c.user, pass:c.password } });
}

export async function sendEmail(input:{to:string|string[];subject:string;text:string;html?:string;attachments?:EmailAttachmentInput[];replyTo?:string}) {
  const c = emailConfig();
  const transporter = getTransporter();
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const attachments = (input.attachments || []).map(a => ({ filename:a.filename, content:Buffer.from(a.contentBase64,'base64'), contentType:a.contentType }));
  return transporter.sendMail({ from:`${c.fromName} <${c.from}>`, to, subject:input.subject, text:input.text, html:input.html, replyTo:input.replyTo, attachments });
}

export async function listInbox(limit=50) {
  const c = emailConfig();
  if (!c.receiveConfigured) throw new Error('Configuration IMAP Gmail incomplète.');
  const client = new ImapFlow({ host:c.imapHost, port:c.imapPort, secure:c.imapSecure, auth:{ user:c.user, pass:c.password }, logger:false });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const messages:any[] = [];
    for await (const msg of client.fetch('1:*', { envelope:true, flags:true, uid:true })) {
      messages.push({ uid:msg.uid, subject:msg.envelope?.subject || '(sans objet)', from:msg.envelope?.from || [], to:msg.envelope?.to || [], date:msg.envelope?.date || null, seen:msg.flags?.has?.('\\Seen') || false });
      if (messages.length >= limit) break;
    }
    return messages.reverse();
  } finally {
    lock.release();
    await client.logout().catch(()=>undefined);
  }
}
