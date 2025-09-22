import chalk from 'chalk'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import { configCommand } from './config'
import ora from 'ora'
import { execSync } from 'child_process'

interface LoginOptions {
  token?: string
}

export async function loginCommand(options: LoginOptions) {
  console.log(chalk.blue('🔐 RealmKit Login'))
  console.log('')

  // If token is provided directly
  if (options.token) {
    await configCommand('token', options.token)
    console.log(chalk.green('✅ Token saved successfully'))
    return
  }

  // Interactive login
  const { method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: 'How would you like to authenticate?',
      choices: [
        { name: 'Email & Password', value: 'email' },
        { name: 'GitHub OAuth (browser)', value: 'github' },
        { name: 'API Token', value: 'token' }
      ]
    }
  ])

  if (method === 'token') {
    const { token } = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Enter your API token:',
        mask: '*'
      }
    ])
    
    await configCommand('token', token)
    console.log(chalk.green('✅ Token saved successfully'))
    return
  }

  if (method === 'email') {
    const { email, password } = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Email:',
        validate: (input) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          return emailRegex.test(input) || 'Please enter a valid email'
        }
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '*'
      }
    ])

    const spinner = ora('Authenticating...').start()

    try {
      const response = await fetch('https://realmkit.com/api/auth/cli', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Authentication failed')
      }

      const { token, user } = await response.json() as { token: string, user: { name: string, email: string } }
      
      await configCommand('token', token)
      
      spinner.succeed('Authentication successful!')
      console.log('')
      console.log(chalk.green(`✅ Logged in as ${chalk.bold(user.name || user.email)}`))
      console.log(chalk.gray('Your authentication token has been saved'))
      
    } catch (error) {
      spinner.fail('Authentication failed')
      console.error(chalk.red(`❌ Error: ${error}`))
      process.exit(1)
    }
  }

  if (method === 'github') {
    console.log('')
    console.log(chalk.blue('🌐 Opening browser for GitHub authentication...'))
    console.log('')
    
    // Generate a random state for security
    const state = Math.random().toString(36).substring(2, 15)
    
    // Open browser for OAuth flow
    const authUrl = `https://realmkit.com/auth/signin?provider=github&cli=true&state=${state}`
    
    console.log(chalk.gray('If the browser doesn\'t open automatically, visit:'))
    console.log(chalk.cyan(authUrl))
    console.log('')
    
    // Try to open browser
    try {
      const openCmd = process.platform === 'darwin' ? 'open' : 
                      process.platform === 'win32' ? 'start' : 'xdg-open'
      execSync(`${openCmd} "${authUrl}"`)
    } catch (error) {
      // Browser opening failed, user will need to open manually
    }
    
    console.log(chalk.yellow('⏳ Waiting for authentication...'))
    console.log(chalk.gray('After authenticating, copy the token from the browser and paste it here'))
    console.log('')
    
    const { token } = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Paste your token:',
        mask: '*',
        validate: (input) => input.length > 0 || 'Token is required'
      }
    ])
    
    await configCommand('token', token)
    console.log('')
    console.log(chalk.green('✅ Authentication successful!'))
    console.log(chalk.gray('You can now publish realms to RealmKit Hub'))
  }
}

export async function logoutCommand() {
  console.log(chalk.blue('👋 RealmKit Logout'))
  console.log('')
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to logout?',
      default: false
    }
  ])
  
  if (confirm) {
    await configCommand('token', '')
    console.log(chalk.green('✅ Logged out successfully'))
  } else {
    console.log(chalk.yellow('❌ Logout cancelled'))
  }
}

export async function whoamiCommand() {
  console.log(chalk.blue('👤 RealmKit Account'))
  console.log('')
  
  const config = require('./config').getConfig()
  
  if (!config.token) {
    console.log(chalk.yellow('⚠️  Not logged in'))
    console.log(chalk.gray('Run "realmkit login" to authenticate'))
    return
  }
  
  const spinner = ora('Fetching account info...').start()
  
  try {
    const response = await fetch('https://realmkit.com/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${config.token}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch user info')
    }
    
    const user = await response.json() as any
    
    spinner.succeed('Account info fetched')
    console.log('')
    console.log(chalk.cyan('Name:     '), user.name || chalk.gray('(not set)'))
    console.log(chalk.cyan('Email:    '), user.email)
    console.log(chalk.cyan('Username: '), user.username || chalk.gray('(not set)'))
    console.log(chalk.cyan('Role:     '), user.role || 'USER')
    console.log(chalk.cyan('Status:   '), chalk.green('● Active'))
    
  } catch (error) {
    spinner.fail('Failed to fetch account info')
    console.error(chalk.red('❌ Error: Not authenticated or token expired'))
    console.log(chalk.gray('Run "realmkit login" to authenticate'))
  }
}