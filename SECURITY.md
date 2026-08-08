# Security policy

## Supported release

The latest published v1 release receives security fixes. Before the first public
release, there is no supported public version.

## Report a vulnerability

After publication, use the public repository's private vulnerability reporting
form. Do not put a target URL, repository identity, token, secret, private
manifest, or generated report in a public issue. If private vulnerability
reporting is not yet enabled, pause and ask the approved neutral repository
owner to enable it before sharing sensitive evidence.

Include the affected release or commit, a minimal synthetic reproduction, and
the security impact. Replace real origins, paths, identities, and credentials
with non-sensitive fixture values.

## Network and secret boundary

The Action does not need a third-party secret. It requests only the configured
target origin, same-origin redirects, the declared critical paths,
`/robots.txt`, and the declared sitemap. Cross-origin redirects are not
followed. Generated reports omit the target origin, but they contain the
critical paths needed for remediation and should be handled as CI artifacts.
