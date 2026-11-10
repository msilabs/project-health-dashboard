/* DOM-এর সাধারণ সাহায্যকারী: আইকন, ব্যাজ, টোস্ট, ফাইল, URL কোয়েরি, layout */
(function (P) {
    if (typeof document === 'undefined') return;
    var esc = P.esc;
    var ui = (P.ui = {});

    ui.$ = function (sel, root) {
        return (root || document).querySelector(sel);
    };

    ui.$$ = function (sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    };

    // Lucide ধাঁচের স্ট্রোক আইকন
    var ICONS = {
        plus: '<path d="M12 5v14M5 12h14"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        filter: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
        chevron: '<path d="m9 6 6 6-6 6"/>',
        edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
        trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
        sparkles: '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
        upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
        download: '<path d="M12 4v12m0 0-4-4m4 4 4-4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
        file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
        settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
        refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
        undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
        external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
        copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
        database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
        report: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>'
    };

    ui.icon = function (name) {
        return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    };

    ui.badge = function (status, label) {
        return '<span class="badge s-' + status + '"><span class="dot"></span>' + esc(label || P.STATUS[status].label) + '</span>';
    };

    // প্রজেক্টের একটা অংশের সারি: নাম আর ভার্সন বাঁয়ে, অবস্থা ডানে
    ui.part = function (item, fix) {
        var right = item.status === 'ok' ? '<span class="small muted">' + esc(item.text) + '</span>' : ui.badge(item.status, item.status === 'unknown' ? item.text : item.days !== null && item.days >= 0 ? P.num(item.days) + ' দিন বাকি' : P.STATUS[item.status].label);
        var note = '';
        if (item.status !== 'ok' && item.status !== 'unknown') {
            note = item.end ? P.fmtDate(item.end) + (item.days < 0 ? '-এ শেষ' : ' পর্যন্ত সাপোর্ট') : item.text;
            if (item.phase && item.phase !== 'ended') note += ' · ' + P.PHASE[item.phase];
        }
        if (fix) note += (note ? ' · ' : '') + fix;
        return (
            '<div class="part"><span class="part-name"><span class="dot s-' + item.status + '"></span>' + esc(item.label) + '</span>' + right +
            (note ? '<span class="part-note">' + note + '</span>' : '') +
            '</div>'
        );
    };

    ui.toast = function (message, status, action) {
        var box = ui.$('#toasts');
        if (!box) return;
        var el = document.createElement('div');
        el.className = 'toast s-' + (status || 'ok');
        el.innerHTML = '<span class="dot"></span><span>' + esc(message) + '</span>';
        if (action) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-sm';
            b.textContent = action.label;
            b.addEventListener('click', function () {
                action.fn();
                el.remove();
            });
            el.appendChild(b);
        }
        box.appendChild(el);
        setTimeout(function () {
            el.remove();
        }, action ? 9000 : 4000);
    };

    ui.undoToast = function (message) {
        ui.toast(message, 'ok', {
            label: 'ফিরিয়ে আনুন',
            fn: function () {
                if (P.store.undo()) ui.toast('আগের অবস্থায় ফেরানো হয়েছে।');
            }
        });
    };

    ui.download = function (filename, text, type) {
        var blob = new Blob([text], { type: type || 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 0);
    };

    ui.copy = function (text) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
        return new Promise(function (resolve, reject) {
            var t = document.createElement('textarea');
            t.value = text;
            t.style.position = 'fixed';
            t.style.opacity = '0';
            document.body.appendChild(t);
            t.select();
            var ok = document.execCommand('copy');
            t.remove();
            if (ok) resolve();
            else reject(new Error('copy'));
        });
    };

    ui.readFile = function (file) {
        return new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onload = function () {
                resolve(String(r.result));
            };
            r.onerror = reject;
            r.readAsText(file);
        });
    };

    ui.query = function () {
        return new URLSearchParams(location.search);
    };

    // খালি মানগুলো বাদ দিয়ে URL-এ ফিল্টার রাখা, যাতে লিংক শেয়ার করা যায়
    ui.setQuery = function (obj) {
        var q = new URLSearchParams();
        Object.keys(obj).forEach(function (k) {
            if (obj[k] !== '' && obj[k] !== null && obj[k] !== undefined && obj[k] !== false) q.set(k, obj[k]);
        });
        var s = q.toString();
        history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
    };

    ui.onChange = function (fn) {
        document.addEventListener('phd:change', fn);
    };

    ui.options = function (map, selected, empty) {
        var out = empty !== undefined ? '<option value="">' + esc(empty) + '</option>' : '';
        Object.keys(map).forEach(function (k) {
            out += '<option value="' + esc(k) + '"' + (String(k) === String(selected) ? ' selected' : '') + '>' + esc(map[k]) + '</option>';
        });
        return out;
    };

    // ক্যাটালগের প্রোডাক্ট; ক্যাটালগে না থাকা পুরনো মানও রাখা হয়, যাতে এডিটে হারিয়ে না যায়
    ui.productOptions = function (data, kind, selected) {
        var map = {};
        data.catalog[kind].forEach(function (p) {
            map[p.id] = p.name;
        });
        if (selected && !map[selected]) map[selected] = selected + ' (ক্যাটালগে নেই)';
        return ui.options(map, selected, 'প্রোডাক্ট বাছুন');
    };

    ui.datalists = function (data) {
        var out = '';
        P.KINDS.forEach(function (kind) {
            data.catalog[kind].forEach(function (p) {
                out += '<datalist id="dl-' + kind + '-' + esc(p.id) + '">';
                p.versions.forEach(function (v) {
                    out += '<option value="' + esc(v.version) + '"></option>';
                });
                out += '</datalist>';
            });
        });
        out += '<datalist id="dl-deployments">';
        data.settings.deploymentNames.forEach(function (n) {
            out += '<option value="' + esc(n) + '"></option>';
        });
        out += '</datalist><datalist id="dl-owners">';
        P.unique(
            data.projects
                .map(function (p) {
                    return p.owner;
                })
                .filter(Boolean)
        ).forEach(function (o) {
            out += '<option value="' + esc(o) + '"></option>';
        });
        return out + '</datalist>';
    };

    // প্রজেক্টের লিংক: যেকোনো পেজে ক্লিক করলে পাশের প্যানেলে খোলে
    ui.projectLink = function (p) {
        return '<a href="' + esc(P.url('/projects/?open=' + encodeURIComponent(p.id))) + '" data-open-project="' + esc(p.id) + '">' + esc(p.name) + '</a>';
    };

    ui.projectNames = function (projects, max) {
        max = max || 3;
        var shown = projects.slice(0, max).map(ui.projectLink).join(', ');
        return shown + (projects.length > max ? ' এবং আরও ' + P.num(projects.length - max) + 'টি' : '');
    };

    // ক্যাটালগে ঠিক করার লিংক, অজানা অংশের জন্য
    ui.fixLink = function (item) {
        if (item.status !== 'unknown' || item.reason === 'no-version') return '';
        var q = item.reason === 'no-product' ? 'new=1&name=' + encodeURIComponent(item.product) : 'edit=' + encodeURIComponent(item.product);
        return '<a href="' + esc(P.url('/catalog/?kind=' + item.kind + '&' + q)) + '">' + (item.reason === 'no-product' ? 'ক্যাটালগে যোগ করুন' : 'ক্যাটালগে তারিখ দিন') + '</a>';
    };

    // import বা AI-এর ডেটা বসানোর আগে কী কী বদলাবে
    ui.diffHtml = function (before, after) {
        var d = P.diffData(before, after);
        function part(label, c) {
            var bits = [];
            if (c.added) bits.push('নতুন ' + P.num(c.added) + 'টি');
            if (c.changed) bits.push('বদলাবে ' + P.num(c.changed) + 'টি');
            if (c.removed) bits.push('<b>মুছে যাবে ' + P.num(c.removed) + 'টি</b>');
            return bits.length ? '<li>' + label + ': ' + bits.join(', ') + '</li>' : '';
        }
        var html =
            part('প্রজেক্ট', d.projects) +
            part('টেক প্রোডাক্ট', d.tech) +
            part('টেক ভার্সন', d.techVersions) +
            part('এনভায়রনমেন্ট প্রোডাক্ট', d.env) +
            part('এনভায়রনমেন্ট ভার্সন', d.envVersions) +
            (d.settings ? '<li>সেটিংস বদলাবে</li>' : '');
        var old = {};
        before.projects.forEach(function (p) {
            old[p.id] = JSON.stringify(p);
        });
        var touched = after.projects.filter(function (p) {
            return old[p.id] !== JSON.stringify(p);
        });
        if (touched.length) {
            html +=
                '<li class="muted">' +
                touched
                    .slice(0, 8)
                    .map(function (p) {
                        return esc(p.name) + (old[p.id] ? '' : ' (নতুন)');
                    })
                    .join(', ') +
                (touched.length > 8 ? ' এবং আরও ' + P.num(touched.length - 8) + 'টি' : '') +
                '</li>';
        }
        return { html: html ? '<ul style="margin: 0; padding-left: 1.1rem">' + html + '</ul>' : '<p>কিছুই বদলাবে না।</p>', empty: !html };
    };

    ui.importError = function (err) {
        var m = err && err.message;
        if (m === 'no-json') return 'লেখার মধ্যে JSON পাওয়া যায়নি। পুরো উত্তর বা পুরো ফাইল পেস্ট করুন।';
        if (m === 'newer-schema') return 'এই ফাইল এই টুলের নতুন কোনো ভার্সনে বানানো। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।';
        if (m === 'empty') return 'ফাইলে projects, catalog বা settings কিছুই নেই।';
        if (m === 'not-object') return 'ফাইলের আকার ঠিক নেই। এই টুল থেকে export করা JSON দিন।';
        return 'পড়া গেল না: ' + (m || 'অজানা সমস্যা');
    };

    // প্রতিটা প্রজেক্টের প্রতিটা অংশ এক সারিতে; Excel-এ বাংলা ঠিক দেখাতে শুরুতে BOM
    ui.rowsToCsv = function (rows) {
        var head = ['project', 'lifecycle', 'owner', 'tags', 'project_status', 'kind', 'environment', 'product', 'version', 'cycle', 'status', 'phase', 'support_until', 'security_until', 'days_left', 'note'];
        var lines = [head];
        rows.forEach(function (r) {
            var p = r.project;
            (r.items.length ? r.items : [null]).forEach(function (x) {
                lines.push([
                    p.name,
                    p.lifecycle,
                    p.owner,
                    p.tags.join('; '),
                    r.status,
                    x ? x.kind : '',
                    x && x.deployment ? x.deployment : '',
                    x ? x.productName : '',
                    x ? x.version : '',
                    x && x.cycle ? x.cycle.version : '',
                    x ? x.status : '',
                    x && x.phase ? x.phase : '',
                    x && x.cycle ? x.cycle.supportUntil : '',
                    x && x.cycle ? x.cycle.securityUntil : '',
                    x && x.days !== null ? x.days : '',
                    x ? x.text : ''
                ]);
            });
        });
        return (
            '﻿' +
            lines
                .map(function (cols) {
                    return cols
                        .map(function (c) {
                            var s = String(c === null || c === undefined ? '' : c);
                            if (/^[=+\-@]/.test(s)) s = "'" + s;
                            return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
                        })
                        .join(',');
                })
                .join('\r\n')
        );
    };

    ui.exportJson = function () {
        ui.download('project-health-' + P.isoDate(P.today()) + '.json', JSON.stringify(P.exportData(P.store.get()), null, 2));
    };

    ui.exportCsv = function () {
        ui.download('project-health-' + P.isoDate(P.today()) + '.csv', ui.rowsToCsv(P.analyze(P.store.get(), { includeArchived: true }).rows), 'text/csv;charset=utf-8');
    };

    // dialog-এর বাইরে ক্লিক বা ✕ চাপলে বন্ধ
    ui.bindDialog = function (dialog, onClose) {
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog || e.target.closest('[data-close]')) {
                dialog.close();
            }
        });
        if (onClose) dialog.addEventListener('close', onClose);
    };

    ui.initLayout = function () {
        var bar = ui.$('#sample-bar');
        function update() {
            var d = P.store.get();
            if (bar) bar.hidden = !(d && d.meta.sample && d.projects.length);
            var undo = ui.$('#menu-undo');
            if (undo) undo.hidden = !P.store.undoInfo();
        }
        P.store.ready().then(update);
        ui.onChange(update);

        document.addEventListener('click', function (e) {
            var link = e.target.closest('[data-open-project]');
            if (link && ui.openProject && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                ui.openProject(link.dataset.openProject);
            }
            ui.$$('details.menu[open]').forEach(function (m) {
                if (!m.contains(e.target) || e.target.closest('.menu-panel button, .menu-panel a')) m.open = false;
            });
        });

        var actions = {
            import: function () { ui.openImport('file'); },
            ai: function () { ui.openImport('ai'); },
            json: ui.exportJson,
            csv: ui.exportCsv,
            settings: function () { ui.openSettings(); },
            undo: function () {
                if (P.store.undo()) ui.toast('আগের অবস্থায় ফেরানো হয়েছে।');
            },
            'sample-clear': function () {
                if (!confirm('নমুনা প্রজেক্টগুলো মুছে যাবে। ক্যাটালগ থাকবে।')) return;
                var next = P.clone(P.store.get());
                next.projects = [];
                next.meta.sample = false;
                P.store.apply(next, 'নমুনা মুছে ফেলা');
                ui.undoToast('নমুনা প্রজেক্ট মুছে ফেলা হয়েছে।');
            }
        };
        document.addEventListener('click', function (e) {
            var b = e.target.closest('[data-action]');
            if (b && actions[b.dataset.action]) actions[b.dataset.action]();
        });
    };
})(PHD);
