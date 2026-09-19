import fs from "node:fs";
import path from "node:path";
import { db } from "./database.js";
import { config } from "../config.js";
import { log } from "../utils/logger.js";

export interface Personality {
    id: string;
    name: string;
    emoji: string;
    command: string;
    description: string;
    systemPrompt: string;
}

export class PersonalityStore {
    private presets = new Map<string, Personality>();

    constructor() {
        this.loadPresets();
    }

    /** Load tất cả preset files từ data/presets/ */
    private loadPresets(): void {
        const presetsDir = config.PRESETS_DIR;
        if (!fs.existsSync(presetsDir)) {
            fs.mkdirSync(presetsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(presetsDir).filter((f) => f.endsWith(".json"));
        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(presetsDir, file), "utf-8"));
                const preset: Personality = {
                    id: data.id,
                    name: data.name,
                    emoji: data.emoji,
                    command: data.command,
                    description: data.description,
                    systemPrompt: data.systemPrompt,
                };
                this.presets.set(preset.id, preset);
                this.presets.set(preset.command, preset); // Also index by command
                log.info(`   📋 Loaded preset: ${preset.emoji} ${preset.name}`);
            } catch (err) {
                log.error(`Failed to load preset ${file}: ${err}`);
            }
        }
        log.success(`Loaded ${files.length} personality presets`);
    }

    /** Reload presets (khi có file mới) */
    reloadPresets(): void {
        this.presets.clear();
        this.loadPresets();
    }

    /** Get all presets */
    getAllPresets(): Personality[] {
        const seen = new Set<string>();
        const result: Personality[] = [];
        for (const [, p] of this.presets) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                result.push(p);
            }
        }
        return result;
    }

    /** Get preset by id or command */
    getPreset(idOrCommand: string): Personality | undefined {
        return this.presets.get(idOrCommand);
    }

    /** Get user's current personality */
    getUserPersonality(userKey: string): Personality {
        const row = db
            .prepare("SELECT personality_id, custom_prompt FROM user_personalities WHERE user_key = ?")
            .get(userKey) as { personality_id: string; custom_prompt: string | null } | undefined;

        if (!row) {
            return this.presets.get("default")!;
        }

        // Custom personality
        if (row.personality_id.startsWith("custom_")) {
            return {
                id: row.personality_id,
                name: "Custom ✏️",
                emoji: "✏️",
                command: "/custom",
                description: "Tính cách tùy chỉnh",
                systemPrompt: row.custom_prompt || "",
            };
        }

        return this.presets.get(row.personality_id) || this.presets.get("default")!;
    }

    /** Set user personality to a preset */
    setUserPersonality(userKey: string, personalityId: string): void {
        db.prepare(
            `INSERT OR REPLACE INTO user_personalities (user_key, personality_id, updated_at)
             VALUES (?, ?, ?)`,
        ).run(userKey, personalityId, Date.now());
    }

    /** Set custom personality from user description */
    setCustomPersonality(userKey: string, customPrompt: string): void {
        const customId = `custom_${Date.now()}`;
        db.prepare(
            `INSERT OR REPLACE INTO user_personalities (user_key, personality_id, custom_prompt, updated_at)
             VALUES (?, ?, ?, ?)`,
        ).run(userKey, customId, customPrompt, Date.now());
    }

    /** Import custom personality from file content (txt/json) */
    importFromFile(userKey: string, fileContent: string, fileName: string): string {
        let prompt: string;

        if (fileName.endsWith(".json")) {
            try {
                const data = JSON.parse(fileContent);
                // Nếu file có format preset đầy đủ
                if (data.systemPrompt) {
                    prompt = data.systemPrompt;
                    // Nếu có id, save as new preset file
                    if (data.id && data.name) {
                        const presetPath = path.join(config.PRESETS_DIR, `${data.id}.json`);
                        fs.writeFileSync(presetPath, JSON.stringify(data, null, 2));
                        this.presets.set(data.id, data);
                        if (data.command) this.presets.set(data.command, data);
                        this.setUserPersonality(userKey, data.id);
                        return `Đã import preset: ${data.emoji || "📋"} ${data.name}`;
                    }
                } else if (data.prompt) {
                    prompt = data.prompt;
                } else {
                    prompt = JSON.stringify(data);
                }
            } catch {
                prompt = fileContent;
            }
        } else {
            // .txt file — dùng toàn bộ nội dung làm prompt
            prompt = fileContent;
        }

        this.setCustomPersonality(userKey, prompt);
        return `Đã import tính cách custom từ ${fileName}`;
    }

    /** Reset user personality to default */
    resetUserPersonality(userKey: string): void {
        db.prepare("DELETE FROM user_personalities WHERE user_key = ?").run(userKey);
    }

    /** Format danh sách tính cách để hiển thị */
    formatList(currentUserKey: string): string {
        const current = this.getUserPersonality(currentUserKey);
        const presets = this.getAllPresets();

        let msg = "🎭 **Danh sách tính cách:**\n\n";
        for (const p of presets) {
            const isCurrent = p.id === current.id ? " ← đang dùng" : "";
            msg += `${p.emoji} **${p.name}** — ${p.command}\n   ${p.description}${isCurrent}\n`;
        }
        msg += `\n✏️ **Custom** — /custom <mô tả>\n   Hoặc gửi file .txt/.json\n`;
        msg += `\n🔄 **/reset** — Về mặc định\n`;
        msg += `\n📌 Hiện tại: ${current.emoji} **${current.name}**`;
        return msg;
    }
}
