# KeystoneLoot V2 pre-PR impact note

KeystoneLoot V2 itself retains the release impact validated at V2-D: Web, Worker, and D1.
It does not intrinsically require a Client or addon release.

The final pre-PR weeklyChar branch also carries separately approved Client usability fixes
for release-note Markdown and unauthenticated recovery/escape actions. Those additional
changes require both a Client build and a Client release.

The Spark of Tides inventory fix lives in the separate canonical `Speeson/KeystoneSync`
repository and independently requires an addon build and addon release. It is not an addon
impact caused by KeystoneLoot V2.
