import { config } from './config.js';

const histories = new Map();

export async function askAI(jid, prompt, displayName = 'Usuario') {
  if (!config.aiApiKey) return 'Todavía no tengo configurado mi servicio de IA. Mi creador debe añadir la clave en el archivo .env.';
  const history = histories.get(jid) || [];
  const messages = [
    {
      role: 'system',
      content: `Eres ${config.botName}, un asistente de WhatsApp en español para estudiantes de preparatoria y uso general. Explicas con claridad, sin inventar datos, con tono amable y directo. Llama al usuario por su nombre cuando esté disponible: ${displayName}. Si no sabes algo, dilo. No afirmes que una función está disponible si no lo está. Eres un proyecto independiente creado por Emmanuel, no por OpenAI.`
    },
    ...history,
    { role: 'user', content: prompt }
  ];

  const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.aiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages,
      max_tokens: config.maxOutputTokens,
      temperature: 0.7
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI provider HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('AI provider returned an empty response');

  const next = [...history, { role: 'user', content: prompt }, { role: 'assistant', content: answer }]
    .slice(-config.maxHistoryMessages);
  histories.set(jid, next);
  return answer;
}
