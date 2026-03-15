export type RuleExpressionBinaryOperator =
  | '||'
  | '&&'
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | '+'
  | '-'
  | '*'
  | '/'
  | '%';

export type RuleExpressionUnaryOperator = '!' | '-';

export interface RuleLiteralNode {
  kind: 'literal';
  value: string | number | boolean | null;
}

export interface RuleIdentifierNode {
  kind: 'identifier';
  name: string;
}

export interface RuleArrayNode {
  kind: 'array';
  items: RuleExpressionNode[];
}

export interface RuleMemberNode {
  kind: 'member';
  object: RuleExpressionNode;
  property: RuleExpressionNode;
  computed: boolean;
}

export interface RuleUnaryNode {
  kind: 'unary';
  operator: RuleExpressionUnaryOperator;
  argument: RuleExpressionNode;
}

export interface RuleBinaryNode {
  kind: 'binary';
  operator: RuleExpressionBinaryOperator;
  left: RuleExpressionNode;
  right: RuleExpressionNode;
}

export type RuleExpressionNode =
  | RuleLiteralNode
  | RuleIdentifierNode
  | RuleArrayNode
  | RuleMemberNode
  | RuleUnaryNode
  | RuleBinaryNode;

interface Token {
  type: 'identifier' | 'number' | 'string' | 'operator' | 'punctuation' | 'eof';
  value: string;
  position: number;
}

class Tokenizer {
  private readonly input: string;
  private index = 0;

  constructor(input: string) {
    this.input = input;
  }

  nextToken(): Token {
    this.skipWhitespace();

    if (this.index >= this.input.length) {
      return {
        type: 'eof',
        value: '',
        position: this.index,
      };
    }

    const position = this.index;
    const current = this.input[this.index];

    if (this.isIdentifierStart(current)) {
      let value = current;
      this.index += 1;

      while (this.index < this.input.length && this.isIdentifierPart(this.input[this.index])) {
        value += this.input[this.index];
        this.index += 1;
      }

      return {
        type: 'identifier',
        value,
        position,
      };
    }

    if (this.isDigit(current)) {
      let value = current;
      this.index += 1;

      while (this.index < this.input.length && this.isDigit(this.input[this.index])) {
        value += this.input[this.index];
        this.index += 1;
      }

      if (this.input[this.index] === '.') {
        value += '.';
        this.index += 1;

        while (this.index < this.input.length && this.isDigit(this.input[this.index])) {
          value += this.input[this.index];
          this.index += 1;
        }
      }

      return {
        type: 'number',
        value,
        position,
      };
    }

    if (current === '"' || current === '\'') {
      const quote = current;
      this.index += 1;
      let value = '';

      while (this.index < this.input.length) {
        const char = this.input[this.index];
        if (char === '\\') {
          const escaped = this.input[this.index + 1];
          if (!escaped) {
            throw new Error(`Unterminated string at position ${position}`);
          }

          value += escaped;
          this.index += 2;
          continue;
        }

        if (char === quote) {
          this.index += 1;
          return {
            type: 'string',
            value,
            position,
          };
        }

        value += char;
        this.index += 1;
      }

      throw new Error(`Unterminated string at position ${position}`);
    }

    const twoCharacterOperator = this.input.slice(this.index, this.index + 2);
    if (['&&', '||', '==', '!=', '>=', '<='].includes(twoCharacterOperator)) {
      this.index += 2;
      return {
        type: 'operator',
        value: twoCharacterOperator,
        position,
      };
    }

    if (['!', '>', '<', '+', '-', '*', '/', '%'].includes(current)) {
      this.index += 1;
      return {
        type: 'operator',
        value: current,
        position,
      };
    }

    if (['(', ')', '.', '[', ']', ',',].includes(current)) {
      this.index += 1;
      return {
        type: 'punctuation',
        value: current,
        position,
      };
    }

    throw new Error(`Unexpected token "${current}" at position ${position}`);
  }

  private skipWhitespace(): void {
    while (this.index < this.input.length && /\s/.test(this.input[this.index])) {
      this.index += 1;
    }
  }

  private isIdentifierStart(char: string): boolean {
    return /[A-Za-z_]/.test(char);
  }

  private isIdentifierPart(char: string): boolean {
    return /[A-Za-z0-9_]/.test(char);
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }
}

