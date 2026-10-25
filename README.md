# NORE

**NORE es una mini IA de apoyo escolar para WhatsApp.**

## Cómo se usa
- **Privado:** conversa normalmente, sin comandos.
- **Grupos:** NORE responde cuando escribes su nombre o etiquetas la cuenta.
- **Ayuda:** `!ayuda` muestra un recorrido guiado.
- **PDF:** `.pdf texto` crea un PDF; enviar un PDF a NORE permite extraer su texto y pedir resumen o explicación.

## Comandos disponibles
| Comando | Función |
|---|---|
| `!menu` | Enviar el menú web |
| `!ayuda` | Recorrido guiado |
| `!musica` | Abrir NORE MUSIC |
| `.pdf texto` | Crear un PDF a partir del texto indicado |
| Enviar un PDF | Extraer texto para resumirlo o explicarlo |
| `!horario` | Consultar horario configurado |
| `!tareas` | Consultar tareas registradas |
| `!recordar` | Consultar estado de recordatorios |
| `!creador` | Información del creador |

## Estado
- WhatsApp con Baileys y conexión por QR.
- Conversación con IA mediante API compatible con OpenAI.
- Activación controlada en grupos.
- Bienvenida automática con foto si está disponible.
- Creación y extracción de texto de PDF (no incluye OCR de documentos escaneados).
- Menú web en `index.html`.

Stickers inteligentes, registro de usuarios, estadísticas ampliadas, OCR, voz y herramientas multimedia avanzadas todavía necesitan integración y pruebas.

## Requisitos
- Node.js 20 o superior.
- WhatsApp para vincular NORE.
- Clave de API compatible con OpenAI.

## Instalación
```bash
git clone -b nore https://github.com/ppequepro-cmyk/Cryp.git NORE
cd NORE
npm install
cp .env.example .env
nano .env
npm run check
npm start
```
Configura `OWNER_NUMBER` y `AI_API_KEY` en `.env`. No compartas ese archivo ni la carpeta `auth_info`.

## Privacidad
NORE procesa solo los mensajes y archivos que WhatsApp entrega normalmente. No debe eludir protecciones de mensajes ni medios de una sola vista.
