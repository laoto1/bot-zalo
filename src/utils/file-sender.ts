import { ThreadType } from "zca-js";
import { log } from "./logger.js";

/**
 * Ngưỡng ký tự để chuyển từ text → file .txt
 * Nếu reply > FILE_THRESHOLD → gửi file
 * Nếu reply <= FILE_THRESHOLD → split text bình thường
 */
const FILE_THRESHOLD = 3000;

/**
 * Gửi reply thông minh:
 * - Text ngắn (≤ 3000 chars): split thành nhiều tin nhắn text
 * - Text dài (> 3000 chars): gửi dưới dạng file .txt attachment
 *
 * @param api - Zalo API instance
 * @param reply - Nội dung text reply
 * @param threadId - ID cuộc trò chuyện
 * @param threadType - Loại thread (User/Group)
 * @param options - Tùy chọn: quote, mentions, fileName, splitFn
 * @returns method (text/file) và số lượng tin nhắn đã gửi
 */
export async function sendSmartReply(
    api: any,
    reply: string,
    threadId: string,
    threadType: ThreadType,
    options?: {
        quote?: any;
        mentions?: Array<{ pos: number; uid: string; len: number }>;
        fileName?: string;
        splitFn?: (text: string) => string[];
    },
): Promise<{ method: "text" | "file"; count: number }> {
    const { quote, mentions, fileName, splitFn } = options || {};

    // ═══ Text dài → gửi file .txt qua sendMessage attachments ═══
    if (reply.length > FILE_THRESHOLD) {
        return await sendAsFile(api, reply, threadId, threadType, {
            quote,
            fileName: fileName || generateFileName(reply),
        });
    }

    // ═══ Text ngắn → split text bình thường ═══
    const defaultSplit = (t: string) => [t];
    const chunks = (splitFn || defaultSplit)(reply);

    for (let i = 0; i < chunks.length; i++) {
        const msgText = chunks[i];
        if (i === 0 && quote) {
            await api.sendMessage(
                { msg: msgText, quote, mentions: mentions?.length ? mentions : undefined },
                threadId,
                threadType,
            );
        } else {
            await api.sendMessage(
                { msg: msgText, mentions: mentions?.length ? mentions : undefined },
                threadId,
                threadType,
            );
        }
        if (i < chunks.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
        }
    }

    return { method: "text", count: chunks.length };
}

/**
 * Gửi text dưới dạng file .txt qua sendMessage attachments
 * Dùng Buffer trực tiếp, không cần ghi file tạm
 */
async function sendAsFile(
    api: any,
    content: string,
    threadId: string,
    threadType: ThreadType,
    options?: { quote?: any; fileName?: string },
): Promise<{ method: "file" | "text"; count: number }> {
    const { quote, fileName = "reply.txt" } = options || {};

    try {
        // Tạo Buffer từ text content
        const buffer = Buffer.from(content, "utf-8");

        // Tạo tin nhắn preview ngắn kèm file attachment
        const preview = buildPreview(content, fileName);

        // Gửi qua sendMessage với attachments — zca-js tự upload và gửi
        const attachmentSource = {
            data: buffer,
            filename: fileName as `${string}.${string}`,
            metadata: {
                totalSize: buffer.length,
            },
        };

        await api.sendMessage(
            {
                msg: preview,
                attachments: [attachmentSource],
                quote: quote || undefined,
            },
            threadId,
            threadType,
        );

        log.success(`📤 Gửi file: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB, ${content.length} chars)`);
        return { method: "file", count: 1 };
    } catch (err) {
        log.error(`❌ Gửi file thất bại: ${err}`);
        // Fallback: nếu gửi file lỗi → split text gửi bình thường
        log.warn(`⚠️ Fallback: split text thay vì file`);
        const { splitMessage } = await import("./message-splitter.js");
        const chunks = splitMessage(content);
        for (let i = 0; i < chunks.length; i++) {
            if (i === 0 && quote) {
                await api.sendMessage({ msg: chunks[i], quote }, threadId, threadType);
            } else {
                await api.sendMessage(chunks[i], threadId, threadType);
            }
            if (i < chunks.length - 1) {
                await new Promise((r) => setTimeout(r, 300));
            }
        }
        return { method: "text", count: chunks.length };
    }
}

/**
 * Tạo tên file thông minh từ nội dung
 */
function generateFileName(content: string): string {
    // Lấy dòng đầu tiên làm tên (loại bỏ ký tự đặc biệt)
    const firstLine = content.split("\n")[0]?.trim() || "";
    const cleaned = firstLine
        .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\u3000-\u9FFF\uAC00-\uD7AF _-]/g, "")
        .trim()
        .substring(0, 50);

    if (cleaned.length > 5) {
        return `${cleaned}.txt`;
    }
    return `reply_${Date.now()}.txt`;
}

/**
 * Tạo preview text ngắn kèm theo file
 */
function buildPreview(content: string, fileName: string): string {
    const charCount = content.length;
    const lineCount = content.split("\n").length;
    const wordCount = content.split(/\s+/).length;

    let preview = `📄 ${fileName}\n`;
    preview += `📊 ${wordCount.toLocaleString()} từ · ${charCount.toLocaleString()} ký tự · ${lineCount} dòng`;

    return preview;
}
