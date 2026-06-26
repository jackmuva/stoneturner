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

export type NotionPageMarkdown = {
  object: "page_markdown",
  id: string,
  markdown: string,
  truncated: boolean,
  unknown_block_ids: string[],
}
