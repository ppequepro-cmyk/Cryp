import { config } from './config.js';

const histories = new Map();

export async function askAI(jid, prompt, displayName = 'Usuario', image = null) {
  if (!config.aiApiKey) return 'Todavía no tengo configurado mi servicio de IA. El propietario debe añadir la clave en el archivo .env.';
  const history = histories.get(jid) || [];
  const userContent = image
    ? [
        { type: 'text', text: prompt || 'Describe esta imagen y ayúdame a entender su contenido.' },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }
      ]
    : prompt;

  const messages = [
    {
      role: 'system',
      content: `Eres NORE, una mini IA independiente creada por Emmanuel para apoyar a estudiantes de preparatoria. En conversaciones normales responde de forma natural, clara y amable. Ayuda a estudiar, explicar conceptos y resolver ejercicios. Cuando recibas una foto de tarea, organiza la respuesta por el mismo orden en que aparecen los ejercicios. Usa encabezados breves, separa cada ejercicio, muestra datos relevantes, procedimiento numerado y resultado final claramente identificado. No mezcles respuestas ni inventes partes ilegibles; si una sección no se distingue, indícalo y pide una foto más clara. No inventes horarios, tareas, fechas ni avisos del salón. No afirmes que una función está disponible si no lo está. No afirmes que OpenAI creó NORE. Llama al usuario por su nombre solo si resulta natural: ${displayName}.`
    },
    ...history,
    { role: 'user', content: userContent }
  ];

  const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.aiApiKey}`, 'Content-Type': 'application/json' },
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

  const historyPrompt = image ? `[Imagen recibida] ${prompt || 'Describe la imagen.'}` : prompt;
  histories.set(jid, [...history, { role: 'user', content: historyPrompt }, { role: 'assistant', content: answer }].slice(-config.maxHistoryMessages));
  return answer;
}