class Parser {
  private readonly tokens: Token[] = [];
  private pointer = 0;

  constructor(input: string) {
    const tokenizer = new Tokenizer(input);
    while (true) {
      const token = tokenizer.nextToken();
      this.tokens.push(token);
      if (token.type === 'eof') {
        break;
      }
    }
  }

  parse(): RuleExpressionNode {
    const expression = this.parseLogicalOr();
    this.expect('eof');
    return expression;
  }

  private parseLogicalOr(): RuleExpressionNode {
    let node = this.parseLogicalAnd();

    while (this.match('operator', '||')) {
      node = {
        kind: 'binary',
        operator: '||',
        left: node,
        right: this.parseLogicalAnd(),
      };
    }

    return node;
  }

  private parseLogicalAnd(): RuleExpressionNode {
    let node = this.parseEquality();

    while (this.match('operator', '&&')) {
      node = {
        kind: 'binary',
        operator: '&&',
        left: node,
        right: this.parseEquality(),
      };
    }

    return node;
  }

  private parseEquality(): RuleExpressionNode {
    let node = this.parseComparison();

    while (true) {
      if (this.match('operator', '==')) {
        node = {
          kind: 'binary',
          operator: '==',
          left: node,
          right: this.parseComparison(),
        };
        continue;
      }

      if (this.match('operator', '!=')) {
        node = {
          kind: 'binary',
          operator: '!=',
          left: node,
          right: this.parseComparison(),
        };
        continue;
      }

      break;
    }

    return node;
  }

  private parseComparison(): RuleExpressionNode {
    let node = this.parseTerm();

    while (true) {
      const token = this.peek();
      if (!token || token.type !== 'operator') {
        break;
      }

      if (!['>', '>=', '<', '<='].includes(token.value)) {
        break;
      }

      this.pointer += 1;
      node = {
        kind: 'binary',
        operator: token.value as RuleExpressionBinaryOperator,
        left: node,
        right: this.parseTerm(),
      };
    }

    return node;
  }

  private parseTerm(): RuleExpressionNode {
    let node = this.parseFactor();

    while (true) {
      const token = this.peek();
      if (!token || token.type !== 'operator') {
        break;
      }

      if (!['+', '-'].includes(token.value)) {
        break;
      }

      this.pointer += 1;
      node = {
        kind: 'binary',
        operator: token.value as RuleExpressionBinaryOperator,
        left: node,
        right: this.parseFactor(),
      };
    }

    return node;
  }

  private parseFactor(): RuleExpressionNode {
    let node = this.parseUnary();

    while (true) {
      const token = this.peek();
      if (!token || token.type !== 'operator') {
        break;
      }

      if (!['*', '/', '%'].includes(token.value)) {
        break;
      }

      this.pointer += 1;
      node = {
        kind: 'binary',
        operator: token.value as RuleExpressionBinaryOperator,
        left: node,
        right: this.parseUnary(),
      };
    }

    return node;
  }

