# SAS4 License Manager MCP Server

A Model Context Protocol (MCP) server for managing SAS4 Radius licenses through the Client Area API.

## Features

### Authentication
- **Automatic token management**: Handles login and token refresh automatically
- **AES-256-CBC encryption**: All API requests are encrypted using CryptoJS
- **Secure credential handling**: Credentials are passed per request

### Available Tools

1. **sas4_login** - Authenticate to the SAS4 Client Area
2. **sas4_search_licenses** - Search licenses by ID, EHWID, email, or any text
3. **sas4_get_license_by_id** - Get detailed license information by ID
4. **sas4_get_license_by_hwid** - Get licenses by Hardware ID (EHWID)
5. **sas4_get_licenses_by_email** - Get all licenses for a client email
6. **sas4_get_license_stats** - Get detailed statistics for a license
7. **sas4_list_licenses** - List licenses with filters (status, country, expiry)
8. **sas4_get_expired_licenses** - Get all expired licenses
9. **sas4_get_licenses_expiring_soon** - Get licenses expiring within X days

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make the script executable (optional):
```bash
chmod +x sas4-license-mcp-server.js
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sas4-license-manager": {
      "command": "node",
      "args": ["/absolute/path/to/sas4-license-mcp-server.js"]
    }
  }
}
```

## Usage with n8n

1. Add an MCP Client node to your workflow
2. Configure the endpoint URL to point to your MCP server
3. The MCP server will expose all 9 tools to the AI agent

## Tool Examples

### Search for a license by ID
```javascript
{
  "tool": "sas4_search_licenses",
  "arguments": {
    "email": "admin@example.com",
    "password": "your_password",
    "search": "12"
  }
}
```

### Get license by Hardware ID
```javascript
{
  "tool": "sas4_get_license_by_hwid",
  "arguments": {
    "email": "admin@example.com",
    "password": "your_password",
    "ehwid": "Q46I5-BEAAO-RQA4R-EBQDT"
  }
}
```

### Get licenses expiring in 30 days
```javascript
{
  "tool": "sas4_get_licenses_expiring_soon",
  "arguments": {
    "email": "admin@example.com",
    "password": "your_password",
    "days": 30
  }
}
```

### Get license statistics
```javascript
{
  "tool": "sas4_get_license_stats",
  "arguments": {
    "email": "admin@example.com",
    "password": "your_password",
    "license_id": 12
  }
}
```

## License Data Structure

Each license includes:
- **id**: License ID
- **ehwid**: Hardware ID
- **owner**: Client owner ID
- **client_details**: Email and ID of license owner
- **status**: Enabled/disabled status
- **enabled**: 1 = active, 0 = disabled
- **IsExpired**: 1 = expired, 0 = active
- **expiration**: Expiration date
- **n_users**: Current number of users
- **max_users**: Maximum allowed users
- **max_sites**: Maximum sites allowed
- **version**: SAS4 version
- **ip**: Last known IP address
- **country**: License country
- **last_contact**: Last contact timestamp
- **product_details**: Product name and ID

## Security Notes

1. **Encryption**: All API payloads are encrypted using AES-256-CBC
2. **Token Management**: Access tokens are cached and automatically refreshed
3. **Credentials**: Admin credentials are required for each request (not stored)
4. **HTTPS**: All API calls use HTTPS

## API Base URL

```
https://client.snono-systems.com/backend/index.php/api
```

## Error Handling

All tools return a standardized response:
```json
{
  "success": true/false,
  "data": {...},  // On success
  "error": "..."  // On failure
}
```

## Development

To test the server manually:
```bash
node sas4-license-mcp-server.js
```

The server communicates via stdio (standard input/output) following the MCP protocol.

## License

MIT