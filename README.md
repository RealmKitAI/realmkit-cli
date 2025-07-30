# RealmKit CLI

**Extract and create realms from existing projects**

RealmKit CLI is a powerful tool that allows you to extract reusable project templates ("realms") from existing codebases and create new projects from those templates. It's designed to accelerate development by capturing and reusing proven architectural patterns, complete with AI-ready context.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build the CLI
npm run build

# Run in development mode
npm run dev

# Test the CLI commands
npm run dev init
npm run dev extract ./my-project
npm run dev create ./extracted-realm my-new-project
```

## 📋 Table of Contents

- [Installation](#installation)
- [Commands](#commands)
- [Code Architecture](#code-architecture)
- [Development](#development)
- [Examples](#examples)
- [Configuration](#configuration)
- [Contributing](#contributing)

## 🔧 Installation

### For Development (Local)

1. **Clone and install dependencies:**
   ```bash
   cd /path/to/realmkit-cli
   npm install
   npm run build
   ```

2. **Install globally for local development:**
   ```bash
   npm install -g .
   ```

3. **Configure for local development:**
   ```bash
   # Set your local RealmKit Hub URL
   realmkit config hubUrl http://localhost:3000
   
   # Verify configuration
   realmkit config --list
   ```

4. **Alternative: Use environment variables:**
   ```bash
   export REALMKIT_HUB_URL="http://localhost:3000"
   realmkit create namespace/realm-name my-project
   ```

### For Production

```bash
npm install -g @realmkit/cli
```

### Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **TypeScript**: ^5.0.0

## 🔧 Configuration

The CLI supports configuration through:

1. **Config file** (`~/.realmkit/config.json`)
2. **Environment variables** (override config file)
3. **Command line** (`realmkit config` command)

### Available Configuration Keys

- `hubUrl` - RealmKit Hub URL (default: https://realmkit.com)
- `token` - Authentication token for private realms
- `defaultNamespace` - Default namespace for realm lookups
- `timeout` - Request timeout in milliseconds (default: 30000)

### Configuration Commands

```bash
# List all configuration
realmkit config --list

# Get specific value
realmkit config hubUrl

# Set configuration value
realmkit config hubUrl http://localhost:3000
realmkit config token your-auth-token

# Reset to defaults
realmkit config --reset
```

### Environment Variables

Environment variables take precedence over config file:

- `REALMKIT_HUB_URL` - Hub URL
- `REALMKIT_TOKEN` - Authentication token
- `REALMKIT_DEFAULT_NAMESPACE` - Default namespace
- `REALMKIT_TIMEOUT` - Request timeout

## 🛠️ Development Setup for RealmKit Hub

If you're developing RealmKit locally:

1. **Start your RealmKit Hub:**
   ```bash
   cd /path/to/realmkit-hub
   npm run dev  # Usually runs on http://localhost:3000
   ```

2. **Configure CLI for local development:**
   ```bash
   realmkit config hubUrl http://localhost:3000
   ```

3. **Test the connection:**
   ```bash
   realmkit list  # Should connect to your local hub
   ```

## 📚 Commands

### `realmkit init`

Initialize RealmKit in the current project.

```bash
realmkit init [options]

Options:
  -f, --force    Overwrite existing configuration
```

**What it does:**
- Creates `.realmkit/config.yml` with project metadata
- Prompts for project information (name, type, features)
- Adds RealmKit entries to `.gitignore`
- Sets up project tracking

### `realmkit extract`

Extract a realm from an existing project.

```bash
realmkit extract [project-path] [options]

Arguments:
  project-path          Path to project (default: current directory)

Options:
  -o, --output <path>   Output directory (default: ./extracted-realm)
  -n, --name <name>     Name for the extracted realm
  --include <patterns>  Comma-separated patterns to include
  --exclude <patterns>  Comma-separated patterns to exclude
```

**What it does:**
- Analyzes project structure and dependencies
- Detects features (auth, payments, email, admin, etc.)
- Identifies architectural patterns
- Creates template files with variable substitution
- Generates `realm.yml` manifest
- Produces detailed analysis report

### `realmkit create`

Create a new project from a realm.

```bash
realmkit create <realm> <project-name> [output-dir] [options]

Arguments:
  realm                 Realm name or path
  project-name          Name for the new project
  output-dir            Output directory (default: ./projects)

Options:
  --no-install          Skip npm install
  --no-git              Skip git initialization
  --features <list>     Comma-separated features to enable
  --no-<feature>        Disable specific features (e.g., --no-payments)
