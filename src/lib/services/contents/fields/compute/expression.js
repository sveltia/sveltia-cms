import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { getOrCreateBounded } from '$lib/services/utils/cache';
import { toFixed } from '$lib/services/utils/number';

/**
 * A node of a parsed arithmetic expression.
 * @typedef {{ type: 'number', value: number }
 * | { type: 'tag', index: number }
 * | { type: 'unary', operator: string, operand: ExpressionNode }
 * | { type: 'binary', operator: string, left: ExpressionNode, right: ExpressionNode }
 * | { type: 'call', name: string, args: ExpressionNode[] }} ExpressionNode
 */

/**
 * A parsed arithmetic expression.
 * @typedef {object} ParsedExpression
 * @property {ExpressionNode} [tree] Syntax tree. `undefined` if the expression is invalid.
 * @property {string[]} tags Content of the template tags in the expression, e.g. `fields.price`
 * for `{{fields.price}}`, in the order they appear. A `tag` node refers to one by its index.
 */

/**
 * A token of an arithmetic expression.
 * @typedef {{ type: 'number', value: number }
 * | { type: 'tag', index: number }
 * | { type: 'name', name: string }
 * | { type: 'punctuator', value: string }} ExpressionToken
 */

/**
 * Placeholder standing in for a template tag while the expression is tokenized, so the value the
 * tag resolves to is always a single operand: a field holding `2) * (3` can’t change the structure
 * of the expression. It can’t appear in a template.
 */
const TAG_PLACEHOLDER = '\0';

/**
 * Regular expression matching a token at the current position, preceded by any whitespace.
 */
const TOKEN_REGEX =
  /\s*(?:(?<number>\d+(?:\.\d+)?|\.\d+)|(?<tag>\0)|(?<name>[A-Za-z_]\w*)|(?<punctuator>[-+*/%(),]))/y;

/**
 * Regular expression matching a value a template tag can resolve to as an operand: a decimal
 * number, without the hexadecimal and other notations `Number()` would accept.
 */
const OPERAND_REGEX = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i;

/**
 * Functions available in an expression, with the number of arguments each one accepts.
 * @type {Record<string, { minArgs: number, maxArgs: number, fn: (...args: number[]) => number }>}
 */
const FUNCTIONS = {
  abs: { minArgs: 1, maxArgs: 1, fn: Math.abs },
  ceil: { minArgs: 1, maxArgs: 1, fn: Math.ceil },
  floor: { minArgs: 1, maxArgs: 1, fn: Math.floor },
  max: { minArgs: 1, maxArgs: Infinity, fn: Math.max },
  min: { minArgs: 1, maxArgs: Infinity, fn: Math.min },
  round: {
    minArgs: 1,
    maxArgs: 2,
    /**
     * Round the value to the given number of decimal places.
     * @param {number} value Value.
     * @param {number} [digits] Number of decimal places, which is truncated to an integer. A
     * negative number rounds to tens, hundreds and so on.
     * @returns {number} Rounded value.
     */
    fn: (value, digits = 0) => toFixed(value, Math.trunc(digits)),
  },
};

/**
 * Cache of parsed expressions, keyed by the expression. A Compute field is resolved whenever
 * anything in the draft changes, while its expression only changes with the configuration.
 * @type {Map<string, ParsedExpression>}
 */
const parsedExpressionCache = new Map();

/**
 * Split the given expression into tokens.
 * @param {string} expression Expression with its template tags replaced by
 * {@link TAG_PLACEHOLDER}.
 * @returns {ExpressionToken[] | undefined} Tokens, or `undefined` if the expression has a character
 * that can’t start a token.
 */
