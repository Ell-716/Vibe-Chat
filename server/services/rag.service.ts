import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { env } from "../config/env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
}

export interface RAGDocument {
  id: string;
  name: string;
  uploadedAt: string;
  chunkCount: number;
  totalPages: number;
}

/** In-memory store of all processed documents. */
const documents: Map<string, RAGDocument> = new Map();

/** Flat array of all embedded chunks across all documents. */
const chunks: DocumentChunk[] = [];

/**
 * Splits a body of text into overlapping chunks suitable for embedding.
 * Splits on sentence boundaries where possible to preserve semantic coherence.
 * @param text - The full text to split.
 * @param chunkSize - Maximum character length per chunk. Defaults to 1000.
 * @param overlap - Number of characters of overlap between consecutive chunks. Defaults to 200.
 * @returns Array of text chunk strings.
 */
function splitTextIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  const result: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      result.push(currentChunk.trim());
      // Carry forward the tail of the previous chunk for context overlap
      const words = currentChunk.split(" ");
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(" ") + " " + sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  if (currentChunk.trim()) {
    result.push(currentChunk.trim());
  }

  return result;
}

/**
 * Generates a vector embedding for a text string using OpenAI's text-embedding-3-small model.
 * @param text - The text to embed.
 * @returns A numeric embedding vector.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Computes cosine similarity between two embedding vectors.
 * @param a - First embedding vector.
 * @param b - Second embedding vector.
 * @returns Similarity score in the range [-1, 1].
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Parses a PDF buffer, splits the extracted text into chunks, generates embeddings
 * for each chunk, and stores everything in memory for later retrieval.
 * A 100ms delay is applied between chunk embeddings to avoid rate-limit errors.
 * @param buffer - Raw PDF file bytes.
 * @param filename - Original file name, used as the document display name.
 * @returns Metadata about the processed document.
 */
export async function processDocument(buffer: Buffer, filename: string): Promise<RAGDocument> {
  const parser = new PDFParse({ data: buffer });
  const info = await parser.getInfo();
  const textResult = await parser.getText();
  await parser.destroy();
  const text = textResult.text;
  const totalPages = info.total;

  const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const textChunks = splitTextIntoChunks(text);

  console.log(`Processing "${filename}": ${totalPages} pages, ${textChunks.length} chunks`);

  for (let i = 0; i < textChunks.length; i++) {
    try {
      const embedding = await generateEmbedding(textChunks[i]);
      chunks.push({
        id: `${documentId}-chunk-${i}`,
        documentId,
        documentName: filename,
        content: textChunks[i],
        embedding,
        chunkIndex: i,
      });

      if (i % 10 === 0) {
        console.log(`  Embedded chunk ${i + 1}/${textChunks.length}`);
      }

      // Throttle requests to stay within OpenAI rate limits
      if (i < textChunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to embed chunk ${i}:`, error);
    }
  }

  const doc: RAGDocument = {
    id: documentId,
    name: filename,
    uploadedAt: new Date().toISOString(),
    chunkCount: textChunks.length,
    totalPages,
  };

  documents.set(documentId, doc);
  console.log(`Document "${filename}" processed: ${textChunks.length} chunks embedded`);
  return doc;
}

/**
 * Retrieves the most semantically relevant document chunks for a given query.
 * Embeds the query and ranks all stored chunks by cosine similarity.
 * Returns an empty string if no documents are loaded or no chunk exceeds the similarity threshold.
 * @param query - The user's message or search query.
 * @param topK - Maximum number of chunks to return. Defaults to 5.
 * @returns A formatted context string to inject into the system prompt, or empty string.
 */
export async function retrieveContext(query: string, topK = 5): Promise<string> {
  if (chunks.length === 0) return "";

  try {
    const queryEmbedding = await generateEmbedding(query);

    const scored = chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topK);

    // Discard results below the relevance threshold to avoid injecting noise
    if (topChunks.length === 0 || topChunks[0].score < 0.3) return "";

    return topChunks
      .map((item) => `[From: ${item.chunk.documentName}]\n${item.chunk.content}`)
      .join("\n\n---\n\n");
  } catch (error) {
    console.error("RAG retrieval error:", error);
    return "";
  }
}

/**
 * Returns metadata for all currently loaded documents.
 * @returns Array of RAGDocument metadata objects.
 */
export function getDocuments(): RAGDocument[] {
  return Array.from(documents.values());
}

/**
 * Removes a document and all its associated chunks from memory.
 * @param documentId - The document ID to delete.
 * @returns True if the document existed and was deleted, false if not found.
 */
export function deleteDocument(documentId: string): boolean {
  if (!documents.has(documentId)) return false;

  // Iterate in reverse to safely splice while looping
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i].documentId === documentId) {
      chunks.splice(i, 1);
    }
  }

  documents.delete(documentId);
  return true;
}

/**
 * Returns whether any document chunks are currently loaded in memory.
 * Used to short-circuit RAG retrieval when no documents have been uploaded.
 * @returns True if at least one chunk exists, false otherwise.
 */
export function hasDocuments(): boolean {
  return chunks.length > 0;
}
