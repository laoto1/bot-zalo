const COLORS = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
};

function timestamp(): string {
    return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

export const log = {
    info: (msg: string) =>
        console.log(`${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.blue}ℹ${COLORS.reset} ${msg}`),

    success: (msg: string) =>
        console.log(`${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.green}✅${COLORS.reset} ${msg}`),

    warn: (msg: string) =>
        console.log(`${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}⚠️${COLORS.reset} ${msg}`),

    error: (msg: string) =>
        console.log(`${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.red}❌${COLORS.reset} ${msg}`),

    debug: (msg: string) => {
        if (process.env.DEBUG) {
            console.log(`${COLORS.gray}[${timestamp()}] 🔍 ${msg}${COLORS.reset}`);
        }
    },

    bot: (from: string, text: string) =>
        console.log(
            `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.cyan}💬${COLORS.reset} ${COLORS.green}${from}${COLORS.reset}: ${text.substring(0, 80)}${text.length > 80 ? "..." : ""}`,
        ),
};
