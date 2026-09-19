import { log } from "../utils/logger.js";
import type { Config } from "../config.js";

export class EmbeddingService {
    private keys: string[];
    private currentKeyIndex = 0;
    private model: string;
    private enabled: boolean;
    private keyCooldown = new Map<number, number>(); // keyIndex → cooldown until timestamp

    constructor(config: Config) {
        this.keys = config.GOOGLE_API_KEYS;
        this.model = config.EMBEDDING_MODEL;
        this.enabled = this.keys.length > 0;

        if (!this.enabled) {
            log.warn("Google API keys chưa cấu hình — RAG disabled");
        } else {
            log.success(`Embedding service: ${this.keys.length} keys, model=${this.model}`);
        }
    }

    get isEnabled(): boolean {
        return this.enabled;
    }

    /** Rotate qua danh sách keys, skip keys đang cooldown */
    private getKey(): string {
        const now = Date.now();
        // Try to find a key not in cooldown
        for (let i = 0; i < this.keys.length; i++) {
            const idx = (this.currentKeyIndex + i) % this.keys.length;
            const cooldownUntil = this.keyCooldown.get(idx) || 0;
            if (now >= cooldownUntil) {
                this.currentKeyIndex = (idx + 1) % this.keys.length;
                return this.keys[idx];
            }
        }
        // All in cooldown, use round-robin anyway
        const key = this.keys[this.currentKeyIndex];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        return key;
    }

    /** Mark a key as rate-limited for 60 seconds */
    private markKeyExhausted(key: string): void {
        const idx = this.keys.indexOf(key);
        if (idx !== -1) {
            this.keyCooldown.set(idx, Date.now() + 60_000);
        }
    }

    /** Embed single text → vector */
    async embed(text: string): Promise<number[] | null> {
        if (!this.enabled) return null;
        if (!text || !text.trim()) return null;

        const maxRetries = this.keys.length;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const key = this.getKey();
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${key}`;

                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: `models/${this.model}`,
                        content: { parts: [{ text }] },
                        taskType: "SEMANTIC_SIMILARITY",
                    }),
                });

                if (res.status === 429) {
                    log.warn(`Embedding rate limited key #${this.keys.indexOf(key) + 1}/${this.keys.length}, rotating...`);
                    this.markKeyExhausted(key);
                    continue;
                }

                if (!res.ok) {
                    const errText = await res.text();
                    log.error(`Embedding error ${res.status}: ${errText.substring(0, 200)}`);
                    continue;
                }

                const data = (await res.json()) as {
                    embedding: { values: number[] };
                };

                return data.embedding.values;
            } catch (err) {
                log.error(`Embedding request failed: ${err}`);
                continue;
            }
        }

        log.error("All embedding keys exhausted");
        return null;
    }

    /** Batch embed — uses batchEmbedContents API for efficiency */
    async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
        if (!this.enabled || texts.length === 0) return [];

        // Single text → use single embed
        if (texts.length === 1) {
            return [await this.embed(texts[0])];
        }

        const maxRetries = Math.min(this.keys.length, 3);

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const key = this.getKey();
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${key}`;

                const requests = texts.map((text) => ({
                    model: `models/${this.model}`,
                    content: { parts: [{ text }] },
                    taskType: "SEMANTIC_SIMILARITY",
                }));

                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requests }),
                });

                if (res.status === 429) {
                    log.warn(`Batch embedding rate limited key #${this.keys.indexOf(key) + 1}/${this.keys.length}, rotating...`);
                    this.markKeyExhausted(key);
                    continue;
                }

                if (!res.ok) {
                    const errText = await res.text();
                    log.error(`Batch embedding error ${res.status}: ${errText.substring(0, 200)}`);
                    continue;
                }

                const data = (await res.json()) as {
                    embeddings: Array<{ values: number[] }>;
                };

                return data.embeddings.map((e) => e.values);
            } catch (err) {
                log.error(`Batch embedding failed: ${err}`);
                continue;
            }
        }

        // Fallback: sequential
        log.warn("Batch failed, falling back to sequential...");
        const results: (number[] | null)[] = [];
        for (const text of texts) {
            results.push(await this.embed(text));
            await new Promise((r) => setTimeout(r, 100));
        }
        return results;
    }
}
