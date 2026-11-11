import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPHD, plain } from './load.mjs';

const P = loadPHD('2026-11-10');

const data = P.normalizeData({
    settings: { redDays: 90, yellowDays: 365 },
    catalog: {
        tech: [
            {
                id: 'laravel',
                name: 'Laravel',
                versions: [
                    { version: '13', supportUntil: '2027-09-30', securityUntil: '2028-03-17', requires: 'php 8.3-8.5' },
                    { version: '11', supportUntil: '2025-09-03', securityUntil: '2026-03-12', requires: 'php 8.2-8.4' }
                ]
            }
        ],
        env: [
            {
                id: 'php',
                name: 'PHP',
                versions: [
                    { version: '8.3', supportUntil: '2025-12-31', securityUntil: '2027-12-31' },
                    { version: '8.2', supportUntil: '2024-12-31', securityUntil: '2026-12-31' },
                    { version: '8.1', securityUntil: '2025-12-31' }
                ]
            },
            { id: 'nginx', name: 'nginx', versions: [{ version: '1.29', state: 'supported' }] },
            { id: 'mysql', name: 'MySQL', versions: [{ version: '8.0' }] }
        ]
    },
    projects: [
        {
            name: 'Portal',
            tech: [{ product: 'laravel', version: 'v13.2.0' }],
            deployments: [
                { name: 'production', stack: [{ product: 'php', version: '8.2.20' }, { product: 'nginx', version: '1.29.1' }] },
                { name: 'staging', stack: [{ product: 'php', version: '8.3' }] }
            ]
        },
        { name: 'Legacy', tech: [{ product: 'laravel', version: '11' }], deployments: [{ name: 'production', stack: [{ product: 'php', version: '8.1' }] }] },
        { name: 'Mystery', deployments: [{ name: 'production', stack: [{ product: 'mysql', version: '8.0' }, { product: 'redis', version: '7' }] }] },
        { name: 'Old', lifecycle: 'archived', tech: [{ product: 'laravel', version: '11' }] }
    ]
});

test('cycleStatus uses thresholds and phases', () => {
    const php = P.findProduct(data, 'env', 'php');
    const s82 = P.cycleStatus(php.versions[1], data.settings);
    assert.equal(s82.status, 'critical');
    assert.equal(s82.days, 51);
    assert.equal(s82.phase, 'security');
    const s83 = P.cycleStatus(php.versions[0], data.settings);
    assert.equal(s83.status, 'ok');
    assert.equal(s83.phase, 'security');
    assert.equal(P.cycleStatus(php.versions[2], data.settings).status, 'eol');
    const nginx = P.findProduct(data, 'env', 'nginx').versions[0];
    assert.equal(P.cycleStatus(nginx, data.settings).status, 'ok');
});

test('project status is its worst known part', () => {
    const a = P.analyze(data);
    const byId = Object.fromEntries(a.rows.map((r) => [r.project.id, r]));
    assert.equal(byId.portal.status, 'critical');
    assert.equal(byId.portal.reason, 'PHP 8.2');
    assert.equal(byId.legacy.status, 'eol');
    assert.equal(byId.mystery.status, 'unknown');
    assert.equal(byId.mystery.unknownCount, 2);
    assert.equal(byId.old, undefined, 'archived projects are skipped by default');
    assert.deepEqual(plain(a.rows.map((r) => r.project.id)), ['legacy', 'portal', 'mystery']);
    assert.equal(a.counts.eol, 1);
    assert.equal(P.analyze(data, { includeArchived: true }).total, 4);
});

test('requirements and drift become issues', () => {
    const portal = P.analyzeProject(data, data.projects[0]);
    const texts = portal.issues.map((i) => i.type + ':' + (i.deployment || ''));
    assert.deepEqual(plain(texts.sort()), ['drift:', 'requires:production']);
    const req = portal.issues.find((i) => i.type === 'requires');
    assert.equal(req.severity, 'critical');
    assert.match(req.text, /PHP 8.3 থেকে 8.5/);
    const legacy = P.analyzeProject(data, data.projects[1]);
    assert.equal(legacy.issues.length, 1, 'PHP 8.1 is below Laravel 11 minimum');
});

test('deployment filter keeps tech and only that environment', () => {
    const a = P.analyze(data, { deployment: 'staging' });
    const portal = a.rows.find((r) => r.project.id === 'portal');
    assert.equal(portal.status, 'ok');
    assert.equal(portal.items.length, 2);
    assert.equal(portal.issues.length, 0);
});