const tokenize = (expression) => {
  /** @type {ExpressionToken[]} */
  const tokens = [];
  const regex = new RegExp(TOKEN_REGEX);
  let tagIndex = 0;
  // Only whitespace follows the last token
  const end = expression.trimEnd().length;

  while (regex.lastIndex < end) {
    const groups = regex.exec(expression)?.groups;

    if (!groups) {
      return undefined;
    }

    if (groups.number !== undefined) {
      tokens.push({ type: 'number', value: Number(groups.number) });
    } else if (groups.tag !== undefined) {
      tokens.push({ type: 'tag', index: tagIndex });
      tagIndex += 1;
    } else if (groups.name !== undefined) {
      tokens.push({ type: 'name', name: groups.name });
    } else {
      tokens.push({ type: 'punctuator', value: groups.punctuator });
    }
  }

  return tokens;
};

/**
 * Build a syntax tree from the given tokens with a recursive descent parser. Multiplication,
 * division and remainder bind tighter than addition and subtraction, and operators of the same
 * precedence are evaluated from left to right.
 * @param {ExpressionToken[]} tokens Tokens.
 * @returns {ExpressionNode | undefined} Syntax tree, or `undefined` if the tokens don’t form a
 * valid expression.
 */
const buildTree = (tokens) => {
  let position = 0;

  /**
   * Consume the next token if it’s the given punctuator.
   * @param {string} value Punctuator.
   * @returns {boolean} Whether the token was consumed.
   */
  const accept = (value) => {
    const token = tokens[position];

    if (token?.type === 'punctuator' && token.value === value) {
      position += 1;

      return true;
    }

    return false;
  };

  /**
   * Parse an addition or subtraction, which has the lowest precedence, so it’s a whole expression.
   * It’s assigned once the functions it calls are defined, as an expression in parentheses or a
   * function argument calls it in turn.
   * @type {() => ExpressionNode | undefined}
   */
  let parseAdditive;

  /**
   * Parse a binary operation of the given operators, or a single operand of a higher precedence.
   * @param {string[]} operators Operators.
   * @param {() => ExpressionNode | undefined} parseOperand Function parsing an operand.
   * @returns {ExpressionNode | undefined} Node, or `undefined` if it’s invalid.
   */
  const parseBinary = (operators, parseOperand) => {
    let left = parseOperand();

    while (left) {
      const operator = operators.find(accept);

      if (!operator) {
        break;
      }

      const right = parseOperand();

      left = right ? { type: 'binary', operator, left, right } : undefined;
    }

    return left;
  };

  /**
   * Parse the arguments of a function call, after the opening parenthesis.
   * @returns {ExpressionNode[] | undefined} Arguments, or `undefined` if they’re invalid.
   */
  const parseArgs = () => {
    /** @type {ExpressionNode[]} */
    const args = [];

    if (accept(')')) {
      return args;
    }

    do {
      const arg = parseAdditive();

      if (!arg) {
        return undefined;
      }

      args.push(arg);
    } while (accept(','));

    return accept(')') ? args : undefined;
  };

  /**
   * Parse a number, a template tag, a function call or an expression in parentheses.
   * @returns {ExpressionNode | undefined} Node, or `undefined` if it’s invalid.
   */
  const parsePrimary = () => {
    const token = tokens[position];

    if (token?.type === 'number' || token?.type === 'tag') {
      position += 1;

      return token;
    }

    if (token?.type === 'name') {
      position += 1;

      const { name } = token;
      const { minArgs, maxArgs } = FUNCTIONS[name] ?? {};
      const args = Object.hasOwn(FUNCTIONS, name) && accept('(') ? parseArgs() : undefined;

      return args && args.length >= minArgs && args.length <= maxArgs
        ? { type: 'call', name, args }
        : undefined;
    }

    if (accept('(')) {
      const node = parseAdditive();

      return node && accept(')') ? node : undefined;
    }

    return undefined;
  };

  /**
   * Parse a unary plus or minus, or a primary expression.
   * @returns {ExpressionNode | undefined} Node, or `undefined` if it’s invalid.
   */
  const parseUnary = () => {
    const operator = ['-', '+'].find(accept);

    if (!operator) {
      return parsePrimary();
    }

    const operand = parseUnary();

    return operand ? { type: 'unary', operator, operand } : undefined;
  };

  /**
   * Parse a multiplication, division or remainder.
   * @returns {ExpressionNode | undefined} Node, or `undefined` if it’s invalid.
   */
  const parseMultiplicative = () => parseBinary(['*', '/', '%'], parseUnary);

  /**
   * Parse an addition or subtraction.
   * @returns {ExpressionNode | undefined} Node, or `undefined` if it’s invalid.
   */
  parseAdditive = () => parseBinary(['+', '-'], parseMultiplicative);

  const tree = parseAdditive();

  // Any token left over, like the second number in `1 2`, makes the expression invalid
  return position === tokens.length ? tree : undefined;
};

