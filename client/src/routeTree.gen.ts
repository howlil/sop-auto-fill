/* eslint-disable */

// @ts-nocheck

// This file is generated from the file-based route structure.

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as LoginIndexRouteImport } from './routes/login/index'
import { Route as WorkspacesIndexRouteImport } from './routes/workspaces/index'
import { Route as WorkspacesWorkspaceIdIndexRouteImport } from './routes/workspaces/$workspaceId/index'
import { Route as WorkspacesWorkspaceIdSopsSopIdRouteImport } from './routes/workspaces/$workspaceId/sops/$sopId'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)
const LoginIndexRoute = LoginIndexRouteImport.update({
  id: '/login/',
  path: '/login/',
  getParentRoute: () => rootRouteImport,
} as any)
const WorkspacesIndexRoute = WorkspacesIndexRouteImport.update({
  id: '/workspaces/',
  path: '/workspaces/',
  getParentRoute: () => rootRouteImport,
} as any)
const WorkspacesWorkspaceIdIndexRoute = WorkspacesWorkspaceIdIndexRouteImport.update({
  id: '/workspaces/$workspaceId/',
  path: '/workspaces/$workspaceId/',
  getParentRoute: () => rootRouteImport,
} as any)
const WorkspacesWorkspaceIdSopsSopIdRoute = WorkspacesWorkspaceIdSopsSopIdRouteImport.update({
  id: '/workspaces/$workspaceId/sops/$sopId',
  path: '/workspaces/$workspaceId/sops/$sopId',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/login/': typeof LoginIndexRoute
  '/workspaces/': typeof WorkspacesIndexRoute
  '/workspaces/$workspaceId/': typeof WorkspacesWorkspaceIdIndexRoute
  '/workspaces/$workspaceId/sops/$sopId': typeof WorkspacesWorkspaceIdSopsSopIdRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/login': typeof LoginIndexRoute
  '/workspaces': typeof WorkspacesIndexRoute
  '/workspaces/$workspaceId': typeof WorkspacesWorkspaceIdIndexRoute
  '/workspaces/$workspaceId/sops/$sopId': typeof WorkspacesWorkspaceIdSopsSopIdRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/login/': typeof LoginIndexRoute
  '/workspaces/': typeof WorkspacesIndexRoute
  '/workspaces/$workspaceId/': typeof WorkspacesWorkspaceIdIndexRoute
  '/workspaces/$workspaceId/sops/$sopId': typeof WorkspacesWorkspaceIdSopsSopIdRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: keyof FileRoutesByFullPath
  fileRoutesByTo: FileRoutesByTo
  to: keyof FileRoutesByTo
  id: keyof FileRoutesById
  fileRoutesById: FileRoutesById
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/login/': {
      id: '/login/'
      path: '/login'
      fullPath: '/login/'
      preLoaderRoute: typeof LoginIndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/workspaces/': {
      id: '/workspaces/'
      path: '/workspaces'
      fullPath: '/workspaces/'
      preLoaderRoute: typeof WorkspacesIndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/workspaces/$workspaceId/': {
      id: '/workspaces/$workspaceId/'
      path: '/workspaces/$workspaceId'
      fullPath: '/workspaces/$workspaceId/'
      preLoaderRoute: typeof WorkspacesWorkspaceIdIndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/workspaces/$workspaceId/sops/$sopId': {
      id: '/workspaces/$workspaceId/sops/$sopId'
      path: '/workspaces/$workspaceId/sops/$sopId'
      fullPath: '/workspaces/$workspaceId/sops/$sopId'
      preLoaderRoute: typeof WorkspacesWorkspaceIdSopsSopIdRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren = {
  IndexRoute,
  LoginIndexRoute,
  WorkspacesIndexRoute,
  WorkspacesWorkspaceIdIndexRoute,
  WorkspacesWorkspaceIdSopsSopIdRoute,
}

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
