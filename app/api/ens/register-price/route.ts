import { NextResponse } from "next/server";
import { getBasenamePrice, isValidBasenameLabel, formatBasename } from "@/lib/ens";
import { formatUnits } from "viem";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const label = url.searchParams.get("label");
    const years = Number.parseInt(url.searchParams.get("years") || "1", 10);
    const testnet = true;

    if (!label) {
      return NextResponse.json(
        { ok: false, error: "Missing label parameter" },
        { status: 400 }
      );
    }

    // Validate label
    const validation = isValidBasenameLabel(label.toLowerCase());
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    // Get price
    const priceWei = await getBasenamePrice(label.toLowerCase(), years, testnet);

    if (!priceWei) {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch price from registrar" },
        { status: 502 }
      );
    }

    const priceEth = formatUnits(priceWei, 18);
    const fullName = formatBasename(label.toLowerCase(), testnet);

    return NextResponse.json({
      ok: true,
      label: label.toLowerCase(),
      fullName,
      years,
      priceWei: priceWei.toString(),
      priceEth,
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
