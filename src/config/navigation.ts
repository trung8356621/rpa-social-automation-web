import {
  FileText,
  KeyRound,
  Megaphone,
  MonitorSmartphone,
  ScrollText,
  Sparkles,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  to: string
  icon: LucideIcon
  description: string
}

/** Owner/Admin menus — Staff shell hides this nav entirely */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Action Tags',
    to: '/social-automation/action-tags',
    icon: Tags,
    description: 'Site / Path / Action tag registry',
  },
  {
    label: 'Script Registry',
    to: '/social-automation/scripts',
    icon: ScrollText,
    description: 'Script catalog with demo media',
  },
  {
    label: 'Accounts',
    to: '/social-automation/accounts',
    icon: Users,
    description: 'Account inventory by Account ID',
  },
  {
    label: 'Clients',
    to: '/social-automation/clients',
    icon: MonitorSmartphone,
    description: 'Browser-first operational view',
  },
  {
    label: 'Client API Keys',
    to: '/social-automation/client-api-keys',
    icon: KeyRound,
    description: 'Client key identity and lease status',
  },
  {
    label: 'Campaigns',
    to: '/social-automation/campaigns',
    icon: Megaphone,
    description: 'Campaign list and execution control',
  },
  {
    label: 'Bài viết',
    to: '/social-automation/articles',
    icon: FileText,
    description: 'Campaign Content / manual articles',
  },
  {
    label: 'Prompt bài viết theo Tags',
    to: '/social-automation/article-prompts',
    icon: Sparkles,
    description: 'Prompt configuration shell by Action Tags',
  },
]
