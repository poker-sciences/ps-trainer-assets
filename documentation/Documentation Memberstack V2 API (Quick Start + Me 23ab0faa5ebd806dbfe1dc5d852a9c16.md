# Documentation Memberstack V2 API (Quick Start + Member Actions List Members - Get Members)

# **Quick Start**

Welcome to the Memberstack Admin REST API! This guide will help you get started with the server-side REST API that allows you to manage members, verify tokens, and perform other administrative tasks programmatically from your server.

### **Before You Start**

- Access to your Memberstack secret key (found in your Memberstack dashboard)
- A server-side environment to make secure API requests
- For paid functionality, a Memberstack account with an active billing method is required

## **Authentication**

The Memberstack Admin REST API uses secret keys to authenticate requests. These keys provide full access to your account, so they must be kept secure.

### **Secret Key Management**

You can view and manage your API keys in the Memberstack dashboard. There are two types of keys:

### **Test Mode Keys**

- Prefix: `sk_sb_`
- Use for development and testing
- Limited to 50 test members
- No real charges processed

### **Live Mode Keys**

- Prefix: `sk_`
- Use for production environments
- No member limits
- Real charges processed

⚠️ **Important:**

**Security Warning:** Your secret keys carry administrative privileges, so keep them secure and use them in server-side environments only! Never use your secret keys in publicly accessible places like:

- Webflow, WordPress, or other CMS platforms
- GitHub or other public repositories
- Client-side code (browser JavaScript)
- Mobile applications

### **Rate Limits**

The Memberstack Admin REST API has a rate limit of 25 requests per second. If you exceed this limit, you'll receive a 429 (Too Many Requests) error.

## **Making API Requests**

Learn how to structure your API requests to the Memberstack Admin REST API.

### **Base URL**

All API requests should be made to the following base URL:

https://admin.memberstack.com/

### **Authentication Headers**

Include your secret key in the `X-API-KEY` header with every request:

// Example using fetch
fetch('[https://admin.memberstack.com/members](https://admin.memberstack.com/members)', {
headers: {
'X-API-KEY': 'sk_sb_your_secret_key'
}
})

// Example using Axios
const axios = require('axios');

const API_KEY = process.env.MEMBERSTACK_SECRET_KEY;
const BASE_URL = '[https://admin.memberstack.com](https://admin.memberstack.com/)';

axios.get(`${BASE_URL}/members`, {
headers: {
'X-API-KEY': API_KEY
}
})

💡 **Tip:**

When making API requests:

- Always store your API key in environment variables
- Set proper content headers (`Content-Type: application/json`) for POST/PATCH
- Handle potential rate limiting with exponential backoff
- Implement proper error handling for all responses

## **Security Best Practices**

Follow these best practices to ensure your integration with the Memberstack Admin REST API is secure.

### **Secret Key Storage**

- Store secret keys in environment variables or a secure vault system (like AWS Secrets Manager, Hashicorp Vault, etc.)
- Use different keys for development and production environments
- Consider implementing key rotation for enhanced security
- Limit key access to only necessary team members

### **Server-Side Implementation**

- Only make API calls from secure server environments (Node.js, Python, Ruby, PHP, etc.)
- Never expose endpoints that directly proxy your secret key
- Use HTTPS for all API communication to ensure encryption of data in transit
- Implement proper validation and sanitization for any user input that influences API calls

### **Error Handling**

- Implement proper error handling for all API responses
- Avoid exposing detailed error messages to clients that might reveal implementation details
- Log errors securely for debugging without exposing sensitive information
- Consider implementing retry logic with exponential backoff for transient errors

### **Example Implementation**

Here's a secure example of implementing the Memberstack Admin REST API in a Node.js environment:

// secure-memberstack.js
const axios = require('axios');
require('dotenv').config();

// Load API key from environment variables
const API_KEY = process.env.MEMBERSTACK_SECRET_KEY;
if (!API_KEY) {
throw new Error('MEMBERSTACK_SECRET_KEY is not defined in environment variables');
}

// Create a configured axios instance
const memberstack = axios.create({
baseURL: '[https://admin.memberstack.com](https://admin.memberstack.com/)',
headers: {
'X-API-KEY': API_KEY,
'Content-Type': 'application/json'
}
});

// Add response interceptor for error handling
memberstack.interceptors.response.use(
response => response,
async error => {
// Handle rate limiting
if (error.response && error.response.status === 429) {
console.log('Rate limited. Retrying after delay...');
// Implement exponential backoff here
}

```
// Log error safely (without exposing sensitive data)
console.error('API Error:', {
  status: error.response?.status,
  url: error.config?.url,
  method: error.config?.method
});

return Promise.reject(error);

```

}
);

// Export the configured client
module.exports = memberstack;

# **Member Actions**

The Memberstack Admin REST API provides powerful endpoints for member management. This guide covers all member-related operations including listing, retrieving, creating, updating, and deleting members.

### **Before You Start**

- Make sure you have your secret key ready (refer to the [Quick Start](https://developers.memberstack.com/admin-rest-api/quick-start) guide for authentication details)
- All examples assume you've set up proper authentication headers
- Be mindful of the rate limit (25 requests per second)

## **List Members**

Retrieve a paginated list of all members in your application.

**Endpoint**

GET [https://admin.memberstack.com/members](https://admin.memberstack.com/members)

### **URL Parameters**

| **Parameter** | **Type** | **Description** |
| --- | --- | --- |
| after | number | The endCursor after which the querying should start |
| order | string | The order in which members should be queried (ASC or DESC, default: ASC) |
| limit | number | The maximum number of members to return (default: 50, max: 200) |

### **Examples**

Using curl:

curl --location --request GET '[https://admin.memberstack.com/members](https://admin.memberstack.com/members)' \
--header 'x-api-key: sk_sb_your_secret_key'

Using Axios:

const axios = require('axios');

const API_KEY = process.env.MEMBERSTACK_SECRET_KEY;
const BASE_URL = '[https://admin.memberstack.com/members](https://admin.memberstack.com/members)';
const headers = { "X-API-KEY": API_KEY };

// Basic request
const response = await axios.get(BASE_URL, { headers });

// With pagination
const paginatedResponse = await axios.get(BASE_URL, {
headers,
params: {
limit: 10,
after: 123456,
order: 'DESC'
}
});

**Response**

{
"totalCount": 25,      // Total number of members
"endCursor": 456,      // Cursor for pagination
"hasNextPage": true,   // Whether more results exist
"data": [              // Array of member objects
{
"id": "mem_abc123",
"createdAt": "2022-05-19T18:57:35.143Z",
"lastLogin": "2022-05-19T18:57:35.143Z",
"auth": {
"email": "[john@example.com](mailto:john@example.com)"
},
"customFields": {
"country": "Germany"
},
"metaData": {
"avatar": "photo.png"
},
"loginRedirect": "/welcome",
"permissions": ["view:basic:workouts"],
"planConnections": [
{
"id": "con_xyz789",
"status": "ACTIVE",
"planId": "pln_123abc",
"type": "FREE",
"payment": null
}
]
},
// Additional members...
]
}

💡 **Tip:**

Tips for working with pagination:

- Use the `endCursor` value from the response as the `after` parameter in your next request
- Check `hasNextPage` to determine if more results are available
- Set appropriate `limit` values to balance request count and payload size

## **Get Member**

Retrieve a specific member by ID or email.

**Endpoint**

GET [https://admin.memberstack.com/members/:id_or_email](https://admin.memberstack.com/members/:id_or_email)

### **URL Parameters**

Replace `:id_or_email` with either:

- Member ID (starts with "mem_")
- Member email address (URL-encoded)

### **Examples**

Get member by ID:

curl --location --request GET '[https://admin.memberstack.com/members/mem_abc123](https://admin.memberstack.com/members/mem_abc123)' \
--header 'x-api-key: sk_sb_your_secret_key'

Get member by email:

// Remember to URL-encode the email address
curl --location --request GET '[https://admin.memberstack.com/members/example%40test.com](https://admin.memberstack.com/members/example%40test.com)' \
--header 'x-api-key: sk_sb_your_secret_key'

Using Axios:

const axios = require('axios');

const API_KEY = process.env.MEMBERSTACK_SECRET_KEY;
const BASE_URL = '[https://admin.memberstack.com/members](https://admin.memberstack.com/members)';
const headers = { "X-API-KEY": API_KEY };

// Get by ID
const member = await axios.get(`${BASE_URL}/mem_abc123`, { headers });

// Get by email (URL-encode the email)
const encodedEmail = encodeURIComponent('user@example.com');
const memberByEmail = await axios.get(`${BASE_URL}/${encodedEmail}`, { headers });

**Response**

{
"data": {
"id": "mem_abc123",
"auth": {
"email": "[user@example.com](mailto:user@example.com)"
},
"createdAt": "2022-05-19T18:57:35.143Z",
"lastLogin": "2022-05-19T18:57:35.143Z",
"metaData": {
"language": "English"
},
"customFields": {
"country": "United States",
"firstName": "John"
},
"permissions": ["view:content"],
"loginRedirect": "/dashboard",
"planConnections": [
{
"id": "con_xyz789",
"status": "ACTIVE",
"planId": "pln_123abc",
"type": "FREE",
"payment": null
}
]
}
}