# API Reference

Complete reference for the UK Government Technology Standards MCP Server API.

## Overview

The server provides two interfaces:
- **MCP Protocol**: For AI assistants and MCP-compatible clients
- **HTTP API**: RESTful API for web applications and direct integration

## MCP Tools Reference

### Core Search Tools

#### `search_uk_gov_standards`

Search across all 102 curated UK Government technology standards.

**Parameters:**
- `query` (string, required): Search terms
- `category` (string, optional): Filter by category name
- `organisation` (string, optional): Filter by source organisation

**Returns:**
```json
{
  "query": "API security",
  "filters": { "category": "APIs", "organisation": "NCSC" },
  "totalResults": 5,
  "searchType": "hybrid",
  "results": [
    {
      "standard": {
        "id": "guidance-gds-api-technical-standards",
        "title": "API technical and data standards",
        "category": "APIs",
        "url": "https://www.gov.uk/guidance/gds-api-technical-and-data-standards",
        "summary": "Standards for building APIs in government...",
        "sourceOrg": "GDS",
        "tags": ["api", "rest", "security"],
        "complianceLevel": "recommended"
      },
      "relevanceScore": 0.95,
      "matchedFields": ["title", "content", "semantic"]
    }
  ]
}
```

#### `get_standard_by_id`

Get detailed information about a specific standard.

**Parameters:**
- `standardId` (string, required): Unique identifier of the standard

**Returns:**
```json
{
  "standard": {
    "id": "guidance-gds-api-technical-standards",
    "title": "API technical and data standards",
    "category": "APIs",
    "url": "https://www.gov.uk/guidance/gds-api-technical-and-data-standards",
    "content": "Full content of the standard...",
    "summary": "Brief summary...",
    "sourceOrg": "GDS",
    "tags": ["api", "rest", "security"],
    "complianceLevel": "recommended",
    "lastUpdated": "2024-01-15T10:30:00Z",
    "relatedStandards": ["other-standard-id"]
  }
}
```

#### `list_categories`

Get all available categories with document counts.

**Parameters:** None

**Returns:**
```json
{
  "totalCategories": 11,
  "categories": [
    {
      "name": "Design and Build Government Services",
      "count": 30,
      "description": "Standards for government service development"
    },
    {
      "name": "APIs",
      "count": 5,
      "description": "REST, SOAP, and GraphQL development standards"
    }
  ]
}
```

#### `get_recent_updates`

Get recently updated standards.

**Parameters:**
- `daysBack` (number, optional, default: 30): Number of days to look back

**Returns:**
```json
{
  "daysBack": 30,
  "totalResults": 8,
  "standards": [
    {
      "id": "guidance-updated-standard",
      "title": "Recently Updated Standard",
      "category": "Security",
      "lastUpdated": "2024-01-20T14:30:00Z",
      "url": "https://www.gov.uk/guidance/updated-standard"
    }
  ]
}
```

### Context-Aware Tools

#### `get_applicable_standards`

Get standards applicable to specific work context.

**Parameters:**
- `workType` (array, required): Types of work
  - Values: `frontend`, `backend`, `fullstack`, `mobile`, `api`, `data`, `infrastructure`, `security`, `compliance`
- `serviceType` (array, required): Types of service
  - Values: `citizen-facing`, `internal`, `b2b`, `data-service`, `api-service`, `legacy-migration`
- `developmentPhase` (array, required): Development phases
  - Values: `planning`, `design`, `development`, `testing`, `deployment`, `maintenance`, `decommission`

**Returns:**
```json
{
  "context": {
    "workType": ["frontend"],
    "serviceType": ["citizen-facing"],
    "developmentPhase": ["development", "testing"]
  },
  "totalCategories": 4,
  "applicableStandards": [
    {
      "category": "Accessibility",
      "priority": "critical",
      "mandatory": true,
      "standards": [
        {
          "id": "accessibility-standard-1",
          "title": "Making your service accessible",
          "reason": "Required for citizen-facing frontend development"
        }
      ]
    }
  ]
}
```

#### `get_mandatory_standards`

Get all mandatory or critical priority standards.

**Parameters:** None

