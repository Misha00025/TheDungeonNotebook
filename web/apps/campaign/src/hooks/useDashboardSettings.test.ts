import { renderHook, act, waitFor } from '@testing-library/react';
import type { Mock, Mocked } from 'vitest';
import { useDashboardSettings } from './useDashboardSettings';

vi.mock('../services/api', () => ({
  groupAPI: {
    getCharacterResources: vi.fn(),
  },
  characterEquipmentAPI: {
    getEquipment: vi.fn(),
    equipItem: vi.fn(),
    unequipItem: vi.fn(),
    putEquipment: vi.fn(),
  },
}));

import { groupAPI, characterEquipmentAPI } from '../services/api';

const mockGroupAPI = groupAPI as Mocked<typeof groupAPI>;
const mockEquipmentAPI = characterEquipmentAPI as Mocked<typeof characterEquipmentAPI>;

describe('useDashboardSettings', () => {
  const groupId = 1;
  const characterId = 42;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('загружает ресурсы с сервера и экипировку', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue(['hp', 'mp']);
    mockEquipmentAPI.getEquipment.mockResolvedValue([10, 20]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.baseResourceFields).toEqual(['hp', 'mp']);
    expect(result.current.settings.fields).toContain('hp');
    expect(result.current.settings.fields).toContain('mp');
    expect(result.current.settings.equipped).toEqual([10, 20]);
  });

  it('мержит серверные поля с локальными настройками из localStorage', async () => {
    localStorage.setItem(
      `character_dashboard_${groupId}_${characterId}`,
      JSON.stringify({ fields: ['luck'], items: [5], equipped: [], pinnedSkills: [] })
    );

    mockGroupAPI.getCharacterResources.mockResolvedValue(['hp']);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 'hp' с сервера + 'luck' из localStorage
    expect(result.current.settings.fields).toContain('hp');
    expect(result.current.settings.fields).toContain('luck');
  });

  it('toggleField добавляет и убирает поле', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleField('mana'));
    expect(result.current.settings.fields).toContain('mana');

    act(() => result.current.toggleField('mana'));
    expect(result.current.settings.fields).not.toContain('mana');
  });

  it('toggleItem добавляет и убирает ID предмета', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleItem(7));
    expect(result.current.settings.items).toContain(7);

    act(() => result.current.toggleItem(7));
    expect(result.current.settings.items).not.toContain(7);
  });

  it('toggleEquipped вызывает equipItem и оптимистично обновляет equipped', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleEquipped(1);
    });

    expect(mockEquipmentAPI.equipItem).toHaveBeenCalledWith(groupId, characterId, 1);
    expect(result.current.settings.equipped).toEqual([1]);
  });

  it('toggleEquipped вызывает unequipItem когда предмет уже экипирован', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([1]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleEquipped(1);
    });

    expect(mockEquipmentAPI.unequipItem).toHaveBeenCalledWith(groupId, characterId, 1);
    expect(result.current.settings.equipped).toEqual([]);
  });

  it('togglePinnedSkill добавляет и убирает скилл', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.togglePinnedSkill(99));
    expect(result.current.settings.pinnedSkills).toContain(99);

    act(() => result.current.togglePinnedSkill(99));
    expect(result.current.settings.pinnedSkills).not.toContain(99);
  });

  it('isFieldOnDashboard возвращает корректный boolean', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue(['hp']);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFieldOnDashboard('hp')).toBe(true);
    expect(result.current.isFieldOnDashboard('mana')).toBe(false);
  });

  it('isItemResource возвращает корректный boolean', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Сначала добавим предмет
    act(() => result.current.toggleItem(5));
    expect(result.current.isItemResource(5)).toBe(true);
    expect(result.current.isItemResource(99)).toBe(false);
  });

  it('isSkillPinned возвращает корректный boolean', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.togglePinnedSkill(10));
    expect(result.current.isSkillPinned(10)).toBe(true);
    expect(result.current.isSkillPinned(20)).toBe(false);
  });

  it('saveEquippedOrder вызывает putEquipment и обновляет список', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);
    mockEquipmentAPI.putEquipment.mockResolvedValue([5, 6]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveEquippedOrder([5, 6]);
    });

    expect(mockEquipmentAPI.putEquipment).toHaveBeenCalledWith(groupId, characterId, [5, 6]);
    expect(result.current.settings.equipped).toEqual([5, 6]);
  });

  it('загрузка работает при ошибке API ресурсов', async () => {
    mockGroupAPI.getCharacterResources.mockRejectedValue(new Error('API error'));
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.baseResourceFields).toEqual([]);
  });
});
