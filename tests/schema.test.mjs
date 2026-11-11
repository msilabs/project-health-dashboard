import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPHD, plain } from './load.mjs';

const P = loadPHD();

test('parseRequires reads ranges, minimums and maximums', () => {
    assert.deepEqual(plain(P.parseRequires('php 8.2-8.5, nodejs 20+, laravel <=12')), [
        { product: 'php', min: '8.2', max: '8.5' },
        { product: 'nodejs', min: '20', max: '' },
        { product: 'laravel', min: '', max: '12' }
    ]);
    assert.equal(P.formatRequires(P.parseRequires('php 8.2-8.5, nodejs 20+')), 'php 8.2-8.5, nodejs 20+');
});

test('normalizeData accepts a bare project array and AI-style refs', () => {
    const d = P.normalizeData([{ name: 'Shop', tech: ['Laravel 11', { product: 'React', version: '18.3' }], deployments: [{ env: 'production', stack: ['PHP 8.2'] }] }]);
    assert.equal(d.has.projects, true);
    assert.equal(d.has.tech, false);
    const p = d.projects[0];
    assert.equal(p.id, 'shop');
    const short = (r) => ({ product: r.product, version: r.version });
    assert.deepEqual(plain(p.tech.map(short)), [{ product: 'laravel', version: '11' }, { product: 'react', version: '18.3' }]);
    assert.equal(p.deployments[0].name, 'production');
    assert.deepEqual(plain(p.deployments[0].stack.map(short)), [{ product: 'php', version: '8.2' }]);
    assert.deepEqual(plain(p.tech[0].versions), [{ version: '11', date: '2026-11-10' }]);
});

test('normalizeData rejects junk and newer schemas', () => {
    assert.throws(() => P.normalizeData('x'), /not-object/);
    assert.throws(() => P.normalizeData({ foo: 1 }), /empty/);
    assert.throws(() => P.normalizeData({ schemaVersion: 99, projects: [] }), /newer-schema/);
});

test('duplicate project ids get a suffix', () => {
    const d = P.normalizeData({ projects: [{ name: 'App' }, { name: 'App' }] });
    assert.deepEqual(plain(d.projects.map((p) => p.id)), ['app', 'app-2']);
});

test('merge keeps existing details when incoming fields are empty', () => {
    const cur = P.normalizeData({
        projects: [{ id: 'shop', name: 'Shop', owner: 'Rahim', repo: 'https://git.example/shop', deployments: [{ name: 'production', stack: [{ product: 'php', version: '8.1' }] }] }],
        catalog: { tech: [], env: [{ id: 'php', versions: [{ version: '8.1', securityUntil: '2025-12-31', requires: 'ubuntu 22+' }] }] }
    });
    const inc = P.normalizeData({
        projects: [{ name: 'Shop', deployments: [{ name: 'production', stack: [{ product: 'php', version: '8.3' }] }, { name: 'staging', stack: [] }] }],
        catalog: { env: [{ id: 'php', versions: [{ version: '8.1', released: '2021-11-25' }, { version: '8.3', securityUntil: '2027-12-31' }] }] }
    });
    const out = P.mergeData(cur, inc, 'merge');
    const p = out.projects[0];
    assert.equal(p.owner, 'Rahim');
    assert.equal(p.repo, 'https://git.example/shop');
    assert.equal(p.deployments[0].stack[0].version, '8.3');
    assert.equal(p.deployments.length, 2);
    const php = out.catalog.env[0];
    assert.deepEqual(plain(php.versions.map((v) => v.version)), ['8.3', '8.1']);
    assert.equal(P.formatRequires(php.versions[1].requires), 'ubuntu 22+');
    assert.equal(php.versions[1].released, '2021-11-25');
    assert.equal(php.versions[1].securityUntil, '2025-12-31');
});

test('replace only replaces the parts present in the import', () => {
    const cur = P.normalizeData({ projects: [{ name: 'A' }], catalog: { tech: [{ id: 'laravel' }], env: [] } });
    const inc = P.normalizeData({ projects: [{ name: 'B' }] });
    const out = P.mergeData(cur, inc, 'replace');
    assert.deepEqual(plain(out.projects.map((p) => p.id)), ['b']);
    assert.equal(out.catalog.tech.length, 1);
    const diff = P.diffData(cur, P.normalizeData(out));
    assert.deepEqual(plain(diff.projects), { added: 1, removed: 1, changed: 0 });
});

