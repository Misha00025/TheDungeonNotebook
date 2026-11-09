const ALLOWED_CHARS = /^[0-9.+\-*/%^() ]+$/;

type Token =
  | { type: 'number'; value: number }
  | { type: 'op'; value: string; precedence: number; rightAssoc: boolean };

const PRECEDENCE: Record<string, number> = {
  '+': 2,
  '-': 2,
  '*': 3,
  '/': 3,
  '%': 3,
  '^': 4,
};

const RIGHT_ASSOC: Record<string, boolean> = {
  '^': true,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ') { i++; continue; }
    if ('+-*/%^()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, precedence: PRECEDENCE[ch] || 0, rightAssoc: RIGHT_ASSOC[ch] || false });
      i++;
    } else if (ch === '.' || (ch >= '0' && ch <= '9')) {
      let num = '';
      while (i < input.length && (input[i] === '.' || (input[i] >= '0' && input[i] <= '9'))) {
        num += input[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
    } else {
      return [];
    }
  }
  return tokens;
}

function shuntingYard(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const ops: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token);
    } else {
      if (token.value === '(') {
        ops.push(token);
      } else if (token.value === ')') {
        while (ops.length > 0 && ops[ops.length - 1].value !== '(') {
          output.push(ops.pop()!);
        }
        ops.pop();
      } else {
        while (
          ops.length > 0 &&
          ops[ops.length - 1].value !== '(' &&
          ((ops[ops.length - 1] as any).precedence > (token as any).precedence ||
            ((ops[ops.length - 1] as any).precedence === (token as any).precedence && !(token as any).rightAssoc))
        ) {
          output.push(ops.pop()!);
        }
        ops.push(token);
      }
    }
  }

  while (ops.length > 0) {
    output.push(ops.pop()!);
  }

  return output;
}

function evaluatePostfix(tokens: Token[]): number {
  const stack: number[] = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      stack.push(token.value);
    } else {
      const b = stack.pop()!;
      const a = stack.pop()!;
      switch (token.value) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(a / b); break;
        case '%': stack.push(a % b); break;
        case '^': stack.push(Math.pow(a, b)); break;
      }
    }
  }

  return stack[0];
}

export function evaluateExpression(input: string): number {
  if (input === '' || input === null || input === undefined) return NaN;

  const trimmed = input.trim();

  if (!ALLOWED_CHARS.test(trimmed)) return NaN;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return NaN;

  const rpn = shuntingYard(tokens);
  if (rpn.length === 0) return NaN;

  return evaluatePostfix(rpn);
}
