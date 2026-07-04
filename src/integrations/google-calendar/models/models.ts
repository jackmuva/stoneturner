export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

export type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  description?: string;
  timeZone?: string;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
};

export type GoogleCalendarListResponse = {
  items?: GoogleCalendarListItem[];
  nextPageToken?: string;
};

export type GoogleEventDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleEventPerson = {
  id?: string;
  email?: string;
  displayName?: string;
  self?: boolean;
  organizer?: boolean;
  responseStatus?: string;
  optional?: boolean;
};

export type GoogleConferenceEntryPoint = {
  entryPointType?: string;
  uri?: string;
  label?: string;
};

export type GoogleConferenceData = {
  entryPoints?: GoogleConferenceEntryPoint[];
  conferenceId?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  organizer?: GoogleEventPerson;
  attendees?: GoogleEventPerson[];
  hangoutLink?: string;
  conferenceData?: GoogleConferenceData;
};

export type GoogleEventsListResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
};
