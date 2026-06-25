#!/usr/bin/env node
// Build-time guard. Runs as `eas-build-pre-install` so it fires on every EAS
// build right after env vars are loaded, but before any JS is bundled.
// Goal: make it impossible to ship an APK/IPA missing critical EXPO_PUBLIC_*
// keys. A failing check here aborts the build with a clear remediation hint,
// which is far better than discovering the missing key after install.

const REQUIRED = [
  {
    name: 'EXPO_PUBLIC_GEMINI_API_KEY',
    purpose: 'Powers the Ask AyahOne tab (Google Gemini).',
  },
];

const profile = process.env.EAS_BUILD_PROFILE || 'unknown';
const isEas = process.env.EAS_BUILD === 'true';
// On developer laptops we don't want this to block `npm install`; only
// enforce when the build is running on EAS, where the consequence is a
// broken release artifact.
if (!isEas) {
  process.exit(0);
}

const missing = REQUIRED.filter(v => !process.env[v.name]);
if (missing.length === 0) {
  console.log(`[check-build-env] All required env vars present for "${profile}".`);
  process.exit(0);
}

console.error('');
console.error('==============================================================');
console.error(`  Missing required env var(s) for EAS profile "${profile}":`);
for (const v of missing) {
  console.error(`    - ${v.name}  (${v.purpose})`);
}
console.error('');
console.error('  Fix:');
for (const v of missing) {
  console.error(
    `    eas env:create --environment ${profile} --name ${v.name} \\`
  );
  console.error('        --value <YOUR_VALUE> --visibility sensitive --type string');
}
console.error('');
console.error(`  Then re-run: eas build --profile ${profile} --platform android`);
console.error('==============================================================');
console.error('');
process.exit(1);