  private parseUnary(): RuleExpressionNode {
    const token = this.peek();
    if (token?.type === 'operator' && (token.value === '!' || token.value === '-')) {
      this.pointer += 1;
      return {
        kind: 'unary',
        operator: token.value as RuleExpressionUnaryOperator,
        argument: this.parseUnary(),
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): RuleExpressionNode {
    const token = this.peek();

    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    if (token.type === 'number') {
      this.pointer += 1;
      return {
        kind: 'literal',
        value: Number(token.value),
      };
    }

    if (token.type === 'string') {
      this.pointer += 1;
      return {
        kind: 'literal',
        value: token.value,
      };
    }

    if (token.type === 'identifier') {
      this.pointer += 1;
      let node: RuleExpressionNode;
      if (token.value === 'true') {
        node = { kind: 'literal', value: true };
      } else if (token.value === 'false') {
        node = { kind: 'literal', value: false };
      } else if (token.value === 'null') {
        node = { kind: 'literal', value: null };
      } else {
        node = {
          kind: 'identifier',
          name: token.value,
        };
      }

      return this.parseMemberChain(node);
    }

    if (this.match('punctuation', '(')) {
      const expression = this.parseLogicalOr();
      this.expect('punctuation', ')');
      return this.parseMemberChain(expression);
    }

    if (this.match('punctuation', '[')) {
      const items: RuleExpressionNode[] = [];

      if (!this.match('punctuation', ']')) {
        do {
          items.push(this.parseLogicalOr());
        } while (this.match('punctuation', ','));
        this.expect('punctuation', ']');
      }

      return {
        kind: 'array',
        items,
      };
    }

    throw new Error(`Unexpected token "${token.value}" at position ${token.position}`);
  }

  private parseMemberChain(base: RuleExpressionNode): RuleExpressionNode {
    let node = base;

    while (true) {
      if (this.match('punctuation', '.')) {
        const identifier = this.expect('identifier');
        node = {
          kind: 'member',
          object: node,
          property: {
            kind: 'literal',
            value: identifier.value,
          },
          computed: false,
        };
        continue;
      }

      if (this.match('punctuation', '[')) {
        const property = this.parseLogicalOr();
        this.expect('punctuation', ']');
        node = {
          kind: 'member',
          object: node,
          property,
          computed: true,
        };
        continue;
      }

      break;
    }

    return node;
  }

  private match(type: Token['type'], value?: string): boolean {
    const token = this.peek();
    if (!token || token.type !== type) {
      return false;
    }

    if (value !== undefined && token.value !== value) {
      return false;
    }

    this.pointer += 1;
    return true;
  }

  private expect(type: Token['type'], value?: string): Token {
    const token = this.peek();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      const found = token ? `"${token.value}"` : 'end of input';
      throw new Error(`Expected ${value ?? type} but found ${found}`);
    }

    this.pointer += 1;
    return token;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pointer];
  }
}

export function parseRuleExpression(expression: string): RuleExpressionNode {
  return new Parser(expression).parse();
}

function evaluateBinaryExpression(
  operator: RuleExpressionBinaryOperator,
  left: unknown,
  right: unknown,
): unknown {
  switch (operator) {
    case '||':
      return Boolean(left) || Boolean(right);
    case '&&':
      return Boolean(left) && Boolean(right);
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return (left as number | string) > (right as number | string);
    case '>=':
      return (left as number | string) >= (right as number | string);
    case '<':
      return (left as number | string) < (right as number | string);
    case '<=':
      return (left as number | string) <= (right as number | string);
    case '+':
      if (typeof left === 'string' || typeof right === 'string') {
        return `${left ?? ''}${right ?? ''}`;
      }

      return Number(left) + Number(right);
    case '-':
      return Number(left) - Number(right);
    case '*':
      return Number(left) * Number(right);
    case '/':
      return Number(left) / Number(right);
    case '%':
      return Number(left) % Number(right);
    default:
      return undefined;
  }
}

export function evaluateRuleExpressionAst(
  node: RuleExpressionNode,
  context: Record<string, unknown>,
): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'identifier':
      return context[node.name];
    case 'array':
      return node.items.map((item) => evaluateRuleExpressionAst(item, context));
    case 'member': {
      const object = evaluateRuleExpressionAst(node.object, context);
      if (object === null || object === undefined) {
        return undefined;
      }

      const property = evaluateRuleExpressionAst(node.property, context);
      if (typeof property !== 'string' && typeof property !== 'number') {
        return undefined;
      }

      return (object as Record<string, unknown>)[property];
    }
    case 'unary': {
      const argument = evaluateRuleExpressionAst(node.argument, context);
      if (node.operator === '!') {
        return !argument;
      }

      return -Number(argument);
    }
    case 'binary':
      return evaluateBinaryExpression(
        node.operator,
        evaluateRuleExpressionAst(node.left, context),
        evaluateRuleExpressionAst(node.right, context),
      );
    default:
      return undefined;
  }
}

export function evaluateRuleExpression(
  expression: string,
  context: Record<string, unknown>,
): unknown {
  return evaluateRuleExpressionAst(parseRuleExpression(expression), context);
}

export function evaluateRuleBooleanExpression(
  expression: string,
  context: Record<string, unknown>,
): boolean {
  return Boolean(evaluateRuleExpression(expression, context));
}

export function evaluateRuleNumericExpression(
  expression: string,
  context: Record<string, unknown>,
): number {
  const result = evaluateRuleExpression(expression, context);
  if (typeof result !== 'number' || Number.isNaN(result)) {
    throw new Error(`Expression "${expression}" did not evaluate to a valid number`);
  }

  return result;
}
