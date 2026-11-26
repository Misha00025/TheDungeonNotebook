import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LegacyTemplateFieldImportWizard from './LegacyTemplateFieldImportWizard';
import type { BaseField, TemplateContentEnvelope, VirtualField } from './types';
import type { LegacyField, LegacyObject } from './legacyDiscovery';

const shared = vi.hoisted(() => ({
  api: {
    getTemplateContent: vi.fn(),
    putTemplateContent: vi.fn(),
    putTemplateVirtualFields: vi.fn()
  },
  reloadPermissions: vi.fn()
}));

vi.mock('./Workspace', () => ({
  useWorkspace: () => ({ api: shared.api, sessionKey: 'test-session' }),
  useDirtyDraft: () => () => undefined
}));

vi.mock('./Shell', () => ({
  useCampaignWorkspace: () => ({
    mode: 'gm',
    permissions: { canWrite: true },
    permissionsLoading: false,
    reloadPermissions: shared.reloadPermissions
  })
}));

const legacyField = (key: string, name: string, data: LegacyField['data']): LegacyField => ({ key, name, data });

describe('LegacyTemplateFieldImportWizard', () => {
  beforeEach(() => {
    Object.values(shared.api).forEach(method => method.mockReset());
    shared.reloadPermissions.mockReset();
  });

  it('adds only the selected supported legacy base field while preserving the destination template', async () => {
    const existingCollision: BaseField = {
      id: 'stable-collision-id',
      key: 'existing-key',
      title: 'Existing collision',
      description: 'kept collision description',
      valueType: 'Boolean',
      typeRevision: 4,
      value: true,
      options: []
    };
    const existingOther: BaseField = {
      id: 'stable-other-id',
      key: 'other-existing-key',
      title: 'Other existing',
      description: 'kept other description',
      valueType: 'String',
      typeRevision: 8,
      value: 'kept value',
      options: []
    };
    const virtual: VirtualField = {
      id: 'virtual-id',
      key: 'virtual-key',
      title: 'Virtual field',
      description: '',
      resultType: 'Integer',
      formulaId: 'formula-id',
      bindings: {}
    };
    const target: TemplateContentEnvelope = {
      campaignId: 12,
      contentRevision: 9,
      data: {
        description: 'keep description',
        baseFields: [existingCollision, existingOther],
        virtualFields: [virtual]
      }
    };
    shared.api.getTemplateContent.mockResolvedValue(target);
    shared.api.putTemplateContent.mockResolvedValue(target);

    const source: LegacyObject = {
      name: 'Legacy template',
      data: {},
      properties: [],
      fields: [
        legacyField('new-key', 'New field', { description: 'source description', formula: '', value: 42 }),
        legacyField('second-key', 'Second field', { description: 'second description', formula: '', value: 'second default' }),
        legacyField('existing-key', 'Duplicate source field', { formula: '', value: 'not imported' }),
        legacyField('unselected-key', 'Unselected field', { formula: null, value: false }),
        legacyField('virtual-key', 'Virtual source field', { formula: 'x + 1', value: 7 })
      ]
    };

    render(<LegacyTemplateFieldImportWizard sources={[source]} campaignId={12} onClose={vi.fn()} />);

    expect(await screen.findByLabelText('Импортировать поле New field')).toBeInTheDocument();
    expect(shared.api.putTemplateContent).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Импортировать поле Duplicate source field')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Импортировать поле New field'));
    fireEvent.click(screen.getByLabelText('Импортировать поле Second field'));
    expect(shared.api.putTemplateContent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Переместить поле New field' }), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('button', { name: 'Импортировать выбранные поля' }));

    await waitFor(() => expect(shared.api.putTemplateContent).toHaveBeenCalledTimes(1));
    expect(shared.api.putTemplateContent).toHaveBeenCalledWith(12, {
      expectedRevision: 9,
      description: 'keep description',
      baseFields: [
        {
          id: 'stable-collision-id',
          key: 'existing-key',
          title: 'Existing collision',
          description: 'kept collision description',
          valueType: 'Boolean',
          value: true,
          options: []
        },
        {
          id: 'stable-other-id',
          key: 'other-existing-key',
          title: 'Other existing',
          description: 'kept other description',
          valueType: 'String',
          value: 'kept value',
          options: []
        },
        {
          key: 'second-key',
          title: 'Second field',
          description: 'second description',
          valueType: 'String',
          value: 'second default',
          options: []
        },
        {
          key: 'new-key',
          title: 'New field',
          description: 'source description',
          valueType: 'Integer',
          value: 42,
          options: []
        }
      ]
    });
    expect(shared.api.putTemplateVirtualFields).not.toHaveBeenCalled();
  });
});
