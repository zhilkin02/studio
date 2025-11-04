/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as cors from "cors";

const corsHandler = cors({origin: true});

admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const login = onRequest({secrets: ["ADMIN_PASSWORD"]}, (request, response) => {
  corsHandler(request, response, () => {
    if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
    }

    const {password} = request.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    logger.info("Login attempt received");

    if (!adminPassword) {
        logger.error("ADMIN_PASSWORD secret is not set in Cloud Functions environment.");
        response.status(500).json({error: "Server configuration error."});
        return;
    }

    if (password === adminPassword) {
        logger.info("Admin login successful");
        // In a real app, you would generate a secure token (e.g., JWT)
        // For this simplified case, we'll return a simple session value.
        response.status(200).json({session: "admin"});
    } else {
        logger.warn("Admin login failed: incorrect password");
        response.status(401).json({error: "Incorrect password."});
    }
  });
});
