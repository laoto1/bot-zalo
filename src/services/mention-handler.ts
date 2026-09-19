export interface ParsedMessage {
    /** Text sau khi strip trigger và @mentions */
    cleanText: string;
    /** Có chứa trigger @ai không */
    isBotTriggered: boolean;
    /** Tên các user được tag (trừ bot trigger) */
    userMentions: string[];
}

/**
 * Parse @ai trigger và @user mentions từ nội dung tin nhắn
 */
export function parseMentions(content: string, trigger: string): ParsedMessage {
    const triggerLower = trigger.toLowerCase();
    const contentLower = content.toLowerCase();

    // Check trigger
    const isBotTriggered = contentLower.includes(triggerLower);

    // Tìm tất cả @mentions (trừ @ai)
    const mentionPattern = /@(\S+)/g;
    const userMentions: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = mentionPattern.exec(content)) !== null) {
        const mentionName = match[1];
        // Skip bot trigger
        if (`@${mentionName}`.toLowerCase() !== triggerLower) {
            userMentions.push(mentionName);
        }
    }

    // Clean text: remove trigger, trim
    let cleanText = content;
    if (isBotTriggered) {
        // Remove trigger (case insensitive)
        const triggerIndex = contentLower.indexOf(triggerLower);
        cleanText = content.substring(0, triggerIndex) + content.substring(triggerIndex + trigger.length);
    }
    cleanText = cleanText.trim();

    return { cleanText, isBotTriggered, userMentions };
}

/**
 * Build mention context string cho AI prompt
 */
export function buildMentionContext(mentions: string[]): string {
    if (mentions.length === 0) return "";
    return `[Người được nhắc đến: ${mentions.join(", ")}]\n`;
}
