import { describe, expect, it } from 'vitest';

import { getSignInOptions } from './sign-in-options';

describe('getSignInOptions', () => {
  it('should use the backend label and show every option by default', () => {
    expect(getSignInOptions({ name: 'github', repo: 'user/repo' }, 'GitHub')).toEqual({
      serviceLabel: 'GitHub',
      tokenOptionHidden: false,
      oauthOptionHidden: false,
      oauthOptionDisabled: false,
    });
  });

  it('should leave the label unset for an unsupported backend', () => {
    // @ts-ignore - unsupported backend name
    expect(getSignInOptions({ name: 'unknown' }, undefined).serviceLabel).toBeUndefined();
  });

  it('should label Forgejo on Codeberg as Codeberg', () => {
    expect(
      getSignInOptions(
        { name: 'gitea', repo: 'user/repo', base_url: 'https://codeberg.org', app_id: 'id' },
        'Gitea / Forgejo',
      ),
    ).toEqual({
      serviceLabel: 'Codeberg',
      tokenOptionHidden: false,
      oauthOptionHidden: false,
      oauthOptionDisabled: false,
    });
  });

  it('should label the Forgejo backend on Codeberg as Codeberg', () => {
    expect(
      getSignInOptions(
        { name: 'forgejo', repo: 'user/repo', api_root: 'https://codeberg.org/api/v1/' },
        'Forgejo',
      ),
    ).toEqual({
      serviceLabel: 'Codeberg',
      tokenOptionHidden: false,
      oauthOptionHidden: false,
      oauthOptionDisabled: true,
    });
  });

  it('should keep the label for the Forgejo backend on another instance', () => {
    expect(
      getSignInOptions(
        {
          name: 'forgejo',
          repo: 'user/repo',
          api_root: 'https://forgejo.example.com/api/v1',
          app_id: 'id',
        },
        'Forgejo',
      ),
    ).toMatchObject({ serviceLabel: 'Forgejo', oauthOptionDisabled: false });
  });

  it('should keep the backend label for another Gitea instance', () => {
    expect(
      getSignInOptions(
        { name: 'gitea', repo: 'user/repo', base_url: 'https://gitea.example.com', app_id: 'id' },
        'Gitea / Forgejo',
      ).serviceLabel,
    ).toBe('Gitea / Forgejo');
  });

  it('should disable the OAuth option for Gitea without an app ID', () => {
    expect(
      getSignInOptions({ name: 'gitea', repo: 'user/repo' }, 'Gitea / Forgejo').oauthOptionDisabled,
    ).toBe(true);
  });

  it('should hide the options left out of the authentication methods', () => {
    expect(
      getSignInOptions({ name: 'github', repo: 'user/repo', auth_methods: ['oauth'] }, 'GitHub'),
    ).toMatchObject({ tokenOptionHidden: true, oauthOptionHidden: false });
    expect(
      getSignInOptions({ name: 'github', repo: 'user/repo', auth_methods: ['token'] }, 'GitHub'),
    ).toMatchObject({ tokenOptionHidden: false, oauthOptionHidden: true });
  });

  it('should show both options for the test repository', () => {
    expect(
      // @ts-ignore - the test repository has no authentication methods
      getSignInOptions({ name: 'test-repo', auth_methods: [] }, 'Test'),
    ).toMatchObject({ tokenOptionHidden: false, oauthOptionHidden: false });
  });
});