test('endoflife.date releases map to catalog versions', () => {
    const product = P.productFromEndOfLife(
        {
            name: 'laravel',
            label: 'Laravel',
            category: 'framework',
            links: { html: 'https://endoflife.date/laravel' },
            releases: [
                { name: '13', releaseDate: '2026-03-17', isLts: false, eoasFrom: '2027-09-30', eolFrom: '2028-03-17', isEol: false, isMaintained: true, custom: { supportedPhpVersions: '8.3 - 8.5' } },
                { name: '5.5', releaseDate: '2017-08-30', isLts: true, eoasFrom: '2019-08-30', eolFrom: '2018-08-30', isEol: true }
            ]
        },
        'tech'
    );
    assert.equal(product.id, 'laravel');
    assert.equal(product.versions.length, 1);
    assert.deepEqual(plain(product.versions[0]), {
        version: '13',
        released: '2026-03-17',
        supportUntil: '2027-09-30',
        securityUntil: '2028-03-17',
        lts: false,
        state: '',
        requires: [{ product: 'php', min: '8.3', max: '8.5' }]
    });
});

test('endoflife.date requirement text keeps only the leading range', () => {
    const v = P.versionFromEndOfLife({ name: '6.1', releaseDate: '2026-08-05', eolFrom: '2027-12-31', custom: { supportedPythonVersions: '3.12 - 3.15 (added in 6.1.3)' } });
    assert.deepEqual(plain(v.requires), [{ product: 'python', min: '3.12', max: '3.15' }]);
    const w = P.versionFromEndOfLife({ name: '4', custom: { supportedPhpVersions: '8.1+' } });
    assert.deepEqual(plain(w.requires), [{ product: 'php', min: '8.1', max: '' }]);
});

test('schema 1 data loads without the removed fields', () => {
    const d = P.normalizeData({
        schemaVersion: 1,
        settings: { redDays: 30, yellowDays: 200, deploymentNames: ['live'] },
        catalog: { tech: [], env: [{ id: 'php', url: 'https://endoflife.date/php', versions: [{ version: '8.3', securityUntil: '2027-12-31', approx: true, note: 'x' }] }] },
        projects: [{ name: 'Shop', lifecycle: 'maintenance', deployments: [{ name: 'live', host: 'AWS', url: 'https://shop.example', stack: ['php 8.3'] }] }, { name: 'Old', lifecycle: 'archived' }]
    });
    assert.equal(d.schemaVersion, 5);
    assert.deepEqual(plain(d.settings), { redDays: 30, yellowDays: 200 });
    assert.deepEqual(plain(d.catalog.env[0]), {
        id: 'php',
        name: 'php',
        category: 'runtime',
        eolSlug: '',
        versions: [{ version: '8.3', released: '', supportUntil: '', securityUntil: '2027-12-31', lts: false, state: '', requires: [] }]
    });
    assert.deepEqual(plain(d.projects.map((p) => p.lifecycle)), ['active', 'archived']);
    assert.deepEqual(plain(d.projects[0].deployments.map((x) => ({ name: x.name, stack: x.stack.map((r) => r.product + ' ' + r.version) }))), [{ name: 'live', stack: ['php 8.3'] }]);
    assert.deepEqual(plain(P.deploymentNames(d)), ['production', 'staging', 'development', 'live']);
});

test('a newer site catalog updates dates and keeps what the user added', () => {
    const cur = P.normalizeData({
        meta: { catalogSeed: '2026-01-01' },
        projects: [{ name: 'Shop' }],
        catalog: { tech: [{ id: 'mine', name: 'In-house', versions: [{ version: '1' }] }], env: [{ id: 'php', versions: [{ version: '8.3', securityUntil: '2026-12-31' }, { version: '5.6', state: 'ended' }] }] }
    });
    assert.equal(cur.meta.catalogSeed, '2026-01-01');
    const site = P.normalizeData({ catalog: { tech: [{ id: 'laravel' }], env: [{ id: 'php', versions: [{ version: '8.3', securityUntil: '2027-12-31' }, { version: '8.4', securityUntil: '2028-12-31' }] }] } });
    const out = P.normalizeData(P.mergeData(cur, site, 'merge'));
    assert.deepEqual(plain(out.catalog.tech.map((p) => p.id)), ['mine', 'laravel']);
    assert.deepEqual(plain(out.catalog.env[0].versions.map((v) => v.version + ' ' + (v.securityUntil || v.state))), ['8.4 2028-12-31', '8.3 2027-12-31', '5.6 ended']);
    assert.equal(out.projects.length, 1);
    assert.equal(out.meta.catalogSeed, '2026-01-01');
});

