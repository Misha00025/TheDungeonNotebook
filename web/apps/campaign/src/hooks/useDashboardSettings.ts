import { useState, useEffect, useCallback } from 'react';
import { DashboardSettings } from '../types/dashboardSettings';
import { groupAPI, characterEquipmentAPI } from '../services/api';

const STORAGE_KEY = (gid: number, cid: number) => `character_dashboard_${gid}_${cid}`;

const defaultSettings: DashboardSettings = {
  fields: [],
  items: [],
  equipped: [],
  pinnedSkills: [],
};

export function useDashboardSettings(groupId: number, characterId: number) {
  const [settings, setSettings] = useState<DashboardSettings>(defaultSettings);
  const [baseResourceFields, setBaseResourceFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      let baseFields: string[] = [];
      try {
        baseFields = await groupAPI.getCharacterResources(groupId);
      } catch (err) {
        console.error('Failed to load character resources:', err);
      }

      let serverEquipped: number[] = [];
      try {
        serverEquipped = await characterEquipmentAPI.getEquipment(groupId, characterId);
      } catch (err) {
        console.error('Failed to load equipment:', err);
      }

      let localSettings = defaultSettings;
      const saved = localStorage.getItem(STORAGE_KEY(groupId, characterId));
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          localSettings = {
            fields: Array.isArray(parsed.fields) ? parsed.fields : [],
            items: Array.isArray(parsed.items) ? parsed.items : [],
            equipped: Array.isArray(parsed.equipped) ? parsed.equipped : [],
            pinnedSkills: Array.isArray(parsed.pinnedSkills) ? parsed.pinnedSkills : [],
          };
        } catch {
          localSettings = defaultSettings;
        }
      }

      if (!cancelled) {
        setBaseResourceFields(baseFields);

        const mergedFields = baseFields.concat(
  localSettings.fields.filter(f => !baseFields.includes(f))
);

        const mergedSettings: DashboardSettings = {
          ...localSettings,
          fields: mergedFields,
          equipped: Array.isArray(serverEquipped) ? serverEquipped : [],
        };

        setSettings(mergedSettings);

        localStorage.setItem(STORAGE_KEY(groupId, characterId), JSON.stringify(mergedSettings));

        setLoading(false);
      }
    };

    load();

    return () => { cancelled = true; };
  }, [groupId, characterId]);

  const saveSettings = useCallback((newSettings: DashboardSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY(groupId, characterId), JSON.stringify(newSettings));
  }, [groupId, characterId]);

  const toggleField = useCallback((fieldKey: string) => {
    setSettings(prev => {
      const fields = prev.fields.includes(fieldKey)
        ? prev.fields.filter(k => k !== fieldKey)
        : [...prev.fields, fieldKey];
      const next = { ...prev, fields };
      localStorage.setItem(STORAGE_KEY(groupId, characterId), JSON.stringify(next));
      return next;
    });
  }, [groupId, characterId]);

  const toggleItem = useCallback((itemId: number) => {
    setSettings(prev => {
      const items = prev.items.includes(itemId)
        ? prev.items.filter(id => id !== itemId)
        : [...prev.items, itemId];
      const next = { ...prev, items };
      localStorage.setItem(STORAGE_KEY(groupId, characterId), JSON.stringify(next));
      return next;
    });
  }, [groupId, characterId]);

  const toggleEquipped = useCallback(async (itemId: number) => {
    const wasEquipped = settings.equipped.includes(itemId);
    const nextEquipped = wasEquipped
      ? settings.equipped.filter(id => id !== itemId)
      : [...settings.equipped, itemId];

    setSettings(prev => {
      const next = { ...prev, equipped: nextEquipped };
      localStorage.setItem(STORAGE_KEY(groupId, characterId), JSON.stringify(next));
      return next;
    });

    try {
      if (wasEquipped) {
        await characterEquipmentAPI.unequipItem(groupId, characterId, itemId);
      } else {
        await characterEquipmentAPI.equipItem(groupId, characterId, itemId);
      }
    } catch (err) {
      console.error('Failed to update equipment:', err);
      setSettings(prev => {
        const next = { ...prev, equipped: settings.equipped };
        localStorage.setItem(STORAGE_KEY(groupId, characterId), JSON.stringify(next));
        return next;
      });
    }
  }, [groupId, characterId, settings.equipped]);

  const saveEquippedOrder = useCallback(async (itemIds: number[]) => {
    try {
      const updatedEquipment = await characterEquipmentAPI.putEquipment(groupId, characterId, itemIds);
      setSettings(prev => {
        const next = { ...prev, equipped: updatedEquipment };
        localStorage.setItem(STORAGE_KEY(groupId, characterId), JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error('Failed to save equipment order:', err);
    }
  }, [groupId, characterId]);

  const togglePinnedSkill = useCallback((skillId: number) => {
    setSettings(prev => {
      const pinnedSkills = prev.pinnedSkills.includes(skillId)
        ? prev.pinnedSkills.filter(id => id !== skillId)
        : [...prev.pinnedSkills, skillId];
      const next = { ...prev, pinnedSkills };
      localStorage.setItem(STORAGE_KEY(groupId, characterId), JSON.stringify(next));
      return next;
    });
  }, [groupId, characterId]);

  const isFieldOnDashboard = useCallback((fieldKey: string) => settings.fields.includes(fieldKey), [settings.fields]);
  const isItemResource = useCallback((itemId: number) => settings.items.includes(itemId), [settings.items]);
  const isItemEquipped = useCallback((itemId: number) => settings.equipped.includes(itemId), [settings.equipped]);
  const isSkillPinned = useCallback((skillId: number) => settings.pinnedSkills.includes(skillId), [settings.pinnedSkills]);

  return {
    settings,
    saveSettings,
    baseResourceFields,
    loading,
    toggleField,
    toggleItem,
    toggleEquipped,
    saveEquippedOrder,
    togglePinnedSkill,
    isFieldOnDashboard,
    isItemResource,
    isItemEquipped,
    isSkillPinned,
  };
}
