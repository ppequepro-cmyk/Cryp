import 'dotenv/config';

const required = (name, fallback = '') => process.env[name]?.trim() || fallback;

export const config = {
  botName: required('BOT_NAME', 'NORE'),
  ownerNumber: required('OWNER_NUMBER').replace(/\D/g, ''),
  aiBaseUrl: required('AI_BASE_URL', 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
  aiApiKey: required('AI_API_KEY'),
  aiModel: required('AI_MODEL', 'openai/gpt-oss-120b'),
  aiVisionModel: required('AI_VISION_MODEL', 'qwen/qwen3.8-27b'),
  maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || 700),
  maxHistoryMessages: Number(process.env.MAX_HISTORY_MESSAGES || 12),
  menuUrl: required('MENU_URL', 'https://ppequepro-cmyk.github.io/Cryp/'),
  timezone: required('TIMEZONE', 'America/Mexico_City')
};

export function isOwner(jid = '') {
  const number = String(jid).replace(/:\d+@/, '@').split('@')[0].replace(/\D/g, '');
  return Boolean(config.ownerNumber && number === config.ownerNumber);
}
