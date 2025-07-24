#!/usr/bin/env ts-node

/**
 * RealmKit Project Creator
 * 
 * This script creates new projects from extracted realms by applying
 * template variables and setting up the project structure.
 */

import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import { execSync } from 'child_process'

interface RealmManifest {
  name: string
  slug: string
  version: string
  description: string
  features: Feature[]
  variables: Variable[]
  commands: Record<string, string>
  setup_steps: SetupStep[]
}

interface Feature {
  id: string
  name: string
  description: string
  enabled: boolean
  required: boolean
}

interface Variable {
  name: string
  description: string
  type: string
  required: boolean
  defaultValue?: any
  example?: string
}

interface SetupStep {
  description: string
  command?: string
  manual?: string
  requires?: string[]
  optional?: boolean
}

interface ProjectConfig {
  projectName: string
  realmPath: string
  outputPath: string
  variables: Record<string, any>
  enabledFeatures: string[]
}

class ProjectCreator {
  private config: ProjectConfig
  private manifest: RealmManifest
  
  constructor(config: ProjectConfig) {
    this.config = config
    this.manifest = this.loadRealmManifest()
  }
  
  async create(): Promise<void> {
    console.log(`🚀 Creating project "${this.config.projectName}" from realm "${this.manifest.name}"`)
    
    // Validate configuration
    await this.validateConfig()
    
    // Create project directory
    console.log('📁 Creating project directory...')
    await this.createProjectDirectory()
    
    // Copy and process templates
    console.log('📝 Processing templates...')
    await this.processTemplates()
    
    // Run setup steps
    console.log('⚙️ Running setup steps...')
    await this.runSetupSteps()
    
    // Create project tracking
    console.log('🔗 Setting up project tracking...')
    await this.createProjectTracking()
    
    console.log(`✅ Project "${this.config.projectName}" created successfully!`)
    console.log(`📂 Location: ${this.config.outputPath}`)
    console.log(`🎯 Next steps:`)
    console.log(`   cd ${this.config.projectName}`)
    console.log(`   npm run dev`)
  }
  
