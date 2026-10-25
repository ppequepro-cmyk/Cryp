# NORE

NORE es un mini bot de WhatsApp con IA y un menú web adaptable a móviles. El nombre visible del proyecto y del bot es **NORE**. El repositorio de GitHub todavía conserva el nombre técnico anterior.

## Estado actual

Esta es la primera base creada desde cero:
- Conexión inicial de WhatsApp mediante Baileys y QR.
- Chat privado libre, sin prefijos.
- En grupos responde cuando el texto incluye NORE, IA o bot, o cuando se etiqueta la cuenta del bot.
- Respuesta con IA mediante una API compatible con OpenAI.
- Información del creador con las palabras creador, dueño, owner y el comando público `!creador`.
- Enlace del menú al escribir `menu`.
- Estadísticas iniciales solo para el propietario con `!stats`.
- Menú web en `index.html` (GitHub Pages) y copia en `public/index.html`.

Las funciones de imágenes, edición multimedia, stickers, PDF, recordatorios, horarios, cuestionarios, audio, Snake y descargas todavía no están conectadas. Se incorporarán por etapas y se probarán antes de marcarlas como terminadas.

## Requisitos

- Node.js 20 o superior.
- Una cuenta de WhatsApp para vincular el bot.
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

## Privacidad y límites

NORE solo procesa los mensajes y archivos que WhatsApp entrega normalmente. No debe eludir protecciones de mensajes o medios de visualización única. Las funciones de administración deben verificar que quien las solicita sea el propietario o un administrador autorizado.
