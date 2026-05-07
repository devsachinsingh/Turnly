# Turnly - Who's Paying Next?

A lightweight, fun payment turn manager for groups. Perfect for managing tea rounds, parties, food orders, or any scenario where groups need to rotate who pays.

## Features

- **Fair Turn System**: Automatically selects the next payer based on payment history
  - Picks the member who has paid the least
  - If there's a tie, picks the one who paid least recently
  
- **Random Mode**: Toggle for fun/casual scenarios where anyone can pay next

- **Group Management**:
  - Create groups with custom names, descriptions, and emojis
  - Join groups with a simple 6-character code
  - Share codes easily

- **Payment Tracking**:
  - Mark payments with optional descriptions (e.g., "tea round", "party drinks")
  - View complete payment history
  - See member stats (how many times they've paid)

- **Mobile-Friendly**: Fully responsive design that works on all devices

## How to Use

### 1. Create a Group
- Click "Create Group"
- Enter group name (e.g., "Office Tea Gang")
- Add description (optional)
- Choose an emoji for the group
- Share the group code with colleagues

### 2. Join a Group
- Click "Join Group"
- Enter the 6-character code from the group creator
- You're now part of the group!

### 3. Manage Turns
- Open the group to see whose turn it is
- Members are selected fairly based on history
- Click "Mark as Paid" to log the payment
- Optionally add a description for what was paid for

### 4. Toggle Modes
- **Fair Mode** (default): Fair selection based on payment history
- **Random Mode**: Random selection for fun scenarios

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **Storage**: Browser localStorage (no server required)
- **UI Components**: shadcn/ui

## Local Storage

All data is stored locally in your browser:
- User profile (name)
- Groups and members
- Payment history

Data persists across browser sessions but is specific to each device/browser.

## Deployment

Deploy on Vercel with zero configuration:

```bash
git push
# or use vercel CLI
vercel
```

## File Structure

```
app/
├── page.tsx              # Home/auth page
├── dashboard/page.tsx    # Groups list
└── group/[id]/page.tsx   # Group detail view

components/
├── UserSetup.tsx         # Name entry
├── GroupCreator.tsx      # Create group
├── GroupJoiner.tsx       # Join group
├── CurrentTurn.tsx       # Show whose turn
├── GroupInfo.tsx         # Group details
├── MembersList.tsx       # Members list
├── PaymentHistory.tsx    # Payment history
├── MarkAsPaidButton.tsx  # Mark as paid
└── RandomModeToggle.tsx  # Mode toggle

lib/
├── types.ts              # TypeScript types
├── storage.ts            # localStorage abstraction
├── fairTurn.ts           # Fair algorithm
├── randomTurn.ts         # Random algorithm
└── codeGenerator.ts      # Group code generation
```

## Algorithm Details

### Fair Turn Selection
1. Count how many times each member has paid
2. Select the member with the lowest count
3. If tie: select the one who paid least recently
4. Special case: Members who haven't paid are selected first

### Random Mode
- Simply picks a random member from the group

## Notes

- No authentication required - just enter your name
- Each device/browser has its own data
- Perfect for small teams and office groups
- Works offline - everything is localStorage-based