**Returns:**
```json
{
  "totalCategories": 6,
  "mandatoryStandards": [
    {
      "category": "Cloud Strategy",
      "priority": "critical",
      "standards": [
        {
          "id": "cloud-first-policy",
          "title": "Government Cloud First policy",
          "complianceLevel": "mandatory",
          "applicability": "All government services"
        }
      ]
    }
  ]
}
```

#### `get_standards_by_priority`

Filter standards by priority level.

**Parameters:**
- `priority` (string, required): Priority level
  - Values: `critical`, `high`, `medium`, `low`

**Returns:**
```json
{
  "priority": "critical",
  "totalStandards": 15,
  "categories": [
    {
      "name": "Security",
      "standards": [
        {
          "id": "security-standard-1",
          "title": "Cyber Security Standard",
          "priority": "critical",
          "mandatory": true
        }
      ]
    }
  ]
}
```

#### `get_category_hierarchy`

Get hierarchical category structure with relationships.

**Parameters:**
- `categoryId` (string, optional): Specific category to explore

**Returns:**
```json
{
  "hierarchy": [
    {
      "id": "design-build-services",
      "name": "Design and Build Government Services",
      "level": 1,
      "parentId": null,
      "children": [
        {
          "id": "accessibility",
          "name": "Accessibility",
          "level": 2,
          "parentId": "design-build-services",
          "standards": 10
        }
      ],
      "standards": 30
    }
  ]
}
```

### Compliance Tool

#### `check_compliance`

Generate a compliance checklist for a digital service.

**Parameters:**
- `serviceDescription` (string, required): Description of the digital service

**Returns:**
```json
{
  "serviceDescription": "A citizen-facing web application for tax filing",
  "analysis": {
    "serviceType": "citizen-facing",
    "workTypes": ["frontend", "backend", "data"],
    "riskLevel": "high"
  },
  "totalRequirements": 25,
  "compliance": {
    "mandatory": [
      {
        "standardId": "accessibility-wcag",
        "title": "WCAG 2.1 AA Compliance",
        "category": "Accessibility",
        "priority": "critical",
        "requirements": [
          "Implement proper heading structure",
          "Ensure keyboard navigation",
          "Provide alt text for images"
        ]
      }
    ],
    "recommended": [
      {
        "standardId": "api-security",
        "title": "API Security Standards",
        "category": "Security",
        "priority": "high",
        "requirements": [
          "Use OAuth 2.0 for authentication",
          "Implement rate limiting"
        ]
      }
    ]
  }
}
```

## HTTP API Reference

Base URL: `http://localhost:3001` (when running `npm run serve:http`)

### Search Endpoints

#### `GET /api/search`

Search across all standards.

**Query Parameters:**
- `q` (string, required): Search query
- `category` (string, optional): Filter by category
- `organisation` (string, optional): Filter by organisation

**Response:**
```json
{
  "query": "API security",
  "filters": {
    "category": "APIs",
    "organisation": "NCSC"
  },
  "totalResults": 5,
  "results": [
    {
      "id": "api-security-standard",
      "title": "API Security Guidelines",
      "category": "APIs",
      "url": "https://www.gov.uk/guidance/api-security",
      "summary": "Security guidelines for API development...",
      "sourceOrg": "NCSC",
      "tags": ["api", "security", "oauth"],
      "complianceLevel": "recommended",
      "relevanceScore": 0.95
    }
  ]
}
```

#### `GET /api/standards/:id`

Get a specific standard by ID.

**Response:**
```json
{
  "id": "api-security-standard",
  "title": "API Security Guidelines",
  "category": "APIs",
  "url": "https://www.gov.uk/guidance/api-security",
  "content": "Full content...",
  "summary": "Brief summary...",
  "sourceOrg": "NCSC",
  "tags": ["api", "security"],
  "complianceLevel": "recommended",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "relatedStandards": []
}
```

#### `GET /api/categories`

Get all categories.

**Response:**
```json
{
  "totalCategories": 11,
  "categories": [
    {
      "name": "APIs",
      "count": 5
    }
  ]
}
```

#### `GET /api/recent`

Get recently updated standards.

**Query Parameters:**
- `days` (number, optional, default: 30): Days to look back

**Response:**
```json
{
  "daysBack": 30,
  "totalResults": 8,
  "standards": [
    {
      "id": "updated-standard",
      "title": "Updated Standard",
      "category": "Security",
      "lastUpdated": "2024-01-20T14:30:00Z"
    }
  ]
}
```

