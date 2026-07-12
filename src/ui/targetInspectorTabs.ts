const TARGET_INSPECTOR_TAB_SELECTOR = '[data-target-inspector-tab]';
const TARGET_INSPECTOR_PANEL_SELECTOR = '[data-target-inspector-panel]';

export type TargetInspectorTabsController = {
  activate: (tabId: string) => boolean;
  getActiveTab: () => string | undefined;
  setTabEnabled: (tabId: string, enabled: boolean) => void;
};

export function setupTargetInspectorTabs(root: ParentNode = document): TargetInspectorTabsController {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>(TARGET_INSPECTOR_TAB_SELECTOR)];
  const panels = [...root.querySelectorAll<HTMLElement>(TARGET_INSPECTOR_PANEL_SELECTOR)];
  if (tabs.length === 0 || panels.length === 0) {
    return {
      activate: () => false,
      getActiveTab: () => undefined,
      setTabEnabled: () => undefined,
    };
  }

  const controller: TargetInspectorTabsController = {
    activate: (tabId) => activateTargetInspectorTab(tabs, panels, tabId),
    getActiveTab: () => tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.dataset.targetInspectorTab,
    setTabEnabled: (tabId, enabled) => {
      const tab = tabs.find((entry) => entry.dataset.targetInspectorTab === tabId);
      if (!tab) {
        return;
      }
      tab.disabled = !enabled;
      tab.setAttribute('aria-disabled', String(!enabled));
    },
  };

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const nextTab = tab.dataset.targetInspectorTab;
      if (nextTab) {
        controller.activate(nextTab);
      }
    });
  }

  return controller;
}

function activateTargetInspectorTab(tabs: HTMLButtonElement[], panels: HTMLElement[], activeTab: string): boolean {
  const activeButton = tabs.find((tab) => tab.dataset.targetInspectorTab === activeTab);
  if (!activeButton || isTabDisabled(activeButton)) {
    return false;
  }

  for (const tab of tabs) {
    tab.setAttribute('aria-selected', String(tab.dataset.targetInspectorTab === activeTab));
  }

  for (const panel of panels) {
    panel.hidden = panel.dataset.targetInspectorPanel !== activeTab;
  }

  return true;
}

function isTabDisabled(tab: HTMLButtonElement): boolean {
  return tab.disabled || tab.getAttribute('aria-disabled') === 'true';
}
