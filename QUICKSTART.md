# Turnly - Quick Start Guide

Get Turnly running in 2 minutes!

## 🚀 Option 1: Deploy to Vercel (Easiest)

### Prerequisites
- Vercel account (free at vercel.com)
- GitHub account (optional)

### Steps

1. **Via Vercel Dashboard** (Fastest)
   - Go to https://vercel.com
   - Click "Add New..." → "Project"
   - Import this GitHub repo (or create new)
   - Click "Deploy"
   - Done! Your app is live 🎉

2. **Via Vercel CLI**
   ```bash
   npm install -g vercel
   vercel
   # Answer the prompts and deploy
   ```

3. **Via GitHub**
   - Push code to GitHub
   - Connect GitHub to Vercel
   - Auto-deploys on every push

### Share the URL
- Send the Vercel URL to your group
- Start creating groups!

---

## 💻 Option 2: Run Locally

### Prerequisites
- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)

### Steps

```bash
# Navigate to project
cd /vercel/share/v0-project

# Install dependencies (usually already done)
pnpm install

# Start dev server
pnpm dev
```

### Access the App
- Open http://localhost:3000 in your browser
- App is ready!

---

## 👤 First Time Setup

### 1. Enter Your Name
- Type your name (e.g., "John")
- Click "Let's Go"

### 2. Create a Group
- Click "+ Create Group"
- Enter group name (e.g., "Office Tea Gang")
- Choose an emoji (optional)
- Click "Create Group"
- **Save the group code** - share with others!

### 3. Add Members
- Share the 6-character code with friends
- They click "Join Group"
- They enter the code
- They're in!

### 4. Start Managing Turns
- Open the group
- See whose turn it is (auto-calculated)
- Click "Mark as Paid" when someone pays
- History updates automatically!

---

## 🎯 Common Tasks

### See Whose Turn It Is
1. Go to the group page
2. Look at the big blue card
3. That's who pays next

### Mark Someone as Paid
1. Click "Mark as Paid" button
2. (Optional) Add description ("tea round", "lunch", etc.)
3. Click "Confirm"
4. Next payer auto-updates

### Switch to Random Mode
1. Find the "Fair Mode" / "Random Mode" toggle
2. Click to switch
3. Next payer becomes random!

### Join Another Group
1. Go to Dashboard
2. Click "Join Group"
3. Enter the 6-character code
4. Click "Join"

### Leave a Group
1. Open the group
2. Scroll to bottom right
3. Click "Leave Group"

---

## ❓ FAQs

**Q: Where is my data stored?**
A: On your device (browser localStorage). No servers, no cloud.

**Q: Can I use this on multiple devices?**
A: Not synced. Each device has its own data. Consider adding a backend later.

**Q: Is my data secure?**
A: Yes, it stays on your device. Not for real money transfers though!

**Q: What if I clear my browser cache?**
A: All data is deleted. Keep a backup if important.

**Q: Can I export my data?**
A: Right now, no. You can manually save via browser console.

**Q: How many groups can I create?**
A: Unlimited (limited by browser storage, usually ~5-10 MB)

**Q: What if two people pay at the same time?**
A: Just mark them both paid. Next person updates accordingly.

---

## 📱 Mobile

The app works perfectly on mobile!

- Tap buttons to interact
- Swipe up/down to scroll
- Landscape mode works too
- All features available

---

## ⚙️ Customization

### Change Colors
Edit `tailwind.config.ts`:
```ts
// Change primary color
colors: {
  primary: '#0066cc', // change this
}
```

### Add More Emojis
Edit `components/GroupCreator.tsx`:
```tsx
const EMOJI_OPTIONS = ['☕', '🍕', '🎉', '🎂']; // add emojis
```

### Rename App
Edit `app/layout.tsx`:
```tsx
title: 'My App Name', // change title
```

---

## 🐛 Troubleshooting

**App won't load**
- Refresh browser
- Clear cache
- Try incognito mode
- Check browser console for errors

**Data disappeared**
- Data is in localStorage (device-specific)
- Check you're on same browser/device
- Can't recover if cache cleared

**Group code doesn't work**
- Copy code exactly (case doesn't matter)
- Make sure it's the right group creator's code
- Try a fresh join attempt

**Mobile layout broken**
- Rotate phone to landscape
- Zoom out (pinch)
- Try Chrome instead of Safari

---

## 📚 More Info

- **Full Guide**: See `GUIDE.md`
- **How It Works**: See `IMPLEMENTATION.md`
- **Deploy Guide**: See `DEPLOY.md`
- **Test Guide**: See `TESTING.md`

---

## 🎉 You're Ready!

That's it! You now have a working payment turn manager.

### Next Steps:
1. ✅ Deploy or run locally
2. ✅ Create your first group
3. ✅ Share the code with friends
4. ✅ Start managing payment turns!

### Questions?
Check the full documentation files for more details.

---

**Enjoy Turnly! 🚀**

Who's paying next? Let Turnly decide! ☕
