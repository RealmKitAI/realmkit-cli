# NPM Publishing Guide for RealmKit CLI

## Prerequisites
1. npm account (create at https://www.npmjs.com/signup)
2. Node.js >= 18.0.0
3. npm >= 8.0.0

## First-Time Setup

### 1. Login to npm
```bash
npm login
# Enter your npm username, password, and email
# You'll also need to enter a 2FA code if enabled
```

### 2. Verify you're logged in
```bash
npm whoami
# Should display your npm username
```

## Publishing Steps

### 1. Ensure project is built
```bash
cd /Users/nir.bendavid/prj/boiler/realmkit-cli
npm run build
```

### 2. Test locally (optional but recommended)
```bash
npm link
realmkit --version
# Should show: 0.1.0
```

### 3. Dry run (see what will be published)
```bash
npm publish --dry-run --access public
```

### 4. Publish to npm
```bash
npm publish --access public
```

**Note**: The `--access public` flag is required for scoped packages (@realmkit/cli) to be public.

## After Publishing

### Verify the package
1. Visit: https://www.npmjs.com/package/@realmkit/cli
2. Test installation:
   ```bash
   npm install -g @realmkit/cli
   realmkit --version
   ```

## Version Management

### For future updates:
1. Update version in package.json
   ```bash
   npm version patch  # for bug fixes (0.1.0 -> 0.1.1)
   npm version minor  # for new features (0.1.0 -> 0.2.0)
   npm version major  # for breaking changes (0.1.0 -> 1.0.0)
   ```

2. Build and publish
   ```bash
   npm run build
   npm publish --access public
   ```

## GitHub Integration

Since the code is at https://github.com/RealmKitAI/realmkit-cli:

1. **Tag the release**:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Create GitHub Release**:
   - Go to https://github.com/RealmKitAI/realmkit-cli/releases
   - Click "Create a new release"
   - Choose the tag you just created
   - Add release notes

## Troubleshooting

### Permission denied error
If you get a 403 error, ensure:
- You're logged in: `npm whoami`
- The package name isn't taken
- You're using `--access public` for scoped packages

### Package name already exists
The package name `@realmkit/cli` should be available under the @realmkit scope.
If not, you may need to:
1. Join the @realmkit organization on npm
2. Or publish under a different scope

### 2FA Issues
If you have 2FA enabled:
```bash
npm publish --access public --otp=YOUR_2FA_CODE
```

## Complete Command Sequence

```bash
# From the realmkit-cli directory
cd /Users/nir.bendavid/prj/boiler/realmkit-cli

# Login (first time only)
npm login

# Build
npm run build

# Publish
npm publish --access public

# Tag in git
git tag v0.1.0
git push origin v0.1.0
```

## Success!
Once published, users can install with:
```bash
npm install -g @realmkit/cli
```

And use it immediately:
```bash
realmkit create realmkitai/saas-starter my-app
```