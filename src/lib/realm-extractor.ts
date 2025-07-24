#!/usr/bin/env ts-node

/**
 * RealmKit Extraction Simulator
 * 
 * This script simulates the core extraction algorithm by analyzing
 * the current SaaS project and creating a realm template.
 */

import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

interface ProjectAnalysis {
  framework: string
  language: string
  features: string[]
  dependencies: Record<string, string>
  structure: FileNode[]
  patterns: string[]
}

interface FileNode {
  path: string
  type: 'file' | 'directory'
  size?: number
  content?: string
}

interface ExtractionResult {
  analysis: ProjectAnalysis
  templates: Record<string, string>
  variables: Variable[]
  realmManifest: any
}

interface Variable {
  name: string
  description: string
  type: string
  required: boolean
  defaultValue?: any
  example?: string
}

class RealmExtractor {
  private projectPath: string
  private outputPath: string
  
  constructor(projectPath: string, outputPath: string) {
    this.projectPath = path.resolve(projectPath)
    this.outputPath = path.resolve(outputPath)
  }
  
  async extract(): Promise<ExtractionResult> {
    console.log('🔍 Analyzing project structure...')
    const analysis = await this.analyzeProject()
    
    console.log('📝 Detecting features...')
    const features = this.detectFeatures(analysis)
    
    console.log('🔧 Extracting templates...')
    const templates = await this.extractTemplates(analysis)
    
    console.log('⚙️ Identifying variables...')
    const variables = this.identifyVariables(templates)
    
    console.log('📋 Generating realm manifest...')
    const realmManifest = this.generateRealmManifest(analysis, features, variables)
    
    const result: ExtractionResult = {
      analysis: { ...analysis, features },
      templates,
      variables,
      realmManifest
    }
    
    console.log('💾 Saving extraction results...')
    await this.saveExtractionResults(result)
    
    return result
  }
  
  private async analyzeProject(): Promise<ProjectAnalysis> {
    const packageJsonPath = path.join(this.projectPath, 'package.json')
    
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found. This doesn\'t appear to be a Node.js project.')
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    
    // Detect framework
    let framework = 'unknown'
    if (dependencies.next) framework = 'nextjs'
    else if (dependencies.react) framework = 'react'
    else if (dependencies.vue) framework = 'vue'
    else if (dependencies.express) framework = 'express'
    
    // Detect language
    const language = dependencies.typescript || fs.existsSync(path.join(this.projectPath, 'tsconfig.json')) 
      ? 'typescript' 
      : 'javascript'
    
    // Analyze structure
    const structure = this.analyzeStructure(this.projectPath)
    
    // Detect patterns
    const patterns = this.detectArchitecturalPatterns(structure, dependencies)
    
