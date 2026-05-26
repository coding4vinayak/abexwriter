/**
 * EPUB 3 export — generates a valid EPUB file as a Buffer.
 * Uses raw zip manipulation via Node's built-in zlib (no external deps).
 *
 * EPUB is just a zip with:
 * 1. mimetype (uncompressed, first entry)
 * 2. META-INF/container.xml
 * 3. OEBPS/content.opf (manifest + spine)
 * 4. OEBPS/toc.xhtml (navigation)
 * 5. OEBPS/chN.xhtml (one per chapter)
 */
import { storage } from "./storage";
import { deflateRawSync } from "node:zlib";

interface ZipEntry {
  path: string;
  data: Buffer;
  compress: boolean;
}

/**
 * Build a minimal ZIP file from entries.
 * The mimetype entry must be first and stored (not compressed).
 */
function buildZip(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBuf = Buffer.from(entry.path, "utf8");
    const rawData = entry.data;
    const compressed = entry.compress ? deflateRawSync(rawData) : rawData;
    const method = entry.compress ? 8 : 0; // 8 = deflate, 0 = store
    const crc = crc32(rawData);

    // Local file header (30 bytes + path + data)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8); // compression
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14); // crc32
    local.writeUInt32LE(compressed.length, 18); // compressed size
    local.writeUInt32LE(rawData.length, 22); // uncompressed size
    local.writeUInt16LE(pathBuf.length, 26); // filename length
    local.writeUInt16LE(0, 28); // extra field length

    localHeaders.push(Buffer.concat([local, pathBuf, compressed]));

    // Central directory header (46 bytes + path)
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(method, 10); // compression
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16); // crc32
    central.writeUInt32LE(compressed.length, 20); // compressed size
    central.writeUInt32LE(rawData.length, 24); // uncompressed size
    central.writeUInt16LE(pathBuf.length, 28); // filename length
    central.writeUInt16LE(0, 30); // extra field length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset

    centralHeaders.push(Buffer.concat([central, pathBuf]));

    offset += 30 + pathBuf.length + compressed.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centralHeaders);
  const centralSize = centralBuf.length;

  // End of central directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12); // central dir size
  eocd.writeUInt32LE(centralStart, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, centralBuf, eocd]);
}

/**
 * CRC-32 implementation (needed for ZIP format).
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textToXhtml(content: string): string {
  // Convert plain text / simple markdown to basic XHTML paragraphs
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      // Heading detection
      if (p.startsWith("### ")) return `<h3>${escapeXml(p.slice(4))}</h3>`;
      if (p.startsWith("## ")) return `<h2>${escapeXml(p.slice(3))}</h2>`;
      if (p.startsWith("# ")) return `<h1>${escapeXml(p.slice(2))}</h1>`;
      // Normal paragraph — handle single newlines as line breaks
      const lines = p.split("\n").map((l) => escapeXml(l)).join("<br/>");
      return `<p>${lines}</p>`;
    })
    .join("\n    ");
}

export async function exportToEpub(bookId: number): Promise<Buffer> {
  const book = await storage.getBook(bookId);
  if (!book) throw new Error("Book not found");

  const chapters = await storage.getChapters(bookId);
  chapters.sort((a, b) => a.orderIndex - b.orderIndex);

  const bookTitle = escapeXml(book.title);
  const bookDesc = escapeXml(book.description || "");
  const now = new Date().toISOString().slice(0, 19) + "Z";

  // Build entries
  const entries: ZipEntry[] = [];

  // 1. mimetype (MUST be first, uncompressed)
  entries.push({
    path: "mimetype",
    data: Buffer.from("application/epub+zip", "ascii"),
    compress: false,
  });

  // 2. META-INF/container.xml
  entries.push({
    path: "META-INF/container.xml",
    data: Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
      "utf8",
    ),
    compress: true,
  });

  // 3. content.opf
  const manifestItems = chapters
    .map((_, i) => `    <item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n");
  const spineItems = chapters
    .map((_, i) => `    <itemref idref="ch${i + 1}"/>`)
    .join("\n");

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${bookId}-abexwriter</dc:identifier>
    <dc:title>${bookTitle}</dc:title>
    <dc:description>${bookDesc}</dc:description>
    <dc:language>en</dc:language>
    <dc:creator>AbexWriter</dc:creator>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`;

  entries.push({
    path: "OEBPS/content.opf",
    data: Buffer.from(contentOpf, "utf8"),
    compress: true,
  });

  // 4. toc.xhtml (navigation document)
  const tocItems = chapters
    .map(
      (ch, i) =>
        `      <li><a href="ch${i + 1}.xhtml">${escapeXml(ch.title)}</a></li>`,
    )
    .join("\n");

  const tocXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
${tocItems}
    </ol>
  </nav>
</body>
</html>`;

  entries.push({
    path: "OEBPS/toc.xhtml",
    data: Buffer.from(tocXhtml, "utf8"),
    compress: true,
  });

  // 5. Chapter XHTML files
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const chTitle = escapeXml(ch.title);
    const chBody = textToXhtml(ch.content || "");

    const chXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${chTitle}</title></head>
<body>
  <h1>${chTitle}</h1>
  ${chBody}
</body>
</html>`;

    entries.push({
      path: `OEBPS/ch${i + 1}.xhtml`,
      data: Buffer.from(chXhtml, "utf8"),
      compress: true,
    });
  }

  return buildZip(entries);
}
