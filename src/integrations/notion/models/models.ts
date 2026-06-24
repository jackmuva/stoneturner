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

// ---------------------------------------------------------------------------
// Blocks — https://developers.notion.com/reference/get-block-children
// ---------------------------------------------------------------------------

export type ApiColor =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red"
  | "gray_background"
  | "brown_background"
  | "orange_background"
  | "yellow_background"
  | "green_background"
  | "blue_background"
  | "purple_background"
  | "pink_background"
  | "red_background"

export type RichTextAnnotations = {
  bold: boolean,
  italic: boolean,
  strikethrough: boolean,
  underline: boolean,
  code: boolean,
  color: ApiColor,
}

export type MentionObject = {
  type: string,
  [key: string]: unknown,
}

export type RichTextBase = {
  plain_text: string,
  href: string | null,
  annotations: RichTextAnnotations,
}

export type RichTextItem =
  | (RichTextBase & {
    type: "text",
    text: { content: string, link: { url: string } | null },
  })
  | (RichTextBase & {
    type: "mention",
    mention: MentionObject,
  })
  | (RichTextBase & {
    type: "equation",
    equation: { expression: string },
  })

// --- Block type-specific payloads ---

export type ParagraphBlock = { rich_text: RichTextItem[], color: ApiColor }
export type HeadingBlock = { rich_text: RichTextItem[], color: ApiColor, is_toggleable: boolean }
export type BulletedListItemBlock = { rich_text: RichTextItem[], color: ApiColor }
export type NumberedListItemBlock = { rich_text: RichTextItem[], color: ApiColor }
export type QuoteBlock = { rich_text: RichTextItem[], color: ApiColor }
export type ToggleBlock = { rich_text: RichTextItem[], color: ApiColor }
export type ToDoBlock = { rich_text: RichTextItem[], color: ApiColor, checked: boolean }
export type CalloutBlock = { rich_text: RichTextItem[], color: ApiColor, icon: PageIcon | null }
export type CodeBlock = { rich_text: RichTextItem[], caption: RichTextItem[], language: string }
export type TemplateBlock = { rich_text: RichTextItem[] }

export type DividerBlock = Record<string, never>
export type BreadcrumbBlock = Record<string, never>
export type ColumnListBlock = Record<string, never>
export type TableOfContentsBlock = { color: ApiColor }
export type ColumnBlock = { width_ratio?: number }

export type ChildPageBlock = { title: string }
export type ChildDatabaseBlock = { title: string }
export type SyncedBlock = { synced_from: { type: "block_id", block_id: string } | null }
export type LinkToPageBlock =
  | { type: "page_id", page_id: string }
  | { type: "database_id", database_id: string }
  | { type: "comment_id", comment_id: string }

export type TableBlock = { has_column_header: boolean, has_row_header: boolean, table_width: number }
export type TableRowBlock = { cells: RichTextItem[][] }

export type EmbedBlock = { url: string, caption: RichTextItem[] }
export type BookmarkBlock = { url: string, caption: RichTextItem[] }
export type ImageBlock = FileObject & { caption: RichTextItem[] }
export type VideoBlock = FileObject & { caption: RichTextItem[] }
export type PdfBlock = FileObject & { caption: RichTextItem[] }
export type AudioBlock = FileObject & { caption: RichTextItem[] }
export type FileBlock = FileObject & { name: string, caption: RichTextItem[] }
export type LinkPreviewBlock = { url: string }

export type EquationBlock = { expression: string }
export type UnsupportedBlock = { block_type?: string }

export type BlockBase = {
  object: "block",
  id: string,
  parent: PageParent,
  created_time: string,
  created_by: PartialUser,
  last_edited_time: string,
  last_edited_by: PartialUser,
  has_children: boolean,
  archived: boolean,
  in_trash: boolean,
}

export type NotionBlock =
  | (BlockBase & { type: "paragraph", paragraph: ParagraphBlock })
  | (BlockBase & { type: "heading_1", heading_1: HeadingBlock })
  | (BlockBase & { type: "heading_2", heading_2: HeadingBlock })
  | (BlockBase & { type: "heading_3", heading_3: HeadingBlock })
  | (BlockBase & { type: "heading_4", heading_4: HeadingBlock })
  | (BlockBase & { type: "bulleted_list_item", bulleted_list_item: BulletedListItemBlock })
  | (BlockBase & { type: "numbered_list_item", numbered_list_item: NumberedListItemBlock })
  | (BlockBase & { type: "quote", quote: QuoteBlock })
  | (BlockBase & { type: "to_do", to_do: ToDoBlock })
  | (BlockBase & { type: "toggle", toggle: ToggleBlock })
  | (BlockBase & { type: "template", template: TemplateBlock })
  | (BlockBase & { type: "code", code: CodeBlock })
  | (BlockBase & { type: "callout", callout: CalloutBlock })
  | (BlockBase & { type: "divider", divider: DividerBlock })
  | (BlockBase & { type: "breadcrumb", breadcrumb: BreadcrumbBlock })
  | (BlockBase & { type: "table_of_contents", table_of_contents: TableOfContentsBlock })
  | (BlockBase & { type: "column_list", column_list: ColumnListBlock })
  | (BlockBase & { type: "column", column: ColumnBlock })
  | (BlockBase & { type: "child_page", child_page: ChildPageBlock })
  | (BlockBase & { type: "child_database", child_database: ChildDatabaseBlock })
  | (BlockBase & { type: "synced_block", synced_block: SyncedBlock })
  | (BlockBase & { type: "link_to_page", link_to_page: LinkToPageBlock })
  | (BlockBase & { type: "table", table: TableBlock })
  | (BlockBase & { type: "table_row", table_row: TableRowBlock })
  | (BlockBase & { type: "embed", embed: EmbedBlock })
  | (BlockBase & { type: "bookmark", bookmark: BookmarkBlock })
  | (BlockBase & { type: "image", image: ImageBlock })
  | (BlockBase & { type: "video", video: VideoBlock })
  | (BlockBase & { type: "pdf", pdf: PdfBlock })
  | (BlockBase & { type: "file", file: FileBlock })
  | (BlockBase & { type: "audio", audio: AudioBlock })
  | (BlockBase & { type: "link_preview", link_preview: LinkPreviewBlock })
  | (BlockBase & { type: "equation", equation: EquationBlock })
  | (BlockBase & { type: "unsupported", unsupported: UnsupportedBlock })

export type NotionBlocks = {
  object: "list",
  results: NotionBlock[],
  next_cursor: string | null,
  has_more: boolean,
  type: "block",
  block: Record<string, never>,
}

