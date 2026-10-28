import {
  KeyRound,
  MonitorSmartphone,
  ScrollText,
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

/** Approved menus only — Design Language §3 */
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
]
