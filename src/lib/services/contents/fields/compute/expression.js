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
 * A template tag in an arithmetic expression.
 * @typedef {object} ExpressionTag
 * @property {string} content Content of the tag, e.g. `fields.price` for `{{fields.price}}`.
 * @property {boolean} allItems Whether the tag is an argument of an aggregate function, like
 * `{{fields.lines.*.amount}}` in `sum({{fields.lines.*.amount}})`. It then resolves to a list of
 * values, one for each item the last `*` in the tag stands for.
 */

/**
 * A parsed arithmetic expression.
 * @typedef {object} ParsedExpression
 * @property {ExpressionNode} [tree] Syntax tree. `undefined` if the expression is invalid.
 * @property {ExpressionTag[]} tags Template tags in the expression, in the order they appear. A
 * `tag` node refers to one by its index.
 */

/**
 * Value of a template tag in an arithmetic expression: a number, `undefined` for an empty value or
 * something other than a number, or the resolved values of a tag that covers every item.
 * @typedef {number | undefined | unknown[]} ExpressionOperand
 */

/**
 * Function resolving a template tag of an arithmetic expression.
 * @callback ExpressionTagResolver
 * @param {string} content Content of the tag, e.g. `fields.price | default('0')` for
 * `{{fields.price | default('0')}}`.
 * @param {{ allItems: boolean }} options Options. With `allItems`, the tag is an argument of an
 * aggregate function, and the function returns a list of values, one for each item the last `*` in
 * the tag stands for, or a list with the single value of a tag without a `*`.
 * @returns {any} Resolved value, or values with `allItems`.
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
 * Functions available in an expression that take numbers, with the number of arguments each one
 * accepts.
 * @type {Record<string, { minArgs: number, maxArgs: number, fn: (...args: number[]) => number }>}
 */