```

**What it does:**
- Interactive feature selection
- Variable substitution with user input
- Template processing and file generation
- Dependency installation (optional)
- Git repository initialization (optional)
- Project tracking setup

### `realmkit list`

List available realms.

```bash
realmkit list [options]

Options:
  -l, --local           List only local realms
  -r, --remote          List only remote realms
  --category <category> Filter by category
```

**What it does:**
- Searches for realms in standard locations
- Displays realm metadata (name, version, features)
- Shows usage examples
- Filters by category if specified

## 🏗️ Code Architecture

### Project Structure

```
realmkit-cli/
├── src/
│   ├── cli.ts              # Main CLI entry point
│   ├── commands/           # Command implementations
│   │   ├── create.ts       # Project creation from realms
│   │   ├── extract.ts      # Realm extraction from projects
│   │   ├── init.ts         # RealmKit initialization
│   │   └── list.ts         # Realm listing
│   └── lib/                # Core libraries
│       ├── project-creator.ts    # Project creation logic
│       └── realm-extractor.ts    # Realm extraction logic
├── package.json
├── tsconfig.json
└── README.md
```

### Key Components

#### CLI Entry Point (`src/cli.ts`)
- Built with **Commander.js** for robust CLI handling
- Defines all commands and their options
- Handles global options (verbose, no-color)
- Provides helpful error messages

#### Commands (`src/commands/`)
- **User Interface Layer**: Handles user interaction with inquirer prompts
- **Input Validation**: Validates paths, options, and user input
- **Progress Feedback**: Uses ora spinners and chalk colors
- **Error Handling**: Graceful error handling with helpful messages

#### Core Libraries (`src/lib/`)

**ProjectCreator** (`project-creator.ts`):
```typescript
class ProjectCreator {
  // Creates projects from realm templates
  async create(): Promise<void>
  
  // Key features:
  - Template variable substitution
  - Feature flag processing
  - File filtering based on enabled features
  - Setup step execution
  - Project tracking
}
```

**RealmExtractor** (`realm-extractor.ts`):
```typescript
class RealmExtractor {
  // Extracts realms from existing projects
  async extract(): Promise<ExtractionResult>
  
  // Key features:
  - Project analysis (framework, dependencies, structure)
  - Feature detection (auth, payments, email, etc.)
  - Template transformation with variable placeholders
  - Architectural pattern recognition
  - Realm manifest generation
}
```

### Technology Stack

- **CLI Framework**: Commander.js
- **Interactive Prompts**: Inquirer.js
- **Output Styling**: Chalk
- **Loading Indicators**: Ora
- **YAML Parsing**: yaml
- **Language**: TypeScript
- **Testing**: Jest

## 🛠️ Development

### Building

```bash
# Build once
npm run build

# Watch mode (rebuilds on changes)
npm run build -- --watch
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Development Commands

```bash
# Run CLI in development mode
npm run dev <command>

# Examples:
npm run dev init
npm run dev extract ./my-project
npm run dev create ./realm my-project
npm run dev list
```

### Adding New Commands

1. **Create command file** in `src/commands/`:
   ```typescript
   // src/commands/my-command.ts
   export async function myCommand(args: string[], options: MyOptions) {
     // Implementation
   }
   ```

2. **Add to CLI** in `src/cli.ts`:
   ```typescript
   import { myCommand } from './commands/my-command'
   
   program
     .command('my-command')
     .description('Description of my command')
     .action(myCommand)
   ```

3. **Add tests** in `tests/`:
   ```typescript
   // tests/commands/my-command.test.ts
   describe('myCommand', () => {
     // Test cases
   })
   ```

## 📖 Examples

### Complete Workflow Example

1. **Initialize a project:**
   ```bash
   cd my-saas-app
   realmkit init
   ```

2. **Extract a realm:**
   ```bash
   realmkit extract . -o ../realms/my-saas-starter -n my-saas-starter
   ```

3. **List available realms:**
   ```bash
   realmkit list
   ```

4. **Create a new project:**
   ```bash
   realmkit create ../realms/my-saas-starter new-saas-app ./projects
   ```

### Realm Structure Example

After extraction, a realm looks like this:

```
extracted-realm/
├── realm.yml                 # Realm manifest
├── templates/               # Template files
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
└── analysis-report.json    # Detailed analysis
```

### Realm Manifest Example

