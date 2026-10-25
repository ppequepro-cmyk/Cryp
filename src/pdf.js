import PDFDocument from 'pdfkit';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 30000;

export async function readPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('El PDF está vacío.');
  if (buffer.length > MAX_PDF_BYTES) throw new Error('El PDF supera el límite de 10 MB.');
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str || '').join(' '));
    }
  } finally {
    await pdf.destroy();
  }
  const text = pages.join('\n').replace(/\\u0000/g, '').trim();
  if (!text) throw new Error('No pude extraer texto. Puede ser un PDF escaneado o protegido.');
  return text.slice(0, MAX_TEXT_CHARS);
}

export async function createPdfBuffer(title, content) {
  const cleanTitle = String(title || 'Documento NORE').slice(0, 120);
  const cleanContent = String(content || '').trim();
  if (!cleanContent) throw new Error('Escribe el contenido después de .pdf para crear el documento.');
  if (cleanContent.length > MAX_TEXT_CHARS) throw new Error('El texto supera el límite de 30,000 caracteres.');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 58, right: 58 }, info: { Title: cleanTitle, Author: 'NORE' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#26345f').text(cleanTitle, { align: 'center' });
    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(11).fillColor('#222222').text(cleanContent, { align: 'left', lineGap: 4 });
    doc.end();
  });
}

export const pdfLimits = { maxBytes: MAX_PDF_BYTES, maxTextChars: MAX_TEXT_CHARS };
