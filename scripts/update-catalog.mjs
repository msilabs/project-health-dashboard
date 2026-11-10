#!/usr/bin/env node
// public/seed/catalog.json হালনাগাদ করে endoflife.date থেকে।
// হাতে যোগ করা প্রোডাক্ট, ভার্সন আর requires যেমন আছে তেমন থাকে; শুধু তারিখগুলো নতুন করে আসে।
// চালান: npm run catalog
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const target = new URL('public/seed/catalog.json', root);

const context = vm.createContext({ console, Intl, Date, Math, JSON, fetch });
for (const file of ['10-core.js', '20-schema.js', '25-eol.js']) {
    vm.runInContext(readFileSync(new URL(`global/${file}`, root), 'utf8'), context, { filename: file });
}
const P = context.PHD;

// ক্যাটালগে না থাকলে এগুলো যোগ হয়। id না দিলে endoflife.date-এর নামই id।
const SOURCES = {
    tech: [
        { slug: 'laravel' },
        { slug: 'livewire' },
        { slug: 'symfony' },
        { slug: 'cakephp' },
        { slug: 'nextjs' },
        { slug: 'react' },
        { slug: 'vue' },
        { slug: 'nuxt' },
        { slug: 'angular' },
        { slug: 'nestjs' },
        { slug: 'express' },
        { slug: 'electron' },
        { slug: 'react-native', category: 'mobile' },
        { slug: 'django' },
        { slug: 'rails' },
        { slug: 'tailwind-css', category: 'library' }
    ],
    env: [
        { slug: 'php' },
        { slug: 'nodejs' },
        { slug: 'python' },
        { slug: 'bun' },
        { slug: 'mysql' },
        { slug: 'mariadb' },
        { slug: 'postgresql' },
        { slug: 'mongodb' },
        { slug: 'redis', category: 'cache' },
        { slug: 'nginx' },
        { slug: 'apache-http-server', id: 'apache' },
        { slug: 'ubuntu' },
        { slug: 'debian' },
        { slug: 'almalinux' },
        { slug: 'rocky-linux' },
        { slug: 'docker-engine', id: 'docker', category: 'container' },
        { slug: 'composer' }
    ]
};

// endoflife.date-এ নেই এমন জানা শর্ত (অফিসিয়াল ডকুমেন্টেশন থেকে)
const REQUIRES = {
    nextjs: { 13: 'nodejs 16.14+', 14: 'nodejs 18.17+', 15: 'nodejs 18.18+', 16: 'nodejs 20.9+' },
    nestjs: { 10: 'nodejs 16+', 11: 'nodejs 20+' }
};

const current = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : { tech: [], env: [] };
const out = { updatedAt: P.isoDate(Date.now()), source: 'https://endoflife.date', tech: [], env: [] };
let failed = 0;

for (const kind of P.KINDS) {
    const existing = new Map((current[kind] || []).map((p) => [p.id, P.normalizeProduct(p, kind)]).filter(([, p]) => p));
    for (const src of SOURCES[kind]) {
        const id = src.id || src.slug;
        if (!existing.has(id)) existing.set(id, P.normalizeProduct({ id, name: id, eolSlug: src.slug, category: src.category || '' }, kind));
    }
    for (const [id, product] of existing) {
        let next = product;
        if (product.eolSlug) {
            try {
                const result = await P.fetchEndOfLife(product.eolSlug);
                const fresh = P.productFromEndOfLife(result, kind, { id });
                const src = SOURCES[kind].find((s) => (s.id || s.slug) === id);
                if (src && src.category) fresh.category = src.category;
                next = P.mergeProduct(product, fresh);
                console.log(`✔ ${kind}/${id}: ${fresh.versions.length} versions`);
            } catch (e) {
                failed++;
                console.error(`✖ ${kind}/${id}: ${e.message}`);
            }
        }
        const extra = REQUIRES[id];
        if (extra) {
            next.versions = next.versions.map((v) => (extra[v.version] && !v.requires.length ? { ...v, requires: P.parseRequires(extra[v.version]) } : v));
        }
        out[kind].push(JSON.parse(JSON.stringify(next)));
    }
    out[kind].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

mkdirSync(new URL('public/seed/', root), { recursive: true });
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`\nWrote ${out.tech.length} tech and ${out.env.length} server products to public/seed/catalog.json`);
if (failed) {
    console.error(`${failed} product(s) could not be fetched; their old data was kept.`);
    process.exitCode = 1;
}
