/* ডেটার কাঠামো: যেকোনো উৎসের (localStorage, import, AI) ডেটা এখানে একই আকারে আনা হয় */
(function (P) {
    P.APP = 'project-health';
    P.SCHEMA_VERSION = 3;

    P.KINDS = ['tech', 'env'];
    P.KIND_LABEL = { tech: 'টেক', env: 'সার্ভার' };

    P.CATEGORIES = {
        tech: { framework: 'ফ্রেমওয়ার্ক', library: 'লাইব্রেরি', language: 'ভাষা', cms: 'CMS', mobile: 'মোবাইল', tool: 'টুল' },
        env: { runtime: 'রানটাইম', database: 'ডাটাবেস', cache: 'ক্যাশ', server: 'ওয়েব সার্ভার', os: 'অপারেটিং সিস্টেম', container: 'কনটেইনার', tool: 'টুল' }
    };

    P.LIFECYCLES = { active: 'সক্রিয়', archived: 'আর্কাইভ' };

    // তারিখ না থাকলে ভার্সনটা কী ধরে নেওয়া হবে
    P.VERSION_STATES = { '': 'জানা নেই', supported: 'সাপোর্ট চলছে', ended: 'সাপোর্ট শেষ' };

    P.DEFAULT_SETTINGS = { redDays: 90, yellowDays: 365 };

    // নতুন environment যোগ করার সময় এই নামগুলো প্রস্তাব করা হয়
    P.DEPLOYMENT_NAMES = ['production', 'staging', 'development'];

    var str = P.str;

    function bool(v) {
        return v === true || v === 'true' || v === 1;
    }

    function list(v) {
        return Array.isArray(v) ? v : [];
    }

    function tags(v) {
        var arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
        return P.unique(
            arr
                .map(function (t) {
                    return str(t, 40);
                })
                .filter(Boolean)
        ).slice(0, 20);
    }

    // "php 8.2-8.5, nodejs 20+, laravel <=12" ধরনের লেখা থেকে শর্তের তালিকা
    P.parseRequires = function (text) {
        return String(text || '')
            .split(/[,;\n]/)
            .map(function (part) {
                var m = part.trim().match(/^([A-Za-z][\w.\- ]*?)\s*(>=|<=|=)?\s*(\d[\d.]*)?\s*(\+|-\s*(\d[\d.]*))?$/);
                if (!m) return null;
                var r = { product: P.slug(m[1]), min: '', max: '' };
                if (m[2] === '<=') r.max = m[3] || '';
                else r.min = m[3] || '';
                if (m[5]) r.max = m[5];
                return r.product && (r.min || r.max) ? r : null;
            })
            .filter(Boolean);
    };

    P.formatRequires = function (reqs) {
        return list(reqs)
            .map(function (r) {
                if (r.min && r.max) return r.product + ' ' + r.min + '-' + r.max;
                if (r.min) return r.product + ' ' + r.min + '+';
                return r.product + ' <=' + r.max;
            })
            .join(', ');
    };

    function normalizeRequires(v) {
        if (typeof v === 'string') return P.parseRequires(v);
        return list(v)
            .map(function (r) {
                if (!r || typeof r !== 'object') return null;
                var x = { product: P.slug(r.product), min: P.cleanVersion(r.min || ''), max: P.cleanVersion(r.max || '') };
                return x.product && (x.min || x.max) ? x : null;
            })
            .filter(Boolean);
    }

    P.normalizeVersion = function (v) {
        if (!v || typeof v !== 'object') return null;
        var version = str(v.version !== undefined ? v.version : v.cycle !== undefined ? v.cycle : v.name, 40);
        if (!version) return null;
        var state = str(v.state);
        return {
            version: version,
            released: P.cleanDate(v.released || v.releaseDate || ''),
            supportUntil: P.cleanDate(v.supportUntil || v.activeUntil || v.eoas || ''),
            securityUntil: P.cleanDate(v.securityUntil || v.eol || ''),
            lts: bool(v.lts),
            state: P.VERSION_STATES[state] !== undefined ? state : '',
            requires: normalizeRequires(v.requires)
        };
    };

    P.normalizeProduct = function (p, kind) {
        if (!p || typeof p !== 'object') return null;
        var id = P.slug(p.id || p.name);
        if (!id) return null;
        var seen = {};
        var versions = list(p.versions)
            .map(P.normalizeVersion)
            .filter(function (v) {
                if (!v || seen[v.version]) return false;
                seen[v.version] = true;
                return true;
            });
        var category = str(p.category, 30);
        return {
            id: id,
            name: str(p.name, 60) || id,
            category: category || (kind === 'env' ? 'runtime' : 'framework'),
            eolSlug: str(p.eolSlug, 60),
            versions: P.sortVersionsDesc(versions, 'version')
        };
    };

    // {product, version}; AI কখনো "Laravel 11" বা "laravel@11" লেখে, সেটাও নেওয়া হয়
    P.normalizeRef = function (r) {
        if (typeof r === 'string') {
            var m = r.trim().match(/^(.+?)[\s@]+v?(\d[\w.\-]*)$/);
            r = m ? { product: m[1], version: m[2] } : { product: r, version: '' };
        }
        if (!r || typeof r !== 'object') return null;
        var product = P.slug(r.product || r.id || r.name);
        if (!product) return null;
        return { product: product, version: str(r.version, 40) };
    };

    function refs(v) {
        return list(v).map(P.normalizeRef).filter(Boolean);
    }

    P.normalizeDeployment = function (d) {
        if (!d || typeof d !== 'object') return null;
        return {
            name: str(d.name || (typeof d.env === 'string' ? d.env : ''), 40) || 'production',
            stack: refs(d.stack || d.components || (Array.isArray(d.env) ? d.env : []))
        };
    };

    // আপগ্রেডের একটা ধাপ। where ফাঁকা মানে টেক, নইলে এনভায়রনমেন্টের নাম।
    P.normalizeUpgrade = function (h) {
        if (!h || typeof h !== 'object') return null;
        var x = {
            date: P.cleanDate(h.date || ''),
            product: P.slug(h.product),
            where: str(h.where, 40),
            from: str(h.from, 40),
            to: str(h.to, 40),
            note: str(h.note, 300)
        };
        return x.date && x.product && x.to && x.from !== x.to ? x : null;
    };

    function byDate(a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    }

    P.normalizeHistory = function (v) {
        return list(v).map(P.normalizeUpgrade).filter(Boolean).sort(byDate).slice(-300);
    };

    P.normalizeProject = function (p) {
        if (!p || typeof p !== 'object') return null;
        var name = str(p.name || p.repo, 120);
        var id = P.slug(p.id || name || p.repo);
        if (!id) return null;
        var seenDep = {};
        return {
            id: id,
            name: name || id,
            repo: str(p.repo, 300),
            owner: str(p.owner, 80),
            tags: tags(p.tags),
            // পুরনো ডেটার 'maintenance' এখন 'active'
            lifecycle: p.lifecycle === 'archived' ? 'archived' : 'active',
            note: str(p.note, 1000),
            tech: refs(p.tech),
            deployments: list(p.deployments)
                .map(P.normalizeDeployment)
                .filter(function (d) {
                    if (!d || seenDep[d.name]) return false;
                    seenDep[d.name] = true;
                    return true;
                }),
            history: P.normalizeHistory(p.history),
            updatedAt: P.cleanDate(p.updatedAt || '')
        };
    };

    P.normalizeSettings = function (s) {
        s = s && typeof s === 'object' ? s : {};
        var d = P.DEFAULT_SETTINGS;
        var red = Math.round(Number(s.redDays));
        var yellow = Math.round(Number(s.yellowDays));
        red = red >= 0 && red <= 3650 ? red : d.redDays;
        yellow = yellow >= 0 && yellow <= 3650 ? yellow : d.yellowDays;
        return { redDays: red, yellowDays: Math.max(yellow, red) };
    };

    // প্রজেক্টে ব্যবহৃত environment-এর নাম, তারপর প্রচলিত নামগুলো
    P.deploymentNames = function (data) {
        var used = [];
        data.projects.forEach(function (p) {
            p.deployments.forEach(function (d) {
                used.push(d.name);
            });
        });
        return P.unique(P.DEPLOYMENT_NAMES.concat(used));
    };

    function products(v, kind) {
        var seen = {};
        return list(v)
            .map(function (p) {
                return P.normalizeProduct(p, kind);
            })
            .filter(function (p) {
                if (!p || seen[p.id]) return false;
                seen[p.id] = true;
                return true;
            })
            .sort(P.byName);
    }

    function uniqueIds(projects) {
        var seen = {};
        return projects.map(function (p) {
            var id = p.id;
            var n = 2;
            while (seen[id]) id = p.id + '-' + n++;
            seen[id] = true;
            if (id !== p.id) p = Object.assign({}, p, { id: id });
            return p;
        });
    }

    P.emptyData = function () {
        return {
            app: P.APP,
            schemaVersion: P.SCHEMA_VERSION,
            settings: P.normalizeSettings(),
            catalog: { tech: [], env: [] },
            projects: [],
            meta: { sample: false, catalogSeed: '' }
        };
    };

    // has: কোন অংশগুলো আসলে ইনপুটে ছিল (import-এ শুধু সেগুলোই বদলায়)।
    // schemaVersion 1-এর ডেটাও এখান দিয়েই আসে: বাদ পড়া ঘরগুলো (deployment-এর host আর url, ভার্সনের note …) আর নেওয়া হয় না।
    P.normalizeData = function (raw) {
        if (Array.isArray(raw)) raw = { projects: raw };
        if (!raw || typeof raw !== 'object') throw new Error('not-object');
        if (raw.schemaVersion && Number(raw.schemaVersion) > P.SCHEMA_VERSION) throw new Error('newer-schema');
        var cat = raw.catalog && typeof raw.catalog === 'object' ? raw.catalog : {};
        var techSrc = cat.tech || raw.tech;
        var envSrc = cat.env || raw.env;
        var out = P.emptyData();
        out.has = {
            settings: !!raw.settings,
            tech: Array.isArray(techSrc),
            env: Array.isArray(envSrc),
            projects: Array.isArray(raw.projects)
        };
        out.settings = P.normalizeSettings(raw.settings);
        out.catalog.tech = products(techSrc, 'tech');
        out.catalog.env = products(envSrc, 'env');
        out.projects = uniqueIds(list(raw.projects).map(P.normalizeProject).filter(Boolean));
        out.meta.sample = !!(raw.meta && raw.meta.sample);
        out.meta.catalogSeed = P.cleanDate((raw.meta && raw.meta.catalogSeed) || '');
        if (!out.has.settings && !out.has.tech && !out.has.env && !out.has.projects) throw new Error('empty');
        return out;
    };

    P.stripMeta = function (data) {
        var d = P.clone(data);
        delete d.has;
        return d;
    };

    // export-এর জন্য ফাইলের আকার
    P.exportData = function (data) {
        var d = P.stripMeta(data);
        return Object.assign({ app: P.APP, schemaVersion: P.SCHEMA_VERSION, exportedAt: new Date().toISOString() }, d);
    };

    /* ---------- merge ---------- */

    function fill(a, b) {
        return b !== '' && b !== undefined && b !== null ? b : a;
    }

    P.mergeVersion = function (a, b) {
        return {
            version: a.version,
            released: fill(a.released, b.released),
            supportUntil: fill(a.supportUntil, b.supportUntil),
            securityUntil: fill(a.securityUntil, b.securityUntil),
            lts: a.lts || b.lts,
            state: b.state || (b.securityUntil ? '' : a.state),
            requires: b.requires.length ? b.requires : a.requires
        };
    };

    P.mergeProduct = function (a, b) {
        var map = {};
        a.versions.forEach(function (v) {
            map[v.version] = v;
        });
        b.versions.forEach(function (v) {
            map[v.version] = map[v.version] ? P.mergeVersion(map[v.version], v) : v;
        });
        return {
            id: a.id,
            name: fill(a.name, b.name),
            category: fill(a.category, b.category),
            eolSlug: fill(a.eolSlug, b.eolSlug),
            versions: P.sortVersionsDesc(
                Object.keys(map).map(function (k) {
                    return map[k];
                }),
                'version'
            )
        };
    };

    function mergeProducts(current, incoming) {
        var map = {};
        current.forEach(function (p) {
            map[p.id] = p;
        });
        incoming.forEach(function (p) {
            map[p.id] = map[p.id] ? P.mergeProduct(map[p.id], p) : p;
        });
        return Object.keys(map)
            .map(function (k) {
                return map[k];
            })
            .sort(P.byName);
    }

    P.mergeProject = function (a, b) {
        var deps = a.deployments.map(function (d) {
            return P.clone(d);
        });
        b.deployments.forEach(function (d) {
            var cur = deps.filter(function (x) {
                return x.name === d.name;
            })[0];
            if (!cur) {
                deps.push(d);
                return;
            }
            if (d.stack.length) cur.stack = d.stack;
        });
        return {
            id: a.id,
            name: fill(a.name, b.name),
            repo: fill(a.repo, b.repo),
            owner: fill(a.owner, b.owner),
            tags: b.tags.length ? b.tags : a.tags,
            lifecycle: b.lifecycle !== 'active' ? b.lifecycle : a.lifecycle,
            note: fill(a.note, b.note),
            tech: b.tech.length ? b.tech : a.tech,
            deployments: deps,
            history: mergeHistory(a.history, b.history),
            updatedAt: fill(a.updatedAt, b.updatedAt)
        };
    };

    function upgradeKey(h) {
        return [h.date, h.product, h.where, h.from, h.to].join('|');
    }

    function mergeHistory(a, b) {
        var seen = {};
        return a
            .concat(b)
            .filter(function (h) {
                var k = upgradeKey(h);
                if (seen[k]) return false;
                seen[k] = true;
                return true;
            })
            .sort(byDate);
    }

    // দুই ভার্সন একই সাইকেলের কিনা (12.40 আর 12.41 একই, তাই সেটা আপগ্রেড ধরা হয় না)
    P.sameCycle = function (data, kind, productId, a, b) {
        if (P.cleanVersion(a) === P.cleanVersion(b)) return true;
        var product = P.findProduct(data, kind, productId);
        var ca = product ? P.matchCycle(product.versions, a) : null;
        var cb = product ? P.matchCycle(product.versions, b) : null;
        return !!(ca && cb && ca === cb);
    };

    // before থেকে after-এ কোনো ভার্সনের সাইকেল বদলালে after-এর প্রজেক্টের history-তে একটা ধাপ যোগ হয়।
    // একই দিনে একই অংশ কয়েকবার বদলালে একটাই ধাপ থাকে।
    P.recordUpgrades = function (before, after, date) {
        var old = {};
        before.projects.forEach(function (p) {
            old[p.id] = p;
        });
        after.projects.forEach(function (p) {
            var prev = old[p.id];
            if (!prev) return;
            var changes = [];
            function compare(kind, where, a, b) {
                b.forEach(function (ref) {
                    var was = a.filter(function (x) {
                        return x.product === ref.product;
                    })[0];
                    if (!was || !was.version || !ref.version || P.sameCycle(after, kind, ref.product, was.version, ref.version)) return;
                    changes.push({ kind: kind, product: ref.product, where: where, from: was.version, to: ref.version });
                });
            }
            compare('tech', '', prev.tech, p.tech);
            p.deployments.forEach(function (d) {
                var pd = prev.deployments.filter(function (x) {
                    return x.name === d.name;
                })[0];
                if (pd) compare('env', d.name, pd.stack, d.stack);
            });
            if (!changes.length) return;
            p.history = p.history || [];
            changes.forEach(function (c) {
                var same = p.history.filter(function (h) {
                    return h.product === c.product && h.where === c.where;
                });
                var last = same[same.length - 1];
                // হাতে লেখা ধাপে এই বদল আগেই আছে
                if (last && P.sameCycle(after, c.kind, c.product, last.to, c.to)) return;
                if (last && last.date === date) {
                    last.to = c.to;
                    if (P.sameCycle(after, c.kind, c.product, last.from, last.to)) p.history.splice(p.history.indexOf(last), 1);
                    return;
                }
                p.history.push({ date: date, product: c.product, where: c.where, from: c.from, to: c.to, note: '' });
            });
            p.history.sort(byDate);
        });
        return after;
    };

    // mode: 'merge' (একই id মিলিয়ে হালনাগাদ) বা 'replace' (ইনপুটে থাকা অংশ পুরো বদল)
    P.mergeData = function (current, incoming, mode) {
        var out = P.stripMeta(current);
        var has = incoming.has || { settings: true, tech: true, env: true, projects: true };
        if (has.settings) out.settings = P.clone(incoming.settings);
        P.KINDS.forEach(function (k) {
            if (!has[k]) return;
            out.catalog[k] = mode === 'replace' ? P.clone(incoming.catalog[k]) : mergeProducts(out.catalog[k], incoming.catalog[k]);
        });
        if (has.projects) {
            if (mode === 'replace') {
                out.projects = P.clone(incoming.projects);
            } else {
                var byId = {};
                out.projects.forEach(function (p, i) {
                    byId[p.id] = i;
                });
                incoming.projects.forEach(function (p) {
                    if (byId[p.id] !== undefined) out.projects[byId[p.id]] = P.mergeProject(out.projects[byId[p.id]], p);
                    else out.projects.push(P.clone(p));
                });
            }
        }
        if (mode === 'replace' && has.projects) out.meta.sample = !!incoming.meta.sample;
        return out;
    };

    // দুই অবস্থার মধ্যে কী কী বদলাবে, তার গোনা
    P.diffData = function (a, b) {
        function index(arr, key) {
            var m = {};
            arr.forEach(function (x) {
                m[x[key]] = x;
            });
            return m;
        }
        function count(before, after, key) {
            var x = index(before, key);
            var y = index(after, key);
            var r = { added: 0, removed: 0, changed: 0 };
            Object.keys(y).forEach(function (k) {
                if (!x[k]) r.added++;
                else if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) r.changed++;
            });
            Object.keys(x).forEach(function (k) {
                if (!y[k]) r.removed++;
            });
            return r;
        }
        function versions(kind) {
            var r = { added: 0, removed: 0, changed: 0 };
            var x = index(a.catalog[kind], 'id');
            b.catalog[kind].forEach(function (p) {
                var c = count(x[p.id] ? x[p.id].versions : [], p.versions, 'version');
                r.added += c.added;
                r.removed += c.removed;
                r.changed += c.changed;
            });
            return r;
        }
        return {
            projects: count(a.projects, b.projects, 'id'),
            tech: count(a.catalog.tech, b.catalog.tech, 'id'),
            env: count(a.catalog.env, b.catalog.env, 'id'),
            techVersions: versions('tech'),
            envVersions: versions('env'),
            settings: JSON.stringify(a.settings) !== JSON.stringify(b.settings)
        };
    };

    P.findProduct = function (data, kind, id) {
        return (
            data.catalog[kind].filter(function (p) {
                return p.id === id;
            })[0] || null
        );
    };
})(PHD);
