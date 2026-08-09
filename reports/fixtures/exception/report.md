# Release Regression Guard report

Conclusion: **PASS**

Checks: 9 total · 8 pass · 0 fail · 0 unknown · 1 exception

| Critical path | Check | Result | Evidence |
| --- | --- | --- | --- |
| /exception | status | PASS | Final status 200 |
| /exception | redirect | PASS | 0 hop(s), final path /exception |
| /exception | robots.noindex | PASS | No noindex directive found |
| /exception | robots.disallow | PASS | robots.txt allows /exception |
| /exception | canonical | PASS | Canonical is /exception |
| /exception | metadata:title | PASS | title is present |
| /exception | metadata:name:description | EXCEPTION | name:description is missing or blank; accepted until 2026-12-31: Known migration gap with an owner |
| /exception | sitemap | PASS | /exception is present in the sitemap |
| /exception | link:/docs | PASS | Internal link /docs is present |

Unknown is preserved for authentication, blocking, ambiguous JavaScript, transport, and temporary server states. It is not a pass or fail.

Schema: v1 · Sources: sources/PROVENANCE.md
