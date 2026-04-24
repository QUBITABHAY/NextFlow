import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const authKey = process.env.NEXT_PUBLIC_TRANSLOADIT_KEY;
  const authSecret = process.env.TRANSLOADIT_SECRET;

  const isPlaceholder = (v?: string) =>
    !v || v.includes("your_transloadit") || v.trim() === "";

  if (isPlaceholder(authKey) || isPlaceholder(authSecret)) {
    return NextResponse.json(
      {
        error:
          "Transloadit credentials not configured. Set NEXT_PUBLIC_TRANSLOADIT_KEY and TRANSLOADIT_SECRET in .env.local",
      },
      { status: 500 },
    );
  }

  const expiresDate = new Date(Date.now() + 30 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const expires =
    [
      expiresDate.getUTCFullYear(),
      pad(expiresDate.getUTCMonth() + 1),
      pad(expiresDate.getUTCDate()),
    ].join("/") +
    " " +
    [
      pad(expiresDate.getUTCHours()),
      pad(expiresDate.getUTCMinutes()),
      pad(expiresDate.getUTCSeconds()),
    ].join(":") +
    "+00:00";

  const params = JSON.stringify({
    auth: {
      key: authKey,
      expires,
    },
    steps: {
      ":original": {
        robot: "/upload/handle",
      },
    },
  });

  const signature = crypto
    .createHmac("sha384", authSecret as string)
    .update(Buffer.from(params, "utf-8"))
    .digest("hex");

  return NextResponse.json({
    params,
    signature: `sha384:${signature}`,
  });
}
