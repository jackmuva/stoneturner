import { MAX_WORKERS, PAGE_SIZE } from "@/lib/constants";
import { appendNotionBlockChildren, batchInsertNotionBlock, getNotionPages } from "../db/queries";
import type { NotionBlockInsert, NotionPageSelect } from "../db/schema";
import { getNotionCredentials, handleNotionRefresh, NOTION_BASE_API, NOTION_VERSION } from "./notion-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import type { FileObject, NotionBlock, NotionBlocks, RichTextItem } from "../models/models";

export const syncNotionBlocks = async (incremental?: { lastEditedDate: string | null }, cursor?: number) => {
  let curOffset: number = cursor ? cursor : 0;
  let notionPages: NotionPageSelect[] = await getNotionPages(curOffset);

  while (notionPages.length > 0) {
    let notionPageIndex = 0;
    while (notionPageIndex < notionPages.length) {
      let workerQueue: NotionPageSelect[] = [];
      while (workerQueue.length < MAX_WORKERS && notionPageIndex < notionPages.length) {
        if (incremental && incremental.lastEditedDate) {
          if (notionPages[notionPageIndex]?.lastEditedTime && notionPages[notionPageIndex]!.lastEditedTime! >= incremental.lastEditedDate) {
            workerQueue.push(notionPages[notionPageIndex]!);
          }
        } else {
          workerQueue.push(notionPages[notionPageIndex]!);
        }
        notionPageIndex += 1;
      }
      try {
        //TODO: For parent, I need to use get block to get the page information
        const parentBlocks: NotionBlockInsert[] = workerQueue.map((page) => ({
          blockId: page.pageId,
          type: "child_page",
          hasChildren: true,
          lastEditedTime: page.lastEditedTime,
        }));
        if (parentBlocks.length > 0) {
          await batchInsertNotionBlock(parentBlocks);
        }
        const results = await Promise.allSettled(workerQueue.map((page) => {
          return syncNotionBlocksById(page.pageId);
        }));
        const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

        if (rejected.length > 0) {
          upsertSyncTask({
            integration: "notion",
            status: "FAILED",
            step: "notion-sync-blocks",
            inputs: { cursor: curOffset, errors: rejected.map((r) => String(r.reason)) },
          })
        } else {
          upsertSyncTask({
            integration: "notion",
            status: "SUCCESS",
            step: "notion-sync-blocks",
            inputs: { cursor: curOffset },
          })
        }
      } catch (e) {
        upsertSyncTask({
          integration: "notion",
          status: "FAILED",
          step: "notion-sync-blocks",
          inputs: { cursor: curOffset, error: e },
        })
      }
    }
    if (cursor) break;
    curOffset += PAGE_SIZE;
    notionPages = await getNotionPages(curOffset);
  }
}

