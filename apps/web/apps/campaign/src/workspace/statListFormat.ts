import Decimal from 'decimal.js';
import jsep from 'jsep';
import { isLosslessNumber } from 'lossless-json';
import type { JsonValue } from './types';
import { displayValue } from './json';

const Arithmetic = Decimal.clone({ precision: 64 });
type Ast = { type: string; [key: string]: unknown };
type Slot = { kind: 'text'; value: string } | { kind: 'value'; index: number; signed: boolean };
type CompiledExpression = { ast?: Ast; error?: string };

function validate(node: Ast): void {
  if (node.type === 'Literal') {
    if (typeof node.raw !== 'string' || !/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(node.raw)) throw new Error('В выражении разрешены только числа.');
    return;
  }
  if (node.type === 'Identifier' && node.name === '$0') return;
  if (node.type === 'UnaryExpression' && (node.operator === '+' || node.operator === '-')) { validate(node.argument as Ast); return; }
  if (node.type === 'BinaryExpression' && ['+', '-', '*', '/', '%'].includes(String(node.operator))) {
    validate(node.left as Ast); validate(node.right as Ast); return;
  }
  if (node.type === 'CallExpression') {
    const callee = node.callee as Ast;
    const allowed: Record<string, [number, number]> = { floor: [1, 1], ceil: [1, 1], round: [1, 1], abs: [1, 1], min: [1, Infinity], max: [1, Infinity] };
    const arity = typeof callee.name === 'string' && Object.prototype.hasOwnProperty.call(allowed, callee.name) ? allowed[callee.name] : undefined;
    const args = node.arguments as Ast[];
    if (callee.type !== 'Identifier' || !arity || args.length < arity[0] || args.length > arity[1]) throw new Error('Вызов функции не поддерживается или имеет неверное число аргументов.');
    args.forEach(validate); return;
  }
  throw new Error('В выражении обнаружена неподдерживаемая операция.');
}

function numeric(value: JsonValue): Decimal {
  if (typeof value !== 'number' && !isLosslessNumber(value)) throw new Error('Для вычисления требуется числовое значение.');
  const result = new Arithmetic(String(value));
  if (!result.isFinite()) throw new Error('Результат выражения не является конечным числом.');
  return result;
}

function evaluate(node: Ast, value: JsonValue): Decimal {
  if (node.type === 'Literal') return new Arithmetic(String(node.raw));
  if (node.type === 'Identifier') return numeric(value);
  if (node.type === 'UnaryExpression') {
    const number = evaluate(node.argument as Ast, value);
    return node.operator === '-' ? number.negated() : number;
  }
  if (node.type === 'BinaryExpression') {
    const left = evaluate(node.left as Ast, value); const right = evaluate(node.right as Ast, value);
    switch (node.operator) {
      case '+': return left.plus(right); case '-': return left.minus(right); case '*': return left.times(right);
      case '/': if (right.isZero()) throw new Error('Деление на ноль.'); return left.div(right);
      case '%': if (right.isZero()) throw new Error('Деление на ноль.'); return left.mod(right);
    }
  }
  if (node.type === 'CallExpression') {
    const name = String((node.callee as Ast).name);
    const args = (node.arguments as Ast[]).map(argument => evaluate(argument, value));
    if (name === 'floor') return args[0].floor();
    if (name === 'ceil') return args[0].ceil();
    if (name === 'round') return args[0].toDecimalPlaces(0, Arithmetic.ROUND_HALF_UP);
    if (name === 'abs') return args[0].abs();
    return args.slice(1).reduce((result, item) => name === 'min' ? Arithmetic.min(result, item) : Arithmetic.max(result, item), args[0]);
  }
  throw new Error('Не удалось вычислить выражение.');
}

function compileExpression(expression: string | null): CompiledExpression {
  if (expression === null || expression.trim() === '') return { error: 'Выражение не задано.' };
  let ast: Ast;
  try { ast = jsep(expression) as unknown as Ast; }
  catch { return { error: 'Некорректное выражение.' }; }
  try { validate(ast); return { ast }; }
  catch (error) { return { error: error instanceof Error ? error.message : 'Некорректное выражение.' }; }
}

type ConditionValue = Decimal | string | boolean | null;
type CompiledCondition = { ast?: Ast; error?: string };

function finiteConditionNumber(value: Decimal): Decimal {
  if (!value.isFinite()) throw new Error('Результат условия не является конечным числом.');
  return value;
}

function validateCondition(node: Ast): void {
  if (node.type === 'Literal') {
    if (typeof node.raw === 'string' && /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(node.raw)) return;
    if (node.value === null || typeof node.value === 'boolean' || typeof node.value === 'string') return;
    throw new Error('В условии обнаружено неподдерживаемое значение.');
  }
  if (node.type === 'Identifier' && node.name === '$0') return;
  if (node.type === 'UnaryExpression' && ['+', '-', '!'].includes(String(node.operator))) { validateCondition(node.argument as Ast); return; }
  if (node.type === 'BinaryExpression') {
    if (['+', '-', '*', '/', '%'].includes(String(node.operator))) { validate(node); return; }
    if (['>', '>=', '<', '<=', '==', '!=', '===', '!==', '&&', '||'].includes(String(node.operator))) {
      validateCondition(node.left as Ast); validateCondition(node.right as Ast); return;
    }
  }
  if (node.type === 'CallExpression') { validate(node); return; }
  throw new Error('В условии обнаружена неподдерживаемая операция или переменная.');
}

