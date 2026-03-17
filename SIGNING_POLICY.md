# Code Signing Policy — MarkWeave

Free code signing for this project is provided by
[SignPath Foundation](https://signpath.org/).

---

## Signed Binaries

The following artifacts are signed under this policy:

| File | Platform |
|------|----------|
| `MarkWeave_*.msi` | Windows (x64) |

Signing covers only binaries built from this repository.
Third-party dependencies are not re-signed.

---

## Repository

**https://github.com/hayashixd/MarkWeave**

License: [MIT](./LICENSE)

---

## Roles

| Role | GitHub account |
|------|----------------|
| Author / Approver | [@hayashixd](https://github.com/hayashixd) |

---

## Build & Signing Process

- All releases are built from tagged commits (`v*`) on the `main` branch
- Builds run exclusively on GitHub Actions (`.github/workflows/release.yml`)
- Signing is triggered only by `v*` tag pushes; no manual or local signing
- SHA256 checksums for each release are published on the
  [GitHub Releases page](https://github.com/hayashixd/MarkWeave/releases)

---

## Contributor Contributions

External contributions are accepted via Pull Requests and reviewed by the
author before merge. No unsigned or unreviewed code is included in a release.

---

## Privacy & Support

No telemetry or usage data is collected by the application.
All user data is stored locally on the user's machine.

For support, refund policy, and known limitations, see
[SUPPORT.md](./SUPPORT.md).

---

## Attribution

> Free code signing provided by [SignPath Foundation](https://signpath.org/).
> Certificates by [SignPath Foundation](https://signpath.org/).