test('upcoming lists ended and soon-ending versions with projects', () => {
    const a = P.analyze(data);
    const up = P.upcoming(a.rows, 365);
    assert.deepEqual(plain(up.map((u) => u.product + ' ' + u.version)), ['php 8.1', 'laravel 11', 'php 8.2']);
    assert.equal(up[0].projects.length, 1);
});

test('todo puts ended, critical and incompatible items first', () => {
    const a = P.analyze(data);
    const todo = P.todo(a.rows, data.settings);
    assert.deepEqual(plain(todo.map((t) => t.level + ':' + t.type + ':' + t.status)), [
        'now:version:eol',
        'now:version:eol',
        'now:version:critical',
        'now:requires:critical',
        'now:requires:critical',
        'soon:drift:warning'
    ]);
    assert.match(todo[0].title, /PHP 8.1-এর সাপোর্ট শেষ/);
});

test('a version older than every ended catalog version counts as ended', () => {
    const d = P.normalizeData({
        catalog: { env: [{ id: 'php', versions: [{ version: '8.1', securityUntil: '2025-12-31' }, { version: '8.3', securityUntil: '2027-12-31' }] }] },
        projects: [{ name: 'Ancient', deployments: [{ name: 'production', stack: ['php 5.6', 'php 8.2'] }] }]
    });
    const items = P.analyzeProject(d, d.projects[0]).items;
    assert.equal(items[0].status, 'eol');
    assert.equal(items[1].status, 'unknown', '8.2 sits between known cycles, so it stays unknown');
});

test('upgradeJourney compares the first version with the current one', () => {
    const d = P.clone(data);
    d.catalog.tech[0].versions.push({ version: '9', supportUntil: '2023-08-08', securityUntil: '2024-02-06', requires: [] });
    const project = P.normalizeProject({
        name: 'Shop',
        tech: ['laravel 13.1'],
        history: [
            { date: '2023-03-20', product: 'laravel', from: '9', to: '11' },
            { date: '2026-04-01', product: 'laravel', from: '11', to: '13', note: 'done' }
        ]
    });
    const [t] = plain(P.upgradeJourney(d, project));
    assert.equal(t.productName, 'Laravel');
    assert.equal(t.start.version, '9');
    assert.equal(t.start.status, 'eol');
    assert.equal(t.current.version, '13.1');
    assert.equal(t.current.status, 'ok');
    assert.equal(t.steps.length, 2);
    const text = P.upgradeSummaryText(d, project);
    assert.match(text, /Laravel: 9 থেকে 13\.1/);
    assert.match(text, /done/);
    assert.equal(P.upgradeSummaryText(d, P.normalizeProject({ name: 'X' })), '');
});

test('upgradeReport filters by date range and counts before and after', () => {
    const d = P.clone(data);
    d.catalog.tech[0].versions.push({ version: '9', supportUntil: '2023-08-08', securityUntil: '2024-02-06', requires: [] });
    d.projects = [
        P.normalizeProject({
            name: 'Shop',
            tech: ['laravel 13.1'],
            history: [
                { date: '2023-03-20', product: 'laravel', from: '9', to: '11' },
                { date: '2026-04-01', product: 'laravel', from: '11', to: '13' }
            ]
        }),
        P.normalizeProject({ name: 'Idle', tech: ['laravel 11'] })
    ];
    const all = P.upgradeReport(d, {});
    assert.equal(all.projects.length, 1);
    assert.equal(all.tracks, 1);
    assert.equal(all.steps, 2);
    assert.equal(all.before.eol, 1);
    assert.equal(all.after.ok, 1);
    assert.equal(all.fixed, 1);

    // শুধু প্রথম ধাপ: "এখন" হয় সেই ধাপের ভার্সন, বর্তমান নয়
    const early = P.upgradeReport(d, { to: '2024-12-31' });
    assert.equal(early.projects[0].tracks[0].current.version, '11');
    assert.equal(early.steps, 1);

    const late = P.upgradeReport(d, { from: '2026-01-01' });
    assert.equal(late.projects[0].tracks[0].start.version, '11');
    assert.equal(late.projects[0].tracks[0].current.version, '13.1');

    assert.equal(P.upgradeReport(d, { from: '2030-01-01' }).projects.length, 0);
});
