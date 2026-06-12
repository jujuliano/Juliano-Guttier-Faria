import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../firebase-applet-config.json');

if (!fs.existsSync(configPath)) {
  const mockConfig = {
    projectId: "your-firebase-project-id",
    appId: "your-firebase-app-id",
    apiKey: "your-firebase-api-key",
    authDomain: "your-firebase-auth-domain",
    firestoreDatabaseId: "your-firestore-database-id",
    storageBucket: "your-firebase-storage-bucket",
    messagingSenderId: "your-firebase-messaging-sender-id",
    measurementId: ""
  };
  fs.writeFileSync(configPath, JSON.stringify(mockConfig, null, 2), 'utf-8');
  console.log("SUCCESS: Created mock firebase-applet-config.json for GitHub / compilation fallback.");
} else {
  console.log("Firebase config file is present, skipping template creation.");
}
