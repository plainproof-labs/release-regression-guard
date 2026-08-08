# Release Regression Guard

Release Regression Guard is one GitHub Action for technical SEO and release
owners: immediately after a deploy, compare repository-declared critical URLs
with a small expectation manifest and keep the resulting report as a workflow
artifact.

Every check is reported as `pass`, `fail`, `unknown`, or a documented temporary
`exception`. Authentication, blocking, temporary transport failures, and
ambiguous JavaScript shells stay `unknown`; the Action does not guess.

The first release checks only:

- final HTTP status and same-origin redirect outcome;
- `noindex` in HTML or `X-Robots-Tag`, plus `robots.txt` disallow rules;
- one expected canonical URL;
- declared title and metadata presence;
- sitemap membership; and
- declared internal links.

## Install

Use the public repository owner in the Action reference below. The
pre-publication package keeps `plainproof-labs` as a fail-visible placeholder until
the approved neutral owner completes the human-controlled release.

1. Copy [`examples/release-guard.json`](examples/release-guard.json) to
   `release-guard.json` in the repository being checked.
2. Add this workflow as `.github/workflows/release-regression-guard.yml`.
3. Set the repository variable `RELEASE_GUARD_TARGET_BASE` to the deployed
   origin, such as `https://www.example.com`, without a path, query, fragment,
   or credentials. Run the workflow immediately after the deploy succeeds.

```yaml
name: Verify release critical URLs

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  release-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check declared critical URLs
        id: release_guard
        uses: plainproof-labs/release-regression-guard@v1
        with:
          manifest: release-guard.json
          target-base: ${{ vars.RELEASE_GUARD_TARGET_BASE }}
          report-dir: release-guard-report

      - name: Keep JSON, SARIF, and Markdown reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: release-regression-guard-report
          path: release-guard-report/
          if-no-files-found: error
```

The same consumer workflow is available at
[`examples/consumer-workflow.yml`](examples/consumer-workflow.yml).

### Pinning the Action

`@v1` follows compatible v1 fixes and is the simplest installation. For an
immutable installation, replace `@v1` with the full 40-character commit SHA
shown on the approved v1 release. Review and update that SHA deliberately when
upgrading. Do not install from an unreviewed branch name.

## Minimal manifest

Every critical URL explicitly declares every supported check. Paths must be
origin-relative; credentials, hosts, arbitrary selectors, scripts, and
analytics settings are rejected.

```json
{
  "$schema": "./schema/release-guard.schema.json",
  "version": 1,
  "sitemapPath": "/sitemap.xml",
  "criticalUrls": [
    {
      "path": "/pricing",
      "status": { "allowed": [200] },
      "redirect": { "finalPath": "/pricing", "expectedHops": 0 },
      "robots": { "indexable": true },
      "canonical": { "path": "/pricing" },
      "metadata": {
        "required": ["title", "name:description", "property:og:title"]
      },
      "sitemap": { "required": true },
      "requiredInternalLinks": ["/docs", "/contact"]
    }
  ]
}
```

Supported metadata selectors are `title`, `name:<value>`, and
`property:<value>`. Checks are exact and presence-based; there is no SEO score.

### Time-limited exceptions

An exception needs an exact check ID, a nonblank reason, a source reference,
and an expiry date. It changes a concrete failure to `exception` only while
active. It never hides `unknown`, and expiry restores the failure.

```json
"exceptions": [
  {
    "check": "metadata:name:description",
    "reason": "Known migration gap with an owner",
    "source": "CHANGE-123",
    "expiresAt": "2026-12-31"
  }
]
```

## Read the result

Every run creates:

- `report.md`: the review summary and evidence for each declared check;
- `report.json`: stable machine-readable results; and
- `results.sarif`: SARIF 2.1.0 results for compatible tooling.

`fail` emits a GitHub error annotation and fails the Action. `unknown` emits a
warning but does not turn ambiguity into a failure. An active `exception`
emits a notice. Download the `release-regression-guard-report` artifact even
when the workflow fails, then start with `report.md`.

The repository includes deterministic examples of a
[`PASS` report](reports/fixtures/pass/report.md) and a
[`FAIL` report](reports/fixtures/fail/report.md). The report intentionally omits
the target origin; critical paths remain in the local report because they are
needed to remediate a regression.

## Reproduce the evidence locally

Node.js 20 or newer is required. There are no package dependencies and no live
website or secret is needed for the fixture suite.

```text
npm test
npm run e2e
npm run evidence
```

The complete repository-owned self-hosted example is
[`self-hosted-example.yml`](.github/workflows/self-hosted-example.yml). It
starts a deterministic localhost fixture on an operating-system-assigned port.

For a local command-line check against an approved target:

```text
node bin/release-regression-guard.js \
  --manifest release-guard.json \
  --target-base https://preview.example.test \
  --report-dir release-guard-report
```

## Privacy and network boundary

The Action contains no analytics or telemetry client. It requests only the
declared target pages, same-origin redirects, `/robots.txt`, and the declared
sitemap. It does not send repository or user identity, tokens, secrets, the
target origin, manifest, check results, or report content to a measurement
service. Tests enforce the runtime request boundary and scan generated
artifacts for privacy canaries.

After completing a report, a user who independently needs recurring whole-site
crawls, crawl history, scheduling, or proprietary search data may optionally
visit the ordinary official [Semrush Site Audit page](https://www.semrush.com/siteaudit/).
This is a normal official link, not an affiliate link. Those capabilities are
outside this Action, and no usage, ranking, suitability, conversion, or product
result is claimed.

## Limitations

- JavaScript is not executed. Missing DOM facts in a detected JS shell are
  `unknown`.
- Redirects are followed only on the target origin and are capped at 10 hops.
- `robots.txt` checks the `User-agent: *` group supported by this release;
  agent-specific rules and wildcard matching are outside scope.
- Sitemap indexes are not recursively crawled in version 1.
- The parser verifies declared presence and exact paths, not page quality,
  rankings, keywords, or search performance.

Schema and remediation sources are recorded in
[`sources/PROVENANCE.md`](sources/PROVENANCE.md). Security reporting guidance is
in [`SECURITY.md`](SECURITY.md), and release changes are in
[`CHANGELOG.md`](CHANGELOG.md).
