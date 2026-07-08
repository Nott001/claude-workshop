# CHANGELOG

## [Unreleased]

### docs: tighten context files for code generation precision

- **OVERVIEW.md**: spell out `role` enum values (`attendee | speaker | facilitator`); define `LESSONS.content_type` as `ENUM(pdf, video, image, link)` with descriptions
- **phase-0.md** to **phase-8.md**: add explicit output file paths so agents write to a known location
- **phase-6.md**: fix `context/specs/` → `context/spec/` to match Phase 5's output directory
- **phase-5.md**: align `context/specs/` → `context/spec/` for consistency
