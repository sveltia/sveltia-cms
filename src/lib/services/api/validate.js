/**
 * Throw a `TypeError` with the given message unless the condition holds. The helpers for the
 * `CMS.*()` methods’ arguments below build their error messages on top of it.
 * @param {boolean} valid Whether the value is valid.
 * @param {string} message Error message.
 * @throws {TypeError} If `valid` is `false`.
 */
export const assertValid = (valid, message) => {
  if (!valid) {
    throw new TypeError(message);
  }
};

/**
 * Check an option of a `CMS.*()` method, throwing a `TypeError` that names the option and method.
 * @param {boolean} valid Whether the option is valid.
 * @param {string} method Method name, e.g. `registerFieldType`.
 * @param {string} option Option name.
 * @param {string} expected What the option must be, e.g. `a non-empty string`.
 * @throws {TypeError} If `valid` is `false`.
 */
export const assertOption = (valid, method, option, expected) => {
  assertValid(valid, `The \`${option}\` option for \`CMS.${method}()\` must be ${expected}`);
};

/**
 * Check a property of the definition object given to a `CMS.*()` method, throwing a `TypeError`
 * that names the property.
 * @param {boolean} valid Whether the property is valid.
 * @param {string} property Property name, without the `definition.` prefix.
 * @param {string} expected What the property must be, e.g. `a function`.
 * @throws {TypeError} If `valid` is `false`.
 */
export const assertDefinition = (valid, property, expected) => {
  assertValid(valid, `The \`definition.${property}\` must be ${expected}`);
};

/**
 * Throw an error if the name is reserved for a built-in feature, so a custom one can’t shadow it.
 * @param {object} args Arguments.
 * @param {string} args.name Name the developer chose.
 * @param {readonly string[]} args.reserved Names of the built-in features.
 * @param {string} args.subject What is named, e.g. `field type`.
 * @param {string} args.builtin The built-in feature, e.g. `built-in field type`.
 * @param {string} args.custom The custom feature, e.g. `custom field type`.
 * @throws {Error} If the name is reserved.
 */
export const assertNotReserved = ({ name, reserved, subject, builtin, custom }) => {
  if (reserved.includes(name)) {
    throw new Error(
      `The ${subject} name "${name}" is reserved for a ${builtin}. ` +
        `Choose a different name for your ${custom}.`,
    );
  }
};

/**
 * Parse a URL or file path given by a developer, resolving a relative one against the page that
 * loaded the CMS now, as the CMS URL hash changes as the user navigates.
 * @param {string} url URL or file path.
 * @returns {URL | null} Absolute URL, or `null` if it can’t be parsed.
 */
export const parseURLFromPage = (url) => URL.parse(url, window.location.href);
