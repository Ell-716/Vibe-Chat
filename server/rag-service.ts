import OpenAI from "openai";
import { PDFParse } from "pdf-parse";

interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
}

interface RAGDocument {
  id: string;
  name: string;
  uploadedAt: string;
  chunkCount: number;
  totalPages: number;
}

const documents: Map<string, RAGDocument> = new Map();
const chunks: DocumentChunk[] = [];

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function splitTextIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  const result: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      result.push(currentChunk.trim());
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

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

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

    if (topChunks.length === 0 || topChunks[0].score < 0.3) return "";

    const context = topChunks
      .map((item) => `[From: ${item.chunk.documentName}]\n${item.chunk.content}`)
      .join("\n\n---\n\n");

    return context;
  } catch (error) {
    console.error("RAG retrieval error:", error);
    return "";
  }
}

export function getDocuments(): RAGDocument[] {
  return Array.from(documents.values());
}

export function deleteDocument(documentId: string): boolean {
  if (!documents.has(documentId)) return false;

  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i].documentId === documentId) {
      chunks.splice(i, 1);
    }
  }

  documents.delete(documentId);
  return true;
}

export function hasDocuments(): boolean {
  return chunks.length > 0;
}
