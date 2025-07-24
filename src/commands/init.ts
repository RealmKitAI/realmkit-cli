import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import inquirer from 'inquirer'

interface InitOptions {
  force: boolean
}

export async function initCommand(options: InitOptions) {
  console.log(chalk.blue('🔧 Initialize RealmKit'))
  console.log('')
  
  const currentDir = process.cwd()
  const realmkitDir = path.join(currentDir, '.realmkit')
  const configPath = path.join(realmkitDir, 'config.yml')
  
  // Check if already initialized
  if (fs.existsSync(configPath) && !options.force) {
    console.log(chalk.yellow('⚠️ RealmKit is already initialized in this directory'))
    console.log('')
    console.log(chalk.gray('To reinitialize, use:'))
    console.log(`   ${chalk.cyan('realmkit init --force')}`)
    return
  }
  
  // Gather project information
  console.log(chalk.bold('📝 Project Information:'))
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: path.basename(currentDir),
      validate: (input: string) => {
        if (!input.trim()) return 'Project name is required'
        return true
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A RealmKit project'
    },
    {
      type: 'list',
      name: 'type',
      message: 'Project type:',
      choices: [
        { name: 'SaaS Application', value: 'saas' },
        { name: 'API Service', value: 'api' },
        { name: 'Web Application', value: 'webapp' },
        { name: 'Mobile App', value: 'mobile' },
        { name: 'Other', value: 'other' }
      ]
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'What features does this project include?',
      choices: [
        { name: 'Authentication', value: 'auth' },
        { name: 'Payment Processing', value: 'payments' },
        { name: 'Email System', value: 'email' },
        { name: 'Admin Dashboard', value: 'admin' },
        { name: 'File Uploads', value: 'uploads' },
        { name: 'Real-time Features', value: 'realtime' },
        { name: 'Analytics', value: 'analytics' }
      ]
    },
    {
      type: 'confirm',
      name: 'createRealm',
      message: 'Would you like to extract a realm from this project?',
      default: false
    }
  ])
  
  // Create .realmkit directory
  if (!fs.existsSync(realmkitDir)) {
    fs.mkdirSync(realmkitDir, { recursive: true })
  }
  
  // Create configuration
  const config = {
    project: {
      name: answers.name,
      description: answers.description,
      type: answers.type,
      features: answers.features,
      createdAt: new Date().toISOString()
    },
    realmkit: {
      version: '0.1.0',
      initialized: new Date().toISOString()
    }
  }
  
  const yaml = require('yaml')
  fs.writeFileSync(configPath, yaml.stringify(config), 'utf8')
  
  // Create .gitignore entry
  const gitignorePath = path.join(currentDir, '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
    if (!gitignoreContent.includes('.realmkit/temp')) {
      fs.appendFileSync(gitignorePath, '\n# RealmKit\n.realmkit/temp/\n.realmkit/cache/\n')
    }
  }
  
  console.log('')
  console.log(chalk.green('✅ RealmKit initialized successfully!'))
  console.log('')
  console.log(chalk.bold('📁 Created:'))
  console.log(`   ${chalk.cyan('.realmkit/config.yml')} - Project configuration`)
  console.log('')
  
  if (answers.createRealm) {
    console.log(chalk.bold('🎯 Next Steps:'))
    console.log(`   ${chalk.gray('1.')} ${chalk.cyan('realmkit extract')} - Extract a realm from this project`)
    console.log(`   ${chalk.gray('2.')} Review and customize the extracted realm`)
    console.log(`   ${chalk.gray('3.')} ${chalk.cyan('realmkit create <realm-path> <new-project>')} - Test your realm`)
  } else {
    console.log(chalk.bold('🎯 Available Commands:'))
    console.log(`   ${chalk.cyan('realmkit extract')} - Extract a realm from this project`)
    console.log(`   ${chalk.cyan('realmkit list')} - List available realms`)
    console.log(`   ${chalk.cyan('realmkit create')} - Create a project from a realm`)
  }
}