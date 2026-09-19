const MAX_CHUNK_SIZE = 1900;

/**
 * Split tin nhắn dài thành nhiều chunks tại boundary tự nhiên
 * (paragraph > sentence > word)
 */
export function splitMessage(text: string): string[] {
    if (text.length <= MAX_CHUNK_SIZE) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= MAX_CHUNK_SIZE) {
            chunks.push(remaining);
            break;
        }

        // Tìm điểm cắt tốt nhất trong phạm vi MAX_CHUNK_SIZE
        let cutPoint = findCutPoint(remaining, MAX_CHUNK_SIZE);
        chunks.push(remaining.substring(0, cutPoint).trimEnd());
        remaining = remaining.substring(cutPoint).trimStart();
    }

    return chunks;
}

function findCutPoint(text: string, maxLen: number): number {
    const searchRange = text.substring(0, maxLen);

    // Ưu tiên 1: Cắt tại paragraph break (\n\n)
    const paragraphBreak = searchRange.lastIndexOf("\n\n");
    if (paragraphBreak > maxLen * 0.3) {
        return paragraphBreak + 2;
    }

    // Ưu tiên 2: Cắt tại line break (\n)
    const lineBreak = searchRange.lastIndexOf("\n");
    if (lineBreak > maxLen * 0.3) {
        return lineBreak + 1;
    }

    // Ưu tiên 3: Cắt tại câu (. ! ?)
    const sentenceEnd = Math.max(
        searchRange.lastIndexOf(". "),
        searchRange.lastIndexOf("! "),
        searchRange.lastIndexOf("? "),
    );
    if (sentenceEnd > maxLen * 0.3) {
        return sentenceEnd + 2;
    }

    // Ưu tiên 4: Cắt tại khoảng trắng
    const spaceBreak = searchRange.lastIndexOf(" ");
    if (spaceBreak > maxLen * 0.3) {
        return spaceBreak + 1;
    }

    // Fallback: cắt thẳng
    return maxLen;
}