  private loadRealmManifest(): RealmManifest {
    let manifestPath = path.join(this.config.realmPath, 'realm.yml')
    if (!fs.existsSync(manifestPath)) {
      manifestPath = path.join(this.config.realmPath, '.realmkit', 'realm.yml')
    }
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Realm manifest not found: ${manifestPath}`)
    }
    
    const manifestContent = fs.readFileSync(manifestPath, 'utf8')
    return yaml.parse(manifestContent)
  }
  
  private async validateConfig(): Promise<void> {
    // Check if output directory already exists
    if (fs.existsSync(this.config.outputPath)) {
      throw new Error(`Directory already exists: ${this.config.outputPath}`)
    }
    
    // Validate required variables
    const requiredVars = this.manifest.variables.filter(v => v.required)
    const missingVars = requiredVars.filter(v => !(v.name in this.config.variables))
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.map(v => v.name).join(', ')}`)
    }
    
    // Validate enabled features
    const availableFeatures = this.manifest.features.map(f => f.id)
    const invalidFeatures = this.config.enabledFeatures.filter(f => !availableFeatures.includes(f))
    
    if (invalidFeatures.length > 0) {
      throw new Error(`Invalid features: ${invalidFeatures.join(', ')}`)
    }
    
    console.log('✅ Configuration validated')
  }
  
  private async createProjectDirectory(): Promise<void> {
    fs.mkdirSync(this.config.outputPath, { recursive: true })
    
    // Copy realm source files if they exist
    const realmSrcPath = path.join(this.config.realmPath, 'src')
    if (fs.existsSync(realmSrcPath)) {
      this.copyDirectory(realmSrcPath, path.join(this.config.outputPath, 'src'))
    }
    
    // Copy other important directories
    const importantDirs = ['prisma', 'public', 'components', 'lib', 'styles']
    for (const dir of importantDirs) {
      const srcDir = path.join(this.config.realmPath, dir)
      const destDir = path.join(this.config.outputPath, dir)
      
      if (fs.existsSync(srcDir)) {
        this.copyDirectory(srcDir, destDir)
      }
    }
  }
  
  private copyDirectory(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }
    
    const items = fs.readdirSync(src)
    
    for (const item of items) {
      const srcPath = path.join(src, item)
      const destPath = path.join(dest, item)
      const stats = fs.statSync(srcPath)
      
      if (stats.isDirectory()) {
        this.copyDirectory(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
  
  private async processTemplates(): Promise<void> {
    const templatesPath = path.join(this.config.realmPath, 'templates')
    
    if (!fs.existsSync(templatesPath)) {
      console.log('⚠️ No templates directory found, using realm files directly')
      return
    }
    
    // Process each template file
    this.processTemplateDirectory(templatesPath, this.config.outputPath)
  }
  
  private processTemplateDirectory(srcDir: string, destDir: string): void {
    const items = fs.readdirSync(srcDir)
    
    for (const item of items) {
      const srcPath = path.join(srcDir, item)
      const destPath = path.join(destDir, item)
      const stats = fs.statSync(srcPath)
      
      if (stats.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true })
        }
        this.processTemplateDirectory(srcPath, destPath)
      } else {
        const content = fs.readFileSync(srcPath, 'utf8')
        const processedContent = this.applyVariableSubstitution(content)
        
        // Skip files for disabled features
        if (this.shouldIncludeFile(destPath, processedContent)) {
          fs.writeFileSync(destPath, processedContent, 'utf8')
        }
      }
    }
  }
  
  private applyVariableSubstitution(content: string): string {
    let processed = content
    
    // Apply variable substitutions
    for (const [varName, value] of Object.entries(this.config.variables)) {
      const pattern = new RegExp(`\\{\\{${varName}\\}\\}`, 'g')
      processed = processed.replace(pattern, String(value))
    }
    
    // Apply default values for missing variables
    for (const variable of this.manifest.variables) {
      if (!(variable.name in this.config.variables) && variable.defaultValue !== undefined) {
        const pattern = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g')
        processed = processed.replace(pattern, String(variable.defaultValue))
      }
    }
    
    return processed
  }
  
  private shouldIncludeFile(filePath: string, content: string): boolean {
    // Check if file is related to disabled features
    const relativePath = path.relative(this.config.outputPath, filePath)
    
    // Skip files in feature-specific directories for disabled features
    const featureDirectories = {
      auth: ['auth/', 'services/auth/'],
      payments: ['billing/', 'services/billing/', 'stripe/'],
      email: ['email/', 'services/email/'],
      admin: ['admin/', 'services/admin/']
    }
    
    for (const featureId of Object.keys(featureDirectories)) {
      if (!this.config.enabledFeatures.includes(featureId)) {
        const directories = featureDirectories[featureId as keyof typeof featureDirectories]
        if (directories.some(dir => relativePath.includes(dir))) {
          console.log(`⏭️ Skipping ${relativePath} (feature ${featureId} disabled)`)
          return false
        }
      }
    }
    
    // Check for feature flags in content
    const featureFlagPattern = /\/\*\s*@feature\s+([\w,\s]+)\s*\*\//
    const match = content.match(featureFlagPattern)
    
    if (match) {
      const requiredFeatures = match[1].split(',').map(f => f.trim())
      const hasAllFeatures = requiredFeatures.every(f => this.config.enabledFeatures.includes(f))
      
      if (!hasAllFeatures) {
        console.log(`⏭️ Skipping ${relativePath} (requires features: ${requiredFeatures.join(', ')})`)
        return false
      }
    }
    
    return true
  }
  
  private async runSetupSteps(): Promise<void> {
    const projectDir = this.config.outputPath
    
    for (const step of this.manifest.setup_steps) {
      console.log(`📋 ${step.description}...`)
      
      // Check if step requires certain variables
      if (step.requires) {
        const missingVars = step.requires.filter(varName => !(varName in this.config.variables))
        if (missingVars.length > 0) {
          if (step.optional) {
            console.log(`⏭️ Skipping step (missing variables: ${missingVars.join(', ')})`)
            continue
          } else {
            throw new Error(`Step requires variables: ${missingVars.join(', ')}`)
          }
        }
      }
      
      if (step.command) {
        try {
          execSync(step.command, { 
            cwd: projectDir, 
            stdio: 'inherit' 
          })
        } catch (error) {
          if (step.optional) {
            console.log(`⚠️ Optional step failed: ${step.description}`)
          } else {
            throw new Error(`Setup step failed: ${step.description}`)
          }
        }
      }
      
      if (step.manual) {
        console.log(`📝 Manual step: ${step.manual}`)
      }
    }
  }
  
  private async createProjectTracking(): Promise<void> {
    const trackingData = {
      projectName: this.config.projectName,
      realmSlug: this.manifest.slug,
      realmVersion: this.manifest.version,
      createdAt: new Date().toISOString(),
      variables: this.config.variables,
      enabledFeatures: this.config.enabledFeatures,
      realmPath: this.config.realmPath
    }
    
    // Create .realmkit directory for project tracking
    const trackingDir = path.join(this.config.outputPath, '.realmkit')
    if (!fs.existsSync(trackingDir)) {
      fs.mkdirSync(trackingDir)
    }
    
    // Save project origin tracking
    const trackingFile = path.join(trackingDir, 'project-origin.json')
    fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2), 'utf8')
    
    // Copy AI context for development assistance
    const aiContextSrc = path.join(this.config.realmPath, '.realmkit', 'ai-context')
    const aiContextDest = path.join(trackingDir, 'ai-context')
    
    if (fs.existsSync(aiContextSrc)) {
      this.copyDirectory(aiContextSrc, aiContextDest)
    }
    
    console.log('✅ Project tracking set up')
  }
}

// This file is now used as a library by the CLI commands

export { ProjectCreator }