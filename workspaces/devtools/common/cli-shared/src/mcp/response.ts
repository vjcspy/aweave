/**
 * MCP-style response models for CLI tools.
 *
 * These models produce a structured JSON format designed for AI agent consumption.
 * This is NOT the official MCP protocol — it's an internal convention inspired by
 * MCP's structured response pattern.
 *
 * IMPORTANT: The JSON output format is a contract with AI agent commands and rules.
 * Any changes to serialization must be backward-compatible.
 */

export enum ContentType {
  TEXT = 'text',
  JSON = 'json',
}

export interface MCPContentData {
  type: ContentType;
  text?: string;
  data?: Record<string, unknown>;
}

export interface MCPErrorData {
  code: string;
  message: string;
  suggestion?: string;
}

export interface MCPResponseData {
  success: boolean;
  content?: MCPContentData[];
  error?: MCPErrorData;
  metadata?: Record<string, unknown>;
  has_more?: boolean;
  next_offset?: number;
  total_count?: number;
}

export class MCPContent {
  type: ContentType;
  text?: string;
  data?: Record<string, unknown>;

  constructor(opts: {
    type: ContentType;
    text?: string;
    data?: Record<string, unknown>;
  }) {
    this.type = opts.type;
    this.text = opts.text;
    this.data = opts.data;
  }

  toDict(): MCPContentData {
    const result: MCPContentData = { type: this.type };
    if (this.text !== undefined) result.text = this.text;
    if (this.data !== undefined) result.data = this.data;
    return result;
  }
}

export class MCPError {
  code: string;
  message: string;
  suggestion?: string;

  constructor(opts: { code: string; message: string; suggestion?: string }) {
    this.code = opts.code;
    this.message = opts.message;
    this.suggestion = opts.suggestion;
  }

  toDict(): MCPErrorData {
    const result: MCPErrorData = { code: this.code, message: this.message };
    if (this.suggestion) result.suggestion = this.suggestion;
    return result;
  }
}

export class MCPResponse {
  success: boolean;
  content: MCPContent[];
  error?: MCPError;
  metadata: Record<string, unknown>;
  hasMore: boolean;
  nextOffset?: number;
  totalCount?: number;

  constructor(opts: {
    success: boolean;
    content?: MCPContent[];
    error?: MCPError;
    metadata?: Record<string, unknown>;
    hasMore?: boolean;
    nextOffset?: number;
    totalCount?: number;
  }) {
    this.success = opts.success;
    this.content = opts.content ?? [];
    this.error = opts.error;
    this.metadata = opts.metadata ?? {};
    this.hasMore = opts.hasMore ?? false;
    this.nextOffset = opts.nextOffset;
    this.totalCount = opts.totalCount;
  }

  toDict(): MCPResponseData {
    const result: MCPResponseData = { success: this.success };

    if (this.content.length > 0) {
      result.content = this.content.map((c) => c.toDict());
    }

    if (this.error) {
      result.error = this.error.toDict();
    }

    if (Object.keys(this.metadata).length > 0) {
      result.metadata = this.metadata;
    }

    // Pagination — match Python behavior: only include if has_more or total_count set
    if (this.hasMore || this.totalCount !== undefined) {
      result.has_more = this.hasMore;
      if (this.nextOffset !== undefined) result.next_offset = this.nextOffset;
      if (this.totalCount !== undefined) result.total_count = this.totalCount;
    }

    return result;
  }

  toJSON(indent = 2): string {
    return JSON.stringify(this.toDict(), null, indent);
  }

  toMarkdown(): string {
    const lines: string[] = [];

    if (!this.success && this.error) {
      lines.push(`## ❌ Error: ${this.error.code}`);
      lines.push(`\n${this.error.message}`);
      if (this.error.suggestion) {
        lines.push(`\n**Suggestion:** ${this.error.suggestion}`);
      }
      return lines.join('\n');
    }

    for (const item of this.content) {
      if (item.type === ContentType.TEXT) {
        lines.push(item.text ?? '');
      } else if (item.type === ContentType.JSON && item.data) {
        lines.push(`\`\`\`json\n${JSON.stringify(item.data, null, 2)}\n\`\`\``);
      }
    }

    if (this.hasMore) {
      const msg =
        this.totalCount !== undefined
          ? `Showing ${this.content.length} of ${this.totalCount} items.`
          : `Showing ${this.content.length} items. More available.`;
      lines.push(
        `\n---\n*${msg} Use --offset ${this.nextOffset} to see more.*`,
      );
    }

    return lines.join('\n');
  }
}
