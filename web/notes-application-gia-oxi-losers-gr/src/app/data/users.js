import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const randomPassword = crypto.randomBytes(16).toString("hex");

let flag = "FLAG{example}";
try {
    flag = fs.readFileSync(path.resolve(__dirname, "../flag.txt"), "utf8").trim();
} catch (err) {
    console.error("[!] Failed to read flag file:", err.message);
}

export const users = [{
    id: 1,
    username: "admin",
    password: randomPassword,
    role: "admin",
    notes: [{ noteid: 1, content: flag }]
}];

console.log("[*] Generated admin password:", randomPassword);
