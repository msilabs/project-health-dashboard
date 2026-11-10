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
        report: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
        monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
        alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        unlink: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
        compare: '<path d="M7 4v16M17 4v16M3 8h8M13 16h8"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
        shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>'
    };

    ui.icon = function (name) {
        return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    };

    ui.badge = function (status, label) {
        return '<span class="badge s-' + status + '"><span class="dot"></span>' + esc(label || P.STATUS[status].label) + '</span>';
    };

    // নামের প্রথম অক্ষর (বাংলা যুক্তাক্ষরসহ ঠিকমতো কাটার জন্য Intl.Segmenter)
    var segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('bn', { granularity: 'grapheme' }) : null;
    function firstGrapheme(word) {
        if (!word) return '';
        if (segmenter) {
            var it = segmenter.segment(word)[Symbol.iterator]().next();
            return it.done ? '' : it.value.segment;
        }
        return word.charAt(0);
    }

    ui.avatar = function (name, cls) {
        var words = P.str(name).split(/[\s\-_.]+/).filter(Boolean);
        var text = words.length > 1 && /^[a-z0-9]/i.test(words[0]) ? firstGrapheme(words[0]) + firstGrapheme(words[1]) : firstGrapheme(words[0] || '?');
        return '<span class="avatar' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + esc(text.toUpperCase()) + '</span>';
    };

    // রিলিজ থেকে সাপোর্ট শেষ পর্যন্ত সময়ের কতটা পেরিয়েছে
    ui.lifebar = function (cycle, status) {
        var rel = P.parseDate(cycle.released);
        var end = P.parseDate(cycle.securityUntil || cycle.supportUntil);
        if (rel === null || end === null || end <= rel) return '';
        var pct = Math.max(2, Math.min(100, ((P.today() - rel) / (end - rel)) * 100));
        return '<div class="lifebar s-' + status + '" data-tip="সাপোর্টের সময়ের ' + P.num(Math.round(pct)) + '% পেরিয়েছে"><span style="width: ' + pct.toFixed(1) + '%"></span></div>';
    };

    // প্রজেক্টের একটা অংশের সারি: নাম আর ভার্সন বাঁয়ে, অবস্থা ডানে, নিচে সাপোর্টের সময়
    ui.part = function (item, fix) {
        var right =
            item.status === 'ok'
                ? '<span class="small muted">' + (item.end ? P.fmtDate(item.end) + ' পর্যন্ত' : esc(item.text)) + '</span>'
                : ui.badge(item.status, item.status === 'unknown' ? item.text : item.days !== null && item.days >= 0 ? P.num(item.days) + ' দিন বাকি' : P.STATUS[item.status].label);
        var left = item.phase ? P.PHASE[item.phase] : '';
        if (fix) left += (left ? ' · ' : '') + fix;
        var date = item.status !== 'ok' && item.end ? (item.days < 0 ? P.fmtDate(item.end) + '-এ শেষ' : P.fmtDate(item.end) + ' পর্যন্ত') : '';
        return (
            '<div class="part"><span class="part-name"><span class="dot s-' + item.status + '"></span>' + esc(item.label) + '</span>' + right +
            (item.cycle ? ui.lifebar(item.cycle, item.status) : '') +
            (left || date ? '<span class="part-note"><span>' + left + '</span><span>' + esc(date) + '</span></span>' : '') +
            '</div>'
        );
    };

    /* ---------- থিম ---------- */

    ui.getTheme = function () {
        try {
            var t = localStorage.getItem('phd:theme');
            return t === 'light' || t === 'dark' ? t : 'system';
        } catch (e) {
            return 'system';
        }
    };

    ui.setTheme = function (mode) {
        try {
            if (mode === 'light' || mode === 'dark') localStorage.setItem('phd:theme', mode);
            else localStorage.removeItem('phd:theme');
        } catch (e) {
            /* ব্রাউজার জায়গা না দিলে শুধু এই পেজে থাকবে */
        }
        if (mode === 'light' || mode === 'dark') document.documentElement.dataset.theme = mode;
        else delete document.documentElement.dataset.theme;
        ui.$$('[data-theme-set]').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.dataset.themeSet === mode));
        });
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

    // ফর্মে লেখা নাম বা id থেকে ক্যাটালগের প্রোডাক্ট; না মিললে null
    ui.findProductByText = function (data, kind, text) {
        var id = P.slug(text);
        var name = P.str(text).toLowerCase();
        return (
            data.catalog[kind].filter(function (p) {
                return p.id === id || p.name.toLowerCase() === name;
            })[0] || null
        );
    };

    ui.datalists = function (data) {
        var out = '';
        P.KINDS.forEach(function (kind) {
            out += '<datalist id="dl-products-' + kind + '">';
            data.catalog[kind].forEach(function (p) {
                out += '<option value="' + esc(p.name) + '"></option>';
            });
            out += '</datalist>';
            data.catalog[kind].forEach(function (p) {
                out += '<datalist id="dl-' + kind + '-' + esc(p.id) + '">';
                p.versions.forEach(function (v) {
                    out += '<option value="' + esc(v.version) + '"></option>';
                });
                out += '</datalist>';
            });
        });
        out += '<datalist id="dl-deployments">';
        P.deploymentNames(data).forEach(function (n) {
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
            part('সার্ভার প্রোডাক্ট', d.env) +
            part('সার্ভার ভার্সন', d.envVersions) +
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
        return { html: html ? '<ul class="plain-list">' + html + '</ul>' : '<p>কিছুই বদলাবে না।</p>', empty: !html };
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

    // নিজের confirm: Promise ফেরত দেয়, হ্যাঁ হলে true। খোলা dialog-এর উপরেও খোলে।
    ui.confirm = function (message, okLabel) {
        return new Promise(function (resolve) {
            var d = document.createElement('dialog');
            d.className = 'modal confirm';
            d.innerHTML =
                '<div class="confirm-body"><span class="chip-icon s-eol">' + ui.icon('alert') + '</span><p>' + esc(message) + '</p></div>' +
                '<div class="sheet-foot"><span></span><span class="row"><button class="btn" type="button" data-no>বাতিল</button>' +
                '<button class="btn btn-primary btn-danger-solid" type="button" data-yes>' + esc(okLabel || 'হ্যাঁ, করুন') + '</button></span></div>';
            document.body.appendChild(d);
            d.addEventListener('click', function (e) {
                if (e.target.closest('[data-yes]')) d.close('yes');
                else if (e.target === d || e.target.closest('[data-no]')) d.close('');
            });
            d.addEventListener('close', function () {
                d.remove();
                resolve(d.returnValue === 'yes');
            });
            d.showModal();
            d.querySelector('[data-no]').focus();
        });
    };

    // data-tip="…" থাকা যেকোনো এলিমেন্টের জন্য ছোট tooltip; মাউসে hover, টাচে ট্যাপ
    function initTips() {
        var tip = document.createElement('div');
        tip.className = 'tip';
        tip.hidden = true;
        var current = null;

        function place(x, y) {
            var pad = 8;
            var w = tip.offsetWidth;
            var h = tip.offsetHeight;
            var left = Math.min(Math.max(pad, x + 12), window.innerWidth - w - pad);
            var top = y + 16 + h > window.innerHeight - pad ? y - h - 10 : y + 16;
            tip.style.left = left + 'px';
            tip.style.top = Math.max(pad, top) + 'px';
        }

        function show(el, x, y) {
            current = el;
            tip.textContent = el.getAttribute('data-tip');
            // খোলা dialog-এর ভেতরে না রাখলে tooltip তার নিচে চাপা পড়ে
            var host = el.closest('dialog[open]') || document.body;
            if (tip.parentNode !== host) host.appendChild(tip);
            tip.hidden = false;
            place(x, y);
        }

        function hide() {
            current = null;
            tip.hidden = true;
        }

        document.addEventListener('pointermove', function (e) {
            if (e.pointerType === 'touch') return;
            var el = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (!el) return current && hide();
            if (el !== current) show(el, e.clientX, e.clientY);
            else place(e.clientX, e.clientY);
        });
        document.addEventListener('pointerdown', function (e) {
            if (e.pointerType !== 'touch') return hide();
            var el = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (el && el !== current) show(el, e.clientX, e.clientY);
            else hide();
        });
        document.addEventListener('scroll', hide, true);
        document.addEventListener('keydown', hide);
    }

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
        var app = ui.$('#app');
        var bar = ui.$('#sample-bar');
        function update() {
            var d = P.store.get();
            if (!d) return;
            if (bar) bar.hidden = !(d.meta.sample && d.projects.length);
            var counts = {
                projects: d.projects.filter(function (p) { return p.lifecycle !== 'archived'; }).length,
                catalog: d.catalog.tech.length + d.catalog.env.length
            };
            ui.$$('[data-count]').forEach(function (el) {
                var n = counts[el.dataset.count];
                el.textContent = n === undefined ? '' : P.num(n);
            });
        }
        P.store.ready().then(update);
        ui.onChange(update);
        ui.setTheme(ui.getTheme());
        initTips();

        var mod = ui.$('#kbd-mod');
        if (mod && !/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) mod.textContent = 'Ctrl';

        function closeNav() {
            if (app) app.classList.toggle('nav-open', false);
        }

        document.addEventListener('click', function (e) {
            var link = e.target.closest('[data-open-project]');
            if (link && ui.openProject && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                ui.openProject(link.dataset.openProject);
            }
            var t = e.target.closest('[data-theme-set]');
            if (t) ui.setTheme(t.dataset.themeSet);
        });

        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (ui.openSearch && !document.querySelector('dialog[open]')) ui.openSearch();
            } else if (e.key === 'Escape') {
                closeNav();
            }
        });

        var actions = {
            data: function () { ui.openImport('file'); },
            import: function () { ui.openImport('file'); },
            ai: function () { ui.openImport('ai'); },
            json: ui.exportJson,
            csv: ui.exportCsv,
            settings: function () { ui.openSettings(); },
            search: function () { ui.openSearch(); },
            'new-project': function () { ui.openProject(null); },
            'nav-open': function () { if (app) app.classList.toggle('nav-open', true); },
            'nav-close': closeNav,
            undo: function () {
                if (P.store.undo()) ui.toast('আগের অবস্থায় ফেরানো হয়েছে।');
            },
            'sample-clear': function () {
                var next = P.clone(P.store.get());
                next.projects = [];
                next.meta.sample = false;
                P.store.apply(next, 'নমুনা মুছে ফেলা');
                ui.undoToast('নমুনা প্রজেক্ট মুছে ফেলা হয়েছে।');
            }
        };
        document.addEventListener('click', function (e) {
            var b = e.target.closest('[data-action]');
            if (!b || !actions[b.dataset.action]) return;
            if (b.closest('.sidebar')) closeNav();
            actions[b.dataset.action]();
        });
    };
})(PHD);
