import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { log } from "../utils/logger.js";

// Tạo thư mục data nếu chưa có
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db: import("better-sqlite3").Database = new Database(config.DB_PATH);

// Performance settings
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// ═══ Schema ═══
db.exec(`
    -- RAG Embeddings
    CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        vector BLOB NOT NULL,
        thread_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_emb_thread ON embeddings(thread_id);
    CREATE INDEX IF NOT EXISTS idx_emb_timestamp ON embeddings(timestamp);

    -- User Personalities
    CREATE TABLE IF NOT EXISTS user_personalities (
        user_key TEXT PRIMARY KEY,
        personality_id TEXT NOT NULL,
        custom_prompt TEXT,
        updated_at INTEGER NOT NULL
    );

    -- Conversation History
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv_user_key ON conversations(user_key);
    CREATE INDEX IF NOT EXISTS idx_conv_timestamp ON conversations(timestamp);
`);

log.success(`Database initialized: ${config.DB_PATH}`);

export { db };
