import BooleanEditor from '$lib/components/contents/details/fields/boolean/boolean-editor.svelte';
import BooleanPreview from '$lib/components/contents/details/fields/boolean/boolean-preview.svelte';
import CodeEditor from '$lib/components/contents/details/fields/code/code-editor.svelte';
import CodePreview from '$lib/components/contents/details/fields/code/code-preview.svelte';
import ColorEditor from '$lib/components/contents/details/fields/color/color-editor.svelte';
import ColorPreview from '$lib/components/contents/details/fields/color/color-preview.svelte';
import ComputeEditor from '$lib/components/contents/details/fields/compute/compute-editor.svelte';
import ComputePreview from '$lib/components/contents/details/fields/compute/compute-preview.svelte';
import DateTimeEditor from '$lib/components/contents/details/fields/date-time/date-time-editor.svelte';
import DateTimePreview from '$lib/components/contents/details/fields/date-time/date-time-preview.svelte';
import FileEditor from '$lib/components/contents/details/fields/file/file-editor.svelte';
import FilePreview from '$lib/components/contents/details/fields/file/file-preview.svelte';
import KeyValueEditor from '$lib/components/contents/details/fields/key-value/key-value-editor.svelte';
import KeyValuePreview from '$lib/components/contents/details/fields/key-value/key-value-preview.svelte';
import ListEditor from '$lib/components/contents/details/fields/list/list-editor.svelte';
import ListPreview from '$lib/components/contents/details/fields/list/list-preview.svelte';
import MapEditor from '$lib/components/contents/details/fields/map/map-editor.svelte';
import MapPreview from '$lib/components/contents/details/fields/map/map-preview.svelte';
import MarkdownEditor from '$lib/components/contents/details/fields/markdown/markdown-editor.svelte';
import MarkdownPreview from '$lib/components/contents/details/fields/markdown/markdown-preview.svelte';
import NumberEditor from '$lib/components/contents/details/fields/number/number-editor.svelte';
import NumberPreview from '$lib/components/contents/details/fields/number/number-preview.svelte';
import ObjectEditor from '$lib/components/contents/details/fields/object/object-editor.svelte';
import ObjectPreview from '$lib/components/contents/details/fields/object/object-preview.svelte';
import RelationEditor from '$lib/components/contents/details/fields/relation/relation-editor.svelte';
import RelationPreview from '$lib/components/contents/details/fields/relation/relation-preview.svelte';
import SelectEditor from '$lib/components/contents/details/fields/select/select-editor.svelte';
import SelectPreview from '$lib/components/contents/details/fields/select/select-preview.svelte';
import StringEditor from '$lib/components/contents/details/fields/string/string-editor.svelte';
import StringPreview from '$lib/components/contents/details/fields/string/string-preview.svelte';
import TextEditor from '$lib/components/contents/details/fields/text/text-editor.svelte';
import TextPreview from '$lib/components/contents/details/fields/text/text-preview.svelte';
import UuidEditor from '$lib/components/contents/details/fields/uuid/uuid-editor.svelte';
import UuidPreview from '$lib/components/contents/details/fields/uuid/uuid-preview.svelte';

/**
 * @import { Component } from 'svelte';
 */

/**
 * @type {Record<string, Component>}
 */
export const editors = {
  boolean: BooleanEditor,
  code: CodeEditor,
  color: ColorEditor,
  compute: ComputeEditor,
  datetime: DateTimeEditor,
  file: FileEditor,
  image: FileEditor, // alias
  keyvalue: KeyValueEditor,
  list: ListEditor,
  map: MapEditor,
  markdown: MarkdownEditor,
  number: NumberEditor,
  object: ObjectEditor,
  relation: RelationEditor,
  select: SelectEditor,
  string: StringEditor,
  text: TextEditor,
  uuid: UuidEditor,
};

/**
 * @type {Record<string, Component>}
 */
export const previews = {
  boolean: BooleanPreview,
  code: CodePreview,
  color: ColorPreview,
  compute: ComputePreview,
  datetime: DateTimePreview,
  file: FilePreview,
  image: FilePreview, // alias
  keyvalue: KeyValuePreview,
  list: ListPreview,
  map: MapPreview,
  markdown: MarkdownPreview,
  number: NumberPreview,
  object: ObjectPreview,
  relation: RelationPreview,
  select: SelectPreview,
  string: StringPreview,
  text: TextPreview,
  uuid: UuidPreview,
};
