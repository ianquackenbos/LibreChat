const express = require('express');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const { buildEndpointOption, validateModel } = require('~/server/middleware');
const { getProviderConfig } = require('~/server/services/Endpoints');

const router = express.Router();

/**
 * POST /api/improve-prompt
 * Improves a user's prompt using the current model
 * Body: { text: string, endpoint: string, model?: string, conversationId?: string }
 * Returns: { improvedText: string }
 */
router.post('/', requireJwtAuth, validateModel, buildEndpointOption, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required and must be a non-empty string.' });
    }

    const endpointOption = req.endpointOption;
    if (!endpointOption) {
      return res.status(400).json({ error: 'Invalid endpoint configuration.' });
    }

    const appConfig = req.config;
    const endpoint = endpointOption.endpoint || req.body.endpoint;
    
    // Get the provider config to initialize the correct client
    const { getOptions } = getProviderConfig({ provider: endpoint, appConfig });
    
    if (!getOptions || typeof getOptions !== 'function') {
      return res.status(400).json({ error: `Endpoint ${endpoint} is not supported for prompt improvement.` });
    }

    // Initialize the client for the endpoint
    const initResult = await getOptions({
      req,
      res,
      endpointOption,
    });

    if (!initResult || !initResult.client) {
      return res.status(500).json({ error: 'Failed to initialize client.' });
    }

    const client = initResult.client;

    // Create a system message asking to improve the prompt
    const improvePrompt = `Please improve and refine the following user prompt. Make it clearer, more specific, and better structured while preserving the original intent. Return only the improved prompt without any additional explanation or commentary.

Original prompt:
"${text}"`;

    // Create a temporary message to send
    const userMessage = {
      messageId: `temp-${Date.now()}`,
      text: improvePrompt,
      role: 'user',
      sender: 'User',
    };

    // Send the message and get the improved prompt
    const response = await client.sendMessage(userMessage, {
      getReqData: () => {},
    });

    // Extract the improved text from the response
    let improvedText = '';
    if (response && response.text) {
      improvedText = response.text.trim();
      // Remove any quotes if the model wrapped the response in quotes
      if (
        (improvedText.startsWith('"') && improvedText.endsWith('"')) ||
        (improvedText.startsWith("'") && improvedText.endsWith("'"))
      ) {
        improvedText = improvedText.slice(1, -1);
      }
    } else {
      return res.status(500).json({ error: 'Failed to get improved prompt from model.' });
    }

    res.json({ improvedText });
  } catch (error) {
    logger.error('[/improve-prompt] Error improving prompt:', error);
    res.status(500).json({ error: 'Error improving prompt: ' + (error.message || 'Unknown error') });
  }
});

module.exports = router;

