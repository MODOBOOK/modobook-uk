# Fix Supreme patient CSV import

## What will change
- Load every active and archived patient instead of stopping at 1,000.
- Match imports using normalized email or phone, with name and date of birth as a safe fallback.
- Never reactivate an archived patient during a repeat import; update that archived record instead.
- Prevent duplicate rows within the same CSV from being inserted twice.
- Show import progress and a clear final total for large files.

## Verification
- Confirm Supreme’s full patient count loads past J.
- Test a large import in batches and verify repeats update rather than recreate patients.
- Confirm the 84 archived records remain archived.

## Technical details
- Add explicit pagination to patient list and duplicate-check reads to bypass the database API’s 1,000-row response limit.
- Preload matching keys once per batch and track matches created during that batch, avoiding one lookup per row and duplicate inserts.
