import type { Project } from '@/types';

/** Plot rows in DB for this project (preferred over totalPlots after bulk import). */
export function getProjectInventoryPlotTotal(
  project: Pick<Project, 'totalPlots' | 'inventoryPlotCount'>,
): number {
  if (typeof project.inventoryPlotCount === 'number') {
    return project.inventoryPlotCount;
  }
  return project.totalPlots;
}

/** When plot rows are loaded on detail pages, use that count. */
export function getProjectDisplayPlotTotal(
  project: Pick<Project, 'totalPlots' | 'inventoryPlotCount'>,
  loadedPlotCount: number,
): number {
  if (loadedPlotCount > 0) return loadedPlotCount;
  return getProjectInventoryPlotTotal(project);
}
