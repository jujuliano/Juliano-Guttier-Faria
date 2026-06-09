import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Endpoint to fetch and list images from a public Google Drive folder
  app.get("/api/drive-images", async (req, res) => {
    try {
      const folderParam = (req.query.folder || "").toString().trim();
      
      // Extract Folder ID from Google Drive URL or assume raw ID
      let folderId = folderParam;
      const folderUriMatch = folderParam.match(/folders\/([a-zA-Z0-9_-]{28,45})/);
      if (folderUriMatch) {
         folderId = folderUriMatch[1];
      }

      if (!folderId) {
        return res.status(400).json({ error: "Parâmetro do ID da pasta do Google Drive é obrigatório." });
      }

      const driveUrl = `https://drive.google.com/drive/folders/${folderId}`;
      const response = await fetch(driveUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Google Drive returned status: ${response.status}`);
      }

      const text = await response.text();
      const files: { id: string; name: string; mimeType: string; url: string }[] = [];

      // Pattern 1: Look for decoded initially loaded elements inside window['_DRIVE_ivd']
      const driveIvdPattern = /window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/i;
      const ivdMatch = text.match(driveIvdPattern);
      
      if (ivdMatch) {
        try {
          const rawHexStr = ivdMatch[1];
          const decoded = rawHexStr.replace(/\\x([0-9a-fA-F]{2})/g, (_, hexNum) => {
            return String.fromCharCode(parseInt(hexNum, 16));
          });
          
          const rawJson = JSON.parse(decoded);
          
          // Traverse JSON to scan for files
          function traverse(item: any) {
            if (!item) return;
            if (Array.isArray(item)) {
              if (
                item.length >= 4 &&
                typeof item[0] === "string" &&
                item[0].length >= 28 &&
                item[0].length <= 45 &&
                typeof item[2] === "string" &&
                typeof item[3] === "string" &&
                item[3].includes("/")
              ) {
                // It's a file metadata array! Let's save it
                const fileId = item[0];
                const mime = item[3];
                // Check if it's an image file
                if (mime.startsWith("image/")) {
                  files.push({
                    id: fileId,
                    name: item[2],
                    mimeType: mime,
                    // Load through safety proxy that bypasses warning walls
                    url: `/api/drive-image-proxy?id=${fileId}`
                  });
                }
              }
              for (const child of item) {
                traverse(child);
              }
            }
          }
          traverse(rawJson);
        } catch (jsonErr) {
          console.error("Failed to parse decodable window['_DRIVE_ivd'] payload", jsonErr);
        }
      }

      // Pattern 2 Backup: Look for matching arrays directly in text to support secondary structures
      if (files.length === 0) {
        // Regex to search for file structures: ["ID", ["FOLDER_ID"], "NAME", "image/..." ]
        // e.g. ["1gg70WCxnd6McfAwR3LkPq_T8O6BwbZJ5",["1lS..."],"WhatsApp Image.jpeg","image/jpeg"]
        const backupRegex = /\["([a-zA-Z0-9_-]{28,45})",\["[a-zA-Z0-9_-]{28,45}"\],"([^"]+)","(image\/[^"]+)"/g;
        let bMatch;
        while ((bMatch = backupRegex.exec(text)) !== null) {
          const fileId = bMatch[1];
          if (!files.some(f => f.id === fileId)) {
            files.push({
              id: fileId,
              name: bMatch[2],
              mimeType: bMatch[3],
              url: `/api/drive-image-proxy?id=${fileId}`
            });
          }
        }
      }

      // Return lists
      res.json({ folderId, count: files.length, files });
    } catch (error: any) {
      console.error("Error fetching Google Drive folder details", error);
      res.status(500).json({ error: "Erro ao obter imagens do Google Drive.", details: error.message });
    }
  });

  // Real-time image proxy to bypass Google Drive CORS & virus scan limits
  app.get("/api/drive-image-proxy", async (req, res) => {
    try {
      const fileId = (req.query.id || "").toString().trim();
      if (!fileId) {
        return res.status(400).send("ID do arquivo do Google Drive é obrigatório.");
      }

      // We download a high resolution thumbnail (sz=w1600) because it:
      // 1. Bypass virus warning confirmation screens entirely.
      // 2. Fast global CDN rendering.
      // 3. Perfect size and format fallback for any image file.
      const driveUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
      
      const response = await fetch(driveUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        // Fallback to direct stream backup
        const backupUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;
        const backupResponse = await fetch(backupUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
          }
        });

        if (!backupResponse.ok) {
          throw new Error(`Google Drive returned status: ${backupResponse.status}`);
        }

        const arrayBuffer = await backupResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = backupResponse.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400"); // Cache 24h
        return res.send(buffer);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || "image/jpeg";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache 24h
      res.send(buffer);
    } catch (err: any) {
      console.error("Error streaming image from driver proxy", err);
      // Failsafe HTTP redirect in case of fetch errors
      const fileId = req.query.id;
      if (fileId) {
        return res.redirect(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`);
      }
      res.status(500).send("Erro ao obter a imagem.");
    }
  });

  // Real-time text proxy to bypass Google Drive CORS & fetch .txt content directly
  app.get("/api/drive-text", async (req, res) => {
    try {
      const fileUrl = (req.query.url || "").toString().trim();
      if (!fileUrl) {
        return res.status(400).json({ error: "URL do arquivo do Google Drive é obrigatória." });
      }

      // Robust pattern matching to extract the 28-45 character Google Drive file ID
      let fileId = fileUrl;
      const fileIdMatch = fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]{28,45})/i) || 
                          fileUrl.match(/\/d\/([a-zA-Z0-9_-]{28,45})/i) || 
                          fileUrl.match(/[?&]id=([a-zA-Z0-9_-]{28,45})/i);
      
      if (fileIdMatch) {
        fileId = fileIdMatch[1];
      }

      if (!fileId || fileId.length < 20) {
        return res.status(400).json({ error: "Não foi possível extrair um ID de arquivo válido do Google Drive a partir da URL fornecida." });
      }

      // uc?export=download is perfect for tiny files like text archives
      const driveUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;
      const response = await fetch(driveUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Google Drive returned status: ${response.status}`);
      }

      let txt = await response.text();
      
      // Clean UTF-8 Byte Order Mark (BOM) if present from Windows Notepad editor uploads
      txt = txt.replace(/^\uFEFF/, '').trim();

      res.setHeader("Cache-Control", "public, max-age=15"); // Cache for 15s to keep responsiveness ultra fast but allow near real-time updates
      return res.json({ id: fileId, text: txt });
    } catch (err: any) {
      console.error("Error reading text file from Google Drive proxy", err);
      return res.status(500).json({ error: "Erro ao ler o arquivo de letreiro digital do Google Drive.", details: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
