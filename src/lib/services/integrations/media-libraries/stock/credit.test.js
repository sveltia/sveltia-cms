import { sanitize } from 'isomorphic-dompurify';
import { describe, expect, test } from 'vitest';

import {
  createAttributedCredit,
  createLinkedCredit,
  removeStockCredits,
} from '$lib/services/integrations/media-libraries/stock/credit';
import { LINK_SANITIZE_OPTIONS } from '$lib/services/utils/string';

// The name can be anything, including what a credit starts with
const NAME = 'Photo by <Studio> & Co';

const LINKED_CREDIT = createLinkedCredit({
  name: NAME,
  serviceLabel: 'Pexels',
  url: 'https://www.pexels.com/photo/a-1/?a=1&b="2"',
});

const ATTRIBUTED_CREDIT = createAttributedCredit({
  name: NAME,
  profileURL: 'https://unsplash.com/@studio?a=1&b=2',
  serviceLabel: 'Unsplash',
  serviceURL: 'https://unsplash.com/?a=1&b=2',
});

describe('createLinkedCredit()', () => {
  test('links the whole credit to the photo page, escaping the values', () => {
    expect(LINKED_CREDIT).toBe(
      '<a href="https://www.pexels.com/photo/a-1/?a=1&amp;b=&quot;2&quot;">' +
        'Photo by Photo by &lt;Studio&gt; &amp; Co on Pexels</a>',
    );
  });
});

describe('createAttributedCredit()', () => {
  test('links the photographer and the service, escaping the values', () => {
    expect(ATTRIBUTED_CREDIT).toBe(
      'Photo by <a href="https://unsplash.com/@studio?a=1&amp;b=2">' +
        'Photo by &lt;Studio&gt; &amp; Co</a> on <a href="https://unsplash.com/?a=1&amp;b=2">' +
        'Unsplash</a>',
    );
  });
});

describe('removeStockCredits()', () => {
  test('matches a credit as created, or as sanitized', () => {
    [LINKED_CREDIT, ATTRIBUTED_CREDIT].forEach((credit) => {
      [credit, sanitize(credit, LINK_SANITIZE_OPTIONS)].forEach((variant) => {
        expect(removeStockCredits(`A cow.  ${variant}  Taken 2024. ${variant}`)).toBe(
          'A cow. Taken 2024.',
        );
      });
    });
  });

  test('leaves any other text alone', () => {
    [
      'Photo by me.',
      'Photo by me on a hill.',
      'See <a href="/x">the gallery</a> on <b>Monday</b>.',
      '<a href="/x">My photos</a>',
    ].forEach((text) => {
      expect(removeStockCredits(text)).toBe(text);
    });
  });
});