    return {
      framework,
      language,
      features: [], // Will be populated by detectFeatures
      dependencies,
      structure,
      patterns
    }
  }
  
  private analyzeStructure(dirPath: string, relativePath = ''): FileNode[] {
    const nodes: FileNode[] = []
    const items = fs.readdirSync(dirPath)
    
    // Skip these directories/files
    const skipItems = [
      'node_modules', '.git', '.next', 'dist', 'build', 
      '.env.local', '.env', 'coverage', '.nyc_output'
    ]
    
    for (const item of items) {
      if (skipItems.includes(item)) continue
      
      const fullPath = path.join(dirPath, item)
      const relPath = path.join(relativePath, item)
      const stats = fs.statSync(fullPath)
      
      if (stats.isDirectory()) {
        nodes.push({
          path: relPath,
          type: 'directory'
        })
        // Recursively analyze subdirectories (limited depth)
        if (relativePath.split('/').length < 4) {
          nodes.push(...this.analyzeStructure(fullPath, relPath))
        }
      } else {
        nodes.push({
          path: relPath,
          type: 'file',
          size: stats.size
        })
      }
    }
    
    return nodes
  }
  
  private detectFeatures(analysis: ProjectAnalysis): string[] {
    const features: string[] = []
    const { dependencies, structure } = analysis
    
    // Authentication detection
    if (dependencies['next-auth'] || dependencies['@auth/core'] || 
        structure.some(f => f.path.includes('auth'))) {
      features.push('authentication')
    }
    
    // Payment detection
    if (dependencies.stripe || 
        structure.some(f => f.path.includes('billing') || f.path.includes('payment'))) {
      features.push('payments')
    }
    
    // Email detection
    if (dependencies.resend || dependencies.nodemailer || dependencies['@react-email/components'] ||
        structure.some(f => f.path.includes('email'))) {
      features.push('email')
    }
    
    // Admin detection
    if (structure.some(f => f.path.includes('admin'))) {
      features.push('admin')
    }
    
    // Landing pages detection
    if (structure.some(f => f.path.includes('marketing') || f.path.includes('landing'))) {
      features.push('landing')
    }
    
    // Database detection
    if (dependencies.prisma || dependencies.mongoose || dependencies.sequelize) {
      features.push('database')
    }
    
    return features
  }
  
  private detectArchitecturalPatterns(structure: FileNode[], dependencies: Record<string, string>): string[] {
    const patterns: string[] = []
    
    // Service layer pattern
    if (structure.some(f => f.path.includes('services'))) {
      patterns.push('service-layer')
    }
    
    // MVC pattern
    const hasControllers = structure.some(f => f.path.includes('controllers'))
    const hasModels = structure.some(f => f.path.includes('models'))
    const hasViews = structure.some(f => f.path.includes('views') || f.path.includes('components'))
    
    if (hasControllers && hasModels && hasViews) {
      patterns.push('mvc')
    }
    
    // Next.js App Router
    if (structure.some(f => f.path.includes('app/') && f.path.includes('page.'))) {
      patterns.push('nextjs-app-router')
    }
    
    // TypeScript
    if (dependencies.typescript) {
      patterns.push('typescript')
    }
    
    // Tailwind CSS
    if (dependencies.tailwindcss) {
      patterns.push('tailwindcss')
    }
    
    return patterns
  }
  
  private async extractTemplates(analysis: ProjectAnalysis): Promise<Record<string, string>> {
    const templates: Record<string, string> = {}
    
    // Template important files
    const importantFiles = [
      'package.json',
      'tsconfig.json',
      'next.config.js',
      'tailwind.config.js',
      'prisma/schema.prisma',
      '.env.example'
    ]
    
    for (const file of importantFiles) {
      const filePath = path.join(this.projectPath, file)
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8')
        
        // Apply templating transformations
        content = this.applyTemplateTransformations(content, file)
        
        templates[file] = content
      }
    }
    
    return templates
  }
  
  private applyTemplateTransformations(content: string, filename: string): string {
    let transformed = content
    
    // Replace common project-specific values with template variables
    const replacements = [
      // Package.json specific
      { pattern: /"name":\s*"[^"]*"/, replacement: '"name": "{{PROJECT_NAME}}"' },
      { pattern: /"description":\s*"[^"]*"/, replacement: '"description": "{{PROJECT_DESCRIPTION}}"' },
      
      // Environment variables
      { pattern: /DATABASE_URL=.*/, replacement: 'DATABASE_URL={{DATABASE_URL}}' },
      { pattern: /NEXTAUTH_SECRET=.*/, replacement: 'NEXTAUTH_SECRET={{NEXTAUTH_SECRET}}' },
      { pattern: /NEXTAUTH_URL=.*/, replacement: 'NEXTAUTH_URL={{NEXTAUTH_URL}}' },
      { pattern: /STRIPE_SECRET_KEY=.*/, replacement: 'STRIPE_SECRET_KEY={{STRIPE_SECRET_KEY}}' },
      { pattern: /RESEND_API_KEY=.*/, replacement: 'RESEND_API_KEY={{RESEND_API_KEY}}' },
      
      // Hardcoded domain names
      { pattern: /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '{{BASE_URL}}' },
      
      // Email addresses
      { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '{{CONTACT_EMAIL}}' }
    ]
    
    for (const { pattern, replacement } of replacements) {
      transformed = transformed.replace(pattern, replacement)
    }
    
    return transformed
  }
  
  private identifyVariables(templates: Record<string, string>): Variable[] {
    const variables: Variable[] = []
    const seenVariables = new Set<string>()
    
    // Extract all template variables
    const templateVarRegex = /\{\{([A-Z_]+)\}\}/g
    
    for (const [filename, content] of Object.entries(templates)) {
      let match
      while ((match = templateVarRegex.exec(content)) !== null) {
        const varName = match[1]
        if (!seenVariables.has(varName)) {
          seenVariables.add(varName)
          variables.push(this.createVariableDefinition(varName))
        }
      }
    }
    
    return variables
  }
  
  private createVariableDefinition(varName: string): Variable {
    const definitions: Record<string, Partial<Variable>> = {
      PROJECT_NAME: {
        description: 'Name of your project',
        type: 'string',
        required: true,
        defaultValue: 'my-saas-app',
        example: 'my-awesome-saas'
      },
      PROJECT_DESCRIPTION: {
        description: 'Short description of your project',
        type: 'string', 
        required: true,
        defaultValue: 'A modern SaaS application',
        example: 'The best project management tool'
      },
      DATABASE_URL: {
        description: 'PostgreSQL database connection string',
        type: 'string',
        required: true,
        example: 'postgresql://user:password@localhost:5432/mydb'
      },
      NEXTAUTH_SECRET: {
        description: 'Secret key for NextAuth.js JWT signing',
        type: 'string',
        required: true,
        example: 'your-super-secret-key-here'
      },
      NEXTAUTH_URL: {
        description: 'Your application URL',
        type: 'string',
        required: true,
        defaultValue: 'http://localhost:3000',
        example: 'https://myapp.com'
      },
      STRIPE_SECRET_KEY: {
        description: 'Stripe secret API key',
        type: 'string',
        required: false,
        example: 'sk_test_...'
      },
      RESEND_API_KEY: {
        description: 'Resend API key for sending emails',
        type: 'string',
        required: false,
        example: 're_...'
      },
      BASE_URL: {
        description: 'Base URL for your application',
        type: 'string',
        required: true,
        defaultValue: 'http://localhost:3000',
        example: 'https://myapp.com'
      },
      CONTACT_EMAIL: {
        description: 'Contact email address',
        type: 'string',
        required: true,
        defaultValue: 'hello@example.com',
        example: 'support@myapp.com'
      }
    }
    
    const definition = definitions[varName] || {
      description: `${varName.toLowerCase().replace(/_/g, ' ')} configuration`,
      type: 'string',
      required: false
    }
    
    return {
      name: varName,
      ...definition
    } as Variable
  }
  
  private generateRealmManifest(analysis: ProjectAnalysis, features: string[], variables: Variable[]) {
    return {
      name: 'Modern SaaS Starter',
      slug: 'saas-starter',
      version: '1.0.0',
      description: 'Production-ready SaaS with authentication, payments, email, and admin dashboard',
      category: 'saas',
      tags: ['nextjs', 'typescript', 'saas', 'starter'],
      
      architecture: {
        framework: analysis.framework,
        language: analysis.language,
        patterns: analysis.patterns
      },
      
      features: features.map(feature => ({
        id: feature,
        name: this.getFeatureName(feature),
        description: this.getFeatureDescription(feature),
        enabled: true,
        required: feature === 'authentication'
      })),
      
      variables,
      
      commands: {
        install: 'npm install',
        dev: 'npm run dev',
        build: 'npm run build',
        test: 'npm test',
        lint: 'npm run lint'
      },
      
      setup_steps: [
        {
          description: 'Install dependencies',
          command: 'npm install'
        },
        {
          description: 'Set up environment variables',
          command: 'cp .env.example .env.local',
          manual: 'Edit .env.local with your configuration'
        },
        {
          description: 'Set up database',
          command: 'npx prisma db push',
          requires: ['DATABASE_URL']
        }
      ]
    }
  }
  
  private getFeatureName(feature: string): string {
    const names: Record<string, string> = {
      authentication: 'Authentication System',
      payments: 'Payment Processing',
      email: 'Email System',
      admin: 'Admin Dashboard',
      landing: 'Marketing Pages',
      database: 'Database Integration'
    }
    return names[feature] || feature
  }
  
  private getFeatureDescription(feature: string): string {
    const descriptions: Record<string, string> = {
      authentication: 'Complete auth system with NextAuth.js',
      payments: 'Stripe integration with subscription management',
      email: 'Transactional emails with Resend',
      admin: 'Admin panel for user and system management',
      landing: 'Marketing pages with conversion optimization',
      database: 'Database integration with Prisma ORM'
    }
    return descriptions[feature] || `${feature} functionality`
  }
  
  private async saveExtractionResults(result: ExtractionResult) {
    // Create output directory
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true })
    }
    
    // Save realm manifest
    const manifestPath = path.join(this.outputPath, 'realm.yml')
    fs.writeFileSync(manifestPath, yaml.stringify(result.realmManifest), 'utf8')
    
    // Save templates
    const templatesDir = path.join(this.outputPath, 'templates')
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true })
    }
    
    for (const [filename, content] of Object.entries(result.templates)) {
      const templatePath = path.join(templatesDir, filename)
      const templateDir = path.dirname(templatePath)
      
      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true })
      }
      
      fs.writeFileSync(templatePath, content, 'utf8')
    }
    
    // Save analysis report
    const analysisPath = path.join(this.outputPath, 'analysis-report.json')
    fs.writeFileSync(analysisPath, JSON.stringify(result.analysis, null, 2), 'utf8')
    
    console.log(`✅ Extraction complete! Results saved to: ${this.outputPath}`)
    console.log(`📋 Realm manifest: ${manifestPath}`)
    console.log(`📁 Templates: ${templatesDir}`)
    console.log(`📊 Analysis report: ${analysisPath}`)
  }
}

// This file is now used as a library by the CLI commands

export { RealmExtractor }