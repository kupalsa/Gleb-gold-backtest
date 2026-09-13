export function wireDataConnection({ connectionButton, syncButton, dialog, form, closeButton, store, refresh, setStatus }) {
  const reportError = (error) => setStatus('error', error.message);
  connectionButton?.addEventListener('click', () => dialog.showModal());
  closeButton?.addEventListener('click', () => dialog.close());
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { owner, repo, token, remember } = Object.fromEntries(new FormData(form));
    try {
      store.connectGitHub({ owner, repo, token, remember: Boolean(remember) });
      form.reset();
      dialog.close();
      await refresh();
    } catch (error) { reportError(error); }
  });
  syncButton?.addEventListener('click', async () => {
    try { await refresh(); } catch (error) { reportError(error); }
  });
}
