# Change: Add Admin Draw Navigation and Fix Modal UI

## Why
Admins cannot click on draws in the admin page to navigate to historical draw details. Additionally, the Fetch Results modal has content cut off due to sizing issues.

## What Changes
- Make draw items clickable in the admin page to navigate to `/draw/{id}` or `/draw/{id}/results`
- Add click handlers to draws in "Draw Management" and "Pending Completion" sections
- Fix the Fetch Results modal to properly display all content without being cut off

## Impact
- Affected specs: ui-design
- Affected code: `pages/admin.vue`
