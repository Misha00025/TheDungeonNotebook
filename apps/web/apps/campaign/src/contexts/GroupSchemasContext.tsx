import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { GroupSchema, TemplateSchema } from '../types/groupSchemas';
import { CharacterTemplate } from '../types/characterTemplates';
import { groupAPI, characterTemplatesAPI } from '../services/api';

const SCHEMA_TTL_MS = 300_000;

interface GroupSchemasContextType {
  itemsSchema: GroupSchema;
  skillsSchema: GroupSchema;
  template: CharacterTemplate | null;
  templateSchema: TemplateSchema;
  loading: boolean;
  error: string | null;
  refreshSchemas: () => Promise<void>;
  refreshItemsSchema: () => Promise<void>;
  refreshSkillsSchema: () => Promise<void>;
  refreshTemplate: () => Promise<void>;
  refreshTemplateSchema: () => Promise<void>;
}

interface GroupSchemasProviderProps {
  groupId: number;
  children: React.ReactNode;
}

const GroupSchemasContext = createContext<GroupSchemasContextType | null>(null);

const initialItemsSchema: GroupSchema = { type: 'items', groupBy: [] };
const initialSkillsSchema: GroupSchema = { type: 'skills', groupBy: [] };
const initialTemplateSchema: TemplateSchema = { categories: [] };

const GroupSchemasProvider: React.FC<GroupSchemasProviderProps> = ({
  groupId,
  children,
}) => {
  const [itemsSchema, setItemsSchema] = useState<GroupSchema>(initialItemsSchema);
  const [skillsSchema, setSkillsSchema] = useState<GroupSchema>(initialSkillsSchema);
  const [template, setTemplate] = useState<CharacterTemplate | null>(null);
  const [templateSchema, setTemplateSchema] = useState<TemplateSchema>(initialTemplateSchema);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [itemsSchemaLoadedAt, setItemsSchemaLoadedAt] = useState<number | null>(null);
  const [skillsSchemaLoadedAt, setSkillsSchemaLoadedAt] = useState<number | null>(null);
  const [templateLoadedAt, setTemplateLoadedAt] = useState<number | null>(null);
  const [templateSchemaLoadedAt, setTemplateSchemaLoadedAt] = useState<number | null>(null);

  const isStale = (loadedAt: number | null): boolean => {
    if (!loadedAt) return true;
    return Date.now() - loadedAt > SCHEMA_TTL_MS;
  };

  const loadItemsSchema = useCallback(async () => {
    try {
      const data = await groupAPI.getItemsSchema(groupId);
      setItemsSchema(data);
      setItemsSchemaLoadedAt(Date.now());
      setError(null);
    } catch (err) {
      console.error('Failed to load items schema:', err);
    }
  }, [groupId]);

  const loadSkillsSchema = useCallback(async () => {
    try {
      const data = await groupAPI.getSkillsSchema(groupId);
      setSkillsSchema(data);
      setSkillsSchemaLoadedAt(Date.now());
      setError(null);
    } catch (err) {
      console.error('Failed to load skills schema:', err);
    }
  }, [groupId]);

  const loadTemplate = useCallback(async () => {
    try {
      const templates = await characterTemplatesAPI.getTemplates(groupId);
      setTemplate(templates.length > 0 ? templates[0] : null);
      setTemplateLoadedAt(Date.now());
      setError(null);
    } catch (err) {
      console.error('Failed to load template:', err);
      setTemplate(null);
    }
  }, [groupId]);

  const loadTemplateSchema = useCallback(async () => {
    try {
      const data = await groupAPI.getTemplateSchema(groupId);
      setTemplateSchema(data);
      setTemplateSchemaLoadedAt(Date.now());
      setError(null);
    } catch (err) {
      console.error('Failed to load template schema:', err);
    }
  }, [groupId]);

  const refreshSchemas = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadItemsSchema(),
        loadSkillsSchema(),
        loadTemplate(),
        loadTemplateSchema(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [loadItemsSchema, loadSkillsSchema, loadTemplate, loadTemplateSchema]);

  const refreshItemsSchema = useCallback(async () => {
    setLoading(true);
    try {
      await loadItemsSchema();
    } finally {
      setLoading(false);
    }
  }, [loadItemsSchema]);

  const refreshSkillsSchema = useCallback(async () => {
    setLoading(true);
    try {
      await loadSkillsSchema();
    } finally {
      setLoading(false);
    }
  }, [loadSkillsSchema]);

  const refreshTemplate = useCallback(async () => {
    setLoading(true);
    try {
      await loadTemplate();
    } finally {
      setLoading(false);
    }
  }, [loadTemplate]);

  const refreshTemplateSchema = useCallback(async () => {
    setLoading(true);
    try {
      await loadTemplateSchema();
    } finally {
      setLoading(false);
    }
  }, [loadTemplateSchema]);

  const ensureLoaded = useCallback(async () => {
    const tasks: Promise<void>[] = [];

    if (isStale(itemsSchemaLoadedAt)) {
      tasks.push(loadItemsSchema());
    }

    if (isStale(skillsSchemaLoadedAt)) {
      tasks.push(loadSkillsSchema());
    }

    if (isStale(templateLoadedAt)) {
      tasks.push(loadTemplate());
    }

    if (isStale(templateSchemaLoadedAt)) {
      tasks.push(loadTemplateSchema());
    }

    if (tasks.length > 0) {
      setLoading(true);
      try {
        await Promise.all(tasks);
      } finally {
        setLoading(false);
      }
    }
  }, [
    itemsSchemaLoadedAt,
    skillsSchemaLoadedAt,
    templateLoadedAt,
    templateSchemaLoadedAt,
    loadItemsSchema,
    loadSkillsSchema,
    loadTemplate,
    loadTemplateSchema,
  ]);

  useEffect(() => {
    ensureLoaded();
  }, [groupId, ensureLoaded]);

  const value = useMemo(
    () => ({
      itemsSchema,
      skillsSchema,
      template,
      templateSchema,
      loading,
      error,
      refreshSchemas,
      refreshItemsSchema,
      refreshSkillsSchema,
      refreshTemplate,
      refreshTemplateSchema,
    }),
    [
      itemsSchema,
      skillsSchema,
      template,
      templateSchema,
      loading,
      error,
      refreshSchemas,
      refreshItemsSchema,
      refreshSkillsSchema,
      refreshTemplate,
      refreshTemplateSchema,
    ],
  );

  return (
    <GroupSchemasContext.Provider value={value}>
      {children}
    </GroupSchemasContext.Provider>
  );
};

const useGroupSchemas = (): GroupSchemasContextType => {
  const ctx = useContext(GroupSchemasContext);
  if (!ctx) {
    throw new Error('useGroupSchemas must be used within a GroupSchemasProvider');
  }
  return ctx;
};

export { useGroupSchemas };
export { GroupSchemasProvider };
