import fs from 'fs'
import path from 'path'
import chalk from 'chalk'

interface ListOptions {
  local: boolean
  remote: boolean
  category?: string
}

export async function listCommand(options: ListOptions) {
  console.log(chalk.blue('📦 Available Realms'))
  console.log('')
  
  // For now, only list local realms (until we have a platform)
  const localRealms = await getLocalRealms()
  
  if (localRealms.length === 0) {
    console.log(chalk.yellow('⚠️ No realms found locally'))
    console.log('')
    console.log(chalk.gray('To create your first realm:'))
    console.log(`   ${chalk.cyan('realmkit extract')} ${chalk.gray('# Extract from current project')}`)
    console.log(`   ${chalk.cyan('realmkit extract ./my-project')} ${chalk.gray('# Extract from specific project')}`)
    return
  }
  
  // Filter by category if specified
  const filteredRealms = options.category 
    ? localRealms.filter(realm => realm.category === options.category)
    : localRealms
  
  if (filteredRealms.length === 0) {
    console.log(chalk.yellow(`⚠️ No realms found in category "${options.category}"`))
    return
  }
  
  // Display realms
  console.log(chalk.bold(`📍 Local Realms (${filteredRealms.length})`))
  console.log('')
  
  for (const realm of filteredRealms) {
    console.log(`${chalk.bold.cyan(realm.name)} ${chalk.gray(`(${realm.slug})`)}`)
    console.log(`   ${chalk.gray('Description:')} ${realm.description}`)
    console.log(`   ${chalk.gray('Version:')} ${realm.version}`)
    console.log(`   ${chalk.gray('Category:')} ${realm.category}`)
    console.log(`   ${chalk.gray('Features:')} ${realm.features.join(', ')}`)
    console.log(`   ${chalk.gray('Path:')} ${chalk.dim(realm.path)}`)
    console.log('')
  }
  
  // Show usage examples
  console.log(chalk.bold('🎯 Usage Examples:'))
  if (filteredRealms.length > 0) {
    const exampleRealm = filteredRealms[0]
    console.log(`   ${chalk.cyan(`realmkit create ${exampleRealm.path} my-app`)} ${chalk.gray('# Create project from realm')}`)
  }
  console.log(`   ${chalk.cyan('realmkit create <realm-path> <project-name>')} ${chalk.gray('# General usage')}`)
}

async function getLocalRealms() {
  const realms: any[] = []
  
  // Look for realms in standard locations
  const searchPaths = [
    './realms',
    '../realms', 
    '../../realms',
    process.env.REALMKIT_REALMS_PATH
  ].filter((path): path is string => Boolean(path))
  
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue
    
    const items = fs.readdirSync(searchPath)
    
    for (const item of items) {
      const itemPath = path.join(searchPath, item)
      // Try both locations for realm.yml
      const realmManifestPath = fs.existsSync(path.join(itemPath, 'realm.yml')) 
        ? path.join(itemPath, 'realm.yml')
        : path.join(itemPath, '.realmkit', 'realm.yml')
      
      if (fs.existsSync(realmManifestPath)) {
        try {
          const yaml = require('yaml')
          const manifestContent = fs.readFileSync(realmManifestPath, 'utf8')
          const manifest = yaml.parse(manifestContent)
          
          realms.push({
            ...manifest,
            path: path.resolve(itemPath),
            features: manifest.features?.map((f: any) => f.id) || []
          })
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Failed to load realm: ${itemPath}`))
        }
      }
    }
  }
  
  return realms
}