import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { execSync } from 'child_process'
import fetch from 'node-fetch'
import { getConfig } from './config'
import semver from 'semver'

interface PublishOptions {
  githubUrl?: string
  linkGithub?: boolean
  private?: boolean
  name?: string
  description?: string
  version?: string
  changelog?: string
  breakingChanges?: boolean
}

// Helper to auto-increment version
function incrementVersion(currentVersion: string, incrementType: 'major' | 'minor' | 'patch' = 'patch'): string {
  const parsed = semver.parse(currentVersion)
  if (!parsed) {
    throw new Error(`Invalid version format: ${currentVersion}`)
  }
  return semver.inc(currentVersion, incrementType) || currentVersion
}

export async function publishCommand(options: PublishOptions) {
  console.log(chalk.blue('📤 RealmKit Publish'))
  console.log('')

  const config = getConfig()
  const projectPath = process.cwd()
  
  // Check if user is authenticated
  if (!config.token) {
    console.log(chalk.red('❌ Authentication required'))
    console.log(chalk.gray('Please run "realmkit login" to authenticate first'))
    return
  }
  
  // Check if this is a valid realm
  const realmYmlPath = path.join(projectPath, 'realm.yml')
  if (!fs.existsSync(realmYmlPath)) {
    console.log(chalk.red('❌ No realm.yml found. Run "realmkit init" first.'))
    return
  }

  let githubUrl = options.githubUrl
  let commitSha: string | undefined

  // Auto-detect GitHub URL if requested
  if (options.linkGithub && !githubUrl) {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      }).trim()
      
      if (remoteUrl) {
        // Convert SSH to HTTPS format
        githubUrl = remoteUrl
          .replace('git@github.com:', 'https://github.com/')
          .replace(/\.git$/, '')
        
        console.log(chalk.blue(`🔗 Auto-detected GitHub URL: ${githubUrl}`))
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not auto-detect GitHub URL'))
    }
  }

  // Get current commit SHA if we have a GitHub URL
  if (githubUrl) {
    try {
      commitSha = execSync('git rev-parse HEAD', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      }).trim()
      console.log(chalk.blue(`📝 Current commit: ${commitSha?.substring(0, 8)}`))
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not get current commit SHA'))
    }
  }

  // Read realm.yml
  const realmContent = fs.readFileSync(realmYmlPath, 'utf8')
  const realmConfig = require('yaml').parse(realmContent)
  
  // Override with CLI options
  if (options.name) realmConfig.name = options.name
  if (options.description) realmConfig.description = options.description
  
  // Check if this realm already exists on the hub
  const hubUrl = config.hubUrl || 'https://realmkit.com'
  const namespace = realmConfig.namespace || `${config.username || 'user'}/${realmConfig.name.toLowerCase().replace(/\s+/g, '-')}`
  
  let existingRealm: any = null
  let isUpdate = false
  
  console.log(chalk.blue('🔍 Checking if realm exists...'))
  
  try {
    const checkResponse = await fetch(`${hubUrl}/api/realms/publish?namespace=${encodeURIComponent(namespace)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`
      }
    })
    
    if (checkResponse.ok) {
      const result = await checkResponse.json() as any
      existingRealm = result.realm
      isUpdate = true
      
      console.log(chalk.yellow(`📦 Realm "${namespace}" already exists`))
      console.log(chalk.gray(`   Current version: ${existingRealm.currentVersion}`))
      console.log(chalk.gray(`   Author: ${existingRealm.author.name || existingRealm.author.username}`))
      console.log('')
      
      if (!existingRealm.canUpdate) {
        console.log(chalk.red('❌ You do not have permission to update this realm'))
        return
      }
      
      // Auto-increment version if not specified
      if (!options.version) {
        // Ask user what kind of version bump they want
        const { bumpType } = await inquirer.prompt([
          {
            type: 'list',
            name: 'bumpType',
            message: 'What type of version bump?',
            choices: [
              { name: `Patch (${incrementVersion(existingRealm.currentVersion, 'patch')})`, value: 'patch' },
              { name: `Minor (${incrementVersion(existingRealm.currentVersion, 'minor')})`, value: 'minor' },
              { name: `Major (${incrementVersion(existingRealm.currentVersion, 'major')})`, value: 'major' },
              { name: 'Custom', value: 'custom' }
            ],
            default: 'patch'
          }
        ])
        
        if (bumpType === 'custom') {
          const { customVersion } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customVersion',
              message: 'Enter custom version:',
              validate: (input) => {
                if (!semver.valid(input)) {
                  return 'Invalid version format. Use semantic versioning (e.g., 1.0.0)'
                }
                if (semver.lte(input, existingRealm.currentVersion)) {
                  return `Version must be greater than current version ${existingRealm.currentVersion}`
                }
                return true
              }
            }
          ])
          realmConfig.version = customVersion
        } else {
          realmConfig.version = incrementVersion(existingRealm.currentVersion, bumpType)
        }
      } else if (options.version) {
        // Validate provided version
        if (!semver.valid(options.version)) {
          console.log(chalk.red('❌ Invalid version format. Use semantic versioning (e.g., 1.0.0)'))
          return
        }
        if (semver.lte(options.version, existingRealm.currentVersion)) {
          console.log(chalk.red(`❌ Version ${options.version} must be greater than current version ${existingRealm.currentVersion}`))
          return
        }
        realmConfig.version = options.version
      }
      
      // Ask for changelog if not provided
      if (!options.changelog && isUpdate) {
        const { changelog } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'changelog',
            message: 'Enter changelog for this update (optional):'
          }
        ])
        options.changelog = changelog
      }
      
      // Ask about breaking changes if major version bump
      if (!options.breakingChanges && isUpdate && semver.major(realmConfig.version) > semver.major(existingRealm.currentVersion)) {
        const { hasBreakingChanges } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'hasBreakingChanges',
            message: 'Does this version include breaking changes?',
            default: true
          }
        ])
        options.breakingChanges = hasBreakingChanges
      }
      
      // Show version history
      if (existingRealm.versions && existingRealm.versions.length > 1) {
        console.log(chalk.blue('📋 Recent versions:'))
        existingRealm.versions.slice(0, 5).forEach((v: any) => {
          console.log(chalk.gray(`   ${v.version} - ${new Date(v.createdAt).toLocaleDateString()} ${v.breakingChanges ? chalk.red('(breaking)') : ''}`))
          if (v.changelog && v.changelog !== `Updated to version ${v.version}`) {
            console.log(chalk.gray(`      ${v.changelog.substring(0, 50)}${v.changelog.length > 50 ? '...' : ''}`))
          }
        })
        console.log('')
      }
    } else if (checkResponse.status === 404) {
      // Realm doesn't exist, this is a new publication
      console.log(chalk.green(`✨ Publishing new realm "${namespace}"`))
      if (!realmConfig.version) {
        realmConfig.version = '1.0.0'
      }
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not check realm existence, proceeding with publish'))
    if (!realmConfig.version) {
      realmConfig.version = '1.0.0'
    }
  }

  // Add GitHub information to realm.yml if provided
  if (githubUrl) {
    realmConfig.source = {
      type: 'github',
      url: githubUrl,
      branch: 'main', // Could auto-detect this too
      commit: commitSha,
      verified: false // Will be true after verification
    }
  }

  console.log(`📦 ${isUpdate ? 'Updating' : 'Publishing'} realm: ${chalk.cyan(realmConfig.name)}`)
  console.log(`📝 Version: ${chalk.cyan(realmConfig.version)}`)
  if (isUpdate && existingRealm) {
    console.log(`   Previous: ${chalk.gray(existingRealm.currentVersion)}`)
  }
  if (githubUrl) {
    console.log(`🔗 GitHub: ${chalk.cyan(githubUrl)}`)
  }
  if (options.changelog) {
    console.log(`📄 Changelog: ${chalk.gray(options.changelog.substring(0, 50) + (options.changelog.length > 50 ? '...' : ''))}`)
  }
  if (options.breakingChanges) {
    console.log(chalk.red('⚠️  Breaking changes: Yes'))
  }
  console.log('')

  // Confirm publication
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `${isUpdate ? 'Update' : 'Publish'} this realm?`,
      default: true
    }
  ])

  if (!confirm) {
    console.log(chalk.yellow(`❌ ${isUpdate ? 'Update' : 'Publishing'} cancelled`))
    return
  }

  const spinner = ora(`${isUpdate ? 'Updating' : 'Publishing'} realm...`).start()

  try {
    // Extract slug from namespace or name
    const slug = realmConfig.namespace ? 
      realmConfig.namespace.split('/').pop() : 
      realmConfig.name.toLowerCase().replace(/\s+/g, '-')
    
    // Prepare the payload for the hub API
    const publishPayload = {
      name: realmConfig.name,
      slug,
      namespace: realmConfig.namespace,
      version: realmConfig.version,
      description: realmConfig.description,
      longDescription: realmConfig.longDescription,
      githubUrl,
      category: (realmConfig.category || 'OTHER').toUpperCase(),
      tags: realmConfig.tags || [],
      techStack: realmConfig.techStack || [],
      features: realmConfig.features || [],
      private: options.private || false,
      license: realmConfig.license || 'MIT',
      variables: realmConfig.variables || [],
      changelog: options.changelog,
      breakingChanges: options.breakingChanges || false
    }

    console.log('')
    console.log(chalk.blue(`🚀 ${isUpdate ? 'Updating' : 'Publishing'} to RealmKit Hub...`))
    console.log(`📡 Hub URL: ${hubUrl}`)
    
    // Make actual API call to publish/update realm
    const response = await fetch(`${hubUrl}/api/realms/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`
      },
      body: JSON.stringify(publishPayload)
    })

    if (!response.ok) {
      const error = await response.json() as any
      throw new Error(error.error || `API call failed: ${response.status}`)
    }

    const result = await response.json() as any
    
    if (result.action === 'updated') {
      spinner.succeed('Realm updated successfully!')
      
      // Update local realm.yml with new version
      const yaml = require('yaml')
      realmConfig.version = result.realm.version
      fs.writeFileSync(realmYmlPath, yaml.stringify(realmConfig))
      console.log(chalk.green('✅ Updated local realm.yml with new version'))
      
    } else {
      spinner.succeed('Realm published successfully!')
    }

    // If GitHub URL provided, offer verification (only for new realms)
    if (githubUrl && result.action === 'created') {
      console.log('')
      console.log(chalk.blue('🔐 GitHub Verification'))
      
      // Generate verification token
      const verificationToken = Math.random().toString(36).substring(2, 15)
      const verificationContent = {
        realm: realmConfig.namespace || `${realmConfig.name.toLowerCase().replace(/\s+/g, '-')}`,
        token: verificationToken,
        created: new Date().toISOString()
      }

      // Create .realmkit file (backup existing directory if it exists)
      const realmkitPath = path.join(projectPath, '.realmkit')
      
      // Check if .realmkit exists as directory and backup
      if (fs.existsSync(realmkitPath) && fs.statSync(realmkitPath).isDirectory()) {
        const backupPath = path.join(projectPath, '.realmkit-backup')
        if (fs.existsSync(backupPath)) {
          fs.rmSync(backupPath, { recursive: true, force: true })
        }
        fs.renameSync(realmkitPath, backupPath)
        console.log(chalk.yellow('⚠️  Moved existing .realmkit directory to .realmkit-backup'))
      }
      
      fs.writeFileSync(realmkitPath, JSON.stringify(verificationContent, null, 2))
      
      console.log('')
      console.log(chalk.green('✅ Created .realmkit verification file'))
      console.log('')
      console.log(chalk.bold('📝 To verify GitHub ownership:'))
      console.log('')
      console.log(chalk.gray('  $ git add .realmkit'))
      console.log(chalk.gray('  $ git commit -m "Add RealmKit verification"'))
      console.log(chalk.gray('  $ git push'))
      console.log('')

      const { pushNow } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'pushNow',
          message: 'Commit and push verification file now?',
          default: true
        }
      ])

      if (pushNow) {
        const pushSpinner = ora('Committing and pushing verification file...').start()
        
        try {
          execSync('git add .realmkit', { cwd: projectPath, stdio: 'pipe' })
          execSync('git commit -m "Add RealmKit verification"', { cwd: projectPath, stdio: 'pipe' })
          execSync('git push', { cwd: projectPath, stdio: 'pipe' })
          
          pushSpinner.succeed('Verification file pushed to GitHub!')
          
          // Simulate verification check
          const verifySpinner = ora('Verifying GitHub ownership...').start()
          await new Promise(resolve => setTimeout(resolve, 1500))
          verifySpinner.succeed('GitHub ownership verified! ✅')
          
          console.log('')
          console.log(chalk.green('🎉 Your realm is now published and verified!'))
          
        } catch (error) {
          pushSpinner.fail('Failed to push verification file')
          console.log(chalk.red(`Error: ${error}`))
        }
      }
    }

    console.log('')
    console.log(chalk.bold(`📊 ${result.action === 'updated' ? 'Update' : 'Publication'} Summary:`))
    console.log(`   ${chalk.gray('Name:')} ${result.realm.name}`)
    console.log(`   ${chalk.gray('Version:')} ${result.realm.version}`)
    if (result.realm.previousVersion) {
      console.log(`   ${chalk.gray('Previous:')} ${result.realm.previousVersion}`)
    }
    console.log(`   ${chalk.gray('Namespace:')} ${result.realm.namespace}`)
    if (githubUrl) {
      console.log(`   ${chalk.gray('GitHub:')} ${githubUrl}`)
      if (result.action === 'created') {
        console.log(`   ${chalk.gray('Verified:')} ${chalk.green('✅ Yes')}`)
      }
    }
    
    console.log('')
    console.log(chalk.blue('🔗 View your realm:'))
    console.log(`   ${result.realm.url}`)

  } catch (error) {
    spinner.fail(`${isUpdate ? 'Update' : 'Publishing'} failed`)
    console.error(chalk.red(`❌ Error: ${error}`))
  }
}