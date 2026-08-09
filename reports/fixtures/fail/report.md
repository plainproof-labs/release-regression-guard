# Release Regression Guard report

Conclusion: **FAIL**

Checks: 25 total · 7 pass · 18 fail · 0 unknown · 0 exception

| Critical path | Check | Result | Evidence |
| --- | --- | --- | --- |
| /negative | status | PASS | Final status 200 |
| /negative | redirect | PASS | 0 hop(s), final path /negative |
| /negative | robots.noindex | FAIL | noindex directive present |
| /negative | robots.disallow | FAIL | robots.txt disallows /negative |
| /negative | canonical | FAIL | Expected one canonical /negative; observed /wrong-canonical |
| /negative | metadata:title | FAIL | title is missing or blank |
| /negative | metadata:name:description | FAIL | name:description is missing or blank |
| /negative | sitemap | FAIL | /negative is missing from the sitemap |
| /negative | link:/docs | FAIL | Required internal link /docs is missing |
| /not-found | status | FAIL | Expected 200, received 404 |
| /not-found | redirect | PASS | 0 hop(s), final path /not-found |
| /not-found | robots.noindex | PASS | No noindex directive found |
| /not-found | robots.disallow | PASS | robots.txt allows /not-found |
| /not-found | canonical | FAIL | Expected one canonical /not-found; observed missing |
| /not-found | metadata:title | FAIL | title is missing or blank |
| /not-found | metadata:name:description | FAIL | name:description is missing or blank |
| /not-found | sitemap | FAIL | /not-found is missing from the sitemap |
| /bad-redirect | status | FAIL | Redirect could not be completed: invalid-redirect-location |
| /bad-redirect | redirect | FAIL | Redirect could not be completed: invalid-redirect-location |
| /bad-redirect | robots.noindex | PASS | No noindex directive found |
| /bad-redirect | robots.disallow | PASS | robots.txt allows /bad-redirect |
| /bad-redirect | canonical | FAIL | Expected one canonical /bad-redirect; observed missing |
| /bad-redirect | metadata:title | FAIL | title is missing or blank |
| /bad-redirect | metadata:name:description | FAIL | name:description is missing or blank |
| /bad-redirect | sitemap | FAIL | /bad-redirect is missing from the sitemap |

Unknown is preserved for authentication, blocking, ambiguous JavaScript, transport, and temporary server states. It is not a pass or fail.

Schema: v1 · Sources: sources/PROVENANCE.md
