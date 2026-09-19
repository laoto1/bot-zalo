import { db } from "./database.js";
import type { Config } from "../config.js";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export class ConversationStore {
    private maxHistory: number;

    constructor(config: Config) {
        this.maxHistory = config.MAX_HISTORY;
    }

    addMessage(key: string, role: "user" | "assistant", content: string): void {
        db.prepare(
            "INSERT INTO conversations (user_key, role, content, timestamp) VALUES (?, ?, ?, ?)",
        ).run(key, role, content, Date.now());

        // Trim nếu quá dài
        const count = (
            db.prepare("SELECT COUNT(*) as c FROM conversations WHERE user_key = ?").get(key) as { c: number }
        ).c;

        if (count > this.maxHistory * 2) {
            // Xóa tin cũ nhất, giữ lại maxHistory * 2 tin gần nhất
            db.prepare(
                `DELETE FROM conversations WHERE user_key = ? AND id NOT IN (
                    SELECT id FROM conversations WHERE user_key = ? ORDER BY timestamp DESC LIMIT ?
                )`,
            ).run(key, key, this.maxHistory * 2);
        }
    }

    getHistory(key: string): Message[] {
        const rows = db
            .prepare(
                `SELECT role, content FROM conversations WHERE user_key = ? ORDER BY timestamp DESC LIMIT ?`,
            )
            .all(key, this.maxHistory) as Array<{ role: string; content: string }>;

        return rows.reverse().map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
    }

    clear(key: string): void {
        db.prepare("DELETE FROM conversations WHERE user_key = ?").run(key);
    }

    get size(): number {
        return (
            db.prepare("SELECT COUNT(DISTINCT user_key) as c FROM conversations").get() as { c: number }
        ).c;
    }
}
