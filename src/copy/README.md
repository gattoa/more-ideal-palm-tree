# Microcopy

All user-facing text lives in the JSON files in this folder. Edit these files to change copy without touching HTML or JavaScript.

## Files and keys

### auth.json
- **lead** – Auth dialog lead line (“Keep your steps with you…”)
- **tabSignUp** – “Create account” tab label
- **tabSignIn** – “Sign in” tab label
- **labelEmail** – Email field label
- **labelPassword** – Password field label
- **submitSignUp** – Submit button when signing up
- **submitSignIn** – Submit button when signing in
- **errorEmailPassword** – Error when email/password missing
- **errorCheckEmail** – Message after sign-up (confirm email)
- **signOut** – Sign out button
- **showPassword** / **hidePassword** – Password visibility toggle aria-label
- **accountTitle** – Account view dialog title
- **authDialogTitle** – Auth view dialog title (“Today”)
- **dismiss** – Dialog close button aria-label
- **accountAria** – Account button/dialog aria-label

### today.json
- **pageTitle** – Browser tab title
- **formLabel** – “New step” label
- **placeholder** – Input placeholder (“What’s your next step?”)
- **journeyDefault** – Default journey label when none selected
- **addStepAria** – Add step button aria-label
- **formAria** – Add-step form aria-label
- **emptyState** – Message when there are no steps
- **progressTemplate** – “{{count}} {{noun}} today” (use {{count}} and {{noun}})
- **stepSingular** / **stepPlural** – For progress line
- **viewNavAria** – View nav aria-label
- **todayTab** / **weekTab** – Today / Week tab labels
- **itemsAria** – Today’s steps section aria-label
- **weekSectionAria** – Week view section aria-label
- **currentJourneyAria** – Journey context button aria-label

### week.json
- **emptyState** – Message when no paths have steps
- **pathStepCountTemplate** – “{{count}} steps” for path header

### dialogs.json
- **confirmDeleteTitle** – “Delete step?” title
- **confirmDeleteAria** – Confirm deletion dialog aria-label
- **confirmKeep** – “Keep it” button
- **confirmDelete** – “Delete” button
- **dismiss** – Dialog close aria-label

### steps.json
- **journey** / **paths** / **milestone** – Step detail section labels
- **addPathPlaceholder** – “+ path” placeholder
- **addPathAria** – Add path aria-label
- **milestoneNone** – “None” option in milestone select
- **addMilestonePlaceholder** – “+ milestone” placeholder
- **addMilestoneAria** – Create milestone aria-label
- **markComplete** – Completion toggle aria-label
- **stepDetails** – Expand step details aria-label
- **editStepAria** – Edit step input aria-label
- **removePathAria** – “Remove {{pathName}}” (template)
- **deleteStepAria** – “Delete \"{{stepText}}\"" (template)
- **thisStep** – Fallback when step text is missing in confirm dialog

## Templates

Strings with `{{key}}` are templates. The app replaces them at runtime (e.g. `{{count}}`, `{{pathName}}`, `{{stepText}}`). Do not remove the placeholders; only change the surrounding words if needed.
