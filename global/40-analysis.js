/* হিসাব: ক্যাটালগের তারিখ দিয়ে প্রজেক্টের প্রতিটা অংশের অবস্থা, সামঞ্জস্য আর অমিল */
(function (P) {
    P.STATUS_ORDER = ['eol', 'critical', 'warning', 'ok', 'unknown'];
    P.STATUS = {
        eol: { label: 'সাপোর্ট শেষ', note: 'সিকিউরিটি আপডেটও আর আসে না' },
        critical: { label: 'জরুরি', note: 'শিগগির সাপোর্ট শেষ হবে' },
        warning: { label: 'সতর্কতা', note: 'এক বছরের মধ্যে পরিকল্পনা দরকার' },
        ok: { label: 'নিরাপদ', note: 'জানা সব অংশে সাপোর্ট আছে' },
        unknown: { label: 'অজানা', note: 'ভার্সন বা তারিখ জানা নেই' }
    };
    P.PHASE = { active: 'সক্রিয় সাপোর্ট', security: 'শুধু সিকিউরিটি ফিক্স', ended: 'সাপোর্ট শেষ' };

    // প্রজেক্টের অবস্থা হয় সবচেয়ে খারাপ জানা অংশের অবস্থা; কিছুই জানা না থাকলে অজানা
    var RANK = { eol: 5, critical: 4, warning: 3, ok: 1, unknown: 0 };
    P.statusRank = function (s) {
        return RANK[s] || 0;
    };

    P.statusForDays = function (days, settings) {
        if (days < 0) return 'eol';
        if (days <= settings.redDays) return 'critical';
        if (days <= settings.yellowDays) return 'warning';
        return 'ok';
    };

    // একটা ক্যাটালগ ভার্সনের অবস্থা (কোনো প্রজেক্ট ছাড়াই)
    P.cycleStatus = function (cycle, settings) {
        var end = cycle.securityUntil || cycle.supportUntil;
        var today = P.today();
        var r = { status: 'unknown', days: null, end: end, phase: null, text: 'শেষের তারিখ নেই', reason: 'no-date' };
        if (end) {
            r.days = P.daysUntil(end);
            r.status = P.statusForDays(r.days, settings);
            r.reason = '';
            r.text =
                r.days < 0
                    ? P.fmtDate(end) + '-এ শেষ'
                    : r.status === 'ok'
                      ? P.fmtDate(end) + ' পর্যন্ত'
                      : P.num(r.days) + ' দিন বাকি';
        } else if (cycle.state === 'ended') {
            r.status = 'eol';
            r.reason = '';
            r.text = 'সাপোর্ট শেষ';
        } else if (cycle.state === 'supported') {
            r.status = 'ok';
            r.reason = '';
            r.text = 'সাপোর্ট চলছে, শেষের তারিখ ঘোষিত নয়';
        }
        if (r.status === 'eol') r.phase = 'ended';
        else if (r.status !== 'unknown' || cycle.supportUntil) {
            r.phase = cycle.supportUntil && P.parseDate(cycle.supportUntil) < today ? 'security' : 'active';
        }
        if (cycle.approx && r.reason === '') r.text += ' (আনুমানিক)';
        return r;
    };

    // ভার্সনটা ক্যাটালগের সব ভার্সনের চেয়ে পুরনো, আর সবচেয়ে পুরনোটার সাপোর্টও শেষ হলে সেটা ফেরত দেয়
    function olderThanCatalog(product, version, settings) {
        if (!P.versionParts(version)) return null;
        var known = product.versions.filter(function (v) {
            return P.versionParts(v.version);
        });
        if (!known.length) return null;
        var older = known.every(function (v) {
            return P.compareVersions(version, v.version) < 0;
        });
        if (!older) return null;
        var oldest = P.sortVersionsDesc(known, 'version').pop();
        return P.cycleStatus(oldest, settings).status === 'eol' ? oldest : null;
    }

    // প্রজেক্টের একটা অংশ, যেমন {product:'php', version:'8.1'}
    P.evaluateRef = function (data, kind, ref, deployment) {
        var product = P.findProduct(data, kind, ref.product);
        var item = {
            kind: kind,
            deployment: deployment || null,
            product: ref.product,
            productName: product ? product.name : ref.product,
            version: ref.version,
            cycle: null,
            status: 'unknown',
            days: null,
            end: '',
            phase: null,
            reason: '',
            text: ''
        };
        item.label = item.productName + (ref.version ? ' ' + ref.version : '');
        if (!product) {
            item.reason = 'no-product';
            item.text = 'ক্যাটালগে নেই';
            return item;
        }
        if (!ref.version) {
            item.reason = 'no-version';
            item.text = 'ভার্সন লেখা নেই';
            return item;
        }
        var cycle = P.matchCycle(product.versions, ref.version);
        if (!cycle) {
            var oldest = olderThanCatalog(product, ref.version, data.settings);
            if (oldest) {
                item.status = 'eol';
                item.phase = 'ended';
                item.text = 'ক্যাটালগের সবচেয়ে পুরনো ' + oldest.version + '-এর চেয়েও পুরনো, তাই সাপোর্ট শেষ ধরা হয়েছে';
                return item;
            }
            item.reason = 'no-cycle';
            item.text = 'এই ভার্সন ক্যাটালগে নেই';
            return item;
        }
        var s = P.cycleStatus(cycle, data.settings);
        item.cycle = cycle;
        item.label = item.productName + ' ' + cycle.version;
        item.status = s.status;
        item.days = s.days;
        item.end = s.end;
        item.phase = s.phase;
        item.reason = s.reason;
        item.text = s.text;
        return item;
    };

    function issuesFor(project, items) {
        var issues = [];
        var techItems = items.filter(function (x) {
            return x.kind === 'tech';
        });
        var envItems = items.filter(function (x) {
            return x.kind === 'env';
        });

        // ১. কোনো টেক ভার্সনের যে রানটাইম বা প্যাকেজ লাগে, সেটা মিলছে কিনা
        items.forEach(function (src) {
            if (!src.cycle || !src.cycle.requires.length) return;
            src.cycle.requires.forEach(function (req) {
                var targets = (src.kind === 'tech' ? envItems.concat(techItems) : envItems).filter(function (t) {
                    return t.product === req.product && t !== src && P.versionParts(t.version) && (src.kind === 'tech' || t.deployment === src.deployment);
                });
                targets.forEach(function (t) {
                    var low = req.min && P.compareVersions(t.version, req.min) < 0;
                    var high = req.max && P.compareVersions(t.version, req.max) > 0;
                    if (!low && !high) return;
                    var where = t.deployment ? t.deployment + '-এ ' : '';
                    var need = req.min && req.max ? req.min + ' থেকে ' + req.max : req.min ? req.min + ' বা নতুন' : req.max + ' বা পুরনো';
                    issues.push({
                        type: 'requires',
                        severity: low ? 'critical' : 'warning',
                        project: project,
                        deployment: t.deployment,
                        text: src.label + '-এর জন্য ' + t.productName + ' ' + need + ' লাগে, কিন্তু ' + where + t.productName + ' ' + P.cleanVersion(t.version) + (low ? ' (পুরনো)' : ' (সমর্থিত সীমার বাইরে)')
                    });
                });
            });
        });

        // ২. একই প্রোডাক্ট বিভিন্ন environment-এ ভিন্ন ভার্সনে
        var byProduct = {};
        envItems.forEach(function (x) {
            if (!x.version) return;
            var v = x.cycle ? x.cycle.version : P.cleanVersion(x.version);
            (byProduct[x.product] = byProduct[x.product] || []).push({ dep: x.deployment, v: v, name: x.productName });
        });
        Object.keys(byProduct).forEach(function (k) {
            var arr = byProduct[k];
            var distinct = P.unique(
                arr.map(function (a) {
                    return a.v;
                })
            );
            if (distinct.length < 2) return;
            issues.push({
                type: 'drift',
                severity: 'warning',
                project: project,
                deployment: null,
                text:
                    arr[0].name +
                    ': ' +
                    arr
                        .map(function (a) {
                            return a.dep + '-এ ' + a.v;
                        })
                        .join(', ')
            });
        });
        return issues;
    }

    P.analyzeProject = function (data, project) {
        var items = project.tech.map(function (r) {
            return P.evaluateRef(data, 'tech', r, null);
        });
        project.deployments.forEach(function (d) {
            d.stack.forEach(function (r) {
                items.push(P.evaluateRef(data, 'env', r, d.name));
            });
        });
        var status = 'unknown';
        items.forEach(function (x) {
            if (RANK[x.status] > RANK[status]) status = x.status;
        });
        var worst = items.filter(function (x) {
            return x.status === status;
        });
        var known = items.filter(function (x) {
            return x.days !== null;
        });
        var reason =
            status === 'unknown'
                ? items.length
                    ? 'কোনো অংশের তারিখ জানা নেই'
                    : 'কোনো ভার্সন যোগ করা হয়নি'
                : status === 'ok'
                  ? 'জানা সব অংশে সাপোর্ট আছে'
                  : P.unique(
                        worst.map(function (x) {
                            return x.label;
                        })
                    ).join(', ');
        return {
            project: project,
            items: items,
            status: status,
            reason: reason,
            soonest: known.length
                ? Math.min.apply(
                      null,
                      known.map(function (x) {
                          return x.days;
                      })
                  )
                : null,
            unknownCount: items.filter(function (x) {
                return x.status === 'unknown';
            }).length,
            issues: issuesFor(project, items)
        };
    };

    P.sortRows = function (rows) {
        return rows.slice().sort(function (a, b) {
            var d = RANK[b.status] - RANK[a.status];
            if (d) return d;
            var sa = a.soonest === null ? 1e9 : a.soonest;
            var sb = b.soonest === null ? 1e9 : b.soonest;
            return sa - sb || P.byName(a.project, b.project);
        });
    };

    // opts.includeArchived, opts.deployment (শুধু সেই environment-এর অংশ ধরা হবে)
    P.analyze = function (data, opts) {
        opts = opts || {};
        var projects = data.projects.filter(function (p) {
            return opts.includeArchived || p.lifecycle !== 'archived';
        });
        var rows = P.sortRows(
            projects.map(function (p) {
                if (!opts.deployment) return P.analyzeProject(data, p);
                var only = Object.assign({}, p, {
                    deployments: p.deployments.filter(function (d) {
                        return d.name === opts.deployment;
                    })
                });
                var r = P.analyzeProject(data, only);
                r.project = p;
                return r;
            })
        );
        var counts = {};
        P.STATUS_ORDER.forEach(function (s) {
            counts[s] = 0;
        });
        rows.forEach(function (r) {
            counts[r.status]++;
        });
        var issues = [];
        rows.forEach(function (r) {
            issues = issues.concat(r.issues);
        });
        return { rows: rows, counts: counts, issues: issues, total: rows.length };
    };

    // কোন প্রোডাক্টের কোন ভার্সন কয়টা প্রজেক্টে; key = kind|product|version
    P.usage = function (rows) {
        var map = {};
        rows.forEach(function (r) {
            r.items.forEach(function (x) {
                if (!x.cycle) return;
                var key = x.kind + '|' + x.product + '|' + x.cycle.version;
                var u = (map[key] = map[key] || {
                    key: key,
                    kind: x.kind,
                    product: x.product,
                    productName: x.productName,
                    version: x.cycle.version,
                    cycle: x.cycle,
                    status: x.status,
                    days: x.days,
                    end: x.end,
                    projects: [],
                    deployments: 0
                });
                if (u.projects.indexOf(r.project) === -1) u.projects.push(r.project);
                if (x.deployment) u.deployments++;
            });
        });
        return map;
    };

    P.usageCount = function (usage, kind, product, version) {
        var u = usage[kind + '|' + product + '|' + version];
        return u ? u.projects.length : 0;
    };

    // horizon দিনের মধ্যে শেষ হবে, বা শেষ হয়েও ব্যবহার হচ্ছে
    P.upcoming = function (rows, horizon) {
        var usage = P.usage(rows);
        return Object.keys(usage)
            .map(function (k) {
                return usage[k];
            })
            .filter(function (u) {
                return u.days !== null ? u.days <= horizon : u.status === 'eol';
            })
            .sort(function (a, b) {
                return (a.days === null ? -1e9 : a.days) - (b.days === null ? -1e9 : b.days);
            });
    };

    // ড্যাশবোর্ডের করণীয়: এখনই (সাপোর্ট শেষ, জরুরি, অসামঞ্জস্য) আর শিগগির (সতর্কতা, অমিল)
    P.todo = function (rows, settings) {
        var list = P.upcoming(rows, settings.yellowDays).map(function (u) {
            var ended = u.days === null || u.days < 0;
            return {
                type: 'version',
                level: u.status === 'warning' ? 'soon' : 'now',
                status: u.status,
                title: u.productName + ' ' + u.version + (ended ? '-এর সাপোর্ট শেষ' : '-এর সাপোর্ট শেষ হচ্ছে'),
                meta: u.days === null ? 'তারিখ জানা নেই' : ended ? P.fmtDate(u.end) + '-এ শেষ' : P.num(u.days) + ' দিন বাকি · ' + P.fmtDate(u.end),
                days: u.days === null ? -1e9 : u.days,
                projects: u.projects
            };
        });
        rows.forEach(function (r) {
            r.issues.forEach(function (i) {
                list.push({
                    type: i.type,
                    level: i.severity === 'critical' ? 'now' : 'soon',
                    status: i.severity,
                    title: i.type === 'requires' ? 'সামঞ্জস্য নেই' : 'environment-এ অমিল',
                    meta: '',
                    text: i.text,
                    days: 1e9,
                    projects: [r.project]
                });
            });
        });
        return list.sort(function (a, b) {
            return (a.level === b.level ? 0 : a.level === 'now' ? -1 : 1) || RANK[b.status] - RANK[a.status] || a.days - b.days;
        });
    };

    P.summaryText = function (a, settings) {
        if (!a.total) return 'এখনো কোনো প্রজেক্ট নেই।';
        var parts = [P.num(a.total) + 'টি প্রজেক্টের মধ্যে ' + P.num(a.counts.eol) + 'টিতে কোনো অংশের সাপোর্ট শেষ হয়ে গেছে, আর ' + P.num(a.counts.critical) + 'টিতে ' + P.num(settings.redDays) + ' দিনের মধ্যে শেষ হবে।'];
        var next = P.upcoming(a.rows, 36500).filter(function (u) {
            return u.days !== null && u.days >= 0;
        })[0];
        if (next) parts.push('সবচেয়ে আগে শেষ হচ্ছে ' + next.productName + ' ' + next.version + ' (' + P.fmtDate(next.end) + ', ' + P.num(next.days) + ' দিন বাকি)।');
        if (a.issues.length) parts.push(P.num(a.issues.length) + 'টি সামঞ্জস্য বা অমিলের সমস্যা আছে।');
        return parts.join(' ');
    };
})(PHD);
