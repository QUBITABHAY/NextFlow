import { logger, task } from "@trigger.dev/sdk/v3";
import { Transloadit } from "transloadit";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";

const execAsync = promisify(exec);

function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          downloadToFile(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
          return;
        }
        const ws = fs.createWriteStream(dest);
        res.pipe(ws);
        ws.on("finish", () => ws.close(() => resolve()));
        ws.on("error", reject);
      })
      .on("error", reject);
  });
}

export const cropImage = task({
  id: "crop-image",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: {
    nodeId: string;
    imageUrl: string;
    cropX: number;
    cropY: number;
    cropWidth: number;
    cropHeight: number;
  }) => {
    logger.info("Starting crop image task", {
      nodeId: payload.nodeId,
      cropX: payload.cropX,
      cropY: payload.cropY,
      cropWidth: payload.cropWidth,
      cropHeight: payload.cropHeight,
    });

    const tmpDir = os.tmpdir();
    const inputPath = path.join(
      tmpDir,
      `crop_input_${payload.nodeId}_${Date.now()}.png`,
    );
    const outputPath = path.join(
      tmpDir,
      `crop_output_${payload.nodeId}_${Date.now()}.png`,
    );

    try {
      if (payload.imageUrl.startsWith("data:")) {
        logger.info("Decoding base64 image data...");
        const base64Data = payload.imageUrl.split(",")[1];
        if (!base64Data) throw new Error("Invalid base64 data URL");
        const buffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(inputPath, buffer);
        logger.info("Base64 image decoded", { size: buffer.length });
      } else {
        logger.info("Downloading input image...");
        await downloadToFile(payload.imageUrl, inputPath);
        const fileSize = fs.statSync(inputPath).size;
        logger.info("Image downloaded", { size: fileSize });
      }

      logger.info("Probing image dimensions...");
      const { stdout: probeOutput } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${inputPath}"`,
      );
      const [imgWidth, imgHeight] = probeOutput.trim().split(",").map(Number);
      logger.info("Image dimensions", { imgWidth, imgHeight });

      const pixelX = Math.round((payload.cropX / 100) * imgWidth);
      const pixelY = Math.round((payload.cropY / 100) * imgHeight);
      const pixelW = Math.round((payload.cropWidth / 100) * imgWidth);
      const pixelH = Math.round((payload.cropHeight / 100) * imgHeight);
      const finalW = Math.min(pixelW, imgWidth - pixelX);
      const finalH = Math.min(pixelH, imgHeight - pixelY);

      if (finalW <= 0 || finalH <= 0) {
        throw new Error(
          `Invalid crop region: ${finalW}x${finalH} at (${pixelX},${pixelY})`,
        );
      }

      logger.info("Calculated pixel crop", { pixelX, pixelY, finalW, finalH });

      const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vf "crop=${finalW}:${finalH}:${pixelX}:${pixelY}" "${outputPath}"`;
      logger.info("Running ffmpeg", { command: ffmpegCmd });

      const { stderr } = await execAsync(ffmpegCmd);
      logger.info("ffmpeg output", { stderr: stderr.slice(0, 500) });

      if (!fs.existsSync(outputPath)) {
        throw new Error("ffmpeg did not produce output file");
      }

      const outputSize = fs.statSync(outputPath).size;
      logger.info("Crop completed, uploading to Transloadit...", {
        outputSize,
      });

      const authKey = process.env.NEXT_PUBLIC_TRANSLOADIT_KEY;
      const authSecret = process.env.TRANSLOADIT_SECRET;

      if (!authKey || !authSecret) {
        throw new Error(
          "Transloadit credentials not configured. Set NEXT_PUBLIC_TRANSLOADIT_KEY and TRANSLOADIT_SECRET.",
        );
      }

      const transloadit = new Transloadit({ authKey, authSecret });

      const assembly = await transloadit.createAssembly({
        files: { file: outputPath },
        params: {
          steps: {
            ":original": { robot: "/upload/handle" },
          },
        },
        waitForCompletion: true,
      });

      logger.info("Transloadit assembly response", {
        ok: assembly.ok,
        status: assembly.assembly_ssl_url,
        resultsKeys: Object.keys(assembly.results ?? {}),
        uploadsCount: assembly.uploads?.length,
        firstUpload: assembly.uploads?.[0]
          ? {
              ssl_url: assembly.uploads[0].ssl_url,
              url: assembly.uploads[0].url,
            }
          : null,
        firstResult: assembly.results?.[":original"]?.[0]
          ? {
              ssl_url: assembly.results[":original"][0].ssl_url,
              url: assembly.results[":original"][0].url,
            }
          : null,
      });

      const uploadedUrl =
        assembly.results?.[":original"]?.[0]?.ssl_url ??
        assembly.results?.[":original"]?.[0]?.url ??
        assembly.uploads?.[0]?.ssl_url ??
        assembly.uploads?.[0]?.url;

      if (!uploadedUrl) {
        throw new Error(
          `Transloadit assembly completed but no URL found. Status: ${assembly.ok}, keys: ${JSON.stringify(Object.keys(assembly))}`,
        );
      }

      logger.info("Uploaded to Transloadit", { url: uploadedUrl });

      return {
        success: true,
        result: uploadedUrl,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("Crop failed", { error: error.message });
      return {
        success: false,
        result: `Crop failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    } finally {
      try {
        fs.unlinkSync(inputPath);
      } catch {}
      try {
        fs.unlinkSync(outputPath);
      } catch {}
    }
  },
});
