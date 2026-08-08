# Release Regression Guard report

Conclusion: **PASS**

Checks: 19 total · 19 pass · 0 fail · 0 unknown · 0 exception

| Critical path | Check | Result | Evidence |
| --- | --- | --- | --- |
| /positive | status | PASS | Final status 200 |
| /positive | redirect | PASS | 0 hop(s), final path /positive |
| /positive | robots.noindex | PASS | No noindex directive found |
| /positive | robots.disallow | PASS | robots.txt allows /positive |
| /positive | canonical | PASS | Canonical is /positive |
| /positive | metadata:title | PASS | title is present |
| /positive | metadata:name:description | PASS | name:description is present |
| /positive | metadata:property:og:title | PASS | property:og:title is present |
| /positive | sitemap | PASS | /positive is present in the sitemap |
| /positive | link:/docs | PASS | Internal link /docs is present |
| /moved | status | PASS | Final status 200 |
| /moved | redirect | PASS | 1 hop(s), final path /landing |
| /moved | robots.noindex | PASS | No noindex directive found |
| /moved | robots.disallow | PASS | robots.txt allows /moved |
| /moved | canonical | PASS | Canonical is /landing |
| /moved | metadata:title | PASS | title is present |
| /moved | metadata:name:description | PASS | name:description is present |
| /moved | sitemap | PASS | /moved is present in the sitemap |
| /moved | link:/docs | PASS | Internal link /docs is present |

Unknown is preserved for authentication, blocking, ambiguous JavaScript, transport, and temporary server states. It is not a pass or fail.

Schema: v1 · Sources: sources/PROVENANCE.md
