const TARGET_INSPECTOR_TAB_SELECTOR = '[data-target-inspector-tab]';
const TARGET_INSPECTOR_PANEL_SELECTOR = '[data-target-inspector-panel]';

export function setupTargetInspectorTabs(root: ParentNode = document): void {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>(TARGET_INSPECTOR_TAB_SELECTOR)];
  const panels = [...root.querySelectorAll<HTMLElement>(TARGET_INSPECTOR_PANEL_SELECTOR)];
  if (tabs.length === 0 || panels.length === 0) {
    return;
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const nextTab = tab.dataset.targetInspectorTab;
      if (nextTab) {
        activateTargetInspectorTab(tabs, panels, nextTab);
      }
    });
  }
}

function activateTargetInspectorTab(tabs: HTMLButtonElement[], panels: HTMLElement[], activeTab: string): void {
  for (const tab of tabs) {
    tab.setAttribute('aria-selected', String(tab.dataset.targetInspectorTab === activeTab));
  }

  for (const panel of panels) {
    panel.hidden = panel.dataset.targetInspectorPanel !== activeTab;
  }
}
