export const diagnosticMessage = (code: string) => code === 'unknown_reference'
  ? 'Источник значения недоступен.'
  : code === 'formula_error'
    ? 'Не удалось вычислить значение.'
    : 'Не удалось получить значение.';
