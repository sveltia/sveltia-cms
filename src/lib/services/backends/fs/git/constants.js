/**
 * @import { LocalGitOperation } from '$lib/types/private';
 */

/**
 * Root directory of the repository in the file system given to isomorphic-git.
 */
export const DIR = '/';

/**
 * Lock file Git creates while it updates the index. Git refuses to touch the index while it exists,
 * so the CMS creates it as well while it commits, and doesn’t commit while another Git process has
 * created it.
 */
export const INDEX_LOCK_PATH = '.git/index.lock';

/**
 * Index file, which lists the files staged for the next commit.
 */
export const INDEX_PATH = '.git/index';

/**
 * Files and directories in `.git` that exist while an operation that has to be finished or aborted
 * on the command line is in progress, along with the operation. A commit made in the meantime would
 * get in the way. `rebase-apply` is also used by `git am`, which marks it with an `applying` file.
 * @type {[string, LocalGitOperation][]}
 */
export const OPERATION_MARKERS = [
  ['MERGE_HEAD', 'merge'],
  ['CHERRY_PICK_HEAD', 'cherry_pick'],
  ['REVERT_HEAD', 'revert'],
  ['rebase-merge', 'rebase'],
  ['rebase-apply', 'rebase'],
  ['sequencer', 'cherry_pick'],
];

/**
 * Object ID Git uses in a reflog for a branch that didn’t exist before.
 */
export const ZERO_OID = '0'.repeat(40);
