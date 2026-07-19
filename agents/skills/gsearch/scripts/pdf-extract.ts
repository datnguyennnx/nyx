#!/usr/bin/env bun
/**
 * PDF text extractor — reads PDF from stdin, outputs text to stdout.
 *
 * Uses built-in zlib for FlateDecode streams. Zero external dependencies.
 * Bun-native (runs TypeScript directly). Handles academic PDFs (arXiv, research papers).
 *
 * Category theory: This is a morphism PDF → String in the category of
 *   file-format transformations. It factors through multiple intermediate
 *   objects (Stream, Chunk, Token) with well-defined composition.
 *
 * Information theory: Extraction maximizes mutual information I(PDF; Text)
 *   by recovering the text content from compressed streams, minimizing
 *   the information lost in the PDF→Text channel.
 */
import zlib from 'zlib';
import fs from 'fs';

/** A PDF stream object with its filter type and raw data */
interface PdfStream {
  data: string;
  isFlate: boolean;
  objHeader: string;
}

/** Extracted text chunk from a PDF content stream */
interface TextChunk {
  text: string;
  streamIndex: number;
}

/**
 * Check if a buffer starts with PDF magic number.
 * Functor: identity check in the FileType category.
 */
function isPdf(buf: Buffer): boolean {
  return buf.slice(0, 5).toString() === '%PDF-';
}

/**
 * Extract all stream objects from raw PDF source.
 * Natural transformation: PDF source → [PdfStream]
 */
function extractStreams(src: string): PdfStream[] {
  const streams: PdfStream[] = [];
  const objRegex = /(\d+ \d+ obj[\s\S]*?endobj)/g;
  let match: RegExpExecArray | null;

  while ((match = objRegex.exec(src)) !== null) {
    const obj = match[1];
    const isFlate = /FlateDecode/i.test(obj);
    const streamMatch = obj.match(/stream\s([\s\S]*?)\n?endstream/);

    if (streamMatch) {
      streams.push({
        data: streamMatch[1].trim(),
        isFlate,
        objHeader: obj.slice(0, 80),
      });
    }
  }

  return streams;
}

/**
 * Decompress a single stream. Composes:
 *   FlateDecode ∘ ASCII85Decode ∘ ... → raw bytes
 * Currently supports: FlateDecode (zlib inflate) and plain/uncompressed.
 */
function decompressStream(s: PdfStream): Buffer | null {
  try {
    if (s.isFlate) {
      return zlib.inflateSync(Buffer.from(s.data, 'binary'));
    }
    // Plain/uncompressed stream
    return Buffer.from(s.data, 'binary');
  } catch {
    return null; // stream unparseable — skip (information loss)
  }
}

/**
 * Extract text from a decompressed content stream.
 * Uses the PDF text operators: Tj, TJ, ', "
 * Morphism: Buffer → [TextChunk] in the PDF-parsing category.
 */
function extractTextFromStream(raw: Buffer, streamIndex: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  const src = raw.toString('binary');
  const parenRegex = /\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = parenRegex.exec(src)) !== null) {
    const t = match[1]
      .replace(/\\([0-7]{3})/g, (_, oct: string) =>
        String.fromCharCode(parseInt(oct, 8))
      )
      .replace(/\\(.)/g, '$1')
      .replace(/\\n/g, '\n')
      .trim();

    if (t.length > 1) {
      chunks.push({ text: t, streamIndex });
    }
  }

  return chunks;
}

/**
 * Main extraction pipeline. Composes morphisms:
 *   stdin → Buffer → isPdf (guard)
 *         → extractStreams → map decompressStream
 *         → flatMap extractTextFromStream → join → stdout
 *
 * Monad: The extraction is a Maybe monad — each step can fail (null/Nothing).
 * The bind (>>=) propagates failures implicitly via null checks.
 */
function main(): void {
  const buf = fs.readFileSync(0); // stdin

  // Identity check: guard against non-PDF input
  if (!isPdf(buf)) {
    process.stderr.write('pdf-extract: not a PDF file\n');
    process.exit(1);
  }

  const src = buf.toString('binary');
  const streams = extractStreams(src);

  if (streams.length === 0) {
    process.stderr.write('pdf-extract: no streams found in PDF\n');
    process.exit(1);
  }

  // Process all streams through the extraction pipeline
  const allChunks: TextChunk[] = [];
  for (let i = 0; i < streams.length; i++) {
    const raw = decompressStream(streams[i]);
    if (raw) {
      const chunks = extractTextFromStream(raw, i);
      allChunks.push(...chunks);
    }
  }

  const text = allChunks
    .map(c => c.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > 0) {
    process.stdout.write(text + '\n');
  } else {
    process.stderr.write('pdf-extract: no text extracted\n');
    process.exit(1);
  }
}

main();
