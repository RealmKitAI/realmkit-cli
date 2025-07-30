import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import { ProjectCreator } from '../lib/project-creator'
import { getConfig } from './config'

interface CreateOptions {
  install: boolean
  git: boolean
  features?: string
  acceptTerms?: boolean
  [key: string]: any // For --no-<feature> options
}

export async function createCommand(realmPath: string, projectName: string, outputDir: string, options: CreateOptions) {
  console.log(chalk.blue('🚀 RealmKit Project Creation'))
  console.log('')
  
  const config = getConfig()
  // Create project in current directory, not in outputDir/projectName
  const projectPath = path.resolve(projectName)
  const resolvedProjectPath = projectPath
  
  console.log(`📦 Realm: ${chalk.cyan(realmPath)}`)
  console.log(`📂 Project: ${chalk.cyan(projectName)}`)
  console.log(`📁 Output: ${chalk.cyan(resolvedProjectPath)}`)
  console.log('')
  
  // Check if this is a namespace/realm format (remote) or local path
  let realmManifestPath: string
  let manifest: any
  let isRemoteRealm = false
  
  // Check if this is a local directory first
  const resolvedRealmPath = path.resolve(realmPath)
  const localRealmExists = fs.existsSync(resolvedRealmPath) && fs.statSync(resolvedRealmPath).isDirectory()
  
  if (localRealmExists) {
    // Local realm directory found
    isRemoteRealm = false
    console.log(chalk.blue('📁 Using local realm...'))
    
    // Check for realm.yml
    realmManifestPath = path.join(resolvedRealmPath, 'realm.yml')
    if (!fs.existsSync(realmManifestPath)) {
      realmManifestPath = path.join(resolvedRealmPath, '.realmkit', 'realm.yml')
    }
    if (!fs.existsSync(realmManifestPath)) {
      console.error(chalk.red('❌ Realm manifest not found:'), realmManifestPath)
      console.log('')
      console.log(chalk.gray('Expected: realm.yml or .realmkit/realm.yml'))
      process.exit(1)
    }
    
    // Load local manifest
    const yaml = require('yaml')
    const manifestContent = fs.readFileSync(realmManifestPath, 'utf8')
    manifest = yaml.parse(manifestContent)
    console.log(chalk.green('✅ Realm loaded successfully!'))
  } else if (realmPath.includes('/') && !path.isAbsolute(realmPath) && !realmPath.startsWith('.')) {
    // This looks like a namespace/realm format - fetch from hub
    isRemoteRealm = true
    console.log(chalk.blue('🌐 Fetching realm from RealmKit Hub...'))
    
    // Show disclaimer and get user consent (unless --accept-terms flag is used)
    if (!options.acceptTerms) {
      console.log('')
      console.log(chalk.yellow('⚠️  IMPORTANT DISCLAIMER'))
      console.log('')
      console.log(chalk.gray('By downloading this realm, you acknowledge that RealmKit is not responsible'))
      console.log(chalk.gray('for the downloaded content. You are solely responsible for security,'))
      console.log(chalk.gray('legal compliance, and permissions.'))
      console.log('')
      
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Do you accept these terms and wish to proceed with the download?',
          default: false
        }
      ])
      
      if (!proceed) {
        console.log('')
        console.log(chalk.red('❌ Download cancelled by user'))
        console.log(chalk.gray('You can run this command again when ready to accept the terms.'))
        console.log(chalk.gray('Or use --accept-terms flag to skip this prompt.'))
        process.exit(0)
      }
      
      console.log('')
      console.log(chalk.green('✅ Terms accepted, proceeding with download...'))
    } else {
      console.log(chalk.gray('📋 Terms automatically accepted via --accept-terms flag'))
    }
    
    try {
      // Make API call to hub to get realm data
      const hubUrl = config.hubUrl
      const response = await fetch(`${hubUrl}/api/realms/${realmPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'download' })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json() as any
      
      if (!data.success || !data.realm) {
        throw new Error('Invalid response from hub')
      }
      
      manifest = data.realm.manifest
      console.log(chalk.green('✅ Realm fetched successfully!'))
    } catch (error) {
      console.error(chalk.red('❌ Failed to fetch realm from hub:'), error)
      console.log('')
      console.log(chalk.gray('Make sure the realm exists and you have access to it.'))
      console.log(chalk.gray('Hub URL:'), config.hubUrl)
      process.exit(1)
    }
  } else {
    // Local realm path that doesn't exist
    console.error(chalk.red('❌ Realm not found:'), realmPath)
    console.log('')
    console.log(chalk.gray('Available options:'))
    console.log(chalk.gray('  • Use a namespace/realm format: realmkit-team/saas-starter'))
    console.log(chalk.gray('  • Use a local path to a realm directory'))
    process.exit(1)
  }
  
  // Use all features by default (simplified UX)
  const availableFeatures = manifest.features?.map((f: any) => f.id) || []
  const enabledFeatures = [...availableFeatures]
  
  // Set up basic project variables
  const variables: Record<string, any> = {
    PROJECT_NAME: projectName,
    PROJECT_DESCRIPTION: `A ${projectName} application`
  }
  
  console.log(chalk.bold('🎯 Creating Project:'))
  console.log(`   ${chalk.gray('Name:')} ${projectName}`)
  console.log(`   ${chalk.gray('Realm:')} ${manifest.name} v${manifest.version}`)
  console.log(`   ${chalk.gray('Features:')} All included`)
  console.log('')
  
  // Create project
  const spinner = ora('Creating project...').start()
  
  try {
    // Create project directory
    if (!fs.existsSync(resolvedProjectPath)) {
      fs.mkdirSync(resolvedProjectPath, { recursive: true })
    }
    
    if (isRemoteRealm) {
      // Try to download actual realm files from hub
      spinner.text = 'Downloading realm files...'
      
      try {
        // Make API call to get download URL
        const hubUrl = config.hubUrl
        const downloadResponse = await fetch(`${hubUrl}/api/realms/${realmPath}/files`, {
          method: 'GET'
        })
        
        if (!downloadResponse.ok) {
          throw new Error(`Failed to get download URL: ${downloadResponse.status}`)
        }
        
        const downloadData = await downloadResponse.json() as any
        
        if (!downloadData.success || !downloadData.realm.downloadUrl) {
          throw new Error('Invalid download response from hub')
        }
        
        spinner.text = 'Downloading realm archive...'
        
        // Download the realm archive from MinIO
        const archiveResponse = await fetch(downloadData.realm.downloadUrl)
        
        if (!archiveResponse.ok) {
          throw new Error(`Failed to download realm archive: ${archiveResponse.status}`)
        }
        
        const archiveBuffer = Buffer.from(await archiveResponse.arrayBuffer())
        
        // Create temporary file for extraction
        const tempArchivePath = path.join(process.cwd(), `temp-realm-${Date.now()}.tar.gz`)
        fs.writeFileSync(tempArchivePath, archiveBuffer)
        
        spinner.text = 'Extracting realm files...'
        
        // Extract archive to project directory
        const { execSync } = require('child_process')
        execSync(`tar -xzf "${tempArchivePath}" -C "${resolvedProjectPath}" --strip-components=1`, { stdio: 'pipe' })
        
        // Clean up temporary archive
        fs.unlinkSync(tempArchivePath)
        
        spinner.text = 'Customizing project...'
        
        // Update package.json with project name
        const packageJsonPath = path.join(resolvedProjectPath, 'package.json')
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
          packageJson.name = projectName
          packageJson.description = `${packageJson.description || 'A RealmKit project'} - Created from ${realmPath}`
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
        }
        
        // Update .env.example with project name
        const envExamplePath = path.join(resolvedProjectPath, '.env.example')
        if (fs.existsSync(envExamplePath)) {
          let envContent = fs.readFileSync(envExamplePath, 'utf8')
          envContent = envContent.replace(/My SaaS/g, projectName)
          envContent = envContent.replace(/myapp/g, projectName.toLowerCase().replace(/[^a-z0-9]/g, ''))
          fs.writeFileSync(envExamplePath, envContent)
        }
        
      } catch (downloadError: any) {
        console.log('')
        console.log(chalk.yellow('⚠️  File download failed, creating basic project structure...'))
        console.log(chalk.gray('Error:', downloadError.message))
        
        // Fallback to basic project creation
        spinner.text = 'Creating project from realm template...'
        
        // Create a basic project structure based on the manifest
        const packageJson: any = {
          name: projectName,
          version: '1.0.0',
          description: `${manifest.description || 'A RealmKit project'} - Created from ${realmPath}`,
          private: true,
          scripts: {
            dev: 'echo "Development server not yet configured"',
            build: 'echo "Build not yet configured"',
            start: 'echo "Start not yet configured"'
          },
          dependencies: {},
          devDependencies: {}
        }
        
        // Add tech stack based dependencies if available
        if (manifest.techStack) {
          manifest.techStack.forEach((tech: string) => {
            if (tech.includes('Next.js')) {
              packageJson.dependencies['next'] = '^14.0.0'
              packageJson.dependencies['react'] = '^18.0.0'
              packageJson.dependencies['react-dom'] = '^18.0.0'
              packageJson.scripts.dev = 'next dev'
              packageJson.scripts.build = 'next build'
              packageJson.scripts.start = 'next start'
            }
            if (tech.includes('TypeScript')) {
              packageJson.devDependencies['typescript'] = '^5.0.0'
              packageJson.devDependencies['@types/node'] = '^20.0.0'
              packageJson.devDependencies['@types/react'] = '^18.0.0'
            }
            if (tech.includes('Tailwind')) {
              packageJson.devDependencies['tailwindcss'] = '^3.0.0'
            }
          })
        }
        
        // Write package.json
        fs.writeFileSync(
          path.join(resolvedProjectPath, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        )
        
        // Create README.md
        const readmeContent = `# ${projectName}

${manifest.description || 'A RealmKit project'}

Created from realm: \`${realmPath}\`

## Features

${manifest.features?.map((f: any) => `- ${f.name}: ${f.description}`).join('\n') || 'No features listed'}

## Tech Stack

${manifest.techStack?.map((tech: string) => `- ${tech}`).join('\n') || 'No tech stack listed'}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure environment variables:
   \`\`\`bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   \`\`\`

3. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Environment Variables

${manifest.variables?.map((v: any) => `- \`${v.name}\`: ${v.description}${v.required ? ' (required)' : ''}${v.defaultValue ? ` (default: ${v.defaultValue})` : ''}`).join('\n') || 'No variables documented'}