### Context-Aware Endpoints

#### `POST /api/applicable`

Get applicable standards for work context.

**Request Body:**
```json
{
  "workType": ["frontend", "backend"],
  "serviceType": ["citizen-facing"],
  "developmentPhase": ["development", "testing"]
}
```

**Response:**
```json
{
  "context": {
    "workType": ["frontend", "backend"],
    "serviceType": ["citizen-facing"],
    "developmentPhase": ["development", "testing"]
  },
  "totalCategories": 6,
  "applicableStandards": [
    {
      "category": "Accessibility",
      "priority": "critical",
      "mandatory": true,
      "standards": [
        {
          "id": "wcag-standard",
          "title": "WCAG 2.1 Guidelines",
          "reason": "Required for citizen-facing services"
        }
      ]
    }
  ]
}
```

#### `GET /api/mandatory`

Get all mandatory standards.

**Response:**
```json
{
  "totalCategories": 6,
  "mandatoryStandards": [
    {
      "category": "Cloud Strategy",
      "priority": "critical",
      "standards": [
        {
          "id": "cloud-first",
          "title": "Government Cloud First policy",
          "complianceLevel": "mandatory"
        }
      ]
    }
  ]
}
```

#### `GET /api/priority/:level`

Get standards by priority level.

**Path Parameters:**
- `level` (string): Priority level (`critical`, `high`, `medium`, `low`)

**Response:**
```json
{
  "priority": "critical",
  "totalStandards": 15,
  "categories": [
    {
      "name": "Security",
      "standards": [
        {
          "id": "security-standard",
          "title": "Security Guidelines",
          "priority": "critical"
        }
      ]
    }
  ]
}
```

#### `GET /api/hierarchy`

Get category hierarchy.

**Query Parameters:**
- `categoryId` (string, optional): Specific category

**Response:**
```json
{
  "hierarchy": [
    {
      "id": "apis",
      "name": "APIs",
      "level": 1,
      "standards": 5,
      "children": []
    }
  ]
}
```

#### `POST /api/compliance`

Generate compliance checklist.

**Request Body:**
```json
{
  "serviceDescription": "A web application for citizens to apply for benefits"
}
```

**Response:**
```json
{
  "serviceDescription": "A web application for citizens to apply for benefits",
  "analysis": {
    "serviceType": "citizen-facing",
    "workTypes": ["frontend", "backend", "data"],
    "riskLevel": "high"
  },
  "totalRequirements": 30,
  "compliance": {
    "mandatory": [
      {
        "standardId": "accessibility-wcag",
        "title": "WCAG 2.1 AA Compliance",
        "category": "Accessibility",
        "requirements": [
          "Ensure keyboard navigation works",
          "Provide alternative text for images",
          "Use sufficient color contrast"
        ]
      }
    ],
    "recommended": [
      {
        "standardId": "data-protection",
        "title": "GDPR Compliance",
        "category": "Data",
        "requirements": [
          "Implement data retention policies",
          "Provide data export functionality"
        ]
      }
    ]
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional details if available"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found (standard/category not found)
- `500`: Internal Server Error

## Rate Limiting

The HTTP API implements basic rate limiting:
- **100 requests per minute** per IP address
- **Burst limit**: 20 requests in 10 seconds

## Data Freshness

- **Standards Content**: Updated when `npm run update` is executed
- **Categories**: Computed dynamically from current standards
- **Search Index**: Rebuilt automatically when content changes

## Search Features

### Hybrid Search
- **FTS (Full-Text Search)**: Fast exact and partial keyword matching
- **Semantic Search**: Understanding context and meaning (when available)
- **Combined Scoring**: Weighted combination of both approaches

### Search Operators
- **Exact phrases**: `"API security"`
- **Boolean operators**: `API AND security`
- **Wildcard**: `secur*` (matches security, secure, etc.)
- **Field-specific**: Limited to title, content, tags, and summary

### Relevance Scoring
- **FTS Score**: BM25 algorithm for keyword relevance
- **Semantic Score**: Cosine similarity for meaning relevance
- **Combined Score**: Weighted average (60% semantic, 40% FTS when both available)

---

For implementation details and source code, see the [GitHub repository](https://github.com/your-repo/uk-gov-tech-standards-mcp).
