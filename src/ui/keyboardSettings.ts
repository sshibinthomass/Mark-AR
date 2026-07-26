import {
  keyboardShortcutSections,
  type KeyboardShortcutSection,
} from '../app/keyboardShortcuts';

export function renderKeyboardSettings(
  sections: readonly KeyboardShortcutSection[] = keyboardShortcutSections,
  headingPrefix = 'keyboard-shortcuts',
): string {
  return `
    <div class="keyboard-settings">
      <p class="keyboard-settings-intro">
        These shortcuts work throughout Studio whenever their required selection exists.
        They stay inactive while you are typing or editing a form.
      </p>
      <div class="keyboard-settings-grid">
        ${sections.map((section) => renderSection(section, headingPrefix)).join('')}
      </div>
    </div>
  `;
}

function renderSection(section: KeyboardShortcutSection, headingPrefix: string): string {
  const headingId = `${headingPrefix}-${section.id}`;
  return `
    <section class="keyboard-shortcut-card" aria-labelledby="${headingId}">
      <header>
        <p class="eyebrow">Keyboard</p>
        <h3 id="${headingId}">${section.label}</h3>
        <p>${section.description}</p>
      </header>
      <ul class="keyboard-shortcut-list">
        ${section.shortcuts.map((shortcut) => `
          <li class="keyboard-shortcut-row">
            <span class="keyboard-shortcut-keys" aria-label="${shortcut.keys.join(' or ')}">
              ${shortcut.keys.map((key) => `<kbd>${key}</kbd>`).join('<span aria-hidden="true">or</span>')}
            </span>
            <span class="keyboard-shortcut-copy">
              <strong>${shortcut.action}</strong>
              <small>${shortcut.scope}</small>
            </span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}