/**
 * Parse the given arithmetic expression, such as `{{fields.price}} * {{fields.quantity}}`. It can
 * have numbers, template tags, the `+`, `-`, `*`, `/` and `%` operators, parentheses and the
 * `abs`, `ceil`, `floor`, `max`, `min` and `round` functions. The result is cached and shared
 * between callers.
 * @param {string} expression Expression.
 * @returns {ParsedExpression} Parsed expression.
 */
export const parseExpression = (expression) =>
  getOrCreateBounded(
    parsedExpressionCache,
    expression,
    () => {
      /** @type {string[]} */
      const tags = [];

      const tokens = tokenize(
        replaceTemplateTags(expression, (_match, placeholder) => {
          tags.push(placeholder);

          return TAG_PLACEHOLDER;
        }),
      );

      return { tree: tokens ? buildTree(tokens) : undefined, tags };
    },
    100,
  );

/**
 * Check whether the given arithmetic expression is valid.
 * @param {string} expression Expression.
 * @returns {boolean} Result.
 */
export const isValidExpression = (expression) => !!parseExpression(expression).tree;

/**
 * Convert the value a template tag has resolved to into an operand.
 * @param {any} value Resolved value.
 * @returns {number | undefined} Number, or `undefined` if the value is empty or isn’t a number.
 */
const toOperand = (value) => {
  const string = String(value ?? '').trim();

  return OPERAND_REGEX.test(string) ? Number(string) : undefined;
};

/**
 * Evaluate the given syntax tree.
 * @param {ExpressionNode} node Node.
 * @param {(number | undefined)[]} operands Values of the template tags, by index.
 * @returns {number | undefined} Result, or `undefined` if an operand is missing.
 */
const evaluateNode = (node, operands) => {
  if (node.type === 'number') {
    return node.value;
  }

  if (node.type === 'tag') {
    return operands[node.index];
  }

  if (node.type === 'unary') {
    const operand = evaluateNode(node.operand, operands);

    if (operand === undefined) {
      return undefined;
    }

    return node.operator === '-' ? -operand : operand;
  }

  if (node.type === 'call') {
    const args = node.args.map((arg) => evaluateNode(arg, operands));

    return args.includes(undefined)
      ? undefined
      : FUNCTIONS[node.name].fn(.../** @type {number[]} */ (args));
  }

  const left = evaluateNode(node.left, operands);
  const right = evaluateNode(node.right, operands);

  if (left === undefined || right === undefined) {
    return undefined;
  }

  switch (node.operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
    default:
      return left % right;
  }
};

/**
 * Evaluate the given arithmetic expression. Each template tag in it is resolved with the given
 * function, and the value it resolves to is used as a number.
 * @param {string} expression Expression. See {@link parseExpression} for the syntax.
 * @param {(placeholder: string) => any} resolveTag Function resolving a template tag, given its
 * content, e.g. `fields.price | default('0')` for `{{fields.price | default('0')}}`.
 * @returns {number | undefined} Result. `undefined` if the expression is invalid, a tag resolves to
 * an empty value or something other than a number, or the result isn’t a finite number, as with a
 * division by zero.
 */
export const evaluateExpression = (expression, resolveTag) => {
  const { tree, tags } = parseExpression(expression);

  if (!tree) {
    return undefined;
  }

  const result = evaluateNode(
    tree,
    tags.map((tag) => toOperand(resolveTag(tag))),
  );

  return result !== undefined && Number.isFinite(result) ? result : undefined;
};
