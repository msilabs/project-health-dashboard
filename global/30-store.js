/* ডেটা রাখা: localStorage-এ একটাই JSON। প্রথমবার খুললে public/seed/ থেকে শুরুর ডেটা আসে। */
(function (P) {
    var KEY = 'phd:data:v1';
    var UNDO_KEY = 'phd:undo:v1';
    var state = null;
    var ready = null;

    function read(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            /* ব্রাউজার জায়গা দিচ্ছে না; কিছু করার নেই */
        }
    }

    function emit(source) {
        if (typeof document === 'undefined') return;
        document.dispatchEvent(new CustomEvent('phd:change', { detail: { source: source } }));
    }

    function getJson(path) {
        return fetch(P.url(path)).then(function (res) {
            if (!res.ok) throw new Error('seed');
            return res.json();
        });
    }

    P.store = {
        KEY: KEY,

        // fork করা রিপোর public/seed/ ফাইলগুলোই প্রথমবারের ডেটা
        seed: function () {
            return Promise.all([getJson('/seed/catalog.json'), getJson('/seed/projects.json').catch(function () {
                return { projects: [] };
            })]).then(function (res) {
                var raw = Object.assign({}, res[1], { catalog: res[0].catalog || res[0] });
                if (!raw.projects) raw.projects = [];
                return P.stripMeta(P.normalizeData(raw));
            });
        },

        ready: function () {
            if (ready) return ready;
            var saved = read(KEY);
            if (saved) {
                try {
                    state = P.stripMeta(P.normalizeData(JSON.parse(saved)));
                    ready = Promise.resolve(state);
                    return ready;
                } catch (e) {
                    write('phd:broken', saved);
                }
            }
            ready = P.store
                .seed()
                .catch(function () {
                    return P.emptyData();
                })
                .then(function (seed) {
                    state = seed;
                    write(KEY, JSON.stringify(state));
                    return state;
                });
            return ready;
        },

        get: function () {
            return state;
        },

        // পুরো ডেটা বদল। ফেরত দেয় localStorage-এ লেখা গেল কিনা।
        save: function (next, source) {
            state = P.stripMeta(P.normalizeData(P.stripMeta(next)));
            var ok = write(KEY, JSON.stringify(state));
            if (!ok && P.ui) P.ui.toast('ব্রাউজারে সেভ করা গেল না। পেজ বন্ধ করার আগে JSON export করে রাখুন।', 'eol');
            emit(source || 'save');
            return ok;
        },

        update: function (fn, source) {
            var next = P.clone(state);
            fn(next);
            return P.store.save(next, source);
        },

        // বড় বদলের আগে আগের অবস্থা রেখে দেওয়া, যাতে এক ক্লিকে ফেরা যায়
        snapshot: function (label) {
            write(UNDO_KEY, JSON.stringify({ label: label, at: new Date().toISOString(), data: state }));
        },

        undoInfo: function () {
            try {
                var u = JSON.parse(read(UNDO_KEY));
                return u && u.data ? { label: u.label, at: u.at } : null;
            } catch (e) {
                return null;
            }
        },

        undo: function () {
            try {
                var u = JSON.parse(read(UNDO_KEY));
                if (!u || !u.data) return false;
                remove(UNDO_KEY);
                P.store.save(u.data, 'undo');
                return true;
            } catch (e) {
                return false;
            }
        },

        // বদল করে আগের অবস্থা রেখে দেয়
        apply: function (next, label) {
            P.store.snapshot(label);
            return P.store.save(next, 'apply');
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', function (e) {
            if (e.key !== KEY || !e.newValue) return;
            try {
                state = P.stripMeta(P.normalizeData(JSON.parse(e.newValue)));
                emit('other-tab');
            } catch (err) {
                /* অন্য ট্যাবের ভাঙা ডেটা উপেক্ষা */
            }
        });
    }
})(PHD);
