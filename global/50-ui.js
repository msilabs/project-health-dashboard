/* DOM-এর সাধারণ সাহায্যকারী: পিল, ভার্সন চিপ, টোস্ট, ফাইল, URL কোয়েরি */
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

    ui.pill = function (status, label) {
        return '<span class="pill s-' + status + '"><span class="dot s-' + status + '"></span>' + esc(label || P.STATUS[status].label) + '</span>';
    };

    // প্রজেক্টের একটা অংশ, যেমন "PHP 8.2 · ৫১ দিন বাকি"
    ui.ver = function (item, opts) {
        opts = opts || {};
        var title = item.label + ': ' + item.text + (item.phase ? ' · ' + P.PHASE[item.phase] : '');
        var label = opts.short && item.cycle ? item.productName + ' ' + item.cycle.version : item.label;
        if (!item.version && item.reason === 'no-version') label = item.productName;
        return (
            '<span class="ver s-' + item.status + '" title="' + esc(title) + '"><b>' + esc(label) + '</b>' +
            (opts.text === false ? '' : '<small>' + esc(item.text) + '</small>') +
            '</span>'
        );
    };

    ui.toast = function (message, status, action) {
        var box = ui.$('#toasts');
        if (!box) return;
        var el = document.createElement('div');
        el.className = 'toast s-' + (status || 'ok');
        el.innerHTML = '<span>' + esc(message) + '</span>';
        if (action) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-small';
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
        }, action ? 9000 : 4500);
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
        return out + '</datalist>';
    };

    ui.projectLink = function (p) {
        return '<a href="' + esc(P.url('/projects/?edit=' + encodeURIComponent(p.id))) + '">' + esc(p.name) + '</a>';
    };

    ui.projectNames = function (projects, max) {
        max = max || 4;
        var shown = projects.slice(0, max).map(ui.projectLink).join(', ');
        return shown + (projects.length > max ? ' আরও ' + P.num(projects.length - max) + 'টি' : '');
    };

    // import বা AI-এর ডেটা বসানোর আগে কী কী বদলাবে
    ui.diffHtml = function (before, after) {
        var d = P.diffData(before, after);
        function part(label, c, unit) {
            var bits = [];
            if (c.added) bits.push('নতুন ' + P.num(c.added) + 'টি');
            if (c.changed) bits.push('বদলাবে ' + P.num(c.changed) + 'টি');
            if (c.removed) bits.push('<b>মুছে যাবে ' + P.num(c.removed) + 'টি</b>');
            return bits.length ? '<li>' + label + (unit ? ' ' + unit : '') + ': ' + bits.join(', ') + '</li>' : '';
        }
        var html =
            part('প্রজেক্ট', d.projects, '') +
            part('টেক ক্যাটালগ', d.tech, 'প্রোডাক্ট') +
            part('টেক ক্যাটালগ', d.techVersions, 'ভার্সন') +
            part('এনভায়রনমেন্ট ক্যাটালগ', d.env, 'প্রোডাক্ট') +
            part('এনভায়রনমেন্ট ক্যাটালগ', d.envVersions, 'ভার্সন') +
            (d.settings ? '<li>সেটিংস বদলাবে</li>' : '');
        var before_ = {};
        before.projects.forEach(function (p) {
            before_[p.id] = JSON.stringify(p);
        });
        var touched = after.projects.filter(function (p) {
            return before_[p.id] !== JSON.stringify(p);
        });
        if (touched.length) {
            html += '<li class="muted">' + touched.slice(0, 10).map(function (p) {
                return esc(p.name) + (before_[p.id] ? '' : ' (নতুন)');
            }).join(', ') + (touched.length > 10 ? ' আরও ' + P.num(touched.length - 10) + 'টি' : '') + '</li>';
        }
        return { html: html ? '<ul style="margin: 0; padding-left: 1.2rem">' + html + '</ul>' : '<p>কিছুই বদলাবে না।</p>', empty: !html };
    };

    ui.importError = function (err) {
        var m = err && err.message;
        if (m === 'no-json') return 'লেখার মধ্যে JSON পাওয়া যায়নি। পুরো উত্তর বা পুরো ফাইল পেস্ট করুন।';
        if (m === 'newer-schema') return 'এই ফাইল এই টুলের নতুন কোনো ভার্সনে বানানো। পেজটা রিফ্রেশ করে আবার চেষ্টা করুন।';
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
            var items = r.items.length ? r.items : [null];
            items.forEach(function (x) {
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

    ui.dateInput = function (name, value) {
        return '<input type="date" name="' + name + '" value="' + esc(value) + '">';
    };

    ui.initLayout = function () {
        var banner = ui.$('#sample-banner');
        function update() {
            var d = P.store.get();
            if (banner) banner.hidden = !(d && d.meta.sample && d.projects.length);
        }
        P.store.ready().then(update);
        ui.onChange(update);
        var clear = ui.$('#sample-clear');
        if (clear) {
            clear.addEventListener('click', function () {
                if (!confirm('নমুনা প্রজেক্টগুলো মুছে যাবে। ক্যাটালগ থাকবে। চালিয়ে যাবেন?')) return;
                var next = P.clone(P.store.get());
                next.projects = [];
                next.meta.sample = false;
                P.store.apply(next, 'নমুনা মুছে ফেলা');
                ui.undoToast('নমুনা প্রজেক্ট মুছে ফেলা হয়েছে।');
            });
        }
    };
})(PHD);
