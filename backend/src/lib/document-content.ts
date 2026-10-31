import JSZip from "jszip";

/**
 * Turns an uploaded document into content Gemini can read. PDFs and images are
 * sent as-is (Gemini reads them natively, including scanned pages); Office
 * Open XML files and plain text are converted to text here.
 */

export type DocumentContent =
  | { kind: "inline"; mimeType: string; data: string }
  | { kind: "text"; text: string };

export class UnsupportedDocumentError extends Error {}

// Gemini caps a whole request at 20 MB, and base64 adds a third.
export const MAX_INLINE_BYTES = 14 * 1024 * 1024;
const MAX_XML_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_CHARS = 300_000;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv"]);

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function extensionOf(filename?: string | null): string {
  const m = String(filename ?? "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function detectDocumentType(mimeType?: string | null, filename?: string | null): string {
  const mime = String(mimeType ?? "").toLowerCase().split(";")[0].trim();
  const ext = extensionOf(filename);
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime === DOCX || ext === "docx") return "docx";
  if (mime === PPTX || ext === "pptx") return "pptx";
  if (mime === XLSX || ext === "xlsx") return "xlsx";
  if (IMAGE_TYPES.has(mime)) return "image";
  if (mime.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";
  if (["doc", "xls", "ppt"].includes(ext) || mime === "application/msword" || mime === "application/vnd.ms-excel" || mime === "application/vnd.ms-powerpoint") {
    return "legacy-office";
  }
  return "unknown";
}

export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Reads only text runs (<w:t>, <a:t>) plus tabs, line breaks and paragraph ends
 * from Word/PowerPoint XML; whitespace between tags is layout, not content.
 */
function xmlToText(xml: string): string {
  let text = "";
  const tokens = /<(w|a):t(?:\s[^>]*)?>([\s\S]*?)<\/\1:t>|<w:tab\/>|<(?:w|a):br\b[^>]*\/>|<\/(?:w|a):p>/g;
  for (const m of xml.matchAll(tokens)) {
    if (m[2] !== undefined) text += decodeXmlEntities(m[2]);
    else if (m[0] === "<w:tab/>") text += "\t";
    else text += "\n";
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function readEntry(zip: JSZip, name: string): Promise<string> {
  const entry = zip.file(name);
  if (!entry) return "";
  const size = (entry as any)._data?.uncompressedSize;
  if (typeof size === "number" && size > MAX_XML_ENTRY_BYTES) {
    throw new UnsupportedDocumentError("The document is too large to read.");
  }
  return entry.async("string");
}

const numbered = (prefix: string) => (zip: JSZip) =>
  Object.keys(zip.files)
    .filter(n => n.startsWith(prefix) && /\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));

async function officeText(buffer: Buffer, type: "docx" | "pptx" | "xlsx"): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new UnsupportedDocumentError("The file couldn't be opened. It may be damaged or password-protected.");
  }
  const parts: string[] = [];
  if (type === "docx") {
    parts.push(xmlToText(await readEntry(zip, "word/document.xml")));
  } else if (type === "pptx") {
    for (const [i, name] of numbered("ppt/slides/slide")(zip).entries()) {
      const t = xmlToText(await readEntry(zip, name));
      if (t) parts.push(`Slide ${i + 1}:\n${t}`);
    }
  } else {
    const shared = await readEntry(zip, "xl/sharedStrings.xml");
    const strings = [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
      decodeXmlEntities([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
    if (strings.length) parts.push(strings.join("\n"));
    for (const name of numbered("xl/worksheets/sheet")(zip)) {
      const xml = await readEntry(zip, name);
      const inline = [...xml.matchAll(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/g)].map(m => decodeXmlEntities(m[1]));
      if (inline.length) parts.push(inline.join("\n"));
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

export async function extractDocumentContent(buffer: Buffer, mimeType?: string | null, filename?: string | null): Promise<DocumentContent> {
  const type = detectDocumentType(mimeType, filename);
  switch (type) {
    case "pdf":
    case "image": {
      if (buffer.length > MAX_INLINE_BYTES) {
        throw new UnsupportedDocumentError(`The file is over ${MAX_INLINE_BYTES / (1024 * 1024)} MB, which is too large to send to the AI.`);
      }
      const mime = type === "pdf" ? "application/pdf" : String(mimeType).toLowerCase();
      return { kind: "inline", mimeType: mime, data: buffer.toString("base64") };
    }
    case "docx":
    case "pptx":
    case "xlsx":
      return { kind: "text", text: (await officeText(buffer, type)).slice(0, MAX_TEXT_CHARS) };
    case "text":
      return { kind: "text", text: buffer.toString("utf8").replace(/^﻿/, "").slice(0, MAX_TEXT_CHARS) };
    case "legacy-office":
      throw new UnsupportedDocumentError("Older Office formats (.doc, .xls, .ppt) can't be read. Save the file as PDF or .docx and upload it again.");
    default:
      throw new UnsupportedDocumentError("This file type can't be read by the AI. Upload a PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx) or text file.");
  }
}
