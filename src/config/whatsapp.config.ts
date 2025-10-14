export const WHATSAPP_CONFIG = {
  authStatePath: 'auth',
  loggerLevel: 'silent' as const,
  browser: ['WhatsApp Bot', 'Chrome', '1.0.0'] as [string, string, string],
  targetJid: '5519987428185@s.whatsapp.net',
  initialMessage: 'Olá! Mensagem enviada pelo bot do Baileys.',
};
