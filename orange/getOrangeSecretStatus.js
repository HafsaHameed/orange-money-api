const { onCall, HttpsError } = require("firebase-functions/v2/https");

const {
  secretExists,
} = require("../services/secretManager");

exports.getOrangeSecretStatus = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    // ================= Authentication =================

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication required."
      );
    }

    // ================= Authorization =================

    if (!request.auth.token.admin) {
      throw new HttpsError(
        "permission-denied",
        "Admins only."
      );
    }

    const { environment } = request.data || {};

    if (
      environment !== "sandbox" &&
      environment !== "production"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid environment."
      );
    }

    try {
      const partnerPinConfigured =
        await secretExists(
          `orange-${environment}-partner-pin`
        );

      const clientSecretConfigured =
        await secretExists(
          `orange-${environment}-client-secret`
        );

      return {
        success: true,
        partnerPinConfigured,
        clientSecretConfigured,
      };
    } catch (e) {
      console.error(
        "getOrangeSecretStatus:",
        e
      );

      throw new HttpsError(
        "internal",
        "Unable to read secret status."
      );
    }
  }
);