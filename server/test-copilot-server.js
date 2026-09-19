require('dotenv').config()
const cors = require('cors')
const express = require('express')
const { CopilotRuntime, OpenAIAdapter } = require('@copilotkit/runtime')
const OpenAI = require('openai')

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'CopilotKit Test Server Running' })
})

// Initialize CopilotKit runtime
const openai = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama'
})
const serviceAdapter = new OpenAIAdapter({ 
  openai, 
  model: 'hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M' 
})
const runtime = new CopilotRuntime()

// CopilotKit info endpoint for runtime discovery
app.get('/api/copilotkit/info', (req, res) => {
  res.json({
    agents: {
      default: {
        id: 'default',
        description: 'Default AI assistant for accounting system',
        capabilities: ['text']
      }
    },
    version: '1.0.0'
  })
})

// Simple test endpoint to verify OpenAI connection
app.post('/api/test-ai', async (req, res) => {
  try {
    const { message } = req.body
    console.log('Test AI request:', message)
    
    const response = await openai.chat.completions.create({
      model: 'hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M',
      messages: [{ role: 'user', content: message }]
    })
    
    res.json({ 
      success: true, 
      response: response.choices[0].message.content 
    })
  } catch (error) {
    console.error('AI Test Error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// CopilotKit agent connect endpoint
app.post('/api/copilotkit/agent/:agentId/connect', async (req, res) => {
  try {
    console.log('Agent connect request:', req.params, req.body)
    
    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    const { threadId } = req.body
    
    console.log('Connection established for thread:', threadId)
    
    // Send connection established event
    res.write(`data: ${JSON.stringify({ type: 'connection_established', threadId })}\n\n`)
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
    
  } catch (error) {
    console.error('Agent connect error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
      res.end()
    }
  }
})

// CopilotKit agent run endpoint
app.post('/api/copilotkit/agent/:agentId/run', async (req, res) => {
  try {
    console.log('Agent run request:', req.params, req.body)
    
    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    const { messages = [], threadId, context = [], tools = [] } = req.body
    
    // Extract user messages from the request
    const userMessages = messages.map(m => ({ role: m.role, content: m.content }))
    
    // Build system prompt with context
    let systemPrompt = 'You are a helpful accounting assistant for an accounting system. '
    
    // Add context information if available
    if (context && context.length > 0) {
      const contextInfo = context.find(c => c.description === 'Current application route and site structure')
      if (contextInfo && contextInfo.value) {
        try {
          const siteInfo = JSON.parse(contextInfo.value)
          systemPrompt += `Current path: ${siteInfo.currentPath}. Available routes: ${Object.keys(siteInfo.siteMap).join(', ')}. `
        } catch (e) {
          console.log('Error parsing context:', e)
        }
      }
    }
    
    // Prepare messages for AI
    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...userMessages
    ]
    
    console.log('Sending to AI:', aiMessages)
    
    // Get AI response
    let response
    try {
      response = await openai.chat.completions.create({
        model: 'hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M',
        messages: aiMessages,
        stream: true
      })
      console.log('AI response started')
    } catch (aiError) {
      console.error('AI API Error:', aiError)
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'AI API error: ' + aiError.message })}\n\n`)
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
      return
    }
    
    // Stream the response using CopilotKit event format
    let hasContent = false
    try {
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          hasContent = true
          console.log('Streaming content:', content)
          res.write(`data: ${JSON.stringify({ type: 'text', text: content })}\n\n`)
        }
      }
      
      if (!hasContent) {
        console.log('No content received from AI')
        res.write(`data: ${JSON.stringify({ type: 'text', text: 'I apologize, but I could not generate a response. Please try again.' })}\n\n`)
      }
      
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
    } catch (streamError) {
      console.error('Streaming error:', streamError)
      if (!res.headersSent) {
        res.status(500).json({ error: streamError.message })
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming error: ' + streamError.message })}\n\n`)
        res.end()
      }
    }
    
  } catch (error) {
    console.error('Agent run error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
      res.end()
    }
  }
})

// Legacy CopilotKit endpoint for compatibility
app.post('/api/copilotkit', async (req, res) => {
  try {
    console.log('Legacy CopilotKit request received:', req.body)
    
    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    const { messages = [], action } = req.body
    
    // Handle different request formats
    let userMessages = messages
    if (action === 'chat' && req.body.message) {
      userMessages = [{ role: 'user', content: req.body.message }]
    }
    
    // Get AI response
    const response = await openai.chat.completions.create({
      model: 'hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M',
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
      stream: true
    })
    
    // Stream the response
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        res.write(`data: ${JSON.stringify({ type: 'text', text: content })}\n\n`)
      }
    }
    
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
    
  } catch (error) {
    console.error('CopilotKit Error:', error)
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error.message 
      })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
      res.end()
    }
  }
})

const PORT = process.env._SERVER_PORT || 4000
const HOST = process.env._SERVER_URL || 'localhost'

app.listen(PORT, () => {
  console.log(`CopilotKit test server running on http://${HOST}:${PORT}`)
  console.log(`Test AI endpoint: http://${HOST}:${PORT}/api/test-ai`)
  console.log(`CopilotKit endpoint: http://${HOST}:${PORT}/api/copilotkit`)
  console.log(`\nTo test the AI endpoint:`)
  console.log(`curl -X POST http://${HOST}:${PORT}/api/test-ai -H "Content-Type: application/json" -d '{"message":"Hello"}'`)
  console.log(`\nTo test the CopilotKit endpoint:`)
  console.log(`curl -X POST http://${HOST}:${PORT}/api/copilotkit -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"Hello"}]}'`)
})