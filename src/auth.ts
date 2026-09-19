import { Zalo } from "zca-js";
import type { Credentials } from "zca-js";
import fs from "node:fs";
import { log } from "./utils/logger.js";

const CRED_PATH = "./credentials.json";

export async function login() {
    const zalo = new Zalo();

    // Thử login bằng credentials đã lưu (imei + cookie + userAgent)
    if (fs.existsSync(CRED_PATH)) {
        try {
            const creds: Credentials = JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
            const api = await zalo.login(creds);
            log.success("Login bằng cookie thành công! Không cần scan QR.");
            return api;
        } catch (err) {
            log.warn("Cookie hết hạn hoặc lỗi, cần scan QR lại...");
            log.debug(String(err));
        }
    }

    // Login bằng QR code
    log.info("Đang tạo QR code... Hãy scan bằng Zalo trên điện thoại.");
    const api = await zalo.loginQR();

    // Lưu full credentials (imei + cookie + userAgent) để lần sau không cần QR
    try {
        const context = api.getContext();
        const cookies = api.getCookie(); // serialized cookies
        const credentials = {
            imei: context.imei!,
            cookie: cookies,
            userAgent: context.userAgent!,
            language: context.language,
        };
        fs.writeFileSync(CRED_PATH, JSON.stringify(credentials, null, 2));
        log.success("Login QR thành công! Credentials đã lưu → lần sau tự động login.");
    } catch (err) {
        log.warn("Không thể lưu credentials: " + String(err));
    }

    return api;
}
