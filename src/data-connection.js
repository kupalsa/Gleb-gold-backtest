export function connectionInput(entries, rememberChecked = false) {
  const values = Object.fromEntries(entries);
  return {
    owner: String(values.owner || '').trim(),
    repo: String(values.repo || '').trim(),
    token: String(values.token || ''),
    remember: Boolean(rememberChecked)
  };
}

function prefillConnectionForm(form, connection) {
  if (!connection) return;
  form.elements.owner.value = connection.owner || '';
  form.elements.repo.value = connection.repo || '';
  form.elements.token.value = '';
}

export function wireDataConnection({ connectionButton, syncButton, dialog, form, closeButton, store, refresh, setStatus, setDialogStatus = () => {}, formData = (target) => new FormData(target) }) {
  const reportError = (error) => {
    setStatus('error', error.message);
    setDialogStatus('error', error.message);
  };
  connectionButton?.addEventListener('click', () => {
    const connection = store.connectionDetails?.();
    prefillConnectionForm(form, connection);
    if (connection) setDialogStatus('success', `Connected to ${connection.owner}/${connection.repo}. Enter a token only to replace this connection.`);
    else setDialogStatus('', '');
    dialog.showModal();
  });
  closeButton?.addEventListener('click', () => dialog.close());
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = connectionInput(formData(form), form.elements.remember?.checked ?? false);
    try {
      store.connectGitHub(input);
      await refresh();
      const connection = store.connectionDetails?.() || input;
      form.elements.token.value = '';
      setStatus('github', `Connected to ${connection.owner}/${connection.repo}.`);
      setDialogStatus('success', `Connected to ${connection.owner}/${connection.repo}. Your private trades are ready to sync.`);
    } catch (error) { reportError(error); }
  });
  syncButton?.addEventListener('click', async () => {
    try { await refresh(); } catch (error) { reportError(error); }
  });
}
