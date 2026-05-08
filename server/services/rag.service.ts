import { PDFParse } from "pdf-parse";

interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  chunkIndex: number;
}

export interface RAGDocument {
  id: string;
  name: string;
  userId: string;
  uploadedAt: string;
  chunkCount: number;
  totalPages: number;
}

/** In-memory store of all processed documents. */
const documents: Map<string, RAGDocument> = new Map();

/** Flat array of all text chunks across all documents. */
const chunks: DocumentChunk[] = [];

/**
 * Splits a body of text into overlapping chunks suitable for retrieval.
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
 * Lowercases and strips punctuation from a string, returning an array of tokens.
 * Filters out tokens shorter than 3 characters to reduce noise.
 * @param text - Raw text to tokenize.
 * @returns Array of lowercase word tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Computes a TF-IDF-style relevance score between a query and a document chunk.
 * Scores by summing the term frequency of each query token within the chunk.
 * @param queryTerms - Pre-tokenized query terms.
 * @param docContent - The raw chunk text to score against.
 * @returns A non-negative relevance score; higher means more relevant.
 */
function tfidfScore(queryTerms: string[], docContent: string): number {
  const docTerms = tokenize(docContent);
  if (docTerms.length === 0) return 0;

  // Build a frequency map for the document terms
  const termFreq = new Map<string, number>();
  for (const term of docTerms) {
    termFreq.set(term, (termFreq.get(term) || 0) + 1);
  }

  let score = 0;
  for (const term of queryTerms) {
    const freq = termFreq.get(term) || 0;
    if (freq > 0) {
      // Normalize by document length so longer chunks don't automatically score higher
      score += freq / docTerms.length;
    }
  }
  return score;
}

/**
 * Parses a PDF buffer, splits the extracted text into chunks, and stores them
 * in memory for later keyword-based retrieval. No external API calls are made.
 * @param buffer - Raw PDF file bytes.
 * @param filename - Original file name, used as the document display name.
 * @returns Metadata about the processed document.
 */
export async function processDocument(buffer: Buffer, filename: string, userId: string): Promise<RAGDocument> {
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
    chunks.push({
      id: `${documentId}-chunk-${i}`,
      documentId,
      documentName: filename,
      content: textChunks[i],
      chunkIndex: i,
    });
  }

  const doc: RAGDocument = {
    id: documentId,
    name: filename,
    userId,
    uploadedAt: new Date().toISOString(),
    chunkCount: textChunks.length,
    totalPages,
  };

  documents.set(documentId, doc);
  console.log(`Document "${filename}" processed: ${textChunks.length} chunks indexed`);
  return doc;
}

/**
 * Retrieves the most relevant document chunks for a given query using TF-IDF scoring.
 * Returns an empty string if no documents are loaded or no chunk scores above zero.
 * @param query - The user's message or search query.
 * @param topK - Maximum number of chunks to return. Defaults to 5.
 * @returns A formatted context string to inject into the system prompt, or empty string.
 */
export async function retrieveContext(query: string, topK = 5): Promise<string> {
  if (chunks.length === 0) return "";

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return "";

  const scored = chunks.map((chunk) => ({
    chunk,
    score: tfidfScore(queryTerms, chunk.content),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Only keep chunks that actually matched at least one query term
  const topChunks = scored.slice(0, topK).filter((item) => item.score > 0);

  if (topChunks.length === 0) return "";

  return topChunks
    .map((item) => `[From: ${item.chunk.documentName}]\n${item.chunk.content}`)
    .join("\n\n---\n\n");
}

/**
 * Returns metadata for documents owned by the given user.
 * @param userId - The authenticated user's UUID.
 * @returns Array of RAGDocument metadata objects belonging to userId.
 */
export function getDocuments(userId: string): RAGDocument[] {
  return Array.from(documents.values()).filter((d) => d.userId === userId);
}

/**
 * Removes a document and all its associated chunks from memory.
 * Returns false if the document doesn't exist or doesn't belong to userId.
 * @param documentId - The document ID to delete.
 * @param userId - The authenticated user's UUID.
 * @returns True if the document existed, was owned by userId, and was deleted.
 */
export function deleteDocument(documentId: string, userId: string): boolean {
  const doc = documents.get(documentId);
  if (!doc || doc.userId !== userId) return false;

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
