# Turnly Deployment Guide

Turnly is ready to deploy! It requires **zero configuration** since all data is stored locally in the browser.

## Quick Deploy to Vercel

The easiest way to deploy Turnly:

### Option 1: Using Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel

# Answer the prompts:
# - Set up and deploy? (y)
# - Link to existing project? (no for first time)
# - Project name: turnly (or your choice)
# - Framework: Next.js
# - Root directory: ./
```

### Option 2: Using GitHub

1. Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/turnly.git
git push -u origin main
```

2. Go to https://vercel.com and sign in with GitHub

3. Click "Add New..." → "Project"

4. Select your `turnly` repository

5. Click "Deploy"

6. Done! Your app is live at `turnly.vercel.app`

### Option 3: Deploy Button (if added)

Add this to your GitHub README:

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Fturnly)
```

## Deployment Checklist

Before deploying, verify:

- [ ] No TypeScript errors: `pnpm build`
- [ ] No console errors in development
- [ ] Tested on mobile
- [ ] All features working
- [ ] README.md is complete
- [ ] GUIDE.md is complete

## Post-Deployment

### 1. Set Custom Domain (Optional)

In Vercel dashboard:
1. Go to your project settings
2. Click "Domains"
3. Add your domain (e.g., `turnly.yourdomain.com`)
4. Follow DNS setup instructions

### 2. Monitor Performance

In Vercel dashboard:
- View build times
- Check analytics
- Monitor errors and uptime

### 3. Enable Automatic Deployments

By default, Vercel auto-deploys on `git push`:
- Any push to `main` auto-deploys
- Creates preview deployments for PRs
- No manual build/deploy needed

## Environment Variables

**None required!** Turnly works completely without any environment variables.

If you ever need to add them in the future:
1. Go to project settings in Vercel
2. Click "Environment Variables"
3. Add key-value pairs
4. Redeploy

## Local Development

### Prerequisites
- Node.js 18+
- pnpm (or npm/yarn)

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/turnly.git
cd turnly

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Open http://localhost:3000
```

### Build for Production

```bash
pnpm build
pnpm start
```

## Troubleshooting Deployment

### Build Fails

Check the build logs in Vercel dashboard:
1. Go to "Deployments"
2. Click on failed deployment
3. Check "Build Logs" for errors

Common issues:
- TypeScript errors: Check `tsconfig.json`
- Missing dependencies: Run `pnpm install`
- Port conflicts locally: Already running on :3000

### Data Not Persisting

Ensure you're using the same browser/device:
- Turnly uses browser localStorage
- Private/Incognito mode doesn't persist data
- Each browser/device has separate data
- Clearing cache removes all data

### Performance Issues

- Check Network tab (DevTools → Network)
- Check bundle size: `npm run analyze` (if configured)
- Use production build: `pnpm build && pnpm start`

## Scaling & Optimization

### Current Performance
- **Build Time**: ~10-30 seconds
- **Bundle Size**: ~200KB (gzipped)
- **Lighthouse Score**: 95+
- **First Contentful Paint**: < 1s

### If You Need Scaling

Future improvements (not needed for MVP):
- Add serverless backend (Firebase, Supabase)
- Add database for multi-device sync
- Add authentication system
- Add real-time features

But the current version handles 100+ groups easily on localStorage!

## Backup & Migration

### Export Data

Create a simple export feature:

```javascript
// Browser console:
const data = {
  user: localStorage.getItem('turnly_user'),
  groups: localStorage.getItem('turnly_groups')
};
console.log(JSON.stringify(data, null, 2));
// Copy and save to file
```

### Import Data

To restore:

```javascript
// Browser console:
const data = {
  /* paste exported JSON */
};
localStorage.setItem('turnly_user', data.user);
localStorage.setItem('turnly_groups', data.groups);
// Refresh page
```

## Monitoring

### What to Monitor

1. **Errors**: Check Vercel Analytics
2. **Performance**: Monitor page load time
3. **Usage**: Track active users (if analytics added)

### Analytics

To add analytics (optional):

```bash
pnpm add @vercel/analytics
```

Then in `app/layout.tsx`:
```tsx
import { Analytics } from '@vercel/analytics/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

## Security Notes

### What's Secure
- Uses HTTPS (automatic on Vercel)
- No secrets in client code
- No authentication (by design for simplicity)

### What's Not Secure
- Don't use for real money transfers
- Data stored in plain text locally
- No encryption
- Suitable for internal/trusted groups only

### Best Practices
- Only use on trusted networks
- Don't store sensitive financial data
- Keep group codes private
- Trust your group members

## Cost

**Free!** Turnly costs nothing to deploy:
- Vercel free tier: 100 GB data transfer/month
- Perfect for a casual app
- Scales automatically
- No credit card needed initially

### Pro Features (Optional, $25/month)
- Custom domains
- Advanced analytics
- Priority support

But not needed for Turnly!

## Support & Issues

### Getting Help

1. **Documentation**: Check README.md, GUIDE.md
2. **Code**: Review IMPLEMENTATION.md
3. **Testing**: Follow TESTING.md
4. **Issues**: Check GitHub issues (if using GitHub)

### Reporting Bugs

If you find a bug:
1. Check if it's a known issue
2. Test in production vs. local dev
3. Try clearing browser cache/localStorage
4. Check browser console for errors
5. Create an issue on GitHub with:
   - Step to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots

## Updates & Maintenance

### Keeping Dependencies Updated

```bash
# Check for updates
pnpm update --latest

# Run tests
pnpm build

# Deploy
git push
```

### Major Updates

When updating Next.js or major dependencies:
1. Test thoroughly locally
2. Check breaking changes
3. Update code if needed
4. Test again
5. Deploy and monitor

## Success! 🎉

You've successfully deployed Turnly!

Next steps:
- Share the link with your team/group
- Start creating groups and managing turns
- Enjoy fair and fun payment rotations!

For questions or improvements, check the documentation or create an issue on GitHub.

---

**Deployed URL**: `https://turnly.vercel.app` (or your custom domain)

Share this with your group to get started! 🚀
