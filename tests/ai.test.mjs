import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPHD } from './load.mjs';

const P = loadPHD('2026-11-10');

test('extractJson finds JSON in AI replies', () => {
    assert.equal(P.extractJson('{"a":1}').a, 1);
    assert.equal(P.extractJson('Here you go:\n```json\n{"a":2}\n```\nThanks').a, 2);
    assert.equal(P.extractJson('Sure! {"projects": []} hope it helps').projects.length, 0);
    assert.throws(() => P.extractJson('no json here'), /no-json/);
});

test('inventedVersions flags versions missing from the source text', () => {
    const incoming = P.normalizeData({ projects: [{ name: 'Shop', tech: ['laravel 11.0'], deployments: [{ name: 'production', stack: ['php 8.3', 'mysql 8.0'] }] }] });
    const source = '"laravel/framework": "^11.0"\nPHP 8.3.4 (cli)';
    assert.equal(P.inventedVersions(incoming, source).join('|'), 'Shop: mysql 8.0 (production)');
});

test('prompts include catalog ids and never project URLs or owners', () => {
    const data = P.normalizeData({
        catalog: { tech: [{ id: 'laravel', name: 'Laravel', versions: [{ version: '11', securityUntil: '2026-03-12' }, { version: '12', securityUntil: '2027-02-24' }] }], env: [{ id: 'php', name: 'PHP', versions: [{ version: '8.3', securityUntil: '2027-12-31' }] }] },
        projects: [{ id: 'shop', name: 'Shop', owner: 'Secret Owner', repo: 'https://git.example/shop', tech: ['laravel 11'], deployments: [{ name: 'production', url: 'https://internal.example', host: 'db-01', stack: ['php 8.3'] }] }]
    });
    const projects = P.aiPrompts.projects(data, 'composer.json here');
    assert.match(projects, /laravel \(Laravel\)/);
    assert.match(projects, /composer.json here/);
    for (const prompt of [P.aiPrompts.plan(data, '', { project: 'shop' }), P.aiPrompts.report(data, '')]) {
        assert.ok(prompt.length > 200);
        assert.doesNotMatch(prompt, /Secret Owner|internal\.example|db-01|git\.example/);
    }
    assert.match(P.aiPrompts.plan(data, '', { project: 'shop' }), /"12 \(security until 2027-02-24\)"/);
    const cat = P.aiPrompts.catalog(data, '', { kind: 'env', product: 'php' });
    assert.match(cat, /"id": "php"/);
    assert.match(cat, /WHAT I ALREADY HAVE/);
});
