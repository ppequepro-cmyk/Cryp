export function parseLoadingCommand(text = '') {
  const match = String(text).trim().match(/^\.(?:carga|ia|preguntar)\s+([\s\S]+)$/i);
  return match ? match[1].trim() : null;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runLoadingReply(sock, jid, msg, prompt, askAI, sender, name, image = null) {
  if (!prompt) return false;
  const sent = await sock.sendMessage(jid, {
    text: '▰▱▱▱▱ 0% · Preparando respuesta...'
  }, { quoted: msg });

  const stages = [
    '▰▰▱▱▱ 25% · Procesando pregunta...',
    '▰▰▰▱▱ 50% · Analizando información...',
    '▰▰▰▰▱ 75% · Redactando respuesta...',
    '▰▰▰▰▰ 100% · Finalizando...'
  ];

  try {
    const answerPromise = askAI(sender, prompt, name, image);
    for (const stage of stages) {
      await wait(450);
      await sock.sendMessage(jid, { text: stage, edit: sent.key });
    }
    const answer = await answerPromise;
    await sock.sendMessage(jid, { text: answer, edit: sent.key });
    return true;
  } catch (error) {
    console.error('Error en respuesta con barra de carga:', error.message);
    await sock.sendMessage(jid, {
      text: 'No pude generar la respuesta ahora. Inténtalo de nuevo más tarde.'
    }, { quoted: msg });
    return false;
  }
}