```yaml
name: "Modern SaaS Starter"
slug: "saas-starter"
version: "1.0.0"
description: "Production-ready SaaS with authentication, payments, email"
category: "saas"

features:
  - id: "auth"
    name: "Authentication System"
    enabled: true
    required: true
  - id: "payments"
    name: "Payment Processing"
    enabled: true
    required: false

variables:
  - name: "PROJECT_NAME"
    description: "Name of your project"
    type: "string"
    required: true
    defaultValue: "my-saas-app"

commands:
  install: "npm install"
  dev: "npm run dev"
  build: "npm run build"
```

## ⚙️ Configuration

### Environment Variables

- `REALMKIT_VERBOSE`: Enable verbose logging
- `REALMKIT_REALMS_PATH`: Custom path for realm discovery
- `FORCE_COLOR`: Control colored output

### Project Configuration

When you run `realmkit init`, it creates `.realmkit/config.yml`:

```yaml
project:
  name: "My Project"
  description: "A RealmKit project"
  type: "saas"
  features: ["auth", "payments"]
  createdAt: "2024-01-01T00:00:00.000Z"

realmkit:
  version: "0.1.0"
  initialized: "2024-01-01T00:00:00.000Z"
```

## 📋 Download Disclaimer

### Interactive Disclaimer

When downloading realms from a RealmKit Hub, the CLI will display a disclaimer and require user consent:

```bash
realmkit create realmkitai/saas-starter my-app

⚠️  IMPORTANT DISCLAIMER

By downloading this realm, you acknowledge that RealmKit is not responsible
for the downloaded content. You are solely responsible for security,
legal compliance, and permissions.

? Do you accept these terms and wish to proceed with the download? (y/N)
```

### Automated Environments

For CI/CD pipelines and automated scripts, use the `--accept-terms` flag:

```bash
# Skip disclaimer prompt for automation
realmkit create realmkitai/saas-starter my-app --accept-terms

# Example CI/CD usage
docker run --rm -v $(pwd):/workspace \
  realmkit-cli create realm-name project-name --accept-terms
```

**Security Note**: Only use `--accept-terms` when you trust the realm source and have reviewed the content policy.

## 🚦 Troubleshooting

### "Realm not found" Error

If you get `❌ Realm not found: saas-starter`, try:

1. **Use full namespace:**
   ```bash
   realmkit create realmkit-team/saas-starter my-app
   ```

2. **Check your hub URL:**
   ```bash
   realmkit config hubUrl
   ```

3. **Verify hub is running:**
   ```bash
   curl http://localhost:3000/api/realms
   ```

### Connection Issues

1. **Check configuration:**
   ```bash
   realmkit config --list
   ```

2. **Test with environment variable:**
   ```bash
   REALMKIT_HUB_URL=http://localhost:3000 realmkit create namespace/realm my-app
   ```

3. **Verify hub API is accessible:**
   ```bash
   curl http://localhost:3000/api/realms
   ```

## 🚦 Error Handling

The CLI provides comprehensive error handling:

- **File not found**: Clear messages about missing files/directories
- **Invalid realm**: Validation of realm manifests and structure
- **Permission errors**: Helpful guidance for permission issues
- **Network errors**: Graceful handling of connectivity issues
- **Validation errors**: Input validation with helpful error messages

## 🎯 Use Cases

### For Developers
- **Rapid Prototyping**: Quickly spin up new projects with proven patterns
- **Code Standardization**: Ensure consistent architecture across projects
- **Learning**: Study extracted realms to understand project structures

### For Teams
- **Template Sharing**: Share proven project structures across team members
- **Onboarding**: New developers can quickly understand project patterns
- **Best Practices**: Capture and distribute architectural decisions

### For Organizations
- **Architecture Governance**: Standardize project structures and patterns
- **Productivity**: Reduce time to set up new projects
- **Knowledge Capture**: Preserve architectural knowledge in reusable form

## 🤝 Contributing

### Development Process

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Make changes**: Follow the existing code style
4. **Add tests**: Ensure new functionality is tested
5. **Run tests**: `npm test`
6. **Build**: `npm run build`
7. **Commit**: Use conventional commit messages
8. **Push**: `git push origin feature/my-feature`
9. **Create PR**: Submit a pull request

### Code Style

- Use **TypeScript** throughout
- Follow **ESLint** configuration
- Use **Prettier** for formatting
- Add **JSDoc** comments for public APIs
- Write **tests** for new functionality

### Testing

- Unit tests for all commands
- Integration tests for complete workflows
- Test error conditions and edge cases
- Mock external dependencies appropriately

---

## 📝 License

MIT License - see LICENSE file for details.

## 🙋‍♂️ Support

For questions, issues, or contributions:

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: realmkit@example.com

---

**Built with ❤️ by the RealmKit Team**