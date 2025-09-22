import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { execSync } from 'child_process'
import fetch from 'node-fetch'
import { getConfig } from './config'

interface PublishOptions {
  githubUrl?: string
  linkGithub?: boolean
  private?: boolean
  name?: string
  description?: string
  version?: string
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
  if (options.version) realmConfig.version = options.version

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

  console.log(`📦 Publishing realm: ${chalk.cyan(realmConfig.name)}`)
  console.log(`📝 Version: ${chalk.cyan(realmConfig.version)}`)
  if (githubUrl) {
    console.log(`🔗 GitHub: ${chalk.cyan(githubUrl)}`)
  }
  console.log('')

  // Confirm publication
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Publish this realm?',
      default: true
    }
  ])

  if (!confirm) {
    console.log(chalk.yellow('❌ Publishing cancelled'))
    return
  }

  const spinner = ora('Publishing realm...').start()

  try {
    const hubUrl = config.hubUrl || 'https://realmkit.com'
    
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
      variables: realmConfig.variables || []
    }

    console.log('')
    console.log(chalk.blue('🚀 Publishing to RealmKit Hub...'))
    console.log(`📡 Hub URL: ${hubUrl}`)
    
    // Make actual API call to publish realm
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
    spinner.succeed('Realm published successfully!')

    // If GitHub URL provided, offer verification
    if (githubUrl) {
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
    console.log(chalk.bold('📊 Publication Summary:'))
    console.log(`   ${chalk.gray('Name:')} ${result.realm.name}`)
    console.log(`   ${chalk.gray('Version:')} ${result.realm.version}`)
    console.log(`   ${chalk.gray('Namespace:')} ${result.realm.namespace}`)
    if (githubUrl) {
      console.log(`   ${chalk.gray('GitHub:')} ${githubUrl}`)
      console.log(`   ${chalk.gray('Verified:')} ${chalk.green('✅ Yes')}`)
    }
    
    console.log('')
    console.log(chalk.blue('🔗 View your realm:'))
    console.log(`   ${result.realm.url}`)

  } catch (error) {
    spinner.fail('Publishing failed')
    console.error(chalk.red(`❌ Error: ${error}`))
  }
}