import { loadSignInMethods, startTokenRefresh } from '$lib/services/additions/auth.svelte';
import { startComments } from '$lib/services/additions/comments.svelte';
import { startConversations } from '$lib/services/additions/conversation.svelte';
import { startCredentials } from '$lib/services/additions/credentials.svelte';
import { startLocks } from '$lib/services/additions/locks.svelte';
import { readSetupResult } from '$lib/services/additions/setup.svelte';
import { startSocket } from '$lib/services/additions/socket.svelte';

/**
 * Get the sign-in page ready: read the outcome of connecting the service to GitHub, if the user is
 * coming back from there, and find out the sign-in methods the service offers.
 */
export const prepareSignIn = () => {
  readSetupResult();
  loadSignInMethods();
};

/**
 * Share the entry locks, comment counts and credentials, and keep the GitHub token fresh, while the
 * user is signed in.
 * @returns {() => void} Function to stop all of them, once the user signs out.
 */
export const startSession = () => {
  // The socket is connected once everything that listens to it is ready
  const stops = [
    startComments(),
    startConversations(),
    startCredentials(),
    startLocks(),
    startSocket(),
    startTokenRefresh(),
  ];

  return () => {
    stops.forEach((stop) => stop());
  };
};
