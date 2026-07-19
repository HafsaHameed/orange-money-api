
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

const client = new SecretManagerServiceClient();

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT;

if (!PROJECT_ID) {
  throw new Error("PROJECT_ID could not be determined.");
}

function secretPath(secretId) {
  return `projects/${PROJECT_ID}/secrets/${secretId}`;
}

async function createSecretIfNotExists(secretId) {
  try {
    await client.getSecret({
      name: secretPath(secretId),
    });
  } catch (e) {
    // Secret not found
    if (e.code !== 5) {
      throw e;
    }

    await client.createSecret({
      parent: `projects/${PROJECT_ID}`,
      secretId,
      secret: {
        replication: {
          automatic: {},
        },
      },
    });
  }
}

async function saveSecret(secretId, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Secret value cannot be empty.");
  }

  await createSecretIfNotExists(secretId);

  const [version] = await client.addSecretVersion({
    parent: secretPath(secretId),
    payload: {
      data: Buffer.from(value.trim(), "utf8"),
    },
  });

  return version.name;
}

async function getSecret(secretId) {
  const [version] = await client.accessSecretVersion({
    name: `${secretPath(secretId)}/versions/latest`,
  });

  return version.payload.data.toString("utf8");
}

async function secretExists(secretId) {
  try {
    await client.accessSecretVersion({
      name: `${secretPath(secretId)}/versions/latest`,
    });

    return true;
  } catch (e) {
    // Secret or version doesn't exist
    if (e.code === 5) {
      return false;
    }

    throw e;
  }
}


module.exports = {
  saveSecret,
  getSecret,
  secretExists,
};
