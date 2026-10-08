import { describe, expect, it } from "vitest";
import { de } from "./de";
import { en } from "./en";
import { detectLanguage, format, translate } from "./index";

/** The {placeholder} names of a message, sorted. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe("message catalogs", () => {
  const keys = Object.keys(en);

  it("define exactly the same keys in English and German", () => {
    expect(Object.keys(de).sort()).toEqual([...keys].sort());
  });

  it("have no empty messages", () => {
    for (const [key, message] of [...Object.entries(en), ...Object.entries(de)]) {
      expect(message.trim(), key).not.toBe("");
    }
  });

  it("use the same {placeholders} in both languages", () => {
    for (const key of keys) {
      expect(placeholders(de[key as keyof typeof de]), key).toEqual(placeholders(en[key as keyof typeof en]));
    }
  });

  it("complete every plural pair", () => {
    for (const messages of [en, de] as Record<string, string>[]) {
      for (const key of Object.keys(messages).filter((name) => name.endsWith("_one"))) {
        expect(messages[key.replace(/_one$/, "_other")], key).toBeDefined();
      }
      for (const key of Object.keys(messages).filter((name) => name.endsWith("_other"))) {
        expect(messages[key.replace(/_other$/, "_one")], key).toBeDefined();
      }
    }
  });

  it("never spell the product with an underscore", () => {
    for (const message of [...Object.values(en), ...Object.values(de)]) expect(message).not.toContain("free_site");
  });
});

describe("translate", () => {
  it("fills placeholders and leaves unknown ones alone", () => {
    expect(format("Hello {name}, {other}", { name: "Ada" })).toBe("Hello Ada, {other}");
    expect(translate("en", "join.title", { course: "INF24B" })).toBe("Join INF24B");
    expect(translate("de", "join.title", { course: "INF24B" })).toBe("INF24B beitreten");
  });

  it("picks the plural variant by the count", () => {
    expect(translate("en", "vote.total", { count: 1 })).toBe("1 vote");
    expect(translate("en", "vote.total", { count: 24 })).toBe("24 votes");
    expect(translate("de", "vote.total", { count: 1 })).toBe("1 Stimme");
    expect(translate("de", "vote.total", { count: 0 })).toBe("0 Stimmen");
  });

  it("returns the key for a message that does not exist", () => {
    expect(translate("en", "no.such.key" as never)).toBe("no.such.key");
  });
});

describe("detectLanguage", () => {
  /** Sets the browser's preferred languages. */
  function browserLanguages(languages: string[]) {
    Object.defineProperty(window.navigator, "languages", { value: languages, configurable: true });
  }

  it("uses German for German browsers and English otherwise", () => {
    window.localStorage.clear();
    browserLanguages(["de-AT", "en"]);
    expect(detectLanguage()).toBe("de");
    browserLanguages(["fr-FR", "en-US"]);
    expect(detectLanguage()).toBe("en");
    browserLanguages([]);
    expect(detectLanguage()).toBe("en");
  });

  it("prefers an earlier choice over the browser", () => {
    browserLanguages(["de-DE"]);
    window.localStorage.setItem("language", "en");
    expect(detectLanguage()).toBe("en");
    window.localStorage.setItem("language", "klingon");
    expect(detectLanguage()).toBe("de");
    window.localStorage.clear();
  });
});
