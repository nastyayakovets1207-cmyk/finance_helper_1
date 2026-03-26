exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { action, data } = JSON.parse(event.body);

  const AUTHORIZATION_KEY = 'Basic MDE5ZDFmOTgtNDQ4NC03ZmYwLWFhNjUtYzlmYzA1ZGI2MTA3OjYzMDY0OWEyLWUwYmQtNGZhOC1iMDY4LTU1ZjFkOWZmOTRlMQ==';
  const RQUID = 'b189f96a-b968-4970-a3c1-a86e2fd26cbf';
  const SCOPE = 'GIGACHAT_API_PERS';

  if (action === 'auth') {
    try {
      const authResponse = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': RQUID,
          'Authorization': AUTHORIZATION_KEY,
        },
        body: new URLSearchParams({ scope: SCOPE }),
      });
      const authData = await authResponse.json();
      return { statusCode: 200, headers, body: JSON.stringify(authData) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  } 
  else if (action === 'chat') {
    const { messages, token } = data;
    try {
      const chatResponse = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'GigaChat',
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });
      const chatData = await chatResponse.json();
      return { statusCode: 200, headers, body: JSON.stringify(chatData) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  } 
  else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  }
};
