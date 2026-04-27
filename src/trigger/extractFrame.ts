import { logger, task } from "@trigger.dev/sdk/v3";
import { Transloadit } from "transloadit";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

async function downloadVideo(url: string, destPath: string) {
  logger.info(`Starting download from ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download video: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error("Response body is empty");
  }

  const fileStream = createWriteStream(destPath);
  await pipeline(Readable.fromWeb(response.body as any), fileStream);
  logger.info("Download completed successfully.");
}

export const extractFrame = task({
  id: "extract-frame",
  machine: "large-1x",
  maxDuration: 120,
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: {
    nodeId: string;
    videoUrl: string;
    frameTimestamp: number;
    frameTimestampMode: "seconds" | "percentage";
  }) => {
    logger.info("Extract frame task started", { payload });

    const tmpDir = os.tmpdir();
    const inputPath = path.join(
      tmpDir,
      `input_${payload.nodeId}_${Date.now()}.mp4`,
    );
    const outputPath = path.join(
      tmpDir,
      `output_${payload.nodeId}_${Date.now()}.png`,
    );

    try {
      // 1. Download video efficiently
      await downloadVideo(payload.videoUrl, inputPath);

      const stats = await fs.stat(inputPath);
      logger.info(`Video saved to disk`, { sizeBytes: stats.size });

      // 2. Determine video duration
      logger.info("Probing video duration...");
      const probeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
      const { stdout: probeOutput } = await execAsync(probeCmd);
      const duration = parseFloat(probeOutput.trim());

      if (isNaN(duration) || duration <= 0) {
        throw new Error("Failed to determine valid video duration.");
      }
      logger.info(`Video duration determined: ${duration}s`);

      // 3. Calculate seek time
      let seekSeconds = 0;
      if (payload.frameTimestampMode === "percentage") {
        seekSeconds = (payload.frameTimestamp / 100) * duration;
      } else {
        seekSeconds = payload.frameTimestamp;
      }

      seekSeconds = Math.max(0, Math.min(seekSeconds, duration - 0.1));
      logger.info(`Calculated seek time: ${seekSeconds.toFixed(3)}s`);

      const ffmpegCmd = `ffmpeg -nostdin -v error -y -ss ${seekSeconds.toFixed(3)} -i "${inputPath}" -frames:v 1 -q:v 2 "${outputPath}"`;
      logger.info(`Executing ffmpeg: ${ffmpegCmd}`);

      await execAsync(ffmpegCmd, { maxBuffer: 1024 * 1024 * 10 });

      const outStats = await fs.stat(outputPath);
      logger.info(`Frame extracted successfully`, { sizeBytes: outStats.size });

      const authKey = process.env.NEXT_PUBLIC_TRANSLOADIT_KEY;
      const authSecret = process.env.TRANSLOADIT_SECRET;

      if (!authKey || !authSecret) {
        throw new Error("Transloadit credentials missing from environment.");
      }

      logger.info("Uploading extracted frame to Transloadit...");
      const transloadit = new Transloadit({ authKey, authSecret });

      const assembly = await transloadit.createAssembly({
        files: { frame: outputPath },
        params: {
          steps: {
            ":original": { robot: "/upload/handle" },
          },
        },
        waitForCompletion: true,
      });

      const uploadedUrl =
        assembly.results?.[":original"]?.[0]?.ssl_url ??
        assembly.results?.[":original"]?.[0]?.url ??
        assembly.uploads?.[0]?.ssl_url ??
        assembly.uploads?.[0]?.url;

      if (!uploadedUrl) {
        throw new Error(
          `Upload failed. Transloadit assembly status: ${assembly.ok}`,
        );
      }

      logger.info(`Upload complete: ${uploadedUrl}`);
      return {
        success: true,
        result: uploadedUrl,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error(`Task failed: ${error.message}`, { stack: error.stack });
      throw error;
    } finally {
      logger.info("Cleaning up temporary files...");
      try {
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
      } catch (cleanupError) {
        logger.warn("Failed to cleanup files", { cleanupError });
      }
    }
  },
});
