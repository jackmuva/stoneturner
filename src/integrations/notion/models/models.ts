export type PartialUser = {
  object: "user",
  id: string,
}

export type FileObject =
  | {
    type: "external",
    external: {
      url: string,
    },
  }
  | {
    type: "file",
    file: {
      url: string,
      expiry_time: string,
    },
  }
  | {
    type: "file_upload",
    file_upload: {
      id: string,
    },
  }

export type EmojiObject = {
  type: "emoji",
  emoji: string,
}

export type CustomEmojiObject = {
  type: "custom_emoji",
  custom_emoji: {
    id: string,
    name?: string,
    url?: string,
  },
}

export type PageIcon = EmojiObject | CustomEmojiObject | FileObject

export type PageParent =
  | { type: "database_id", database_id: string }
  | { type: "data_source_id", data_source_id: string }
  | { type: "page_id", page_id: string }
  | { type: "block_id", block_id: string }
  | { type: "workspace", workspace: true }

export type NotionPage = {
  object: "page",
  id: string,
  created_time: string,
  last_edited_time: string,
  created_by: PartialUser,
  last_edited_by: PartialUser,
  archived: boolean,
  in_trash: boolean,
  icon: PageIcon | null,
  cover: FileObject | null,
  properties: Record<string, PagePropertyValue>,
  parent: PageParent,
  url: string,
  public_url: string | null,
}

export type PagePropertyValue = {
  id: string,
  type: string,
  [key: string]: unknown,
}

export type Annotations = {
  bold: boolean,
  italic: boolean,
  strikethrough: boolean,
  underline: boolean,
  code: boolean,
  color: string,
}

export type RichText = {
  type: "text" | "mention" | "equation",
  text?: {
    content: string,
    link: { url: string } | null,
  },
  mention?: {
    type: string,
    [key: string]: unknown,
  },
  equation?: {
    expression: string,
  },
  annotations: Annotations,
  plain_text: string,
  href: string | null,
}

export type BlockParent =
  | { type: "page_id", page_id: string }
  | { type: "block_id", block_id: string }
  | { type: "database_id", database_id: string }
  | { type: "data_source_id", data_source_id: string }
  | { type: "workspace", workspace: true }

type TextBlockValue = {
  rich_text: RichText[],
  color: string,
  children?: NotionBlock[],
}

type HeadingBlockValue = {
  rich_text: RichText[],
  color: string,
  is_toggleable: boolean,
}

type FileBlockValue = FileObject & {
  caption: RichText[],
}

// Discriminated union over `type` and its matching content key.
export type BlockTypeValue =
  | { type: "paragraph", paragraph: TextBlockValue }
  | { type: "bulleted_list_item", bulleted_list_item: TextBlockValue }
  | { type: "numbered_list_item", numbered_list_item: TextBlockValue }
  | { type: "quote", quote: TextBlockValue }
  | { type: "toggle", toggle: TextBlockValue }
  | { type: "callout", callout: TextBlockValue & { icon: PageIcon | null } }
  | { type: "to_do", to_do: TextBlockValue & { checked: boolean } }
  | { type: "heading_1", heading_1: HeadingBlockValue }
  | { type: "heading_2", heading_2: HeadingBlockValue }
  | { type: "heading_3", heading_3: HeadingBlockValue }
  | { type: "heading_4", heading_4: HeadingBlockValue }
  | { type: "code", code: { rich_text: RichText[], caption: RichText[], language: string } }
  | { type: "bookmark", bookmark: { caption: RichText[], url: string } }
  | { type: "embed", embed: { url: string } }
  | { type: "link_preview", link_preview: { url: string } }
  | { type: "equation", equation: { expression: string } }
  | { type: "image", image: FileBlockValue }
  | { type: "video", video: FileBlockValue }
  | { type: "audio", audio: FileBlockValue }
  | { type: "file", file: FileBlockValue }
  | { type: "pdf", pdf: FileBlockValue }
  | { type: "child_page", child_page: { title: string } }
  | { type: "child_database", child_database: { title: string } }
  | { type: "table", table: { table_width: number, has_column_header: boolean, has_row_header: boolean } }
  | { type: "table_row", table_row: { cells: RichText[][] } }
  | { type: "table_of_contents", table_of_contents: { color: string } }
  | { type: "column_list", column_list: Record<string, never> }
  | { type: "column", column: { width_ratio?: number } }
  | { type: "divider", divider: Record<string, never> }
  | { type: "breadcrumb", breadcrumb: Record<string, never> }
  | { type: "synced_block", synced_block: { synced_from: { type: "block_id", block_id: string } | null, children?: NotionBlock[] } }
  | { type: "template", template: { rich_text: RichText[], children?: NotionBlock[] } }
  | { type: "unsupported", unsupported: Record<string, never> }

export type NotionBlock = {
  object: "block",
  id: string,
  parent: BlockParent,
  created_time: string,
  created_by: PartialUser,
  last_edited_time: string,
  last_edited_by: PartialUser,
  archived: boolean,
  in_trash: boolean,
  has_children: boolean,
} & BlockTypeValue
