/* AI (ChatGPT, Claude, Gemini) দিয়ে কাজ: API key ছাড়া, প্রম্পট কপি আর উত্তর পেস্ট করে।
   তিনটা কাজ: তথ্য থেকে প্রজেক্ট, একটা প্রজেক্টের আপগ্রেড পরিকল্পনা, আর ম্যানেজমেন্ট রিপোর্ট।
   AI-কে কখনো রিপো, দায়িত্বে থাকা নাম বা নোট পাঠানো হয় না। */
(function (P) {
    P.AI_TASKS = {
        projects: { label: 'তথ্য থেকে প্রজেক্ট', returnsJson: true },
        plan: { label: 'আপগ্রেড পরিকল্পনা', returnsJson: false },
        report: { label: 'ম্যানেজমেন্ট রিপোর্ট', returnsJson: false }
    };

    // AI-এর উত্তর থেকে JSON: পুরোটা, ```json ব্লক, বা প্রথম { … } / [ … ]
    P.extractJson = function (text) {
        var s = String(text || '').trim();
        if (!s) throw new Error('no-json');
        try {
            return JSON.parse(s);
        } catch (e) {
            /* নিচের উপায়গুলো দেখা হবে */
        }
        var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fence) {
            try {
                return JSON.parse(fence[1].trim());
            } catch (e) {
                /* নিচে */
            }
        }
        var start = s.search(/[{[]/);
        var end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
        if (start !== -1 && end > start) {
            try {
                return JSON.parse(s.slice(start, end + 1));
            } catch (e) {
                /* নিচে */
            }
        }
        throw new Error('no-json');
    };

    // ধাপের নোট পাঠানো হয় না, শুধু ভার্সন আর তারিখ
    function upgradesDone(data, rows) {
        var out = [];
        rows.forEach(function (r) {
            P.upgradeJourney(data, r.project).forEach(function (t) {
                out.push({
                    project: r.project.name,
                    part: (t.where ? t.where + ': ' : '') + t.productName,
                    from: t.start.version,
                    to: t.current.version,
                    since: t.firstDate,
                    steps: t.steps.length,
                    statusIfNotUpgraded: t.start.status,
                    statusNow: t.current.status
                });
            });
        });
        return out;
    }

    function catalogIds(data, kind) {
        return data.catalog[kind]
            .map(function (p) {
                return p.id + ' (' + p.name + ')';
            })
            .join(', ');
    }

    function fence(text) {
        return '"""\n' + (String(text || '').trim() || '(এখানে আপনার তথ্য পেস্ট করুন)') + '\n"""';
    }

    function json(v) {
        return '```json\n' + JSON.stringify(v, null, 2) + '\n```';
    }

    var NO_SECRETS = '- Never include passwords, API keys, tokens, IP addresses, internal hostnames or any value from .env files except the database type.';

    P.aiPrompts = {
        projects: function (data, input) {
            return [
                'You are helping fill a software inventory. Convert the information below into JSON for a "project health" dashboard that tracks which framework and server versions each project uses.',
                '',
                'STRICT RULES:',
                '- Use only facts from my text. Never guess a version. If a version is not stated, use "".',
                '- Use the product ids from the catalog lists below whenever the product matches. If a product is not listed, use a short lowercase id such as "vite".',
                '- "tech" = frameworks and libraries used in the code (composer.json, package.json, requirements.txt …). Write the installed or locked version if given, otherwise the minimum of the constraint: "^11.0" -> "11.0", "v13.39.0" -> "13.39.0".',
                '- "deployments" = where the project runs (' + P.DEPLOYMENT_NAMES.join(', ') + ' …). "stack" lists the server software actually running there: runtime, database, web server, OS, cache.',
                '- A runtime constraint in composer.json ("php": "^8.2") or package.json "engines" is a requirement, not what the server runs. Do not put it in "stack"; mention it in "note" instead, unless my text says the server runs that version.',
                NO_SECRETS,
                '- If the same project appears more than once, merge it into one object.',
                '',
                'OUTPUT FORMAT:',
                '- Reply with ONLY one JSON object inside a single ```json code block. No explanation before or after.',
                '- Use exactly this structure:',
                '{ "projects": [ { "name": "", "tags": [], "lifecycle": "active", "tech": [{ "product": "laravel", "version": "11.0" }], "deployments": [{ "name": "production", "stack": [{ "product": "php", "version": "8.2" }] }], "note": "" } ] }',
                '- "lifecycle" is one of: active, archived.',
                '',
                'Tech catalog ids: ' + catalogIds(data, 'tech'),
                'Server software catalog ids: ' + catalogIds(data, 'env'),
                '',
                'MY INFORMATION:',
                fence(input)
            ].join('\n');
        },

        plan: function (data, input, opts) {
            var project = data.projects.filter(function (p) {
                return p.id === opts.project;
            })[0];
            if (!project) return '';
            var r = P.analyzeProject(data, project);
            var parts = r.items.map(function (x) {
                return {
                    kind: x.kind,
                    environment: x.deployment || undefined,
                    product: x.productName,
                    version: x.version,
                    status: x.status,
                    supportUntil: x.cycle ? x.cycle.supportUntil : '',
                    securityUntil: x.cycle ? x.cycle.securityUntil : '',
                    requires: x.cycle && x.cycle.requires.length ? P.formatRequires(x.cycle.requires) : undefined
                };
            });
            var newer = {};
            r.items.forEach(function (x) {
                var product = P.findProduct(data, x.kind, x.product);
                if (!product || newer[product.name]) return;
                newer[product.name] = product.versions
                    .filter(function (v) {
                        return P.cycleStatus(v, data.settings).status !== 'eol';
                    })
                    .map(function (v) {
                        return v.version + (v.securityUntil ? ' (security until ' + v.securityUntil + ')' : '') + (v.requires.length ? ' needs ' + P.formatRequires(v.requires) : '');
                    });
            });
            return [
                'You are a senior software and DevOps engineer. Write an upgrade plan for the project below.',
                'Write the answer in Bengali (বাংলা). Keep product names, versions, commands and technical terms in English.',
                '',
                'Today is ' + P.isoDate(P.today()) + '. Status meanings: eol = support already ended, critical = ends within ' + data.settings.redDays + ' days, warning = ends within ' + data.settings.yellowDays + ' days.',
                '',
                'PROJECT: ' + project.name + ' (' + project.lifecycle + ')',
                json(parts),
                r.issues.length ? 'PROBLEMS FOUND:\n' + r.issues.map(function (i) { return '- ' + i.text; }).join('\n') : 'PROBLEMS FOUND: none',
                '',
                'SUPPORTED VERSIONS AVAILABLE (only recommend from these):',
                json(newer),
                '',
                'WRITE:',
                '1. সারাংশ: কোন অংশ ঝুঁকিতে আর কবের মধ্যে।',
                '2. কোন ক্রমে আপগ্রেড করতে হবে আর কেন (সাপোর্ট শেষ হওয়াগুলো আগে; যেমন Laravel-এর আগে PHP)।',
                '3. প্রতিটা আপগ্রেডের জন্য: লক্ষ্য ভার্সন, আগে যা লাগবে, কোন জায়গায় ভাঙতে পারে তা দেখার তালিকা, টেস্ট, আর rollback।',
                '4. সময় আর ঝুঁকির মোটামুটি ধারণা।',
                '',
                'RULES: Do not invent dates or versions. If something needed for the plan is missing, say so clearly.',
                String(input || '').trim() ? '\nEXTRA CONTEXT FROM ME:\n' + fence(input) : ''
            ].join('\n');
        },

        report: function (data, input) {
            var a = P.analyze(data);
            var up = P.upcoming(a.rows, data.settings.yellowDays).map(function (u) {
                return { version: u.productName + ' ' + u.version, status: u.status, endsOn: u.end || 'ended', projects: u.projects.map(function (p) { return p.name; }) };
            });
            var summary = {
                today: P.isoDate(P.today()),
                projects: a.total,
                byStatus: a.counts,
                thresholds: { criticalDays: data.settings.redDays, warningDays: data.settings.yellowDays },
                endedOrEndingSoon: up,
                problems: a.issues.map(function (i) { return i.project.name + ': ' + i.text; }),
                partsWithUnknownStatus: a.rows.reduce(function (n, r) { return n + r.unknownCount; }, 0),
                upgradesDone: upgradesDone(data, a.rows)
            };
            return [
                'Write a short management report on the health of our software portfolio, using only the data below.',
                'Write it in Bengali (বাংলা). Audience: managers who are not developers. Keep product names and versions in English.',
                '',
                'DATA:',
                json(summary),
                '',
                'STRUCTURE:',
                '১. এক লাইনে সামগ্রিক অবস্থা।',
                '২. এখনই যা করা দরকার (সাপোর্ট শেষ বা জরুরি)।',
                '৩. আগামী ৩ মাস আর ১২ মাসের পরিকল্পনা।',
                '৪. যা আপগ্রেড হয়ে গেছে (upgradesDone থাকলে): শুরুর ভার্সন থেকে এখনকার ভার্সন, আর তাতে ঝুঁকি কতটা কমেছে।',
                '৫. ব্যবস্থা না নিলে ঝুঁকি কী (নিরাপত্তা, হোস্টিং, ক্লায়েন্ট)।',
                '৬. কোন তথ্য এখনো জানা নেই।',
                '',
                'RULES: Do not invent numbers, dates or projects. Keep it under 400 words.',
                String(input || '').trim() ? '\nEXTRA CONTEXT FROM ME:\n' + fence(input) : ''
            ].join('\n');
        }
    };

    // AI এমন ভার্সন লিখেছে যা ব্যবহারকারীর লেখায় নেই
    P.inventedVersions = function (incoming, sourceText) {
        var text = String(sourceText || '');
        var out = [];
        incoming.projects.forEach(function (p) {
            var refs = p.tech.map(function (r) { return { r: r, where: '' }; });
            p.deployments.forEach(function (d) {
                d.stack.forEach(function (r) { refs.push({ r: r, where: d.name }); });
            });
            refs.forEach(function (x) {
                var v = P.cleanVersion(x.r.version);
                if (!v || text.indexOf(v) !== -1) return;
                out.push(p.name + ': ' + x.r.product + ' ' + x.r.version + (x.where ? ' (' + x.where + ')' : ''));
            });
        });
        return out;
    };
})(PHD);
