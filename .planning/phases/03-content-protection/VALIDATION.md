wave_0: ["03-01", "03-02", "03-03", "03-05"]
wave_1: ["03-04"]
wave_0_complete: false
wave_1_complete: false
nyquist_compliant: true
req_coverage:
  PROT-01: "03-01 (verification in tests — ContentProtection.tsx existing contextmenu listener is preserved; no regression introduced)"
  PROT-02: "03-01 (verification in tests — ContentProtection.tsx existing selectstart/copy listeners are preserved; no regression introduced)"
  PROT-03: "03-01 (verification in tests — ContentProtection.tsx existing beforeprint listener and @media print CSS are preserved; no regression introduced)"
  PROT-04: "03-03"
  PROT-05: "03-01 (Task 1: ScreenshotDetection.tsx role gate fixed from isMember to protected prop from spaceAbility)"
  PROT-06: "03-01 (Task 2: dev tools setInterval removed from ContentProtectionAlways.tsx)"
  PROT-V2-01: "03-02"
  PROT-V2-02: "03-04"

gap_closure:
  - plan: "03-05"
    gaps_addressed:
      - "React Rules of Hooks violations in ContentProtection.tsx and content-security.tsx"
      - "API response field mismatch in ScreenshotDetection.tsx (response.data.attemptCount -> response.data.status.attemptCount)"
    source: "03-VERIFICATION.md"

notes:
  - "03-04 depends on 03-02 because it consumes GET /api/security/violations and POST /api/security/reinstate/:userId endpoints"
  - "03-01, 03-02, 03-03 have no inter-dependencies — all three can execute in parallel in Wave 0"
  - "03-05 is a gap closure plan fixing 2 verification gaps — no dependencies, Wave 0"
  - "PROT-01, PROT-02, PROT-03 are verified via 03-01 tests confirming ContentProtection.tsx event listeners are not removed during the logProtectionAttempt cleanup (Task 3 of 03-01)"
  - "All plans have Nyquist tests: 03-01 has ScreenshotDetection.test.tsx + ContentProtectionAlways.test.tsx, 03-02 has screenshot-detection.service.spec.ts, 03-03 has ContentProtection.test.tsx, 03-04 has content-security.test.tsx"
