# Release Regression Guard report

Conclusion: **UNKNOWN**

Checks: 36 total · 10 pass · 0 fail · 26 unknown · 0 exception

| Critical path | Check | Result | Evidence |
| --- | --- | --- | --- |
| /auth | status | UNKNOWN | Not verifiable: authentication-required |
| /auth | redirect | UNKNOWN | Not verifiable: authentication-required |
| /auth | robots.noindex | UNKNOWN | Not verifiable: authentication-required |
| /auth | robots.disallow | PASS | robots.txt allows /auth |
| /auth | canonical | UNKNOWN | Not verifiable: authentication-required |
| /auth | metadata:title | UNKNOWN | Not verifiable: authentication-required |
| /auth | metadata:name:description | UNKNOWN | Not verifiable: authentication-required |
| /auth | sitemap | PASS | /auth is present in the sitemap |
| /auth | link:/docs | UNKNOWN | Not verifiable: authentication-required |
| /bot-block | status | UNKNOWN | Not verifiable: possible-bot-challenge |
| /bot-block | redirect | UNKNOWN | Not verifiable: possible-bot-challenge |
| /bot-block | robots.noindex | UNKNOWN | Not verifiable: possible-bot-challenge |
| /bot-block | robots.disallow | PASS | robots.txt allows /bot-block |
| /bot-block | canonical | UNKNOWN | Not verifiable: possible-bot-challenge |
| /bot-block | metadata:title | UNKNOWN | Not verifiable: possible-bot-challenge |
| /bot-block | metadata:name:description | UNKNOWN | Not verifiable: possible-bot-challenge |
| /bot-block | sitemap | PASS | /bot-block is present in the sitemap |
| /bot-block | link:/docs | UNKNOWN | Not verifiable: possible-bot-challenge |
| /js-shell | status | PASS | Final status 200 |
| /js-shell | redirect | PASS | 0 hop(s), final path /js-shell |
| /js-shell | robots.noindex | UNKNOWN | HTML is an ambiguous JavaScript shell |
| /js-shell | robots.disallow | PASS | robots.txt allows /js-shell |
| /js-shell | canonical | UNKNOWN | HTML is an ambiguous JavaScript shell |
| /js-shell | metadata:title | UNKNOWN | HTML is an ambiguous JavaScript shell |
| /js-shell | metadata:name:description | UNKNOWN | HTML is an ambiguous JavaScript shell |
| /js-shell | sitemap | PASS | /js-shell is present in the sitemap |
| /js-shell | link:/docs | UNKNOWN | HTML is an ambiguous JavaScript shell |
| /temporary | status | UNKNOWN | Not verifiable: temporary-http-failure |
| /temporary | redirect | UNKNOWN | Not verifiable: temporary-http-failure |
| /temporary | robots.noindex | UNKNOWN | Not verifiable: temporary-http-failure |
| /temporary | robots.disallow | PASS | robots.txt allows /temporary |
| /temporary | canonical | UNKNOWN | Not verifiable: temporary-http-failure |
| /temporary | metadata:title | UNKNOWN | Not verifiable: temporary-http-failure |
| /temporary | metadata:name:description | UNKNOWN | Not verifiable: temporary-http-failure |
| /temporary | sitemap | PASS | /temporary is present in the sitemap |
| /temporary | link:/docs | UNKNOWN | Not verifiable: temporary-http-failure |

Unknown is preserved for authentication, blocking, ambiguous JavaScript, transport, and temporary server states. It is not a pass or fail.

Schema: v1 · Sources: sources/PROVENANCE.md
