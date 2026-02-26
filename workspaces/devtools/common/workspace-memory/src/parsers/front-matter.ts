import { parse as parseYaml } from 'yaml';

export interface ParsedFrontMatter {
  frontMatter: Record<string, unknown>;
  body: string;
}

const FRONT_MATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontMatter(content: string): ParsedFrontMatter {
  const match = content.match(FRONT_MATTER_REGEX);

  if (!match) {
    return { frontMatter: {}, body: content };
  }

  try {
    const frontMatter = parseYaml(match[1]) as Record<string, unknown>;
    return {
      frontMatter: frontMatter ?? {},
      body: match[2].trim(),
    };
  } catch {
    return { frontMatter: {}, body: content };
  }
}
