import React from 'react';
import { render, screen } from '@testing-library/react';
import SkillModal from './SkillModal';
import type { GroupSkill } from '../../../../types/groupSkills';

vi.mock('@tdn/shared/ui/ModalPortal/ModalPortal', () => {
  const ModalPortal = ({ children, isOpen }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="modal-content">{children}</div> : null;
  return { __esModule: true, default: ModalPortal };
});
vi.mock('@uiw/react-md-editor', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange?: (v?: string) => void }) => (
    <textarea
      data-testid="md-editor"
      data-testid-value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));
vi.mock('@tdn/shared/theme/ThemeContext', () => ({
  useTheme: () => ({
    themeConfig: { type: 'preset', name: 'clean' },
    setThemeConfig: vi.fn(),
    setPreset: vi.fn(),
    setCustomColors: vi.fn(),
    getCurrentColors: vi.fn(),
    pushThemeToServer: vi.fn(),
    syncThemeFromServer: vi.fn(),
    themeSyncing: false,
    themeSyncError: null,
  }),
  getEditorColorMode: vi.fn(() => 'light'),
}));

const createMockSkill = (overrides?: Partial<GroupSkill>): GroupSkill => ({
  id: 1,
  name: 'Test Skill',
  description: 'A test skill',
  attributes: [
    { key: 'type', name: 'Type', value: 'melee' },
  ],
  isSecret: false,
  ...overrides,
});

const mockOnSave = vi.fn();

const renderModal = (editingSkill?: GroupSkill | null) => {
  render(
    <SkillModal
      isOpen
      onClose={() => {}}
      onSave={mockOnSave}
      editingSkill={editingSkill}
      availableAttributes={[]}
      possibleValuesForFilteredAttributes={{}}
      title="Тест модалка"
    />
  );
};

describe('SkillModal – required attribute value input regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('input в секции "Добавить атрибут" имеет required=false когда newAttribute пустой (isNew=true)', () => {
    renderModal(null);

    const valueInputs = screen.getAllByPlaceholderText('Значение');
    // При editingSkill=null нет существующих атрибутов — значение атрибута
    // рендерится только для newAttribute с isNew=true
    expect(valueInputs.length).toBe(1);
    expect(valueInputs[0]).not.toHaveAttribute('required');
  });

  it('input существующего атрибута (editingSkill) остаётся required=true, черновик нового — не required', () => {
    const skill = createMockSkill();
    renderModal(skill);

    const valueInputs = screen.getAllByPlaceholderText('Значение');
    // Должно быть 2: один для существующего атрибута (value="melee", required),
    // второй для черновика нового атрибута (value="", !required)
    expect(valueInputs.length).toBe(2);
    expect(valueInputs[0]).toHaveAttribute('required');
    expect(valueInputs[1]).not.toHaveAttribute('required');
  });
});
