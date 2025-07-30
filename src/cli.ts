#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { extractCommand } from './commands/extract'
import { createCommand } from './commands/create'
import { listCommand } from './commands/list'
import { initCommand } from './commands/init'
import { configCommand } from './commands/config'

const program = new Command()

// Main CLI configuration
program
  .name('realmkit')
  .description('RealmKit CLI - Extract and create realms from existing projects')
  .version('0.1.0')

// Global options
program
  .option('-v, --verbose', 'enable verbose logging')
  .option('--no-color', 'disable colored output')

// Commands
program
  .command('extract')
  .description('Extract a realm from an existing project')
  .argument('[project-path]', 'path to the project to extract from', '.')
  .option('-o, --output <path>', 'output directory for the extracted realm', './extracted-realm')
  .option('-n, --name <name>', 'name for the extracted realm')
  .option('--include <patterns>', 'comma-separated patterns to include')
  .option('--exclude <patterns>', 'comma-separated patterns to exclude')
  .action(extractCommand)

program
  .command('create')
  .description('Create a new project from a realm')
  .argument('<realm>', 'realm name or path')
  .argument('<project-name>', 'name for the new project')
  .argument('[output-dir]', 'output directory', './projects')
  .option('--no-install', 'skip npm install')
  .option('--no-git', 'skip git initialization')
  .option('--features <features>', 'comma-separated list of features to enable')
  .option('--no-<feature>', 'disable specific features (e.g., --no-payments)')
  .option('--accept-terms', 'automatically accept download disclaimer (for CI/CD)')
  .action(createCommand)

program
  .command('list')
  .description('List available realms')
  .option('-l, --local', 'list only local realms')
  .option('-r, --remote', 'list only remote realms')
  .option('--category <category>', 'filter by category')
  .action(listCommand)

program
  .command('init')
  .description('Initialize RealmKit in the current project')
  .option('-f, --force', 'overwrite existing configuration')
  .action(initCommand)

program
  .command('config')
  .description('Manage RealmKit CLI configuration')
  .argument('[key]', 'configuration key to get/set')
  .argument('[value]', 'value to set (omit to get current value)')
  .option('--list', 'list all configuration')
  .option('--reset', 'reset configuration to defaults')
  .action(configCommand)

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red(`❌ Unknown command: ${program.args.join(' ')}`))
  console.log('')
  console.log('Available commands:')
  program.outputHelp()
  process.exit(1)
})

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
  process.exit(0)
}

// Parse and execute
program.parse()

// Handle global options
if (program.opts().verbose) {
  process.env.REALMKIT_VERBOSE = 'true'
}

if (program.opts().noColor) {
  process.env.FORCE_COLOR = '0'
}