import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  InitializeRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../database/manager.js';
import { 
  SearchToolArgsSchema, 
  GetStandardArgsSchema, 
  RecentUpdatesArgsSchema, 
  CheckComplianceArgsSchema,
  MCPToolDefinition
} from '../types/mcp.js';
import { Standard, ComplianceCheck } from '../types/standard.js';
import logger from '../utils/logger.js';
import { getApplicableStandards, CURATED_STANDARDS_CONFIG, getMandatoryStandards, getStandardsByPriority } from '../config/standards-config.js';

export class UKGovStandardsMCPServer {
  private server: Server;
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'uk-gov-tech-standards',
        version: process.env.MCP_SERVER_VERSION || '1.0.0'
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle initialization - this is critical for MCP protocol
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      try {
        console.error('DEBUG: Received initialize request:', JSON.stringify(request.params));
        
        const response = {
          protocolVersion: "2025-06-18",
          capabilities: {
            tools: {},
            resources: {}
          },
          serverInfo: {
            name: process.env.MCP_SERVER_NAME || 'uk-gov-tech-standards',
            version: process.env.MCP_SERVER_VERSION || '1.0.0'
          }
        };
        
        console.error('DEBUG: Sending initialize response:', JSON.stringify(response));
        return response;
        
      } catch (error) {
        console.error('ERROR in initialize handler:', error);
        throw error;
      }
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('Received ListTools request');
      const tools: MCPToolDefinition[] = [
        {
          name: 'search_uk_gov_standards',
          description: 'Search UK government technology standards by query, with optional filtering by category and organisation',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for UK government standards'
              },
              category: {
                type: 'string',
                description: 'Filter by category (e.g., APIs, Security, Cloud, Accessibility)'
              },
              organisation: {
                type: 'string',
                description: 'Filter by source organisation (e.g., GDS, NCSC, Cabinet Office)'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_standard_by_id',
          description: 'Retrieve a specific UK government standard by its unique identifier',
          inputSchema: {
            type: 'object',
            properties: {
              standardId: {
                type: 'string',
                description: 'Unique identifier of the standard to retrieve'
              }
            },
            required: ['standardId']
          }
        },
        {
          name: 'list_categories',
          description: 'Get all available categories of UK government standards with counts',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_recent_updates',
          description: 'Get recently updated UK government standards',
          inputSchema: {
            type: 'object',
            properties: {
              daysBack: {
                type: 'number',
                description: 'Number of days to look back for updates (default: 30)',
                default: 30
              }
            }
          }
        },
         {
           name: 'check_compliance',
           description: 'Check which UK government standards are relevant for a digital service and generate a compliance checklist',
           inputSchema: {
             type: 'object',
             properties: {
               serviceDescription: {
                 type: 'string',
                 description: 'Description of the digital service to check compliance for'
               }
             },
             required: ['serviceDescription']
           }
         },
         {
           name: 'get_applicable_standards',
           description: 'Get standards applicable to specific work context (work type, service type, development phase)',
           inputSchema: {
             type: 'object',
             properties: {
               workType: {
                 type: 'array',
                 items: {
                   type: 'string',
                   enum: ['frontend', 'backend', 'fullstack', 'mobile', 'api', 'data', 'infrastructure', 'security', 'compliance']
                 },
                 description: 'Types of work being performed'
               },
               serviceType: {
                 type: 'array', 
                 items: {
                   type: 'string',
                   enum: ['citizen-facing', 'internal', 'b2b', 'data-service', 'api-service', 'legacy-migration']
                 },
                 description: 'Types of service being built'
               },
               developmentPhase: {
                 type: 'array',
                 items: {
                   type: 'string', 
                   enum: ['planning', 'design', 'development', 'testing', 'deployment', 'maintenance', 'decommission']
                 },
                 description: 'Current development phases'
               }
             },
             required: ['workType', 'serviceType', 'developmentPhase']
           }
         },
         {
           name: 'get_category_hierarchy',
           description: 'Get the hierarchical structure of standard categories with applicability context',
           inputSchema: {
             type: 'object',
             properties: {
               categoryId: {
                 type: 'string',
                 description: 'Optional category ID to get specific category details'
               }
             }
           }
         },
         {
           name: 'get_standards_by_priority',
           description: 'Get standards filtered by priority level (critical, high, medium, low)',
           inputSchema: {
             type: 'object',
             properties: {
               priority: {
                 type: 'string',
                 enum: ['critical', 'high', 'medium', 'low'],
                 description: 'Priority level to filter by'
               }
             },
             required: ['priority']
           }
         },
         {
           name: 'get_mandatory_standards',
           description: 'Get all mandatory standards that must be followed',
           inputSchema: {
             type: 'object',
             properties: {}
           }
         }
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.info(`Received CallTool request: ${request.params.name}`);
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_uk_gov_standards':
            return await this.handleSearchStandards(args);

          case 'get_standard_by_id':
            return await this.handleGetStandard(args);

          case 'list_categories':
            return await this.handleListCategories();

          case 'get_recent_updates':
            return await this.handleGetRecentUpdates(args);

          case 'check_compliance':
            return await this.handleCheckCompliance(args);

          case 'get_applicable_standards':
            return await this.handleGetApplicableStandards(args);

          case 'get_category_hierarchy':
            return await this.handleGetCategoryHierarchy(args);

          case 'get_standards_by_priority':
            return await this.handleGetStandardsByPriority(args);

          case 'get_mandatory_standards':
            return await this.handleGetMandatoryStandards(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error handling tool ${name}:`, error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          }]
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.info('Received ListResources request');
      return {
        resources: [
          {
            uri: 'standards://all',
            name: 'All UK Government Standards',
            description: 'Complete collection of UK government technology standards',
            mimeType: 'application/json'
          },
          {
            uri: 'standards://categories',
            name: 'Standards Categories',
            description: 'List of all standard categories with counts',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'standards://all':
          const allStandards = await this.db.getAllStandards();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(allStandards, null, 2)
            }]
          };

        case 'standards://categories':
          const categories = await this.db.getCategories();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(categories, null, 2)
            }]
          };

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  private async handleSearchStandards(args: unknown) {
    const { query, category, organisation } = SearchToolArgsSchema.parse(args);
    // Use hybrid search for better semantic understanding
    const results = await this.db.hybridSearch(query, category, organisation, {
      semanticWeight: 0.6, // 60% semantic, 40% FTS
      semanticThreshold: 0.25, // Lower threshold for more inclusive results
      maxResults: 20
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query,
          filters: { category, organisation },
          totalResults: results.length,
          results: results.map(result => ({
            standard: {
              id: result.standard.id,
              title: result.standard.title,
              category: result.standard.category,
              url: result.standard.url,
              summary: result.standard.summary,
              sourceOrg: result.standard.sourceOrg,
              tags: result.standard.tags,
              complianceLevel: result.standard.complianceLevel
            },
            relevanceScore: result.relevanceScore,
            matchedFields: result.matchedFields
          }))
        }, null, 2)
      }]
    };
  }

  private async handleGetStandard(args: unknown) {
    const { standardId } = GetStandardArgsSchema.parse(args);
    const standard = await this.db.getStandard(standardId);

    if (!standard) {
      return {
        content: [{
          type: 'text',
          text: `Standard with ID '${standardId}' not found`
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(standard, null, 2)
      }]
    };
  }

  private async handleListCategories() {
    const categories = await this.db.getCategories();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalCategories: categories.length,
          categories
        }, null, 2)
      }]
    };
  }

  private async handleGetRecentUpdates(args: unknown) {
    const { daysBack } = RecentUpdatesArgsSchema.parse(args || {});
    const recentUpdates = await this.db.getRecentUpdates(daysBack);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          daysBack,
          totalUpdates: recentUpdates.length,
          updates: recentUpdates.map(standard => ({
            id: standard.id,
            title: standard.title,
            category: standard.category,
            url: standard.url,
            lastUpdated: standard.lastUpdated,
            updatedAt: standard.updatedAt
          }))
        }, null, 2)
      }]
    };
  }

  private async handleCheckCompliance(args: unknown) {
    const { serviceDescription } = CheckComplianceArgsSchema.parse(args);
    const complianceCheck = await this.generateComplianceCheck(serviceDescription);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(complianceCheck, null, 2)
      }]
    };
  }

  private async generateComplianceCheck(serviceDescription: string): Promise<ComplianceCheck> {
    const allStandards = await this.db.getAllStandards();
    const relevantStandards = this.findRelevantStandards(serviceDescription, allStandards);
    
    const complianceChecklist = relevantStandards.map(standard => {
      const requirements = this.extractRequirements(standard);
      return requirements.map(requirement => ({
        standard: standard.title,
        requirement,
        status: 'unknown' as const,
        notes: `Review ${standard.title} for specific implementation requirements`
      }));
    }).flat();

    return {
      serviceDescription,
      relevantStandards,
      complianceChecklist
    };
  }

  private findRelevantStandards(serviceDescription: string, allStandards: Standard[]): Standard[] {
    const descriptionLower = serviceDescription.toLowerCase();
    const relevant: { standard: Standard; score: number }[] = [];

    allStandards.forEach(standard => {
      let score = 0;
      const standardText = (standard.title + ' ' + standard.content + ' ' + standard.tags.join(' ')).toLowerCase();

      // Check for direct keyword matches
      const keywords = this.extractServiceKeywords(descriptionLower);
      keywords.forEach(keyword => {
        if (standardText.includes(keyword)) {
          score += keyword.length > 3 ? 2 : 1;
        }
      });

      // Check for category relevance
      if (this.isCategoryRelevant(standard.category, descriptionLower)) {
        score += 5;
      }

      // Check for compliance level
      if (standard.complianceLevel === 'mandatory') {
        score += 3;
      } else if (standard.complianceLevel === 'recommended') {
        score += 1;
      }

      if (score > 0) {
        relevant.push({ standard, score });
      }
    });

    return relevant
      .sort((a, b) => b.score - a.score)
      .slice(0, 15) // Limit to 15 most relevant standards
      .map(item => item.standard);
  }

  private extractServiceKeywords(description: string): string[] {
    const words = description.split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '').toLowerCase())
      .filter(word => word.length > 2);

    // Remove common words but keep technical terms
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'its', 'did', 'yes']);

    return words.filter(word => !stopWords.has(word));
  }

  private isCategoryRelevant(category: string, description: string): boolean {
    const categoryMappings: { [key: string]: string[] } = {
      'APIs': ['api', 'rest', 'endpoint', 'service', 'integration'],
      'Security & Cyber Security': ['secure', 'security', 'auth', 'encrypt', 'protect'],
      'Accessibility': ['accessible', 'disability', 'screen reader', 'inclusive'],
      'Cloud Strategy': ['cloud', 'hosting', 'infrastructure', 'platform'],
      'Data Protection': ['data', 'privacy', 'gdpr', 'personal information'],
      'Digital Service Standard': ['user', 'research', 'design', 'service'],
      'Application Development': ['app', 'mobile', 'development', 'software']
    };

    const keywords = categoryMappings[category] || [];
    return keywords.some(keyword => description.includes(keyword));
  }

  private extractRequirements(standard: Standard): string[] {
    const content = standard.content;
    const requirements: string[] = [];

    // Look for sentences that contain requirement indicators
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    sentences.forEach(sentence => {
      const sentenceLower = sentence.toLowerCase().trim();
      if (sentenceLower.includes('must ') || 
          sentenceLower.includes('shall ') || 
          sentenceLower.includes('required') ||
          sentenceLower.includes('should ')) {
        requirements.push(sentence.trim());
      }
    });

    return requirements.slice(0, 5); // Limit to 5 key requirements per standard
  }

  private async handleGetApplicableStandards(args: any) {
    const { workType, serviceType, developmentPhase } = args as {
      workType: string[];
      serviceType: string[];
      developmentPhase: string[];
    };

    const applicableCategories = getApplicableStandards(workType, serviceType, developmentPhase);
    
    // Get actual standards for these categories
    const applicableStandards = [];
    for (const category of applicableCategories) {
      const categoryStandards = await this.db.searchStandards('', category.name);
      applicableStandards.push({
        category: category.name,
        description: category.description,
        applicabilityContext: category.applicabilityContext,
        urlCount: category.urls.length,
        standards: categoryStandards.map(result => ({
          id: result.standard.id,
          title: result.standard.title,
          url: result.standard.url,
          summary: result.standard.summary
        }))
      });
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          context: { workType, serviceType, developmentPhase },
          applicableCategories: applicableStandards,
          totalCategories: applicableStandards.length,
          totalStandards: applicableStandards.reduce((sum, cat) => sum + cat.standards.length, 0)
        }, null, 2)
      }]
    };
  }

  private async handleGetCategoryHierarchy(args: any) {
    const { categoryId } = args as { categoryId?: string };

    if (categoryId) {
      const category = CURATED_STANDARDS_CONFIG.find(c => c.id === categoryId);
      if (!category) {
        throw new Error(`Category ${categoryId} not found`);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(category, null, 2)
        }]
      };
    } else {
      // Return all categories with hierarchy
      const categoriesWithCounts = await Promise.all(
        CURATED_STANDARDS_CONFIG.map(async category => {
          const standards = await this.db.searchStandards('', category.name);
          return {
            ...category,
            standardsCount: standards.length
          };
        })
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            categories: categoriesWithCounts,
            totalCategories: CURATED_STANDARDS_CONFIG.length,
            totalUrls: CURATED_STANDARDS_CONFIG.reduce((sum, cat) => sum + cat.urls.length, 0)
          }, null, 2)
        }]
      };
    }
  }

  private async handleGetStandardsByPriority(args: any) {
    const { priority } = args as { priority: 'critical' | 'high' | 'medium' | 'low' };

    const priorityCategories = getStandardsByPriority(priority);
    
    // Get actual standards for these categories
    const priorityStandards = [];
    for (const category of priorityCategories) {
      const categoryStandards = await this.db.searchStandards('', category.name);
      priorityStandards.push({
        category: category.name,
        description: category.description,
        priority: category.applicabilityContext.priority,
        mandatory: category.applicabilityContext.mandatory,
        standards: categoryStandards.map(result => ({
          id: result.standard.id,
          title: result.standard.title,
          url: result.standard.url,
          summary: result.standard.summary
        }))
      });
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          priority,
          categories: priorityStandards,
          totalCategories: priorityStandards.length,
          totalStandards: priorityStandards.reduce((sum, cat) => sum + cat.standards.length, 0)
        }, null, 2)
      }]
    };
  }

  private async handleGetMandatoryStandards(args: any) {
    const mandatoryCategories = getMandatoryStandards();
    
    // Get actual standards for mandatory categories
    const mandatoryStandards = [];
    for (const category of mandatoryCategories) {
      const categoryStandards = await this.db.searchStandards('', category.name);
      mandatoryStandards.push({
        category: category.name,
        description: category.description,
        priority: category.applicabilityContext.priority,
        applicableFor: {
          workType: category.applicabilityContext.workType,
          serviceType: category.applicabilityContext.serviceType,
          developmentPhase: category.applicabilityContext.developmentPhase
        },
        standards: categoryStandards.map(result => ({
          id: result.standard.id,
          title: result.standard.title,
          url: result.standard.url,
          summary: result.standard.summary
        }))
      });
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          mandatoryCategories: mandatoryStandards,
          totalCategories: mandatoryStandards.length,
          totalStandards: mandatoryStandards.reduce((sum, cat) => sum + cat.standards.length, 0),
          note: "These are standards marked as mandatory and must be followed when applicable to your work context."
        }, null, 2)
      }]
    };
  }

  async start(): Promise<void> {
    try {
      console.error('DEBUG: Creating StdioServerTransport...');
      const transport = new StdioServerTransport();
      
      console.error('DEBUG: Connecting server to transport...');
      await this.server.connect(transport);
      console.error('DEBUG: Server connected to transport successfully');
      
      logger.info('UK Gov Tech Standards MCP Server started successfully');
      
      // Handle transport errors
      transport.onclose = () => {
        console.error('DEBUG: Transport closed');
        logger.info('MCP transport closed');
      };
      
      transport.onerror = (error) => {
        console.error('DEBUG: Transport error:', error);
      };
      
    } catch (error) {
      console.error('ERROR: Failed to start MCP server:', error);
      logger.error('Failed to start MCP server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.db.close();
    logger.info('UK Gov Tech Standards MCP Server stopped');
  }
}