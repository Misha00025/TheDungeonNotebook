// @tdn/shared — общий код, не зависящий от домена.
// Публичный API пакета (barrel). Подключается через алиас @tdn/shared → packages/shared/src.

// --- auth ---
export { AuthProvider, useAuth, RemoteAuthProvider, AuthContext } from './auth/AuthContext';
export type { AuthContextType } from './auth/AuthContext';
export { makeAuthenticatedRequest, setAuthenticatedRequest, userAPI, userSettingsAPI } from './auth/api';
export { createBffClient, BffRequestError } from './auth/bffClient';
export type { AuthenticatedRequest, BffSession } from './auth/bffClient';
export type {
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
export type { TabItem, TabBarProps } from './ui/PageLayout/TabBar';
export { default as AdaptiveLayout } from './ui/AdaptiveLayout/AdaptiveLayout';
export type { AdaptiveLayoutProps } from './ui/AdaptiveLayout/AdaptiveLayout';
export { default as GlobalSidebar } from './ui/GlobalSidebar/GlobalSidebar';
export { SidebarProvider, useSidebar } from './ui/SidebarContext';
export type { NavItem } from './ui/navigation';
export { default as IconButton } from './ui/Buttons/IconButton/IconButton';
export type { IconType, IconButtonProps } from './ui/Buttons/IconButton/IconButton';
export { default as Button } from './ui/Buttons/Button';
export type { ButtonProps, ButtonVariant } from './ui/Buttons/Button';
export { default as DragHandle } from './ui/Buttons/DragHandle';
export type { DragHandleProps } from './ui/Buttons/DragHandle';
export { default as LinkButton } from './ui/Buttons/LinkButton';
export type { LinkButtonProps } from './ui/Buttons/LinkButton';
export { default as Panel, Badge } from './ui/Panel/Panel';
export type { PanelProps } from './ui/Panel/Panel';
export { default as DataTable } from './ui/DataTable/DataTable';
export type { DataTableProps } from './ui/DataTable/DataTable';
export { default as Statistic } from './ui/Statistic/Statistic';
export type { StatisticProps } from './ui/Statistic/Statistic';
export { default as Field } from './ui/Form/Field';
export type { FieldProps } from './ui/Form/Field';
export { default as FieldSet } from './ui/Form/FieldSet';
export type { FieldSetProps } from './ui/Form/FieldSet';
export { default as FormGrid } from './ui/Form/FormGrid';
export type { FormGridProps } from './ui/Form/FormGrid';
export { default as Input } from './ui/Form/Input';
export type { InputProps } from './ui/Form/Input';
export { default as Select } from './ui/Form/Select';
export type { SelectProps } from './ui/Form/Select';
export { default as Textarea } from './ui/Form/Textarea';
export type { TextareaProps } from './ui/Form/Textarea';
export { default as ThemeToggle } from './ui/Buttons/ThemeToggle/ThemeToggle';
export { default as ModalPortal } from './ui/ModalPortal/ModalPortal';
export type { ModalPortalProps } from './ui/ModalPortal/ModalPortal';
export { default as SearchBar } from './ui/Search/SearchBar';
export type { SearchBarProps } from './ui/Search/SearchBar';
export { default as CollapsibleGroup } from './ui/CollapsibleGroup/CollapsibleGroup';
export { default as DropdownMenu } from './ui/DropdownMenu/DropdownMenu';
export type { MenuItem, DropdownMenuProps } from './ui/DropdownMenu/DropdownMenu';
export { default as EvaluatedInput } from './ui/EvaluatedInput/EvaluatedInput';
export { default as List } from './ui/List/List';
export type { ListProps } from './ui/List/List';
export { default as ListItem } from './ui/List/ListItem';
export type { ListItemProps } from './ui/List/ListItem';
export { default as PersonalizeModal } from './ui/PersonalizeModal/PersonalizeModal';
export { default as WorkspaceLayout } from './ui/WorkspaceLayout/WorkspaceLayout';
export type { WorkspaceLayoutProps } from './ui/WorkspaceLayout/WorkspaceLayout';
export { default as SectionNav } from './ui/SectionNav/SectionNav';
export type { SectionNavProps, SectionNavItem } from './ui/SectionNav/SectionNav';
export { default as BottomNavigation } from './ui/BottomNavigation/BottomNavigation';
export type { BottomNavigationProps, BottomNavigationItem } from './ui/BottomNavigation/BottomNavigation';
export { default as NavigationIcon } from './ui/NavigationIcon/NavigationIcon';
export type { NavigationIconName, NavigationIconProps } from './ui/NavigationIcon/NavigationIcon';
export { default as ActionRow } from './ui/Composition/ActionRow';
export type { ActionRowProps } from './ui/Composition/ActionRow';
export { default as Toolbar } from './ui/Composition/Toolbar';
export type { ToolbarProps } from './ui/Composition/Toolbar';
export { default as StatePanel } from './ui/StatePanel/StatePanel';
export type { StatePanelProps } from './ui/StatePanel/StatePanel';
export { default as Notification } from './ui/Notification/Notification';
export type { NotificationKind, NotificationProps } from './ui/Notification/Notification';

// --- utils ---
export { evaluateExpression } from './utils/evaluateExpression';
export { generateKey } from './utils/generateKey';
export { storage } from './utils/storage';

// --- config ---
export { loadConfig, getConfig, setConfig, getApiBase, setApiBase, joinApiUrl } from './config';
export type { AppConfig } from './config';
export type { HubRemoteProps } from './auth/AuthContext';
export { names } from './config/names';
export type { NamesConfig } from './config/names';
