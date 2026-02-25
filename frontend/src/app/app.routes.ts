import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/assets/asset-list/asset-list.component').then((m) => m.AssetListComponent) },
  { path: 'assets/new', loadComponent: () => import('./features/assets/asset-form/asset-form.component').then((m) => m.AssetFormComponent) },
];
