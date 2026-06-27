// Types for the Plaud developer API JSON responses.

export type PlaudFileListItem = {
  id: string;
  name: string;
  created_at: string;
  serial_number: string;
  start_at: string;
  duration: number;
};

export type PlaudFileListResponse = {
  type: string;
  data: PlaudFileListItem[];
  page: number;
  page_size: number;
};

export type PlaudSourceItem = {
  data_id: string;
  data_type: string; // e.g. "transaction" (transcript), "outline"
  data_title: string;
  data_content: string; // JSON string — for "transaction" it's PlaudTranscriptSegment[]
  data_link: string;
};

export type PlaudNoteItem = {
  data_id: string;
  data_type: string; // e.g. "auto_sum_note"
  data_title: string;
  data_tab_name: string;
  data_content: string;
  data_link: string;
  data_error_code: number;
};

export type PlaudFileDetail = {
  id: string;
  name: string;
  created_at: string;
  serial_number: string;
  start_at: string;
  duration: number;
  presigned_url: string | null;
  source_list: PlaudSourceItem[];
  note_list: PlaudNoteItem[];
};

export type PlaudTranscriptSegment = {
  start_time: number;
  end_time: number;
  content: string;
  speaker: string;
};

export type PlaudTokenResponse = {
  access_token: string;
  refresh_token: string;
};
