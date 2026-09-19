import { log } from "../utils/logger.js";
import type { Config } from "../config.js";

type MessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: MessageContent;
}

export class GCLIService {
    private baseUrl: string;
    private apiKey: string;
    private models: string[];
    private currentModelIndex = 0;
    private modelLoad = new Map<string, number>();
    private maxImageBytes: number;

    constructor(config: Config) {
        this.baseUrl = config.GCLI_BASE_URL;
        this.apiKey = config.GCLI_API_KEY;
        this.maxImageBytes = config.MAX_IMAGE_SIZE_MB * 1024 * 1024;

        // Support multiple models separated by comma
        this.models = config.GCLI_MODEL.split(",").map((m) => m.trim()).filter(Boolean);
        if (this.models.length === 0) {
            this.models = ["gemini-3-flash-preview"];
        }

        for (const m of this.models) {
            this.modelLoad.set(m, 0);
        }

        log.info(`GCLI models: ${this.models.join(", ")} (${this.models.length} parallel)`);
    }

    /** Pick model with least active requests (load balancing) */
    private pickModel(): string {
        if (this.models.length === 1) return this.models[0];

        // Find model with lowest load
        let bestModel = this.models[0];
        let bestLoad = this.modelLoad.get(bestModel) || 0;

        for (const m of this.models) {
            const load = this.modelLoad.get(m) || 0;
            if (load < bestLoad) {
                bestModel = m;
                bestLoad = load;
            }
        }

        return bestModel;
    }

    /**
     * Chat với personality prompt + RAG context + history
     */
    async chat(
        systemPrompt: string,
        history: ChatMessage[],
        ragContext?: string,
        imageUrl?: string,
        maxTokens?: number,
    ): Promise<string> {
        // Build system message: personality + RAG context
        let fullSystem = systemPrompt;
        if (ragContext) {
            fullSystem += "\n\n" + ragContext;
        }

        // Build messages array
        const messages: ChatMessage[] = [
            { role: "system", content: fullSystem },
            ...history,
        ];

        // If image URL, download and convert to base64 data URL
        if (imageUrl && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === "user") {
                const textContent = typeof lastMsg.content === "string" ? lastMsg.content : "";
                try {
                    const imgRes = await fetch(imageUrl);
                    if (imgRes.ok) {
                        const buffer = Buffer.from(await imgRes.arrayBuffer());
                        const maxSize = this.maxImageBytes;
                        if (buffer.length > maxSize) {
                            log.warn(`🖼️ Image too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB > 5MB, skipping`);
                        } else {
                            const base64 = buffer.toString("base64");
                            const mime = imgRes.headers.get("content-type") || "image/jpeg";
                            const dataUrl = `data:${mime};base64,${base64}`;
                            lastMsg.content = [
                                { type: "text", text: textContent || "Hãy mô tả ảnh này" },
                                { type: "image_url", image_url: { url: dataUrl } },
                            ];
                            log.info(`🖼️ Image: ${(buffer.length / 1024).toFixed(0)}KB → base64`);
                        }
                    } else {
                        log.warn(`Image download failed: ${imgRes.status}`);
                    }
                } catch (err) {
                    log.warn(`Image fetch error: ${err}`);
                }
            }
        }

        // Pick least-loaded model
        const model = this.pickModel();
        this.modelLoad.set(model, (this.modelLoad.get(model) || 0) + 1);

        const url = `${this.baseUrl}/v1/chat/completions`;

        log.debug(`GCLI: model=${model} (load=${this.modelLoad.get(model)}), msgs=${messages.length}`);

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: maxTokens || 2048,
                    temperature: 1.0,
                    top_p: 0.95,
                }),
            });

            if (!res.ok) {
                const errText = await res.text();
                log.error(`GCLI error ${res.status}: ${errText.substring(0, 300)}`);
                throw new Error(`GCLI API error: ${res.status}`);
            }

            const data = (await res.json()) as {
                choices: Array<{ message: { content: string } }>;
            };

            const reply = data.choices?.[0]?.message?.content?.trim();
            if (!reply) {
                throw new Error("GCLI returned empty response");
            }

            return reply;
        } finally {
            // Release load counter
            this.modelLoad.set(model, Math.max(0, (this.modelLoad.get(model) || 1) - 1));
        }
    }

    async listModels(): Promise<string[]> {
        try {
            const res = await fetch(`${this.baseUrl}/v1/models`, {
                headers: { Authorization: `Bearer ${this.apiKey}` },
            });
            if (!res.ok) return [...this.models];
            const data = (await res.json()) as { data: Array<{ id: string }> };
            return data.data?.map((m) => m.id) || [...this.models];
        } catch {
            return [...this.models];
        }
    }

    setModel(model: string) {
        // Replace all models with new one (or add comma-separated)
        this.models = model.split(",").map((m) => m.trim()).filter(Boolean);
        this.modelLoad.clear();
        for (const m of this.models) {
            this.modelLoad.set(m, 0);
        }
        log.info(`Model đổi sang: ${this.models.join(", ")}`);
    }

    getModel(): string {
        return this.models.join(", ");
    }
}
