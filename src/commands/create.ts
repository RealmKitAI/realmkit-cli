import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { ProjectCreator } from '../lib/project-creator'

interface CreateOptions {
  install: boolean
  git: boolean
  features?: string
  [key: string]: any // For --no-<feature> options
}

export async function createCommand(realmPath: string, projectName: string, outputDir: string, options: CreateOptions) {
  console.log(chalk.blue('🚀 RealmKit Project Creation'))
  console.log('')
  
  const resolvedRealmPath = path.resolve(realmPath)
  const projectPath = path.join(outputDir, projectName)
  const resolvedProjectPath = path.resolve(projectPath)
  
  console.log(`📦 Realm: ${chalk.cyan(resolvedRealmPath)}`)
  console.log(`📂 Project: ${chalk.cyan(projectName)}`)
  console.log(`📁 Output: ${chalk.cyan(resolvedProjectPath)}`)
  console.log('')
  
  // Check if realm exists (try both locations)
  let realmManifestPath = path.join(resolvedRealmPath, 'realm.yml')
  if (!fs.existsSync(realmManifestPath)) {
    realmManifestPath = path.join(resolvedRealmPath, '.realmkit', 'realm.yml')
  }
  if (!fs.existsSync(realmManifestPath)) {
    console.error(chalk.red('❌ Realm not found:'), realmManifestPath)
    console.log('')
    console.log(chalk.gray('Available realms:'))
    // TODO: List available realms
    process.exit(1)
  }
  
  // Load realm manifest to get available features
  const yaml = require('yaml')
  const manifestContent = fs.readFileSync(realmManifestPath, 'utf8')
  const manifest = yaml.parse(manifestContent)
  
  // Determine enabled features
  const availableFeatures = manifest.features?.map((f: any) => f.id) || []
  let enabledFeatures = [...availableFeatures] // Start with all features
  
  // Apply feature options from command line
  if (options.features) {
    enabledFeatures = options.features.split(',').map(f => f.trim())
  }
  
  // Handle --no-<feature> options
  for (const [key, value] of Object.entries(options)) {
    if (key.startsWith('no') && value === false) {
      const feature = key.substring(2).toLowerCase()
      enabledFeatures = enabledFeatures.filter(f => f !== feature)
    }
  }
  
  // Interactive feature selection if none specified
  if (!options.features && availableFeatures.length > 0) {
    const { selectedFeatures } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedFeatures',
        message: 'Select features to include:',
        choices: availableFeatures.map((feature: string) => ({
          name: feature,
          value: feature,
          checked: true // Default to all enabled
        })),
        validate: (selected: string[]) => {
          if (selected.length === 0) return 'Please select at least one feature'
          return true
        }
      }
    ])
    enabledFeatures = selectedFeatures
  }
  
  // Collect required variables
  const requiredVars = manifest.variables?.filter((v: any) => v.required) || []
  const variables: Record<string, any> = {
    PROJECT_NAME: projectName,
    PROJECT_DESCRIPTION: `A ${projectName} application`
  }
  
  // Prompt for additional required variables
  if (requiredVars.length > 0) {
    console.log(chalk.bold('📝 Configuration:'))
    
    for (const variable of requiredVars) {
      if (variables[variable.name]) continue // Skip if already set
      
      const { value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: `${variable.description}:`,
          default: variable.defaultValue,
          validate: (input: string) => {
            if (!input.trim()) return `${variable.name} is required`
            return true
          }
        }
      ])
      variables[variable.name] = value
    }
    console.log('')
  }
  
  // Confirm creation
  console.log(chalk.bold('🎯 Project Configuration:'))
  console.log(`   ${chalk.gray('Name:')} ${projectName}`)
  console.log(`   ${chalk.gray('Realm:')} ${manifest.name} v${manifest.version}`)
  console.log(`   ${chalk.gray('Features:')} ${enabledFeatures.join(', ')}`)
  console.log(`   ${chalk.gray('Install deps:')} ${options.install ? 'Yes' : 'No'}`)
  console.log(`   ${chalk.gray('Initialize git:')} ${options.git ? 'Yes' : 'No'}`)
  console.log('')
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Create project with these settings?',
      default: true
    }
  ])
  
  if (!confirm) {
    console.log(chalk.yellow('❌ Project creation cancelled'))
    return
  }
  
  // Create project
  const spinner = ora('Creating project...').start()
  
  try {
    const config = {
      projectName,
      realmPath: resolvedRealmPath,
      outputPath: resolvedProjectPath,
      variables,
      enabledFeatures
    }
    
    const creator = new ProjectCreator(config)
    
    spinner.text = 'Setting up project structure...'
    await creator.create()
    
    // Initialize git if requested
    if (options.git) {
      spinner.text = 'Initializing git repository...'
      const { execSync } = require('child_process')
      execSync('git init', { cwd: resolvedProjectPath, stdio: 'pipe' })
      execSync('git add .', { cwd: resolvedProjectPath, stdio: 'pipe' })
      execSync('git commit -m "Initial commit from RealmKit"', { cwd: resolvedProjectPath, stdio: 'pipe' })
    }
    
    spinner.succeed('Project created successfully!')
    
    // Success message
    console.log('')
    console.log(chalk.green('✅ Project created successfully!'))
    console.log('')
    console.log(chalk.bold('🎯 Next Steps:'))
    console.log(`   ${chalk.gray('1.')} cd ${projectName}`)
    
    if (!options.install) {
      console.log(`   ${chalk.gray('2.')} npm install`)
    }
    
    console.log(`   ${chalk.gray(options.install ? '2.' : '3.')} Copy .env.example to .env.local and configure`)
    console.log(`   ${chalk.gray(options.install ? '3.' : '4.')} npm run dev`)
    console.log('')
    console.log(chalk.bold('📚 Documentation:'))
    console.log(`   ${chalk.gray('•')} Project README: ${chalk.cyan(path.join(projectName, 'README.md'))}`)
    console.log(`   ${chalk.gray('•')} AI Context: ${chalk.cyan(path.join(projectName, '.realmkit/ai-context/'))}`)
    
  } catch (error) {
    spinner.fail('Project creation failed')
    console.log('')
    console.error(chalk.red('❌ Error:'), error)
    process.exit(1)
  }
}