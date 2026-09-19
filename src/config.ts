import "dotenv/config";

export const config = {
    // GCLI Proxy (Chat)
    GCLI_BASE_URL: process.env.GCLI_BASE_URL || "https://gcli.ggchan.dev",
    GCLI_API_KEY: process.env.GCLI_API_KEY || "",
    GCLI_MODEL: process.env.GCLI_MODEL || "gemini-3.0-flash-preview",

    // Google API Keys (Embeddings only - comma-separated list)
    GOOGLE_API_KEYS: (process.env.GOOGLE_API_KEYS || "").split(",").filter(Boolean),
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "gemini-embedding-2",

    // Bot
    BOT_CREATOR_ID: process.env.BOT_CREATOR_ID || "",
    BOT_MANAGER_ID: process.env.BOT_MANAGER_ID || "",
    MAX_HISTORY: parseInt(process.env.MAX_HISTORY || "20"),
    MAX_IMAGE_SIZE_MB: parseInt(process.env.MAX_IMAGE_SIZE_MB || "5"),
    NSFW_ENABLED: process.env.NSFW_ENABLED !== "false",

    // RAG
    RAG_TOP_K: parseInt(process.env.RAG_TOP_K || "5"),
    RAG_MIN_SIMILARITY: parseFloat(process.env.RAG_MIN_SIMILARITY || "0.7"),

    // Paths
    PRESETS_DIR: process.env.PRESETS_DIR || "./data/presets",
    DB_PATH: process.env.DB_PATH || "./data/bot.db",

    // Nhóm cho phép (để trống = tất cả)
    ALLOWED_GROUPS: (process.env.ALLOWED_GROUPS || "").split(",").map(s => s.trim()).filter(Boolean),
};

export type Config = typeof config;
