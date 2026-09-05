# How this repository is published

**Author here or in the website — but know which you did.**

These files live in two places on purpose:

| Where | What it is |
|---|---|
| `aesc-website/brand/` | The authoring home. The website imports `tokens.theme.css` from it directly, and its build fails if the file is missing. |
| `aesc-brand` (this repo) | A **projection** of that directory, produced by `git subtree split`, with the same history rooted at the package. This is what other projects install. |

This is not duplication in the sense the guide warns about. There is one set of files with one
history; `subtree` republishes it under a second name. Nothing is retyped and nothing can disagree
— which is exactly the property `tokens.css` and `guide.html` have with respect to `tokens.json`.

## Publishing a change

From the website checkout, after committing to `brand/`:

```bash
git subtree push --prefix=brand git@github.com:amelspahic/aesc-brand.git main
```

Then tag the release in this repo:

```bash
git tag v1.1.0 && git push --tags
```

Consumers pin a tag, so nothing moves under them until they choose to move.

## If you edit here instead

Pull it back into the website before you touch `brand/` there again, or the next `subtree push`
will conflict:

```bash
# from the website checkout
git subtree pull --prefix=brand git@github.com:amelspahic/aesc-brand.git main --squash
```

## Why not a submodule

A submodule would keep one copy on disk, but it puts every consumer into detached HEAD, needs
`--recurse-submodules` on clone, and needs a credential in CI even to read a private package.
`subtree` costs one command at publish time and nothing at consume time. For a package that changes
a few times a year and is installed by pinned tag, that is the better trade.
