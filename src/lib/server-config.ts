import 'server-only';

export function getServerEvolutionConfig() {
  return {
    baseUrl: process.env.EVOLUTION_API_URL?.trim() || '',
    apiKey: process.env.EVOLUTION_API_KEY?.trim() || '',
    instanceName: process.env.EVOLUTION_INSTANCE_NAME?.trim() || '',
  };
}

export function getServerSmtpConfig() {
  const port = Number(process.env.SMTP_PORT || 0);
  return {
    host: process.env.SMTP_HOST?.trim() || '',
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    user: process.env.SMTP_USER?.trim() || '',
    pass: process.env.SMTP_PASSWORD || '',
    fromName: process.env.SMTP_FROM_NAME?.trim() || 'AllWhatsPy',
    fromEmail: process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim() || '',
    replyTo: process.env.SMTP_REPLY_TO?.trim() || undefined,
  };
}
