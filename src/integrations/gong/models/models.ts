export type GongTranscriptResponse = {
  requestId: string,
  records: {
    totalRecords: number,
    currentPageSize: number,
    currentPageNumber: number,
    cursor?: string,
  },
  callTranscripts: GongTranscript[],
}

export type GongTranscript = {
  callId: string,
  transcript: GongSentence[],
}

export type GongSentence = {
  speakerId: string,
  topic: string,
  sentences: {
    start: number,
    end: number,
    text: string,
  }[]
}

export type GongCallResponse = {
  requestId: string,
  records: {
    totalRecords: number,
    currentPageSize: number,
    currentPageNumber: number,
    cursor: string,
  }
  calls: GongCall[]
}

export type GongCall = {
  id: string,
  url: string,
  title: string,
  scheduled: string,
  started: string,
  duration: number,
  primaryUserId: string,
  direction: "Inbound" | "Outbound" | "Conference" | "Unknown",
  system: string,
  scope: "Internal" | "External" | "Unknown",
  media: "Video" | "Audio",
  language: string,
  workspaceId: string,
  sdrDisposition: string,
  clientUniqueId: string,
  customData: string,
  purpose: string,
  meetingUrl: string,
  isPrivate: boolean,
  calendarEventId: string,
}