const syncNotionBlocksById = async (blockId: string, nextCursor?: string) => {
  const url = nextCursor
    ? `${NOTION_BASE_API}/blocks/${blockId}/children?start_cursor=${nextCursor}`
    : `${NOTION_BASE_API}/blocks/${blockId}/children`;

  let cred = await getNotionCredentials();
  if (!cred?.accessToken) throw new Error("Missing Notion credential");
  let res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${cred.accessToken}`,
      "Notion-Version": NOTION_VERSION,
    },
  });

  if (!res.ok) {
    await handleNotionRefresh();
    cred = await getNotionCredentials();
    if (!cred?.accessToken) throw new Error("Missing Notion credential");
    res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cred.accessToken}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    if (!res.ok) throw new Error(JSON.stringify(await res.json()));
  }

  const notionBlocks = await res.json() as NotionBlocks;
  const childrenBlockIds = notionBlocks.results.map((child) => child.id);

  const childBlocks: NotionBlockInsert[] = notionBlocks.results.map((childBlock) => ({
    blockId: childBlock.id,
    type: childBlock.type,
    hasChildren: childBlock.has_children,
    text: formatBlockInMarkdown(childBlock),
    lastEditedTime: childBlock.last_edited_time,
  }));
  if (childBlocks.length > 0) {
    await batchInsertNotionBlock(childBlocks);
  }

  await appendNotionBlockChildren(blockId, childrenBlockIds, {
    nextCursor: notionBlocks.next_cursor,
    hasMore: notionBlocks.has_more,
  });

  if (notionBlocks.has_more && notionBlocks.next_cursor) {
    await syncNotionBlocksById(blockId, notionBlocks.next_cursor);
  }

  for (const childBlock of notionBlocks.results) {
    if (childBlock.has_children) {
      await syncNotionBlocksById(childBlock.id);
    }
  }
}

const formatBlockInMarkdown = (block: NotionBlock): string => {
  switch (block.type) {
    case "paragraph":
      return formatRichText(block.paragraph.rich_text);
    case "heading_1":
      return `# ${formatRichText(block.heading_1.rich_text)}`;
    case "heading_2":
      return `## ${formatRichText(block.heading_2.rich_text)}`;
    case "heading_3":
      return `### ${formatRichText(block.heading_3.rich_text)}`;
    case "heading_4":
      return `#### ${formatRichText(block.heading_4.rich_text)}`;
    case "bulleted_list_item":
      return `- ${formatRichText(block.bulleted_list_item.rich_text)}`;
    case "numbered_list_item":
      return `1. ${formatRichText(block.numbered_list_item.rich_text)}`;
    case "quote":
      return `> ${formatRichText(block.quote.rich_text)}`;
    case "to_do":
      return `- [${block.to_do.checked ? "x" : " "}] ${formatRichText(block.to_do.rich_text)}`;
    case "toggle":
      return `<Toggle>${formatRichText(block.toggle.rich_text)}</Toggle>`;
    case "template":
      return `<Template>${formatRichText(block.template.rich_text)}</Template>`;
    case "code": {
      const text = formatRichText(block.code.rich_text);
      const caption = formatRichText(block.code.caption);
      const fence = `\`\`\`${block.code.language}\n${text}\n\`\`\``;
      return caption ? `${fence}\n${caption}` : fence;
    }
    case "callout":
      return `<Callout>${formatRichText(block.callout.rich_text)}</Callout>`;
    case "divider":
      return "---";
    case "breadcrumb":
      return "<Breadcrumb></Breadcrumb>";
    case "table_of_contents":
      return "<TableOfContents></TableOfContents>";
    case "column_list":
      return "<ColumnList></ColumnList>";
    case "column":
      return "<Column></Column>";
    case "child_page":
      return `<ChildPage>${block.child_page.title}</ChildPage>`;
    case "child_database":
      return `<ChildDatabase>${block.child_database.title}</ChildDatabase>`;
    case "synced_block":
      return `<SyncedBlock from="${block.synced_block.synced_from?.block_id ?? ""}"></SyncedBlock>`;
    case "link_to_page": {
      const id =
        block.link_to_page.type === "page_id"
          ? block.link_to_page.page_id
          : block.link_to_page.type === "database_id"
            ? block.link_to_page.database_id
            : block.link_to_page.comment_id;
      return `<LinkToPage type="${block.link_to_page.type}" id="${id}"></LinkToPage>`;
    }
    case "table":
      return "<Table></Table>";
    case "table_row":
      return `| ${block.table_row.cells.map(formatRichText).join(" | ")} |`;
    case "embed": {
      const caption = formatRichText(block.embed.caption);
      return `<Embed url="${block.embed.url}">${caption}</Embed>`;
    }
    case "bookmark": {
      const caption = formatRichText(block.bookmark.caption);
      return `[${caption || block.bookmark.url}](${block.bookmark.url})`;
    }
    case "image": {
      const caption = formatRichText(block.image.caption);
      return `![${caption}](${fileUrl(block.image)})`;
    }
    case "video": {
      const caption = formatRichText(block.video.caption);
      return `<Video url="${fileUrl(block.video)}">${caption}</Video>`;
    }
    case "pdf": {
      const caption = formatRichText(block.pdf.caption);
      return `<Pdf url="${fileUrl(block.pdf)}">${caption}</Pdf>`;
    }
    case "file": {
      const caption = formatRichText(block.file.caption);
      return `<File name="${block.file.name}" url="${fileUrl(block.file)}">${caption}</File>`;
    }
    case "audio": {
      const caption = formatRichText(block.audio.caption);
      return `<Audio url="${fileUrl(block.audio)}">${caption}</Audio>`;
    }
    case "link_preview":
      return `<LinkPreview url="${block.link_preview.url}"></LinkPreview>`;
    case "equation":
      return `$$${block.equation.expression}$$`;
    case "unsupported":
      return `<Unsupported type="${block.unsupported.block_type ?? ""}"></Unsupported>`;
    default:
      return "";
  }
}

const formatRichTextItem = (item: RichTextItem): string => {
  let text = item.plain_text;

  // Equations render as inline LaTeX regardless of annotations.
  if (item.type === "equation") {
    return `$${item.equation.expression}$`;
  }

  const { bold, italic, strikethrough, underline, code } = item.annotations;
  if (code) text = `\`${text}\``;
  if (bold) text = `**${text}**`;
  if (italic) text = `*${text}*`;
  if (strikethrough) text = `~~${text}~~`;
  if (underline) text = `<u>${text}</u>`;

  // text/mention can carry a link; for text it lives on text.link, otherwise href.
  const href = item.href ?? (item.type === "text" ? item.text.link?.url ?? null : null);
  if (href) text = `[${text}](${href})`;

  return text;
};

const formatRichText = (items: RichTextItem[]): string =>
  items.map(formatRichTextItem).join("");

const fileUrl = (file: FileObject): string => {
  switch (file.type) {
    case "external":
      return file.external.url;
    case "file":
      return file.file.url;
    case "file_upload":
      return file.file_upload.id;
  }
};
