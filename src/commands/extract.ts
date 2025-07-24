import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { RealmExtractor } from '../lib/realm-extractor'

interface ExtractOptions {
  output: string
  name?: string
  include?: string
  exclude?: string
}

export async function extractCommand(projectPath: string, options: ExtractOptions) {
  console.log(chalk.blue('🚀 RealmKit Extraction'))
  console.log('')
  
  const resolvedProjectPath = path.resolve(projectPath)
  const resolvedOutputPath = path.resolve(options.output)
  
  console.log(`📂 Project: ${chalk.cyan(resolvedProjectPath)}`)
  console.log(`📁 Output: ${chalk.cyan(resolvedOutputPath)}`)
  console.log('')
  
  // Prompt for realm name if not provided
  let realmName = options.name
  if (!realmName) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What should we call this realm?',
        default: path.basename(resolvedProjectPath) + '-starter',
        validate: (input: string) => {
          if (!input.trim()) return 'Realm name is required'
          if (!/^[a-z0-9-]+$/.test(input)) return 'Realm name must contain only lowercase letters, numbers, and hyphens'
          return true
        }
      }
    ])
    realmName = response.name
  }
  
  // Confirm extraction
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Extract realm "${realmName}" from ${path.basename(resolvedProjectPath)}?`,
      default: true
    }
  ])
  
  if (!confirm) {
    console.log(chalk.yellow('❌ Extraction cancelled'))
    return
  }
  
  // Start extraction
  const spinner = ora('Analyzing project structure...').start()
  
  try {
    const extractor = new RealmExtractor(resolvedProjectPath, resolvedOutputPath)
    
    spinner.text = 'Extracting realm...'
    const result = await extractor.extract()
    
    spinner.succeed('Extraction completed!')
    
    // Display results
    console.log('')
    console.log(chalk.green('✅ Realm extracted successfully!'))
    console.log('')
    console.log(chalk.bold('📊 Extraction Summary:'))
    console.log(`   ${chalk.gray('Framework:')} ${result.analysis.framework}`)
    console.log(`   ${chalk.gray('Language:')} ${result.analysis.language}`)
    console.log(`   ${chalk.gray('Features:')} ${result.analysis.features.join(', ') || 'None detected'}`)
    console.log(`   ${chalk.gray('Patterns:')} ${result.analysis.patterns.join(', ') || 'None detected'}`)
    console.log(`   ${chalk.gray('Variables:')} ${result.variables.length}`)
    console.log(`   ${chalk.gray('Templates:')} ${Object.keys(result.templates).length}`)
    console.log('')
    console.log(chalk.bold('📁 Output Files:'))
    console.log(`   ${chalk.cyan('realm.yml')} - Realm configuration`)
    console.log(`   ${chalk.cyan('templates/')} - Template files`)
    console.log(`   ${chalk.cyan('analysis-report.json')} - Detailed analysis`)
    console.log('')
    console.log(chalk.bold('🎯 Next Steps:'))
    console.log(`   ${chalk.gray('1.')} Review the generated realm.yml`)
    console.log(`   ${chalk.gray('2.')} Test creating a project: ${chalk.cyan(`realmkit create ${resolvedOutputPath} test-project`)}`)
    console.log(`   ${chalk.gray('3.')} Refine the extraction if needed`)
    
  } catch (error) {
    spinner.fail('Extraction failed')
    console.log('')
    console.error(chalk.red('❌ Error:'), error)
    process.exit(1)
  }
}