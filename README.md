# UK Government Technology Standards MCP Server

A Model Context Protocol (MCP) server providing access to **102 curated UK Government technology standards** for AI assistants. Get context-aware recommendations for accessibility, APIs, security, cloud strategy, and more.

## 🎯 What This Provides

- **102 Curated Standards**: Carefully selected UK Government tech standards URLs
- **Context-Aware Recommendations**: Get standards based on your work type and project phase
- **Hybrid Search**: Combines exact keyword matching with semantic understanding
- **Multiple Access Methods**: MCP protocol, HTTP API, and command-line tools
- **Real-time Updates**: Keep standards current with automated refresh capabilities

## 📋 Quick Start

### Prerequisites
- **Node.js 18+** 
- **npm** (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd uk-gov-tech-standards-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Setup database with curated standards (takes 2-3 minutes)
npm run setup
```

### Usage

**Start MCP Server:**
```bash
npm run serve
```

**Start HTTP API Server:**
```bash
npm run serve:http
# API available at http://localhost:3001
```

## 🔧 MCP Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "uk-gov-standards": {
      "command": "node",
      "args": ["/absolute/path/to/uk-gov-tech-standards-mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "sqlite:/absolute/path/to/uk-gov-tech-standards-mcp/standards.db",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Other MCP Clients

The server implements the full MCP specification. Use these connection details:
- **Command**: `node`
- **Args**: `["/path/to/dist/index.js"]`
- **Working Directory**: Project root
- **Environment**: Set `DATABASE_URL` to your database path

## 🛠 MCP Tools

The server provides 8 context-aware tools:

### Core Search Tools

**`search_uk_gov_standards`**
- Search across all 102 curated standards
- Hybrid search: exact keywords + semantic understanding
- Parameters: `query` (required), `category`, `organisation`

**`get_standard_by_id`**
- Get detailed information about a specific standard
- Parameters: `standardId` (required)

**`list_categories`**
- Get all available categories with counts
- No parameters required

**`get_recent_updates`**
- Get recently updated standards
- Parameters: `daysBack` (default: 30)

### Context-Aware Tools

**`get_applicable_standards`**
- Get standards for specific work context
- Parameters: `workType[]`, `serviceType[]`, `developmentPhase[]`

**`get_mandatory_standards`**
- Get all mandatory/critical standards
- No parameters required

**`get_standards_by_priority`**
- Filter by priority level
- Parameters: `priority` (critical, high, medium, low)

**`get_category_hierarchy`**
- Get hierarchical category structure
- Parameters: `categoryId` (optional)

### Compliance Tool

**`check_compliance`**
- Generate compliance checklist for your service
- Parameters: `serviceDescription` (required)

## 🌐 HTTP API

When running `npm run serve:http`, access these endpoints:

### Search & Discovery
```http
GET /api/search?q=<query>&category=<category>&org=<organisation>
GET /api/standards/<id>
GET /api/categories
GET /api/recent?days=<days>
```

### Context-Aware Endpoints
```http
POST /api/applicable
{
  "workType": ["frontend", "backend"],
  "serviceType": ["citizen-facing"],
  "developmentPhase": ["development", "testing"]
}

GET /api/mandatory
GET /api/priority/<level>
GET /api/hierarchy?categoryId=<id>

POST /api/compliance
{
  "serviceDescription": "Description of your service"
}
```

## 📊 Curated Standards Categories

**102 standards across 11 focused categories:**

| Category | Count | When to Use |
|----------|-------|-------------|
| **Design and Build Government Services** | 30 | Any government service development |
| **Standards** | 21 | General compliance and best practices |
| **Secure By Design** | 14 | Security-focused development |
| **Accessibility** | 10 | Frontend/UI development |
| **Open source and open standards** | 8 | Technology selection and architecture |
| **APIs** | 5 | REST, SOAP, GraphQL development |
| **Legacy Technologies** | 3 | Modernization projects |
| **Native or Hybrid Apps** | 3 | Mobile app development |
| **Cloud Strategy** | 2 | Cloud adoption and migration |
| **Data** | 2 | Data management and GDPR |
| **Application Development** | 1 | General development guidance |

## 🔍 Search Capabilities

### Hybrid Search System
- **FTS Search**: Fast exact/partial keyword matching
- **Semantic Search**: Understanding meaning and context (when available)
- **Graceful Fallback**: Works even if semantic features unavailable

### Context-Aware Recommendations

Get relevant standards based on your specific work:

| Work Context | Example Results |
|--------------|----------------|
| Frontend + Citizen-facing | Accessibility standards, WCAG guidelines |
| Backend + APIs | API technical standards, security guidelines |
| Mobile + Native apps | iOS/Android security, app store guidelines |
| Cloud + Data | GDPR compliance, cloud-first policy |

## 🚀 Advanced Usage

### Custom Database Path
```bash
DATABASE_URL="sqlite:/custom/path/standards.db" npm run setup
```

### Update Existing Database
```bash
npm run update  # Refresh standards content
```

### Development Mode
```bash
npm run dev     # Run with hot reload
npm test        # Run test suite
```

### Logging Configuration
Set `LOG_LEVEL` environment variable:
- `error`: Errors only
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging

## 🏗 System Architecture

### Focused Approach
This system uses a **curated approach** rather than broad discovery:

- ✅ **102 specific URLs** from carefully selected UK Government standards
- ✅ **11 focused categories** with clear applicability context
- ✅ **Context-aware recommendations** based on your work context
- ✅ **Priority-based filtering** (critical, high, medium, low)
- ✅ **Mandatory vs. optional** clearly identified
- ✅ **Faster, predictable setup** (2-3 minutes vs 10+ minutes)

### Technology Stack
- **Database**: SQLite with FTS5 full-text search
- **Search**: Hybrid FTS + semantic similarity (optional)
- **Web Scraping**: Puppeteer with intelligent content processing
- **API**: Express.js HTTP server
- **MCP**: Full Model Context Protocol implementation
- **Embeddings**: Transformers.js with local models (optional)

## 📝 Data Sources

All 102 standards are sourced from official UK Government websites:

- **GDS Service Manual**: Design and accessibility standards
- **NCSC Guidance**: Security and cyber security standards  
- **Cabinet Office**: Digital service and open standards
- **Gov.UK Guidance**: APIs, cloud, and technical standards
- **ICO Resources**: Data protection and GDPR compliance

## 🔧 Troubleshooting

### Common Issues

**Database corruption:**
```bash
rm -f standards.db*
npm run setup
```

**Port already in use:**
```bash
# Change port in src/http-server.ts or kill existing process
pkill -f "http-server"
```

**Semantic search unavailable:**
- This is normal - the system gracefully falls back to FTS search
- Full semantic search requires additional vector database setup

### Getting Help

1. Check the logs in `logs/server.log`
2. Verify Node.js version: `node --version` (requires 18+)
3. Ensure database exists: `ls -la standards.db`
4. Test basic functionality: `npm test`

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🔄 Updates

The system automatically tracks when standards are updated. Run `npm run update` periodically to refresh content.

---

**Built for AI assistants to provide accurate, up-to-date UK Government technology guidance.**