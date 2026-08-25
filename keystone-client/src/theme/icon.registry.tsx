import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Globe,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  ShieldCheck,
  Tag,
  UserPlus,
  UserRoundPen,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ThemeId } from "./theme.types";

export const BASE_THEME_ICONS = {
  back: ArrowLeft,
  close: X,
  confirm: Check,
  copy: Copy,
  download: Download,
  "edit-avatar": UserRoundPen,
  "external-link": ExternalLink,
  folder: FolderOpen,
  "hide-password": EyeOff,
  loading: LoaderCircle,
  login: LogIn,
  logout: LogOut,
  refresh: RefreshCw,
  register: UserPlus,
  reinstall: RotateCcw,
  retry: RotateCw,
  save: Save,
  search: Search,
  "show-password": Eye,
  "sort-ascending": ChevronUp,
  "sort-descending": ChevronDown,
  "sort-unsorted": ChevronsUpDown,
  "status-activity": Activity,
  "status-cache": Database,
  "status-installed": Download,
  "status-last-check": Clock3,
  "status-source": Globe,
  "status-success": CheckCircle2,
  "status-verified": ShieldCheck,
  "status-version": Tag,
} as const satisfies Record<string, LucideIcon>;

export type ThemeIconRole = keyof typeof BASE_THEME_ICONS;
export type ThemeIconOverrides = Partial<
  Record<ThemeId, Partial<Record<ThemeIconRole, LucideIcon>>>
>;

export const THEME_ICON_OVERRIDES = {
  poison: {},
} as const satisfies ThemeIconOverrides;

export function resolveThemeIcon(
  theme: ThemeId,
  role: ThemeIconRole,
  overrides: ThemeIconOverrides = THEME_ICON_OVERRIDES,
): LucideIcon {
  return overrides[theme]?.[role] ?? BASE_THEME_ICONS[role];
}
