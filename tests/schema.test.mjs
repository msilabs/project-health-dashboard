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
    assert.deepEqual(plain(p.tech), [{ product: 'laravel', version: '11' }, { product: 'react', version: '18.3' }]);
    assert.deepEqual(plain(p.deployments[0]), { name: 'production', stack: [{ product: 'php', version: '8.2' }] });
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
    assert.equal(d.schemaVersion, 3);
    assert.deepEqual(plain(d.settings), { redDays: 30, yellowDays: 200 });
    assert.deepEqual(plain(d.catalog.env[0]), {
        id: 'php',
        name: 'php',
        category: 'runtime',
        eolSlug: '',
        versions: [{ version: '8.3', released: '', supportUntil: '', securityUntil: '2027-12-31', lts: false, state: '', requires: [] }]
    });
    assert.deepEqual(plain(d.projects.map((p) => p.lifecycle)), ['active', 'archived']);
    assert.deepEqual(plain(d.projects[0].deployments), [{ name: 'live', stack: [{ product: 'php', version: '8.3' }] }]);
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

test('history is cleaned, sorted and kept on merge', () => {
    const d = P.normalizeData({
        projects: [{ name: 'Shop', history: [
            { date: '2024-06-10', product: 'Laravel', from: '10', to: '11' },
            { date: '2023-03-20', product: 'laravel', from: '9', to: '10', note: 'first' },
            { date: 'bad', product: 'laravel', from: '1', to: '2' },
            { date: '2024-01-01', product: 'php', where: 'production', from: '8.1', to: '8.1' }
        ] }]
    });
    assert.deepEqual(plain(d.projects[0].history.map((h) => h.date + ' ' + h.product + ' ' + h.from + '>' + h.to)), ['2023-03-20 laravel 9>10', '2024-06-10 laravel 10>11']);
    const inc = P.normalizeData({ projects: [{ name: 'Shop', history: [{ date: '2023-03-20', product: 'laravel', from: '9', to: '10' }, { date: '2025-04-15', product: 'laravel', from: '11', to: '12' }] }] });
    const out = P.mergeData(d, inc, 'merge');
    assert.equal(out.projects[0].history.length, 3);
});

test('recordUpgrades adds a step only when the cycle changes', () => {
    const catalog = { tech: [{ id: 'laravel', versions: [{ version: '12' }, { version: '11' }, { version: '10' }] }], env: [{ id: 'php', versions: [{ version: '8.3' }, { version: '8.2' }] }] };
    const before = P.normalizeData({ catalog, projects: [{ name: 'Shop', tech: ['laravel 11.2'], deployments: [{ name: 'production', stack: ['php 8.2.10'] }] }] });
    const patch = P.clone(before);
    patch.projects[0].tech[0].version = '11.9';
    patch.projects[0].deployments[0].stack[0].version = '8.2.30';
    assert.equal(P.recordUpgrades(before, patch, '2026-11-10').projects[0].history.length, 0);

    const after = P.clone(before);
    after.projects[0].tech[0].version = '12.1';
    after.projects[0].deployments[0].stack[0].version = '8.3';
    P.recordUpgrades(before, after, '2026-11-10');
    assert.deepEqual(plain(after.projects[0].history.map((h) => h.where + '|' + h.product + ' ' + h.from + '>' + h.to)), ['|laravel 11.2>12.1', 'production|php 8.2.10>8.3']);

    // একই দিনে আবার আগের ভার্সনে ফিরলে ধাপটা মুছে যায়
    const back = P.clone(after);
    back.projects[0].tech[0].version = '11.2';
    P.recordUpgrades(after, back, '2026-11-10');
    assert.deepEqual(plain(back.projects[0].history.map((h) => h.product)), ['php']);

    // হাতে লেখা ধাপে বদলটা আগেই থাকলে নতুন ধাপ হয় না
    const manual = P.clone(before);
    manual.projects[0].history = [{ date: '2025-01-01', product: 'laravel', where: '', from: '11', to: '12', note: '' }];
    manual.projects[0].tech[0].version = '12';
    P.recordUpgrades(before, manual, '2026-11-10');
    assert.equal(manual.projects[0].history.length, 1);
});

test('creating a project and saving the same version again adds no step', () => {
    const catalog = { tech: [{ id: 'laravel', versions: [{ version: '11' }, { version: '10' }] }], env: [] };
    const empty = P.normalizeData({ catalog, projects: [] });
    const created = P.recordUpgrades(empty, P.normalizeData({ catalog, projects: [{ name: 'A', tech: ['laravel 10'] }] }), '2026-11-11');
    assert.equal(created.projects[0].history.length, 0);
    const edited = P.clone(created);
    edited.projects[0].tech[0].version = '11';
    P.recordUpgrades(created, edited, '2026-11-11');
    assert.equal(edited.projects[0].history.length, 1);
    const again = P.clone(edited);
    P.recordUpgrades(edited, again, '2026-11-12');
    assert.equal(again.projects[0].history.length, 1);
});
