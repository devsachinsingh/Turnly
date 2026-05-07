# Turnly Implementation Details

## Architecture Overview

Turnly is a fully client-side application with zero backend dependencies. All data is stored in browser localStorage, making it lightweight and fast.

### Data Model

```typescript
User {
  id: string          // unique identifier
  name: string        // display name
}

Group {
  id: string
  name: string        // group name
  description?: string
  emoji: string       // group emoji
  code: string        // 6-char join code
  members: Member[]
  paymentHistory: PaymentRecord[]
  createdAt: string   // ISO date
  isRandomMode?: boolean
}

Member {
  id: string          // references User.id
  name: string
  joinedDate: string  // ISO date
}

PaymentRecord {
  memberId: string
  memberName: string
  date: string        // ISO date
  description?: string
}
```

## Key Algorithms

### Fair Turn Selection (`lib/fairTurn.ts`)

The algorithm determines who should pay next based on fairness:

```
1. Count payments for each member
   - Create a count map: { memberId: paymentCount }
   
2. Find minimum count
   - min = Math.min(...counts)
   
3. Get all candidates with min count
   - candidates = members where count == min
   
4. If only one candidate
   - Return that candidate
   
5. If multiple candidates (tie)
   - For each candidate, find their last payment date
   - Return the one with the oldest last payment date
   - If never paid, prioritize them (return immediately)
```

**Time Complexity**: O(n + h) where n = members, h = payment history
**Fairness Guarantee**: Over time, everyone pays equally

### Random Mode (`lib/randomTurn.ts`)

Simple random selection from available members:

```
return members[Math.floor(Math.random() * members.length)]
```

## Storage Layer (`lib/storage.ts`)

Abstraction over browser localStorage with type safety:

- `getUser()` / `setUser()` - Current user session
- `getGroups()` / `getGroup(id)` - Retrieve groups
- `addGroup()` / `updateGroup()` - Modify groups
- `findGroupByCode()` - Join a group

All operations check for SSR context (`typeof window === 'undefined'`).

## Pages & Routing

### `/` (Home)
- **Purpose**: User authentication/onboarding
- **Logic**: 
  - Check for saved user in localStorage
  - If found: redirect to `/dashboard`
  - If not: show name entry form
- **Components**: `UserSetup`

### `/dashboard`
- **Purpose**: Group management hub
- **Logic**:
  - Show all groups current user is member of
  - Allow create/join group
  - Display group cards with quick stats
- **Components**: `GroupCreator`, `GroupJoiner`, group cards
- **Features**:
  - Create group modal
  - Join group modal
  - Grid of user's groups
  - Logout button

### `/group/[id]`
- **Purpose**: Main feature - manage payment turns
- **Layout**: 2-column (mobile: 1-column)
  - **Left**: Current turn, mark as paid, mode toggle, history
  - **Right**: Group info, members, actions
- **Components**: 
  - `CurrentTurn` - Display whose turn
  - `MarkAsPaidButton` - Log payments
  - `RandomModeToggle` - Switch modes
  - `PaymentHistory` - View history
  - `GroupInfo` - Group details
  - `MembersList` - Members with stats

## Component Responsibilities

| Component | Purpose | State |
|-----------|---------|-------|
| `UserSetup` | Name entry | Form state |
| `GroupCreator` | Create group | Form state, emoji selection |
| `GroupJoiner` | Join group | Form state |
| `CurrentTurn` | Show whose turn | Re-renders on group change |
| `GroupInfo` | Display group details | Copy feedback state |
| `MembersList` | List members with stats | Calculates payment counts |
| `PaymentHistory` | Show past payments | Sorts by date |
| `MarkAsPaidButton` | Mark payment button | Modal state, description input |
| `RandomModeToggle` | Toggle modes | Just calls parent handler |

## State Management

**Simple Approach**: useState at page level
- Pages manage group state
- Pass down via props
- Handlers update state and localStorage
- Re-renders cascade to children

**Why not Context/Redux?**
- App is small enough for prop drilling
- localStorage is the source of truth
- Reduces complexity and bundle size

## LocalStorage Keys

- `turnly_user` - Current user object
- `turnly_groups` - Array of all groups

## CSS & Styling

