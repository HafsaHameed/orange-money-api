
const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getSecret } = require("./services/secretManager");
const app = express();
app.use(express.json());

// ✅ Browser-friendly CORS (TEMP: open)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,x-orange-env'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;

const ORANGE_CONFIG = {
  sandbox: {
    baseUrl: 'https://api.sandbox.orange-sonatel.com',
  },
  production: {
    baseUrl: 'https://api.orange-sonatel.com',
  },
};

function getOrangeEnv(req) {
  const env = req.headers['x-orange-env'];
  if (!env || !ORANGE_CONFIG[env]) {
    throw new Error('Missing x-orange-env: sandbox | production');
  }
  return ORANGE_CONFIG[env];
}

/* ================= ACCESS TOKEN ================= */

app.post('/getAccessToken', async (req, res) => {
  try {
    const environment = req.headers["x-orange-env"];

const clientId = await getSecret(
    `orange-${environment}-client-id`
);

const clientSecret = await getSecret(
    `orange-${environment}-client-secret`
);
     const orangeEnv = getOrangeEnv(req);
    const response = await fetch(
      `${orangeEnv.baseUrl}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      //  body: `grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`,
          body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    res.json({ accessToken: data.access_token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/getPublicKey', async (req, res) => {
  try {
    const orangeEnv = getOrangeEnv(req);
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const environment = req.query.environment || 'sandbox';
    if (!token) return res.status(400).json({ error: 'Missing Bearer token' });

    const r = await fetch(`${orangeEnv.baseUrl}/api/account/v1/publicKeys`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json(data);

    // Orange returns: { keyId, keyType, keySize, key }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

/* ================= ENCRYPT PIN ================= */

app.post('/encryptPin', async(req, res) => {
  try {
   // const { key, pinCode } = req.body;
    const { key } = req.body;
//const pinCode = "2021"; //uncoment for testing
//const pinCode = req.body.pinCode || process.env.PARTNER_PIN;
    console.log("x-orange-env:", req.headers["x-orange-env"]);
const environment = req.headers["x-orange-env"];

const pinCode = await getSecret(
    `orange-${environment}-partner-pin`
);
if (!pinCode) return res.status(400).json({ error: 'PARTNER_PIN env var not set' });

    const publicKey = `-----BEGIN PUBLIC KEY-----\n${key
      .match(/.{1,64}/g)
      .join('\n')}\n-----END PUBLIC KEY-----`;

    const encryptedPin = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(pinCode)
    );

    res.json({ encryptedPin: encryptedPin.toString('base64') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= CASHIN ================= */

app.post('/cashin', async (req, res) => {
  try {
    const orangeEnv = getOrangeEnv(req);
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const response = await fetch(
      `${orangeEnv.baseUrl}/api/eWallet/v1/cashins`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= VERIFY ================= */

app.get('/verifyTransaction', async (req, res) => {
  try {
    const orangeEnv = getOrangeEnv(req);
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const response = await fetch(
      `${orangeEnv.baseUrl}/api/eWallet/v1/transactions?transactionId=${req.query.transactionId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= HEALTH ================= */

app.get('/health', (_, res) => res.json({ status: 'OK' }));

/* ================= CLOUD RUN ================= */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('🚀 Running on port', PORT);
});






/*const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const NodeRSA = require('node-rsa'); 
const { v4: uuidv4 } = require('uuid');

const app = express(); // ✅ MUST come before app.use

app.use(express.json());

// Basic CORS middleware (no external dependency required for deployment)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-orange-env');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const ORANGE_CONFIG = {
  sandbox: {
    baseUrl: 'https://api.sandbox.orange-sonatel.com',
    name: 'SANDBOX',
  },
  production: {
    baseUrl: 'https://api.orange-sonatel.com', // confirm with Orange
    name: 'PRODUCTION',
  },
};

function getOrangeEnv(req) {
  const env = req.headers['x-orange-env'];

  if (!env || !ORANGE_CONFIG[env]) {
    throw new Error(
      'Invalid or missing x-orange-env header. Use: sandbox | production'
    );
  }

  return ORANGE_CONFIG[env];
}

// Endpoint to obtain the access token
app.post('/getAccessToken', async (req, res) => {
    try {
        const response = await fetch('https://api.sandbox.orange-sonatel.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`,
        });

        const data = await response.json();
        
        // Log the full response and data for debugging
        console.log('Response status:', response.status);
        console.log('Response body:', data);

        if (response.status === 200) {
            res.json({ accessToken: data.access_token });
        } else {
            res.status(response.status).json({ 
                error: 'Failed to get access token', 
                details: data 
            });
        }
    } catch (error) {
        console.error('Error fetching access token:', error);  // Log the error for debugging
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Endpoint to get the public key for PIN encryption
app.post('/getPublicKey', async (req, res) => {
    const { accessToken } = req.body;

    try {
        const response = await fetch('https://api.sandbox.orange-sonatel.com/api/account/v1/publicKeys', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        if (response.status === 200) {
            res.json({ key: data.key });
        } else {
            res.status(response.status).json({ error: 'Failed to fetch public key' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Endpoint to generate a test number
app.get('/generateTestNumber', async (req, res) => {
    // Get the access token from the Authorization header, and strip the 'Bearer ' prefix
    const authorizationHeader = req.headers.authorization;
    const accessToken = authorizationHeader && authorizationHeader.split(' ')[1]; // Extract the token

    const { nbMerchants, nbCustomers } = req.query; // Extract query parameters from the URL

    if (!accessToken) {
        return res.status(401).json({ error: 'Missing or invalid access token' });
    }

    try {
        const response = await fetch(`https://api.sandbox.orange-sonatel.com/api/assignments/v1/partner/sim-cards?nbMerchants=${nbMerchants}&nbCustomers=${nbCustomers}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`, // Pass the access token here
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        if (response.status === 200) {
            res.json({partnerid: data[0].msisdn,merchantCode: data[0].merchantCode, msisdn: data[1].msisdn, pinCode: data[1].pinCode });
        } else {
            res.status(response.status).json({ error: 'Failed to generate test number' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});


// Endpoint to encrypt PIN using the public key
// NOTE: crypto is already imported at the top of the file.
// const crypto = require('crypto');


app.post('/encryptPin', (req, res) => {
    const { key, pinCode } = req.body;

    try {
        // Ensure the public key is in the correct PEM format with 64 character line breaks
        const publicKey = `-----BEGIN PUBLIC KEY-----\n${key.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;

        // Convert the PIN code to a buffer
        const buffer = Buffer.from(pinCode, 'utf8');

        // Encrypt the PIN code using the public key and the correct RSA padding
        const encryptedPin = crypto.publicEncrypt({
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_PADDING
        }, buffer);

        // Respond with the encrypted PIN in base64 format
        res.json({ encryptedPin: encryptedPin.toString('base64') });
    } catch (error) {
        res.status(500).json({ error: 'Encryption error: ' + error.message });
    }
});



// Endpoint to request OTP
app.post('/requestOtp', async (req, res) => {
        const authorizationHeader = req.headers.authorization;
    const accessToken = authorizationHeader && authorizationHeader.split(' ')[1];
    const { msisdn, encryptedPinCode } = req.body;

    try {
        const response = await fetch('https://api.sandbox.orange-sonatel.com/api/eWallet/v1/payments/otp', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idType: 'MSISDN', id: msisdn, encryptedPinCode: encryptedPinCode}),
        });

        const data = await response.json();
        if (response.status === 200) {
            res.json({ otp: data.otp });
        } else {
            res.status(response.status).json({ error: 'Failed to request OTP' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

app.post('/performOneStepPayment', async (req, res) => {
    const { otp, msisdn, merchantCode, amount, accessToken } = req.body;

    // Generate a unique correlationId
    const correlationId = uuidv4();
    console.log('Making request with correlationId:', correlationId); // Log the correlationId

    try {
        const response = await fetch('https://api.sandbox.orange-sonatel.com/api/eWallet/v1/payments/onestep', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customer: {
                    idType: 'MSISDN',
                    id: msisdn,
                    otp: otp
                },
                partner: {
                    idType: 'CODE',
                    id: merchantCode
                },
                amount: {
                    value: amount,
                    unit: 'XOF'
                },
                reference: correlationId
            }),
        });

        // Log the response status and body
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response body:', data);

        if (response.status === 200) {
            res.json({ paymentResult: data });
        } else {
            res.status(response.status).json({ error: data });
        }
    } catch (error) {
        // Log the error
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});


//CASHIN API
// ===== CASHIN ENDPOINT =====
//Third version no hardcoded endpoint urls use dynamic urls for sandbox and productin

app.post('/cashin', async (req, res) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.split(' ')[1];

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' });
  }
  const orangeEnv = getOrangeEnv(req);
  const { partner, customer, amount, reference, receiveNotification } = req.body;

  if (!partner || !customer || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch(
      `${orangeEnv.baseUrl}/api/eWallet/v1/cashins`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partner,
          customer,
          amount,
          reference: reference || '',
          receiveNotification: receiveNotification || false,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return res.json({ success: true, data });
    }

    return res.status(response.status).json({ success: false, error: data });

  } catch (err) {
    console.error('Cashin error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/verifyTransaction', async (req, res) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.split(' ')[1];
  const orangeEnv = getOrangeEnv(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  const { transactionId } = req.query;
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId required' });
  }

  try {
    const orangeEnv = getOrangeEnv(req);

    const response = await fetch(
      `${orangeEnv.baseUrl}/api/eWallet/v1/transactions?transactionId=${transactionId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      return res.json({
        success: true,
        status: data?.[0]?.status ?? 'unknown',
        data,
      });
    }

    return res.status(response.status).json({ success: false, error: data });

  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: err.message });
  }
});
*/


//_____________________________________________________________________________________________________________________________________________________________
/*app.post('/cashin', async (req, res) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.split(' ')[1];
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token (provide Bearer <token>)' });
  }

  const { partner, customer, amount, reference, receiveNotification } = req.body;

  if (!partner || !customer || !amount) {
    return res.status(400).json({ error: 'Missing required fields: partner, customer, amount' });
  }

  try {
    const response = await fetch('https://api.sandbox.orange-sonatel.com/api/eWallet/v1/cashins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        partner,
        customer,
        amount,
        reference: reference || '',
        receiveNotification: receiveNotification || false
      }),
    });

    const data = await response.json();
    console.log('CASHIN response status:', response.status);
    console.log('CASHIN response body:', data);

    if (response.ok) {
      res.json({ success: true, data });
    } else {
      res.status(response.status).json({ success: false, error: data });
    }
  } catch (err) {
    console.error('Cashin error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});


// ===== VERIFY TRANSACTION ENDPOINT =====
//new corected headers
app.get('/verifyTransaction', async (req, res) => {
  try {
    // ✅ Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing access token. Provide header: Authorization: Bearer <token>',
      });
    }

    // ✅ Get transaction ID from query parameter (e.g., ?transactionId=CI251016.1901.B00238)
    const { transactionId } = req.query;
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: transactionId',
      });
    }

    // ✅ Orange Money Verify Transaction API URL (uses query parameter, not path)
    const url = `https://api.sandbox.orange-sonatel.com/api/eWallet/v1/transactions?transactionId=${transactionId}`;

    // ✅ Make request to Orange Money API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // ✅ Parse JSON safely
    const data = await response.json();
    console.log('VERIFY → Status:', response.status);
    console.log('VERIFY → Body:', data);

    // ✅ Handle success or failure
    if (response.ok) {
     const status = data?.[0]?.status || 'unknown';
      return res.json({
        success: true,
        status,
        data,
      });
    } else {
      return res.status(response.status).json({
        success: false,
        error: data,
      });
    }

  } catch (err) {
    console.error('VERIFY TRANSACTION ERROR:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error: ' + err.message,
    });
  }
});
*/

//previous
/*app.post('/verifyTransaction', async (req, res) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.split(' ')[1];
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token (provide Bearer <token>)' });
  }

  const { reference } = req.body;
  if (!reference) {
    return res.status(400).json({ error: 'Missing required field: reference' });
  }

  try {
    const url = `https://api.sandbox.orange-sonatel.com/api/eWallet/v1/transactions/${reference}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('VERIFY response status:', response.status);
    console.log('VERIFY response body:', data);

    if (response.ok) {
      res.json({ success: true, data });
    } else {
      res.status(response.status).json({ success: false, error: data });
    }
  } catch (err) {
    console.error('Verify transaction error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});
*/
// Start the server
/*const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});*/
