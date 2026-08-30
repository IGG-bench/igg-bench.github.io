const copyButton = document.querySelector('#copy-citation');

copyButton?.addEventListener('click', async () => {
  const citation = document.querySelector('.code-wrap code')?.textContent ?? '';
  await navigator.clipboard.writeText(citation);
  copyButton.textContent = 'Copied';
  window.setTimeout(() => { copyButton.textContent = 'Copy'; }, 1400);
});
