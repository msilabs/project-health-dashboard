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
    assert.deepEqual(plain(p.deployments[0]), { name: 'production', url: '', host: '', stack: [{ product: 'php', version: '8.2' }] });
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
        projects: [{ id: 'shop', name: 'Shop', owner: 'Rahim', deployments: [{ name: 'production', url: 'https://shop.example', stack: [{ product: 'php', version: '8.1' }] }] }],
        catalog: { tech: [], env: [{ id: 'php', versions: [{ version: '8.1', securityUntil: '2025-12-31', note: 'keep' }] }] }
    });
    const inc = P.normalizeData({
        projects: [{ name: 'Shop', deployments: [{ name: 'production', stack: [{ product: 'php', version: '8.3' }] }, { name: 'staging', stack: [] }] }],
        catalog: { env: [{ id: 'php', versions: [{ version: '8.1', released: '2021-11-25' }, { version: '8.3', securityUntil: '2027-12-31' }] }] }
    });
    const out = P.mergeData(cur, inc, 'merge');
    const p = out.projects[0];
    assert.equal(p.owner, 'Rahim');
    assert.equal(p.deployments[0].url, 'https://shop.example');
    assert.equal(p.deployments[0].stack[0].version, '8.3');
    assert.equal(p.deployments.length, 2);
    const php = out.catalog.env[0];
    assert.deepEqual(plain(php.versions.map((v) => v.version)), ['8.3', '8.1']);
    assert.equal(php.versions[1].note, 'keep');
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
        approx: false,
        requires: [{ product: 'php', min: '8.3', max: '8.5' }],
        note: ''
    });
});
