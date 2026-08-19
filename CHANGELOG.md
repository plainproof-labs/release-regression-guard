# Changelog

All notable changes to Release Regression Guard are documented here.

## Offer-boundary correction - 2026-08-20

- Retire the fixed-scope human setup audit, its contact/payment launch adapter,
  and all customer-specific fulfillment artifacts.
- Keep the free Action runtime and its report contract unchanged.
- Remove the human audit offer from the public repository candidate. Existing
  immutable tags remain unchanged; the public default-branch description is
  corrected without claiming a sale or outcome.

## 1.1.0 - 2026-08-10

- Add an Action-owned, 200 KiB-bounded GitHub Job Summary without adding an
  installation step or a network request.
- Run positive, negative, exception, and unknown fixtures through the spawned
  Action entrypoint, checking exit codes, annotations, outputs, three report
  formats, summary content, and privacy canaries.
- Correct existing-rule parsing: RFC 9309 wildcard group and longest-match
  precedence, `none` as a `noindex` directive, document URL/`base` resolution,
  absolute same-origin sitemap entries outside comments, and invalid redirect
  locations as concrete redirect failures.
- Prevent comments and script/style/template text from creating false document
  facts; ambiguous JavaScript remains `unknown` rather than a guessed pass.
- Align report provenance with package version 1.1.0 and use the actual safe
  repository-relative manifest URI in SARIF.
- Reject literal whitespace/control characters in manifest paths. Existing
  manifests using them must percent-encode the URL path before upgrading.
- Clarify the copyable schema setup and add deterministic UNKNOWN and EXCEPTION
  report examples. Inputs, declared checks, and the target-only network
  boundary remain unchanged.

## 1.0.1 - 2026-08-08

- Declare the Node.js 24 Action runtime for current GitHub-hosted runners.

## 1.0.0 - 2026-08-08

- Add the manifest-driven JavaScript Action for declared critical URL checks.
- Emit stable JSON, SARIF 2.1.0, Markdown, and GitHub annotations.
- Preserve authentication, blocking, JavaScript ambiguity, transport, and
  temporary HTTP states as `unknown`.
- Add deterministic pass, fail, exception, and unknown fixtures plus local
  Action end-to-end verification.
- Add public installation, artifact retrieval, security, privacy, provenance,
  release, and Marketplace documentation.
