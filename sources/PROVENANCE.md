# Schema and implementation provenance

Checked: 2026-08-08

The implementation is dependency-free and does not copy a third-party crawler.
Its public contracts are grounded in the following primary specifications and
platform documentation:

- JSON Schema Draft 2020-12: <https://json-schema.org/draft/2020-12>
- HTTP Semantics (RFC 9110), rule source `http-semantics`:
  <https://www.rfc-editor.org/rfc/rfc9110>
- URI Generic Syntax (RFC 3986): <https://www.rfc-editor.org/rfc/rfc3986>
- Robots Exclusion Protocol (RFC 9309), rule source `robots-exclusion`:
  <https://www.rfc-editor.org/rfc/rfc9309>
- Robots meta and `X-Robots-Tag` directives, rule source
  `robots-directives`:
  <https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag>
- HTML Living Standard, rule source `html-elements`:
  <https://html.spec.whatwg.org/multipage/>
- Sitemaps protocol, rule source `sitemaps-protocol`:
  <https://www.sitemaps.org/protocol.html>
- SARIF 2.1.0 (OASIS): <https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html>
- GitHub JavaScript Action metadata: <https://docs.github.com/actions/sharing-automations/creating-actions/metadata-syntax-for-github-actions>
- GitHub workflow commands: <https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions>

The repository-owned schema is `schema/release-guard.schema.json`, identified as
schema version 1 in every local report. Source URLs are documentation provenance
only; tests use deterministic local fixtures and do not call them.

`src/provenance.js` is the machine-checked mapping from every implemented check
ID to one of the rule-source identifiers above. Generated JSON and SARIF carry
that mapping so an implementation rule cannot silently lose its source.
