# Turnly Testing Checklist

Use this checklist to verify all features are working correctly.

## Setup & Navigation

- [ ] App loads at `http://localhost:3000`
- [ ] Welcome screen shows "Turnly" title and name input
- [ ] Can enter name and click "Let's Go"
- [ ] Redirects to `/dashboard` after entering name
- [ ] Dashboard shows "Welcome, [Name]"
- [ ] "Logout" button appears in header
- [ ] Clicking logout returns to home page and clears user

## Group Creation

- [ ] Click "+ Create Group" shows modal
- [ ] Can enter group name
- [ ] Description field is optional
- [ ] Emoji picker shows 12 emoji options
- [ ] Can select different emojis
- [ ] Selected emoji is highlighted with blue border
- [ ] "Create Group" button is disabled if name is empty
- [ ] Error message appears for empty name
- [ ] Group is created and appears on dashboard
- [ ] Group shows name, description, emoji, member count

## Group Joining

- [ ] Click "Join Group" shows modal
- [ ] Can enter 6-character code
- [ ] Code input is uppercase (transforms to uppercase)
- [ ] Code field shows placeholder "ABC123"
- [ ] "Join Group" fails with invalid code
- [ ] "Join Group" fails with non-existent code
- [ ] "Join Group" fails if already a member
- [ ] "Join Group" succeeds with valid code
- [ ] User is added to group members
- [ ] Group appears on dashboard

## Group Detail View

- [ ] Click group card navigates to group page
- [ ] Header shows group name
- [ ] "Back to Groups" link returns to dashboard
- [ ] Right sidebar shows group info card
- [ ] Group info shows name, emoji, member/payment counts
- [ ] Group code is displayed and copyable
- [ ] "Copy" button copies code to clipboard
- [ ] Feedback message appears after copying

## Current Turn Display

- [ ] "Current Turn" card shows large name and emoji
- [ ] Fair mode shows member with lowest payment count
- [ ] Fair mode shows oldest payer first on ties
- [ ] Fair mode prioritizes never-paid members
- [ ] Celebration animation (🎉) appears briefly
- [ ] Animation appears when component renders

## Mark as Paid Feature

- [ ] "Mark as Paid" button is visible
- [ ] Click opens modal dialog
- [ ] Description field is optional
- [ ] Can enter description (e.g., "tea round")
- [ ] Cancel button closes modal without saving
- [ ] Confirm button logs payment
- [ ] Payment appears in history
- [ ] Member payment count increases
- [ ] Next payer is recalculated
- [ ] Description appears in history if provided

## Payment History

- [ ] History table shows all payments
- [ ] Payments are sorted newest first
- [ ] Shows: Who, Date, Description columns
- [ ] Shows dashes for missing descriptions
- [ ] Empty history shows "No payments recorded yet"
- [ ] Descriptions from mark as paid appear here

## Members List

- [ ] Members list shows all group members
- [ ] Shows member name and join date
- [ ] Shows payment count in blue badge
- [ ] Members sorted by payment count (lowest first)
- [ ] Empty group shows "No members yet"
- [ ] Current user is in members list

## Mode Toggle

- [ ] Toggle button shows "⚖️ Fair Mode" or "🎲 Random Mode"
- [ ] Fair mode: "Fair turn based on history"
- [ ] Random mode: "Anyone can pay next"
- [ ] Toggle switches between modes
- [ ] Fair mode selection follows algorithm
- [ ] Random mode picks random member
- [ ] Current payer updates when mode changes
- [ ] Mode persists in group (after page reload)

## Responsive Design

- [ ] Mobile view stacks layout vertically
- [ ] Buttons are touch-friendly size
- [ ] Text is readable on small screens
- [ ] Group cards are full width on mobile
- [ ] Sidebar moves below main content on mobile
- [ ] Emoji picker is usable on mobile
- [ ] Payment history table scrolls horizontally if needed
- [ ] Header navigation works on mobile

## Data Persistence

- [ ] Create group A
- [ ] Refresh page - Group A still exists
- [ ] Create group B
- [ ] Navigate away and back - Both groups exist
- [ ] Mark a payment
- [ ] Refresh page - Payment history preserved
- [ ] Close and reopen browser - Data preserved
- [ ] Join group with code - Data persists

## Edge Cases

- [ ] Group with 1 member works correctly
- [ ] Group with 10+ members works correctly
- [ ] Member name with special characters works
- [ ] Very long group names display correctly
- [ ] Very long descriptions display correctly
- [ ] Multiple payments on same day work
- [ ] Group code case-insensitive (ABC123 = abc123)
- [ ] Can create group with no description

## Fair Algorithm Testing

Set up a test group with Alice, Bob, Carol:

1. **Initial State** (all have 0)
   - [ ] Next payer: Alice (or any - should pick first in list)

2. **Alice pays**
   - [ ] History: Alice - 1 payment
   - [ ] Bob - 0 payments
   - [ ] Carol - 0 payments
   - [ ] Next payer: Bob or Carol (whoever is picked)

3. **Bob pays**
   - [ ] Alice - 1 payment
   - [ ] Bob - 1 payment
   - [ ] Carol - 0 payments
   - [ ] Next payer: Carol

4. **Carol pays**
   - [ ] All have 1 payment each
   - [ ] Next payer: Alice (paid most recently, others tied or before)

5. **Alice pays again**
   - [ ] Alice - 2 payments
   - [ ] Bob - 1 payment
   - [ ] Carol - 1 payment
   - [ ] Next payer: Bob or Carol (same count, pick oldest payer)

## Random Mode Testing

- [ ] Toggle to random mode
- [ ] Click "Mark as Paid" multiple times
- [ ] Next payer should be unpredictable
- [ ] All members should be selected eventually
- [ ] Modal dialog opens and functions normally

## UI Polish

- [ ] No console errors
- [ ] No broken images or icons
- [ ] Buttons have hover states
- [ ] Buttons have active/click states
- [ ] Links are visually distinct
- [ ] Colors are consistent
- [ ] Spacing is even throughout
- [ ] No layout shift when loading

## Browser Testing

- [ ] Chrome latest - ✅
- [ ] Firefox latest - ✅
- [ ] Safari latest - ✅
- [ ] Edge latest - ✅
- [ ] Mobile Safari (iOS) - ✅
- [ ] Chrome Mobile (Android) - ✅

## Performance

- [ ] Page loads in < 2 seconds
- [ ] No lag when clicking buttons
- [ ] Smooth animations
- [ ] Responsive to keyboard input
- [ ] Fast search/filter if implemented

## Accessibility

- [ ] Tab navigation works
- [ ] Form labels are associated with inputs
- [ ] Buttons are keyboard accessible
- [ ] Color contrast is sufficient
- [ ] Text is readable
- [ ] Focus indicators are visible

## Deployment Ready

- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] No 404 errors
- [ ] All assets load correctly
- [ ] Can be built successfully: `pnpm build`
- [ ] Can be deployed to Vercel

---

## Notes

Testing was performed on:
- **Device**: [Your device]
- **Date**: [Date]
- **Tester**: [Your name]

Issues found:
- [ ] None
- [ ] [Describe issues...]

Final Status: ✅ Ready for Deployment
