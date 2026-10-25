import { config } from './config.js';

const histories = new Map();

export async function askAI(jid, prompt, displayName = 'Usuario', image = null) {
  if (!config.aiApiKey) return 'Todavía no tengo configurado mi servicio de IA. El propietario debe añadir la clave en el archivo .env.';
  const history = histories.get(jid) || [];
  const userContent = image
    ? [
        { type: 'text', text: prompt || 'Describe esta imagen y ayúdame a entender su contenido.' },
        {
          type: 'image_url',
          image_url: { url: `data:${image.mimeType};base64,${image.base64}` }
        }
      ]
    : prompt;

  const messages = [
    {
      role: 'system',
      content: `Eres ${config.botName}, una mini IA de apoyo para un salón de preparatoria. Tu prioridad es ayudar a estudiar: explica temas paso a paso, resuelve ejercicios mostrando el procedimiento, crea ejemplos y ayuda a organizar tareas. También puedes analizar imágenes que el usuario adjunte: describe solo lo que realmente puedas observar, lee texto legible y explica ejercicios paso a paso. Si algo no se distingue, dilo; nunca inventes contenido. Habla en español claro, amable y directo. No hagas la tarea a ciegas: enseña cómo llegar a la respuesta. No inventes horarios, tareas, fechas ni avisos del salón; si no tienes esos datos, dilo. No afirmes que una función está disponible si no lo está. Llama al usuario por su nombre solo si resulta natural: ${displayName}. Eres un proyecto independiente creado por Emmanuel, no por OpenAI.`
    },
    ...history,
    { role: 'user', content: userContent }
  ];

  const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.aiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: image ? config.aiVisionModel : config.aiModel,
      messages,
      max_tokens: config.maxOutputTokens,
      temperature: 0.7
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI provider HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('AI provider returned an empty response');

  // No guardamos el contenido base64 en el historial para evitar memoria innecesaria.
  const historyPrompt = image ? `[Imagen recibida] ${prompt || 'Describe la imagen.'}` : prompt;
  const next = [...history, { role: 'user', content: historyPrompt }, { role: 'assistant', content: answer }]
    .slice(-config.maxHistoryMessages);
  histories.set(jid, next);
  return answer;
}
