// Compatibility entry point. Robot guarding supersedes the earlier passive
// operator-death workload; the current isolated check also covers rail turns.
// Writes .local/expansion-runtime.json. Requires ISOLATED_TEST=1.
await import('./check-expansion-runtime.mjs');
