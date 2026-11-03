import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { RequireOwnerOrAdmin } from '@/features/session-identity/components/RequireOwnerOrAdmin'
import { AccountsPage } from '@/pages/AccountsPage'
import { ActionTagsPage } from '@/pages/ActionTagsPage'
import { ArticlePromptsPage } from '@/pages/ArticlePromptsPage'
import { ArticlesPage } from '@/pages/ArticlesPage'
import { CampaignCreatePage } from '@/pages/CampaignCreatePage'
import { CampaignDetailPage } from '@/pages/CampaignDetailPage'
import { CampaignEditPage } from '@/pages/CampaignEditPage'
import { CampaignsPage } from '@/pages/CampaignsPage'
import { ClientApiKeysPage } from '@/pages/ClientApiKeysPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { HomeRedirect } from '@/pages/HomeRedirect'
import { ScriptsPage } from '@/pages/ScriptsPage'
import { StaffClientConnectionPage } from '@/pages/StaffClientConnectionPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomeRedirect />,
      },
      {
        path: 'social-automation',
        element: <StaffClientConnectionPage />,
      },
      {
        path: 'social-automation/action-tags',
        element: (
          <RequireOwnerOrAdmin>
            <ActionTagsPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/scripts',
        element: (
          <RequireOwnerOrAdmin>
            <ScriptsPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/accounts',
        element: (
          <RequireOwnerOrAdmin>
            <AccountsPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/clients',
        element: (
          <RequireOwnerOrAdmin>
            <ClientsPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/client-api-keys',
        element: (
          <RequireOwnerOrAdmin>
            <ClientApiKeysPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/campaigns',
        element: (
          <RequireOwnerOrAdmin>
            <CampaignsPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/campaigns/new',
        element: (
          <RequireOwnerOrAdmin>
            <CampaignCreatePage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/campaigns/:id/edit',
        element: (
          <RequireOwnerOrAdmin>
            <CampaignEditPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/campaigns/:id',
        element: (
          <RequireOwnerOrAdmin>
            <CampaignDetailPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/articles',
        element: (
          <RequireOwnerOrAdmin>
            <ArticlesPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: 'social-automation/article-prompts',
        element: (
          <RequireOwnerOrAdmin>
            <ArticlePromptsPage />
          </RequireOwnerOrAdmin>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
])
