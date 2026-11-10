/* endoflife.date API-র ডেটা থেকে ক্যাটালগের প্রোডাক্ট। ব্রাউজার আর scripts/update-catalog.mjs দুটোই এটা ব্যবহার করে। */
(function (P) {
    P.EOL_API = 'https://endoflife.date/api/v1/products/';

    var CATEGORY = {
        tech: { framework: 'framework', lang: 'language', app: 'tool', 'server-app': 'tool' },
        env: { lang: 'runtime', framework: 'runtime', database: 'database', 'server-app': 'server', os: 'os', app: 'tool' }
    };

    // endoflife.date-এর custom ঘর থেকে কোন প্রোডাক্টের কোন ভার্সন লাগে
    var REQUIRES_FIELDS = { supportedPhpVersions: 'php', supportedPythonVersions: 'python', supportedLaravelVersions: 'laravel' };

    function requiresFrom(custom) {
        var out = [];
        Object.keys(REQUIRES_FIELDS).forEach(function (key) {
            var text = custom && custom[key];
            if (typeof text !== 'string') return;
            // যেমন "3.12 - 3.15 (added in 6.1.3)": শুধু শুরুর রেঞ্জটুকু ধরা হয়
            var range = text.match(/(\d+(?:\.\d+)*)\s*[-–]\s*(\d+(?:\.\d+)*)/);
            var single = text.match(/\d+(?:\.\d+)*/);
            if (!range && !single) return;
            out.push({ product: REQUIRES_FIELDS[key], min: range ? range[1] : single[0], max: range ? range[2] : '' });
        });
        return out;
    }

    function day(v) {
        return typeof v === 'string' ? P.cleanDate(v) : '';
    }

    P.versionFromEndOfLife = function (r) {
        var eol = day(r.eolFrom);
        var state = '';
        if (!eol) state = r.isEol ? 'ended' : r.isMaintained ? 'supported' : '';
        return P.normalizeVersion({
            version: r.name,
            released: day(r.releaseDate),
            supportUntil: day(r.eoasFrom),
            securityUntil: eol,
            lts: !!r.isLts,
            state: state,
            requires: requiresFrom(r.custom)
        });
    };

    // opts.since: এর আগে শেষ হওয়া ভার্সন বাদ (এর চেয়ে পুরনো ভার্সনকে হিসাব নিজেই "সাপোর্ট শেষ" ধরে)
    P.productFromEndOfLife = function (result, kind, opts) {
        opts = opts || {};
        var since = opts.since || '2020-01-01';
        var limit = opts.limit || 40;
        var releases = (result.releases || []).filter(function (r) {
            var eol = day(r.eolFrom);
            if (eol) return eol >= since;
            if (r.isEol) {
                var rel = day(r.releaseDate);
                return !rel || rel >= since;
            }
            return true;
        });
        var versions = releases.slice(0, limit).map(P.versionFromEndOfLife).filter(Boolean);
        var links = result.links || {};
        return P.normalizeProduct(
            {
                id: opts.id || result.name,
                name: result.label || result.name,
                category: (CATEGORY[kind] || {})[result.category] || '',
                eolSlug: result.name,
                url: links.html || '',
                versions: versions
            },
            kind
        );
    };

    P.fetchEndOfLife = function (slug) {
        return fetch(P.EOL_API + encodeURIComponent(slug) + '/').then(function (res) {
            if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : 'http-' + res.status);
            return res.json();
        }).then(function (body) {
            return body.result;
        });
    };
})(PHD);
