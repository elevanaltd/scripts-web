import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Vercel API Route: SmartSuite Proxy
 *
 * This serverless function proxies requests to the SmartSuite API,
 * handling authentication server-side to keep the API key secure.
 *
 * Route: /api/smartsuite/[...path]
 * Example: /api/smartsuite/api/v1/applications/list
 * Proxies to: https://api.smartsuite.com/api/v1/applications/list
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS for browser requests
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Get the path segments after /api/smartsuite/
  const { path: pathSegments } = req.query
  const smartSuitePath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || ''

  // Build the SmartSuite API URL
  const smartSuiteUrl = `https://app.smartsuite.com/${smartSuitePath}`

  // Get SmartSuite API key from environment
  const apiKey = process.env.SMARTSUITE_API_KEY
  const workspaceId = process.env.SMARTSUITE_WORKSPACE_ID || 's3qnmox1'

  if (!apiKey) {
    console.error('SmartSuite API key not configured')
    return res.status(500).json({
      error: 'SmartSuite API key not configured',
      details: 'SMARTSUITE_API_KEY environment variable is missing'
    })
  }

  try {
    // Prepare headers for SmartSuite API
    const headers: HeadersInit = {
      'Authorization': `Token ${apiKey}`,
      'ACCOUNT-ID': workspaceId,
      'Content-Type': 'application/json'
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: req.method || 'GET',
      headers
    }

    // Add body for non-GET requests
    if (req.method !== 'GET' && req.body) {
      fetchOptions.body = JSON.stringify(req.body)
    }

    console.log(`[SmartSuite Proxy] ${req.method} ${smartSuiteUrl}`)

    // Make request to SmartSuite API
    const response = await fetch(smartSuiteUrl, fetchOptions)

    // Get response data
    const data = await response.json()

    // Log response status
    console.log(`[SmartSuite Response] Status: ${response.status}`)

    // Return response to client
    if (response.ok) {
      return res.status(response.status).json(data)
    } else {
      console.error(`[SmartSuite Error] ${response.status}: ${response.statusText}`)
      return res.status(response.status).json({
        error: `SmartSuite API error: ${response.status} ${response.statusText}`,
        details: data
      })
    }
  } catch (error) {
    console.error('[SmartSuite Proxy Error]', error)
    return res.status(500).json({
      error: 'Failed to proxy request to SmartSuite',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}