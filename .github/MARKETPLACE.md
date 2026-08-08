# v1 release and Marketplace copy

## Release title

Release Regression Guard v1.0.1

## Marketplace category

Primary: Continuous integration

## Short description

Check repository-declared critical URLs after a deploy and keep JSON, SARIF,
and Markdown regression evidence.

## Release notes

Release Regression Guard v1 is one manifest-driven GitHub Action for technical
SEO and release owners. It checks declared critical URL status and same-origin
redirects, robots/noindex, canonical, required metadata, sitemap membership,
and required internal links.

Version 1.0.1 declares the Node.js 24 runtime for current GitHub-hosted runners
without changing inputs, outputs, checks, reports, or network behavior.

Authentication, blocking, temporary transport or server failures, and
ambiguous JavaScript shells remain visible as `unknown`. The Action does not
guess an SEO score and does not require a third-party secret or service.

Start with the README installation workflow, copy the minimal manifest, set the
deployed origin, and download the JSON, SARIF, and Markdown workflow artifact.
Deterministic pass and fail fixtures are included for local verification.
