/* প্রজেক্ট হেলথ: সব পেজে লাগে এমন ছোট ফাংশন। এখানে DOM ছোঁয়া হয় না, তাই Node-এর টেস্টেও চলে। */
var PHD = (globalThis.PHD = globalThis.PHD || {});

(function (P) {
    var DAY = 864e5;
    P.DAY = DAY;

    // টেস্টে আজকের তারিখ বদলাতে P.now বদলানো যায়
    P.now = function () {
        return new Date();
    };

    // স্থানীয় ক্যালেন্ডারের আজকের তারিখ, UTC মধ্যরাত হিসেবে (YYYY-MM-DD-এর সাথে তুলনা করার জন্য)
    P.today = function () {
        var n = P.now();
        return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
    };

    P.isoDate = function (ms) {
        return new Date(ms).toISOString().slice(0, 10);
    };

    P.cleanDate = function (v) {
        if (typeof v !== 'string') return '';
        var s = v.trim().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
        return isNaN(Date.parse(s)) ? '' : s;
    };

    P.parseDate = function (s) {
        var c = P.cleanDate(s);
        return c ? Date.parse(c) : null;
    };

    P.daysUntil = function (s) {
        var t = P.parseDate(s);
        return t === null ? null : Math.round((t - P.today()) / DAY);
    };

    var bnNum = typeof Intl !== 'undefined' ? new Intl.NumberFormat('bn-BD') : null;
    P.num = function (n) {
        return bnNum ? bnNum.format(n) : String(n);
    };

    var bnDate = new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    var bnMonth = new Intl.DateTimeFormat('bn-BD', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    P.fmtDate = function (s) {
        var t = P.parseDate(s);
        return t === null ? '' : bnDate.format(new Date(t));
    };
    P.fmtMonth = function (s) {
        var t = P.parseDate(s);
        return t === null ? '' : bnMonth.format(new Date(t));
    };

    P.esc = function (s) {
        return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };

    P.str = function (v, max) {
        if (v === null || v === undefined) return '';
        var s = String(v).trim();
        return max ? s.slice(0, max) : s;
    };

    P.slug = function (s) {
        return P.str(s)
            .toLowerCase()
            .replace(/\.js$/, 'js')
            .replace(/[^a-z0-9ঀ-৿]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
    };

    // "v13.39.0", "^8.3", ">=20" থেকে শুধু ভার্সনের সংখ্যার অংশ
    P.cleanVersion = function (v) {
        var s = P.str(v);
        var m = s.match(/\d+(?:\.\d+)*/);
        return m ? m[0] : s;
    };

    P.versionParts = function (v) {
        var c = P.cleanVersion(v);
        if (!/^\d+(\.\d+)*$/.test(c)) return null;
        return c.split('.').map(Number);
    };

    // শুধু যতগুলো অংশ দুই দিকে আছে, ততটুকু তুলনা: "8.3.12" আর "8.3" সমান
    P.compareVersions = function (a, b) {
        var x = P.versionParts(a);
        var y = P.versionParts(b);
        if (!x || !y) return String(a).localeCompare(String(b));
        var n = Math.min(x.length, y.length);
        for (var i = 0; i < n; i++) {
            if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
        }
        return 0;
    };

    // নতুন ভার্সন আগে, যেমন 13, 12, 11 … বা 8.5, 8.4 …
    P.sortVersionsDesc = function (list, key) {
        return list.slice().sort(function (a, b) {
            var va = key ? a[key] : a;
            var vb = key ? b[key] : b;
            var x = P.versionParts(va);
            var y = P.versionParts(vb);
            if (!x || !y) return String(vb).localeCompare(String(va));
            for (var i = 0; i < Math.max(x.length, y.length); i++) {
                var d = (y[i] || 0) - (x[i] || 0);
                if (d) return d;
            }
            return 0;
        });
    };

    // ক্যাটালগের যে সাইকেলের সব অংশ লেখা ভার্সনের শুরুর সাথে মেলে, তার মধ্যে সবচেয়ে লম্বাটা
    P.matchCycle = function (versions, value) {
        var v = P.versionParts(value);
        var best = null;
        var bestLen = -1;
        (versions || []).forEach(function (cycle) {
            var c = P.versionParts(cycle.version);
            if (!c) {
                if (P.str(cycle.version).toLowerCase() === P.str(value).toLowerCase() && bestLen < 0) best = cycle;
                return;
            }
            if (!v || c.length > v.length || c.length <= bestLen) return;
            for (var i = 0; i < c.length; i++) {
                if (c[i] !== v[i]) return;
            }
            best = cycle;
            bestLen = c.length;
        });
        return best;
    };

    P.uid = function (prefix) {
        return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8);
    };

    P.unique = function (list) {
        var seen = {};
        return list.filter(function (x) {
            if (seen[x]) return false;
            seen[x] = true;
            return true;
        });
    };

    P.clone = function (o) {
        return JSON.parse(JSON.stringify(o));
    };

    P.byName = function (a, b) {
        return String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' });
    };

    // GitHub Pages-এর সাব-পাথ (যেমন /project-health-dashboard/) সহ লিংক
    P.url = function (path) {
        var base = (globalThis.document && document.documentElement.dataset.base) || '/';
        return base.replace(/\/$/, '') + path;
    };
})(PHD);
