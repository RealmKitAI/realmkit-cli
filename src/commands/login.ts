import chalk from 'chalk'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import { configCommand, getConfig } from './config'
import ora from 'ora'
import { execSync } from 'child_process'
import http from 'http'
import { URL } from 'url'

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
        { name: 'Browser (Recommended)', value: 'browser' },
        { name: 'Email & Password', value: 'email' },
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

  if (method === 'browser') {
    console.log('')
    console.log(chalk.blue('🌐 Starting browser authentication...'))
    console.log('')
    
    // Start a local server to receive the callback
    const port = 9876
    let server: http.Server | null = null
    let tokenReceived = false
    
    const spinner = ora('Waiting for browser authentication...').start()
    
    try {
      // Create a promise that resolves when we receive the token
      const tokenPromise = new Promise<{ token: string, user: any }>((resolve, reject) => {
        server = http.createServer((req, res) => {
          // Handle CORS for browser requests
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          
          if (req.method === 'OPTIONS') {
            res.writeHead(200)
            res.end()
            return
          }
          
          if (req.method === 'POST' && req.url === '/auth-callback') {
            let body = ''
            req.on('data', chunk => {
              body += chunk.toString()
            })
            req.on('end', () => {
              try {
                const data = JSON.parse(body)
                tokenReceived = true
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true }))
                resolve(data)
              } catch (error) {
                res.writeHead(400)
                res.end('Invalid request')
                reject(error)
              }
            })
          } else {
            res.writeHead(404)
            res.end('Not found')
          }
        })
        
        server.listen(port, () => {
          // Open browser to the signin page with CLI callback
          const config = getConfig()
          const hubUrl = config.hubUrl || 'https://realmkit.com'
          const authUrl = `${hubUrl}/auth/signin?cli=true&callback=/auth/cli-callback&port=${port}`
          
          console.log(chalk.gray('Opening browser...'))
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
        })
        
        // Set a timeout
        setTimeout(() => {
          if (!tokenReceived) {
            reject(new Error('Authentication timeout'))
          }
        }, 120000) // 2 minute timeout
      })
      
      // Wait for the token
      const { token, user } = await tokenPromise
      
      spinner.succeed('Authentication successful!')
      
      // Save the token
      await configCommand('token', token)
      
      console.log('')
      console.log(chalk.green(`✅ Logged in as ${chalk.bold(user.name || user.email)}`))
      console.log(chalk.gray('Your authentication token has been saved'))
      
    } catch (error) {
      spinner.fail('Authentication failed')
      console.error(chalk.red(`❌ Error: ${error}`))
      console.log('')
      console.log(chalk.yellow('If the browser authentication failed, you can try:'))
      console.log(chalk.gray('  1. Sign in manually at https://realmkit.com'))
      console.log(chalk.gray('  2. Generate an API token from your profile'))
      console.log(chalk.gray('  3. Run: realmkit login --token YOUR_TOKEN'))
      process.exit(1)
    } finally {
      // Clean up the server
      if (server) {
        (server as http.Server).close()
      }
    }
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