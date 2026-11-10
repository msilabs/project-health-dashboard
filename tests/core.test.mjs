import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPHD } from './load.mjs';

const P = loadPHD();

test('cleanVersion strips prefixes and constraints', () => {
    assert.equal(P.cleanVersion('v13.39.0'), '13.39.0');
    assert.equal(P.cleanVersion('^8.3'), '8.3');
    assert.equal(P.cleanVersion('>=20.19'), '20.19');
    assert.equal(P.cleanVersion('latest'), 'latest');
});

test('compareVersions compares only the shared precision', () => {
    assert.equal(P.compareVersions('8.3.12', '8.3'), 0);
    assert.equal(P.compareVersions('8.1', '8.3'), -1);
    assert.equal(P.compareVersions('8.6.1', '8.5'), 1);
    assert.equal(P.compareVersions('10', '9'), 1);
});

test('matchCycle picks the longest matching cycle', () => {
    const versions = [{ version: '8' }, { version: '8.3' }, { version: '13' }, { version: '1.31' }];
    assert.equal(P.matchCycle(versions, '8.3.12').version, '8.3');
    assert.equal(P.matchCycle(versions, '8.4').version, '8');
    assert.equal(P.matchCycle(versions, 'v13.39.0').version, '13');
    assert.equal(P.matchCycle(versions, '1.3'), null);
    assert.equal(P.matchCycle(versions, '7.4'), null);
});

test('slug makes stable ids', () => {
    assert.equal(P.slug('Next.js'), 'nextjs');
    assert.equal(P.slug('Node.js'), 'nodejs');
    assert.equal(P.slug('  ISF Portal (v2) '), 'isf-portal-v2');
});

test('esc escapes HTML', () => {
    assert.equal(P.esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});