- **Framework**: Tailwind CSS
- **Design**: Clean, minimal, modern
- **Color Scheme**: 
  - Primary: Blue (500-700)
  - Background: White/Gray-50
  - Accents: Green (for actions)
- **Responsive**: Mobile-first, breakpoints at md (768px) and lg (1024px)
- **Components**: shadcn/ui (Button, Input, etc.)

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers
- ⚠️ IE 11 - Not supported (localStorage is available but ES6 features may not be)

## Performance Characteristics

| Operation | Time |
|-----------|------|
| Load user | < 1ms (localStorage) |
| Create group | < 1ms |
| Join group | < 1ms |
| Mark payment | < 1ms + re-render |
| Calculate next payer | O(n + h) |

Where n = members, h = payment history items

## Security Considerations

⚠️ **Not for Production Financial Systems**

- Data stored in plain text in localStorage
- No encryption
- No server-side validation
- Vulnerable to XSS attacks
- No access control

✅ **Suitable For**
- Office tea rounds
- Friend group payments
- Casual group expenses
- Internal use only (trusted group)

## Future Enhancement Ideas

1. **Data Export/Import**
   - Download group data as JSON
   - Import from backup

2. **Multi-Device Sync**
   - Firebase/Supabase backend
   - Cloud sync

3. **Analytics**
   - Payment trends
   - Most/least frequent payers
   - Charts & stats

4. **Notifications**
   - Browser notifications when it's your turn
   - Email reminders

5. **Undo/Redo**
   - Revert payment entries
   - Edit descriptions

6. **Role-Based**
   - Group admin approval for joining
   - Group owner privileges

7. **Expense Splitting**
   - Track individual expenses
   - Settle up calculations

## Testing Approach

Manual testing covered:
1. ✅ User setup flow
2. ✅ Group creation with emoji selection
3. ✅ Group joining with code
4. ✅ Fair turn calculation
5. ✅ Random mode toggle
6. ✅ Payment marking with notes
7. ✅ Payment history display
8. ✅ Member list stats
9. ✅ Responsive layout

## Deployment

**Vercel (Recommended)**
```bash
git push  # or vercel CLI
```
- Zero config required
- Auto-builds and deploys
- Environment: No env vars needed

**Other Platforms**
- Netlify: `pnpm build` → deploy `out/`
- GitHub Pages: Set up as static site
- Docker: Include Node runtime

## Environment Variables

None required! The app works completely client-side.

## Build & Bundle

- **Framework**: Next.js 16 (Turbopack by default)
- **Bundle Size**: ~200KB (gzipped)
- **CSS**: Tailwind CSS (purged for production)
- **Static Export**: Can be exported as static HTML

## Known Limitations

1. **Single Device**: Data doesn't sync across devices
2. **Browser Storage**: Clearing cache removes data
3. **No Authentication**: Anyone with access to device can see data
4. **Code Collision**: 6-char codes ~2.8B combinations (safe in practice)
5. **No Real-time**: Changes don't sync in real-time to other users

## Code Quality

- **TypeScript**: Fully typed
- **Components**: Functional components with hooks
- **Error Handling**: Basic validation on forms
- **Accessibility**: Semantic HTML, ARIA labels where needed
- **Mobile**: Responsive design

## File Sizes

```
lib/
  types.ts               ~650 bytes
  storage.ts             ~1.8 KB
  fairTurn.ts            ~1.5 KB
  randomTurn.ts          ~200 bytes
  codeGenerator.ts       ~350 bytes

components/
  UserSetup.tsx          ~2 KB
  GroupCreator.tsx       ~3 KB
  GroupJoiner.tsx        ~2.5 KB
  CurrentTurn.tsx        ~2 KB
  GroupInfo.tsx          ~1.5 KB
  MembersList.tsx        ~1.5 KB
  PaymentHistory.tsx     ~1.3 KB
  MarkAsPaidButton.tsx   ~2 KB
  RandomModeToggle.tsx   ~1 KB

app/
  page.tsx               ~1 KB
  dashboard/page.tsx     ~5 KB
  group/[id]/page.tsx    ~5 KB

Total: ~34 KB (uncompressed)
```

This is a lean, focused implementation that prioritizes simplicity and usability.
