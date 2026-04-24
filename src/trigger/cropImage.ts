import { logger, task } from "@trigger.dev/sdk/v3";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

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
      logger.info("Downloading input image...");
      const response = await fetch(payload.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(inputPath, buffer);
      logger.info("Image downloaded", { size: buffer.length });

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
      const outputBuffer = fs.readFileSync(outputPath);
      const base64 = outputBuffer.toString("base64");
      const dataUrl = `data:image/png;base64,${base64}`;

      logger.info("Crop completed successfully", {
        outputSize: outputBuffer.length,
      });

      return {
        success: true,
        result: dataUrl,
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
