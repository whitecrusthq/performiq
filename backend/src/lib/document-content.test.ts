import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractDocumentContent, detectDocumentType, UnsupportedDocumentError, MAX_INLINE_BYTES } from "./document-content.js";

async function zipOf(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, body] of Object.entries(files)) zip.file(name, body);
  return zip.generateAsync({ type: "nodebuffer" });
}

test("file types are detected from MIME type or extension", () => {
  assert.equal(detectDocumentType("application/pdf", null), "pdf");
  assert.equal(detectDocumentType("", "Handbook.PDF"), "pdf");
  assert.equal(detectDocumentType(null, "policy.docx"), "docx");
  assert.equal(detectDocumentType("text/plain; charset=utf-8", null), "text");
  assert.equal(detectDocumentType("application/msword", "old.doc"), "legacy-office");
  assert.equal(detectDocumentType("application/zip", "x.zip"), "unknown");
});

test("PDFs are passed to Gemini as-is; oversized ones are refused", async () => {
  const pdf = Buffer.from("%PDF-1.7 fake");
  const out = await extractDocumentContent(pdf, "application/pdf", "h.pdf");
  assert.deepEqual(out, { kind: "inline", mimeType: "application/pdf", data: pdf.toString("base64") });
  await assert.rejects(
    extractDocumentContent(Buffer.alloc(MAX_INLINE_BYTES + 1), "application/pdf", "big.pdf"),
    UnsupportedDocumentError,
  );
});

test("Word documents keep paragraphs and decode entities", async () => {
  const docx = await zipOf({
    "word/document.xml": `<w:document><w:body>
      <w:p><w:r><w:t>Annual leave is 20 days.</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">Sick &amp; compassionate leave</w:t></w:r><w:r><w:tab/><w:t>&#8211; see HR</w:t></w:r></w:p>
    </w:body></w:document>`,
  });
  const out: any = await extractDocumentContent(docx, null, "policy.docx");
  assert.equal(out.kind, "text");
  assert.equal(out.text, "Annual leave is 20 days.\nSick & compassionate leave\t– see HR");
});

test("PowerPoint slides are read in slide order", async () => {
  const pptx = await zipOf({
    "ppt/slides/slide10.xml": "<p:sld><a:p><a:r><a:t>Tenth</a:t></a:r></a:p></p:sld>",
    "ppt/slides/slide2.xml": "<p:sld><a:p><a:r><a:t>Second</a:t></a:r></a:p></p:sld>",
    "ppt/slides/slide1.xml": "<p:sld><a:p><a:r><a:t>First</a:t></a:r></a:p></p:sld>",
  });
  const out: any = await extractDocumentContent(pptx, null, "deck.pptx");
  assert.equal(out.text, "Slide 1:\nFirst\n\nSlide 2:\nSecond\n\nSlide 3:\nTenth");
});

test("Excel shared and inline strings are extracted", async () => {
  const xlsx = await zipOf({
    "xl/sharedStrings.xml": "<sst><si><t>Grade</t></si><si><r><t>Leave </t></r><r><t>days</t></r></si></sst>",
    "xl/worksheets/sheet1.xml": '<worksheet><c t="inlineStr"><is><t>Overtime &lt;2h&gt;</t></is></c></worksheet>',
  });
  const out: any = await extractDocumentContent(xlsx, null, "grades.xlsx");
  assert.equal(out.text, "Grade\nLeave days\n\nOvertime <2h>");
});

test("plain text is read; legacy, damaged and unknown files give clear errors", async () => {
  const out: any = await extractDocumentContent(Buffer.from("﻿Dress code: business casual."), "text/plain", "a.txt");
  assert.equal(out.text, "Dress code: business casual.");
  await assert.rejects(extractDocumentContent(Buffer.from("x"), "application/msword", "old.doc"), /Save the file as PDF or \.docx/);
  await assert.rejects(extractDocumentContent(Buffer.from("not a zip"), null, "broken.docx"), /damaged or password-protected/);
  await assert.rejects(extractDocumentContent(Buffer.from("x"), "application/zip", "a.zip"), UnsupportedDocumentError);
});
