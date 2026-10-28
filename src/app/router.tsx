import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { AccountsPage } from '@/pages/AccountsPage'
import { ActionTagsPage } from '@/pages/ActionTagsPage'
import { ClientApiKeysPage } from '@/pages/ClientApiKeysPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { ScriptsPage } from '@/pages/ScriptsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/social-automation/action-tags" replace />,
      },
      {
        path: 'social-automation/action-tags',
        element: <ActionTagsPage />,
      },
      {
        path: 'social-automation/scripts',
        element: <ScriptsPage />,
      },
      {
        path: 'social-automation/accounts',
        element: <AccountsPage />,
      },
      {
        path: 'social-automation/clients',
        element: <ClientsPage />,
      },
      {
        path: 'social-automation/client-api-keys',
        element: <ClientApiKeysPage />,
      },
      {
        path: '*',
        element: <Navigate to="/social-automation/action-tags" replace />,
      },
    ],
  },
])
