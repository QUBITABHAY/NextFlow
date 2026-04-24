import { logger, task } from "@trigger.dev/sdk/v3";
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
          reject(new Error(`Failed to download video: HTTP ${res.statusCode}`));
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

export const extractFrame = task({
  id: "extract-frame",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: {
    nodeId: string;
    videoUrl: string;
    frameTimestamp: number;
    frameTimestampMode: "seconds" | "percentage";
  }) => {
    logger.info("Starting extract frame task", {
      nodeId: payload.nodeId,
      frameTimestamp: payload.frameTimestamp,
      frameTimestampMode: payload.frameTimestampMode,
    });

    const tmpDir = os.tmpdir();
    const inputPath = path.join(
      tmpDir,
      `frame_input_${payload.nodeId}_${Date.now()}.mp4`,
    );
    const outputPath = path.join(
      tmpDir,
      `frame_output_${payload.nodeId}_${Date.now()}.png`,
    );

    try {
      logger.info("Downloading input video...");
      await downloadToFile(payload.videoUrl, inputPath);
      const fileSize = fs.statSync(inputPath).size;
      logger.info("Video downloaded", { size: fileSize });

      // Always probe duration first to clamp seek position
      let seekSeconds = payload.frameTimestamp;
      logger.info("Probing video duration...");
      const { stdout: durationOutput } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${inputPath}"`,
      );
      const duration = parseFloat(durationOutput.trim());
      logger.info("Video duration", { duration });

      if (payload.frameTimestampMode === "percentage") {
        if (isNaN(duration) || duration <= 0) {
          throw new Error("Could not determine video duration");
        }
        seekSeconds = (payload.frameTimestamp / 100) * duration;
      } else {
        // Clamp seek to [0, duration - 0.1] so we never seek past the end
        if (!isNaN(duration) && duration > 0) {
          seekSeconds = Math.min(seekSeconds, Math.max(0, duration - 0.1));
        }
      }

      logger.info("Calculated seek position", { seekSeconds });

      // Use accurate seek (-ss after -i) to guarantee a frame is available
      const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -ss ${seekSeconds.toFixed(3)} -vframes 1 -q:v 2 -f image2 "${outputPath}"`;
      logger.info("Running ffmpeg", { command: ffmpegCmd });

      const { stderr } = await execAsync(ffmpegCmd);
      logger.info("ffmpeg output", { stderr: stderr.slice(0, 500) });

      if (!fs.existsSync(outputPath)) {
        // Fallback: extract first frame
        logger.warn("Seek produced no output, falling back to first frame");
        const fallbackCmd = `ffmpeg -y -i "${inputPath}" -vframes 1 -q:v 2 -f image2 "${outputPath}"`;
        await execAsync(fallbackCmd);
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error("ffmpeg did not produce output file");
      }
      const outputBuffer = fs.readFileSync(outputPath);
      const base64 = outputBuffer.toString("base64");
      const dataUrl = `data:image/png;base64,${base64}`;

      logger.info("Frame extraction completed successfully", {
        outputSize: outputBuffer.length,
      });

      return {
        success: true,
        result: dataUrl,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("Frame extraction failed", { error: error.message });
      return {
        success: false,
        result: `Frame extraction failed: ${error.message}`,
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