test('versions are sorted by date, one per date, and the latest is the current version', () => {
    const d = P.normalizeData({
        projects: [{ name: 'Shop', updatedAt: '2026-10-01', tech: [
            { product: 'Laravel', versions: [
                { version: '12', date: '2026-11-09' },
                { version: '10', date: '2026-11-04' },
                { version: '11', date: '2026-11-04' },
                { version: '', date: '2026-11-05' }
            ] },
            'Vue 3.5'
        ] }]
    });
    const [laravel, vue] = d.projects[0].tech;
    assert.deepEqual(plain(laravel.versions), [{ version: '11', date: '2026-11-04' }, { version: '12', date: '2026-11-09' }]);
    assert.equal(laravel.version, '12');
    // ভার্সনের তালিকা না থাকলে version থেকে, প্রজেক্টের শেষ হালনাগাদের তারিখে
    assert.deepEqual(plain(vue.versions), [{ version: '3.5', date: '2026-10-01' }]);
});

test('schema 4 history becomes versions inside each part', () => {
    const d = P.normalizeData({
        schemaVersion: 4,
        projects: [{
            name: 'Shop',
            updatedAt: '2026-11-01',
            tech: [{ product: 'laravel', version: '12.40' }],
            deployments: [{ name: 'production', stack: [{ product: 'php', version: '8.3' }] }],
            history: [
                { date: '2023-03-20', product: 'laravel', where: '', version: '10' },
                { date: '2025-04-15', product: 'laravel', where: '', version: '12' },
                { date: '2024-01-01', product: 'php', where: 'production', version: '8.1' }
            ]
        }]
    });
    const p = d.projects[0];
    assert.equal(p.history, undefined);
    assert.deepEqual(plain(p.tech[0].versions), [{ version: '10', date: '2023-03-20' }, { version: '12.40', date: '2025-04-15' }]);
    assert.deepEqual(plain(p.deployments[0].stack[0].versions), [{ version: '8.1', date: '2024-01-01' }, { version: '8.3', date: '2026-11-01' }]);
});

test('schema 3 upgrade steps also become versions', () => {
    const d = P.normalizeData({
        schemaVersion: 3,
        projects: [{ name: 'Shop', tech: ['laravel 11'], history: [
            { date: '2024-06-10', product: 'laravel', where: '', from: '10', to: '11', note: '' },
            { date: '2023-03-20', product: 'laravel', where: '', from: '9', to: '10', note: 'x' }
        ] }]
    });
    assert.deepEqual(plain(d.projects[0].tech[0].versions.map((v) => v.version)), ['10', '11']);
});

test('merge keeps the version list and adds only a new cycle', () => {
    const catalog = { tech: [{ id: 'laravel', versions: [{ version: '13' }, { version: '12' }, { version: '11' }] }], env: [] };
    const cur = P.normalizeData({ catalog, projects: [{ id: 'shop', name: 'Shop', tech: [{ product: 'laravel', versions: [{ version: '11', date: '2026-10-10' }, { version: '12.40', date: '2026-11-09' }] }] }] });
    // AI-এর উত্তরে একই সাইকেল: কিছু বদলায় না
    const same = P.mergeData(cur, P.normalizeData({ projects: [{ id: 'shop', name: 'Shop', tech: ['laravel 12'] }] }), 'merge');
    assert.deepEqual(plain(same.projects[0].tech[0].versions.map((v) => v.version)), ['11', '12.40']);
    // নতুন সাইকেল: আজকের তারিখে শেষে যোগ
    const up = P.mergeData(cur, P.normalizeData({ projects: [{ id: 'shop', name: 'Shop', tech: ['laravel 13'] }] }), 'merge');
    assert.deepEqual(plain(up.projects[0].tech[0].versions), [{ version: '11', date: '2026-10-10' }, { version: '12.40', date: '2026-11-09' }, { version: '13', date: '2026-11-10' }]);
    assert.equal(up.projects[0].tech[0].version, '13');
});
