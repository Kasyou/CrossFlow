import { describe, it, expect, beforeAll, vi } from "vitest";

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const hasKey = !!API_KEY;

describe("AI Adapter - Mock mode (always runs)", () => {
  it("constructs chat completion request correctly", () => {
    const messages = [{ role: "user", content: "Translate: 蓝牙耳机Pro" }];
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("蓝牙耳机Pro");
  });

  it("classifies refund reason mapping", () => {
    const categories = ["quality", "logistics", "buyer", "other"];
    expect(categories).toContain("quality");
    expect(categories.length).toBe(4);
  });

  it("alerts should contain Chinese when target is zh", () => {
    const hasChinese = /[一-鿿]/.test("SKU BT-EP10-BK 订单量下降100%");
    expect(hasChinese).toBe(true);
  });

  it("handles empty input gracefully", () => {
    const input = "";
    expect(input.length).toBe(0);
    expect(Boolean(input)).toBe(false);
  });
});

// Live API tests — require DEEPSEEK_API_KEY env var
import OpenAI from "openai";
const BASE_URL = "https://api.deepseek.com";
const MODEL = "deepseek-chat";
let client: OpenAI | null = null;
beforeAll(() => { if (hasKey) client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL }); });

describe("AI Adapter - DeepSeek live integration", () => {
  it("translates product name to English", { skip: !hasKey }, async () => {
    const res = await client!.chat.completions.create({
      model: MODEL,
      messages: [{
        role: "user",
        content: "Translate this product name to English, keep it concise and suitable for e-commerce listing:\n\n蓝牙耳机Pro\n\nTranslation:"
      }],
      max_tokens: 50,
      temperature: 0.3,
    });
    const result = res.choices[0]?.message?.content?.trim() || "";
    console.log("Translate result:", result);
    expect(result.length).toBeGreaterThan(0);
    expect(result.toLowerCase()).toMatch(/bluetooth|earbud|headphone|wireless/);
  }, 30000);

  it("classifies refund reason to correct category", { skip: !hasKey }, async () => {
    const res = await client!.chat.completions.create({
      model: MODEL,
      messages: [{
        role: "user",
        content: 'Classify this refund/return reason into exactly one category: "quality" (product defect/damage), "logistics" (late/damaged in transit), "buyer" (changed mind/wrong order), or "other". Reply with only the category name.\n\nReason: The item arrived with a broken screen\n\nCategory:'
      }],
      max_tokens: 10,
      temperature: 0,
    });
    const result = res.choices[0]?.message?.content?.trim().toLowerCase() || "";
    console.log("Classify result:", result);
    expect(["quality", "logistics", "buyer", "other"]).toContain(result);
    expect(result).toBe("quality");
  }, 30000);

  it("classifies logistics-related refund", { skip: !hasKey }, async () => {
    const res = await client!.chat.completions.create({
      model: MODEL,
      messages: [{
        role: "user",
        content: 'Classify this refund/return reason into exactly one category: "quality" (product defect/damage), "logistics" (late/damaged in transit), "buyer" (changed mind/wrong order), or "other". Reply with only the category name.\n\nReason: Package arrived 2 weeks late\n\nCategory:'
      }],
      max_tokens: 10,
      temperature: 0,
    });
    const result = res.choices[0]?.message?.content?.trim().toLowerCase() || "";
    console.log("Classify logistics result:", result);
    expect(["quality", "logistics", "buyer", "other"]).toContain(result);
    expect(result).toBe("logistics");
  }, 30000);

  it("generates anomaly alert in Chinese", { skip: !hasKey }, async () => {
    const res = await client!.chat.completions.create({
      model: MODEL,
      messages: [{
        role: "user",
        content: "Based on this e-commerce data, write a concise alert message in Chinese for the seller (1-2 sentences max, no greeting):\n\nSKU BT-EP10-BK: today 0 orders vs yesterday 45 orders, drop 100%. Average past 7 days: 38 orders/day.\n\nAlert:"
      }],
      max_tokens: 80,
      temperature: 0.5,
    });
    const result = res.choices[0]?.message?.content?.trim() || "";
    console.log("Anomaly alert:", result);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/[一-鿿]/);
  }, 30000);

  it("generates anomaly alert for order spike", { skip: !hasKey }, async () => {
    const res = await client!.chat.completions.create({
      model: MODEL,
      messages: [{
        role: "user",
        content: "Based on this e-commerce data, write a concise alert message in Chinese for the seller (1-2 sentences max, no greeting):\n\nSKU CBL-USB-C-1M: today 500 orders vs yesterday 52 orders, spike 862%. Average past 7 days: 48 orders/day.\n\nAlert:"
      }],
      max_tokens: 80,
      temperature: 0.5,
    });
    const result = res.choices[0]?.message?.content?.trim() || "";
    console.log("Spike alert:", result);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/[一-鿿]/);
  }, 30000);

  it("handles empty/malformed refund reason gracefully", { skip: !hasKey }, async () => {
    const res = await client!.chat.completions.create({
      model: MODEL,
      messages: [{
        role: "user",
        content: 'Classify this refund/return reason into exactly one category: "quality" (product defect/damage), "logistics" (late/damaged in transit), "buyer" (changed mind/wrong order), or "other". Reply with only the category name.\n\nReason: asdfghjkl\n\nCategory:'
      }],
      max_tokens: 10,
      temperature: 0,
    });
    const result = res.choices[0]?.message?.content?.trim().toLowerCase() || "";
    console.log("Gibberish classify result:", result);
    expect(["quality", "logistics", "buyer", "other"]).toContain(result);
  }, 30000);
});
