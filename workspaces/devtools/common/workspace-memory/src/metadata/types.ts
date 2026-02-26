export interface TagEntry {
  name: string;
  description?: string;
  used_in: string[];
}

export interface CategoryEntry {
  name: string;
  used_in: string[];
}

export interface IndexSchema {
  schema_version: number;
  workspace: string;
  last_updated: string;
  tags: TagEntry[];
  categories: CategoryEntry[];
}
