window.WC = window.WC || {};
WC.ai = (function () {
  'use strict';
  var MODEL = 'claude-sonnet-5';
  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var STYLES = ['red', 'white', 'rose', 'sparkling', 'sweet', 'fortified'];

  // The four headers the Anthropic Messages API needs for a direct browser
  // call. anthropic-dangerous-direct-browser-access is what permits the
  // request past CORS from a page origin at all -- without it the browser
  // never even sends the request, it's refused before this code sees it.
  function headers(apiKey) {
    return {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
      'anthropic-dangerous-direct-browser-access': 'true'
    };
  }

  function identifySchema() {
    return {
      type: 'object',
      properties: {
        country: { type: 'string' },
        region: { type: 'string' },
        appellation: { type: 'string' },
        grapes: { type: 'array', items: { type: 'string' } },
        style: { type: 'string', enum: STYLES },
        tier: { type: 'string', enum: ['everyday', 'good', 'serious', 'benchmark'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['country', 'region', 'grapes', 'style', 'tier', 'confidence'],
      additionalProperties: false
    };
  }

  function notesSchema() {
    return {
      type: 'object',
      properties: {
        character: { type: 'string' },
        drinkingWindow: { type: 'string' },
        serving: { type: 'string' },
        pairings: { type: 'array', items: { type: 'string' } }
      },
      required: ['character', 'drinkingWindow', 'serving', 'pairings'],
      additionalProperties: false
    };
  }

  function identifyBody(name, vintage) {
    return {
      model: MODEL,
      max_tokens: 1024,
      system: 'You identify wines for a personal cellar app. Answer only from what you know about the named wine. ' +
        'If you are unsure, choose the most likely region and set confidence to low. Never invent a producer.',
      messages: [{ role: 'user', content: 'Wine: ' + name + '\nVintage: ' + vintage +
        '\nIdentify its country, region, appellation, principal grapes, style, and quality tier.' }],
      output_config: { format: { type: 'json_schema', schema: identifySchema() } }
    };
  }

  function notesBody(bottle) {
    var facts = [bottle.name, 'vintage ' + bottle.vintage, bottle.region, bottle.country,
                 (bottle.grapes || []).join(', ')].filter(Boolean).join(' · ');
    return {
      model: MODEL,
      max_tokens: 2048,
      system: 'You are a sommelier writing brief, concrete notes for a cellar owner. Two or three sentences per field. ' +
        'No marketing language and no scores.',
      messages: [{ role: 'user', content: 'Write notes for: ' + facts }],
      output_config: { format: { type: 'json_schema', schema: notesSchema() } }
    };
  }

  // response.content[0].text is a JSON string (the schema-constrained
  // payload), not an already-parsed object -- both failure modes (no usable
  // text block, or text that isn't valid JSON) collapse to the same error so
  // callers don't need to distinguish a malformed API response from a
  // malformed payload inside it.
  function parseResponse(json) {
    var block = json && Array.isArray(json.content) ? json.content[0] : null;
    if (!block || block.type !== 'text' || typeof block.text !== 'string') {
      throw new Error('Unusable AI response');
    }
    try { return JSON.parse(block.text); }
    catch (e) { throw new Error('Unusable AI response'); }
  }

  // The one place the API key touches the network: it goes only into the
  // x-api-key header of a request to ENDPOINT (api.anthropic.com), never
  // into a URL, never logged, and never echoed back in a rejection message.
  function call(body, apiKey) {
    if (!apiKey) { return Promise.reject(new Error('No API key')); }
    return window.fetch(ENDPOINT, {
      method: 'POST', headers: headers(apiKey), body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) { throw new Error('AI request failed: ' + res.status); }
      return res.json();
    }).then(parseResponse);
  }

  return {
    MODEL: MODEL, ENDPOINT: ENDPOINT, headers: headers,
    identifySchema: identifySchema, notesSchema: notesSchema,
    identifyBody: identifyBody, notesBody: notesBody, parseResponse: parseResponse,
    identify: function (name, vintage, apiKey) { return call(identifyBody(name, vintage), apiKey); },
    notes: function (bottle, apiKey) { return call(notesBody(bottle), apiKey); }
  };
})();
