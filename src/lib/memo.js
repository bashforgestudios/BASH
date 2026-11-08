// Tiny in-process TTL cache with request coalescing.
//   - Hits inside the TTL return the stored value with no work.
//   - Many requests arriving while the value is being computed share ONE computation
//     (prevents a "cache stampede" hitting the database N times at once).
//   - forget(prefix) drops entries after a write so changes show up straight away on this instance.
// On serverless hosts each warm instance has its own cache, so keep TTLs short and use it for reads
// where a few seconds of staleness is fine (listings, dashboards). Never use it for checks that
// enforce rules (quota, payment, auth).
const store = new Map(); // key -> { value, exp } | { promise }

export function memo(key, ttlMs, fn) {
    const hit = store.get(key);
    if (hit) {
        if (hit.promise) return hit.promise;
        if (hit.exp > Date.now()) return Promise.resolve(hit.value);
    }
    const promise = Promise.resolve()
        .then(fn)
        .then(
            (value) => {
                store.set(key, { value, exp: Date.now() + ttlMs });
                return value;
            },
            (err) => {
                store.delete(key); // never cache failures
                throw err;
            },
        );
    store.set(key, { promise });
    // keep the map from growing without bound (many distinct filter combinations)
    if (store.size > 500) {
        const now = Date.now();
        for (const [k, v] of store) if (!v.promise && v.exp <= now) store.delete(k);
        if (store.size > 500) store.delete(store.keys().next().value); // oldest insertion
    }
    return promise;
}

export function forget(prefix) {
    for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
