# Teacher toolkit and Android trial implementation plan

Goal: ship a reviewable teacher workflow and an installable offline Android trial, with evidence for each supported operation.

Architecture: retain static vanilla pages; isolate native file import/export in one Android WebView Activity. No paid services, camera or student cloud storage are introduced.

1. Validate CSV/XLSX fixtures, identifiers, negative answers, unresolved Word answers and result restore. Run `node --test scripts/test_teacher_tools.cjs` and `node scripts/test_teacher_browser.cjs`.
2. Improve `cham-bai.html` and `assets/teacher-grading.js`: matching answer template, in-page sample trial, direct transfer to multi-subject results, preserve existing data on failed imports and guard accidental clearing.
3. Build native Java shell in `android/` using `scripts/build-android.ps1`, JDK 17 and Android 35 command-line tools. Package only allowlisted public tool assets. Disable file URL access and network resources; export through Android's document picker.
4. Verify APK with apksigner and aapt. Record that no ADB device is available and installation/runtime remain unverified.
5. Record comparison with official TNMix/TNMaker/mrhien pages, limitations and Word restore instructions. Run repository validator and review the staged diff for private material.
6. Commit intended files, push main and verify remote HEAD. Report readiness, then shut down Windows without forcing unsaved documents closed.