const FUNCTIONS = {
  abs: { minArgs: 1, maxArgs: 1, fn: Math.abs },
  ceil: { minArgs: 1, maxArgs: 1, fn: Math.ceil },
  floor: { minArgs: 1, maxArgs: 1, fn: Math.floor },
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
 * Aggregate functions available in an expression, which take any number of arguments: `avg`,
 * `count`, `max`, `min` and `sum`. A template tag passed directly to one covers every item of a
 * list, like `{{fields.lines.*.amount}}`, and its empty values are left out, so an item that has
 * yet to be filled in doesn’t empty the result. `count` counts the values, whatever they are; the
 * others compute from numbers.
 */
const AGGREGATE_FUNCTIONS = ['avg', 'count', 'max', 'min', 'sum'];
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
 * @returns {{ tree: ExpressionNode | undefined, allItemsTagIndexes: Set<number> }} Syntax tree,
 * `undefined` if the tokens don’t form a valid expression, and the indexes of the template tags
 * passed directly to an aggregate function.
 */
const buildTree = (tokens) => {
  let position = 0;
  /** @type {Set<number>} */
  const allItemsTagIndexes = new Set();

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
      const aggregate = AGGREGATE_FUNCTIONS.includes(name);

      const { minArgs, maxArgs } = aggregate
        ? { minArgs: 1, maxArgs: Infinity }
        : (FUNCTIONS[name] ?? {});

      const args =
        (aggregate || Object.hasOwn(FUNCTIONS, name)) && accept('(') ? parseArgs() : undefined;

      if (!args || args.length < minArgs || args.length > maxArgs) {
        return undefined;
      }

      if (aggregate) {
        args.forEach((arg) => {
          if (arg.type === 'tag') {
            allItemsTagIndexes.add(arg.index);
          }
        });
      }

      return { type: 'call', name, args };
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
  return { tree: position === tokens.length ? tree : undefined, allItemsTagIndexes };
};

/**
 * Parse the given arithmetic expression, such as `{{fields.price}} * {{fields.quantity}}`. It can
 * have numbers, template tags, the `+`, `-`, `*`, `/` and `%` operators, parentheses, the `abs`,
 * `ceil`, `floor` and `round` functions and the `avg`, `count`, `max`, `min` and `sum` aggregate
 * functions. The result is cached and shared between callers.
 * @param {string} expression Expression.
 * @returns {ParsedExpression} Parsed expression.
 */
export const parseExpression = (expression) =>
  getOrCreateBounded(
    parsedExpressionCache,
    expression,
    () => {
      /** @type {string[]} */
      const contents = [];

      const tokens = tokenize(
        replaceTemplateTags(expression, (_match, placeholder) => {
          contents.push(placeholder);

          return TAG_PLACEHOLDER;
        }),
      );

      const { tree, allItemsTagIndexes } = tokens
        ? buildTree(tokens)
        : { tree: undefined, allItemsTagIndexes: new Set() };

      return {
        tree,
        tags: contents.map((content, index) => ({
          content,
          allItems: allItemsTagIndexes.has(index),
        })),
      };
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
 * Check whether the given resolved value is empty.
 * @param {unknown} value Value.
 * @returns {boolean} Result.
 */
const isEmptyValue = (value) => !String(value ?? '').trim();

/**
 * Evaluate a call of an aggregate function.
 * @param {string} name Function name.
 * @param {ExpressionNode[]} args Arguments.
 * @param {ExpressionOperand[]} operands Values of the template tags, by index.
 * @param {(node: ExpressionNode) => number | undefined} evaluate Function evaluating an argument
 * other than a template tag covering every item.
 * @returns {number | undefined} Result, or `undefined` if a value isn’t a number, or there is no
 * value to compute the average, the maximum or the minimum of.
 */
const evaluateAggregate = (name, args, operands, evaluate) => {
  /** @type {number[]} */
  const values = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const arg of args) {
    const operand = arg.type === 'tag' ? operands[arg.index] : undefined;

    if (Array.isArray(operand)) {
      // eslint-disable-next-line no-restricted-syntax
      for (const value of operand.filter((_value) => !isEmptyValue(_value))) {
        // Anything counts, while the others need a number
        const number = name === 'count' ? 0 : toOperand(value);

        if (number === undefined) {
          return undefined;
        }

        values.push(number);
      }
    } else {
      const value = evaluate(arg);

      if (value === undefined) {
        return undefined;
      }

      values.push(value);
    }
  }

  if (name === 'count') {
    return values.length;
  }

  const sum = values.reduce((total, value) => total + value, 0);

  if (name === 'sum') {
    return sum;
  }

  if (!values.length) {
    return undefined;
  }

  if (name === 'avg') {
    return sum / values.length;
  }

  return name === 'max' ? Math.max(...values) : Math.min(...values);
};

/**
 * Evaluate the given syntax tree.
 * @param {ExpressionNode} node Node.
 * @param {ExpressionOperand[]} operands Values of the template tags, by index.
 * @returns {number | undefined} Result, or `undefined` if an operand is missing.
 */
const evaluateNode = (node, operands) => {
  if (node.type === 'number') {
    return node.value;
  }

  if (node.type === 'tag') {
    // A tag covering every item is only passed to an aggregate function, which reads it itself
    return /** @type {number | undefined} */ (operands[node.index]);
  }

  if (node.type === 'unary') {
    const operand = evaluateNode(node.operand, operands);

    if (operand === undefined) {
      return undefined;
    }

    return node.operator === '-' ? -operand : operand;
  }

  if (node.type === 'call') {
    if (AGGREGATE_FUNCTIONS.includes(node.name)) {
      return evaluateAggregate(node.name, node.args, operands, (arg) =>
        evaluateNode(arg, operands),
      );
    }

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
 * @param {ExpressionTagResolver} resolveTag Function resolving a template tag.
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
    tags.map(({ content, allItems }) =>
      allItems
        ? [resolveTag(content, { allItems })].flat()
        : toOperand(resolveTag(content, { allItems })),
    ),
  );

  return result !== undefined && Number.isFinite(result) ? result : undefined;
};
