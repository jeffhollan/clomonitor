import isNull from 'lodash/isNull';

import { SearchFiltersURL } from '../types';

interface F {
  [key: string]: string[];
}

const WHITELISTED_FILTER_KEYS = [
  'category', // Project category
  'maturity', // Project maturity
  'rating', // Quality rating
];

const buildSearchParams = (p: URLSearchParams): SearchFiltersURL => {
  let filters: F = {};

  p.forEach((value, key) => {
    if (WHITELISTED_FILTER_KEYS.includes(key)) {
      const values = filters[key] || [];
      values.push(value);
      filters[key] = values;
    }
  });

  return {
    text: p.has('text') ? p.get('text')! : undefined,
    accepted_from: p.has('accepted_from') ? p.get('accepted_from')! : undefined,
    accepted_to: p.has('accepted_to') ? p.get('accepted_to')! : undefined,
    filters: { ...filters },
    pageNumber: p.has('page') && !isNull(p.get('page')) ? parseInt(p.get('page')!) : 1,
  };
};

export default buildSearchParams;
