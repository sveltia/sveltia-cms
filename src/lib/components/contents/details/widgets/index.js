import BooleanEditor from '$lib/components/contents/details/widgets/boolean/boolean-editor.svelte';
import BooleanPreview from '$lib/components/contents/details/widgets/boolean/boolean-preview.svelte';
import ColorEditor from '$lib/components/contents/details/widgets/color/color-editor.svelte';
import ColorPreview from '$lib/components/contents/details/widgets/color/color-preview.svelte';
import ComputeEditor from '$lib/components/contents/details/widgets/compute/compute-editor.svelte';
import ComputePreview from '$lib/components/contents/details/widgets/compute/compute-preview.svelte';
import DateTimeEditor from '$lib/components/contents/details/widgets/date-time/date-time-editor.svelte';
import DateTimePreview from '$lib/components/contents/details/widgets/date-time/date-time-preview.svelte';
import FileEditor from '$lib/components/contents/details/widgets/file/file-editor.svelte';
import FilePreview from '$lib/components/contents/details/widgets/file/file-preview.svelte';
import ListEditor from '$lib/components/contents/details/widgets/list/list-editor.svelte';
import ListPreview from '$lib/components/contents/details/widgets/list/list-preview.svelte';
import MarkdownEditor from '$lib/components/contents/details/widgets/markdown/markdown-editor.svelte';
import MarkdownPreview from '$lib/components/contents/details/widgets/markdown/markdown-preview.svelte';
import NumberEditor from '$lib/components/contents/details/widgets/number/number-editor.svelte';
import NumberPreview from '$lib/components/contents/details/widgets/number/number-preview.svelte';
import ObjectEditor from '$lib/components/contents/details/widgets/object/object-editor.svelte';
import ObjectPreview from '$lib/components/contents/details/widgets/object/object-preview.svelte';
import RelationEditor from '$lib/components/contents/details/widgets/relation/relation-editor.svelte';
import RelationPreview from '$lib/components/contents/details/widgets/relation/relation-preview.svelte';
import SelectEditor from '$lib/components/contents/details/widgets/select/select-editor.svelte';
import SelectPreview from '$lib/components/contents/details/widgets/select/select-preview.svelte';
import StringEditor from '$lib/components/contents/details/widgets/string/string-editor.svelte';
import StringPreview from '$lib/components/contents/details/widgets/string/string-preview.svelte';
import TextEditor from '$lib/components/contents/details/widgets/text/text-editor.svelte';
import TextPreview from '$lib/components/contents/details/widgets/text/text-preview.svelte';
import UuidEditor from '$lib/components/contents/details/widgets/uuid/uuid-editor.svelte';
import UuidPreview from '$lib/components/contents/details/widgets/uuid/uuid-preview.svelte';

/**
 * @type {Record<string, any>}
 */
export const editors = {
  boolean: BooleanEditor,
  color: ColorEditor,
  compute: ComputeEditor,
  datetime: DateTimeEditor,
  file: FileEditor,
  image: FileEditor, // alias
  list: ListEditor,
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
 * @type {Record<string, any>}
 */
export const previews = {
  boolean: BooleanPreview,
  color: ColorPreview,
  compute: ComputePreview,
  datetime: DateTimePreview,
  file: FilePreview,
  image: FilePreview, // alias
  list: ListPreview,
  markdown: MarkdownPreview,
  number: NumberPreview,
  object: ObjectPreview,
  relation: RelationPreview,
  select: SelectPreview,
  string: StringPreview,
  text: TextPreview,
  uuid: UuidPreview,
};