## RealmKit Integration

This project was created using RealmKit. The original realm manifest and AI context have been preserved for future reference.

For more information about RealmKit, visit: https://realmkit.com
`
        
        fs.writeFileSync(path.join(resolvedProjectPath, 'README.md'), readmeContent)
        
        // Create .env.example
        const envExample = manifest.variables?.map((v: any) => 
          `${v.name}=${v.defaultValue || ''} # ${v.description}`
        ).join('\n') || '# No environment variables defined'
        
        fs.writeFileSync(path.join(resolvedProjectPath, '.env.example'), envExample)
        
        // Create realm manifest for reference
        fs.writeFileSync(
          path.join(resolvedProjectPath, 'realm.yml'),
          `# Original realm manifest
name: "${manifest.name}"
version: "${manifest.version}"
description: "${manifest.description}"
source: "${realmPath}"
createdAt: "${new Date().toISOString()}"

# This file preserves the original realm configuration
# for reference and future RealmKit operations
`
        )
        
        console.log('')
        console.log(chalk.yellow('📝 Note: Used fallback project creation due to download error.'))
        console.log(chalk.yellow('   Created basic project structure based on realm manifest.'))
      }
      
    } else {
      // Local realm - use existing project creator
      const config = {
        projectName,
        realmPath: path.resolve(realmPath),
        outputPath: resolvedProjectPath,
        variables,
        enabledFeatures
      }
      
      const creator = new ProjectCreator(config)
      
      spinner.text = 'Setting up project structure...'
      await creator.create()
    }
    
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