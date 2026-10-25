# NORE

**NORE es una mini IA de apoyo para el salón**, no un bot tradicional lleno de comandos. Su objetivo es ayudar a los estudiantes a estudiar, entender temas y organizar actividades escolares mediante conversación natural.

## Cómo se usa

- **Chat privado:** puedes escribirle normalmente, sin comandos.
- **Grupo:** responde cuando el mensaje contiene `NORE`, `IA` o `bot`, o cuando se etiqueta la cuenta.
- **Anti-spam:** aplica un pequeño tiempo de espera por persona.
- **Ayuda:** `!ayuda` muestra las funciones y los comandos principales.

## Comandos principales

| Comando | Función |
|---|---|
| `!menu` | Enviar el menú web |
| `!horario` | Consultar el horario del salón |
| `!tareas` | Consultar tareas pendientes |
| `!recordar` | Consultar el estado de los recordatorios |
| `!creador` | Mostrar información del creador |
| `!ayuda` | Mostrar cómo usar NORE |

El horario, las tareas y los recordatorios aún necesitan su módulo de datos. Por ahora NORE informa claramente que no están configurados; no inventa tareas ni dice que guardó recordatorios cuando no puede hacerlo. Existe también una estadística básica interna para el propietario.

## Estado actual

- Conexión de WhatsApp con Baileys y QR.
- Conversación con IA mediante una API compatible con OpenAI.
- Memoria de conversación separada por usuario.
- Activación controlada en grupos.
- Reacciones de proceso y respuesta.
- Comandos básicos y menú web simplificado.

Lectura de imágenes, PDF, edición multimedia, stickers, voz, horario real, tareas y recordatorios persistentes todavía no están conectados. Se añadirán solo cuando estén implementados y probados.

## Requisitos

- Node.js 20 o superior.
- Una cuenta de WhatsApp para vincular NORE.
- Una clave de API compatible con OpenAI.

## Instalación en Termux o Linux

```bash
git clone -b nore https://github.com/ppequepro-cmyk/Cryp.git NORE
cd NORE
npm install
cp .env.example .env
nano .env
npm run check
npm start
```

Configura `OWNER_NUMBER` con el número del propietario en formato internacional, sin `+` ni espacios, y añade `AI_API_KEY`. No compartas el archivo `.env`.

Escanea el QR desde WhatsApp > Dispositivos vinculados. La carpeta `auth_info` contiene la sesión y no debe subirse a GitHub.

## Menú web

El archivo `index.html` de la raíz es la entrada para GitHub Pages. En Settings > Pages, selecciona Deploy from a branch, rama `nore` y carpeta `/(root)`.

## Privacidad

NORE solo procesa los mensajes y archivos que WhatsApp entrega normalmente. No debe eludir protecciones de mensajes o medios de una sola vista. Las funciones de administración deben verificar que quien las solicita sea el propietario o un administrador autorizado.
