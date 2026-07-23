
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

//const client_id = process.env.CLIENT_ID;
//const client_secret = process.env.CLIENT_SECRET;

const ORANGE_CONFIG = {
  sandbox: {
    baseUrl: 'https://api.sandbox.orange-sonatel.com',
  },
  production: {
    baseUrl: 'https://api.orange-sonatel.com',
  },
};
async function getOrangeSecrets(environment) {
  if (!environment) {
    throw new Error("Missing x-orange-env header.");
  }

  const clientId = await getSecret(
    `orange-${environment}-client-id`
  );

  const clientSecret = await getSecret(
    `orange-${environment}-client-secret`
  );

  const partnerPin = await getSecret(
    `orange-${environment}-partner-pin`
  );

  return {
    clientId,
    clientSecret,
    partnerPin,
  };
}
function getOrangeEnv(req) {
  const env = req.headers['x-orange-env'];
  if (!env || !ORANGE_CONFIG[env]) {
    throw new Error('Missing x-orange-env: sandbox | production');
  }
  return ORANGE_CONFIG[env];
}

/* ================= ACCESS TOKEN ================= */

/*app.post('/getAccessToken', async (req, res) => {
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

*/
app.post("/getAccessToken", async (req, res) => {
  try {

    const orangeEnv = getOrangeEnv(req);
    const environment = req.headers["x-orange-env"];

    const {
      clientId,
      clientSecret,
    } = await getOrangeSecrets(environment);

    const response = await fetch(
      `${orangeEnv.baseUrl}/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          `grant_type=client_credentials` +
          `&client_id=${clientId}` +
          `&client_secret=${clientSecret}`,
      }
    );

    const data = await response.json();

    return res.status(response.status).json(data);

  } catch (e) {

    console.error(e);

    return res.status(500).json({
      error: e.message,
    });

  }
});
app.get('/getPublicKey', async (req, res) => {
  try {
    const orangeEnv = getOrangeEnv(req);
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  //  const environment = req.query.environment || 'sandbox';
    if (!token) return res.status(400).json({ error: 'Missing Bearer token' });

    const r = await fetch(`${orangeEnv.baseUrl}/api/account/v1/publicKeys`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json(data);

    // Orange returns: { keyId, keyType, keySize, key }
    res.json(data);
  } catch(err){

    console.error(err);

    res.status(500).json({
        success:false,
        error:err.message
    });

}
});

/* ================= ENCRYPT PIN ================= */

/*app.post('/encryptPin', async(req, res) => {
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
*/
app.post("/encryptPin", async (req, res) => {
  try {

    const environment = req.headers["x-orange-env"];

    const {
      partnerPin,
    } = await getOrangeSecrets(environment);

    const { key } = req.body;

    if (!key) {
      return res.status(400).json({
        error: "Missing public key",
      });
    }

    const publicKey =
      `-----BEGIN PUBLIC KEY-----\n${
        key.match(/.{1,64}/g).join("\n")
      }\n-----END PUBLIC KEY-----`;

    const encryptedPin = crypto.publicEncrypt(
      {
        key: publicKey,
        //padding: crypto.constants.RSA_OAEP_PADDING,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      
      },
      Buffer.from(partnerPin)
    );

    res.json({
      encryptedPin:
        encryptedPin.toString("base64"),
    });

  } catch (e) {

    console.error(e);

    res.status(500).json({
      error: e.message,
    });

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



