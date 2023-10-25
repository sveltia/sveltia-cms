import moment from 'moment';
import { getDateTimeParts } from '$lib/services/utils/datetime';

/**
 * Get the current value given the input value.
 * @param {(string | undefined)} inputValue Value on the date/time input widget.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {(string | undefined)} New value.
 * @todo Write tests for this.
 */
export const getCurrentValue = (inputValue, fieldConfig) => {
  const { format, date_format: dateFormat, picker_utc: pickerUTC = false } = fieldConfig;
  const timeOnly = dateFormat === false;

  if (inputValue === '') {
    return '';
  }

  if (!inputValue) {
    return undefined;
  }

  if (timeOnly) {
    return inputValue;
  }

  try {
    if (format) {
      return (pickerUTC ? moment.utc(inputValue) : moment(inputValue)).format(format);
    }

    return new Date(inputValue).toISOString();
  } catch {
    return undefined;
  }
};

/**
 * Get the input value given the current value.
 * @param {(string | undefined)} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {(string | undefined)} New value.
 * @todo Write tests for this.
 */
export const getInputValue = (currentValue, fieldConfig) => {
  const {
    required = true,
    format,
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: pickerUTC = false,
  } = fieldConfig;

  const dateOnly = timeFormat === false;
  const timeOnly = dateFormat === false;

  if (!required && !currentValue) {
    return undefined;
  }

  if (dateOnly && currentValue?.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return currentValue;
  }

  if (timeOnly && currentValue?.match(/^\d{2}:\d{2}$/)) {
    return currentValue;
  }

  try {
    const { year, month, day, hour, minute } = getDateTimeParts({
      date: currentValue
        ? (pickerUTC ? moment.utc(currentValue, format) : moment(currentValue, format)).toDate()
        : new Date(),
      timeZone: pickerUTC ? 'UTC' : undefined,
    });

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}`;

    if (dateOnly) {
      return dateStr;
    }

    if (timeOnly) {
      return timeStr;
    }

    return `${dateStr}T${timeStr}`;
  } catch (ex) {
    return undefined;
  }
};

/**
 * Get a `Date` object given the current value.
 * @param {(string | undefined)} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {(Date | undefined)} Date.
 * @todo Write tests for this.
 */
export const getDate = (currentValue, fieldConfig) => {
  const { format, date_format: dateFormat, picker_utc: pickerUTC = false } = fieldConfig;
  const timeOnly = dateFormat === false;

  if (!currentValue) {
    return undefined;
  }

  try {
    if (format) {
      if (pickerUTC) {
        return moment.utc(currentValue, format).toDate();
      }

      return moment(currentValue, format).toDate();
    }

    if (timeOnly) {
      return new Date(new Date(`${new Date().toJSON().split('T')[0]}T${currentValue}`));
    }

    return new Date(currentValue);
  } catch {
    return undefined;
  }
};
