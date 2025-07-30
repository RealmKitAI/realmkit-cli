import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

interface ConfigOptions {
  list?: boolean
  reset?: boolean
}

interface Config {
  hubUrl?: string
  token?: string
  defaultNamespace?: string
  timeout?: number
}

const CONFIG_DIR = path.join(os.homedir(), '.realmkit')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

const DEFAULT_CONFIG: Config = {
  hubUrl: 'https://realmkit.com',
  timeout: 30000
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
    }
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Failed to load config, using defaults'))
  }
  return { ...DEFAULT_CONFIG }
}

function saveConfig(config: Config) {
  ensureConfigDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function getConfig(): Config {
  const config = loadConfig()
  
  // Override with environment variables
  if (process.env.REALMKIT_HUB_URL) {
    config.hubUrl = process.env.REALMKIT_HUB_URL
  }
  if (process.env.REALMKIT_TOKEN) {
    config.token = process.env.REALMKIT_TOKEN
  }
  if (process.env.REALMKIT_DEFAULT_NAMESPACE) {
    config.defaultNamespace = process.env.REALMKIT_DEFAULT_NAMESPACE
  }
  if (process.env.REALMKIT_TIMEOUT) {
    config.timeout = parseInt(process.env.REALMKIT_TIMEOUT)
  }
  
  return config
}

export async function configCommand(key?: string, value?: string, options: ConfigOptions = {}) {
  const config = loadConfig()
  
  if (options.reset) {
    saveConfig(DEFAULT_CONFIG)
    console.log(chalk.green('✅ Configuration reset to defaults'))
    return
  }
  
  if (options.list || (!key && !value)) {
    console.log(chalk.blue('📋 RealmKit CLI Configuration'))
    console.log('')
    
    const displayConfig = getConfig()
    const configFile = fs.existsSync(CONFIG_FILE) ? CONFIG_FILE : 'default'
    
    console.log(chalk.gray('Config file:'), configFile)
    console.log('')
    
    // Show current configuration
    Object.entries(displayConfig).forEach(([k, v]) => {
      const source = process.env[`REALMKIT_${k.toUpperCase().replace(/([A-Z])/g, '_$1')}`] ? 
        chalk.yellow('(env)') : 
        fs.existsSync(CONFIG_FILE) ? chalk.gray('(file)') : chalk.gray('(default)')
      
      if (k === 'token' && v) {
        console.log(`${chalk.cyan(k + ':').padEnd(20)} ${chalk.gray('***masked***')} ${source}`)
      } else {
        console.log(`${chalk.cyan(k + ':').padEnd(20)} ${v || chalk.gray('(not set)')} ${source}`)
      }
    })
    
    console.log('')
    console.log(chalk.gray('Environment variables override config file values'))
    console.log(chalk.gray('Available keys: hubUrl, token, defaultNamespace, timeout'))
    return
  }
  
  if (key && !value) {
    // Get specific key
    const displayConfig = getConfig()
    const val = displayConfig[key as keyof Config]
    
    if (val !== undefined) {
      if (key === 'token' && val) {
        console.log(chalk.gray('***masked***'))
      } else {
        console.log(val)
      }
    } else {
      console.error(chalk.red(`❌ Unknown configuration key: ${key}`))
      process.exit(1)
    }
    return
  }
  
  if (key && value) {
    // Set key-value pair
    if (!['hubUrl', 'token', 'defaultNamespace', 'timeout'].includes(key)) {
      console.error(chalk.red(`❌ Unknown configuration key: ${key}`))
      console.log(chalk.gray('Available keys: hubUrl, token, defaultNamespace, timeout'))
      process.exit(1)
    }
    
    // Type conversion for numeric values
    let processedValue: any = value
    if (key === 'timeout') {
      processedValue = parseInt(value)
      if (isNaN(processedValue)) {
        console.error(chalk.red(`❌ Invalid timeout value: ${value}`))
        process.exit(1)
      }
    }
    
    config[key as keyof Config] = processedValue
    saveConfig(config)
    
    console.log(chalk.green(`✅ Set ${key} = ${key === 'token' ? '***masked***' : processedValue}`))
    return
  }
}