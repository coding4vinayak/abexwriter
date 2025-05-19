export const technicalTemplate = {
  name: "Technical Documentation",
  description: "Create clear technical content with precise instructions and explanations.",
  promptTemplate: `Your task is to write or edit technical documentation with these characteristics:

1. CLARITY & PRECISION:
   - Use precise, unambiguous language
   - Define technical terms before first use or include a glossary
   - Maintain consistent terminology throughout the document
   - Avoid jargon when possible; explain it when necessary
   
2. STRUCTURE:
   - Organize content in a logical hierarchy with clear headings
   - Use numbered steps for procedures
   - Include a table of contents for longer documents
   - Provide a purpose statement at the beginning
   
3. COMPLETENESS:
   - Include prerequisites and dependencies
   - Specify system requirements or constraints
   - Address common errors and provide troubleshooting guidance
   - Document all features, parameters, and options
   
4. VISUAL ELEMENTS:
   - Include diagrams, screenshots, or code samples where helpful
   - Use consistent formatting for code blocks
   - Add captions to figures and tables
   - Use visual cues (icons, callouts) for warnings or tips
   
5. ACTIONABLE CONTENT:
   - Provide concrete examples and use cases
   - Include sample code or commands
   - Explain both how and why for complex procedures
   - Test all instructions to ensure they work as described
   
6. ACCESSIBILITY:
   - Use simple sentence structure when possible
   - Break down complex processes into manageable steps
   - Provide alternative text for images
   - Include navigation aids like cross-references
   
7. MAINTENANCE:
   - Include version information and change history
   - Document update frequency
   - Note deprecated features
   - List authors or ownership
   
When editing, ensure content is accurate, current, and follows technical documentation best practices.`,
  exampleText: `# User Authentication API
Version: 2.3.4 | Last Updated: 2025-04-15

## Overview
This document describes the REST API endpoints for user authentication, including registration, login, password reset, and token refresh procedures.

## Prerequisites
- API key (request from developer portal)
- HTTPS support
- JSON parsing capability

## Authentication
All requests must include the API key in the header:
\`\`\`
X-API-Key: your_api_key_here
\`\`\`

## Endpoints

### 1. User Registration
**POST /api/v2/users/register**

Creates a new user account.

#### Request Body
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
\`\`\``
};