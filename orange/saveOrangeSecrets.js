const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { saveSecret } = require("../services/secretManager");

exports.saveOrangeSecrets = onCall(
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

    const {
      environment,
      partnerPin,
      clientSecret,
    } = request.data || {};

    // ================= Validation =================

    if (!environment) {
      throw new HttpsError(
        "invalid-argument",
        "Environment is required."
      );
    }

    if (
      environment !== "sandbox" &&
      environment !== "production"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid environment."
      );
    }

    if (
      partnerPin !== undefined &&
      (typeof partnerPin !== "string" || partnerPin.trim() === "")
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid Partner PIN."
      );
    }

    if (
      clientSecret !== undefined &&
      (typeof clientSecret !== "string" ||
        clientSecret.trim() === "")
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid Client Secret."
      );
    }

    try {
      // ================= Save Partner PIN =================

      if (partnerPin) {
        await saveSecret(
          `orange-${environment}-partner-pin`,
          partnerPin.trim()
        );
      }

      // ================= Save Client Secret =================

      if (clientSecret) {
        await saveSecret(
          `orange-${environment}-client-secret`,
          clientSecret.trim()
        );
      }

      return {
        success: true,
        message: "Orange secrets saved successfully.",
      };
    } catch (e) {
      console.error("saveOrangeSecrets:", e);

      throw new HttpsError(
        "internal",
        "Unable to save secrets."
      );
    }
  }
);