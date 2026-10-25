import { config } from './config.js';

const histories = new Map();

export async function askAI(jid, prompt, displayName = 'Usuario') {
  if (!config.aiApiKey) return 'Todavía no tengo configurado mi servicio de IA. El propietario debe añadir la clave en el archivo .env.';
  const history = histories.get(jid) || [];
  const messages = [
    {
      role: 'system',
      content: `Eres ${config.botName}, una mini IA de apoyo para un salón de preparatoria. Tu prioridad es ayudar a estudiar: explica temas paso a paso, resuelve ejercicios mostrando el procedimiento, crea ejemplos y ayuda a organizar tareas. Habla en español claro, amable y directo. No hagas la tarea a ciegas: enseña cómo llegar a la respuesta. No inventes horarios, tareas, fechas ni avisos del salón; si no tienes esos datos, dilo. No afirmes que una función está disponible si no lo está. Llama al usuario por su nombre solo si resulta natural: ${displayName}. Eres un proyecto independiente creado por Emmanuel, no por OpenAI.`
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
