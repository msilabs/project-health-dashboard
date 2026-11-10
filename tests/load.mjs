// global/ ফোল্ডারের ব্রাউজার স্ক্রিপ্টগুলো Node-এ চালানোর জন্য (DOM ছাড়া যেগুলো চলে)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILES = ['10-core.js', '20-schema.js', '25-eol.js', '40-analysis.js', '60-ai.js'];

export function loadPHD(today = '2026-11-10') {
    const context = vm.createContext({ console, Intl, Date, Math, JSON, fetch: globalThis.fetch });
    for (const file of FILES) {
        const url = new URL(`../global/${file}`, import.meta.url);
        let code;
        try {
            code = readFileSync(url, 'utf8');
        } catch {
            continue;
        }
        vm.runInContext(code, context, { filename: file });
    }
    const P = context.PHD;
    const [y, m, d] = today.split('-').map(Number);
    P.now = () => new Date(y, m - 1, d, 12);
    return P;
}

export const plain = (v) => JSON.parse(JSON.stringify(v));
