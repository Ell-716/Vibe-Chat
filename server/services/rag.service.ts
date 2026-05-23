import { PDFParse } from "pdf-parse";
import { chat } from "./llm.service";
import type { AIModel } from "./llm.service";

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
 * @param topK - Maximum number of chunks to return. Defaults to 8.
 * @returns A formatted context string to inject into the system prompt, or empty string.
 */
export async function retrieveContext(query: string, topK = 8): Promise<string> {
  if (chunks.length === 0) return "";

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return "";

  const scored = chunks.map((chunk) => ({
    chunk,
    score: tfidfScore(queryTerms, chunk.content),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Keep the top-k chunks as long as their score meets the minimum threshold (0.3
  // on a normalised scale). Using >= 0 here so all top-k results are returned when
  // exact keyword matches are sparse — the LLM can still reason over adjacent content.
  const topChunks = scored.slice(0, topK).filter((item) => item.score >= 0);

  if (topChunks.length === 0) return "";

  return topChunks
    .map((item) => `[From: ${item.chunk.documentName}, Section ${item.chunk.chunkIndex}]\n${item.chunk.content}`)
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

/**
 * Pauses execution for the given number of milliseconds.
 * Used between LLM calls during map-reduce summarization to avoid hitting
 * provider rate limits (e.g. Groq's 6 000 tokens/minute free-tier cap).
 * @param ms - Duration to sleep in milliseconds.
 */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Collects all output from the `chat` async generator into a single string.
 * @param gen - The async generator returned by `chat()`.
 * @returns The concatenated response text.
 */
async function collectChatOutput(gen: AsyncGenerator<string>): Promise<string> {
  let result = "";
  for await (const chunk of gen) {
    result += chunk;
  }
  return result;
}

/**
 * Generates a structured summary of a document using the selected LLM.
 *
 * For documents with 10 or fewer chunks the full text is sent in a single LLM
 * call. For larger documents a map-reduce strategy is used: chunks are batched
 * (10 per batch), each batch is summarised independently (map phase), and the
 * resulting partial summaries are then combined into one final summary (reduce
 * phase).
 *
 * @param documentId - The ID of the document to summarise.
 * @param userId - The authenticated user's UUID (used to verify ownership).
 * @param model - The AI model identifier to use for LLM calls.
 * @returns A formatted markdown summary string.
 * @throws If the document is not found, not owned by the user, or has no chunks.
 */
export async function summarizeDocument(
  documentId: string,
  userId: string,
  model: string
): Promise<string> {
  const doc = documents.get(documentId);
  if (!doc || doc.userId !== userId) {
    throw new Error("Document not found or access denied.");
  }

  const docChunks = chunks.filter((c) => c.documentId === documentId);
  if (docChunks.length === 0) {
    throw new Error("No content chunks found for this document.");
  }

  const aiModel = model as AIModel;
  const BATCH_SIZE = 10;

  // Small document: summarize all chunks in a single LLM call
  if (docChunks.length <= BATCH_SIZE) {
    const fullText = docChunks.map((c) => c.content).join("\n\n");
    const prompt =
      "Summarize the following document concisely, capturing key points, main arguments, and important details:\n\n" +
      fullText;

    const gen = chat({
      messages: [{ role: "user", content: prompt }],
      model: aiModel,
      systemPrompt: "You are a helpful summarization assistant.",
    });

    return collectChatOutput(gen);
  }

  // Large document: map phase — summarize each batch independently
  const batchSummaries: string[] = [];
  const totalBatches = Math.ceil(docChunks.length / BATCH_SIZE);

  for (let i = 0; i < docChunks.length; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`Summarizing batch ${batchNumber} of ${totalBatches}...`);

    const batch = docChunks.slice(i, i + BATCH_SIZE);
    const batchText = batch.map((c) => c.content).join("\n\n");
    const mapPrompt =
      "Summarize the following section of a document concisely, capturing key points, main arguments, and important details:\n\n" +
      batchText;

    const gen = chat({
      messages: [{ role: "user", content: mapPrompt }],
      model: aiModel,
      systemPrompt: "You are a helpful summarization assistant.",
    });

    const summary = await collectChatOutput(gen);
    batchSummaries.push(summary);

    // Pause between batches to stay within Groq's 6 000 tokens/minute rate limit
    await sleep(2000);
  }

  // Reduce phase — combine batch summaries into a final structured summary
  const combinedSummaries = batchSummaries
    .map((s, idx) => `Section ${idx + 1}:\n${s}`)
    .join("\n\n");

  const reducePrompt =
    `You have been given section summaries of a large document. Create a comprehensive final summary that includes:\n\n` +
    `## Overview\n` +
    `A 2-3 sentence overview of what this document is about.\n\n` +
    `## Key Points\n` +
    `The most important points from the document.\n\n` +
    `## Main Topics\n` +
    `The main topics or sections covered.\n\n` +
    `## Key Takeaways\n` +
    `3-5 actionable or notable takeaways.\n\n` +
    `Section summaries:\n${combinedSummaries}`;

  // Pause before the reduce call to let the rate limit recover after the map phase
  await sleep(2000);

  const reduceGen = chat({
    messages: [{ role: "user", content: reducePrompt }],
    model: aiModel,
    systemPrompt: "You are a helpful summarization assistant.",
  });

  return collectChatOutput(reduceGen);
}
