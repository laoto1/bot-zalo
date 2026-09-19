import { randomUUID } from "node:crypto";
import { db } from "./database.js";
import { EmbeddingService } from "./embedding.js";
import { log } from "../utils/logger.js";
import type { Config } from "../config.js";

interface RAGResult {
    id: string;
    text: string;
    similarity: number;
    threadId: string;
    userId: string;
    timestamp: number;
}

export class RAGStore {
    private embedding: EmbeddingService;
    private topK: number;
    private minSimilarity: number;

    constructor(config: Config, embedding: EmbeddingService) {
        this.embedding = embedding;
        this.topK = config.RAG_TOP_K;
        this.minSimilarity = config.RAG_MIN_SIMILARITY;

        const count = (db.prepare("SELECT COUNT(*) as c FROM embeddings").get() as { c: number }).c;
        log.info(`RAG store: ${count} embeddings loaded`);
    }

    get isEnabled(): boolean {
        return this.embedding.isEnabled;
    }

    /** Lưu Q&A pair vào store */
    async store(question: string, answer: string, threadId: string, userId: string): Promise<void> {
        if (!this.embedding.isEnabled) return;

        const text = `Q: ${question}\nA: ${answer}`;
        const vector = await this.embedding.embed(text);
        if (!vector) return;

        const vectorBuf = Buffer.from(new Float32Array(vector).buffer);

        db.prepare(
            `INSERT INTO embeddings (id, text, vector, thread_id, user_id, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(randomUUID(), text, vectorBuf, threadId, userId, Date.now());

        log.debug(`RAG stored: ${text.substring(0, 60)}...`);
    }

    /** Tìm context liên quan */
    async search(query: string, threadId?: string): Promise<RAGResult[]> {
        if (!this.embedding.isEnabled) return [];

        const queryVector = await this.embedding.embed(query);
        if (!queryVector) return [];

        // Load all vectors (for small-medium datasets this is fine)
        // For >100k entries, consider using SQLite extensions or external vector DB
        const rows = db
            .prepare("SELECT id, text, vector, thread_id, user_id, timestamp FROM embeddings")
            .all() as Array<{
            id: string;
            text: string;
            vector: Buffer;
            thread_id: string;
            user_id: string;
            timestamp: number;
        }>;

        const results: RAGResult[] = [];

        for (const row of rows) {
            const storedVector = Array.from(new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4));
            const similarity = this.cosineSimilarity(queryVector, storedVector);

            if (similarity >= this.minSimilarity) {
                results.push({
                    id: row.id,
                    text: row.text,
                    similarity,
                    threadId: row.thread_id,
                    userId: row.user_id,
                    timestamp: row.timestamp,
                });
            }
        }

        // Sort by similarity descending, take top K
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, this.topK);
    }

    /** Build RAG context string cho prompt */
    async buildContext(query: string, threadId?: string): Promise<string> {
        const results = await this.search(query, threadId);
        if (results.length === 0) return "";

        let context = "[Kiến thức từ các cuộc hội thoại trước:]\n";
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            context += `${i + 1}. ${r.text}\n`;
        }
        context += "[Hết kiến thức]\n\n";
        context += "Dựa trên kiến thức trên (nếu liên quan) và ngữ cảnh hiện tại, hãy trả lời tự nhiên:\n";
        return context;
    }

    /** Cosine similarity giữa 2 vectors */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    /** Stats */
    get size(): number {
        return (db.prepare("SELECT COUNT(*) as c FROM embeddings").get() as { c: number }).c;
    }
}
