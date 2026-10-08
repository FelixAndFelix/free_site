import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, LANGUAGES, isLanguage, type ApiErrorCode, type Language } from "@free-site/shared";
import { useAuth } from "../auth";
import { de } from "./de";
import { en, type MessageKey } from "./en";

export type { MessageKey } from "./en";

/** Keys that exist as a plural pair (key_one and key_other), written without the suffix. */
type PluralKey = { [K in MessageKey]: K extends `${infer Base}_one` ? Base : never }[MessageKey];
type Params = Record<string, string | number>;

const MESSAGES: Record<Language, Record<string, string>> = { en, de };
const LOCALES: Record<Language, string> = { en: "en-GB", de: "de-DE" };
const STORAGE_KEY = "language";

/**
 * Replaces {name} placeholders with the parameters; unknown placeholders stay as they are.
 * @param {string} template
 * @param {Params} [params]
 */
export function format(template: string, params?: Params): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    params && name in params ? String(params[name]) : placeholder,
  );
}

/**
 * Looks up a message in a language. A key given with a "count" parameter picks its _one or _other
 * variant by the language's plural rules.
 * @param {Language} language
 * @param {MessageKey | PluralKey} key
 * @param {Params} [params]
 */
export function translate(language: Language, key: MessageKey | PluralKey, params?: Params): string {
  const messages = MESSAGES[language];
  let template = messages[key];
  if (template === undefined && typeof params?.count === "number") {
    const category = new Intl.PluralRules(LOCALES[language]).select(params.count);
    template = messages[`${key}_${category}`] ?? messages[`${key}_other`];
  }
  return format(template ?? key, params);
}

/**
 * Picks the language of a visitor who has not logged in: their earlier choice, else German for
 * German browsers, else English.
 */
export function detectLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage can be blocked (private windows); the browser language is a fine fallback.
  }
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return preferred.some((tag) => tag?.toLowerCase().startsWith("de")) ? "de" : DEFAULT_LANGUAGE;
}

/** Remembers the language for visitors who are logged out, and for the next visit. */
function rememberLanguage(language: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not critical: the next visit falls back to the browser language.
  }
}

interface I18n {
  language: Language;
  /** BCP 47 tag for Intl formatting, e.g. "de-DE". */
  locale: string;
  /** Translates a key, with {placeholders} and plural counts filled in. */
  t: (key: MessageKey | PluralKey, params?: Params) => string;
  /** Like t, but the placeholders take React nodes, e.g. a <strong> around a name. */
  tNodes: (key: MessageKey, params: Record<string, ReactNode>) => ReactNode;
  /** Changes the language of a visitor who is not logged in; accounts keep theirs on the server. */
  setGuestLanguage: (language: Language) => void;
}

const FALLBACK: I18n = {
  language: DEFAULT_LANGUAGE,
  locale: LOCALES[DEFAULT_LANGUAGE],
  t: (key, params) => translate(DEFAULT_LANGUAGE, key, params),
  tNodes: (key, params) => renderNodes(translate(DEFAULT_LANGUAGE, key), params),
  setGuestLanguage: () => {},
};

const I18nContext = createContext<I18n>(FALLBACK);

/**
 * Splits a message at its {placeholders} and puts React nodes in their place.
 * @param {string} template
 * @param {Record<string, ReactNode>} params
 */
function renderNodes(template: string, params: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name !== undefined && name in params ? <Fragment key={index}>{params[name]}</Fragment> : part;
  });
}

/**
 * Provides the interface language. A logged-in user's account language wins; otherwise the visitor's
 * own choice or browser language applies. Must be used inside AuthProvider.
 * @param {{children: ReactNode}} props
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [guestLanguage, setGuestLanguageState] = useState<Language>(detectLanguage);
  const language = user?.language ?? guestLanguage;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const accountLanguage = user?.language;
  useEffect(() => {
    // After logging out the page keeps the language the account had, also on the next visit.
    if (!accountLanguage) return;
    rememberLanguage(accountLanguage);
    setGuestLanguageState(accountLanguage);
  }, [accountLanguage]);

  const value = useMemo<I18n>(
    () => ({
      language,
      locale: LOCALES[language],
      t: (key, params) => translate(language, key, params),
      tNodes: (key, params) => renderNodes(translate(language, key), params),
      setGuestLanguage: (next) => {
        rememberLanguage(next);
        setGuestLanguageState(next);
      },
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Returns the translation helpers; without a provider (isolated component tests) everything is English. */
export function useI18n(): I18n {
  return useContext(I18nContext);
}

/**
 * The message key of an API error code.
 * @param {ApiErrorCode} error
 */
export function errorKey(error: ApiErrorCode): MessageKey {
  return `error.${error}`;
}

export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", de: "Deutsch" };
export { LANGUAGES };
