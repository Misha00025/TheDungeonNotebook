// @tdn/shared — общий код, не зависящий от домена.
// Публичный API пакета (barrel). Подключается через алиас @tdn/shared → packages/shared/src.

// --- auth ---
export { AuthProvider, useAuth, RemoteAuthProvider, AuthContext } from './auth/AuthContext';
export type { AuthContextType } from './auth/AuthContext';
export { authAPI, makeAuthenticatedRequest, userAPI, userSettingsAPI } from './auth/api';
export { default as tokenManager } from './auth/tokenManager';
export type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  WhoAmIResponse,
  UserProfile,
  CreateProfileRequest,
} from './auth/types';
export type { UserSettingsValue, UserSettingsResponse } from './auth/userSettings';

// --- theme ---
export { ThemeProvider, useTheme, PRESET_COLORS, getEditorColorMode } from './theme/ThemeContext';
export type { ThemeConfig, PresetTheme, CustomColors } from './theme/types';
export { DEFAULT_THEME, PRESET_LABELS } from './theme/types';
export {
  hexToRgb,
  rgbToHex,
  blendHex,
  darkenHex,
  lightenHex,
  isLight,
  computeBgSecondary,
  computeTextSecondary,
  computeBorderColor,
  computeDangerColor,
  computeTextOnAccent,
  computeTextShadow,
  computeProgressFrom,
  computeProgressTo,
} from './theme/color';

// --- ui ---
export { default as PageLayout } from './ui/PageLayout/PageLayout';
export type { PageLayoutProps } from './ui/PageLayout/PageLayout';
export { default as PageHeader } from './ui/PageLayout/PageHeader';
export type { PageHeaderProps } from './ui/PageLayout/PageHeader';
export { default as Breadcrumbs } from './ui/PageLayout/Breadcrumbs';
export type { BreadcrumbItem } from './ui/PageLayout/Breadcrumbs';
export { default as TabBar } from './ui/PageLayout/TabBar';
export type { TabItem } from './ui/PageLayout/TabBar';
export { default as AdaptiveLayout } from './ui/AdaptiveLayout/AdaptiveLayout';
export type { AdaptiveLayoutProps } from './ui/AdaptiveLayout/AdaptiveLayout';
export { default as GlobalSidebar } from './ui/GlobalSidebar/GlobalSidebar';
export { SidebarProvider, useSidebar } from './ui/SidebarContext';
export type { NavItem } from './ui/navigation';
export { default as IconButton } from './ui/Buttons/IconButton/IconButton';
export type { IconType } from './ui/Buttons/IconButton/IconButton';
export { default as ThemeToggle } from './ui/Buttons/ThemeToggle/ThemeToggle';
export { default as ModalPortal } from './ui/ModalPortal/ModalPortal';
export { default as SearchBar } from './ui/Search/SearchBar';
export { default as CollapsibleGroup } from './ui/CollapsibleGroup/CollapsibleGroup';
export { default as DropdownMenu } from './ui/DropdownMenu/DropdownMenu';
export type { MenuItem } from './ui/DropdownMenu/DropdownMenu';
export { default as EvaluatedInput } from './ui/EvaluatedInput/EvaluatedInput';
export { default as List } from './ui/List/List';
export { default as ListItem } from './ui/List/ListItem';
export { default as PersonalizeModal } from './ui/PersonalizeModal/PersonalizeModal';

// --- utils ---
export { evaluateExpression } from './utils/evaluateExpression';
export { generateKey } from './utils/generateKey';
export { storage } from './utils/storage';

// --- config ---
export { loadConfig, getApiBase, setApiBase, joinApiUrl } from './config';
export { names } from './config/names';
export type { NamesConfig } from './config/names';