function conditionValue(node: Ast, value: JsonValue): ConditionValue {
  if (node.type === 'Literal') {
    if (typeof node.raw === 'string' && /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(node.raw)) return finiteConditionNumber(new Arithmetic(node.raw));
    return node.value as string | boolean | null;
  }
  if (node.type === 'Identifier') {
    if (typeof value === 'number' || isLosslessNumber(value)) return numeric(value);
    if (typeof value === 'string' || typeof value === 'boolean' || value === null) return value;
    throw new Error('Для условия поддерживаются только простые значения характеристики.');
  }
  if (node.type === 'CallExpression' || node.type === 'BinaryExpression' && ['+', '-', '*', '/', '%'].includes(String(node.operator)) || node.type === 'UnaryExpression' && ['+', '-'].includes(String(node.operator))) return finiteConditionNumber(evaluate(node, value));
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    const operand = conditionValue(node.argument as Ast, value);
    if (typeof operand !== 'boolean') throw new Error('Оператор ! требует логическое значение.');
    return !operand;
  }
  if (node.type === 'BinaryExpression') {
    const operator = String(node.operator);
    const left = conditionValue(node.left as Ast, value);
    if (operator === '&&' || operator === '||') {
      if (typeof left !== 'boolean') throw new Error('Логические операторы требуют логические значения.');
      if (operator === '&&' && !left) return false;
      if (operator === '||' && left) return true;
      const right = conditionValue(node.right as Ast, value);
      if (typeof right !== 'boolean') throw new Error('Логические операторы требуют логические значения.');
      return right;
    }
    const right = conditionValue(node.right as Ast, value);
    if (['>', '>=', '<', '<='].includes(operator)) {
      if (!(left instanceof Arithmetic) || !(right instanceof Arithmetic)) throw new Error('Сравнение >, >=, < и <= требует числовые значения.');
      if (operator === '>') return left.greaterThan(right);
      if (operator === '>=') return left.greaterThanOrEqualTo(right);
      if (operator === '<') return left.lessThan(right);
      return left.lessThanOrEqualTo(right);
    }
    const equal = left instanceof Arithmetic && right instanceof Arithmetic ? left.eq(right) : typeof left === typeof right && left === right;
    return operator === '==' || operator === '===' ? equal : !equal;
  }
  throw new Error('Не удалось вычислить условие.');
}

function compileCondition(condition: string): CompiledCondition {
  if (!condition.trim()) return {};
  let ast: Ast;
  try { ast = jsep(condition) as unknown as Ast; }
  catch { return { error: 'Некорректное условие.' }; }
  try { validateCondition(ast); return { ast }; }
  catch (error) { return { error: error instanceof Error ? error.message : 'Некорректное условие.' }; }
}

export function compileStatListCondition(condition: string) {
  const compiled = compileCondition(condition);
  return {
    error: compiled.error,
    test(value: JsonValue): { matches: boolean; error?: string } {
      if (!compiled.ast) return { matches: true, ...(compiled.error ? { error: compiled.error } : {}) };
      try {
        const result = conditionValue(compiled.ast, value);
        if (typeof result !== 'boolean') throw new Error('Условие должно возвращать логическое значение.');
        return { matches: result };
      } catch (error) { return { matches: true, error: error instanceof Error ? error.message : 'Не удалось вычислить условие.' }; }
    },
  };
}

export function compileStatListFormat(format: string, expressions: (string | null)[]) {
  const compiled = expressions.map(compileExpression);
  const expressionErrors = compiled.map(item => item.error);
  const slots: Slot[] = [];
  let literal = '';
  for (let cursor = 0; cursor < format.length;) {
    if (format[cursor] !== '$') { literal += format[cursor++]; continue; }
    if (format.startsWith('$$', cursor)) { literal += '$'; cursor += 2; continue; }
    const token = /^\$(\d+)|^\$\{(\d+):s\}/.exec(format.slice(cursor));
    if (!token) return { expressionErrors, error: 'Некорректная вставка формата.', render: (_value: JsonValue) => ({ error: 'Некорректная вставка формата.' }) };
    if (literal) { slots.push({ kind: 'text', value: literal }); literal = ''; }
    const index = Number(token[1] ?? token[2]);
    if (!Number.isSafeInteger(index) || index < 0) return { expressionErrors, error: 'Некорректный индекс вставки.', render: (_value: JsonValue) => ({ error: 'Некорректный индекс вставки.' }) };
    slots.push({ kind: 'value', index, signed: token[2] !== undefined }); cursor += token[0].length;
  }
  if (literal) slots.push({ kind: 'text', value: literal });
  const badReference = slots.find((slot): slot is Extract<Slot, { kind: 'value' }> => slot.kind === 'value' && slot.index > 0 && (!compiled[slot.index - 1] || !compiled[slot.index - 1].ast));
  const formatError = badReference ? `Выражение $${badReference.index} недоступно или некорректно.` : undefined;
  return {
    expressionErrors,
    error: formatError,
    render(value: JsonValue, displayText?: string): { text: string } | { error: string } {
      if (formatError) return { error: formatError };
      try {
        const parts = slots.map(slot => {
          if (slot.kind === 'text') return slot.value;
          if (slot.index === 0) {
            if (slot.signed) { const number = numeric(value); return number.isNegative() && !number.isZero() ? number.toFixed() : `+${number.toFixed()}`; }
            return displayText ?? (value === '' ? "''" : displayValue(value));
          }
          const result = evaluate(compiled[slot.index - 1].ast!, value);
          if (!result.isFinite()) throw new Error('Результат выражения не является конечным числом.');
          if (slot.signed) return result.isNegative() && !result.isZero() ? result.toFixed() : `+${result.toFixed()}`;
          return result.toFixed();
        });
        return { text: parts.join('') };
      } catch (error) { return { error: error instanceof Error ? error.message : 'Не удалось вычислить формат.' }; }
    },
  };
}
