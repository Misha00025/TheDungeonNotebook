export type UserSettingsValue = string | number | boolean | null | unknown[] | Record<string, unknown>;

export interface UserSettingsResponse {
  settings: Record<string, UserSettingsValue>;
}
