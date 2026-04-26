import { NextResponse } from "next/server";
import { resolveBasename, resolveAddress } from "@/lib/ens";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query");
    const type = url.searchParams.get("type") || "auto"; // "address" | "name" | "auto"
    const testnet = url.searchParams.get("testnet") !== "false";

    if (!query) {
      return NextResponse.json(
        { ok: false, error: "Missing query parameter" },
        { status: 400 }
      );
    }

    // Detect type automatically
    let isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
    let resolvedType = type === "auto" ? (isAddress ? "address" : "name") : type;

    let result: string | null = null;

    if (resolvedType === "address" || (resolvedType === "auto" && isAddress)) {
      // Resolve address to name
      result = await resolveBasename(query, testnet);
    } else if (resolvedType === "name" || (resolvedType === "auto" && !isAddress)) {
      // Resolve name to address
      result = await resolveAddress(query, testnet);
    }

    return NextResponse.json({
      ok: true,
      query,
      result,
      type: isAddress ? "address" : "name",
      testnet,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
