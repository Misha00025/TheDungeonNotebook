export const storage = {
  setSelectedGroupId: (groupId: string) => localStorage.setItem('selectedGroupId', groupId),
  getSelectedGroupId: (): string | null => localStorage.getItem('selectedGroupId'),
  clearSelectedGroupId: () => localStorage.removeItem('selectedGroupId'),
};
